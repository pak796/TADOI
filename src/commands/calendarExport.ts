import { CLI_NAME } from "../brand/brand";
import type { CalendarExportCommandOptions } from "../cli/calendarCommands";
import {
  CalendarExportDomainError,
  CalendarExportFilesystemError,
  CalendarExportUsageError,
  exportCalendarIcs,
} from "../state/calendarExportService";
import { CLI_EXIT_CODE } from "../cli/exitCodes";
import { redactedLogger } from "../logging/redactedLogger";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function printCalendarExportHelp(): void {
  redactedLogger.log(
    `Usage: ${CLI_NAME} calendar:export --out <file.ics> [options]`,
  );
  redactedLogger.log("");
  redactedLogger.log("Options:");
  redactedLogger.log(
    "  --out <path>                 Output .ics path (required)",
  );
  redactedLogger.log("  --view <name>                Saved view display name");
  redactedLogger.log(
    "  --range <next7|month|all>    Date range (default: next7)",
  );
  redactedLogger.log(
    "  --privacy <minimal|full>     Export metadata detail (default: minimal)",
  );
  redactedLogger.log(
    "  --include-details            Compatibility alias for --privacy=full",
  );
  redactedLogger.log(
    "  -h, --help                   Show calendar export help",
  );
  redactedLogger.log("");
  redactedLogger.log("Notes:");
  redactedLogger.log("  - Exports open tasks only (done/archived excluded).");
  redactedLogger.log(
    "  - Privacy default is minimal (no notes/tags/links/url in output).",
  );
  redactedLogger.log("  - next7 uses rolling local days: today..+6.");
  redactedLogger.log("  - Recurring series export RRULE + EXDATE when valid.");
  redactedLogger.log("  - Invalid RRULE in --range all returns an error.");
  redactedLogger.log("  - One-way export only (no calendar sync/import).");
  redactedLogger.log("");
  redactedLogger.log("Examples:");
  redactedLogger.log(`  ${CLI_NAME} calendar:export --out ./tadoi.ics`);
  redactedLogger.log(
    `  ${CLI_NAME} calendar:export --out ~/Downloads/tadoi.ics --view Work --range month`,
  );
  redactedLogger.log(
    `  ${CLI_NAME} calendar:export --out ./tadoi.ics --range all`,
  );
}

export async function runCalendarExportCommand(
  parsed: CalendarExportCommandOptions,
): Promise<number> {
  if (parsed.help) {
    printCalendarExportHelp();
    return CLI_EXIT_CODE.SUCCESS;
  }

  try {
    const result = await exportCalendarIcs({
      outputPath: parsed.outPath,
      viewName: parsed.viewName,
      range: parsed.range,
      privacy: parsed.privacy,
    });

    redactedLogger.log(`[calendar:export] wrote: ${result.outputPath}`);
    redactedLogger.log(
      `[calendar:export] tasks scanned: ${result.tasksScanned}`,
    );
    redactedLogger.log(
      `[calendar:export] events written: ${result.eventsWritten}`,
    );
    redactedLogger.log(
      `[calendar:export] series RRULE exported: ${result.seriesRruleExported}`,
    );
    redactedLogger.log(
      `[calendar:export] instance overrides exported: ${result.instanceOverridesExported}`,
    );
    redactedLogger.log(`[calendar:export] EXDATE count: ${result.exdateCount}`);
    redactedLogger.log(
      `[calendar:export] filters: range=${result.rangeApplied} view=${result.viewApplied ?? "(none)"}`,
    );
    redactedLogger.log(`[calendar:export] privacy: ${result.privacyApplied}`);
    if (result.timeContext.mode === "tzid") {
      redactedLogger.log(
        `[calendar:export] timezone: ${result.timeContext.timeZone}`,
      );
    } else {
      redactedLogger.log("[calendar:export] timezone: UTC (fallback)");
    }
    for (const warning of result.warnings ?? []) {
      redactedLogger.log(`[calendar:export] warning: ${warning}`);
    }
    return CLI_EXIT_CODE.SUCCESS;
  } catch (error: unknown) {
    if (error instanceof CalendarExportDomainError) {
      redactedLogger.error(`[calendar:export] ${toErrorMessage(error)}`);
      return CLI_EXIT_CODE.TARGET_RESOLUTION;
    }
    if (error instanceof CalendarExportFilesystemError) {
      redactedLogger.error(
        `[calendar:export] failed: ${toErrorMessage(error)}`,
      );
      return CLI_EXIT_CODE.IO_ERROR;
    }
    if (error instanceof CalendarExportUsageError) {
      redactedLogger.error(`[calendar:export] ${toErrorMessage(error)}`);
      return CLI_EXIT_CODE.PARSE_OR_VALIDATION;
    }
    redactedLogger.error(`[calendar:export] failed: ${toErrorMessage(error)}`);
    return CLI_EXIT_CODE.IO_ERROR;
  }
}
