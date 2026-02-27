import { describe, expect, it } from "bun:test";
import {
  BACKUP_IMPORT_PICKER_MAX_VISIBLE_ROWS,
  backupCenterReducer,
  hasMatchingCalendarImportDryRun,
  hasMatchingDryRun,
  isCalendarImportConfirmValid,
  initialBackupCenterState,
  isReplaceConfirmationValid,
  shouldRequireCalendarImportConfirm
} from "./backupCenterFlow";
import type { BackupFileInfo, BackupImportSummary } from "./backupService";
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

function makeBackupFile(
  filename: string,
  mtimeMs: number,
  sizeBytes: number
): BackupFileInfo {
  return {
    path: `/tmp/backups/${filename}`,
    filename,
    mtimeMs,
    sizeBytes
  };
}

describe("backupCenterFlow", () => {
  it("loads picker files, keeps selection visible, and confirms selected path", () => {
    const files = [
      makeBackupFile("tadoi-backup-20260210-000001.json", 3, 120),
      makeBackupFile("tadoi-backup-20260209-000001.json", 2, 118),
      makeBackupFile("tadoi-backup-20260208-000001.json", 1, 110),
      makeBackupFile("tadoi-backup-20260207-000001.json", 0, 108)
    ];
    let state = backupCenterReducer(initialBackupCenterState, {
      type: "openImportPicker",
      directoryPath: "/tmp/backups"
    });
    expect(state.screen).toBe("import_picker");
    expect(state.importPickerLoading).toBe(true);

    state = backupCenterReducer(state, {
      type: "loadImportPickerFilesSuccess",
      directoryPath: "/tmp/backups",
      files
    });
    expect(state.importPickerFiles).toHaveLength(4);
    expect(state.importPickerSelectedIndex).toBe(0);
    expect(state.importPickerScrollOffset).toBe(0);
    expect(state.importPickerLoading).toBe(false);

    state = backupCenterReducer(state, {
      type: "moveImportPickerSelection",
      delta: 1,
      visibleRows: 2
    });
    expect(state.importPickerSelectedIndex).toBe(1);
    expect(state.importPickerScrollOffset).toBe(0);

    state = backupCenterReducer(state, {
      type: "moveImportPickerSelection",
      delta: 1,
      visibleRows: 2
    });
    expect(state.importPickerSelectedIndex).toBe(2);
    expect(state.importPickerScrollOffset).toBe(1);

    state = backupCenterReducer(state, {
      type: "pageImportPickerSelection",
      delta: 1,
      visibleRows: 2
    });
    expect(state.importPickerSelectedIndex).toBe(3);
    expect(state.importPickerScrollOffset).toBe(2);

    state = backupCenterReducer(state, {
      type: "confirmImportPickerSelection"
    });
    expect(state.screen).toBe("import_mode");
    expect(state.importPathInput).toBe(files[3]?.path);
  });

  it("supports picker back-stack and manual path fallback", () => {
    let state = backupCenterReducer(initialBackupCenterState, {
      type: "openImportPicker",
      directoryPath: "/tmp/backups"
    });
    state = backupCenterReducer(state, { type: "openImportPathManual" });
    expect(state.screen).toBe("import_path");

    state = backupCenterReducer(state, { type: "back" });
    expect(state.screen).toBe("import_picker");

    state = backupCenterReducer(state, {
      type: "loadImportPickerFilesSuccess",
      directoryPath: "/tmp/backups",
      files: [makeBackupFile("tadoi-backup-20260210-000001.json", 1, 100)]
    });
    state = backupCenterReducer(state, { type: "confirmImportPickerSelection" });
    expect(state.screen).toBe("import_mode");

    state = backupCenterReducer(state, { type: "back" });
    expect(state.screen).toBe("import_picker");

    state = backupCenterReducer(state, { type: "back" });
    expect(state.screen).toBe("menu");
  });

  it("clamps picker jumps and ignores selection actions outside picker screen", () => {
    let state = backupCenterReducer(initialBackupCenterState, {
      type: "moveImportPickerSelection",
      delta: 1,
      visibleRows: BACKUP_IMPORT_PICKER_MAX_VISIBLE_ROWS
    });
    expect(state).toEqual(initialBackupCenterState);

    state = backupCenterReducer(initialBackupCenterState, {
      type: "openImportPicker",
      directoryPath: "/tmp/backups"
    });
    state = backupCenterReducer(state, {
      type: "loadImportPickerFilesSuccess",
      directoryPath: "/tmp/backups",
      files: [makeBackupFile("tadoi-backup-20260210-000001.json", 3, 120)]
    });
    state = backupCenterReducer(state, {
      type: "jumpImportPickerSelection",
      target: "end",
      visibleRows: 6
    });
    expect(state.importPickerSelectedIndex).toBe(0);
    expect(state.importPickerScrollOffset).toBe(0);
  });

  it("clamps picker movement at bounds and no-ops when already at edge", () => {
    const files = [
      makeBackupFile("tadoi-backup-20260210-000001.json", 3, 120),
      makeBackupFile("tadoi-backup-20260209-000001.json", 2, 118),
      makeBackupFile("tadoi-backup-20260208-000001.json", 1, 110)
    ];

    let state = backupCenterReducer(initialBackupCenterState, {
      type: "openImportPicker",
      directoryPath: "/tmp/backups"
    });
    state = backupCenterReducer(state, {
      type: "loadImportPickerFilesSuccess",
      directoryPath: "/tmp/backups",
      files
    });

    const topNoOp = backupCenterReducer(state, {
      type: "moveImportPickerSelection",
      delta: -1,
      visibleRows: 2
    });
    expect(topNoOp.importPickerSelectedIndex).toBe(0);
    expect(topNoOp.importPickerScrollOffset).toBe(0);

    state = backupCenterReducer(topNoOp, {
      type: "moveImportPickerSelection",
      delta: 1,
      visibleRows: 2
    });
    state = backupCenterReducer(state, {
      type: "moveImportPickerSelection",
      delta: 1,
      visibleRows: 2
    });
    expect(state.importPickerSelectedIndex).toBe(2);
    expect(state.importPickerScrollOffset).toBe(1);

    const bottomNoOp = backupCenterReducer(state, {
      type: "moveImportPickerSelection",
      delta: 1,
      visibleRows: 2
    });
    expect(bottomNoOp.importPickerSelectedIndex).toBe(2);
    expect(bottomNoOp.importPickerScrollOffset).toBe(1);
  });

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

  it("stores github repo visibility status for warning display", () => {
    let state = backupCenterReducer(initialBackupCenterState, {
      type: "setGitHubStatus",
      ghDetected: true,
      loggedIn: true,
      username: "patrick",
      ownerRepoConfigured: "patrick/tadoi-backups",
      repoIsPublic: true,
      autoPushPolicy: "off",
      lastPushedAt: "2026-02-27T12:00:00.000Z",
      lastRestorePulledAt: "2026-02-27T11:00:00.000Z"
    });
    expect(state.githubRepoIsPublic).toBe(true);

    state = backupCenterReducer(state, {
      type: "setGitHubStatus",
      ghDetected: true,
      loggedIn: true,
      username: "patrick",
      ownerRepoConfigured: "patrick/tadoi-backups",
      repoIsPublic: false,
      autoPushPolicy: "off"
    });
    expect(state.githubRepoIsPublic).toBe(false);
  });

  it("handles github restore picker selection and restore transitions", () => {
    const snapshots = [
      {
        id: "snap-1",
        timestamp: "20260227-101500Z",
        tasksOpen: 4,
        tasksTotal: 10
      },
      {
        id: "snap-2",
        timestamp: "20260227-091500Z",
        tasksOpen: 5,
        tasksTotal: 11
      },
      {
        id: "snap-3",
        timestamp: "20260227-081500Z",
        tasksOpen: 6,
        tasksTotal: 12
      }
    ];

    let state = backupCenterReducer(initialBackupCenterState, { type: "openGitHubStatus" });
    expect(state.screen).toBe("github_status");

    state = backupCenterReducer(state, { type: "startGitHubRestoreLoad" });
    expect(state.screen).toBe("github_restore_loading");
    expect(state.githubSnapshotLoading).toBe(true);

    state = backupCenterReducer(state, {
      type: "githubRestoreLoadSucceeded",
      snapshots
    });
    expect(state.screen).toBe("github_restore_picker");
    expect(state.githubSnapshots).toHaveLength(3);
    expect(state.githubSnapshotSelectedIndex).toBe(0);

    state = backupCenterReducer(state, {
      type: "moveGitHubSnapshotSelection",
      delta: 1,
      visibleRows: 2
    });
    expect(state.githubSnapshotSelectedIndex).toBe(1);
    expect(state.githubSnapshotScrollOffset).toBe(0);

    state = backupCenterReducer(state, {
      type: "moveGitHubSnapshotSelection",
      delta: 1,
      visibleRows: 2
    });
    expect(state.githubSnapshotSelectedIndex).toBe(2);
    expect(state.githubSnapshotScrollOffset).toBe(1);

    state = backupCenterReducer(state, {
      type: "jumpGitHubSnapshotSelection",
      target: "start",
      visibleRows: 2
    });
    expect(state.githubSnapshotSelectedIndex).toBe(0);
    expect(state.githubSnapshotScrollOffset).toBe(0);

    state = backupCenterReducer(state, { type: "startGitHubRestoreDownload" });
    expect(state.screen).toBe("github_restore_downloading");

    state = backupCenterReducer(state, {
      type: "githubRestoreDownloadSucceeded",
      timestamp: "2026-02-27T10:30:00.000Z"
    });
    expect(state.screen).toBe("github_status");
    expect(state.githubLastRestorePulledAt).toBe("2026-02-27T10:30:00.000Z");
    expect(state.githubSelectedSnapshotTimestamp).toBe("2026-02-27T10:30:00.000Z");
  });

  it("keeps github back-graph transitions consistent", () => {
    let state = backupCenterReducer(initialBackupCenterState, {
      type: "setScreen",
      screen: "calendar_menu"
    });
    state = backupCenterReducer(state, { type: "openGitHubStatus" });
    expect(state.screen).toBe("github_status");

    state = backupCenterReducer(state, { type: "back" });
    expect(state.screen).toBe("calendar_menu");

    state = backupCenterReducer(state, { type: "openGitHubStatus" });
    state = backupCenterReducer(state, { type: "openGitHubConnectMode" });
    expect(state.screen).toBe("github_connect_mode");

    state = backupCenterReducer(state, { type: "setScreen", screen: "github_connect_repo_input" });
    state = backupCenterReducer(state, { type: "back" });
    expect(state.screen).toBe("github_connect_mode");

    state = backupCenterReducer(state, {
      type: "setScreen",
      screen: "github_connect_public_confirm"
    });
    state = backupCenterReducer(state, { type: "setGitHubPublicConfirmInput", value: "PUBLIC" });
    state = backupCenterReducer(state, { type: "back" });
    expect(state.screen).toBe("github_connect_repo_input");
    expect(state.githubPublicConfirmInput).toBe("");

    state = backupCenterReducer(state, { type: "setScreen", screen: "github_restore_picker" });
    state = backupCenterReducer(state, { type: "back" });
    expect(state.screen).toBe("github_status");

    state = backupCenterReducer(state, { type: "setScreen", screen: "github_connecting" });
    const noOpWhileRunning = backupCenterReducer(state, { type: "back" });
    expect(noOpWhileRunning.screen).toBe("github_connecting");
  });
});
