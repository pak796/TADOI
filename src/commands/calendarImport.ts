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
import { redactedLogger } from "../logging/redactedLogger";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function printCalendarImportHelp(): void {
  redactedLogger.log(`Usage: ${CLI_NAME} calendar:import --in <file.ics> [options]`);
  redactedLogger.log("");
  redactedLogger.log("Options:");
  redactedLogger.log("  --in <path>                  Input .ics path (required)");
  redactedLogger.log("  --view <name>                Saved view display name");
  redactedLogger.log("  --range <next7|month|all>    Date range (default: next7)");
  redactedLogger.log("  --mode <merge|update|create> Import mode (default: merge)");
  redactedLogger.log("  --horizon-days <n>           Recurrence expansion horizon (default: 365)");
  redactedLogger.log("  --dry-run                    Parse and plan without writing");
  redactedLogger.log("  --tag <value>                Tag to add on newly created tasks only");
  redactedLogger.log("  --report <path>              Write JSON import report");
  redactedLogger.log("  -h, --help                   Show calendar import help");
  redactedLogger.log("");
  redactedLogger.log("Notes:");
  redactedLogger.log("  - One-way import action only (no live sync).");
  redactedLogger.log("  - Identity precedence: X-TADOI-TASK-ID, then TADOI UID, then external UID.");
  redactedLogger.log("  - merge mode is conservative (tags/links union, notes append).");
  redactedLogger.log("  - RRULE must be valid for recurring series; recurrence expansion is bounded.");
  redactedLogger.log("");
  redactedLogger.log("Examples:");
  redactedLogger.log(`  ${CLI_NAME} calendar:import --in ./tadoi.ics --dry-run`);
  redactedLogger.log(
    `  ${CLI_NAME} calendar:import --in ./tadoi.ics --mode merge --range month --report ./import-report.json`
  );
  redactedLogger.log(
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
    redactedLogger.log(`[calendar:import] events parsed: ${result.summary.eventsParsed}${dryRunLabel}`);
    redactedLogger.log(
      `[calendar:import] matched by X-TADOI-TASK-ID: ${result.summary.matchedByTaskId}`
    );
    redactedLogger.log(`[calendar:import] matched by UID: ${result.summary.matchedByUid}`);
    redactedLogger.log(`[calendar:import] created: ${result.summary.created}`);
    redactedLogger.log(`[calendar:import] updated: ${result.summary.updated}`);
    redactedLogger.log(`[calendar:import] merged: ${result.summary.merged}`);
    redactedLogger.log(`[calendar:import] skipped: ${result.summary.skipped}`);
    redactedLogger.log(`[calendar:import] errors: ${result.summary.errors}`);
    redactedLogger.log(
      `[calendar:import] recurring series imported: ${result.summary.recurringSeriesImported}`
    );
    redactedLogger.log(`[calendar:import] overrides created: ${result.summary.overridesCreated}`);
    redactedLogger.log(`[calendar:import] overrides updated: ${result.summary.overridesUpdated}`);
    redactedLogger.log(
      `[calendar:import] cancellations applied: ${result.summary.cancellationsApplied}`
    );
    redactedLogger.log(
      `[calendar:import] filters: range=${parsed.range} view=${parsed.viewName ?? "(none)"} mode=${parsed.mode} horizonDays=${String(parsed.horizonDays)}`
    );
    if (result.outputReportPath) {
      redactedLogger.log(`[calendar:import] report: ${result.outputReportPath}`);
    }
    for (const warning of result.warnings ?? []) {
      redactedLogger.log(`[calendar:import] warning: ${warning}`);
    }

    return result.hasErrors ? CLI_EXIT_CODE.TARGET_RESOLUTION : CLI_EXIT_CODE.SUCCESS;
  } catch (error: unknown) {
    if (error instanceof TadoiLockBusyError) {
      redactedLogger.error("[calendar:import] failed: TADOI is running (lock present).");
      return CLI_EXIT_CODE.LOCKED;
    }
    if (error instanceof CalendarImportDomainError) {
      redactedLogger.error(`[calendar:import] ${toErrorMessage(error)}`);
      return CLI_EXIT_CODE.TARGET_RESOLUTION;
    }
    if (error instanceof CalendarImportFilesystemError) {
      redactedLogger.error(`[calendar:import] failed: ${toErrorMessage(error)}`);
      return CLI_EXIT_CODE.IO_ERROR;
    }
    if (error instanceof CalendarImportUsageError) {
      redactedLogger.error(`[calendar:import] ${toErrorMessage(error)}`);
      return CLI_EXIT_CODE.PARSE_OR_VALIDATION;
    }
    redactedLogger.error(`[calendar:import] failed: ${toErrorMessage(error)}`);
    return CLI_EXIT_CODE.IO_ERROR;
  }
}
