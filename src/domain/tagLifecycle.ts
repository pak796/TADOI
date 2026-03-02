import type { Task } from "./models";
import {
  TagAliases,
  compressTagAliases,
  computeTagUsage,
  normalizeTagAliases,
  normalizeTagCompat,
  resolveTag,
  resolveTagWithMeta,
  rewriteTagsOnTask
} from "./tagAliases";
import { isPriorityToken } from "./priorityTags";

export type TagRewriteDelta = {
  from: string;
  to: string;
  beforeCount: number;
  afterCount: number;
};

export type TagOperationPreview = {
  operation: "rename" | "merge" | "cleanup";
  summary: string;
  tasksAffected: number;
  deltas: TagRewriteDelta[];
  warnings: string[];
  nextTasks: Task[];
  nextAliases: TagAliases;
  aliasesAdded: Array<{ source: string; target: string }>;
  aliasesRemoved: string[];
};

export type TagHygieneReport = {
  summary: string;
  normalizationCollisions: Array<{ canonical: string; raws: string[] }>;
  aliasChains: Array<{ source: string; chain: string[] }>;
  cycles: string[][];
  warnings: string[];
};

function sortDeltas(deltas: TagRewriteDelta[]): TagRewriteDelta[] {
  return deltas.sort((left, right) => {
    if (left.beforeCount !== right.beforeCount) {
      return right.beforeCount - left.beforeCount;
    }
    return left.from.localeCompare(right.from);
  });
}

function computeDeltas(
  beforeUsage: Map<string, number>,
  afterUsage: Map<string, number>,
  rewriteMap: Map<string, string>
): TagRewriteDelta[] {
  const deltas: TagRewriteDelta[] = [];
  for (const [from, to] of rewriteMap.entries()) {
    deltas.push({
      from,
      to,
      beforeCount: beforeUsage.get(from) ?? 0,
      afterCount: afterUsage.get(to) ?? 0
    });
  }
  return sortDeltas(deltas);
}

function applyRewriteAcrossTasks(
  tasks: Task[],
  aliases: TagAliases,
  rewriteMap: Map<string, string>,
  now: number
): { nextTasks: Task[]; tasksAffected: number } {
  let tasksAffected = 0;
  const nextTasks = tasks.map((task) => {
    const rewritten = rewriteTagsOnTask(task, rewriteMap, aliases, now);
    const changed = rewritten.tags.length !== task.tags.length || rewritten.tags.some((tag, index) => tag !== task.tags[index]);
    if (!changed) {
      return task;
    }
    tasksAffected += 1;
    return rewritten;
  });
  return { nextTasks, tasksAffected };
}

export function findAliasCycles(aliases: TagAliases): string[][] {
  const cycles: string[][] = [];
  const seenCycleKeys = new Set<string>();

  for (const source of Object.keys(aliases)) {
    const path: string[] = [];
    const seen = new Set<string>();
    let current: string | undefined = source;
    while (current) {
      if (seen.has(current)) {
        const startIndex = path.indexOf(current);
        if (startIndex >= 0) {
          const cycle = [...path.slice(startIndex), current];
          const normalizedKey = [...new Set(cycle)].sort((a, b) => a.localeCompare(b)).join("|");
          if (!seenCycleKeys.has(normalizedKey)) {
            seenCycleKeys.add(normalizedKey);
            cycles.push(cycle);
          }
        }
        break;
      }
      seen.add(current);
      path.push(current);
      current = aliases[current];
    }
  }

  return cycles.sort((left, right) => left.join("->").localeCompare(right.join("->")));
}

export function planTagRename(params: {
  tasks: Task[];
  aliases: TagAliases;
  oldTag: string;
  newTag: string;
  now: number;
}): TagOperationPreview {
  const source = resolveTag(params.oldTag, params.aliases);
  const normalizedTarget = normalizeTagCompat(params.newTag);
  const target = normalizedTarget ? resolveTag(normalizedTarget, params.aliases) ?? normalizedTarget : null;

  if (!source || !target || isPriorityToken(source) || isPriorityToken(target)) {
    return {
      operation: "rename",
      summary: "Error: rename requires non-priority canonical tags",
      tasksAffected: 0,
      deltas: [],
      warnings: ["Rename skipped: invalid source/target tag."],
      nextTasks: params.tasks,
      nextAliases: params.aliases,
      aliasesAdded: [],
      aliasesRemoved: []
    };
  }

  if (source === target) {
    return {
      operation: "rename",
      summary: `Rename is a no-op (${source} -> ${target})`,
      tasksAffected: 0,
      deltas: [],
      warnings: ["Source and target resolve to the same canonical tag."],
      nextTasks: params.tasks,
      nextAliases: params.aliases,
      aliasesAdded: [],
      aliasesRemoved: []
    };
  }

  const rewriteMap = new Map<string, string>([[source, target]]);
  const beforeUsage = computeTagUsage(params.tasks, params.aliases);
  const { nextTasks, tasksAffected } = applyRewriteAcrossTasks(
    params.tasks,
    params.aliases,
    rewriteMap,
    params.now
  );

  const draftAliases = {
    ...params.aliases,
    [source]: target
  };
  const nextAliases = compressTagAliases(normalizeTagAliases(draftAliases));
  const afterUsage = computeTagUsage(nextTasks, nextAliases);

  return {
    operation: "rename",
    summary: `Rename ${source} -> ${target}`,
    tasksAffected,
    deltas: computeDeltas(beforeUsage, afterUsage, rewriteMap),
    warnings: [],
    nextTasks,
    nextAliases,
    aliasesAdded: [{ source, target }],
    aliasesRemoved: []
  };
}

export function planTagMerge(params: {
  tasks: Task[];
  aliases: TagAliases;
  sources: string[];
  target: string;
  now: number;
}): TagOperationPreview {
  const normalizedTarget = normalizeTagCompat(params.target);
  const resolvedTarget = normalizedTarget
    ? resolveTag(normalizedTarget, params.aliases) ?? normalizedTarget
    : null;

  if (!resolvedTarget || isPriorityToken(resolvedTarget)) {
    return {
      operation: "merge",
      summary: "Error: merge target must be a non-priority canonical tag",
      tasksAffected: 0,
      deltas: [],
      warnings: ["Merge skipped: invalid target tag."],
      nextTasks: params.tasks,
      nextAliases: params.aliases,
      aliasesAdded: [],
      aliasesRemoved: []
    };
  }

  const resolvedSources = Array.from(
    new Set(
      params.sources
        .map((source) => resolveTag(source, params.aliases))
        .filter((tag): tag is string => tag !== null && !isPriorityToken(tag))
    )
  ).filter((source) => source !== resolvedTarget);

  if (resolvedSources.length === 0) {
    return {
      operation: "merge",
      summary: `Merge is a no-op (target ${resolvedTarget})`,
      tasksAffected: 0,
      deltas: [],
      warnings: ["No valid source tags resolved for merge."],
      nextTasks: params.tasks,
      nextAliases: params.aliases,
      aliasesAdded: [],
      aliasesRemoved: []
    };
  }

  const rewriteMap = new Map<string, string>(
    resolvedSources.map((source) => [source, resolvedTarget])
  );

  const beforeUsage = computeTagUsage(params.tasks, params.aliases);
  const { nextTasks, tasksAffected } = applyRewriteAcrossTasks(
    params.tasks,
    params.aliases,
    rewriteMap,
    params.now
  );

  const draftAliases: TagAliases = { ...params.aliases };
  for (const source of resolvedSources) {
    draftAliases[source] = resolvedTarget;
  }
  const nextAliases = compressTagAliases(normalizeTagAliases(draftAliases));
  const afterUsage = computeTagUsage(nextTasks, nextAliases);

  return {
    operation: "merge",
    summary: `Merge ${resolvedSources.join(", ")} -> ${resolvedTarget}`,
    tasksAffected,
    deltas: computeDeltas(beforeUsage, afterUsage, rewriteMap),
    warnings: [],
    nextTasks,
    nextAliases,
    aliasesAdded: resolvedSources.map((source) => ({ source, target: resolvedTarget })),
    aliasesRemoved: []
  };
}

function cleanupAliases(aliases: TagAliases, tasks: Task[]): {
  nextAliases: TagAliases;
  removed: string[];
} {
  const usedSourceTags = new Set<string>();
  for (const task of tasks) {
    for (const tag of task.tags) {
      if (isPriorityToken(tag)) continue;
      const normalized = normalizeTagCompat(tag);
      if (!normalized) continue;
      usedSourceTags.add(normalized);
    }
  }

  let current = { ...aliases };
  const removed = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    const targetSet = new Set(Object.values(current));
    for (const source of Object.keys(current)) {
      if (usedSourceTags.has(source)) continue;
      if (targetSet.has(source)) continue;
      delete current[source];
      removed.add(source);
      changed = true;
    }
  }

  return {
    nextAliases: compressTagAliases(current),
    removed: Array.from(removed).sort((a, b) => a.localeCompare(b))
  };
}

export function planTagCleanup(params: {
  tasks: Task[];
  aliases: TagAliases;
}): TagOperationPreview {
  const { nextAliases, removed } = cleanupAliases(params.aliases, params.tasks);
  return {
    operation: "cleanup",
    summary: removed.length > 0 ? `Cleanup removed ${String(removed.length)} aliases` : "Cleanup found no removable aliases",
    tasksAffected: 0,
    deltas: [],
    warnings: [],
    nextTasks: params.tasks,
    nextAliases,
    aliasesAdded: [],
    aliasesRemoved: removed
  };
}

export function reportTagHygiene(params: {
  tasks: Task[];
  aliases: TagAliases;
}): TagHygieneReport {
  const collisionMap = new Map<string, Set<string>>();
  const recordRaw = (raw: string) => {
    const normalized = normalizeTagCompat(raw);
    if (!normalized || isPriorityToken(normalized)) {
      return;
    }
    const bucket = collisionMap.get(normalized) ?? new Set<string>();
    bucket.add(raw);
    collisionMap.set(normalized, bucket);
  };

  for (const task of params.tasks) {
    for (const tag of task.tags) {
      if (isPriorityToken(tag)) continue;
      recordRaw(tag);
    }
  }
  for (const source of Object.keys(params.aliases)) {
    recordRaw(source);
  }
  for (const target of Object.values(params.aliases)) {
    recordRaw(target);
  }

  const normalizationCollisions = Array.from(collisionMap.entries())
    .filter(([, raws]) => raws.size > 1)
    .map(([canonical, raws]) => ({ canonical, raws: Array.from(raws).sort((a, b) => a.localeCompare(b)) }))
    .sort((left, right) => left.canonical.localeCompare(right.canonical));

  const aliasChains = Object.keys(params.aliases)
    .map((source) => ({ source, meta: resolveTagWithMeta(source, params.aliases) }))
    .filter((entry) => entry.meta.chain.length > 1)
    .map((entry) => ({ source: entry.source, chain: entry.meta.chain }))
    .sort((left, right) => left.source.localeCompare(right.source));

  const cycles = findAliasCycles(params.aliases);

  const warnings: string[] = [];
  if (cycles.length > 0) {
    warnings.push(`Detected ${String(cycles.length)} alias cycle(s).`);
  }
  for (const chain of aliasChains) {
    const meta = resolveTagWithMeta(chain.source, params.aliases);
    if (meta.depthCapped) {
      warnings.push(`Alias chain depth capped for ${chain.source}.`);
    }
  }

  const summary = `Hygiene: collisions=${String(normalizationCollisions.length)} chains=${String(aliasChains.length)} cycles=${String(cycles.length)}`;
  return {
    summary,
    normalizationCollisions,
    aliasChains,
    cycles,
    warnings
  };
}
