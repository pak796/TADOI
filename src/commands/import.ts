import { CLI_NAME } from "../brand/brand";
import {
  BackupImportFilesystemError,
  BackupImportUsageError,
  BackupImportPartialError,
  importBackup,
  type BackupImportSummary,
} from "../state/backupService";
import { TadoiLockBusyError } from "../state/lockfile";
import type { ImportCommandOptions } from "../cli/portabilityCommands";
import { CLI_EXIT_CODE } from "../cli/exitCodes";
import { redactedLogger } from "../logging/redactedLogger";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function printImportHelp(): void {
  redactedLogger.log(`Usage: ${CLI_NAME} import --in <path> [options]`);
  redactedLogger.log("");
  redactedLogger.log("Options:");
  redactedLogger.log("  --in <path>              Input file path (required)");
  redactedLogger.log("  --mode <merge|replace>   Import mode (default: merge)");
  redactedLogger.log(
    "  --backup                 Enable backup before write (default: true)",
  );
  redactedLogger.log("  --backup=false           Disable backup");
  redactedLogger.log("  --no-backup              Disable backup");
  redactedLogger.log(
    "  --dry-run                Validate and merge without writing",
  );
  redactedLogger.log("  --yes                    Required with --mode replace");
  redactedLogger.log(
    "  --pretty                 Pretty-print import summary as JSON",
  );
  redactedLogger.log("  -h, --help               Show import help");
}

function printImportSummary(
  summary: BackupImportSummary,
  pretty: boolean,
): void {
  if (pretty) {
    redactedLogger.log(JSON.stringify(summary, null, 2));
    return;
  }

  redactedLogger.log(
    `[import] mode: ${summary.mode}${summary.dryRun ? " (dry-run)" : ""}`,
  );
  redactedLogger.log(`[import] schemaVersion: ${summary.schemaVersion}`);
  redactedLogger.log(`[import] data path: ${summary.resolvedDataPath}`);
  if (summary.backupPath) {
    redactedLogger.log(`[import] backup: ${summary.backupPath}`);
  }
  redactedLogger.log(
    `[import] tasks added=${summary.tasks.added} updated=${summary.tasks.updated} unchanged=${summary.tasks.unchanged} removed=${summary.tasks.removed}`,
  );
  redactedLogger.log(
    `[import] conflicts resolved by updatedAt: ${summary.conflictsResolvedByUpdatedAt}`,
  );
  redactedLogger.log(
    `[import] saved views added=${summary.savedViews.added} updated=${summary.savedViews.updated} unchanged=${summary.savedViews.unchanged}`,
  );
  for (const warning of summary.warnings ?? []) {
    redactedLogger.log(`[import] warning: ${warning}`);
  }
}

export async function runImportCommand(
  parsed: ImportCommandOptions,
): Promise<number> {
  if (parsed.help) {
    printImportHelp();
    return CLI_EXIT_CODE.SUCCESS;
  }

  if (parsed.mode === "replace" && !parsed.yes) {
    redactedLogger.error("[import] replace mode requires --yes");
    return CLI_EXIT_CODE.PARSE_OR_VALIDATION;
  }

  try {
    const summary = await importBackup({
      inputPath: parsed.inPath,
      mode: parsed.mode,
      dryRun: parsed.dryRun,
      backup: parsed.backup,
    });

    printImportSummary(summary, parsed.pretty);
    return CLI_EXIT_CODE.SUCCESS;
  } catch (error: unknown) {
    if (error instanceof TadoiLockBusyError) {
      redactedLogger.error("[import] failed: TADOI is running (lock present).");
      return CLI_EXIT_CODE.LOCKED;
    }
    if (error instanceof BackupImportPartialError) {
      printImportSummary(error.summary, parsed.pretty);
      redactedLogger.error(`[import] ${error.message}`);
      return CLI_EXIT_CODE.IO_ERROR;
    }
    if (error instanceof BackupImportUsageError) {
      redactedLogger.error(`[import] failed: ${error.message}`);
      return CLI_EXIT_CODE.PARSE_OR_VALIDATION;
    }
    if (error instanceof BackupImportFilesystemError) {
      redactedLogger.error(`[import] failed: ${error.message}`);
      return CLI_EXIT_CODE.IO_ERROR;
    }

    redactedLogger.error(`[import] failed: ${toErrorMessage(error)}`);
    return CLI_EXIT_CODE.IO_ERROR;
  }
}
