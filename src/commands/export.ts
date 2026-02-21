import { CLI_NAME } from "../brand/brand";
import {
  BackupExportFilesystemError,
  exportBackup
} from "../state/backupService";
import type { ExportCommandOptions } from "../cli/portabilityCommands";
import { CLI_EXIT_CODE } from "../cli/exitCodes";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function printExportHelp(): void {
  console.log(`Usage: ${CLI_NAME} export --out <path> [options]`);
  console.log("");
  console.log("Options:");
  console.log("  --out <path>        Output file path (required)");
  console.log("  --format json       Export format (json only)");
  console.log("  --pretty            Pretty-print output JSON");
  console.log("  --redact-mode <basic|strict>  Redaction profile");
  console.log("  --redact            Compatibility alias for --redact-mode=strict");
  console.log("  -h, --help          Show export help");
}

export async function runExportCommand(parsed: ExportCommandOptions): Promise<number> {
  if (parsed.help) {
    printExportHelp();
    return CLI_EXIT_CODE.SUCCESS;
  }

  try {
    const redactMode = parsed.redactMode ?? (parsed.redact ? "strict" : undefined);
    const result = await exportBackup({
      outputPath: parsed.outPath,
      pretty: parsed.pretty,
      redact: parsed.redact,
      redactMode
    });

    console.log(`[export] wrote: ${result.outputPath}`);
    console.log(`[export] tasks: ${result.taskCount}`);
    console.log(`[export] schemaVersion: ${result.schemaVersion}`);
    return CLI_EXIT_CODE.SUCCESS;
  } catch (error: unknown) {
    if (error instanceof BackupExportFilesystemError) {
      console.error(`[export] failed: ${toErrorMessage(error)}`);
      return CLI_EXIT_CODE.IO_ERROR;
    }
    console.error(`[export] failed: ${toErrorMessage(error)}`);
    return CLI_EXIT_CODE.IO_ERROR;
  }
}
