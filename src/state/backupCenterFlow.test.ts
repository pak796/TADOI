import { describe, expect, it } from "bun:test";
import {
  backupCenterReducer,
  hasMatchingCalendarImportDryRun,
  hasMatchingDryRun,
  isCalendarImportConfirmValid,
  initialBackupCenterState,
  isReplaceConfirmationValid,
  shouldRequireCalendarImportConfirm
} from "./backupCenterFlow";
import type { BackupImportSummary } from "./backupService";
import { buildCalendarImportFingerprint } from "./backupCenterCalendarController";

function makeSummary(mode: "merge" | "replace"): BackupImportSummary {
  return {
    mode,
    dryRun: true,
    schemaVersion: 4,
    resolvedDataPath: "/tmp/tadoi_data.json",
    tasks: {
      added: 1,
      updated: 2,
      unchanged: 3,
      removed: 4
    },
    conflictsResolvedByUpdatedAt: 0,
    savedViews: {
      added: 0,
      updated: 0,
      unchanged: 0
    },
    settings: {
      includedInImport: false,
      applied: false
    }
  };
}

function makeCalendarSummary() {
  return {
    eventsParsed: 12,
    matchedByTaskId: 4,
    matchedByUid: 2,
    created: 3,
    updated: 1,
    merged: 2,
    skipped: 0,
    errors: 0,
    recurringSeriesImported: 1,
    overridesCreated: 1,
    overridesUpdated: 0,
    cancellationsApplied: 0
  };
}

describe("backupCenterFlow", () => {
  it("enforces replace confirmation gate", () => {
    let state = backupCenterReducer(initialBackupCenterState, { type: "openImportPath" });
    state = backupCenterReducer(state, { type: "setImportPath", value: "./incoming.json" });
    state = backupCenterReducer(state, { type: "openImportMode" });
    state = backupCenterReducer(state, { type: "setImportMode", mode: "replace" });
    state = backupCenterReducer(state, { type: "openImportConfirm" });

    state = backupCenterReducer(state, { type: "setReplaceConfirmInput", value: "replace" });
    expect(isReplaceConfirmationValid(state)).toBe(false);
    state = backupCenterReducer(state, { type: "replaceConfirmRejected" });
    expect(state.screen).toBe("import_mode");
    expect(state.replaceConfirmed).toBe(false);

    state = backupCenterReducer(state, { type: "openImportConfirm" });
    state = backupCenterReducer(state, { type: "setReplaceConfirmInput", value: "REPLACE" });
    expect(isReplaceConfirmationValid(state)).toBe(true);
    state = backupCenterReducer(state, { type: "replaceConfirmAccepted" });
    expect(state.screen).toBe("import_mode");
    expect(state.replaceConfirmed).toBe(true);
  });

  it("blocks commit until matching dry-run exists", () => {
    let state = backupCenterReducer(initialBackupCenterState, { type: "openImportPath" });
    state = backupCenterReducer(state, { type: "setImportPath", value: "./incoming.json" });
    state = backupCenterReducer(state, { type: "openImportMode" });
    state = backupCenterReducer(state, { type: "setImportMode", mode: "merge" });

    const blocked = backupCenterReducer(state, { type: "startImporting" });
    expect(blocked.screen).toBe("import_mode");

    state = backupCenterReducer(state, {
      type: "dryRunSucceeded",
      summary: makeSummary("merge"),
      inputPath: "./incoming.json"
    });
    expect(hasMatchingDryRun(state)).toBe(true);

    const started = backupCenterReducer(state, { type: "startImporting" });
    expect(started.screen).toBe("importing");
  });

  it("invalidates stale dry-run when path or mode changes", () => {
    let state = backupCenterReducer(initialBackupCenterState, { type: "openImportPath" });
    state = backupCenterReducer(state, { type: "setImportPath", value: "./incoming.json" });
    state = backupCenterReducer(state, {
      type: "dryRunSucceeded",
      summary: makeSummary("merge"),
      inputPath: "./incoming.json"
    });

    expect(hasMatchingDryRun(state)).toBe(true);

    state = backupCenterReducer(state, { type: "setImportPath", value: "./other.json" });
    expect(hasMatchingDryRun(state)).toBe(false);
    expect(state.dryRun).toBeUndefined();

    state = backupCenterReducer(state, { type: "setImportPath", value: "./incoming.json" });
    state = backupCenterReducer(state, {
      type: "dryRunSucceeded",
      summary: makeSummary("merge"),
      inputPath: "./incoming.json"
    });
    state = backupCenterReducer(state, { type: "setImportMode", mode: "replace" });

    expect(state.dryRun).toBeUndefined();
    expect(hasMatchingDryRun(state)).toBe(false);
  });

  it("blocks calendar import commit until matching dry-run exists", () => {
    let state = backupCenterReducer(initialBackupCenterState, {
      type: "setCalendarImportPath",
      value: "./calendar.ics"
    });
    state = backupCenterReducer(state, { type: "setCalendarImportRange", range: "next7" });
    state = backupCenterReducer(state, { type: "setCalendarImportMode", mode: "merge" });
    state = backupCenterReducer(state, { type: "setCalendarImportHorizonInput", value: "365" });
    state = backupCenterReducer(state, { type: "setCalendarImportTagInput", value: "imported" });
    state = backupCenterReducer(state, { type: "setScreen", screen: "calendar_import_dryrun" });

    const blocked = backupCenterReducer(state, { type: "startCalendarImporting" });
    expect(blocked.screen).toBe("calendar_import_dryrun");

    const fingerprint = buildCalendarImportFingerprint({
      inputPath: "./calendar.ics",
      range: "next7",
      mode: "merge",
      horizonDays: 365,
      importTag: "imported"
    });
    state = backupCenterReducer(state, {
      type: "calendarImportDryRunSucceeded",
      summary: makeCalendarSummary(),
      hasErrors: false,
      errorReasons: [],
      fingerprint
    });
    expect(hasMatchingCalendarImportDryRun(state)).toBe(true);

    const started = backupCenterReducer(state, { type: "startCalendarImporting" });
    expect(started.screen).toBe("calendar_importing");
  });

  it("blocks calendar commit when dry-run has RRULE errors", () => {
    let state = backupCenterReducer(initialBackupCenterState, {
      type: "setCalendarImportPath",
      value: "./calendar.ics"
    });
    state = backupCenterReducer(state, { type: "setCalendarImportRange", range: "all" });
    state = backupCenterReducer(state, { type: "setCalendarImportMode", mode: "update" });
    state = backupCenterReducer(state, { type: "setCalendarImportHorizonInput", value: "365" });
    state = backupCenterReducer(state, { type: "setScreen", screen: "calendar_import_dryrun" });

    const fingerprint = buildCalendarImportFingerprint({
      inputPath: "./calendar.ics",
      range: "all",
      mode: "update",
      horizonDays: 365
    });
    state = backupCenterReducer(state, {
      type: "calendarImportDryRunSucceeded",
      summary: {
        ...makeCalendarSummary(),
        errors: 2
      },
      hasErrors: true,
      errorReasons: ["Invalid RRULE: FREQ=NOPE"],
      fingerprint
    });
    expect(shouldRequireCalendarImportConfirm(state)).toBe(true);

    const blocked = backupCenterReducer(state, { type: "startCalendarImporting" });
    expect(blocked.screen).toBe("calendar_import_dryrun");
  });

  it("requires IMPORT confirmation for update/all calendar imports", () => {
    let state = backupCenterReducer(initialBackupCenterState, {
      type: "setCalendarImportPath",
      value: "./calendar.ics"
    });
    state = backupCenterReducer(state, { type: "setCalendarImportRange", range: "all" });
    state = backupCenterReducer(state, { type: "setCalendarImportMode", mode: "update" });
    state = backupCenterReducer(state, { type: "setCalendarImportHorizonInput", value: "365" });
    state = backupCenterReducer(state, {
      type: "setCalendarImportConfirmInput",
      value: "IMPORT"
    });
    expect(isCalendarImportConfirmValid(state)).toBe(true);
  });

  it("stores and resets calendar import/export warnings across flow transitions", () => {
    let state = backupCenterReducer(initialBackupCenterState, {
      type: "calendarExportSucceeded",
      result: {
        outputPath: "/tmp/tadoi.ics",
        tasksScanned: 1,
        eventsWritten: 1,
        seriesRruleExported: 0,
        instanceOverridesExported: 0,
        exdateCount: 0,
        rangeApplied: "next7",
        privacyApplied: "minimal",
        timeContext: { mode: "tzid", timeZone: "UTC" }
      },
      warnings: ["settings fallback used"]
    });
    expect(state.calendarExportWarnings).toEqual(["settings fallback used"]);

    const fingerprint = buildCalendarImportFingerprint({
      inputPath: "./calendar.ics",
      range: "next7",
      mode: "merge",
      horizonDays: 365
    });
    state = backupCenterReducer(state, {
      type: "calendarImportDryRunSucceeded",
      summary: makeCalendarSummary(),
      hasErrors: false,
      errorReasons: [],
      fingerprint,
      warnings: ["report path unavailable"]
    });
    expect(state.calendarImportDryRunWarnings).toEqual(["report path unavailable"]);

    state = backupCenterReducer(state, {
      type: "calendarImportSucceeded",
      summary: makeCalendarSummary(),
      warnings: ["post-commit report write failed"]
    });
    expect(state.calendarImportCommittedWarnings).toEqual([
      "post-commit report write failed"
    ]);

    state = backupCenterReducer(state, {
      type: "setCalendarImportMode",
      mode: "update"
    });
    expect(state.calendarImportDryRunWarnings).toEqual([]);
    expect(state.calendarImportCommittedWarnings).toEqual([]);
  });
});
