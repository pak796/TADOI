import type { ImportMode } from "../state/portability";
import { printExportHelp, runExportCommand } from "../commands/export";
import { printImportHelp, runImportCommand } from "../commands/import";

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export type ExportCommandOptions = {
  outPath: string;
  format: "json";
  pretty: boolean;
  redact: boolean;
  help: boolean;
};

export type ImportCommandOptions = {
  inPath: string;
  mode: ImportMode;
  backup: boolean;
  dryRun: boolean;
  yes: boolean;
  pretty: boolean;
  help: boolean;
};

function requireNextArg(args: string[], index: number, flag: string): ParseResult<string> {
  const next = args[index + 1];
  if (!next || next.startsWith("-")) {
    return { ok: false, error: `${flag} requires a value` };
  }
  return { ok: true, value: next };
}

function parseBooleanLike(value: string): ParseResult<boolean> {
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) {
    return { ok: true, value: true };
  }
  if (["false", "0", "no", "n"].includes(normalized)) {
    return { ok: true, value: false };
  }
  return { ok: false, error: `Invalid boolean value: ${value}` };
}

export function parseExportArgs(args: string[]): ParseResult<ExportCommandOptions> {
  let outPath = "";
  let format: "json" = "json";
  let pretty = false;
  let redact = false;
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

    if (arg === "--format") {
      const next = requireNextArg(args, i, "--format");
      if (!next.ok) return next;
      const nextFormat = next.value.toLowerCase();
      if (nextFormat !== "json") {
        return { ok: false, error: "--format must be json" };
      }
      format = "json";
      i += 1;
      continue;
    }

    if (arg.startsWith("--format=")) {
      const nextFormat = arg.slice("--format=".length).toLowerCase();
      if (nextFormat !== "json") {
        return { ok: false, error: "--format must be json" };
      }
      format = "json";
      continue;
    }

    if (arg === "--pretty") {
      pretty = true;
      continue;
    }

    if (arg === "--redact") {
      redact = true;
      continue;
    }

    if (arg.startsWith("-")) {
      return { ok: false, error: `Unknown option for export: ${arg}` };
    }

    return { ok: false, error: `Unexpected positional argument for export: ${arg}` };
  }

  if (!help && outPath.trim().length === 0) {
    return { ok: false, error: "--out is required for export" };
  }

  return {
    ok: true,
    value: {
      outPath: outPath.trim(),
      format,
      pretty,
      redact,
      help
    }
  };
}

export function parseImportArgs(args: string[]): ParseResult<ImportCommandOptions> {
  let inPath = "";
  let mode: ImportMode = "merge";
  let backup = true;
  let dryRun = false;
  let yes = false;
  let pretty = false;
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

    if (arg === "--mode") {
      const next = requireNextArg(args, i, "--mode");
      if (!next.ok) return next;
      const nextMode = next.value.toLowerCase();
      if (nextMode !== "merge" && nextMode !== "replace") {
        return { ok: false, error: "--mode must be merge or replace" };
      }
      mode = nextMode;
      i += 1;
      continue;
    }

    if (arg.startsWith("--mode=")) {
      const nextMode = arg.slice("--mode=".length).toLowerCase();
      if (nextMode !== "merge" && nextMode !== "replace") {
        return { ok: false, error: "--mode must be merge or replace" };
      }
      mode = nextMode;
      continue;
    }

    if (arg === "--backup") {
      backup = true;
      continue;
    }

    if (arg === "--no-backup") {
      backup = false;
      continue;
    }

    if (arg.startsWith("--backup=")) {
      const parsed = parseBooleanLike(arg.slice("--backup=".length));
      if (!parsed.ok) return parsed;
      backup = parsed.value;
      continue;
    }

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--yes") {
      yes = true;
      continue;
    }

    if (arg === "--pretty") {
      pretty = true;
      continue;
    }

    if (arg.startsWith("-")) {
      return { ok: false, error: `Unknown option for import: ${arg}` };
    }

    return { ok: false, error: `Unexpected positional argument for import: ${arg}` };
  }

  if (!help && inPath.trim().length === 0) {
    return { ok: false, error: "--in is required for import" };
  }

  return {
    ok: true,
    value: {
      inPath: inPath.trim(),
      mode,
      backup,
      dryRun,
      yes,
      pretty,
      help
    }
  };
}

export async function runPortabilityCommand(
  command: "export" | "import",
  args: string[]
): Promise<number> {
  if (command === "export") {
    const parsed = parseExportArgs(args);
    if (!parsed.ok) {
      console.error(`[export] ${parsed.error}`);
      printExportHelp();
      return 1;
    }
    return runExportCommand(parsed.value);
  }

  const parsed = parseImportArgs(args);
  if (!parsed.ok) {
    console.error(`[import] ${parsed.error}`);
    printImportHelp();
    return 1;
  }
  return runImportCommand(parsed.value);
}
