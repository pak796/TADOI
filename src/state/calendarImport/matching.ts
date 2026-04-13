import type { SavedView, Task } from "../../domain/models";
import { applySavedView } from "../../domain/savedViews";
import { buildVisibleTaskRows } from "../../domain/taskRows";
import {
  parseTadoiIdentityFromUid,
  type CalendarImportMode,
} from "../../calendar/importMapper";
import type { ParsedIcsEvent } from "../../calendar/icsParser";
import type {
  CalendarImportViewContext,
  MatchResult,
  TaskLookup,
} from "./shared";
import {
  toSeriesOccurrenceKey,
  toSeriesRecurrenceKey,
} from "./shared";

export function resolveViewByDisplayName(
  savedViews: SavedView[],
  viewName: string,
): SavedView | undefined {
  const normalizedName = viewName.trim().toLowerCase();
  return savedViews.find(
    (view) => view.name.trim().toLowerCase() === normalizedName,
  );
}

export function extractVisibleSourceTaskIds(
  tasks: Task[],
  view: SavedView,
  nowMs: number,
): Set<string> {
  const filters = applySavedView(view);
  const rows = buildVisibleTaskRows(tasks, filters, "due", nowMs);
  return new Set(rows.map((row) => row.sourceTaskId));
}

export function isTaskVisibleInView(
  task: Task,
  tasks: Task[],
  view: SavedView,
  nowMs: number,
  existingIndexById?: Map<string, number>,
): boolean {
  const filters = applySavedView(view);
  const existingIndex = existingIndexById?.get(task.id) ?? -1;
  const evaluationTasks =
    existingIndex >= 0
      ? tasks.map((entry, index) => (index === existingIndex ? task : entry))
      : [...tasks, task];
  const rows = buildVisibleTaskRows(evaluationTasks, filters, "due", nowMs);
  return rows.some((row) => row.sourceTaskId === task.id);
}

export function buildTaskLookup(tasks: Task[]): TaskLookup {
  const byId = new Map<string, Task>();
  const indexById = new Map<string, number>();
  const byExternalUid = new Map<string, string>();
  const bySeriesExternalUid = new Map<string, string>();
  const bySeriesOccurrence = new Map<string, string>();
  const bySeriesUidAndRecurrence = new Map<string, string>();

  for (let index = 0; index < tasks.length; index += 1) {
    const task = tasks[index];
    byId.set(task.id, task);
    indexById.set(task.id, index);
  }

  for (const task of tasks) {
    const externalUid = task.external?.calendar?.uid?.trim();
    if (externalUid && !byExternalUid.has(externalUid)) {
      byExternalUid.set(externalUid, task.id);
    }

    if (
      task.recurrence &&
      !task.instance_of &&
      externalUid &&
      !bySeriesExternalUid.has(externalUid)
    ) {
      bySeriesExternalUid.set(externalUid, task.id);
    }

    if (task.instance_of) {
      const occurrenceKey = toSeriesOccurrenceKey(
        task.instance_of.series_id,
        task.instance_of.occurrence,
      );
      if (!bySeriesOccurrence.has(occurrenceKey)) {
        bySeriesOccurrence.set(occurrenceKey, task.id);
      }
    }

    const seriesUid = task.external?.calendar?.seriesUid?.trim();
    const recurrenceId = task.external?.calendar?.recurrenceId?.trim();
    if (seriesUid && recurrenceId) {
      const key = toSeriesRecurrenceKey(seriesUid, recurrenceId);
      if (!bySeriesUidAndRecurrence.has(key)) {
        bySeriesUidAndRecurrence.set(key, task.id);
      }
    }
  }

  return {
    byId,
    indexById,
    byExternalUid,
    bySeriesExternalUid,
    bySeriesOccurrence,
    bySeriesUidAndRecurrence,
  };
}

export function replaceTaskById(
  tasks: Task[],
  lookup: TaskLookup,
  nextTask: Task,
): TaskLookup {
  const index = lookup.indexById.get(nextTask.id);
  if (index === undefined) {
    return lookup;
  }
  tasks[index] = nextTask;
  return buildTaskLookup(tasks);
}

export function appendTask(tasks: Task[], nextTask: Task): TaskLookup {
  tasks.push(nextTask);
  return buildTaskLookup(tasks);
}

export function resolveTaskMatch(
  event: ParsedIcsEvent,
  lookup: TaskLookup,
): MatchResult | undefined {
  const xTaskId = event.xTaskId?.trim();
  if (xTaskId) {
    const byId = lookup.byId.get(xTaskId);
    if (byId) {
      return { task: byId, matchedBy: "x-task-id" };
    }
  }

  const uidIdentity = parseTadoiIdentityFromUid(event.uid);
  if (uidIdentity) {
    const byUidId = lookup.byId.get(uidIdentity.taskId);
    if (byUidId) {
      return { task: byUidId, matchedBy: "uid" };
    }
  }

  const normalizedUid = event.uid?.trim();
  if (normalizedUid) {
    const byExternalUidTaskId = lookup.byExternalUid.get(normalizedUid);
    if (byExternalUidTaskId) {
      const byExternalUid = lookup.byId.get(byExternalUidTaskId);
      if (byExternalUid) {
        return { task: byExternalUid, matchedBy: "external-uid" };
      }
    }
  }

  return undefined;
}

export function resolveSeriesTaskForOverride(
  event: ParsedIcsEvent,
  lookup: TaskLookup,
): MatchResult | undefined {
  const xTaskId = event.xTaskId?.trim();
  if (xTaskId) {
    const byX = lookup.byId.get(xTaskId);
    if (byX?.recurrence) {
      return { task: byX, matchedBy: "x-task-id" };
    }
  }

  const baseUidCandidates = [event.relatedTo?.trim(), event.uid?.trim()].filter(
    (value): value is string => Boolean(value),
  );

  for (const uid of baseUidCandidates) {
    const parsed = parseTadoiIdentityFromUid(uid);
    if (parsed) {
      const byParsed = lookup.byId.get(parsed.taskId);
      if (byParsed?.recurrence) {
        return { task: byParsed, matchedBy: "uid" };
      }
    }

    const taskId = lookup.bySeriesExternalUid.get(uid);
    if (taskId) {
      const task = lookup.byId.get(taskId);
      if (task?.recurrence) {
        return { task, matchedBy: "external-uid" };
      }
    }
  }

  return undefined;
}

export function resolveInstanceMatch(
  event: ParsedIcsEvent,
  seriesTask: Task,
  occurrenceIso: string,
  lookup: TaskLookup,
): MatchResult | undefined {
  const directMatch = resolveTaskMatch(event, lookup);
  const directInstance = directMatch?.task.instance_of;
  if (
    directMatch &&
    directInstance &&
    directInstance.series_id === seriesTask.recurrence?.series_id &&
    directInstance.occurrence === occurrenceIso
  ) {
    return directMatch;
  }

  const seriesId = seriesTask.recurrence?.series_id;
  if (seriesId) {
    const occurrenceTaskId = lookup.bySeriesOccurrence.get(
      toSeriesOccurrenceKey(seriesId, occurrenceIso),
    );
    if (occurrenceTaskId) {
      const byOccurrence = lookup.byId.get(occurrenceTaskId);
      if (byOccurrence) {
        return { task: byOccurrence, matchedBy: "external-uid" };
      }
    }
  }

  const uid = event.uid?.trim();
  if (uid) {
    const recurrenceTaskId = lookup.bySeriesUidAndRecurrence.get(
      toSeriesRecurrenceKey(uid, occurrenceIso),
    );
    if (recurrenceTaskId) {
      const byExternal = lookup.byId.get(recurrenceTaskId);
      if (byExternal) {
        return { task: byExternal, matchedBy: "external-uid" };
      }
    }
  }

  return undefined;
}

export function refreshVisibleSourceIds(
  tasks: Task[],
  view: SavedView | undefined,
  nowMs: number,
): Set<string> | undefined {
  if (!view) return undefined;
  return extractVisibleSourceTaskIds(tasks, view, nowMs);
}

export function resolveViewContext(params: {
  savedViews: SavedView[];
  tasks: Task[];
  viewName?: string;
  nowMs: number;
}): CalendarImportViewContext {
  if (!params.viewName || params.viewName.trim().length === 0) {
    return {};
  }

  const view = resolveViewByDisplayName(params.savedViews, params.viewName);
  if (!view) {
    return {};
  }

  return {
    view,
    viewApplied: view.name,
    visibleSourceIds: extractVisibleSourceTaskIds(params.tasks, view, params.nowMs),
  };
}
