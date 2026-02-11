import type { Task } from "../domain/models";
import { formatDateToLocalIso } from "../domain/recurrence/rruleAdapter";
import { buildSeriesOccurrenceRowId } from "../domain/taskRows";
import type { TaskOverdueEvent } from "./types";

export type GoToTaskTarget = {
  preferredTaskId: string;
  fallbackSourceTaskId?: string;
};

function parseEventDueAtMs(event: TaskOverdueEvent): number | undefined {
  const dueAtMs = Date.parse(event.dueAt);
  return Number.isFinite(dueAtMs) ? dueAtMs : undefined;
}

function getSeriesTaskFromEvent(tasks: Task[], event: TaskOverdueEvent): Task | undefined {
  const eventTask = tasks.find((task) => task.id === event.taskId);
  if (!eventTask) return undefined;
  if (!eventTask.recurrence || eventTask.instance_of) return undefined;
  return eventTask;
}

function findMaterializedOccurrenceInstance(
  tasks: Task[],
  seriesId: string,
  occurrenceIso: string
): Task | undefined {
  return tasks.find(
    (task) =>
      task.instance_of?.series_id === seriesId &&
      task.instance_of?.occurrence === occurrenceIso
  );
}

function withSeriesOccurrenceExcluded(
  tasks: Task[],
  seriesTaskId: string,
  occurrenceIso: string,
  nowMs: number
): Task[] {
  return tasks.map((task) => {
    if (task.id !== seriesTaskId || !task.recurrence) {
      return task;
    }
    const exdates = Array.from(new Set([...(task.recurrence.exdates ?? []), occurrenceIso]));
    return {
      ...task,
      updatedAt: nowMs,
      recurrence: {
        ...task.recurrence,
        exdates
      }
    };
  });
}

export function applyOverdueSnooze(
  tasks: Task[],
  event: TaskOverdueEvent,
  nowMs: number,
  snoozeMinutes = 10
): Task[] {
  const snoozeMs = Math.max(1, Math.floor(snoozeMinutes)) * 60_000;
  const snoozedDueAt = nowMs + snoozeMs;
  const seriesTask = getSeriesTaskFromEvent(tasks, event);
  if (!seriesTask || !seriesTask.recurrence) {
    return tasks.map((task) => {
      if (task.id !== event.taskId) return task;
      return {
        ...task,
        dueAt: snoozedDueAt,
        hasExplicitTime: true,
        updatedAt: nowMs
      };
    });
  }

  const dueAtMs = parseEventDueAtMs(event);
  if (dueAtMs === undefined) {
    return tasks;
  }
  const occurrenceIso = formatDateToLocalIso(new Date(dueAtMs));
  const seriesId = seriesTask.recurrence.series_id;
  const existingInstance = findMaterializedOccurrenceInstance(tasks, seriesId, occurrenceIso);
  const source = existingInstance ?? seriesTask;
  const snoozedInstance: Task = {
    id: existingInstance?.id ?? crypto.randomUUID(),
    title: source.title,
    status: "open",
    createdAt: existingInstance?.createdAt ?? nowMs,
    updatedAt: nowMs,
    dueAt: snoozedDueAt,
    hasExplicitTime: true,
    notes: source.notes,
    tags: source.tags,
    instance_of: {
      series_id: seriesId,
      occurrence: occurrenceIso
    }
  };

  const withExdate = withSeriesOccurrenceExcluded(tasks, seriesTask.id, occurrenceIso, nowMs);
  if (!existingInstance) {
    return [...withExdate, snoozedInstance];
  }
  return withExdate.map((task) => (task.id === existingInstance.id ? snoozedInstance : task));
}

export function applyOverdueMarkDone(
  tasks: Task[],
  event: TaskOverdueEvent,
  nowMs: number
): Task[] {
  const seriesTask = getSeriesTaskFromEvent(tasks, event);
  if (!seriesTask || !seriesTask.recurrence) {
    return tasks.map((task) => {
      if (task.id !== event.taskId) return task;
      return {
        ...task,
        status: "done",
        updatedAt: nowMs,
        closedAt: nowMs
      };
    });
  }

  const dueAtMs = parseEventDueAtMs(event);
  if (dueAtMs === undefined) {
    return tasks;
  }
  const occurrenceIso = formatDateToLocalIso(new Date(dueAtMs));
  const seriesId = seriesTask.recurrence.series_id;
  const existingInstance = findMaterializedOccurrenceInstance(tasks, seriesId, occurrenceIso);
  const withExdate = withSeriesOccurrenceExcluded(tasks, seriesTask.id, occurrenceIso, nowMs);

  if (existingInstance) {
    return withExdate.map((task) => {
      if (task.id !== existingInstance.id) return task;
      return {
        ...task,
        status: "done",
        updatedAt: nowMs,
        closedAt: nowMs
      };
    });
  }

  const doneInstance: Task = {
    id: crypto.randomUUID(),
    title: seriesTask.title,
    status: "done",
    createdAt: nowMs,
    updatedAt: nowMs,
    closedAt: nowMs,
    dueAt: dueAtMs,
    hasExplicitTime: seriesTask.hasExplicitTime,
    notes: seriesTask.notes,
    tags: seriesTask.tags,
    instance_of: {
      series_id: seriesId,
      occurrence: occurrenceIso
    }
  };

  return [...withExdate, doneInstance];
}

export function resolveGoToTaskTarget(tasks: Task[], event: TaskOverdueEvent): GoToTaskTarget {
  const seriesTask = getSeriesTaskFromEvent(tasks, event);
  if (!seriesTask || !seriesTask.recurrence) {
    return { preferredTaskId: event.taskId };
  }

  const dueAtMs = parseEventDueAtMs(event);
  if (dueAtMs === undefined) {
    return {
      preferredTaskId: event.taskId,
      fallbackSourceTaskId: seriesTask.id
    };
  }

  const occurrenceIso = formatDateToLocalIso(new Date(dueAtMs));
  const existingInstance = findMaterializedOccurrenceInstance(
    tasks,
    seriesTask.recurrence.series_id,
    occurrenceIso
  );
  if (existingInstance) {
    return {
      preferredTaskId: existingInstance.id,
      fallbackSourceTaskId: seriesTask.id
    };
  }
  return {
    preferredTaskId: buildSeriesOccurrenceRowId(seriesTask.recurrence.series_id, occurrenceIso),
    fallbackSourceTaskId: seriesTask.id
  };
}
