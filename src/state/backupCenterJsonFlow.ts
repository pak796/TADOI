import type { BackupCenterAction, BackupCenterState } from "./backupCenterFlow";
import {
  clampImportPickerSelection,
  ensureImportPickerSelectionVisible,
  normalizeImportPickerVisibleRows,
} from "./backupCenterShared";

type JsonBackupAction = Extract<
  BackupCenterAction,
  | { type: "startExport" }
  | { type: "exportSucceeded" }
  | { type: "openImportPicker" }
  | { type: "loadImportPickerFilesRequest" }
  | { type: "loadImportPickerFilesSuccess" }
  | { type: "loadImportPickerFilesFailure" }
  | { type: "moveImportPickerSelection" }
  | { type: "pageImportPickerSelection" }
  | { type: "jumpImportPickerSelection" }
  | { type: "setImportPickerSelection" }
  | { type: "confirmImportPickerSelection" }
  | { type: "openImportPathManual" }
  | { type: "openImportPath" }
  | { type: "setImportPath" }
  | { type: "openImportMode" }
  | { type: "setImportMode" }
  | { type: "openImportConfirm" }
  | { type: "setReplaceConfirmInput" }
  | { type: "replaceConfirmAccepted" }
  | { type: "replaceConfirmRejected" }
  | { type: "dryRunSucceeded" }
  | { type: "startImporting" }
  | { type: "importSucceeded" }
  | { type: "showDataPath" }
>;

function hasMatchingDryRun(state: BackupCenterState): boolean {
  if (!state.dryRun || !state.dryRunInputPath) return false;
  return (
    state.dryRun.mode === state.importMode &&
    state.dryRunInputPath === state.importPathInput.trim()
  );
}

export function isJsonBackupAction(
  action: BackupCenterAction,
): action is JsonBackupAction {
  return (
    action.type === "startExport" ||
    action.type === "exportSucceeded" ||
    action.type === "openImportPicker" ||
    action.type === "loadImportPickerFilesRequest" ||
    action.type === "loadImportPickerFilesSuccess" ||
    action.type === "loadImportPickerFilesFailure" ||
    action.type === "moveImportPickerSelection" ||
    action.type === "pageImportPickerSelection" ||
    action.type === "jumpImportPickerSelection" ||
    action.type === "setImportPickerSelection" ||
    action.type === "confirmImportPickerSelection" ||
    action.type === "openImportPathManual" ||
    action.type === "openImportPath" ||
    action.type === "setImportPath" ||
    action.type === "openImportMode" ||
    action.type === "setImportMode" ||
    action.type === "openImportConfirm" ||
    action.type === "setReplaceConfirmInput" ||
    action.type === "replaceConfirmAccepted" ||
    action.type === "replaceConfirmRejected" ||
    action.type === "dryRunSucceeded" ||
    action.type === "startImporting" ||
    action.type === "importSucceeded" ||
    action.type === "showDataPath"
  );
}

export function reduceJsonBackupFlow(
  state: BackupCenterState,
  action: JsonBackupAction,
): BackupCenterState {
  switch (action.type) {
    case "startExport":
      return {
        ...state,
        screen: "exporting",
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined,
      };
    case "exportSucceeded":
      return {
        ...state,
        screen: "export_done",
        lastExportPath: action.outputPath,
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined,
      };
    case "openImportPicker":
      return {
        ...state,
        screen: "import_picker",
        importPickerDirectoryPath: action.directoryPath,
        importPickerFiles: [],
        importPickerSelectedIndex: 0,
        importPickerScrollOffset: 0,
        importPickerLoading: true,
        importPickerError: undefined,
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined,
      };
    case "loadImportPickerFilesRequest":
      if (state.screen !== "import_picker") return state;
      return {
        ...state,
        importPickerDirectoryPath: action.directoryPath,
        importPickerLoading: true,
        importPickerError: undefined,
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined,
      };
    case "loadImportPickerFilesSuccess":
      if (state.screen !== "import_picker") return state;
      return {
        ...state,
        importPickerDirectoryPath: action.directoryPath,
        importPickerFiles: [...action.files],
        importPickerSelectedIndex: 0,
        importPickerScrollOffset: 0,
        importPickerLoading: false,
        importPickerError: undefined,
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined,
      };
    case "loadImportPickerFilesFailure":
      if (state.screen !== "import_picker") return state;
      return {
        ...state,
        importPickerDirectoryPath: action.directoryPath,
        importPickerFiles: [],
        importPickerSelectedIndex: 0,
        importPickerScrollOffset: 0,
        importPickerLoading: false,
        importPickerError: action.error,
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined,
      };
    case "moveImportPickerSelection": {
      if (state.screen !== "import_picker") return state;
      const current = ensureImportPickerSelectionVisible(
        state.importPickerFiles,
        state.importPickerSelectedIndex + action.delta,
        state.importPickerScrollOffset,
        action.visibleRows,
      );
      return {
        ...state,
        importPickerSelectedIndex: current.selectedIndex,
        importPickerScrollOffset: current.scrollOffset,
      };
    }
    case "pageImportPickerSelection": {
      if (state.screen !== "import_picker") return state;
      const rows = normalizeImportPickerVisibleRows(action.visibleRows);
      const current = ensureImportPickerSelectionVisible(
        state.importPickerFiles,
        state.importPickerSelectedIndex + action.delta * rows,
        state.importPickerScrollOffset,
        rows,
      );
      return {
        ...state,
        importPickerSelectedIndex: current.selectedIndex,
        importPickerScrollOffset: current.scrollOffset,
      };
    }
    case "jumpImportPickerSelection": {
      if (state.screen !== "import_picker") return state;
      const targetIndex =
        action.target === "start"
          ? 0
          : Math.max(0, state.importPickerFiles.length - 1);
      const current = ensureImportPickerSelectionVisible(
        state.importPickerFiles,
        targetIndex,
        state.importPickerScrollOffset,
        action.visibleRows,
      );
      return {
        ...state,
        importPickerSelectedIndex: current.selectedIndex,
        importPickerScrollOffset: current.scrollOffset,
      };
    }
    case "setImportPickerSelection": {
      if (state.screen !== "import_picker") return state;
      const current = ensureImportPickerSelectionVisible(
        state.importPickerFiles,
        action.index,
        state.importPickerScrollOffset,
        action.visibleRows,
      );
      return {
        ...state,
        importPickerSelectedIndex: current.selectedIndex,
        importPickerScrollOffset: current.scrollOffset,
      };
    }
    case "confirmImportPickerSelection": {
      if (state.screen !== "import_picker") return state;
      const selected =
        state.importPickerFiles[
          clampImportPickerSelection(
            state.importPickerSelectedIndex,
            state.importPickerFiles.length,
          )
        ];
      if (!selected) return state;
      return {
        ...state,
        screen: "import_mode",
        importPathInput: selected.path,
        replaceConfirmInput: "",
        replaceConfirmed: state.importMode === "merge",
        dryRun: undefined,
        dryRunInputPath: undefined,
        committed: undefined,
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined,
      };
    }
    case "openImportPathManual":
    case "openImportPath":
      return {
        ...state,
        screen: "import_path",
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined,
      };
    case "setImportPath":
      return {
        ...state,
        importPathInput: action.value,
        replaceConfirmInput: "",
        replaceConfirmed: state.importMode === "merge",
        dryRun: undefined,
        dryRunInputPath: undefined,
        committed: undefined,
      };
    case "openImportMode":
      return {
        ...state,
        screen: "import_mode",
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined,
      };
    case "setImportMode":
      return {
        ...state,
        importMode: action.mode,
        replaceConfirmInput: "",
        replaceConfirmed: action.mode === "merge",
        dryRun: undefined,
        dryRunInputPath: undefined,
        committed: undefined,
      };
    case "openImportConfirm":
      return {
        ...state,
        screen: "import_confirm",
        replaceConfirmInput: "",
        replaceConfirmed: false,
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined,
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
        errorReturnScreen: undefined,
      };
    case "replaceConfirmRejected":
      return {
        ...state,
        screen: "import_mode",
        replaceConfirmInput: "",
        replaceConfirmed: false,
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
        errorReturnScreen: undefined,
      };
    case "startImporting":
      if (!hasMatchingDryRun(state)) return state;
      if (state.importMode === "replace" && !state.replaceConfirmed) {
        return state;
      }
      return {
        ...state,
        screen: "importing",
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined,
      };
    case "importSucceeded":
      return {
        ...state,
        screen: "import_done",
        committed: action.summary,
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined,
      };
    case "showDataPath":
      return {
        ...state,
        screen: "show_path",
        shownDataPath: action.path,
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined,
      };
  }
}
