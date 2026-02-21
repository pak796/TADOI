import { promises as fs } from "fs";
import path from "path";
import {
  addLocalDaysMs,
  startOfLocalDayMs
} from "../domain/dates";
import type { SavedView, Task } from "../domain/models";
import { getOccurrences } from "../domain/recurrence/engine";
import { applySavedView } from "../domain/savedViews";
import { buildVisibleTaskRows } from "../domain/taskRows";
import {
  buildRecurrenceFromSeriesEvent,
  createTaskFromDraft,
  getImportedAtReference,
  mapEventToTaskDraft,
  mergeTaskFromDraft,
  normalizeExdateIsoValues,
  parseTadoiIdentityFromUid,
  type CalendarImportMode
} from "../calendar/importMapper";
import { parseIcs, type ParsedIcsEvent } from "../calendar/icsParser";
import {
  isTimestampInRange,
  resolveCalendarRangeWindow,
  type CalendarExportRange
} from "../calendar/range";
import { isValidRRuleFragment, normalizeRRuleFragment } from "../calendar/rrule";
import { loadSettings } from "../settings/settings";
import { writeJsonAtomic, loadStateStrict, resolveDataPath } from "./persistence";
import { recomputeTagIndex } from "./portability";
import { validatePersistedState } from "./validation";

const HARD_MATERIALIZATION_CAP = 2000;
const MAX_HORIZON_DAYS = 3650;
export const DEFAULT_MAX_IMPORT_BYTES_ICS = 10 * 1024 * 1024;
const PRIVATE_DIR_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;

export class CalendarImportUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalendarImportUsageError";
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

type MatchResult = {
  task: Task;
  matchedBy: "x-task-id" | "uid" | "external-uid";
};

type TaskLookup = {
  byId: Map<string, Task>;
  indexById: Map<string, number>;
  byExternalUid: Map<string, string>;
  bySeriesExternalUid: Map<string, string>;
  bySeriesOccurrence: Map<string, string>;
  bySeriesUidAndRecurrence: Map<string, string>;
};

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error;
}

function normalizeInputPath(filePath: string, cwd: string): string {
  if (!filePath || filePath.trim().length === 0) {
    throw new CalendarImportUsageError("--in is required for calendar:import");
  }
  return path.isAbsolute(filePath)
    ? path.normalize(filePath.trim())
    : path.resolve(cwd, filePath.trim());
}

function resolveViewByDisplayName(
  savedViews: SavedView[],
  viewName: string
): SavedView | undefined {
  const normalizedName = viewName.trim().toLowerCase();
  return savedViews.find((view) => view.name.trim().toLowerCase() === normalizedName);
}

function extractVisibleSourceTaskIds(tasks: Task[], view: SavedView, nowMs: number): Set<string> {
  const filters = applySavedView(view);
  const rows = buildVisibleTaskRows(tasks, filters, "due", nowMs);
  return new Set(rows.map((row) => row.sourceTaskId));
}

function isTaskVisibleInView(
  task: Task,
  tasks: Task[],
  view: SavedView,
  nowMs: number,
  existingIndexById?: Map<string, number>
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

function coerceHorizonDays(value: number | undefined): number {
  const fallback = 365;
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value <= 0) {
    throw new CalendarImportUsageError("--horizon-days must be a positive integer");
  }
  if (value > MAX_HORIZON_DAYS) {
    throw new CalendarImportUsageError(
      `--horizon-days must be <= ${String(MAX_HORIZON_DAYS)}`
    );
  }
  return value;
}

function pushReportEntry(
  reportEntries: CalendarImportReportEntry[],
  entry: CalendarImportReportEntry
): void {
  reportEntries.push(entry);
}

function toSeriesOccurrenceKey(seriesId: string, occurrenceIso: string): string {
  return `${seriesId}::${occurrenceIso}`;
}

function toSeriesRecurrenceKey(seriesUid: string, recurrenceId: string): string {
  return `${seriesUid}::${recurrenceId}`;
}

function buildTaskLookup(tasks: Task[]): TaskLookup {
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

    if (task.recurrence && !task.instance_of && externalUid && !bySeriesExternalUid.has(externalUid)) {
      bySeriesExternalUid.set(externalUid, task.id);
    }

    if (task.instance_of) {
      const occurrenceKey = toSeriesOccurrenceKey(
        task.instance_of.series_id,
        task.instance_of.occurrence
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
    bySeriesUidAndRecurrence
  };
}

function replaceTaskById(
  tasks: Task[],
  lookup: TaskLookup,
  nextTask: Task
): TaskLookup {
  const index = lookup.indexById.get(nextTask.id);
  if (index === undefined) {
    return lookup;
  }
  tasks[index] = nextTask;
  return buildTaskLookup(tasks);
}

function appendTask(tasks: Task[], nextTask: Task): TaskLookup {
  tasks.push(nextTask);
  return buildTaskLookup(tasks);
}

function resolveTaskMatch(
  event: ParsedIcsEvent,
  lookup: TaskLookup
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

function resolveSeriesTaskForOverride(
  event: ParsedIcsEvent,
  lookup: TaskLookup
): MatchResult | undefined {
  const xTaskId = event.xTaskId?.trim();
  if (xTaskId) {
    const byX = lookup.byId.get(xTaskId);
    if (byX?.recurrence) {
      return { task: byX, matchedBy: "x-task-id" };
    }
  }

  const baseUidCandidates = [event.relatedTo?.trim(), event.uid?.trim()].filter(
    (value): value is string => Boolean(value)
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

function resolveInstanceMatch(
  event: ParsedIcsEvent,
  seriesTask: Task,
  occurrenceIso: string,
  lookup: TaskLookup
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
      toSeriesOccurrenceKey(seriesId, occurrenceIso)
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
      toSeriesRecurrenceKey(uid, occurrenceIso)
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

function toSeriesEvaluationTask(task: Task): Task {
  return {
    ...task,
    status: "open"
  };
}

function seriesHasOccurrenceInRange(params: {
  task: Task;
  range: CalendarExportRange;
  rangeWindow: ReturnType<typeof resolveCalendarRangeWindow>;
  nowMs: number;
  horizonDays: number;
}): boolean {
  if (params.range === "all") return true;
  if (!params.task.recurrence) return false;
  if (params.rangeWindow.startMs === undefined || params.rangeWindow.endMs === undefined) {
    return false;
  }

  const horizonEnd = addLocalDaysMs(startOfLocalDayMs(params.nowMs), params.horizonDays);
  const boundedEnd = Math.min(params.rangeWindow.endMs, horizonEnd);
  if (boundedEnd <= params.rangeWindow.startMs) {
    return false;
  }

  const occurrences = getOccurrences(
    toSeriesEvaluationTask(params.task),
    params.rangeWindow.startMs,
    boundedEnd - 1
  );
  if (occurrences.length > HARD_MATERIALIZATION_CAP) {
    throw new CalendarImportUsageError(
      `Series expansion exceeded hard cap (${String(HARD_MATERIALIZATION_CAP)})`
    );
  }
  return occurrences.length > 0;
}

function normalizeSeriesExdates(task: Task): Task {
  if (!task.recurrence) return task;
  const normalized = Array.from(new Set(task.recurrence.exdates ?? [])).sort((a, b) =>
    a.localeCompare(b)
  );
  return {
    ...task,
    recurrence: {
      ...task.recurrence,
      ...(normalized.length > 0 ? { exdates: normalized } : { exdates: undefined })
    }
  };
}

async function maybeWriteReport(
  reportPath: string | undefined,
  report: CalendarImportReport,
  cwd: string
): Promise<string | undefined> {
  if (!reportPath) return undefined;
  const resolved = path.isAbsolute(reportPath)
    ? path.normalize(reportPath)
    : path.resolve(cwd, reportPath);
  await fs.mkdir(path.dirname(resolved), { recursive: true, mode: PRIVATE_DIR_MODE });
  await fs.writeFile(resolved, JSON.stringify(report, null, 2), {
    encoding: "utf8",
    mode: PRIVATE_FILE_MODE
  });
  return resolved;
}

function shouldSkipByRange(
  event: ParsedIcsEvent,
  rangeWindow: ReturnType<typeof resolveCalendarRangeWindow>
): boolean {
  const source = event.dtstart ?? event.recurrenceId;
  if (!source) return true;
  return !isTimestampInRange(source.epochMs, rangeWindow);
}

export async function importCalendarIcs(
  options: CalendarImportOptions
): Promise<CalendarImportResult> {
  const warnings: string[] = [];
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const importedAtIso = now.toISOString();
  const cwd = options.cwd ?? process.cwd();
  const range = options.range ?? "next7";
  const mode = options.mode ?? "merge";
  const dryRun = options.dryRun === true;
  const horizonDays = coerceHorizonDays(options.horizonDays);
  const maxImportBytes =
    typeof options.maxImportBytes === "number" &&
    Number.isFinite(options.maxImportBytes) &&
    options.maxImportBytes > 0
      ? Math.floor(options.maxImportBytes)
      : DEFAULT_MAX_IMPORT_BYTES_ICS;
  const inputPath = normalizeInputPath(options.inputPath, cwd);

  if (mode !== "merge" && mode !== "update" && mode !== "create") {
    throw new CalendarImportUsageError("--mode must be merge, update, or create");
  }

  try {
    const stat = await fs.stat(inputPath);
    if (!stat.isFile()) {
      throw new CalendarImportUsageError(`Input path is not a file: ${inputPath}`);
    }
    if (stat.size > maxImportBytes) {
      throw new CalendarImportUsageError(
        `Input ICS exceeds maximum size (${String(stat.size)} bytes > ${String(maxImportBytes)} bytes): ${inputPath}`
      );
    }
  } catch (error: unknown) {
    if (error instanceof CalendarImportUsageError) {
      throw error;
    }
    if (isErrnoException(error) && error.code === "ENOENT") {
      throw new CalendarImportUsageError(`Input file not found: ${inputPath}`);
    }
    throw new CalendarImportFilesystemError(
      `Failed to inspect input ICS file at ${inputPath}: ${toErrorMessage(error)}`
    );
  }

  let inputContent = "";
  try {
    inputContent = await fs.readFile(inputPath, "utf8");
  } catch (error: unknown) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      throw new CalendarImportUsageError(`Input file not found: ${inputPath}`);
    }
    throw new CalendarImportFilesystemError(
      `Failed to read input ICS file at ${inputPath}: ${toErrorMessage(error)}`
    );
  }

  const parsed = (() => {
    try {
      return parseIcs(inputContent);
    } catch (error: unknown) {
      throw new CalendarImportUsageError(
        `Failed to parse ICS: ${toErrorMessage(error)}`
      );
    }
  })();

  let stateResult: Awaited<ReturnType<typeof loadStateStrict>>;
  try {
    stateResult = await loadStateStrict({ filePath: resolveDataPath() });
  } catch (error: unknown) {
    throw new CalendarImportFilesystemError(toErrorMessage(error));
  }

  try {
    const settingsResult = await loadSettings();
    for (const warning of settingsResult.warnings) {
      warnings.push(`Settings: ${warning}`);
    }
  } catch (error: unknown) {
    warnings.push(`Settings unavailable during import: ${toErrorMessage(error)}`);
  }

  const tasks = stateResult.data.tasks.map((task) => ({ ...task }));
  let taskLookup = buildTaskLookup(tasks);
  const savedViews = stateResult.data.savedViews;
  const rangeWindow = resolveCalendarRangeWindow(range, nowMs);

  let viewApplied: string | undefined;
  let visibleSourceIds: Set<string> | undefined;
  let view: SavedView | undefined;
  if (options.viewName && options.viewName.trim().length > 0) {
    view = resolveViewByDisplayName(savedViews, options.viewName);
    if (!view) {
      throw new CalendarImportUsageError(
        `Saved view not found: ${options.viewName.trim()}`
      );
    }
    viewApplied = view.name;
    visibleSourceIds = extractVisibleSourceTaskIds(tasks, view, nowMs);
  }

  const summary: CalendarImportSummary = {
    eventsParsed: parsed.events.length,
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
    cancellationsApplied: 0
  };

  const reportEntries: CalendarImportReportEntry[] = [];

  const baseEvents = parsed.events.filter((event) => !event.recurrenceId);
  const overrideEvents = parsed.events.filter((event) => Boolean(event.recurrenceId));

  for (const event of baseEvents) {
    const recurrenceId = event.recurrenceId?.localIso;

    if (!event.uid && !event.summary) {
      summary.skipped += 1;
      pushReportEntry(reportEntries, {
        action: "skipped",
        message: "Skipping VEVENT without UID and SUMMARY"
      });
      continue;
    }

    if (event.status === "CANCELLED" && !event.rrule) {
      summary.skipped += 1;
      pushReportEntry(reportEntries, {
        uid: event.uid,
        action: "skipped",
        message: "Standalone cancelled event skipped"
      });
      continue;
    }

    if (!event.rrule && shouldSkipByRange(event, rangeWindow)) {
      summary.skipped += 1;
      pushReportEntry(reportEntries, {
        uid: event.uid,
        action: "skipped",
        message: "Event outside selected range"
      });
      continue;
    }

    const match = mode === "create" ? undefined : resolveTaskMatch(event, taskLookup);
    if (match) {
      if (match.matchedBy === "x-task-id") {
        summary.matchedByTaskId += 1;
      } else {
        summary.matchedByUid += 1;
      }
      if (visibleSourceIds && !visibleSourceIds.has(match.task.id)) {
        summary.skipped += 1;
        pushReportEntry(reportEntries, {
          uid: event.uid,
          action: "skipped",
          match: match.matchedBy,
          taskId: match.task.id,
          message: `Matched task not visible in saved view "${viewApplied}"`
        });
        continue;
      }
    }

    if (event.rrule) {
      if (!isValidRRuleFragment(event.rrule)) {
        summary.errors += 1;
        pushReportEntry(reportEntries, {
          uid: event.uid,
          action: "error",
          match: match?.matchedBy ?? "none",
          taskId: match?.task.id,
          message: `Invalid RRULE: ${normalizeRRuleFragment(event.rrule)}`
        });
        continue;
      }

      const draft = mapEventToTaskDraft(event, {
        importTag: options.importTag
      });

      const existing = match?.task;
      const seriesId =
        existing?.recurrence?.series_id ??
        event.xSeriesId?.trim() ??
        `series:${existing?.id ?? crypto.randomUUID()}`;

      const recurrence = buildRecurrenceFromSeriesEvent(event, seriesId);
      if (!recurrence) {
        summary.errors += 1;
        pushReportEntry(reportEntries, {
          uid: event.uid,
          action: "error",
          message: "Recurring series requires DTSTART and RRULE"
        });
        continue;
      }

      const normalizedRecurrenceExdates = Array.from(
        new Set([
          ...(existing?.recurrence?.exdates ?? []),
          ...normalizeExdateIsoValues(event.exdates),
          ...(recurrence.exdates ?? [])
        ])
      ).sort((left, right) => left.localeCompare(right));

      if (!existing || mode === "create") {
        let created = createTaskFromDraft(draft, nowMs, importedAtIso);
        created = {
          ...created,
          recurrence: {
            ...recurrence,
            ...(normalizedRecurrenceExdates.length > 0
              ? { exdates: normalizedRecurrenceExdates }
              : {})
          }
        };

        if (!seriesHasOccurrenceInRange({
          task: created,
          range,
          rangeWindow,
          nowMs,
          horizonDays
        })) {
          summary.skipped += 1;
          pushReportEntry(reportEntries, {
            uid: event.uid,
            action: "skipped",
            message: "Series has no occurrence in selected range"
          });
          continue;
        }

        if (
          view &&
          !isTaskVisibleInView(created, tasks, view, nowMs, taskLookup.indexById)
        ) {
          summary.skipped += 1;
          pushReportEntry(reportEntries, {
            uid: event.uid,
            action: "skipped",
            message: `Series not visible in saved view "${viewApplied}"`
          });
          continue;
        }

        const normalizedCreated = normalizeSeriesExdates(created);
        taskLookup = appendTask(tasks, normalizedCreated);
        summary.created += 1;
        summary.recurringSeriesImported += 1;
        if (visibleSourceIds) {
          visibleSourceIds = extractVisibleSourceTaskIds(tasks, view as SavedView, nowMs);
        }
        pushReportEntry(reportEntries, {
          uid: event.uid,
          action: "created",
          match: match?.matchedBy ?? "none",
          taskId: normalizedCreated.id
        });
        continue;
      }

      const importedAtReference = getImportedAtReference(existing);
      const allowOverwrite =
        importedAtReference === undefined ||
        existing.updatedAt <= importedAtReference ||
        match?.matchedBy === "x-task-id" ||
        match?.matchedBy === "uid";
      const merged = mergeTaskFromDraft(existing, draft, {
        nowMs,
        importedAtIso,
        mode: mode === "update" ? "update" : "merge",
        allowOverwrite
      });

      let nextTask: Task = {
        ...merged.task,
        recurrence: {
          ...recurrence,
          ...(normalizedRecurrenceExdates.length > 0
            ? { exdates: normalizedRecurrenceExdates }
            : {})
        }
      };

      if (!seriesHasOccurrenceInRange({
        task: nextTask,
        range,
        rangeWindow,
        nowMs,
        horizonDays
      })) {
        summary.skipped += 1;
        pushReportEntry(reportEntries, {
          uid: event.uid,
          action: "skipped",
          match: match.matchedBy,
          taskId: existing.id,
          message: "Series has no occurrence in selected range"
        });
        continue;
      }

      if (
        view &&
        !isTaskVisibleInView(nextTask, tasks, view, nowMs, taskLookup.indexById)
      ) {
        summary.skipped += 1;
        pushReportEntry(reportEntries, {
          uid: event.uid,
          action: "skipped",
          match: match.matchedBy,
          taskId: existing.id,
          message: `Series not visible in saved view "${viewApplied}"`
        });
        continue;
      }

      nextTask = normalizeSeriesExdates(nextTask);
      taskLookup = replaceTaskById(tasks, taskLookup, nextTask);

      if (merged.action === "updated") {
        summary.updated += 1;
      } else if (merged.action === "merged") {
        summary.merged += 1;
      } else {
        summary.skipped += 1;
      }
      if (merged.action !== "skipped") {
        summary.recurringSeriesImported += 1;
      }
      pushReportEntry(reportEntries, {
        uid: event.uid,
        action: merged.action,
        match: match.matchedBy,
        taskId: existing.id,
        ...(merged.conflicts.length > 0 ? { conflicts: merged.conflicts } : {})
      });
      continue;
    }

    const draft = mapEventToTaskDraft(event, {
      importTag: options.importTag
    });

    if (!match || mode === "create") {
      const created = createTaskFromDraft(draft, nowMs, importedAtIso);
      if (
        view &&
        !isTaskVisibleInView(created, tasks, view, nowMs, taskLookup.indexById)
      ) {
        summary.skipped += 1;
        pushReportEntry(reportEntries, {
          uid: event.uid,
          action: "skipped",
          message: `Task not visible in saved view "${viewApplied}"`
        });
        continue;
      }
      taskLookup = appendTask(tasks, created);
      summary.created += 1;
      if (visibleSourceIds) {
        visibleSourceIds = extractVisibleSourceTaskIds(tasks, view as SavedView, nowMs);
      }
      pushReportEntry(reportEntries, {
        uid: event.uid,
        action: "created",
        match: "none",
        taskId: created.id
      });
      continue;
    }

    const importedAtReference = getImportedAtReference(match.task);
    const allowOverwrite =
      importedAtReference === undefined ||
      match.task.updatedAt <= importedAtReference ||
      match.matchedBy === "x-task-id" ||
      match.matchedBy === "uid";
    const merged = mergeTaskFromDraft(match.task, draft, {
      nowMs,
      importedAtIso,
      mode: mode === "update" ? "update" : "merge",
      allowOverwrite
    });
    if (
      view &&
      !isTaskVisibleInView(merged.task, tasks, view, nowMs, taskLookup.indexById)
    ) {
      summary.skipped += 1;
      pushReportEntry(reportEntries, {
        uid: event.uid,
        action: "skipped",
        match: match.matchedBy,
        taskId: match.task.id,
        message: `Task not visible in saved view "${viewApplied}"`
      });
      continue;
    }

    taskLookup = replaceTaskById(tasks, taskLookup, merged.task);

    if (merged.action === "updated") {
      summary.updated += 1;
    } else if (merged.action === "merged") {
      summary.merged += 1;
    } else {
      summary.skipped += 1;
    }
    pushReportEntry(reportEntries, {
      uid: event.uid,
      action: merged.action,
      match: match.matchedBy,
      taskId: match.task.id,
      ...(merged.conflicts.length > 0 ? { conflicts: merged.conflicts } : {})
    });
  }

  for (const event of overrideEvents) {
    const occurrenceIso = event.recurrenceId?.localIso;
    if (!occurrenceIso) {
      summary.errors += 1;
      pushReportEntry(reportEntries, {
        uid: event.uid,
        action: "error",
        message: "Override missing RECURRENCE-ID"
      });
      continue;
    }

    if (shouldSkipByRange(event, rangeWindow)) {
      summary.skipped += 1;
      pushReportEntry(reportEntries, {
        uid: event.uid,
        recurrenceId: occurrenceIso,
        action: "skipped",
        message: "Override outside selected range"
      });
      continue;
    }

    const seriesMatch = resolveSeriesTaskForOverride(event, taskLookup);
    if (!seriesMatch || !seriesMatch.task.recurrence) {
      summary.errors += 1;
      pushReportEntry(reportEntries, {
        uid: event.uid,
        recurrenceId: occurrenceIso,
        action: "error",
        message: "Unable to resolve base recurring series for override"
      });
      continue;
    }

    if (seriesMatch.matchedBy === "x-task-id") {
      summary.matchedByTaskId += 1;
    } else {
      summary.matchedByUid += 1;
    }

    const seriesTaskIndex = taskLookup.indexById.get(seriesMatch.task.id) ?? -1;
    if (seriesTaskIndex < 0) {
      summary.errors += 1;
      pushReportEntry(reportEntries, {
        uid: event.uid,
        recurrenceId: occurrenceIso,
        action: "error",
        message: "Resolved series task disappeared during import"
      });
      continue;
    }

    const seriesTask = tasks[seriesTaskIndex];
    if (
      view &&
      !isTaskVisibleInView(seriesTask, tasks, view, nowMs, taskLookup.indexById)
    ) {
      summary.skipped += 1;
      pushReportEntry(reportEntries, {
        uid: event.uid,
        recurrenceId: occurrenceIso,
        action: "skipped",
        match: seriesMatch.matchedBy,
        taskId: seriesTask.id,
        message: `Series/override not visible in saved view "${viewApplied}"`
      });
      continue;
    }

    const exdates = Array.from(
      new Set([...(seriesTask.recurrence?.exdates ?? []), occurrenceIso])
    ).sort((left, right) => left.localeCompare(right));
    tasks[seriesTaskIndex] = {
      ...seriesTask,
      recurrence: {
        ...(seriesTask.recurrence as NonNullable<Task["recurrence"]>),
        exdates
      },
      updatedAt: nowMs
    };
    taskLookup = buildTaskLookup(tasks);

    const instanceMatch = mode === "create"
      ? undefined
      : resolveInstanceMatch(event, tasks[seriesTaskIndex], occurrenceIso, taskLookup);

    if (event.status === "CANCELLED") {
      let cancelledAny = false;
      for (let i = 0; i < tasks.length; i += 1) {
        const task = tasks[i];
        if (
          task.instance_of?.series_id === tasks[seriesTaskIndex].recurrence?.series_id &&
          task.instance_of?.occurrence === occurrenceIso &&
          task.status === "open"
        ) {
          tasks[i] = {
            ...task,
            status: "done",
            closedAt: nowMs,
            updatedAt: nowMs
          };
          cancelledAny = true;
        }
      }
      if (cancelledAny) {
        taskLookup = buildTaskLookup(tasks);
      }
      summary.cancellationsApplied += 1;
      pushReportEntry(reportEntries, {
        uid: event.uid,
        recurrenceId: occurrenceIso,
        action: "cancelled",
        match: seriesMatch.matchedBy,
        taskId: tasks[seriesTaskIndex].id
      });
      continue;
    }

    const draft = mapEventToTaskDraft(event, {
      importTag: options.importTag
    });
    const seriesId = tasks[seriesTaskIndex].recurrence?.series_id;
    if (!seriesId) {
      summary.errors += 1;
      pushReportEntry(reportEntries, {
        uid: event.uid,
        recurrenceId: occurrenceIso,
        action: "error",
        message: "Resolved series missing recurrence metadata"
      });
      continue;
    }

    const baseUid = event.relatedTo?.trim() || event.uid?.trim();
    const draftForInstance = {
      ...draft,
      recurrenceId: occurrenceIso,
      ...(baseUid ? { seriesUid: baseUid } : {})
    };

    if (!instanceMatch || mode === "create") {
      let created = createTaskFromDraft(draftForInstance, nowMs, importedAtIso);
      created = {
        ...created,
        instance_of: {
          series_id: seriesId,
          occurrence: occurrenceIso
        },
        external: {
          ...created.external,
          calendar: {
            ...(created.external?.calendar ?? {}),
            uid: event.uid?.trim() || created.external?.calendar?.uid || crypto.randomUUID(),
            source: "ics-import",
            ...(draftForInstance.timeZone ? { tzid: draftForInstance.timeZone } : {}),
            lastImportedAt: importedAtIso,
            recurrenceId: occurrenceIso,
            ...(baseUid ? { seriesUid: baseUid } : {}),
            lastImportedHash:
              created.external?.calendar?.lastImportedHash
          }
        }
      };

      if (
        view &&
        !isTaskVisibleInView(created, tasks, view, nowMs, taskLookup.indexById)
      ) {
        summary.skipped += 1;
        pushReportEntry(reportEntries, {
          uid: event.uid,
          recurrenceId: occurrenceIso,
          action: "skipped",
          message: `Override not visible in saved view "${viewApplied}"`
        });
        continue;
      }

      taskLookup = appendTask(tasks, created);
      summary.created += 1;
      summary.overridesCreated += 1;
      pushReportEntry(reportEntries, {
        uid: event.uid,
        recurrenceId: occurrenceIso,
        action: "created",
        match: instanceMatch?.matchedBy ?? "none",
        taskId: created.id
      });
      continue;
    }

    const importedAtReference = getImportedAtReference(instanceMatch.task);
    const allowOverwrite =
      importedAtReference === undefined ||
      instanceMatch.task.updatedAt <= importedAtReference ||
      instanceMatch.matchedBy === "x-task-id" ||
      instanceMatch.matchedBy === "uid";
    const merged = mergeTaskFromDraft(instanceMatch.task, draftForInstance, {
      nowMs,
      importedAtIso,
      mode: mode === "update" ? "update" : "merge",
      allowOverwrite
    });
    const mergedTaskWithInstance: Task = {
      ...merged.task,
      instance_of: {
        series_id: seriesId,
        occurrence: occurrenceIso
      }
    };

    if (
      view &&
      !isTaskVisibleInView(mergedTaskWithInstance, tasks, view, nowMs, taskLookup.indexById)
    ) {
      summary.skipped += 1;
      pushReportEntry(reportEntries, {
        uid: event.uid,
        recurrenceId: occurrenceIso,
        action: "skipped",
        match: instanceMatch.matchedBy,
        taskId: instanceMatch.task.id,
        message: `Override not visible in saved view "${viewApplied}"`
      });
      continue;
    }

    taskLookup = replaceTaskById(tasks, taskLookup, mergedTaskWithInstance);

    if (merged.action === "updated") {
      summary.updated += 1;
      summary.overridesUpdated += 1;
    } else if (merged.action === "merged") {
      summary.merged += 1;
      summary.overridesUpdated += 1;
    } else {
      summary.skipped += 1;
    }

    pushReportEntry(reportEntries, {
      uid: event.uid,
      recurrenceId: occurrenceIso,
      action: merged.action,
      match: instanceMatch.matchedBy,
      taskId: instanceMatch.task.id,
      ...(merged.conflicts.length > 0 ? { conflicts: merged.conflicts } : {})
    });
  }

  const report: CalendarImportReport = {
    generatedAt: importedAtIso,
    inputPath,
    range,
    mode,
    dryRun,
    horizonDays,
    ...(viewApplied ? { viewApplied } : {}),
    summary,
    entries: reportEntries,
    persisted: false
  };

  if (!dryRun && summary.errors === 0) {
    const nextState = {
      ...stateResult.data,
      tasks,
      tagIndex: recomputeTagIndex(tasks, nowMs)
    };
    if (process.env.NODE_ENV !== "production") {
      const validation = validatePersistedState(nextState, "strict");
      if (!validation.ok) {
        throw new CalendarImportFilesystemError(
          `Post-import state validation failed: ${validation.errors.join("; ")}`
        );
      }
    }
    try {
      await writeJsonAtomic(nextState, {
        filePath: resolveDataPath(),
        pretty: true
      });
      report.persisted = true;
    } catch (error: unknown) {
      throw new CalendarImportFilesystemError(
        `Failed to persist imported state: ${toErrorMessage(error)}`
      );
    }
  }

  let outputReportPath: string | undefined;
  try {
    outputReportPath = await maybeWriteReport(options.reportPath, report, cwd);
  } catch (error: unknown) {
    warnings.push(`Failed to write import report: ${toErrorMessage(error)}`);
  }

  return {
    summary,
    report,
    ...(outputReportPath ? { outputReportPath } : {}),
    hasErrors: summary.errors > 0,
    ...(warnings.length > 0 ? { warnings } : {})
  };
}
