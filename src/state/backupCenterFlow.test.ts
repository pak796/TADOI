import { describe, expect, it } from "bun:test";
import {
  backupCenterReducer,
  hasMatchingDryRun,
  initialBackupCenterState,
  isReplaceConfirmationValid
} from "./backupCenterFlow";
import type { BackupImportSummary } from "./backupService";

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
});
