import { describe, expect, it } from "bun:test";
import os from "os";
import path from "path";
import {
  collectTopCalendarImportErrorReasons,
  runCalendarExportFlow,
  runCalendarImportCommitFlow,
  runCalendarImportDryRunFlow
} from "./backupCenterCalendarController";

function makeCalendarImportResult() {
  return {
    summary: {
      eventsParsed: 6,
      matchedByTaskId: 2,
      matchedByUid: 1,
      created: 1,
      updated: 1,
      merged: 2,
      skipped: 0,
      errors: 0,
      recurringSeriesImported: 1,
      overridesCreated: 1,
      overridesUpdated: 0,
      cancellationsApplied: 0
    },
    report: {
      generatedAt: "2026-02-12T00:00:00.000Z",
      inputPath: "/tmp/in.ics",
      range: "next7" as const,
      mode: "merge" as const,
      dryRun: true,
      horizonDays: 365,
      summary: {
        eventsParsed: 6,
        matchedByTaskId: 2,
        matchedByUid: 1,
        created: 1,
        updated: 1,
        merged: 2,
        skipped: 0,
        errors: 0,
        recurringSeriesImported: 1,
        overridesCreated: 1,
        overridesUpdated: 0,
        cancellationsApplied: 0
      },
      entries: [] as Array<{
        uid?: string;
        recurrenceId?: string;
        action: "created" | "updated" | "merged" | "skipped" | "error" | "cancelled";
        match?: "x-task-id" | "uid" | "external-uid" | "none";
        taskId?: string;
        message?: string;
        conflicts?: string[];
      }>,
      persisted: false
    },
    hasErrors: false,
    outputReportPath: "/tmp/report.json"
  };
}

describe("backupCenterCalendarController", () => {
  it("routes calendar export flow into exportCalendarIcs with expected args", async () => {
    let captured:
      | {
          outputPath: string;
          range?: "next7" | "month" | "all";
          viewName?: string;
          privacy?: "minimal" | "full";
        }
      | undefined;
    const tempDir = os.tmpdir();

    const result = await runCalendarExportFlow(
      {
        range: "month",
        viewName: "Work",
        privacy: "full",
        outputPathInput: "./calendar-export",
        cwd: tempDir
      },
      {
        exportCalendar: async (options) => {
          captured = {
            outputPath: options.outputPath,
            range: options.range,
            viewName: options.viewName,
            privacy: options.privacy
          };
          return {
            outputPath: options.outputPath,
            tasksScanned: 10,
            eventsWritten: 9,
            seriesRruleExported: 2,
            instanceOverridesExported: 1,
            exdateCount: 3,
            rangeApplied: options.range ?? "next7",
            privacyApplied: options.privacy ?? "minimal",
            viewApplied: options.viewName,
            timeContext: {
              mode: "tzid",
              timeZone: "America/Chicago"
            }
          };
        }
      }
    );

    expect(captured).toBeDefined();
    expect(captured?.range).toBe("month");
    expect(captured?.viewName).toBe("Work");
    expect(captured?.privacy).toBe("full");
    expect(captured?.outputPath.endsWith(".ics")).toBe(true);
    expect(result.eventsWritten).toBe(9);
  });

  it("passes calendar import mode through dry-run and preserves override summary counts", async () => {
    let capturedMode: string | undefined;
    const result = makeCalendarImportResult();
    result.summary.overridesCreated = 2;
    result.report.summary.overridesCreated = 2;
    result.report.entries.push(
      { action: "error", message: "Invalid RRULE: FREQ=NOPE" },
      { action: "error", message: "Invalid RRULE: FREQ=NOPE" },
      { action: "error", message: "Unable to resolve base recurring series for override" }
    );
    result.hasErrors = true;

    const dryRun = await runCalendarImportDryRunFlow(
      {
        inputPath: "./incoming.ics",
        range: "all",
        mode: "create",
        horizonDays: 365
      },
      {
        importCalendar: async (options) => {
          capturedMode = options.mode;
          return result;
        }
      }
    );

    expect(capturedMode).toBe("create");
    expect(dryRun.result.summary.overridesCreated).toBe(2);
    expect(dryRun.errorReasons[0]).toContain("Invalid RRULE");
    expect(
      collectTopCalendarImportErrorReasons(result.report)[0]
    ).toContain("Invalid RRULE");
  });

  it("creates a pre-import backup before calendar commit", async () => {
    let backupCreated = false;
    let importCalledAfterBackup = false;
    const result = makeCalendarImportResult();
    result.report.dryRun = false;

    const committed = await runCalendarImportCommitFlow(
      {
        inputPath: "./incoming.ics",
        range: "next7",
        mode: "merge",
        horizonDays: 365,
        importTag: "imported"
      },
      {
        resolveDataPath: () => "/tmp/tadoi_data.json",
        createBackup: async () => {
          backupCreated = true;
          return "/tmp/tadoi_data.json.backup.20260212-000000";
        },
        importCalendar: async () => {
          importCalledAfterBackup = backupCreated;
          return {
            ...result,
            hasErrors: false
          };
        }
      }
    );

    expect(backupCreated).toBe(true);
    expect(importCalledAfterBackup).toBe(true);
    expect(committed.backupPath).toContain(".backup.");
  });
});
