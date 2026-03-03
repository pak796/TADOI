import { normalizeTags } from "../domain/tagIndex";
import { normalizeChecklist, sortChecklistItems } from "../domain/checklist";
import { normalizeTaskReminder } from "../domain/reminders";
import {
  createDefaultEngagementState,
  mergeEngagementStates,
  normalizeEngagementState
} from "../domain/engagement";
import {
  normalizePriorityFilterValue,
  normalizePriorityTags
} from "../domain/priorityTags";
import {
  normalizeTagToken,
  stripPriorityTokensFromTagFilter
} from "../domain/tagFilter";
import { compressTagAliases, normalizeTagAliases } from "../domain/tagAliases";
import type { SavedView, TagIndexEntry, Task } from "../domain/models";
import { getDefaultSettings, type TadoiSettings } from "../settings/settings";
import type { LoadedData } from "./persistence";

export type PortableExportPayload = LoadedData & {
  settings?: TadoiSettings;
};

export type ImportMode = "merge" | "replace";
export type RedactMode = "basic" | "strict" | "strict-v2";

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

function mergeTagAliasesForImport(
  currentAliases: Record<string, string> | undefined,
  incomingAliases: Record<string, string> | undefined
): Record<string, string> {
  return compressTagAliases({
    ...normalizeTagAliases(currentAliases),
    ...normalizeTagAliases(incomingAliases)
  });
}

function normalizeTask(task: Task): Task {
  return {
    ...task,
    tags: normalizePriorityTags(Array.isArray(task.tags) ? task.tags : []),
    checklist: normalizeChecklist(task.checklist),
    reminder: normalizeTaskReminder(task.reminder)
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

function areTaskLinksEquivalent(left: Task["links"], right: Task["links"]): boolean {
  const leftLinks = left ?? [];
  const rightLinks = right ?? [];
  if (leftLinks.length !== rightLinks.length) return false;
  for (let i = 0; i < leftLinks.length; i += 1) {
    const leftLink = leftLinks[i];
    const rightLink = rightLinks[i];
    if (
      leftLink.id !== rightLink.id ||
      leftLink.target !== rightLink.target ||
      leftLink.label !== rightLink.label ||
      leftLink.kind !== rightLink.kind ||
      leftLink.source !== rightLink.source
    ) {
      return false;
    }
  }
  return true;
}

function areTaskChecklistEquivalent(
  left: Task["checklist"],
  right: Task["checklist"]
): boolean {
  const leftChecklist = sortChecklistItems(left ?? []);
  const rightChecklist = sortChecklistItems(right ?? []);
  if (leftChecklist.length !== rightChecklist.length) return false;
  for (let i = 0; i < leftChecklist.length; i += 1) {
    const leftItem = leftChecklist[i];
    const rightItem = rightChecklist[i];
    if (
      leftItem.id !== rightItem.id ||
      leftItem.text !== rightItem.text ||
      leftItem.isDone !== rightItem.isDone ||
      leftItem.createdAt !== rightItem.createdAt ||
      leftItem.updatedAt !== rightItem.updatedAt ||
      leftItem.completedAt !== rightItem.completedAt ||
      leftItem.sort !== rightItem.sort
    ) {
      return false;
    }
  }
  return true;
}

function areTaskRemindersEquivalent(
  left: Task["reminder"],
  right: Task["reminder"]
): boolean {
  const normalizedLeft = normalizeTaskReminder(left);
  const normalizedRight = normalizeTaskReminder(right);

  if (!normalizedLeft && !normalizedRight) return true;
  if (!normalizedLeft || !normalizedRight) return false;

  return (
    normalizedLeft.kind === normalizedRight.kind &&
    normalizedLeft.at === normalizedRight.at &&
    normalizedLeft.offsetMs === normalizedRight.offsetMs &&
    normalizedLeft.lastFiredAt === normalizedRight.lastFiredAt &&
    normalizedLeft.snoozedUntilAt === normalizedRight.snoozedUntilAt
  );
}

function areTasksEquivalent(left: Task, right: Task): boolean {
  const recurrenceEqual =
    left.recurrence?.dtstart === right.recurrence?.dtstart &&
    left.recurrence?.rrule === right.recurrence?.rrule &&
    left.recurrence?.series_id === right.recurrence?.series_id &&
    areStringArraysEqual(left.recurrence?.exdates ?? [], right.recurrence?.exdates ?? []);
  const instanceEqual =
    left.instance_of?.series_id === right.instance_of?.series_id &&
    left.instance_of?.occurrence === right.instance_of?.occurrence;

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
    areStringArraysEqual(left.tags, right.tags) &&
    areTaskLinksEquivalent(left.links, right.links) &&
    areTaskChecklistEquivalent(left.checklist, right.checklist) &&
    areTaskRemindersEquivalent(left.reminder, right.reminder) &&
    recurrenceEqual &&
    instanceEqual
  );
}

function areTagFiltersEquivalent(
  left: SavedView["filters"]["tagFilter"],
  right: SavedView["filters"]["tagFilter"]
): boolean {
  const normalizedLeft = stripPriorityTokensFromTagFilter(left);
  const normalizedRight = stripPriorityTokensFromTagFilter(right);
  return (
    areStringArraysEqual(normalizedLeft?.all ?? [], normalizedRight?.all ?? []) &&
    areStringArraysEqual(normalizedLeft?.any ?? [], normalizedRight?.any ?? []) &&
    areStringArraysEqual(normalizedLeft?.none ?? [], normalizedRight?.none ?? [])
  );
}

function areViewsEquivalent(left: SavedView, right: SavedView): boolean {
  const leftPriority =
    normalizePriorityFilterValue(left.filters.priority) ??
    normalizePriorityFilterValue(left.filters.tag);
  const rightPriority =
    normalizePriorityFilterValue(right.filters.priority) ??
    normalizePriorityFilterValue(right.filters.tag);
  const leftTag = left.filters.tag ? normalizeTagToken(left.filters.tag) : undefined;
  const rightTag = right.filters.tag ? normalizeTagToken(right.filters.tag) : undefined;
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.createdAt === right.createdAt &&
    left.updatedAt === right.updatedAt &&
    left.filters.status === right.filters.status &&
    left.filters.due === right.filters.due &&
    leftPriority === rightPriority &&
    leftTag === rightTag &&
    areTagFiltersEquivalent(left.filters.tagFilter, right.filters.tagFilter) &&
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
      tagAliases: normalizeTagAliases(incomingState.tagAliases),
      savedViews: incomingState.savedViews.map((view) => ({ ...view })),
      engagement: normalizeEngagementState(incomingState.engagement, now)
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
    tagAliases: mergeTagAliasesForImport(currentState.tagAliases, incomingState.tagAliases),
    savedViews: mergedViews.merged,
    engagement: mergeEngagementStates(
      normalizeEngagementState(currentState.engagement, now),
      normalizeEngagementState(incomingState.engagement, now),
      now
    )
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

export function redactStateForExport(
  payload: PortableExportPayload,
  mode: RedactMode = "basic"
): PortableExportPayload {
  if (mode === "basic") {
    return {
      ...payload,
      tasks: payload.tasks.map((task) => ({
        ...task,
        title: "",
        notes: ""
      }))
    };
  }

  if (mode === "strict-v2") {
    return {
      ...payload,
      tasks: payload.tasks.map((task) => ({
        ...task,
        title: "",
        notes: "",
        tags: [],
        links: undefined,
        dueAt: undefined,
        hasExplicitTime: undefined,
        recurrence: undefined,
        instance_of: undefined,
        external: undefined,
        reminder: undefined
      })),
      tagIndex: {},
      tagAliases: {},
      savedViews: [],
      engagement: createDefaultEngagementState(),
      settings: undefined
    };
  }

  const defaultSettings = getDefaultSettings();
  return {
    ...payload,
    tasks: payload.tasks.map((task) => ({
      ...task,
      title: "",
      notes: "",
      tags: [],
      links: undefined,
      dueAt: undefined,
      hasExplicitTime: undefined,
      recurrence: undefined,
      instance_of: undefined,
      external: undefined,
      reminder: undefined
    })),
    engagement: createDefaultEngagementState(),
    settings: payload.settings
      ? {
          ...payload.settings,
          notifications: defaultSettings.notifications,
          security: defaultSettings.security
        }
      : undefined
  };
}
