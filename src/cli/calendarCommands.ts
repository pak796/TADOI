import {
  printCalendarExportHelp,
  runCalendarExportCommand
} from "../commands/calendarExport";
import {
  printCalendarImportHelp,
  runCalendarImportCommand
} from "../commands/calendarImport";
import { CLI_EXIT_CODE } from "./exitCodes";
import type { CalendarExportRange } from "../calendar/range";
import type { CalendarEventPrivacyMode } from "../calendar/calendarMapper";
import type { CalendarImportMode } from "../calendar/importMapper";

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export type CalendarExportCommandOptions = {
  outPath: string;
  viewName?: string;
  range: CalendarExportRange;
  privacy: CalendarEventPrivacyMode;
  help: boolean;
};

export type CalendarImportCommandOptions = {
  inPath: string;
  viewName?: string;
  range: CalendarExportRange;
  mode: CalendarImportMode;
  horizonDays: number;
  dryRun: boolean;
  tag?: string;
  reportPath?: string;
  help: boolean;
};

function requireNextArg(args: string[], index: number, flag: string): ParseResult<string> {
  const next = args[index + 1];
  if (!next || next.startsWith("-")) {
    return { ok: false, error: `${flag} requires a value` };
  }
  return { ok: true, value: next };
}

function isCalendarRange(value: string): value is CalendarExportRange {
  return value === "next7" || value === "month" || value === "all";
}

function isPrivacyMode(value: string): value is CalendarEventPrivacyMode {
  return value === "minimal" || value === "full";
}

function isImportMode(value: string): value is CalendarImportMode {
  return value === "merge" || value === "update" || value === "create";
}

export function parseCalendarExportArgs(
  args: string[]
): ParseResult<CalendarExportCommandOptions> {
  let outPath = "";
  let viewName: string | undefined;
  let range: CalendarExportRange = "next7";
  let privacy: CalendarEventPrivacyMode = "minimal";
  let help = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }

    if (arg === "--out") {
      const next = requireNextArg(args, i, "--out");
      if (!next.ok) return next;
      outPath = next.value;
      i += 1;
      continue;
    }

    if (arg.startsWith("--out=")) {
      outPath = arg.slice("--out=".length);
      continue;
    }

    if (arg === "--view") {
      const next = requireNextArg(args, i, "--view");
      if (!next.ok) return next;
      viewName = next.value;
      i += 1;
      continue;
    }

    if (arg.startsWith("--view=")) {
      viewName = arg.slice("--view=".length);
      continue;
    }

    if (arg === "--range") {
      const next = requireNextArg(args, i, "--range");
      if (!next.ok) return next;
      const normalized = next.value.trim().toLowerCase();
      if (!isCalendarRange(normalized)) {
        return { ok: false, error: "--range must be next7, month, or all" };
      }
      range = normalized;
      i += 1;
      continue;
    }

    if (arg.startsWith("--range=")) {
      const normalized = arg.slice("--range=".length).trim().toLowerCase();
      if (!isCalendarRange(normalized)) {
        return { ok: false, error: "--range must be next7, month, or all" };
      }
      range = normalized;
      continue;
    }

    if (arg === "--privacy") {
      const next = requireNextArg(args, i, "--privacy");
      if (!next.ok) return next;
      const normalized = next.value.trim().toLowerCase();
      if (!isPrivacyMode(normalized)) {
        return { ok: false, error: "--privacy must be minimal or full" };
      }
      privacy = normalized;
      i += 1;
      continue;
    }

    if (arg.startsWith("--privacy=")) {
      const normalized = arg.slice("--privacy=".length).trim().toLowerCase();
      if (!isPrivacyMode(normalized)) {
        return { ok: false, error: "--privacy must be minimal or full" };
      }
      privacy = normalized;
      continue;
    }

    if (arg === "--include-details") {
      privacy = "full";
      continue;
    }

    if (arg.startsWith("-")) {
      return { ok: false, error: `Unknown option for calendar:export: ${arg}` };
    }

    return {
      ok: false,
      error: `Unexpected positional argument for calendar:export: ${arg}`
    };
  }

  if (!help && outPath.trim().length === 0) {
    return { ok: false, error: "--out is required for calendar:export" };
  }

  return {
    ok: true,
    value: {
      outPath: outPath.trim(),
      range,
      privacy,
      ...(viewName?.trim() ? { viewName: viewName.trim() } : {}),
      help
    }
  };
}

export function parseCalendarImportArgs(
  args: string[]
): ParseResult<CalendarImportCommandOptions> {
  let inPath = "";
  let viewName: string | undefined;
  let range: CalendarExportRange = "next7";
  let mode: CalendarImportMode = "merge";
  let horizonDays = 365;
  let dryRun = false;
  let tag: string | undefined;
  let reportPath: string | undefined;
  let help = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }

    if (arg === "--in") {
      const next = requireNextArg(args, i, "--in");
      if (!next.ok) return next;
      inPath = next.value;
      i += 1;
      continue;
    }

    if (arg.startsWith("--in=")) {
      inPath = arg.slice("--in=".length);
      continue;
    }

    if (arg === "--view") {
      const next = requireNextArg(args, i, "--view");
      if (!next.ok) return next;
      viewName = next.value;
      i += 1;
      continue;
    }

    if (arg.startsWith("--view=")) {
      viewName = arg.slice("--view=".length);
      continue;
    }

    if (arg === "--range") {
      const next = requireNextArg(args, i, "--range");
      if (!next.ok) return next;
      const normalized = next.value.trim().toLowerCase();
      if (!isCalendarRange(normalized)) {
        return { ok: false, error: "--range must be next7, month, or all" };
      }
      range = normalized;
      i += 1;
      continue;
    }

    if (arg.startsWith("--range=")) {
      const normalized = arg.slice("--range=".length).trim().toLowerCase();
      if (!isCalendarRange(normalized)) {
        return { ok: false, error: "--range must be next7, month, or all" };
      }
      range = normalized;
      continue;
    }

    if (arg === "--mode") {
      const next = requireNextArg(args, i, "--mode");
      if (!next.ok) return next;
      const normalized = next.value.trim().toLowerCase();
      if (!isImportMode(normalized)) {
        return { ok: false, error: "--mode must be merge, update, or create" };
      }
      mode = normalized;
      i += 1;
      continue;
    }

    if (arg.startsWith("--mode=")) {
      const normalized = arg.slice("--mode=".length).trim().toLowerCase();
      if (!isImportMode(normalized)) {
        return { ok: false, error: "--mode must be merge, update, or create" };
      }
      mode = normalized;
      continue;
    }

    if (arg === "--horizon-days") {
      const next = requireNextArg(args, i, "--horizon-days");
      if (!next.ok) return next;
      const parsed = Number.parseInt(next.value, 10);
      if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 3650) {
        return { ok: false, error: "--horizon-days must be a positive integer <= 3650" };
      }
      horizonDays = parsed;
      i += 1;
      continue;
    }

    if (arg.startsWith("--horizon-days=")) {
      const parsed = Number.parseInt(arg.slice("--horizon-days=".length), 10);
      if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 3650) {
        return { ok: false, error: "--horizon-days must be a positive integer <= 3650" };
      }
      horizonDays = parsed;
      continue;
    }

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--tag") {
      const next = requireNextArg(args, i, "--tag");
      if (!next.ok) return next;
      tag = next.value;
      i += 1;
      continue;
    }

    if (arg.startsWith("--tag=")) {
      tag = arg.slice("--tag=".length);
      continue;
    }

    if (arg === "--report") {
      const next = requireNextArg(args, i, "--report");
      if (!next.ok) return next;
      reportPath = next.value;
      i += 1;
      continue;
    }

    if (arg.startsWith("--report=")) {
      reportPath = arg.slice("--report=".length);
      continue;
    }

    if (arg.startsWith("-")) {
      return { ok: false, error: `Unknown option for calendar:import: ${arg}` };
    }

    return {
      ok: false,
      error: `Unexpected positional argument for calendar:import: ${arg}`
    };
  }

  if (!help && inPath.trim().length === 0) {
    return { ok: false, error: "--in is required for calendar:import" };
  }

  return {
    ok: true,
    value: {
      inPath: inPath.trim(),
      range,
      mode,
      horizonDays,
      dryRun,
      ...(viewName?.trim() ? { viewName: viewName.trim() } : {}),
      ...(tag?.trim() ? { tag: tag.trim() } : {}),
      ...(reportPath?.trim() ? { reportPath: reportPath.trim() } : {}),
      help
    }
  };
}

export async function runCalendarCommand(
  command: "export" | "import",
  args: string[]
): Promise<number> {
  if (command === "export") {
    const parsed = parseCalendarExportArgs(args);
    if (!parsed.ok) {
      console.error(`[calendar:export] ${parsed.error}`);
      printCalendarExportHelp();
      return CLI_EXIT_CODE.PARSE_OR_VALIDATION;
    }
    return runCalendarExportCommand(parsed.value);
  }

  const parsed = parseCalendarImportArgs(args);
  if (!parsed.ok) {
    console.error(`[calendar:import] ${parsed.error}`);
    printCalendarImportHelp();
    return CLI_EXIT_CODE.PARSE_OR_VALIDATION;
  }
  return runCalendarImportCommand(parsed.value);
}
