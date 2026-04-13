import { promises as fs } from "fs";
import path from "path";
import type { CalendarEventPrivacyMode } from "../calendar/calendarMapper";
import type { CalendarImportMode } from "../calendar/importMapper";
import type { CalendarExportRange } from "../calendar/range";
import { createDataBackup } from "./persistence";
import { getDefaultBackupDir, getResolvedDataPath } from "./backupService";
import {
  exportCalendarIcs,
  type CalendarExportResult,
} from "./calendarExportService";
import {
  importCalendarIcs,
  type CalendarImportReport,
  type CalendarImportResult,
} from "./calendarImportService";

type CalendarControllerDeps = {
  exportCalendar?: typeof exportCalendarIcs;
  importCalendar?: typeof importCalendarIcs;
  resolveDataPath?: typeof getResolvedDataPath;
  createBackup?: typeof createDataBackup;
};

export type CalendarExportFlowInput = {
  range: CalendarExportRange;
  viewName?: string;
  privacy: CalendarEventPrivacyMode;
  outputPathInput: string;
  cwd?: string;
  now?: Date;
};

export type CalendarImportFlowInput = {
  inputPath: string;
  range: CalendarExportRange;
  viewName?: string;
  mode: CalendarImportMode;
  horizonDays: number;
  importTag?: string;
  reportPath?: string;
  cwd?: string;
  now?: Date;
};

export type CalendarImportFlowSummary = {
  result: CalendarImportResult;
  errorReasons: string[];
  fingerprint: string;
};

export type CalendarImportCommitResult = {
  result: CalendarImportResult;
  backupPath?: string;
};

function normalizeOptional(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function formatTimestamp(now: Date): string {
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function buildUniquePath(basePath: string): Promise<string> {
  if (!(await pathExists(basePath))) {
    return basePath;
  }
  const parsed = path.parse(basePath);
  let suffix = 1;
  while (true) {
    const candidate = path.join(
      parsed.dir,
      `${parsed.name}.${String(suffix)}${parsed.ext}`,
    );
    if (!(await pathExists(candidate))) {
      return candidate;
    }
    suffix += 1;
  }
}

function resolveFromCwd(filePath: string, cwd: string): string {
  return path.isAbsolute(filePath)
    ? path.normalize(filePath)
    : path.resolve(cwd, filePath);
}

export async function buildDefaultCalendarExportPath(
  options: {
    cwd?: string;
    dataPath?: string;
    now?: Date;
  } = {},
): Promise<string> {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? new Date();
  const dataPath = options.dataPath ?? getResolvedDataPath();
  const backupDir = getDefaultBackupDir(dataPath);
  const filename = `tadoi-calendar.${formatTimestamp(now)}.ics`;
  const candidate = resolveFromCwd(path.join(backupDir, filename), cwd);
  return buildUniquePath(path.normalize(candidate));
}

export async function buildDefaultCalendarImportReportPath(
  options: {
    cwd?: string;
    dataPath?: string;
    now?: Date;
  } = {},
): Promise<string> {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? new Date();
  const dataPath = options.dataPath ?? getResolvedDataPath();
  const backupDir = getDefaultBackupDir(dataPath);
  const filename = `tadoi-calendar-import-report.${formatTimestamp(now)}.json`;
  const candidate = resolveFromCwd(path.join(backupDir, filename), cwd);
  return buildUniquePath(path.normalize(candidate));
}

export async function resolveCalendarExportOutputPath(options: {
  outputPathInput: string;
  cwd?: string;
  now?: Date;
  dataPath?: string;
}): Promise<string> {
  const cwd = options.cwd ?? process.cwd();
  const raw = options.outputPathInput.trim();
  const defaultPath = await buildDefaultCalendarExportPath({
    cwd,
    now: options.now,
    dataPath: options.dataPath,
  });
  if (!raw) {
    return defaultPath;
  }

  let resolved = resolveFromCwd(raw, cwd);
  let treatAsDirectory = /[\\/]+$/.test(raw);

  if (!treatAsDirectory) {
    try {
      const stat = await fs.stat(resolved);
      treatAsDirectory = stat.isDirectory();
    } catch {
      treatAsDirectory = false;
    }
  }

  if (treatAsDirectory) {
    resolved = path.join(resolved, path.basename(defaultPath));
  }
  if (path.extname(resolved).toLowerCase() !== ".ics") {
    resolved = `${resolved}.ics`;
  }
  return path.normalize(resolved);
}

export function buildCalendarImportFingerprint(options: {
  inputPath: string;
  range: CalendarExportRange;
  viewName?: string;
  mode: CalendarImportMode;
  horizonDays: number;
  importTag?: string;
}): string {
  return JSON.stringify({
    inputPath: options.inputPath.trim(),
    range: options.range,
    viewName: normalizeOptional(options.viewName),
    mode: options.mode,
    horizonDays: options.horizonDays,
    importTag: normalizeOptional(options.importTag),
  });
}

export function collectTopCalendarImportErrorReasons(
  report: CalendarImportReport,
  limit = 3,
): string[] {
  const counts = new Map<string, number>();
  for (const entry of report.entries) {
    if (entry.action !== "error") continue;
    const message = normalizeOptional(entry.message) ?? "Unknown import error";
    counts.set(message, (counts.get(message) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )
    .slice(0, Math.max(1, limit))
    .map(([message, count]) =>
      count > 1 ? `${message} (${String(count)} events)` : message,
    );
}

export async function runCalendarExportFlow(
  input: CalendarExportFlowInput,
  deps: CalendarControllerDeps = {},
): Promise<CalendarExportResult> {
  const exportFn = deps.exportCalendar ?? exportCalendarIcs;
  const outputPath = await resolveCalendarExportOutputPath({
    outputPathInput: input.outputPathInput,
    cwd: input.cwd,
    now: input.now,
  });

  return exportFn({
    outputPath,
    range: input.range,
    viewName: normalizeOptional(input.viewName),
    privacy: input.privacy,
    cwd: input.cwd,
    now: input.now,
  });
}

export async function runCalendarImportDryRunFlow(
  input: CalendarImportFlowInput,
  deps: CalendarControllerDeps = {},
): Promise<CalendarImportFlowSummary> {
  const importFn = deps.importCalendar ?? importCalendarIcs;
  const result = await importFn({
    inputPath: input.inputPath.trim(),
    range: input.range,
    viewName: normalizeOptional(input.viewName),
    mode: input.mode,
    horizonDays: input.horizonDays,
    dryRun: true,
    importTag: normalizeOptional(input.importTag),
    reportPath: normalizeOptional(input.reportPath),
    cwd: input.cwd,
    now: input.now,
  });

  return {
    result,
    errorReasons: collectTopCalendarImportErrorReasons(result.report),
    fingerprint: buildCalendarImportFingerprint({
      inputPath: input.inputPath,
      range: input.range,
      viewName: input.viewName,
      mode: input.mode,
      horizonDays: input.horizonDays,
      importTag: input.importTag,
    }),
  };
}

export async function runCalendarImportCommitFlow(
  input: CalendarImportFlowInput,
  deps: CalendarControllerDeps = {},
): Promise<CalendarImportCommitResult> {
  const importFn = deps.importCalendar ?? importCalendarIcs;
  const resolveDataPathFn = deps.resolveDataPath ?? getResolvedDataPath;
  const createBackupFn = deps.createBackup ?? createDataBackup;
  const now = input.now ?? new Date();
  const dataPath = resolveDataPathFn();
  const backupPath = await createBackupFn(dataPath, { now });

  const result = await importFn({
    inputPath: input.inputPath.trim(),
    range: input.range,
    viewName: normalizeOptional(input.viewName),
    mode: input.mode,
    horizonDays: input.horizonDays,
    dryRun: false,
    importTag: normalizeOptional(input.importTag),
    reportPath: normalizeOptional(input.reportPath),
    cwd: input.cwd,
    now,
  });

  return {
    result,
    ...(backupPath ? { backupPath } : {}),
  };
}
