import { CLI_NAME } from "../brand/brand";
import { exportBackup } from "../state/backupService";
import type { ExportCommandOptions } from "../cli/portabilityCommands";

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
  console.log("  --redact            Blank task title/notes in export");
  console.log("  -h, --help          Show export help");
}

export async function runExportCommand(parsed: ExportCommandOptions): Promise<number> {
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
