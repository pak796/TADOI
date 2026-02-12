import {
  printCalendarExportHelp,
  runCalendarExportCommand
} from "../commands/calendarExport";
import type { CalendarExportRange } from "../calendar/range";

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export type CalendarExportCommandOptions = {
  outPath: string;
  viewName?: string;
  range: CalendarExportRange;
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

export function parseCalendarExportArgs(
  args: string[]
): ParseResult<CalendarExportCommandOptions> {
  let outPath = "";
  let viewName: string | undefined;
  let range: CalendarExportRange = "next7";
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
      ...(viewName?.trim() ? { viewName: viewName.trim() } : {}),
      help
    }
  };
}

export async function runCalendarCommand(_command: "export", args: string[]): Promise<number> {
  const parsed = parseCalendarExportArgs(args);
  if (!parsed.ok) {
    console.error(`[calendar:export] ${parsed.error}`);
    printCalendarExportHelp();
    return 1;
  }
  return runCalendarExportCommand(parsed.value);
}
