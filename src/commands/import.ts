import { CLI_NAME } from "../brand/brand";
import {
  BackupImportPartialError,
  importBackup,
  type BackupImportSummary
} from "../state/backupService";
import { TadoiLockBusyError } from "../state/lockfile";
import type { ImportCommandOptions } from "../cli/portabilityCommands";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function printImportHelp(): void {
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

export async function runImportCommand(parsed: ImportCommandOptions): Promise<number> {
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
    if (error instanceof TadoiLockBusyError) {
      console.error("[import] failed: TADOI is running (lock present).");
      return 1;
    }
    if (error instanceof BackupImportPartialError) {
      printImportSummary(error.summary, parsed.pretty);
      console.error(`[import] ${error.message}`);
      return 1;
    }

    console.error(`[import] failed: ${toErrorMessage(error)}`);
    return 1;
  }
}
