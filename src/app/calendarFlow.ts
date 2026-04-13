import type React from "react";
import type { AppState } from "../domain/models";
import {
  hasMatchingCalendarImportDryRun,
  type BackupCenterScreen,
  type BackupCenterState,
} from "../state/backupCenterFlow";
import {
  buildDefaultCalendarImportReportPath,
  runCalendarExportFlow,
  runCalendarImportCommitFlow,
  runCalendarImportDryRunFlow,
} from "../state/backupCenterCalendarController";
import type { UIBackupFinalCheckpointModal } from "../ui/state";
import { loadSettings } from "../settings/settings";
import {
  parseCalendarImportHorizonOrThrow,
  resolveCalendarViewSelectionDigit,
} from "./backupCalendarOrchestration";

type CalendarFlowDeps = {
  backupState: BackupCenterState;
  backupDispatch: (action: any) => void;
  savedViews: AppState["savedViews"];
  calendarImportPathInputRef: React.MutableRefObject<string>;
  calendarImportRangeRef: React.MutableRefObject<
    BackupCenterState["calendarImportRange"]
  >;
  calendarImportModeRef: React.MutableRefObject<
    BackupCenterState["calendarImportMode"]
  >;
  calendarImportConfirmInputRef: React.MutableRefObject<string>;
  openBackupError: (
    message: string,
    error?: unknown,
    returnScreen?: BackupCenterScreen,
  ) => void;
  openBackupFinalCheckpoint: (
    checkpoint: UIBackupFinalCheckpointModal["checkpoint"],
    sourceScreen: BackupCenterScreen,
  ) => void;
  refreshRuntimeStateFromDisk: () => Promise<void>;
  openGitHubCloudStatus: () => void;
};

type CalendarFlowHandlers = {
  refreshCalendarTimeZoneHint: () => Promise<void>;
  runCalendarExportFromBackupCenter: () => void;
  runCalendarImportDryRunFromBackupCenter: () => void;
  runCalendarImportCommitFromBackupCenter: () => void;
  handleCalendarMenuSelect: (index: 0 | 1 | 2 | 3) => void;
  handleCalendarDigitSelection: (digit: number) => boolean;
  handleCalendarPrimaryAction: () => boolean;
};

export function useCalendarFlow(deps: CalendarFlowDeps): CalendarFlowHandlers {
  function resolveConfiguredCalendarTimeZone(
    settings: unknown,
  ): string | undefined {
    if (typeof settings !== "object" || settings === null) return undefined;
    const record = settings as Record<string, unknown>;
    const timeZone = record.timeZone ?? record.timezone;
    if (typeof timeZone !== "string") return undefined;
    const trimmed = timeZone.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  async function refreshCalendarTimeZoneHint() {
    try {
      const settingsResult = await loadSettings();
      const fromSettings = resolveConfiguredCalendarTimeZone(
        settingsResult.settings,
      );
      const fromSystem = Intl.DateTimeFormat().resolvedOptions().timeZone;
      deps.backupDispatch({
        type: "setCalendarTimeZoneHint",
        value: fromSettings ?? fromSystem ?? undefined,
      });
    } catch {
      const fromSystem = Intl.DateTimeFormat().resolvedOptions().timeZone;
      deps.backupDispatch({
        type: "setCalendarTimeZoneHint",
        value: fromSystem ?? undefined,
      });
    }
  }

  function runCalendarExportFromBackupCenter() {
    if (deps.backupState.screen === "calendar_exporting") return;
    deps.backupDispatch({ type: "startCalendarExport" });
    void (async () => {
      try {
        const result = await runCalendarExportFlow({
          range: deps.backupState.calendarExportRange,
          viewName: deps.backupState.calendarExportViewName,
          privacy: deps.backupState.calendarExportPrivacy,
          outputPathInput: deps.backupState.calendarExportPathInput,
        });
        deps.backupDispatch({
          type: "calendarExportSucceeded",
          result,
          warnings: result.warnings,
        });
      } catch (error: unknown) {
        deps.openBackupError(
          "Calendar export failed",
          error,
          "calendar_export_confirm",
        );
      }
    })();
  }

  function runCalendarImportDryRunFromBackupCenter() {
    const inputPath = (
      deps.calendarImportPathInputRef.current ||
      deps.backupState.calendarImportPathInput
    ).trim();
    const range = deps.calendarImportRangeRef.current;
    const mode = deps.calendarImportModeRef.current;
    if (!inputPath) {
      deps.openBackupError(
        "Calendar import path is required.",
        undefined,
        "calendar_import_path",
      );
      return;
    }

    let horizonDays = 0;
    try {
      horizonDays = parseCalendarImportHorizonOrThrow(
        deps.backupState.calendarImportHorizonInput,
      );
    } catch (error: unknown) {
      deps.openBackupError(
        "Invalid horizon days.",
        error,
        "calendar_import_horizon",
      );
      return;
    }

    deps.backupDispatch({ type: "startCalendarImportDryRun" });
    void (async () => {
      try {
        const reportPath = await buildDefaultCalendarImportReportPath({});
        const dryRun = await runCalendarImportDryRunFlow({
          inputPath,
          range,
          viewName: deps.backupState.calendarImportViewName,
          mode,
          horizonDays,
          importTag: deps.backupState.calendarImportTagInput,
          reportPath,
        });
        deps.backupDispatch({
          type: "calendarImportDryRunSucceeded",
          summary: dryRun.result.summary,
          hasErrors: dryRun.result.hasErrors,
          errorReasons: dryRun.errorReasons,
          fingerprint: dryRun.fingerprint,
          reportPath: dryRun.result.outputReportPath,
          warnings: dryRun.result.warnings,
        });
      } catch (error: unknown) {
        deps.openBackupError(
          "Calendar dry-run failed",
          error,
          "calendar_import_tag",
        );
      }
    })();
  }

  function runCalendarImportCommitFromBackupCenter() {
    const range = deps.calendarImportRangeRef.current;
    const mode = deps.calendarImportModeRef.current;
    const hasValidImportConfirmToken =
      deps.calendarImportConfirmInputRef.current.trim() === "IMPORT";
    if (!hasMatchingCalendarImportDryRun(deps.backupState)) {
      deps.openBackupError(
        "A matching dry-run is required before commit.",
        undefined,
        "calendar_import_dryrun",
      );
      return;
    }
    if (deps.backupState.calendarImportDryRunHasErrors) {
      deps.openBackupError(
        "Dry-run reported errors. Resolve errors before commit.",
        undefined,
        "calendar_import_dryrun",
      );
      return;
    }
    if ((mode === "update" || range === "all") && !hasValidImportConfirmToken) {
      deps.backupDispatch({
        type: "setScreen",
        screen: "calendar_import_confirm",
      });
      return;
    }

    let horizonDays = 0;
    try {
      horizonDays = parseCalendarImportHorizonOrThrow(
        deps.backupState.calendarImportHorizonInput,
      );
    } catch (error: unknown) {
      deps.openBackupError(
        "Invalid horizon days.",
        error,
        "calendar_import_horizon",
      );
      return;
    }

    deps.backupDispatch({ type: "startCalendarImporting" });
    void (async () => {
      try {
        const reportPath =
          deps.backupState.calendarImportDryRunReportPath ??
          (await buildDefaultCalendarImportReportPath({}));
        const commitResult = await runCalendarImportCommitFlow({
          inputPath: deps.backupState.calendarImportPathInput.trim(),
          range,
          viewName: deps.backupState.calendarImportViewName,
          mode,
          horizonDays,
          importTag: deps.backupState.calendarImportTagInput,
          reportPath,
        });
        deps.backupDispatch({
          type: "calendarImportSucceeded",
          summary: commitResult.result.summary,
          reportPath: commitResult.result.outputReportPath,
          backupPath: commitResult.backupPath,
          warnings: commitResult.result.warnings,
        });
        await deps.refreshRuntimeStateFromDisk();
      } catch (error: unknown) {
        deps.openBackupError(
          "Calendar import failed",
          error,
          "calendar_import_dryrun",
        );
      }
    })();
  }

  function handleCalendarMenuSelect(index: 0 | 1 | 2 | 3) {
    switch (index) {
      case 0:
        deps.backupDispatch({ type: "setCalendarExportRange", range: "next7" });
        deps.backupDispatch({
          type: "setCalendarExportViewName",
          viewName: undefined,
        });
        deps.backupDispatch({
          type: "setCalendarExportPrivacy",
          privacy: "minimal",
        });
        deps.backupDispatch({ type: "setCalendarExportPath", value: "" });
        void refreshCalendarTimeZoneHint();
        deps.backupDispatch({
          type: "setScreen",
          screen: "calendar_export_intro",
        });
        return;
      case 1:
        deps.backupDispatch({ type: "setCalendarImportPath", value: "" });
        deps.calendarImportPathInputRef.current = "";
        deps.backupDispatch({ type: "setCalendarImportRange", range: "next7" });
        deps.calendarImportRangeRef.current = "next7";
        deps.backupDispatch({
          type: "setCalendarImportViewName",
          viewName: undefined,
        });
        deps.backupDispatch({ type: "setCalendarImportMode", mode: "merge" });
        deps.calendarImportModeRef.current = "merge";
        deps.backupDispatch({
          type: "setCalendarImportHorizonInput",
          value: "365",
        });
        deps.backupDispatch({ type: "setCalendarImportTagInput", value: "" });
        deps.backupDispatch({
          type: "setCalendarImportConfirmInput",
          value: "",
        });
        deps.backupDispatch({
          type: "setScreen",
          screen: "calendar_import_intro",
        });
        return;
      case 2:
        deps.openGitHubCloudStatus();
        return;
      case 3:
        deps.backupDispatch({ type: "setScreen", screen: "menu" });
        return;
      default:
        return;
    }
  }

  function handleCalendarDigitSelection(digit: number): boolean {
    switch (deps.backupState.screen) {
      case "calendar_menu":
        if (digit >= 1 && digit <= 4) {
          const index = (digit - 1) as 0 | 1 | 2 | 3;
          deps.backupDispatch({ type: "setCalendarMenuIndex", index });
          handleCalendarMenuSelect(index);
        }
        return true;
      case "calendar_export_range":
        if (digit === 1)
          deps.backupDispatch({
            type: "setCalendarExportRange",
            range: "next7",
          });
        if (digit === 2)
          deps.backupDispatch({
            type: "setCalendarExportRange",
            range: "month",
          });
        if (digit === 3)
          deps.backupDispatch({ type: "setCalendarExportRange", range: "all" });
        return true;
      case "calendar_export_view": {
        const selected = resolveCalendarViewSelectionDigit(
          digit,
          deps.savedViews,
        );
        if (selected !== null) {
          deps.backupDispatch({
            type: "setCalendarExportViewName",
            viewName: selected,
          });
        }
        return true;
      }
      case "calendar_export_privacy":
        if (digit === 1)
          deps.backupDispatch({
            type: "setCalendarExportPrivacy",
            privacy: "minimal",
          });
        if (digit === 2)
          deps.backupDispatch({
            type: "setCalendarExportPrivacy",
            privacy: "full",
          });
        return true;
      case "calendar_import_range":
        if (digit === 1) {
          deps.calendarImportRangeRef.current = "next7";
          deps.backupDispatch({
            type: "setCalendarImportRange",
            range: "next7",
          });
        }
        if (digit === 2) {
          deps.calendarImportRangeRef.current = "month";
          deps.backupDispatch({
            type: "setCalendarImportRange",
            range: "month",
          });
        }
        if (digit === 3) {
          deps.calendarImportRangeRef.current = "all";
          deps.backupDispatch({ type: "setCalendarImportRange", range: "all" });
        }
        return true;
      case "calendar_import_view": {
        const selected = resolveCalendarViewSelectionDigit(
          digit,
          deps.savedViews,
        );
        if (selected !== null) {
          deps.backupDispatch({
            type: "setCalendarImportViewName",
            viewName: selected,
          });
        }
        return true;
      }
      case "calendar_import_mode":
        if (digit === 1) {
          deps.calendarImportModeRef.current = "merge";
          deps.backupDispatch({ type: "setCalendarImportMode", mode: "merge" });
        }
        if (digit === 2) {
          deps.calendarImportModeRef.current = "update";
          deps.backupDispatch({
            type: "setCalendarImportMode",
            mode: "update",
          });
        }
        if (digit === 3) {
          deps.calendarImportModeRef.current = "create";
          deps.backupDispatch({
            type: "setCalendarImportMode",
            mode: "create",
          });
        }
        return true;
      default:
        return false;
    }
  }

  function handleCalendarPrimaryAction(): boolean {
    switch (deps.backupState.screen) {
      case "calendar_menu":
        handleCalendarMenuSelect(deps.backupState.calendarMenuIndex);
        return true;
      case "calendar_export_done":
      case "calendar_import_done":
        deps.backupDispatch({ type: "setScreen", screen: "calendar_menu" });
        return true;
      case "calendar_export_intro":
        deps.backupDispatch({
          type: "setScreen",
          screen: "calendar_export_range",
        });
        return true;
      case "calendar_export_range":
        deps.backupDispatch({
          type: "setScreen",
          screen: "calendar_export_view",
        });
        return true;
      case "calendar_export_view":
        deps.backupDispatch({
          type: "setScreen",
          screen: "calendar_export_privacy",
        });
        return true;
      case "calendar_export_privacy":
        deps.backupDispatch({
          type: "setScreen",
          screen: "calendar_export_path",
        });
        return true;
      case "calendar_export_path":
        deps.backupDispatch({
          type: "setScreen",
          screen: "calendar_export_confirm",
        });
        return true;
      case "calendar_export_confirm":
        runCalendarExportFromBackupCenter();
        return true;
      case "calendar_import_intro":
        deps.backupDispatch({
          type: "setScreen",
          screen: "calendar_import_path",
        });
        return true;
      case "calendar_import_path":
        if (!deps.calendarImportPathInputRef.current.trim()) {
          deps.openBackupError(
            "Calendar import path is required.",
            undefined,
            "calendar_import_path",
          );
          return true;
        }
        deps.backupDispatch({
          type: "setScreen",
          screen: "calendar_import_range",
        });
        return true;
      case "calendar_import_range":
        deps.backupDispatch({
          type: "setScreen",
          screen: "calendar_import_view",
        });
        return true;
      case "calendar_import_view":
        deps.backupDispatch({
          type: "setScreen",
          screen: "calendar_import_mode",
        });
        return true;
      case "calendar_import_mode":
        deps.backupDispatch({
          type: "setScreen",
          screen: "calendar_import_horizon",
        });
        return true;
      case "calendar_import_horizon":
        try {
          parseCalendarImportHorizonOrThrow(
            deps.backupState.calendarImportHorizonInput,
          );
        } catch (error: unknown) {
          deps.openBackupError(
            "Invalid horizon days.",
            error,
            "calendar_import_horizon",
          );
          return true;
        }
        deps.backupDispatch({
          type: "setScreen",
          screen: "calendar_import_tag",
        });
        return true;
      case "calendar_import_tag":
        runCalendarImportDryRunFromBackupCenter();
        return true;
      case "calendar_import_dryrun": {
        if (
          !hasMatchingCalendarImportDryRun(deps.backupState) ||
          deps.backupState.calendarImportDryRunHasErrors
        ) {
          return true;
        }
        const shouldRequireConfirm =
          deps.calendarImportModeRef.current === "update" ||
          deps.calendarImportRangeRef.current === "all";
        if (
          shouldRequireConfirm &&
          deps.calendarImportConfirmInputRef.current.trim() !== "IMPORT"
        ) {
          deps.backupDispatch({
            type: "setScreen",
            screen: "calendar_import_confirm",
          });
          return true;
        }
        deps.openBackupFinalCheckpoint(
          "calendar_import",
          "calendar_import_dryrun",
        );
        return true;
      }
      case "calendar_import_confirm":
        if (deps.calendarImportConfirmInputRef.current.trim() !== "IMPORT") {
          deps.openBackupError(
            "Type IMPORT to confirm this high-impact import.",
            undefined,
            "calendar_import_confirm",
          );
          return true;
        }
        deps.openBackupFinalCheckpoint(
          "calendar_import",
          "calendar_import_confirm",
        );
        return true;
      case "calendar_exporting":
      case "calendar_import_dryrun_running":
      case "calendar_importing":
        return true;
      default:
        return false;
    }
  }

  return {
    refreshCalendarTimeZoneHint,
    runCalendarExportFromBackupCenter,
    runCalendarImportDryRunFromBackupCenter,
    runCalendarImportCommitFromBackupCenter,
    handleCalendarMenuSelect,
    handleCalendarDigitSelection,
    handleCalendarPrimaryAction,
  };
}

export type { CalendarFlowDeps, CalendarFlowHandlers };
