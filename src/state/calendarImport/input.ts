import { promises as fs } from "fs";
import path from "path";
import type { SavedView } from "../../domain/models";
import { parseIcs } from "../../calendar/icsParser";
import {
  resolveCalendarRangeWindow,
  type CalendarExportRange,
} from "../../calendar/range";
import { loadSettings } from "../../settings/settings";
import type { StrictLoadResult } from "../persistence";
import {
  CalendarImportDomainError,
  CalendarImportFilesystemError,
  CalendarImportUsageError,
  DEFAULT_MAX_IMPORT_BYTES_ICS,
  MAX_HORIZON_DAYS,
  type CalendarImportOptions,
  type CalendarImportViewContext,
  isErrnoException,
  toErrorMessage,
} from "./shared";
import {
  extractVisibleSourceTaskIds,
  resolveViewByDisplayName,
} from "./matching";

export function buildStaleLockRecoveredWarning(event: {
  lockPath: string;
  archivedPath?: string;
}): string {
  const archivedSuffix = event.archivedPath
    ? ` (archived to ${event.archivedPath})`
    : "";
  return `Recovered stale lock from previous run at ${event.lockPath}${archivedSuffix}`;
}

export function normalizeInputPath(filePath: string, cwd: string): string {
  if (!filePath || filePath.trim().length === 0) {
    throw new CalendarImportUsageError("--in is required for calendar:import");
  }
  return path.isAbsolute(filePath)
    ? path.normalize(filePath.trim())
    : path.resolve(cwd, filePath.trim());
}

export function coerceHorizonDays(value: number | undefined): number {
  const fallback = 365;
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value <= 0) {
    throw new CalendarImportUsageError(
      "--horizon-days must be a positive integer",
    );
  }
  if (value > MAX_HORIZON_DAYS) {
    throw new CalendarImportUsageError(
      `--horizon-days must be <= ${String(MAX_HORIZON_DAYS)}`,
    );
  }
  return value;
}

export async function readParsedIcsInput(params: {
  inputPath: string;
  cwd: string;
  maxImportBytes?: number;
}): Promise<{ inputPath: string; inputContent: string; parsed: ReturnType<typeof parseIcs> }> {
  const maxImportBytes =
    typeof params.maxImportBytes === "number" &&
    Number.isFinite(params.maxImportBytes) &&
    params.maxImportBytes > 0
      ? Math.floor(params.maxImportBytes)
      : DEFAULT_MAX_IMPORT_BYTES_ICS;
  const inputPath = normalizeInputPath(params.inputPath, params.cwd);

  try {
    const stat = await fs.stat(inputPath);
    if (!stat.isFile()) {
      throw new CalendarImportUsageError(
        `Input path is not a file: ${inputPath}`,
      );
    }
    if (stat.size > maxImportBytes) {
      throw new CalendarImportUsageError(
        `Input ICS exceeds maximum size (${String(stat.size)} bytes > ${String(maxImportBytes)} bytes): ${inputPath}`,
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
      `Failed to inspect input ICS file at ${inputPath}: ${toErrorMessage(error)}`,
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
      `Failed to read input ICS file at ${inputPath}: ${toErrorMessage(error)}`,
    );
  }

  const parsed = (() => {
    try {
      return parseIcs(inputContent);
    } catch (error: unknown) {
      throw new CalendarImportUsageError(
        `Failed to parse ICS: ${toErrorMessage(error)}`,
      );
    }
  })();

  return { inputPath, inputContent, parsed };
}

export async function loadSettingsWarnings(): Promise<string[]> {
  try {
    const settingsResult = await loadSettings();
    return settingsResult.warnings.map((warning) => `Settings: ${warning}`);
  } catch (error: unknown) {
    return [`Settings unavailable during import: ${toErrorMessage(error)}`];
  }
}

export function resolveViewContext(params: {
  options: CalendarImportOptions;
  stateResult: StrictLoadResult;
  tasks: StrictLoadResult["data"]["tasks"];
  nowMs: number;
}): CalendarImportViewContext {
  if (!params.options.viewName || params.options.viewName.trim().length === 0) {
    return {};
  }

  const savedViews: SavedView[] = params.stateResult.data.savedViews;
  const view = resolveViewByDisplayName(savedViews, params.options.viewName);
  if (!view) {
    throw new CalendarImportDomainError(
      `Saved view not found: ${params.options.viewName.trim()}`,
    );
  }

  return {
    view,
    viewApplied: view.name,
    visibleSourceIds: extractVisibleSourceTaskIds(
      params.tasks,
      view,
      params.nowMs,
    ),
  };
}

export function resolveImportRangeWindow(
  range: CalendarExportRange,
  nowMs: number,
): ReturnType<typeof resolveCalendarRangeWindow> {
  return resolveCalendarRangeWindow(range, nowMs);
}
