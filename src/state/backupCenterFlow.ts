import type { CalendarEventPrivacyMode } from "../calendar/calendarMapper";
import type { CalendarImportMode } from "../calendar/importMapper";
import type { CalendarExportRange } from "../calendar/range";
import type { BackupFileInfo, BackupImportSummary } from "./backupService";
import type { CalendarExportResult } from "./calendarExportService";
import type { CalendarImportSummary } from "./calendarImportService";
import type { ImportMode } from "./portability";
import type { GitHubAutoPushPolicy } from "../settings/settings";

export type BackupCenterScreen =
  | "menu"
  | "exporting"
  | "export_done"
  | "import_picker"
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
  | "github_status"
  | "github_connect_mode"
  | "github_connect_repo_input"
  | "github_connect_public_confirm"
  | "github_connecting"
  | "github_push_running"
  | "github_push_done"
  | "github_restore_loading"
  | "github_restore_picker"
  | "github_restore_downloading"
  | "error";

type MainMenuIndex = 0 | 1 | 2 | 3;
type CalendarMenuIndex = 0 | 1 | 2 | 3;
export const BACKUP_IMPORT_PICKER_MAX_VISIBLE_ROWS = 8;
const BACKUP_IMPORT_PICKER_MIN_VISIBLE_ROWS = 1;

export type GitHubSnapshotListItem = {
  id: string;
  timestamp: string;
  tasksTotal?: number;
  tasksOpen?: number;
  appVersion?: string;
  schemaVersion?: number;
};

export type BackupCenterState = {
  screen: BackupCenterScreen;
  menuIndex: MainMenuIndex;
  calendarMenuIndex: CalendarMenuIndex;

  // DATA (JSON portability) flow state.
  importPickerDirectoryPath: string;
  importPickerFiles: BackupFileInfo[];
  importPickerSelectedIndex: number;
  importPickerScrollOffset: number;
  importPickerLoading: boolean;
  importPickerError?: string;
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
  calendarExportWarnings: string[];

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
  calendarImportDryRunWarnings: string[];
  calendarImportCommittedWarnings: string[];
  calendarImportConfirmInput: string;

  // GITHUB cloud backup flow state.
  githubGhDetected: boolean;
  githubLoggedIn: boolean;
  githubUsername?: string;
  githubOwnerRepoConfigured?: string;
  githubAutoPushPolicy: GitHubAutoPushPolicy;
  githubLastPushedAt?: string;
  githubLastRestorePulledAt?: string;
  githubConnectMode: "create" | "existing";
  githubRepoNameInput: string;
  githubOwnerRepoInput: string;
  githubPublicConfirmInput: string;
  githubPushCommitSha?: string;
  githubSnapshots: GitHubSnapshotListItem[];
  githubSnapshotSelectedIndex: number;
  githubSnapshotScrollOffset: number;
  githubSnapshotLoading: boolean;
  githubSnapshotError?: string;
  githubSelectedSnapshotTimestamp?: string;

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
  | { type: "openImportPicker"; directoryPath: string }
  | { type: "loadImportPickerFilesRequest"; directoryPath: string }
  | {
      type: "loadImportPickerFilesSuccess";
      directoryPath: string;
      files: BackupFileInfo[];
    }
  | { type: "loadImportPickerFilesFailure"; directoryPath: string; error: string }
  | { type: "moveImportPickerSelection"; delta: 1 | -1; visibleRows: number }
  | { type: "pageImportPickerSelection"; delta: 1 | -1; visibleRows: number }
  | {
      type: "jumpImportPickerSelection";
      target: "start" | "end";
      visibleRows: number;
    }
  | { type: "setImportPickerSelection"; index: number; visibleRows: number }
  | { type: "confirmImportPickerSelection" }
  | { type: "openImportPathManual" }
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
  | { type: "calendarExportSucceeded"; result: CalendarExportResult; warnings?: string[] }
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
      warnings?: string[];
    }
  | { type: "startCalendarImporting" }
  | {
      type: "calendarImportSucceeded";
      summary: CalendarImportSummary;
      reportPath?: string;
      backupPath?: string;
      warnings?: string[];
    }
  | { type: "openGitHubStatus" }
  | {
      type: "setGitHubStatus";
      ghDetected: boolean;
      loggedIn: boolean;
      username?: string;
      ownerRepoConfigured?: string;
      autoPushPolicy: GitHubAutoPushPolicy;
      lastPushedAt?: string;
      lastRestorePulledAt?: string;
    }
  | { type: "openGitHubConnectMode" }
  | { type: "setGitHubConnectMode"; mode: "create" | "existing" }
  | { type: "setGitHubRepoNameInput"; value: string }
  | { type: "setGitHubOwnerRepoInput"; value: string }
  | { type: "setGitHubPublicConfirmInput"; value: string }
  | { type: "startGitHubConnect" }
  | { type: "githubConnectSucceeded"; ownerRepo: string }
  | { type: "startGitHubPush" }
  | { type: "githubPushSucceeded"; timestamp: string; commitSha?: string }
  | { type: "startGitHubRestoreLoad" }
  | { type: "githubRestoreLoadSucceeded"; snapshots: GitHubSnapshotListItem[] }
  | { type: "githubRestoreLoadFailed"; error: string }
  | { type: "moveGitHubSnapshotSelection"; delta: 1 | -1; visibleRows: number }
  | { type: "pageGitHubSnapshotSelection"; delta: 1 | -1; visibleRows: number }
  | { type: "jumpGitHubSnapshotSelection"; target: "start" | "end"; visibleRows: number }
  | { type: "setGitHubSnapshotSelection"; index: number; visibleRows: number }
  | { type: "startGitHubRestoreDownload" }
  | { type: "githubRestoreDownloadSucceeded"; timestamp?: string }
  | { type: "setGitHubLastRestorePulledAt"; value?: string }
  | { type: "setError"; message: string; detail?: string; returnScreen?: BackupCenterScreen }
  | { type: "back" };

export const initialBackupCenterState: BackupCenterState = {
  screen: "menu",
  menuIndex: 0,
  calendarMenuIndex: 0,
  importPickerDirectoryPath: "",
  importPickerFiles: [],
  importPickerSelectedIndex: 0,
  importPickerScrollOffset: 0,
  importPickerLoading: false,
  importPathInput: "",
  importMode: "merge",
  replaceConfirmInput: "",
  replaceConfirmed: false,
  calendarExportRange: "next7",
  calendarExportPrivacy: "minimal",
  calendarExportPathInput: "",
  calendarExportWarnings: [],
  calendarImportPathInput: "",
  calendarImportRange: "next7",
  calendarImportMode: "merge",
  calendarImportHorizonInput: "365",
  calendarImportTagInput: "",
  calendarImportDryRunHasErrors: false,
  calendarImportDryRunErrorReasons: [],
  calendarImportDryRunWarnings: [],
  calendarImportCommittedWarnings: [],
  calendarImportConfirmInput: "",
  githubGhDetected: false,
  githubLoggedIn: false,
  githubAutoPushPolicy: "off",
  githubConnectMode: "create",
  githubRepoNameInput: "tadoi-backups",
  githubOwnerRepoInput: "",
  githubPublicConfirmInput: "",
  githubSnapshots: [],
  githubSnapshotSelectedIndex: 0,
  githubSnapshotScrollOffset: 0,
  githubSnapshotLoading: false
};

function normalizeOptionalInput(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeImportPickerVisibleRows(visibleRows: number): number {
  if (!Number.isFinite(visibleRows) || visibleRows <= 0) {
    return BACKUP_IMPORT_PICKER_MIN_VISIBLE_ROWS;
  }
  return Math.max(BACKUP_IMPORT_PICKER_MIN_VISIBLE_ROWS, Math.floor(visibleRows));
}

function clampImportPickerSelection(index: number, fileCount: number): number {
  if (fileCount <= 0) return 0;
  return Math.max(0, Math.min(index, fileCount - 1));
}

function clampGitHubSnapshotSelection(index: number, fileCount: number): number {
  if (fileCount <= 0) return 0;
  return Math.max(0, Math.min(index, fileCount - 1));
}

function ensureImportPickerSelectionVisible(
  files: BackupFileInfo[],
  selectedIndex: number,
  scrollOffset: number,
  visibleRows: number
): { selectedIndex: number; scrollOffset: number } {
  const fileCount = files.length;
  if (fileCount === 0) {
    return { selectedIndex: 0, scrollOffset: 0 };
  }

  const rows = normalizeImportPickerVisibleRows(visibleRows);
  const clampedSelected = clampImportPickerSelection(selectedIndex, fileCount);
  const maxOffset = Math.max(0, fileCount - rows);
  let clampedOffset = Math.max(0, Math.min(scrollOffset, maxOffset));

  if (clampedSelected < clampedOffset) {
    clampedOffset = clampedSelected;
  } else if (clampedSelected >= clampedOffset + rows) {
    clampedOffset = clampedSelected - rows + 1;
  }

  return {
    selectedIndex: clampedSelected,
    scrollOffset: Math.max(0, Math.min(clampedOffset, maxOffset))
  };
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

function ensureGitHubSnapshotSelectionVisible(
  snapshots: GitHubSnapshotListItem[],
  selectedIndex: number,
  scrollOffset: number,
  visibleRows: number
): { selectedIndex: number; scrollOffset: number } {
  const rowCount = normalizeImportPickerVisibleRows(visibleRows);
  const itemCount = snapshots.length;
  if (itemCount <= 0) {
    return { selectedIndex: 0, scrollOffset: 0 };
  }

  const clampedSelected = clampGitHubSnapshotSelection(selectedIndex, itemCount);
  const maxOffset = Math.max(0, itemCount - rowCount);
  let clampedOffset = Math.max(0, Math.min(scrollOffset, maxOffset));
  if (clampedSelected < clampedOffset) {
    clampedOffset = clampedSelected;
  } else if (clampedSelected >= clampedOffset + rowCount) {
    clampedOffset = clampedSelected - rowCount + 1;
  }

  return {
    selectedIndex: clampedSelected,
    scrollOffset: Math.max(0, Math.min(clampedOffset, maxOffset))
  };
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
    calendarExportResult: undefined,
    calendarExportWarnings: []
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
    calendarImportDryRunWarnings: [],
    calendarImportCommittedWarnings: [],
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
        const next = ((state.calendarMenuIndex + action.delta + 4) % 4) as CalendarMenuIndex;
        return { ...state, calendarMenuIndex: next };
      }
      const next = ((state.menuIndex + action.delta + 4) % 4) as MainMenuIndex;
      return { ...state, menuIndex: next };
    }
    case "setMenuIndex":
      return { ...state, menuIndex: action.index };
    case "moveCalendarMenuIndex": {
      const next = ((state.calendarMenuIndex + action.delta + 4) % 4) as CalendarMenuIndex;
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
        errorReturnScreen: undefined
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
        errorReturnScreen: undefined
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
        errorReturnScreen: undefined
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
        errorReturnScreen: undefined
      };
    case "moveImportPickerSelection": {
      if (state.screen !== "import_picker") return state;
      const current = ensureImportPickerSelectionVisible(
        state.importPickerFiles,
        state.importPickerSelectedIndex + action.delta,
        state.importPickerScrollOffset,
        action.visibleRows
      );
      return {
        ...state,
        importPickerSelectedIndex: current.selectedIndex,
        importPickerScrollOffset: current.scrollOffset
      };
    }
    case "pageImportPickerSelection": {
      if (state.screen !== "import_picker") return state;
      const rows = normalizeImportPickerVisibleRows(action.visibleRows);
      const current = ensureImportPickerSelectionVisible(
        state.importPickerFiles,
        state.importPickerSelectedIndex + action.delta * rows,
        state.importPickerScrollOffset,
        rows
      );
      return {
        ...state,
        importPickerSelectedIndex: current.selectedIndex,
        importPickerScrollOffset: current.scrollOffset
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
        action.visibleRows
      );
      return {
        ...state,
        importPickerSelectedIndex: current.selectedIndex,
        importPickerScrollOffset: current.scrollOffset
      };
    }
    case "setImportPickerSelection": {
      if (state.screen !== "import_picker") return state;
      const current = ensureImportPickerSelectionVisible(
        state.importPickerFiles,
        action.index,
        state.importPickerScrollOffset,
        action.visibleRows
      );
      return {
        ...state,
        importPickerSelectedIndex: current.selectedIndex,
        importPickerScrollOffset: current.scrollOffset
      };
    }
    case "confirmImportPickerSelection": {
      if (state.screen !== "import_picker") return state;
      const selected =
        state.importPickerFiles[
          clampImportPickerSelection(
            state.importPickerSelectedIndex,
            state.importPickerFiles.length
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
        errorReturnScreen: undefined
      };
    }
    case "openImportPathManual":
      return {
        ...state,
        screen: "import_path",
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
        calendarExportWarnings: [],
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined
      };
    case "calendarExportSucceeded":
      return {
        ...state,
        screen: "calendar_export_done",
        calendarExportResult: action.result,
        calendarExportWarnings: [...(action.warnings ?? [])],
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
        calendarImportDryRunWarnings: [],
        calendarImportCommittedWarnings: [],
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
        calendarImportDryRunWarnings: [],
        calendarImportCommittedWarnings: [],
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
        calendarImportDryRunWarnings: [],
        calendarImportCommittedWarnings: [],
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
        calendarImportDryRunWarnings: [],
        calendarImportCommittedWarnings: [],
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
        calendarImportDryRunWarnings: [],
        calendarImportCommittedWarnings: [],
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
        calendarImportDryRunWarnings: [],
        calendarImportCommittedWarnings: [],
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
        calendarImportDryRunWarnings: [],
        calendarImportCommitted: undefined,
        calendarImportCommittedReportPath: undefined,
        calendarImportCommittedBackupPath: undefined,
        calendarImportCommittedWarnings: [],
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
        calendarImportDryRunWarnings: [...(action.warnings ?? [])],
        calendarImportCommitted: undefined,
        calendarImportCommittedReportPath: undefined,
        calendarImportCommittedBackupPath: undefined,
        calendarImportCommittedWarnings: [],
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
        calendarImportCommittedWarnings: [...(action.warnings ?? [])],
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined
      };
    case "openGitHubStatus":
      return {
        ...state,
        screen: "github_status",
        githubSnapshots: [],
        githubSnapshotSelectedIndex: 0,
        githubSnapshotScrollOffset: 0,
        githubSnapshotLoading: false,
        githubSnapshotError: undefined,
        githubPushCommitSha: undefined,
        githubSelectedSnapshotTimestamp: undefined,
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined
      };
    case "setGitHubStatus":
      return {
        ...state,
        githubGhDetected: action.ghDetected,
        githubLoggedIn: action.loggedIn,
        githubUsername: normalizeOptionalInput(action.username),
        githubOwnerRepoConfigured: normalizeOptionalInput(action.ownerRepoConfigured),
        githubAutoPushPolicy: action.autoPushPolicy,
        githubLastPushedAt: normalizeOptionalInput(action.lastPushedAt),
        githubLastRestorePulledAt: normalizeOptionalInput(action.lastRestorePulledAt)
      };
    case "openGitHubConnectMode":
      return {
        ...state,
        screen: "github_connect_mode",
        githubPublicConfirmInput: "",
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined
      };
    case "setGitHubConnectMode":
      return {
        ...state,
        githubConnectMode: action.mode,
        githubPublicConfirmInput: ""
      };
    case "setGitHubRepoNameInput":
      return {
        ...state,
        githubRepoNameInput: action.value
      };
    case "setGitHubOwnerRepoInput":
      return {
        ...state,
        githubOwnerRepoInput: action.value
      };
    case "setGitHubPublicConfirmInput":
      return {
        ...state,
        githubPublicConfirmInput: action.value
      };
    case "startGitHubConnect":
      return {
        ...state,
        screen: "github_connecting",
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined
      };
    case "githubConnectSucceeded":
      return {
        ...state,
        screen: "github_status",
        githubOwnerRepoConfigured: normalizeOptionalInput(action.ownerRepo),
        githubPublicConfirmInput: "",
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined
      };
    case "startGitHubPush":
      return {
        ...state,
        screen: "github_push_running",
        githubPushCommitSha: undefined,
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined
      };
    case "githubPushSucceeded":
      return {
        ...state,
        screen: "github_push_done",
        githubLastPushedAt: normalizeOptionalInput(action.timestamp),
        githubPushCommitSha: normalizeOptionalInput(action.commitSha),
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined
      };
    case "startGitHubRestoreLoad":
      return {
        ...state,
        screen: "github_restore_loading",
        githubSnapshots: [],
        githubSnapshotSelectedIndex: 0,
        githubSnapshotScrollOffset: 0,
        githubSnapshotLoading: true,
        githubSnapshotError: undefined,
        githubSelectedSnapshotTimestamp: undefined,
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined
      };
    case "githubRestoreLoadSucceeded":
      return {
        ...state,
        screen: "github_restore_picker",
        githubSnapshots: [...action.snapshots],
        githubSnapshotSelectedIndex: 0,
        githubSnapshotScrollOffset: 0,
        githubSnapshotLoading: false,
        githubSnapshotError: undefined,
        githubSelectedSnapshotTimestamp: undefined,
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined
      };
    case "githubRestoreLoadFailed":
      return {
        ...state,
        screen: "github_restore_picker",
        githubSnapshots: [],
        githubSnapshotSelectedIndex: 0,
        githubSnapshotScrollOffset: 0,
        githubSnapshotLoading: false,
        githubSnapshotError: action.error
      };
    case "moveGitHubSnapshotSelection": {
      if (state.screen !== "github_restore_picker") return state;
      const current = ensureGitHubSnapshotSelectionVisible(
        state.githubSnapshots,
        state.githubSnapshotSelectedIndex + action.delta,
        state.githubSnapshotScrollOffset,
        action.visibleRows
      );
      return {
        ...state,
        githubSnapshotSelectedIndex: current.selectedIndex,
        githubSnapshotScrollOffset: current.scrollOffset
      };
    }
    case "pageGitHubSnapshotSelection": {
      if (state.screen !== "github_restore_picker") return state;
      const rows = normalizeImportPickerVisibleRows(action.visibleRows);
      const current = ensureGitHubSnapshotSelectionVisible(
        state.githubSnapshots,
        state.githubSnapshotSelectedIndex + action.delta * rows,
        state.githubSnapshotScrollOffset,
        rows
      );
      return {
        ...state,
        githubSnapshotSelectedIndex: current.selectedIndex,
        githubSnapshotScrollOffset: current.scrollOffset
      };
    }
    case "jumpGitHubSnapshotSelection": {
      if (state.screen !== "github_restore_picker") return state;
      const targetIndex =
        action.target === "start"
          ? 0
          : Math.max(0, state.githubSnapshots.length - 1);
      const current = ensureGitHubSnapshotSelectionVisible(
        state.githubSnapshots,
        targetIndex,
        state.githubSnapshotScrollOffset,
        action.visibleRows
      );
      return {
        ...state,
        githubSnapshotSelectedIndex: current.selectedIndex,
        githubSnapshotScrollOffset: current.scrollOffset
      };
    }
    case "setGitHubSnapshotSelection": {
      if (state.screen !== "github_restore_picker") return state;
      const current = ensureGitHubSnapshotSelectionVisible(
        state.githubSnapshots,
        action.index,
        state.githubSnapshotScrollOffset,
        action.visibleRows
      );
      return {
        ...state,
        githubSnapshotSelectedIndex: current.selectedIndex,
        githubSnapshotScrollOffset: current.scrollOffset
      };
    }
    case "startGitHubRestoreDownload":
      return {
        ...state,
        screen: "github_restore_downloading",
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined
      };
    case "githubRestoreDownloadSucceeded":
      return {
        ...state,
        screen: "github_status",
        githubLastRestorePulledAt:
          normalizeOptionalInput(action.timestamp) ?? state.githubLastRestorePulledAt,
        githubSelectedSnapshotTimestamp: normalizeOptionalInput(action.timestamp),
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined
      };
    case "setGitHubLastRestorePulledAt":
      return {
        ...state,
        githubLastRestorePulledAt: normalizeOptionalInput(action.value)
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
        case "github_status":
          return { ...state, screen: "calendar_menu" };
        case "github_connect_mode":
          return { ...state, screen: "github_status" };
        case "github_connect_repo_input":
          return { ...state, screen: "github_connect_mode" };
        case "github_connect_public_confirm":
          return { ...state, screen: "github_connect_repo_input", githubPublicConfirmInput: "" };
        case "github_push_done":
          return { ...state, screen: "github_status" };
        case "github_restore_picker":
          return { ...state, screen: "github_status" };
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
        case "import_picker":
          return { ...state, screen: "menu" };
        case "import_path":
          return { ...state, screen: "import_picker" };
        case "import_mode":
          return { ...state, screen: "import_picker" };
        case "import_confirm":
          return {
            ...state,
            screen: "import_mode",
            replaceConfirmInput: "",
            replaceConfirmed: false
          };
        case "import_dryrun":
          return { ...state, screen: "import_mode" };
        case "github_connecting":
        case "github_push_running":
        case "github_restore_loading":
        case "github_restore_downloading":
          return state;
        default:
          return state;
      }
    default:
      return state;
  }
}
