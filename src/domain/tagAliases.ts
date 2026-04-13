import type { Task } from "./models";
import { normalizePriorityTags, isPriorityToken } from "./priorityTags";
import { normalizeTag } from "./tagIndex";

export type TagAliases = Record<string, string>;

const MAX_ALIAS_DEPTH = 16;

export type ResolveTagMeta = {
  canonical: string | null;
  chain: string[];
  cycleDetected: boolean;
  depthCapped: boolean;
};

export type TagCoTagCount = {
  tag: string;
  count: number;
};

export type TagStats = {
  selectedCanonical?: string;
  selectedInput?: string;
  usageCount: number;
  percentOfTaggedTasks?: number;
  topCoTags: TagCoTagCount[];
  incomingAliases: string[];
  outgoingAliasTarget?: string;
  normalizedCollisionCount: number;
};

export function collapseTagWhitespace(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export function normalizeTagCompat(raw: string): string | null {
  return normalizeTag(collapseTagWhitespace(raw));
}

export function normalizeTagAliases(
  input: Record<string, string> | undefined,
): TagAliases {
  if (!input) return {};
  const next: TagAliases = {};
  for (const [rawSource, rawTarget] of Object.entries(input)) {
    const source = normalizeTagCompat(rawSource);
    const target = normalizeTagCompat(rawTarget);
    if (!source || !target || source === target) {
      continue;
    }
    next[source] = target;
  }
  return compressTagAliases(next);
}

export function resolveTagWithMeta(
  raw: string,
  aliases: TagAliases,
): ResolveTagMeta {
  const normalized = normalizeTagCompat(raw);
  if (!normalized) {
    return {
      canonical: null,
      chain: [],
      cycleDetected: false,
      depthCapped: false,
    };
  }

  const seen = new Set<string>([normalized]);
  const chain = [normalized];
  const root = normalized;
  let current = normalized;
  let cycleDetected = false;
  let depthCapped = false;

  for (let depth = 0; depth < MAX_ALIAS_DEPTH; depth += 1) {
    const next = aliases[current];
    if (!next) {
      return {
        canonical: current,
        chain,
        cycleDetected,
        depthCapped,
      };
    }
    if (seen.has(next)) {
      cycleDetected = true;
      return {
        // Preserve deterministic behavior for cycles by falling back to the input root.
        canonical: root,
        chain,
        cycleDetected,
        depthCapped,
      };
    }
    current = next;
    chain.push(next);
    seen.add(next);
  }

  depthCapped = true;
  return {
    canonical: current,
    chain,
    cycleDetected,
    depthCapped,
  };
}

export function resolveTag(raw: string, aliases: TagAliases): string | null {
  return resolveTagWithMeta(raw, aliases).canonical;
}

export function compressTagAliases(aliases: TagAliases): TagAliases {
  const normalized = { ...aliases };
  const compressed: TagAliases = {};
  for (const source of Object.keys(normalized)) {
    const resolution = resolveTagWithMeta(source, normalized);
    const resolved = resolution.canonical;
    if (
      !resolved ||
      resolved === source ||
      resolution.cycleDetected ||
      resolution.depthCapped
    ) {
      continue;
    }
    compressed[source] = resolved;
  }
  return compressed;
}

export function computeTagUsage(
  tasks: Task[],
  aliases: TagAliases,
): Map<string, number> {
  const usage = new Map<string, number>();
  for (const task of tasks) {
    if (task.status === "archived") continue;
    const perTask = new Set<string>();
    for (const rawTag of task.tags) {
      if (isPriorityToken(rawTag)) continue;
      const canonical = resolveTag(rawTag, aliases);
      if (!canonical) continue;
      perTask.add(canonical);
    }
    for (const tag of perTask) {
      usage.set(tag, (usage.get(tag) ?? 0) + 1);
    }
  }
  return usage;
}

export function computeTagStats(
  tasks: Task[],
  aliases: TagAliases,
  selectedTagInput?: string,
): TagStats {
  const usage = computeTagUsage(tasks, aliases);
  const selectedCanonical = selectedTagInput
    ? (resolveTag(selectedTagInput, aliases) ?? undefined)
    : undefined;

  let taggedTaskCount = 0;
  const coTagCounts = new Map<string, number>();
  const rawCollisions = new Set<string>();

  for (const task of tasks) {
    if (task.status === "archived") continue;
    const canonicalTags = new Set<string>();
    for (const rawTag of task.tags) {
      if (isPriorityToken(rawTag)) continue;
      const canonical = resolveTag(rawTag, aliases);
      if (!canonical) continue;
      canonicalTags.add(canonical);
      if (selectedCanonical && canonical === selectedCanonical) {
        const normalizedRaw = normalizeTagCompat(rawTag);
        if (normalizedRaw && normalizedRaw !== selectedCanonical) {
          rawCollisions.add(normalizedRaw);
        }
      }
    }
    if (canonicalTags.size > 0) {
      taggedTaskCount += 1;
    }
    if (!selectedCanonical || !canonicalTags.has(selectedCanonical)) {
      continue;
    }
    for (const tag of canonicalTags) {
      if (tag === selectedCanonical) continue;
      coTagCounts.set(tag, (coTagCounts.get(tag) ?? 0) + 1);
    }
  }

  const incomingAliases = selectedCanonical
    ? Object.entries(aliases)
        .filter(
          ([, target]) => resolveTag(target, aliases) === selectedCanonical,
        )
        .map(([source]) => source)
        .sort((a, b) => a.localeCompare(b))
    : [];

  const outgoingAliasTarget = selectedCanonical
    ? aliases[selectedCanonical]
    : undefined;

  const topCoTags = Array.from(coTagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => {
      if (left.count !== right.count) {
        return right.count - left.count;
      }
      return left.tag.localeCompare(right.tag);
    })
    .slice(0, 5);

  const usageCount = selectedCanonical
    ? (usage.get(selectedCanonical) ?? 0)
    : 0;

  return {
    ...(selectedCanonical ? { selectedCanonical } : {}),
    ...(selectedTagInput ? { selectedInput: selectedTagInput } : {}),
    usageCount,
    ...(selectedCanonical && taggedTaskCount > 0
      ? {
          percentOfTaggedTasks:
            Math.round((usageCount / taggedTaskCount) * 1000) / 10,
        }
      : {}),
    topCoTags,
    incomingAliases,
    ...(outgoingAliasTarget ? { outgoingAliasTarget } : {}),
    normalizedCollisionCount: rawCollisions.size,
  };
}

export function rewriteTagsOnTask(
  task: Task,
  rewriteMap: Map<string, string>,
  aliases: TagAliases,
  now: number,
): Task {
  const nextTags: string[] = [];
  for (const rawTag of task.tags) {
    if (isPriorityToken(rawTag)) {
      nextTags.push(rawTag);
      continue;
    }
    const canonical = resolveTag(rawTag, aliases);
    if (!canonical) continue;
    const rewritten = rewriteMap.get(canonical) ?? canonical;
    nextTags.push(rewritten);
  }

  const normalized = normalizePriorityTags(nextTags);
  return {
    ...task,
    tags: normalized,
    updatedAt: now,
  };
}
