import { CLI_NAME } from "../brand/brand";
import {
  BackupExportFilesystemError,
  exportBackup,
} from "../state/backupService";
import type { ExportCommandOptions } from "../cli/portabilityCommands";
import { CLI_EXIT_CODE } from "../cli/exitCodes";
import { redactedLogger } from "../logging/redactedLogger";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function printExportHelp(): void {
  redactedLogger.log(`Usage: ${CLI_NAME} export --out <path> [options]`);
  redactedLogger.log("");
  redactedLogger.log("Options:");
  redactedLogger.log("  --out <path>        Output file path (required)");
  redactedLogger.log("  --format json       Export format (json only)");
  redactedLogger.log("  --pretty            Pretty-print output JSON");
  redactedLogger.log(
    "  --redact-mode <basic|strict|strict-v2>  Redaction profile",
  );
  redactedLogger.log(
    "  --redact            Compatibility alias for --redact-mode=strict",
  );
  redactedLogger.log("  -h, --help          Show export help");
}

export async function runExportCommand(
  parsed: ExportCommandOptions,
): Promise<number> {
  if (parsed.help) {
    printExportHelp();
    return CLI_EXIT_CODE.SUCCESS;
  }

  try {
    const redactMode =
      parsed.redactMode ?? (parsed.redact ? "strict" : undefined);
    const result = await exportBackup({
      outputPath: parsed.outPath,
      pretty: parsed.pretty,
      redact: parsed.redact,
      redactMode,
    });

    redactedLogger.log(`[export] wrote: ${result.outputPath}`);
    redactedLogger.log(`[export] tasks: ${result.taskCount}`);
    redactedLogger.log(`[export] schemaVersion: ${result.schemaVersion}`);
    return CLI_EXIT_CODE.SUCCESS;
  } catch (error: unknown) {
    if (error instanceof BackupExportFilesystemError) {
      redactedLogger.error(`[export] failed: ${toErrorMessage(error)}`);
      return CLI_EXIT_CODE.IO_ERROR;
    }
    redactedLogger.error(`[export] failed: ${toErrorMessage(error)}`);
    return CLI_EXIT_CODE.IO_ERROR;
  }
}
