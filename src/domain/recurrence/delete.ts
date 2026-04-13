import { Task, TaskRecurrence } from "../models";
import {
  buildRule,
  formatDateToLocalIso,
  formatRRule,
  fromFloatingUtcDate,
  parseLocalIsoToDate,
  parseRRule,
  toFloatingUtcDate,
} from "./rruleAdapter";

function normalizeOccurrenceIso(iso: string): string | null {
  const parsed = parseLocalIsoToDate(iso);
  if (!parsed) return null;
  return formatDateToLocalIso(parsed);
}

function normalizeExdates(exdates: string[] | undefined): string[] {
  if (!exdates) return [];
  const normalized = exdates
    .map((exdate) => normalizeOccurrenceIso(exdate))
    .filter((value): value is string => Boolean(value));
  return Array.from(new Set(normalized)).sort((left, right) =>
    left.localeCompare(right),
  );
}

function buildRecurrenceWithExdates(
  recurrence: TaskRecurrence,
  exdates: string[],
  rrule: string,
): TaskRecurrence {
  return {
    dtstart: recurrence.dtstart,
    series_id: recurrence.series_id,
    rrule,
    ...(exdates.length > 0 ? { exdates } : {}),
  };
}

function resolveSeriesTask(
  tasks: Task[],
  seriesTaskId: string,
  seriesId: string,
): Task | undefined {
  return (
    tasks.find((task) => task.id === seriesTaskId && task.recurrence) ??
    tasks.find((task) => task.recurrence?.series_id === seriesId)
  );
}

function previousOccurrenceIso(
  recurrence: TaskRecurrence,
  selectedOccurrenceIso: string,
): string | null {
  const selectedDate = parseLocalIsoToDate(selectedOccurrenceIso);
  if (!selectedDate) return null;
  const rule = buildRule(recurrence);
  const previous = rule.before(toFloatingUtcDate(selectedDate), false);
  if (!previous) return null;
  return formatDateToLocalIso(fromFloatingUtcDate(previous));
}

export type RecurringDeleteOptions = {
  seriesTaskId: string;
  seriesId: string;
  occurrenceIso: string;
  nowMs: number;
};

export function deleteRecurringOccurrence(
  tasks: Task[],
  options: RecurringDeleteOptions,
): Task[] {
  const normalizedOccurrenceIso = normalizeOccurrenceIso(options.occurrenceIso);
  if (!normalizedOccurrenceIso) return tasks;

  const updatedSeriesTasks = tasks.map((task) => {
    if (task.id !== options.seriesTaskId || !task.recurrence) return task;
    const nextExdates = Array.from(
      new Set([
        ...normalizeExdates(task.recurrence.exdates),
        normalizedOccurrenceIso,
      ]),
    ).sort((left, right) => left.localeCompare(right));
    return {
      ...task,
      updatedAt: options.nowMs,
      recurrence: buildRecurrenceWithExdates(
        task.recurrence,
        nextExdates,
        task.recurrence.rrule,
      ),
    };
  });

  return updatedSeriesTasks.filter(
    (task) =>
      !(
        task.instance_of?.series_id === options.seriesId &&
        task.instance_of?.occurrence === normalizedOccurrenceIso
      ),
  );
}

export function deleteRecurringOccurrenceAndFuture(
  tasks: Task[],
  options: RecurringDeleteOptions,
): Task[] {
  const normalizedOccurrenceIso = normalizeOccurrenceIso(options.occurrenceIso);
  if (!normalizedOccurrenceIso) return tasks;

  const seriesTask = resolveSeriesTask(
    tasks,
    options.seriesTaskId,
    options.seriesId,
  );
  const withoutFutureInstances = tasks.filter(
    (task) =>
      !(
        task.instance_of?.series_id === options.seriesId &&
        task.instance_of?.occurrence >= normalizedOccurrenceIso
      ),
  );

  if (!seriesTask?.recurrence) {
    return withoutFutureInstances;
  }

  const previousIso = previousOccurrenceIso(
    seriesTask.recurrence,
    normalizedOccurrenceIso,
  );
  if (!previousIso) {
    return withoutFutureInstances.filter((task) => task.id !== seriesTask.id);
  }

  const parsed = parseRRule(seriesTask.recurrence.rrule);
  const truncatedRRule = formatRRule({
    freq: parsed.freq,
    interval: parsed.interval,
    byday: parsed.byday,
    bymonthday: parsed.bymonthday,
    untilIso: previousIso,
  });
  const retainedExdates = normalizeExdates(
    seriesTask.recurrence.exdates,
  ).filter((exdate) => exdate < normalizedOccurrenceIso);

  return withoutFutureInstances.map((task) => {
    if (task.id !== seriesTask.id || !task.recurrence) return task;
    return {
      ...task,
      updatedAt: options.nowMs,
      recurrence: buildRecurrenceWithExdates(
        task.recurrence,
        retainedExdates,
        truncatedRRule,
      ),
    };
  });
}
