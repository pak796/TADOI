import { normalizeTags } from "../domain/tagIndex";
import type { SavedView, TagIndexEntry, Task } from "../domain/models";
import type { TadoiSettings } from "../settings/settings";
import type { LoadedData } from "./persistence";

export type PortableExportPayload = LoadedData & {
  settings?: TadoiSettings;
};

export type ImportMode = "merge" | "replace";

export type MergeTasksStats = {
  added: number;
  updated: number;
  unchanged: number;
  conflictsResolvedByUpdatedAt: number;
};

export type MergeTasksResult = {
  merged: Task[];
  stats: MergeTasksStats;
};

export type MergeSavedViewsStats = {
  added: number;
  updated: number;
  unchanged: number;
};

export type MergeSavedViewsResult = {
  merged: SavedView[];
  stats: MergeSavedViewsStats;
};

export type ImportStateStats = {
  mode: ImportMode;
  tasks: {
    added: number;
    updated: number;
    unchanged: number;
    removed: number;
  };
  conflictsResolvedByUpdatedAt: number;
  savedViews: MergeSavedViewsStats;
  schemaVersion: number;
};

export type ImportStateOptions = {
  mode?: ImportMode;
  now?: number;
};

export type ImportStateResult = {
  nextState: LoadedData;
  stats: ImportStateStats;
};

function asTimestamp(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return value;
}

function normalizeTask(task: Task): Task {
  return {
    ...task,
    tags: normalizeTags(Array.isArray(task.tags) ? task.tags : [])
  };
}

function normalizeViewKey(name: string): string {
  return name.trim().toLowerCase();
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function areTasksEquivalent(left: Task, right: Task): boolean {
  return (
    left.id === right.id &&
    left.title === right.title &&
    left.status === right.status &&
    left.createdAt === right.createdAt &&
    left.updatedAt === right.updatedAt &&
    left.dueAt === right.dueAt &&
    left.hasExplicitTime === right.hasExplicitTime &&
    left.closedAt === right.closedAt &&
    left.notes === right.notes &&
    areStringArraysEqual(left.tags, right.tags)
  );
}

function areViewsEquivalent(left: SavedView, right: SavedView): boolean {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.createdAt === right.createdAt &&
    left.updatedAt === right.updatedAt &&
    left.filters.status === right.filters.status &&
    left.filters.due === right.filters.due &&
    left.filters.tag === right.filters.tag &&
    left.filters.searchText === right.filters.searchText
  );
}

function chooseTaskWinner(localTask: Task, incomingTask: Task): {
  winner: Task;
  resolvedByUpdatedAt: boolean;
} {
  const localUpdated = asTimestamp((localTask as Partial<Task>).updatedAt, 0);
  const incomingUpdated = asTimestamp((incomingTask as Partial<Task>).updatedAt, 0);

  if (incomingUpdated > localUpdated) {
    return { winner: incomingTask, resolvedByUpdatedAt: true };
  }
  if (incomingUpdated < localUpdated) {
    return { winner: localTask, resolvedByUpdatedAt: true };
  }

  const localCreated = asTimestamp((localTask as Partial<Task>).createdAt, 0);
  const incomingCreated = asTimestamp((incomingTask as Partial<Task>).createdAt, 0);
  if (incomingCreated > localCreated) {
    return { winner: incomingTask, resolvedByUpdatedAt: false };
  }
  if (incomingCreated < localCreated) {
    return { winner: localTask, resolvedByUpdatedAt: false };
  }

  // Final deterministic tiebreaker: incoming wins.
  return { winner: incomingTask, resolvedByUpdatedAt: false };
}

export function mergeTasksByIdNewestUpdatedAt(
  localTasks: Task[],
  incomingTasks: Task[]
): MergeTasksResult {
  const stats: MergeTasksStats = {
    added: 0,
    updated: 0,
    unchanged: 0,
    conflictsResolvedByUpdatedAt: 0
  };

  const merged: Task[] = [];
  const incomingById = new Map<string, Task>();
  const incomingOrder: string[] = [];

  for (const task of incomingTasks) {
    if (!incomingById.has(task.id)) {
      incomingOrder.push(task.id);
    }
    incomingById.set(task.id, normalizeTask(task));
  }

  const localIds = new Set(localTasks.map((task) => task.id));

  for (const localTask of localTasks) {
    const normalizedLocalTask = normalizeTask(localTask);
    const incomingTask = incomingById.get(localTask.id);
    if (!incomingTask) {
      merged.push(normalizedLocalTask);
      stats.unchanged += 1;
      continue;
    }

    const { winner, resolvedByUpdatedAt } = chooseTaskWinner(
      normalizedLocalTask,
      incomingTask
    );
    if (resolvedByUpdatedAt) {
      stats.conflictsResolvedByUpdatedAt += 1;
    }

    if (winner === incomingTask && !areTasksEquivalent(normalizedLocalTask, incomingTask)) {
      stats.updated += 1;
    } else {
      stats.unchanged += 1;
    }

    merged.push(normalizeTask(winner));
  }

  for (const incomingId of incomingOrder) {
    if (localIds.has(incomingId)) continue;
    const incomingTask = incomingById.get(incomingId);
    if (!incomingTask) continue;
    merged.push(normalizeTask(incomingTask));
    stats.added += 1;
  }

  return { merged, stats };
}

export function mergeSavedViewsByNameNewestUpdatedAt(
  localSavedViews: SavedView[],
  incomingSavedViews: SavedView[]
): MergeSavedViewsResult {
  const stats: MergeSavedViewsStats = {
    added: 0,
    updated: 0,
    unchanged: 0
  };

  const merged = localSavedViews.map((view) => ({ ...view }));
  const indexByKey = new Map<string, number>();
  for (let i = 0; i < merged.length; i += 1) {
    indexByKey.set(normalizeViewKey(merged[i].name), i);
  }

  for (const incomingView of incomingSavedViews) {
    const key = normalizeViewKey(incomingView.name);
    const existingIndex = indexByKey.get(key);

    if (existingIndex === undefined) {
      merged.push({ ...incomingView });
      indexByKey.set(key, merged.length - 1);
      stats.added += 1;
      continue;
    }

    const localView = merged[existingIndex];
    const localUpdated = asTimestamp(localView.updatedAt, 0);
    const incomingUpdated = asTimestamp(incomingView.updatedAt, 0);
    const incomingWins = incomingUpdated >= localUpdated;

    if (!incomingWins) {
      stats.unchanged += 1;
      continue;
    }

    if (areViewsEquivalent(localView, incomingView)) {
      stats.unchanged += 1;
    } else {
      stats.updated += 1;
    }

    // Final deterministic tiebreaker when updatedAt is equal: incoming wins.
    merged[existingIndex] = { ...incomingView };
  }

  return { merged, stats };
}

export function recomputeTagIndex(
  tasks: Task[],
  now = Date.now()
): Record<string, TagIndexEntry> {
  const byTag = new Map<string, TagIndexEntry>();

  for (const task of tasks) {
    const normalizedTags = normalizeTags(Array.isArray(task.tags) ? task.tags : []);
    const updatedAt = asTimestamp((task as Partial<Task>).updatedAt, 0);
    const createdAt = asTimestamp((task as Partial<Task>).createdAt, 0);
    const lastUsedAt = Math.max(updatedAt, createdAt, 0) || now;

    for (const tag of normalizedTags) {
      const existing = byTag.get(tag);
      if (!existing) {
        byTag.set(tag, {
          tagName: tag,
          usageCount: 1,
          lastUsedAt
        });
        continue;
      }

      byTag.set(tag, {
        tagName: tag,
        usageCount: existing.usageCount + 1,
        lastUsedAt: Math.max(existing.lastUsedAt, lastUsedAt)
      });
    }
  }

  const sorted = Array.from(byTag.entries()).sort(([left], [right]) =>
    left.localeCompare(right)
  );

  const next: Record<string, TagIndexEntry> = {};
  for (const [tag, entry] of sorted) {
    next[tag] = entry;
  }
  return next;
}

function computeReplaceTaskStats(localTasks: Task[], incomingTasks: Task[]): {
  added: number;
  updated: number;
  unchanged: number;
  removed: number;
} {
  const localById = new Map(localTasks.map((task) => [task.id, normalizeTask(task)]));
  const incomingIds = new Set<string>();

  let added = 0;
  let updated = 0;
  let unchanged = 0;

  for (const incomingTask of incomingTasks) {
    const normalizedIncomingTask = normalizeTask(incomingTask);
    incomingIds.add(normalizedIncomingTask.id);
    const localTask = localById.get(normalizedIncomingTask.id);
    if (!localTask) {
      added += 1;
      continue;
    }

    if (areTasksEquivalent(localTask, normalizedIncomingTask)) {
      unchanged += 1;
    } else {
      updated += 1;
    }
  }

  let removed = 0;
  for (const localTask of localTasks) {
    if (!incomingIds.has(localTask.id)) {
      removed += 1;
    }
  }

  return { added, updated, unchanged, removed };
}

function computeReplaceSavedViewStats(
  localSavedViews: SavedView[],
  incomingSavedViews: SavedView[]
): MergeSavedViewsStats {
  const localByName = new Map(
    localSavedViews.map((view) => [normalizeViewKey(view.name), view])
  );

  let added = 0;
  let updated = 0;
  let unchanged = 0;

  for (const incomingView of incomingSavedViews) {
    const key = normalizeViewKey(incomingView.name);
    const localView = localByName.get(key);
    if (!localView) {
      added += 1;
      continue;
    }

    if (areViewsEquivalent(localView, incomingView)) {
      unchanged += 1;
    } else {
      updated += 1;
    }
  }

  return { added, updated, unchanged };
}

export function importState(
  currentState: LoadedData,
  incomingState: LoadedData,
  options: ImportStateOptions = {}
): ImportStateResult {
  const mode = options.mode ?? "merge";
  const now = options.now ?? Date.now();

  if (mode === "replace") {
    const normalizedTasks = incomingState.tasks.map(normalizeTask);
    const taskStats = computeReplaceTaskStats(currentState.tasks, normalizedTasks);
    const savedViewStats = computeReplaceSavedViewStats(
      currentState.savedViews,
      incomingState.savedViews
    );
    const nextState: LoadedData = {
      schemaVersion: incomingState.schemaVersion,
      tasks: normalizedTasks,
      tagIndex: recomputeTagIndex(normalizedTasks, now),
      savedViews: incomingState.savedViews.map((view) => ({ ...view }))
    };

    return {
      nextState,
      stats: {
        mode,
        tasks: taskStats,
        conflictsResolvedByUpdatedAt: 0,
        savedViews: savedViewStats,
        schemaVersion: nextState.schemaVersion
      }
    };
  }

  const mergedTasks = mergeTasksByIdNewestUpdatedAt(
    currentState.tasks,
    incomingState.tasks
  );
  const mergedViews = mergeSavedViewsByNameNewestUpdatedAt(
    currentState.savedViews,
    incomingState.savedViews
  );

  const nextState: LoadedData = {
    schemaVersion: incomingState.schemaVersion,
    tasks: mergedTasks.merged,
    tagIndex: recomputeTagIndex(mergedTasks.merged, now),
    savedViews: mergedViews.merged
  };

  return {
    nextState,
    stats: {
      mode,
      tasks: {
        added: mergedTasks.stats.added,
        updated: mergedTasks.stats.updated,
        unchanged: mergedTasks.stats.unchanged,
        removed: 0
      },
      conflictsResolvedByUpdatedAt: mergedTasks.stats.conflictsResolvedByUpdatedAt,
      savedViews: mergedViews.stats,
      schemaVersion: nextState.schemaVersion
    }
  };
}

export function redactStateForExport(payload: PortableExportPayload): PortableExportPayload {
  return {
    ...payload,
    tasks: payload.tasks.map((task) => ({
      ...task,
      title: "",
      notes: ""
    }))
  };
}
