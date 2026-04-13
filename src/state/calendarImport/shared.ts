import { addLocalDaysMs, startOfLocalDayMs } from "../../domain/dates";
import type { SavedView, Task } from "../../domain/models";
import { getOccurrences } from "../../domain/recurrence/engine";
import type { ParsedIcsEvent } from "../../calendar/icsParser";
import {
  isTimestampInRange,
  resolveCalendarRangeWindow,
  type CalendarExportRange,
} from "../../calendar/range";
import type { CalendarImportMode } from "../../calendar/importMapper";

export const HARD_MATERIALIZATION_CAP = 2000;
export const MAX_HORIZON_DAYS = 3650;
export const DEFAULT_MAX_IMPORT_BYTES_ICS = 10 * 1024 * 1024;
export const PRIVATE_DIR_MODE = 0o700;
export const PRIVATE_FILE_MODE = 0o600;

export class CalendarImportUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalendarImportUsageError";
  }
}

export class CalendarImportDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalendarImportDomainError";
  }
}

export class CalendarImportFilesystemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalendarImportFilesystemError";
  }
}

export type CalendarImportOptions = {
  inputPath: string;
  viewName?: string;
  range?: CalendarExportRange;
  mode?: CalendarImportMode;
  horizonDays?: number;
  maxImportBytes?: number;
  dryRun?: boolean;
  importTag?: string;
  reportPath?: string;
  cwd?: string;
  now?: Date;
};

export type CalendarImportSummary = {
  eventsParsed: number;
  matchedByTaskId: number;
  matchedByUid: number;
  created: number;
  updated: number;
  merged: number;
  skipped: number;
  errors: number;
  recurringSeriesImported: number;
  overridesCreated: number;
  overridesUpdated: number;
  cancellationsApplied: number;
};

export type CalendarImportReportEntry = {
  uid?: string;
  recurrenceId?: string;
  action: "created" | "updated" | "merged" | "skipped" | "error" | "cancelled";
  match?: "x-task-id" | "uid" | "external-uid" | "none";
  taskId?: string;
  message?: string;
  conflicts?: string[];
};

export type CalendarImportReport = {
  generatedAt: string;
  inputPath: string;
  range: CalendarExportRange;
  mode: CalendarImportMode;
  dryRun: boolean;
  horizonDays: number;
  viewApplied?: string;
  summary: CalendarImportSummary;
  entries: CalendarImportReportEntry[];
  persisted: boolean;
};

export type CalendarImportResult = {
  summary: CalendarImportSummary;
  report: CalendarImportReport;
  outputReportPath?: string;
  hasErrors: boolean;
  warnings?: string[];
};

export type MatchResult = {
  task: Task;
  matchedBy: "x-task-id" | "uid" | "external-uid";
};

export type TaskLookup = {
  byId: Map<string, Task>;
  indexById: Map<string, number>;
  byExternalUid: Map<string, string>;
  bySeriesExternalUid: Map<string, string>;
  bySeriesOccurrence: Map<string, string>;
  bySeriesUidAndRecurrence: Map<string, string>;
};

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isErrnoException(
  error: unknown,
): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error;
}

export function pushReportEntry(
  reportEntries: CalendarImportReportEntry[],
  entry: CalendarImportReportEntry,
): void {
  reportEntries.push(entry);
}

export function toSeriesOccurrenceKey(
  seriesId: string,
  occurrenceIso: string,
): string {
  return `${seriesId}::${occurrenceIso}`;
}

export function toSeriesRecurrenceKey(
  seriesUid: string,
  recurrenceId: string,
): string {
  return `${seriesUid}::${recurrenceId}`;
}

export function toSeriesEvaluationTask(task: Task): Task {
  return {
    ...task,
    status: "open",
  };
}

export function seriesHasOccurrenceInRange(params: {
  task: Task;
  range: CalendarExportRange;
  rangeWindow: ReturnType<typeof resolveCalendarRangeWindow>;
  nowMs: number;
  horizonDays: number;
}): boolean {
  if (params.range === "all") return true;
  if (!params.task.recurrence) return false;
  if (
    params.rangeWindow.startMs === undefined ||
    params.rangeWindow.endMs === undefined
  ) {
    return false;
  }

  const horizonEnd = addLocalDaysMs(
    startOfLocalDayMs(params.nowMs),
    params.horizonDays,
  );
  const boundedEnd = Math.min(params.rangeWindow.endMs, horizonEnd);
  if (boundedEnd <= params.rangeWindow.startMs) {
    return false;
  }

  const occurrences = getOccurrences(
    toSeriesEvaluationTask(params.task),
    params.rangeWindow.startMs,
    boundedEnd - 1,
  );
  if (occurrences.length > HARD_MATERIALIZATION_CAP) {
    throw new CalendarImportUsageError(
      `Series expansion exceeded hard cap (${String(HARD_MATERIALIZATION_CAP)})`,
    );
  }
  return occurrences.length > 0;
}

export function normalizeSeriesExdates(task: Task): Task {
  if (!task.recurrence) return task;
  const normalized = Array.from(new Set(task.recurrence.exdates ?? [])).sort(
    (a, b) => a.localeCompare(b),
  );
  return {
    ...task,
    recurrence: {
      ...task.recurrence,
      ...(normalized.length > 0
        ? { exdates: normalized }
        : { exdates: undefined }),
    },
  };
}

export function shouldSkipByRange(
  event: ParsedIcsEvent,
  rangeWindow: ReturnType<typeof resolveCalendarRangeWindow>,
): boolean {
  const source = event.dtstart ?? event.recurrenceId;
  if (!source) return true;
  return !isTimestampInRange(source.epochMs, rangeWindow);
}

export function createCalendarImportSummary(
  eventsParsed: number,
): CalendarImportSummary {
  return {
    eventsParsed,
    matchedByTaskId: 0,
    matchedByUid: 0,
    created: 0,
    updated: 0,
    merged: 0,
    skipped: 0,
    errors: 0,
    recurringSeriesImported: 0,
    overridesCreated: 0,
    overridesUpdated: 0,
    cancellationsApplied: 0,
  };
}

export type CalendarImportViewContext = {
  view?: SavedView;
  viewApplied?: string;
  visibleSourceIds?: Set<string>;
};

export type CalendarImportMutableState = {
  tasks: Task[];
  taskLookup: TaskLookup;
  summary: CalendarImportSummary;
  reportEntries: CalendarImportReportEntry[];
  visibleSourceIds?: Set<string>;
};
