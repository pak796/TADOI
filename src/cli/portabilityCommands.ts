import { CLI_NAME } from "../brand/brand";
import {
  BackupImportPartialError,
  exportBackup,
  importBackup,
  type BackupImportSummary
} from "../state/backupService";
import type { ImportMode } from "../state/portability";

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

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

function printExportHelp(): void {
  console.log(`Usage: ${CLI_NAME} export --out <path> [options]`);
  console.log("");
  console.log("Options:");
  console.log("  --out <path>        Output file path (required)");
  console.log("  --format json       Export format (json only)");
  console.log("  --pretty            Pretty-print output JSON");
  console.log("  --redact            Blank task title/notes in export");
  console.log("  -h, --help          Show export help");
}

function printImportHelp(): void {
  console.log(`Usage: ${CLI_NAME} import --in <path> [options]`);
  console.log("");
  console.log("Options:");
  console.log("  --in <path>              Input file path (required)");
  console.log("  --mode <merge|replace>   Import mode (default: merge)");
  console.log("  --backup                 Enable backup before write (default: true)");
  console.log("  --backup=false           Disable backup");
  console.log("  --no-backup              Disable backup");
  console.log("  --dry-run                Validate and merge without writing");
  console.log("  --yes                    Required with --mode replace");
  console.log("  --pretty                 Pretty-print import summary as JSON");
  console.log("  -h, --help               Show import help");
}

function printImportSummary(summary: BackupImportSummary, pretty: boolean): void {
  if (pretty) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(`[import] mode: ${summary.mode}${summary.dryRun ? " (dry-run)" : ""}`);
  console.log(`[import] schemaVersion: ${summary.schemaVersion}`);
  console.log(`[import] data path: ${summary.resolvedDataPath}`);
  if (summary.backupPath) {
    console.log(`[import] backup: ${summary.backupPath}`);
  }
  console.log(
    `[import] tasks added=${summary.tasks.added} updated=${summary.tasks.updated} unchanged=${summary.tasks.unchanged} removed=${summary.tasks.removed}`
  );
  console.log(
    `[import] conflicts resolved by updatedAt: ${summary.conflictsResolvedByUpdatedAt}`
  );
  console.log(
    `[import] saved views added=${summary.savedViews.added} updated=${summary.savedViews.updated} unchanged=${summary.savedViews.unchanged}`
  );
}

async function runExport(parsed: ExportCommandOptions): Promise<number> {
  if (parsed.help) {
    printExportHelp();
    return 0;
  }

  try {
    const result = await exportBackup({
      outputPath: parsed.outPath,
      pretty: parsed.pretty,
      redact: parsed.redact
    });

    console.log(`[export] wrote: ${result.outputPath}`);
    console.log(`[export] tasks: ${result.taskCount}`);
    console.log(`[export] schemaVersion: ${result.schemaVersion}`);
    return 0;
  } catch (error: unknown) {
    console.error(`[export] failed: ${toErrorMessage(error)}`);
    return 1;
  }
}

async function runImport(parsed: ImportCommandOptions): Promise<number> {
  if (parsed.help) {
    printImportHelp();
    return 0;
  }

  if (parsed.mode === "replace" && !parsed.yes) {
    console.error("[import] replace mode requires --yes");
    return 1;
  }

  try {
    const summary = await importBackup({
      inputPath: parsed.inPath,
      mode: parsed.mode,
      dryRun: parsed.dryRun,
      backup: parsed.backup
    });

    printImportSummary(summary, parsed.pretty);
    return 0;
  } catch (error: unknown) {
    if (error instanceof BackupImportPartialError) {
      printImportSummary(error.summary, parsed.pretty);
      console.error(`[import] ${error.message}`);
      return 1;
    }

    console.error(`[import] failed: ${toErrorMessage(error)}`);
    return 1;
  }
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
    return runExport(parsed.value);
  }

  const parsed = parseImportArgs(args);
  if (!parsed.ok) {
    console.error(`[import] ${parsed.error}`);
    printImportHelp();
    return 1;
  }
  return runImport(parsed.value);
}
