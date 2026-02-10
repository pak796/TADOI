import type { BackupImportSummary } from "./backupService";
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
  | "error";

export type BackupCenterState = {
  screen: BackupCenterScreen;
  menuIndex: 0 | 1 | 2;
  importPathInput: string;
  importMode: ImportMode;
  replaceConfirmInput: string;
  replaceConfirmed: boolean;
  lastExportPath?: string;
  dryRun?: BackupImportSummary;
  dryRunInputPath?: string;
  committed?: BackupImportSummary;
  shownDataPath?: string;
  errorMessage?: string;
  errorDetail?: string;
};

export type BackupCenterAction =
  | { type: "reset" }
  | { type: "openMenu" }
  | { type: "moveMenuIndex"; delta: 1 | -1 }
  | { type: "setMenuIndex"; index: 0 | 1 | 2 }
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
  | { type: "setError"; message: string; detail?: string }
  | { type: "back" };

export const initialBackupCenterState: BackupCenterState = {
  screen: "menu",
  menuIndex: 0,
  importPathInput: "",
  importMode: "merge",
  replaceConfirmInput: "",
  replaceConfirmed: false
};

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
        errorDetail: undefined
      };
    case "moveMenuIndex": {
      const next = ((state.menuIndex + action.delta + 3) % 3) as 0 | 1 | 2;
      return { ...state, menuIndex: next };
    }
    case "setMenuIndex":
      return { ...state, menuIndex: action.index };
    case "startExport":
      return {
        ...state,
        screen: "exporting",
        errorMessage: undefined,
        errorDetail: undefined
      };
    case "exportSucceeded":
      return {
        ...state,
        screen: "export_done",
        lastExportPath: action.outputPath,
        errorMessage: undefined,
        errorDetail: undefined
      };
    case "openImportPath":
      return {
        ...state,
        screen: "import_path",
        errorMessage: undefined,
        errorDetail: undefined
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
        errorDetail: undefined
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
        errorDetail: undefined
      };
    case "setReplaceConfirmInput":
      return { ...state, replaceConfirmInput: action.value };
    case "replaceConfirmAccepted":
      return {
        ...state,
        screen: "import_mode",
        replaceConfirmed: true,
        errorMessage: undefined,
        errorDetail: undefined
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
        errorDetail: undefined
      };
    case "startImporting":
      if (!hasMatchingDryRun(state)) return state;
      if (state.importMode === "replace" && !state.replaceConfirmed) return state;
      return {
        ...state,
        screen: "importing",
        errorMessage: undefined,
        errorDetail: undefined
      };
    case "importSucceeded":
      return {
        ...state,
        screen: "import_done",
        committed: action.summary,
        errorMessage: undefined,
        errorDetail: undefined
      };
    case "showDataPath":
      return {
        ...state,
        screen: "show_path",
        shownDataPath: action.path,
        errorMessage: undefined,
        errorDetail: undefined
      };
    case "setError":
      return {
        ...state,
        screen: "error",
        errorMessage: action.message,
        errorDetail: action.detail
      };
    case "back":
      switch (state.screen) {
        case "menu":
          return state;
        case "exporting":
        case "importing":
          return state;
        case "export_done":
        case "import_done":
        case "show_path":
        case "error":
          return { ...state, screen: "menu" };
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
