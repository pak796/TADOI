import type { CalendarEventPrivacyMode } from "../calendar/calendarMapper";
import type { CalendarImportMode } from "../calendar/importMapper";
import type { CalendarExportRange } from "../calendar/range";
import type { BackupImportSummary } from "./backupService";
import type { CalendarExportResult } from "./calendarExportService";
import type { CalendarImportSummary } from "./calendarImportService";
import type { ImportMode } from "./portability";

export type BackupCenterScreen =
  | "menu"
  | "exporting"
  | "export_done"
  | "import_path"
  | "import_mode"
  | "import_confirm"
  | "import_dryrun"
  | "importing"
  | "import_done"
  | "show_path"
  | "calendar_menu"
  | "calendar_export_intro"
  | "calendar_export_range"
  | "calendar_export_view"
  | "calendar_export_privacy"
  | "calendar_export_path"
  | "calendar_export_confirm"
  | "calendar_exporting"
  | "calendar_export_done"
  | "calendar_import_intro"
  | "calendar_import_path"
  | "calendar_import_range"
  | "calendar_import_view"
  | "calendar_import_mode"
  | "calendar_import_horizon"
  | "calendar_import_tag"
  | "calendar_import_dryrun_running"
  | "calendar_import_dryrun"
  | "calendar_import_confirm"
  | "calendar_importing"
  | "calendar_import_done"
  | "error";

type MainMenuIndex = 0 | 1 | 2 | 3;
type CalendarMenuIndex = 0 | 1 | 2;

export type BackupCenterState = {
  screen: BackupCenterScreen;
  menuIndex: MainMenuIndex;
  calendarMenuIndex: CalendarMenuIndex;

  // DATA (JSON portability) flow state.
  importPathInput: string;
  importMode: ImportMode;
  replaceConfirmInput: string;
  replaceConfirmed: boolean;
  lastExportPath?: string;
  dryRun?: BackupImportSummary;
  dryRunInputPath?: string;
  committed?: BackupImportSummary;
  shownDataPath?: string;

  // CALENDAR export state.
  calendarTimeZoneHint?: string;
  calendarExportRange: CalendarExportRange;
  calendarExportViewName?: string;
  calendarExportPrivacy: CalendarEventPrivacyMode;
  calendarExportPathInput: string;
  calendarExportResult?: CalendarExportResult;

  // CALENDAR import state.
  calendarImportPathInput: string;
  calendarImportRange: CalendarExportRange;
  calendarImportViewName?: string;
  calendarImportMode: CalendarImportMode;
  calendarImportHorizonInput: string;
  calendarImportTagInput: string;
  calendarImportDryRun?: CalendarImportSummary;
  calendarImportDryRunHasErrors: boolean;
  calendarImportDryRunErrorReasons: string[];
  calendarImportDryRunReportPath?: string;
  calendarImportDryRunFingerprint?: string;
  calendarImportCommitted?: CalendarImportSummary;
  calendarImportCommittedReportPath?: string;
  calendarImportCommittedBackupPath?: string;
  calendarImportConfirmInput: string;

  errorMessage?: string;
  errorDetail?: string;
  errorReturnScreen?: BackupCenterScreen;
};

export type BackupCenterAction =
  | { type: "reset" }
  | { type: "openMenu" }
  | { type: "setScreen"; screen: BackupCenterScreen }
  | { type: "moveMenuIndex"; delta: 1 | -1 }
  | { type: "setMenuIndex"; index: MainMenuIndex }
  | { type: "moveCalendarMenuIndex"; delta: 1 | -1 }
  | { type: "setCalendarMenuIndex"; index: CalendarMenuIndex }
  | { type: "startExport" }
  | { type: "exportSucceeded"; outputPath: string }
  | { type: "openImportPath" }
  | { type: "setImportPath"; value: string }
  | { type: "openImportMode" }
  | { type: "setImportMode"; mode: ImportMode }
  | { type: "openImportConfirm" }
  | { type: "setReplaceConfirmInput"; value: string }
  | { type: "replaceConfirmAccepted" }
  | { type: "replaceConfirmRejected" }
  | { type: "dryRunSucceeded"; summary: BackupImportSummary; inputPath: string }
  | { type: "startImporting" }
  | { type: "importSucceeded"; summary: BackupImportSummary }
  | { type: "showDataPath"; path: string }
  | { type: "setCalendarTimeZoneHint"; value: string | undefined }
  | { type: "setCalendarExportRange"; range: CalendarExportRange }
  | { type: "setCalendarExportViewName"; viewName?: string }
  | { type: "setCalendarExportPrivacy"; privacy: CalendarEventPrivacyMode }
  | { type: "setCalendarExportPath"; value: string }
  | { type: "startCalendarExport" }
  | { type: "calendarExportSucceeded"; result: CalendarExportResult }
  | { type: "setCalendarImportPath"; value: string }
  | { type: "setCalendarImportRange"; range: CalendarExportRange }
  | { type: "setCalendarImportViewName"; viewName?: string }
  | { type: "setCalendarImportMode"; mode: CalendarImportMode }
  | { type: "setCalendarImportHorizonInput"; value: string }
  | { type: "setCalendarImportTagInput"; value: string }
  | { type: "setCalendarImportConfirmInput"; value: string }
  | { type: "startCalendarImportDryRun" }
  | {
      type: "calendarImportDryRunSucceeded";
      summary: CalendarImportSummary;
      hasErrors: boolean;
      errorReasons: string[];
      fingerprint: string;
      reportPath?: string;
    }
  | { type: "startCalendarImporting" }
  | {
      type: "calendarImportSucceeded";
      summary: CalendarImportSummary;
      reportPath?: string;
      backupPath?: string;
    }
  | { type: "setError"; message: string; detail?: string; returnScreen?: BackupCenterScreen }
  | { type: "back" };

export const initialBackupCenterState: BackupCenterState = {
  screen: "menu",
  menuIndex: 0,
  calendarMenuIndex: 0,
  importPathInput: "",
  importMode: "merge",
  replaceConfirmInput: "",
  replaceConfirmed: false,
  calendarExportRange: "next7",
  calendarExportPrivacy: "minimal",
  calendarExportPathInput: "",
  calendarImportPathInput: "",
  calendarImportRange: "next7",
  calendarImportMode: "merge",
  calendarImportHorizonInput: "365",
  calendarImportTagInput: "",
  calendarImportDryRunHasErrors: false,
  calendarImportDryRunErrorReasons: [],
  calendarImportConfirmInput: ""
};

function normalizeOptionalInput(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toCalendarImportFingerprint(state: BackupCenterState): string | undefined {
  const inputPath = normalizeOptionalInput(state.calendarImportPathInput);
  if (!inputPath) return undefined;
  const horizon = Number.parseInt(state.calendarImportHorizonInput.trim(), 10);
  if (!Number.isFinite(horizon) || horizon <= 0) return undefined;
  return JSON.stringify({
    inputPath,
    range: state.calendarImportRange,
    viewName: normalizeOptionalInput(state.calendarImportViewName),
    mode: state.calendarImportMode,
    horizonDays: horizon,
    importTag: normalizeOptionalInput(state.calendarImportTagInput)
  });
}

export function isReplaceConfirmationValid(state: BackupCenterState): boolean {
  return state.replaceConfirmInput.trim() === "REPLACE";
}

export function hasMatchingDryRun(state: BackupCenterState): boolean {
  if (!state.dryRun || !state.dryRunInputPath) return false;
  return (
    state.dryRun.mode === state.importMode &&
    state.dryRunInputPath === state.importPathInput.trim()
  );
}

export function shouldRequireCalendarImportConfirm(state: BackupCenterState): boolean {
  return state.calendarImportMode === "update" || state.calendarImportRange === "all";
}

export function isCalendarImportConfirmValid(state: BackupCenterState): boolean {
  return state.calendarImportConfirmInput.trim() === "IMPORT";
}

export function hasMatchingCalendarImportDryRun(state: BackupCenterState): boolean {
  if (!state.calendarImportDryRun || !state.calendarImportDryRunFingerprint) return false;
  return state.calendarImportDryRunFingerprint === toCalendarImportFingerprint(state);
}

function resetCalendarExportState(state: BackupCenterState): BackupCenterState {
  return {
    ...state,
    calendarExportRange: "next7",
    calendarExportViewName: undefined,
    calendarExportPrivacy: "minimal",
    calendarExportPathInput: "",
    calendarExportResult: undefined
  };
}

function resetCalendarImportState(state: BackupCenterState): BackupCenterState {
  return {
    ...state,
    calendarImportPathInput: "",
    calendarImportRange: "next7",
    calendarImportViewName: undefined,
    calendarImportMode: "merge",
    calendarImportHorizonInput: "365",
    calendarImportTagInput: "",
    calendarImportDryRun: undefined,
    calendarImportDryRunHasErrors: false,
    calendarImportDryRunErrorReasons: [],
    calendarImportDryRunReportPath: undefined,
    calendarImportDryRunFingerprint: undefined,
    calendarImportCommitted: undefined,
    calendarImportCommittedReportPath: undefined,
    calendarImportCommittedBackupPath: undefined,
    calendarImportConfirmInput: ""
  };
}

export function backupCenterReducer(
  state: BackupCenterState,
  action: BackupCenterAction
): BackupCenterState {
  switch (action.type) {
    case "reset":
      return { ...initialBackupCenterState };
    case "openMenu":
      return {
        ...state,
        screen: "menu",
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined
      };
    case "setScreen":
      return {
        ...state,
        screen: action.screen,
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined
      };
    case "moveMenuIndex": {
      if (state.screen === "calendar_menu") {
        const next = ((state.calendarMenuIndex + action.delta + 3) % 3) as CalendarMenuIndex;
        return { ...state, calendarMenuIndex: next };
      }
      const next = ((state.menuIndex + action.delta + 4) % 4) as MainMenuIndex;
      return { ...state, menuIndex: next };
    }
    case "setMenuIndex":
      return { ...state, menuIndex: action.index };
    case "moveCalendarMenuIndex": {
      const next = ((state.calendarMenuIndex + action.delta + 3) % 3) as CalendarMenuIndex;
      return { ...state, calendarMenuIndex: next };
    }
    case "setCalendarMenuIndex":
      return { ...state, calendarMenuIndex: action.index };
    case "startExport":
      return {
        ...state,
        screen: "exporting",
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined
      };
    case "exportSucceeded":
      return {
        ...state,
        screen: "export_done",
        lastExportPath: action.outputPath,
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined
      };
    case "openImportPath":
      return {
        ...state,
        screen: "import_path",
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined
      };
    case "setImportPath":
      return {
        ...state,
        importPathInput: action.value,
        replaceConfirmInput: "",
        replaceConfirmed: state.importMode === "merge",
        dryRun: undefined,
        dryRunInputPath: undefined,
        committed: undefined
      };
    case "openImportMode":
      return {
        ...state,
        screen: "import_mode",
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined
      };
    case "setImportMode":
      return {
        ...state,
        importMode: action.mode,
        replaceConfirmInput: "",
        replaceConfirmed: action.mode === "merge",
        dryRun: undefined,
        dryRunInputPath: undefined,
        committed: undefined
      };
    case "openImportConfirm":
      return {
        ...state,
        screen: "import_confirm",
        replaceConfirmInput: "",
        replaceConfirmed: false,
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined
      };
    case "setReplaceConfirmInput":
      return { ...state, replaceConfirmInput: action.value };
    case "replaceConfirmAccepted":
      return {
        ...state,
        screen: "import_mode",
        replaceConfirmed: true,
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined
      };
    case "replaceConfirmRejected":
      return {
        ...state,
        screen: "import_mode",
        replaceConfirmInput: "",
        replaceConfirmed: false
      };
    case "dryRunSucceeded":
      return {
        ...state,
        screen: "import_dryrun",
        dryRun: action.summary,
        dryRunInputPath: action.inputPath.trim(),
        committed: undefined,
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined
      };
    case "startImporting":
      if (!hasMatchingDryRun(state)) return state;
      if (state.importMode === "replace" && !state.replaceConfirmed) return state;
      return {
        ...state,
        screen: "importing",
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined
      };
    case "importSucceeded":
      return {
        ...state,
        screen: "import_done",
        committed: action.summary,
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined
      };
    case "showDataPath":
      return {
        ...state,
        screen: "show_path",
        shownDataPath: action.path,
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined
      };
    case "setCalendarTimeZoneHint":
      return {
        ...state,
        calendarTimeZoneHint: normalizeOptionalInput(action.value)
      };
    case "setCalendarExportRange":
      return {
        ...state,
        calendarExportRange: action.range
      };
    case "setCalendarExportViewName":
      return {
        ...state,
        calendarExportViewName: normalizeOptionalInput(action.viewName)
      };
    case "setCalendarExportPrivacy":
      return {
        ...state,
        calendarExportPrivacy: action.privacy
      };
    case "setCalendarExportPath":
      return {
        ...state,
        calendarExportPathInput: action.value
      };
    case "startCalendarExport":
      return {
        ...state,
        screen: "calendar_exporting",
        calendarExportResult: undefined,
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined
      };
    case "calendarExportSucceeded":
      return {
        ...state,
        screen: "calendar_export_done",
        calendarExportResult: action.result,
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined
      };
    case "setCalendarImportPath":
      return {
        ...state,
        calendarImportPathInput: action.value,
        calendarImportDryRun: undefined,
        calendarImportDryRunHasErrors: false,
        calendarImportDryRunErrorReasons: [],
        calendarImportDryRunReportPath: undefined,
        calendarImportDryRunFingerprint: undefined,
        calendarImportCommitted: undefined,
        calendarImportCommittedReportPath: undefined,
        calendarImportCommittedBackupPath: undefined,
        calendarImportConfirmInput: ""
      };
    case "setCalendarImportRange":
      return {
        ...state,
        calendarImportRange: action.range,
        calendarImportDryRun: undefined,
        calendarImportDryRunHasErrors: false,
        calendarImportDryRunErrorReasons: [],
        calendarImportDryRunReportPath: undefined,
        calendarImportDryRunFingerprint: undefined,
        calendarImportCommitted: undefined,
        calendarImportCommittedReportPath: undefined,
        calendarImportCommittedBackupPath: undefined,
        calendarImportConfirmInput: ""
      };
    case "setCalendarImportViewName":
      return {
        ...state,
        calendarImportViewName: normalizeOptionalInput(action.viewName),
        calendarImportDryRun: undefined,
        calendarImportDryRunHasErrors: false,
        calendarImportDryRunErrorReasons: [],
        calendarImportDryRunReportPath: undefined,
        calendarImportDryRunFingerprint: undefined,
        calendarImportCommitted: undefined,
        calendarImportCommittedReportPath: undefined,
        calendarImportCommittedBackupPath: undefined,
        calendarImportConfirmInput: ""
      };
    case "setCalendarImportMode":
      return {
        ...state,
        calendarImportMode: action.mode,
        calendarImportDryRun: undefined,
        calendarImportDryRunHasErrors: false,
        calendarImportDryRunErrorReasons: [],
        calendarImportDryRunReportPath: undefined,
        calendarImportDryRunFingerprint: undefined,
        calendarImportCommitted: undefined,
        calendarImportCommittedReportPath: undefined,
        calendarImportCommittedBackupPath: undefined,
        calendarImportConfirmInput: ""
      };
    case "setCalendarImportHorizonInput":
      return {
        ...state,
        calendarImportHorizonInput: action.value,
        calendarImportDryRun: undefined,
        calendarImportDryRunHasErrors: false,
        calendarImportDryRunErrorReasons: [],
        calendarImportDryRunReportPath: undefined,
        calendarImportDryRunFingerprint: undefined,
        calendarImportCommitted: undefined,
        calendarImportCommittedReportPath: undefined,
        calendarImportCommittedBackupPath: undefined,
        calendarImportConfirmInput: ""
      };
    case "setCalendarImportTagInput":
      return {
        ...state,
        calendarImportTagInput: action.value,
        calendarImportDryRun: undefined,
        calendarImportDryRunHasErrors: false,
        calendarImportDryRunErrorReasons: [],
        calendarImportDryRunReportPath: undefined,
        calendarImportDryRunFingerprint: undefined,
        calendarImportCommitted: undefined,
        calendarImportCommittedReportPath: undefined,
        calendarImportCommittedBackupPath: undefined,
        calendarImportConfirmInput: ""
      };
    case "setCalendarImportConfirmInput":
      return {
        ...state,
        calendarImportConfirmInput: action.value
      };
    case "startCalendarImportDryRun":
      return {
        ...state,
        screen: "calendar_import_dryrun_running",
        calendarImportDryRun: undefined,
        calendarImportDryRunHasErrors: false,
        calendarImportDryRunErrorReasons: [],
        calendarImportDryRunReportPath: undefined,
        calendarImportDryRunFingerprint: undefined,
        calendarImportCommitted: undefined,
        calendarImportCommittedReportPath: undefined,
        calendarImportCommittedBackupPath: undefined,
        calendarImportConfirmInput: "",
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined
      };
    case "calendarImportDryRunSucceeded":
      return {
        ...state,
        screen: "calendar_import_dryrun",
        calendarImportDryRun: action.summary,
        calendarImportDryRunHasErrors: action.hasErrors,
        calendarImportDryRunErrorReasons: action.errorReasons,
        calendarImportDryRunFingerprint: action.fingerprint,
        calendarImportDryRunReportPath: action.reportPath,
        calendarImportCommitted: undefined,
        calendarImportCommittedReportPath: undefined,
        calendarImportCommittedBackupPath: undefined,
        calendarImportConfirmInput: "",
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined
      };
    case "startCalendarImporting":
      if (!hasMatchingCalendarImportDryRun(state)) return state;
      if (state.calendarImportDryRunHasErrors) return state;
      if (
        shouldRequireCalendarImportConfirm(state) &&
        !isCalendarImportConfirmValid(state)
      ) {
        return state;
      }
      return {
        ...state,
        screen: "calendar_importing",
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined
      };
    case "calendarImportSucceeded":
      return {
        ...state,
        screen: "calendar_import_done",
        calendarImportCommitted: action.summary,
        calendarImportCommittedReportPath: action.reportPath,
        calendarImportCommittedBackupPath: action.backupPath,
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined
      };
    case "setError":
      return {
        ...state,
        screen: "error",
        errorMessage: action.message,
        errorDetail: action.detail,
        errorReturnScreen: action.returnScreen
      };
    case "back":
      switch (state.screen) {
        case "menu":
          return state;
        case "exporting":
        case "importing":
        case "calendar_exporting":
        case "calendar_import_dryrun_running":
        case "calendar_importing":
          return state;
        case "export_done":
        case "import_done":
        case "show_path":
          return { ...state, screen: "menu" };
        case "calendar_menu":
          return {
            ...resetCalendarExportState(resetCalendarImportState(state)),
            screen: "menu"
          };
        case "calendar_export_intro":
          return { ...state, screen: "calendar_menu" };
        case "calendar_export_range":
          return { ...state, screen: "calendar_export_intro" };
        case "calendar_export_view":
          return { ...state, screen: "calendar_export_range" };
        case "calendar_export_privacy":
          return { ...state, screen: "calendar_export_view" };
        case "calendar_export_path":
          return { ...state, screen: "calendar_export_privacy" };
        case "calendar_export_confirm":
          return { ...state, screen: "calendar_export_path" };
        case "calendar_export_done":
          return { ...state, screen: "calendar_menu" };
        case "calendar_import_intro":
          return { ...state, screen: "calendar_menu" };
        case "calendar_import_path":
          return { ...state, screen: "calendar_import_intro" };
        case "calendar_import_range":
          return { ...state, screen: "calendar_import_path" };
        case "calendar_import_view":
          return { ...state, screen: "calendar_import_range" };
        case "calendar_import_mode":
          return { ...state, screen: "calendar_import_view" };
        case "calendar_import_horizon":
          return { ...state, screen: "calendar_import_mode" };
        case "calendar_import_tag":
          return { ...state, screen: "calendar_import_horizon" };
        case "calendar_import_dryrun":
          return { ...state, screen: "calendar_import_tag" };
        case "calendar_import_confirm":
          return {
            ...state,
            screen: "calendar_import_dryrun",
            calendarImportConfirmInput: ""
          };
        case "calendar_import_done":
          return { ...state, screen: "calendar_menu" };
        case "error":
          return {
            ...state,
            screen: state.errorReturnScreen ?? "menu",
            errorMessage: undefined,
            errorDetail: undefined,
            errorReturnScreen: undefined
          };
        case "import_path":
          return { ...state, screen: "menu" };
        case "import_mode":
          return { ...state, screen: "import_path" };
        case "import_confirm":
          return {
            ...state,
            screen: "import_mode",
            replaceConfirmInput: "",
            replaceConfirmed: false
          };
        case "import_dryrun":
          return { ...state, screen: "import_mode" };
        default:
          return state;
      }
    default:
      return state;
  }
}
