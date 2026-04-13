import { promises as fs } from "fs";
import path from "path";
import type { SavedView, Task } from "../domain/models";
import { getOccurrences } from "../domain/recurrence/engine";
import { applySavedView } from "../domain/savedViews";
import { buildVisibleTaskRows } from "../domain/taskRows";
import {
  type CalendarTimeContext,
  type CalendarEventPrivacyMode,
  mapInstanceOverrideTaskToEvent,
  mapNonRecurringTaskToEvent,
  mapSeriesOccurrenceToEvent,
  mapSeriesTaskToRecurringEvent,
} from "../calendar/calendarMapper";
import { renderIcsCalendar } from "../calendar/icsWriter";
import {
  type CalendarExportRange,
  isTimestampInRange,
  resolveCalendarRangeWindow,
} from "../calendar/range";
import {
  isValidRRuleFragment,
  normalizeRRuleFragment,
} from "../calendar/rrule";
import { loadSettings } from "../settings/settings";
import { loadStateStrict, resolveDataPath } from "./persistence";

const PRIVATE_DIR_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;

export class CalendarExportUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalendarExportUsageError";
  }
}

export class CalendarExportDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalendarExportDomainError";
  }
}

export class CalendarExportFilesystemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalendarExportFilesystemError";
  }
}

export type CalendarExportOptions = {
  outputPath: string;
  viewName?: string;
  range?: CalendarExportRange;
  privacy?: CalendarEventPrivacyMode;
  cwd?: string;
  now?: Date;
  timeZone?: string;
};

export type CalendarExportResult = {
  outputPath: string;
  tasksScanned: number;
  eventsWritten: number;
  seriesRruleExported: number;
  instanceOverridesExported: number;
  exdateCount: number;
  rangeApplied: CalendarExportRange;
  privacyApplied: CalendarEventPrivacyMode;
  viewApplied?: string;
  timeContext: CalendarTimeContext;
  warnings?: string[];
};

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error;
}

function resolveViewByDisplayName(
  savedViews: SavedView[],
  viewName: string,
): SavedView | undefined {
  const normalizedName = viewName.trim().toLowerCase();
  return savedViews.find(
    (view) => view.name.trim().toLowerCase() === normalizedName,
  );
}

function filterTasksThroughSavedView(
  tasks: Task[],
  view: SavedView,
  nowMs: number,
): Task[] {
  const filters = applySavedView(view);
  const rows = buildVisibleTaskRows(tasks, filters, "due", nowMs);
  const regularIds = new Set<string>();
  const seriesIds = new Set<string>();
  const instanceIds = new Set<string>();

  for (const row of rows) {
    if (row.rowKind === "series_occurrence_virtual") {
      seriesIds.add(row.sourceTaskId);
      continue;
    }
    if (row.rowKind === "series_occurrence_instance") {
      instanceIds.add(row.sourceTaskId);
      continue;
    }
    regularIds.add(row.sourceTaskId);
  }

  return tasks.filter((task) => {
    if (task.instance_of) {
      return instanceIds.has(task.id);
    }
    if (task.recurrence) {
      return seriesIds.has(task.id);
    }
    return regularIds.has(task.id);
  });
}

function isValidTimeZone(value: string): boolean {
  try {
    // Throws RangeError for unknown/invalid time zones.
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function resolveConfiguredTimeZone(settings: unknown): string | undefined {
  if (typeof settings !== "object" || settings === null) return undefined;
  const record = settings as Record<string, unknown>;
  const candidate = record.timeZone ?? record.timezone;
  return typeof candidate === "string" ? candidate.trim() : undefined;
}

function resolveTimeContext(
  explicitTimeZone: string | undefined,
): CalendarTimeContext {
  const preferred = explicitTimeZone?.trim();
  if (preferred && isValidTimeZone(preferred)) {
    return {
      mode: "tzid",
      timeZone: preferred,
    };
  }

  const systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (systemTz && isValidTimeZone(systemTz)) {
    return {
      mode: "tzid",
      timeZone: systemTz,
    };
  }

  return {
    mode: "utc",
    timeZone: "UTC",
  };
}

async function resolveIcsOutputPath(
  outPath: string,
  cwd: string,
): Promise<string> {
  const raw = outPath.trim();
  if (!raw) {
    throw new CalendarExportUsageError("--out is required for calendar:export");
  }

  let resolved = path.isAbsolute(raw)
    ? path.normalize(raw)
    : path.resolve(cwd, raw);
  let treatAsDirectory = /[\\/]+$/.test(raw);

  if (!treatAsDirectory) {
    try {
      const stat = await fs.stat(resolved);
      treatAsDirectory = stat.isDirectory();
    } catch (error: unknown) {
      if (isErrnoException(error) && error.code === "ENOENT") {
        treatAsDirectory = false;
      } else {
        throw new CalendarExportFilesystemError(
          `Failed to inspect output path ${resolved}: ${toErrorMessage(error)}`,
        );
      }
    }
  }

  if (treatAsDirectory) {
    resolved = path.join(resolved, "tadoi.ics");
  }
  if (path.extname(resolved).toLowerCase() !== ".ics") {
    resolved = `${resolved}.ics`;
  }

  return path.normalize(resolved);
}

function getRelatedSeriesUid(
  task: Task,
  seriesTaskBySeriesId: Map<string, Task>,
): string | undefined {
  if (!task.instance_of) return undefined;
  const series = seriesTaskBySeriesId.get(task.instance_of.series_id);
  if (!series) return undefined;
  return `tadoi-series-${series.id}@local`;
}

export async function exportCalendarIcs(
  options: CalendarExportOptions,
): Promise<CalendarExportResult> {
  const warnings: string[] = [];
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const range = options.range ?? "next7";
  const privacy = options.privacy ?? "minimal";
  const cwd = options.cwd ?? process.cwd();
  const outputPath = await resolveIcsOutputPath(options.outputPath, cwd);

  let loadedState: Awaited<ReturnType<typeof loadStateStrict>>;
  try {
    loadedState = await loadStateStrict({ filePath: resolveDataPath() });
  } catch (error: unknown) {
    throw new CalendarExportFilesystemError(toErrorMessage(error));
  }

  let settingsTz: string | undefined;
  try {
    const settingsResult = await loadSettings();
    settingsTz = resolveConfiguredTimeZone(settingsResult.settings);
    for (const warning of settingsResult.warnings) {
      warnings.push(`Settings: ${warning}`);
    }
  } catch (error: unknown) {
    warnings.push(
      `Settings unavailable during export: ${toErrorMessage(error)}`,
    );
  }
  const timeContext = resolveTimeContext(
    options.timeZone?.trim() || settingsTz,
  );

  const stateTasks = loadedState.data.tasks;
  let filteredByView = stateTasks;
  let viewApplied: string | undefined;

  if (options.viewName && options.viewName.trim().length > 0) {
    const view = resolveViewByDisplayName(
      loadedState.data.savedViews,
      options.viewName,
    );
    if (!view) {
      throw new CalendarExportDomainError(
        `Saved view not found: ${options.viewName.trim()}`,
      );
    }
    viewApplied = view.name;
    filteredByView = filterTasksThroughSavedView(stateTasks, view, nowMs);
  }

  const eligibleTasks = filteredByView.filter(
    (task) =>
      task.status === "open" && (task.dueAt !== undefined || task.recurrence),
  );

  const seriesTaskBySeriesId = new Map<string, Task>();
  for (const task of stateTasks) {
    if (task.recurrence && !task.instance_of) {
      seriesTaskBySeriesId.set(task.recurrence.series_id, task);
    }
  }

  const rangeWindow = resolveCalendarRangeWindow(range, nowMs);
  const events = [];
  let seriesRruleExported = 0;
  let instanceOverridesExported = 0;
  let exdateCount = 0;

  for (const task of eligibleTasks) {
    if (task.instance_of) {
      if (
        task.dueAt === undefined ||
        !isTimestampInRange(task.dueAt, rangeWindow)
      ) {
        continue;
      }
      const event = mapInstanceOverrideTaskToEvent(
        task,
        timeContext,
        now,
        getRelatedSeriesUid(task, seriesTaskBySeriesId),
        privacy,
      );
      if (!event) continue;
      events.push(event);
      instanceOverridesExported += 1;
      continue;
    }

    if (task.recurrence) {
      const hasValidRRule = isValidRRuleFragment(task.recurrence.rrule ?? "");
      if (!hasValidRRule) {
        if (range === "all") {
          throw new CalendarExportDomainError(
            `Recurring task ${task.id} has invalid RRULE (${normalizeRRuleFragment(task.recurrence.rrule ?? "") || "<empty>"}). Use --range next7 or --range month.`,
          );
        }

        if (
          rangeWindow.startMs === undefined ||
          rangeWindow.endMs === undefined ||
          rangeWindow.endMs <= rangeWindow.startMs
        ) {
          continue;
        }

        const occurrences = getOccurrences(
          task,
          rangeWindow.startMs,
          rangeWindow.endMs - 1,
        );
        for (const occurrence of occurrences) {
          const event = mapSeriesOccurrenceToEvent(
            task,
            occurrence,
            timeContext,
            now,
            privacy,
          );
          if (event) {
            events.push(event);
          }
        }
        continue;
      }

      if (
        rangeWindow.range !== "all" &&
        rangeWindow.startMs !== undefined &&
        rangeWindow.endMs !== undefined &&
        getOccurrences(task, rangeWindow.startMs, rangeWindow.endMs - 1)
          .length === 0
      ) {
        continue;
      }

      const event = mapSeriesTaskToRecurringEvent(
        task,
        timeContext,
        now,
        privacy,
      );
      if (!event) continue;
      events.push(event);
      seriesRruleExported += 1;
      exdateCount += event.exdates?.values.length ?? 0;
      continue;
    }

    if (
      task.dueAt === undefined ||
      !isTimestampInRange(task.dueAt, rangeWindow)
    ) {
      continue;
    }
    const event = mapNonRecurringTaskToEvent(task, timeContext, now, privacy);
    if (event) {
      events.push(event);
    }
  }

  const rendered = renderIcsCalendar({
    events,
    timeContext,
  });

  try {
    await fs.mkdir(path.dirname(outputPath), {
      recursive: true,
      mode: PRIVATE_DIR_MODE,
    });
    await fs.writeFile(outputPath, rendered, {
      encoding: "utf8",
      mode: PRIVATE_FILE_MODE,
    });
  } catch (error: unknown) {
    throw new CalendarExportFilesystemError(
      `Failed to write ICS file at ${outputPath}: ${toErrorMessage(error)}`,
    );
  }

  return {
    outputPath,
    tasksScanned: eligibleTasks.length,
    eventsWritten: events.length,
    seriesRruleExported,
    instanceOverridesExported,
    exdateCount,
    rangeApplied: range,
    privacyApplied: privacy,
    ...(viewApplied ? { viewApplied } : {}),
    timeContext,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}
