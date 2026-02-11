import { addLocalDaysMs, diffLocalDays, startOfLocalDayMs } from "./dates";
import { Filters, SortMode, Task, TaskStatus } from "./models";
import { sortTasks } from "./query";
import {
  getOccurrences,
  latestOverdueOccurrence,
  nextOccurrence
} from "./recurrence/engine";
import {
  formatDateToLocalIso,
  parseLocalIsoToDate
} from "./recurrence/rruleAdapter";

export type VisibleTaskRowKind =
  | "regular"
  | "series_occurrence_virtual"
  | "series_occurrence_instance";

export type VisibleTaskRow = Task & {
  rowKind: VisibleTaskRowKind;
  sourceTaskId: string;
  seriesId?: string;
  occurrenceIso?: string;
};

const VIRTUAL_ROW_PREFIX = "series_occurrence";

function encodeRowPart(value: string): string {
  return encodeURIComponent(value);
}

function decodeRowPart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function buildSeriesOccurrenceRowId(seriesId: string, occurrenceIso: string): string {
  return `${VIRTUAL_ROW_PREFIX}:${encodeRowPart(seriesId)}:${encodeRowPart(occurrenceIso)}`;
}

export function parseSeriesOccurrenceRowId(rowId: string):
  | { seriesId: string; occurrenceIso: string }
  | null {
  const parts = rowId.split(":");
  if (parts.length !== 3 || parts[0] !== VIRTUAL_ROW_PREFIX) {
    return null;
  }
  return {
    seriesId: decodeRowPart(parts[1]),
    occurrenceIso: decodeRowPart(parts[2])
  };
}

function normalizeOccurrenceIso(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const date = parseLocalIsoToDate(iso);
  if (!date) return undefined;
  return formatDateToLocalIso(date);
}

function buildSeriesOccurrenceKey(seriesId: string, occurrenceIso: string): string {
  return `${seriesId}|${occurrenceIso}`;
}

function matchesStatusFilter(status: TaskStatus, filterStatus: Filters["status"]): boolean {
  if (filterStatus === "all") {
    return status !== "archived";
  }
  return status === filterStatus;
}

function matchesTagFilter(task: Pick<Task, "tags">, tag: string | undefined): boolean {
  if (!tag) return true;
  return task.tags.includes(tag);
}

function matchesSearchFilter(
  task: Pick<Task, "title" | "tags">,
  search: string
): boolean {
  if (!search) return true;
  const titleMatches = task.title.toLowerCase().includes(search);
  if (titleMatches) return true;
  return task.tags.some((tag) => tag.toLowerCase().includes(search));
}

function matchesDueFilter(task: Pick<Task, "status" | "dueAt" | "hasExplicitTime">, due: Filters["due"], now: number): boolean {
  if (due === "any") return true;
  if (task.status === "archived") return false;
  if (task.dueAt === undefined) return false;

  const startOfToday = startOfLocalDayMs(now);
  const dayDiff = diffLocalDays(task.dueAt, startOfToday);
  const timeOverdue =
    task.hasExplicitTime === true && dayDiff === 0 && now > task.dueAt;

  if (due === "overdue") {
    return dayDiff < 0 || timeOverdue;
  }
  if (due === "today") {
    return dayDiff === 0;
  }
  return dayDiff >= 0 && dayDiff <= 6;
}

function matchesCommonFilters(
  task: Pick<Task, "title" | "tags" | "status" | "dueAt" | "hasExplicitTime">,
  filters: Filters,
  search: string,
  now: number
): boolean {
  if (!matchesStatusFilter(task.status, filters.status)) {
    return false;
  }
  if (!matchesTagFilter(task, filters.tag)) {
    return false;
  }
  if (!matchesSearchFilter(task, search)) {
    return false;
  }
  if (!matchesDueFilter(task, filters.due, now)) {
    return false;
  }
  return true;
}

function toRegularRow(task: Task): VisibleTaskRow {
  if (task.instance_of) {
    return {
      ...task,
      rowKind: "series_occurrence_instance",
      sourceTaskId: task.id,
      seriesId: task.instance_of.series_id,
      occurrenceIso: task.instance_of.occurrence
    };
  }

  return {
    ...task,
    rowKind: "regular",
    sourceTaskId: task.id
  };
}

function buildSeriesVirtualRows(
  seriesTask: Task,
  now: number,
  filters: Filters,
  materializedKeys: Set<string>
): VisibleTaskRow[] {
  const recurrence = seriesTask.recurrence;
  if (!recurrence || seriesTask.status !== "open") {
    return [];
  }

  const statusMatches = matchesStatusFilter("open", filters.status);
  if (!statusMatches) {
    return [];
  }

  const startOfToday = startOfLocalDayMs(now);
  const endOfToday = addLocalDaysMs(startOfToday, 1) - 1;
  const endOfNext7 = addLocalDaysMs(startOfToday, 7) - 1;

  let occurrenceIsos: string[] = [];

  if (filters.due === "any") {
    const latestOverdue = latestOverdueOccurrence(seriesTask, now);
    if (latestOverdue) {
      occurrenceIsos = [latestOverdue];
    } else {
      const next = nextOccurrence(seriesTask, startOfToday - 1);
      if (next) {
        occurrenceIsos = [next];
      }
    }
  } else if (filters.due === "overdue") {
    const latestOverdue = latestOverdueOccurrence(seriesTask, now);
    occurrenceIsos = latestOverdue ? [latestOverdue] : [];
  } else if (filters.due === "today") {
    occurrenceIsos = getOccurrences(seriesTask, startOfToday, endOfToday);
  } else {
    occurrenceIsos = getOccurrences(seriesTask, startOfToday, endOfNext7);
  }

  const rows: VisibleTaskRow[] = [];

  for (const occurrenceIsoRaw of occurrenceIsos) {
    const occurrenceIso = normalizeOccurrenceIso(occurrenceIsoRaw);
    if (!occurrenceIso) continue;

    const key = buildSeriesOccurrenceKey(recurrence.series_id, occurrenceIso);
    if (materializedKeys.has(key)) {
      continue;
    }

    const occurrenceDate = parseLocalIsoToDate(occurrenceIso);
    if (!occurrenceDate) continue;
    const dueAt = occurrenceDate.getTime();

    const row: VisibleTaskRow = {
      ...seriesTask,
      id: buildSeriesOccurrenceRowId(recurrence.series_id, occurrenceIso),
      dueAt,
      rowKind: "series_occurrence_virtual",
      sourceTaskId: seriesTask.id,
      seriesId: recurrence.series_id,
      occurrenceIso
    };

    rows.push(row);
  }

  return rows;
}

export function buildVisibleTaskRows(
  tasks: Task[],
  filters: Filters,
  sortMode: SortMode,
  now: number
): VisibleTaskRow[] {
  const search = (filters.searchText ?? "").trim().toLowerCase();
  const rows: VisibleTaskRow[] = [];
  const materializedKeys = new Set<string>();

  for (const task of tasks) {
    if (!task.instance_of) continue;
    const occurrenceIso = normalizeOccurrenceIso(task.instance_of.occurrence);
    if (!occurrenceIso) continue;
    materializedKeys.add(buildSeriesOccurrenceKey(task.instance_of.series_id, occurrenceIso));
  }

  for (const task of tasks) {
    const recurrence = task.recurrence;

    if (task.instance_of) {
      if (matchesCommonFilters(task, filters, search, now)) {
        rows.push(toRegularRow(task));
      }
      continue;
    }

    if (recurrence && task.status === "open") {
      if (!matchesTagFilter(task, filters.tag) || !matchesSearchFilter(task, search)) {
        continue;
      }
      rows.push(...buildSeriesVirtualRows(task, now, filters, materializedKeys));
      continue;
    }

    if (matchesCommonFilters(task, filters, search, now)) {
      rows.push(toRegularRow(task));
    }
  }

  return sortTasks(rows, now, sortMode) as VisibleTaskRow[];
}
