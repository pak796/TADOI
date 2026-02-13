import { CLI_NAME } from "../brand/brand";
import type { CalendarExportCommandOptions } from "../cli/calendarCommands";
import {
  CalendarExportFilesystemError,
  CalendarExportUsageError,
  exportCalendarIcs
} from "../state/calendarExportService";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function printCalendarExportHelp(): void {
  console.log(`Usage: ${CLI_NAME} calendar:export --out <file.ics> [options]`);
  console.log("");
  console.log("Options:");
  console.log("  --out <path>                 Output .ics path (required)");
  console.log("  --view <name>                Saved view display name");
  console.log("  --range <next7|month|all>    Date range (default: next7)");
  console.log("  --privacy <minimal|full>     Export metadata detail (default: minimal)");
  console.log("  --include-details            Compatibility alias for --privacy=full");
  console.log("  -h, --help                   Show calendar export help");
  console.log("");
  console.log("Notes:");
  console.log("  - Exports open tasks only (done/archived excluded).");
  console.log("  - Privacy default is minimal (no notes/tags/links/url in output).");
  console.log("  - next7 uses rolling local days: today..+6.");
  console.log("  - Recurring series export RRULE + EXDATE when valid.");
  console.log("  - Invalid RRULE in --range all returns an error.");
  console.log("  - One-way export only (no calendar sync/import).");
  console.log("");
  console.log("Examples:");
  console.log(`  ${CLI_NAME} calendar:export --out ./tadoi.ics`);
  console.log(
    `  ${CLI_NAME} calendar:export --out ~/Downloads/tadoi.ics --view Work --range month`
  );
  console.log(`  ${CLI_NAME} calendar:export --out ./tadoi.ics --range all`);
}

export async function runCalendarExportCommand(
  parsed: CalendarExportCommandOptions
): Promise<number> {
  if (parsed.help) {
    printCalendarExportHelp();
    return 0;
  }

  try {
    const result = await exportCalendarIcs({
      outputPath: parsed.outPath,
      viewName: parsed.viewName,
      range: parsed.range,
      privacy: parsed.privacy
    });

    console.log(`[calendar:export] wrote: ${result.outputPath}`);
    console.log(`[calendar:export] tasks scanned: ${result.tasksScanned}`);
    console.log(`[calendar:export] events written: ${result.eventsWritten}`);
    console.log(
      `[calendar:export] series RRULE exported: ${result.seriesRruleExported}`
    );
    console.log(
      `[calendar:export] instance overrides exported: ${result.instanceOverridesExported}`
    );
    console.log(`[calendar:export] EXDATE count: ${result.exdateCount}`);
    console.log(
      `[calendar:export] filters: range=${result.rangeApplied} view=${result.viewApplied ?? "(none)"}`
    );
    console.log(`[calendar:export] privacy: ${result.privacyApplied}`);
    if (result.timeContext.mode === "tzid") {
      console.log(`[calendar:export] timezone: ${result.timeContext.timeZone}`);
    } else {
      console.log("[calendar:export] timezone: UTC (fallback)");
    }
    for (const warning of result.warnings ?? []) {
      console.log(`[calendar:export] warning: ${warning}`);
    }
    return 0;
  } catch (error: unknown) {
    if (error instanceof CalendarExportFilesystemError) {
      console.error(`[calendar:export] failed: ${toErrorMessage(error)}`);
      return 2;
    }
    if (error instanceof CalendarExportUsageError) {
      console.error(`[calendar:export] ${toErrorMessage(error)}`);
      return 1;
    }
    console.error(`[calendar:export] failed: ${toErrorMessage(error)}`);
    return 1;
  }
}
