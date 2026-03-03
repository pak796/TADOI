import type { Task } from "../models";
import { parseLocalIsoToDate, formatDateToLocalIso } from "./rruleAdapter";
import { stripReminderRuntimeState } from "../reminders";

export type RecurringOccurrenceMutationTarget = {
  seriesId: string;
  occurrenceIso: string;
  nowMs: number;
};

function normalizeOccurrenceIso(value: string): string | undefined {
  const occurrenceDate = parseLocalIsoToDate(value);
  if (!occurrenceDate) return undefined;
  return formatDateToLocalIso(occurrenceDate);
}

export function withSeriesOccurrenceExcluded(
  tasks: Task[],
  seriesTaskId: string,
  occurrenceIso: string,
  nowMs: number
): Task[] {
  return tasks.map((task) => {
    if (task.id !== seriesTaskId || !task.recurrence) {
      return task;
    }
    const nextExdates = Array.from(
      new Set([...(task.recurrence.exdates ?? []), occurrenceIso])
    ).sort((left, right) => left.localeCompare(right));
    return {
      ...task,
      updatedAt: nowMs,
      recurrence: {
        ...task.recurrence,
        exdates: nextExdates
      }
    };
  });
}

export function removeMaterializedOccurrenceInstance(
  tasks: Task[],
  seriesId: string,
  occurrenceIso: string
): Task[] {
  return tasks.filter(
    (task) =>
      !(
        task.instance_of?.series_id === seriesId &&
        task.instance_of?.occurrence === occurrenceIso
      )
  );
}

function findSeriesTaskBySeriesId(tasks: Task[], seriesId: string): Task | undefined {
  return tasks.find((task) => task.recurrence?.series_id === seriesId);
}

function findMaterializedInstance(
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

export function completeRecurringOccurrenceInTasks(
  tasks: Task[],
  input: RecurringOccurrenceMutationTarget
): Task[] {
  const normalizedIso = normalizeOccurrenceIso(input.occurrenceIso);
  if (!normalizedIso) return tasks;

  const seriesTask = findSeriesTaskBySeriesId(tasks, input.seriesId);
  if (!seriesTask || !seriesTask.recurrence) return tasks;

  const occurrenceDate = parseLocalIsoToDate(normalizedIso);
  if (!occurrenceDate) return tasks;

  const withExdate = withSeriesOccurrenceExcluded(tasks, seriesTask.id, normalizedIso, input.nowMs);
  const existingInstance = findMaterializedInstance(withExdate, input.seriesId, normalizedIso);

  if (existingInstance) {
    if (existingInstance.status === "done") {
      return withExdate;
    }
    return withExdate.map((task) => {
      if (task.id !== existingInstance.id) return task;
      return {
        ...task,
        status: "done",
        updatedAt: input.nowMs,
        closedAt: input.nowMs
      };
    });
  }

  const reminder = stripReminderRuntimeState(seriesTask.reminder);
  const dueAt = occurrenceDate.getTime();
  const doneInstance: Task = {
    id: crypto.randomUUID(),
    title: seriesTask.title,
    status: "done",
    createdAt: input.nowMs,
    updatedAt: input.nowMs,
    closedAt: input.nowMs,
    dueAt,
    hasExplicitTime: seriesTask.hasExplicitTime,
    notes: seriesTask.notes,
    tags: seriesTask.tags,
    ...(reminder ? { reminder } : {}),
    instance_of: {
      series_id: input.seriesId,
      occurrence: normalizedIso
    }
  };

  return [...withExdate, doneInstance];
}

export function skipRecurringOccurrenceInTasks(
  tasks: Task[],
  input: RecurringOccurrenceMutationTarget
): Task[] {
  const normalizedIso = normalizeOccurrenceIso(input.occurrenceIso);
  if (!normalizedIso) return tasks;

  const seriesTask = findSeriesTaskBySeriesId(tasks, input.seriesId);
  if (!seriesTask || !seriesTask.recurrence) return tasks;

  const withExdate = withSeriesOccurrenceExcluded(tasks, seriesTask.id, normalizedIso, input.nowMs);
  return removeMaterializedOccurrenceInstance(withExdate, input.seriesId, normalizedIso);
}

export function snoozeRecurringOccurrenceInTasks(
  tasks: Task[],
  input: RecurringOccurrenceMutationTarget
): Task[] {
  const normalizedIso = normalizeOccurrenceIso(input.occurrenceIso);
  if (!normalizedIso) return tasks;

  const seriesTask = findSeriesTaskBySeriesId(tasks, input.seriesId);
  if (!seriesTask || !seriesTask.recurrence) return tasks;

  const occurrenceDate = parseLocalIsoToDate(normalizedIso);
  if (!occurrenceDate) return tasks;

  const existingInstance = findMaterializedInstance(tasks, input.seriesId, normalizedIso);
  const source = existingInstance ?? seriesTask;

  const snoozedDate = new Date(
    occurrenceDate.getFullYear(),
    occurrenceDate.getMonth(),
    occurrenceDate.getDate() + 1,
    occurrenceDate.getHours(),
    occurrenceDate.getMinutes(),
    occurrenceDate.getSeconds()
  );

  const reminder = existingInstance
    ? existingInstance.reminder
    : stripReminderRuntimeState(source.reminder);

  const snoozedInstance: Task = {
    id: existingInstance?.id ?? crypto.randomUUID(),
    title: source.title,
    status: "open",
    createdAt: existingInstance?.createdAt ?? input.nowMs,
    updatedAt: input.nowMs,
    dueAt: snoozedDate.getTime(),
    hasExplicitTime: source.hasExplicitTime,
    notes: source.notes,
    tags: source.tags,
    ...(reminder ? { reminder } : {}),
    instance_of: {
      series_id: input.seriesId,
      occurrence: normalizedIso
    }
  };

  const withExdate = withSeriesOccurrenceExcluded(tasks, seriesTask.id, normalizedIso, input.nowMs);
  const withoutPreviousInstance = removeMaterializedOccurrenceInstance(
    withExdate,
    input.seriesId,
    normalizedIso
  );
  return [...withoutPreviousInstance, snoozedInstance];
}
