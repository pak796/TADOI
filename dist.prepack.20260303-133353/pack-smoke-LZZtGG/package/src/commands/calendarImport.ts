import { CLI_NAME } from "../brand/brand";
import type { CalendarImportCommandOptions } from "../cli/calendarCommands";
import {
  CalendarImportDomainError,
  CalendarImportFilesystemError,
  CalendarImportUsageError,
  importCalendarIcs
} from "../state/calendarImportService";
import { TadoiLockBusyError } from "../state/lockfile";
import { CLI_EXIT_CODE } from "../cli/exitCodes";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function printCalendarImportHelp(): void {
  console.log(`Usage: ${CLI_NAME} calendar:import --in <file.ics> [options]`);
  console.log("");
  console.log("Options:");
  console.log("  --in <path>                  Input .ics path (required)");
  console.log("  --view <name>                Saved view display name");
  console.log("  --range <next7|month|all>    Date range (default: next7)");
  console.log("  --mode <merge|update|create> Import mode (default: merge)");
  console.log("  --horizon-days <n>           Recurrence expansion horizon (default: 365)");
  console.log("  --dry-run                    Parse and plan without writing");
  console.log("  --tag <value>                Tag to add on newly created tasks only");
  console.log("  --report <path>              Write JSON import report");
  console.log("  -h, --help                   Show calendar import help");
  console.log("");
  console.log("Notes:");
  console.log("  - One-way import action only (no live sync).");
  console.log("  - Identity precedence: X-TADOI-TASK-ID, then TADOI UID, then external UID.");
  console.log("  - merge mode is conservative (tags/links union, notes append).");
  console.log("  - RRULE must be valid for recurring series; recurrence expansion is bounded.");
  console.log("");
  console.log("Examples:");
  console.log(`  ${CLI_NAME} calendar:import --in ./tadoi.ics --dry-run`);
  console.log(
    `  ${CLI_NAME} calendar:import --in ./tadoi.ics --mode merge --range month --report ./import-report.json`
  );
  console.log(
    `  ${CLI_NAME} calendar:import --in ./tadoi.ics --mode update --range all --horizon-days 365`
  );
}

export async function runCalendarImportCommand(
  parsed: CalendarImportCommandOptions
): Promise<number> {
  if (parsed.help) {
    printCalendarImportHelp();
    return CLI_EXIT_CODE.SUCCESS;
  }

  try {
    const result = await importCalendarIcs({
      inputPath: parsed.inPath,
      viewName: parsed.viewName,
      range: parsed.range,
      mode: parsed.mode,
      horizonDays: parsed.horizonDays,
      dryRun: parsed.dryRun,
      importTag: parsed.tag,
      reportPath: parsed.reportPath
    });

    const dryRunLabel = parsed.dryRun ? " (dry-run)" : "";
    console.log(`[calendar:import] events parsed: ${result.summary.eventsParsed}${dryRunLabel}`);
    console.log(
      `[calendar:import] matched by X-TADOI-TASK-ID: ${result.summary.matchedByTaskId}`
    );
    console.log(`[calendar:import] matched by UID: ${result.summary.matchedByUid}`);
    console.log(`[calendar:import] created: ${result.summary.created}`);
    console.log(`[calendar:import] updated: ${result.summary.updated}`);
    console.log(`[calendar:import] merged: ${result.summary.merged}`);
    console.log(`[calendar:import] skipped: ${result.summary.skipped}`);
    console.log(`[calendar:import] errors: ${result.summary.errors}`);
    console.log(
      `[calendar:import] recurring series imported: ${result.summary.recurringSeriesImported}`
    );
    console.log(`[calendar:import] overrides created: ${result.summary.overridesCreated}`);
    console.log(`[calendar:import] overrides updated: ${result.summary.overridesUpdated}`);
    console.log(
      `[calendar:import] cancellations applied: ${result.summary.cancellationsApplied}`
    );
    console.log(
      `[calendar:import] filters: range=${parsed.range} view=${parsed.viewName ?? "(none)"} mode=${parsed.mode} horizonDays=${String(parsed.horizonDays)}`
    );
    if (result.outputReportPath) {
      console.log(`[calendar:import] report: ${result.outputReportPath}`);
    }
    for (const warning of result.warnings ?? []) {
      console.log(`[calendar:import] warning: ${warning}`);
    }

    return result.hasErrors ? CLI_EXIT_CODE.TARGET_RESOLUTION : CLI_EXIT_CODE.SUCCESS;
  } catch (error: unknown) {
    if (error instanceof TadoiLockBusyError) {
      console.error("[calendar:import] failed: TADOI is running (lock present).");
      return CLI_EXIT_CODE.LOCKED;
    }
    if (error instanceof CalendarImportDomainError) {
      console.error(`[calendar:import] ${toErrorMessage(error)}`);
      return CLI_EXIT_CODE.TARGET_RESOLUTION;
    }
    if (error instanceof CalendarImportFilesystemError) {
      console.error(`[calendar:import] failed: ${toErrorMessage(error)}`);
      return CLI_EXIT_CODE.IO_ERROR;
    }
    if (error instanceof CalendarImportUsageError) {
      console.error(`[calendar:import] ${toErrorMessage(error)}`);
      return CLI_EXIT_CODE.PARSE_OR_VALIDATION;
    }
    console.error(`[calendar:import] failed: ${toErrorMessage(error)}`);
    return CLI_EXIT_CODE.IO_ERROR;
  }
}
