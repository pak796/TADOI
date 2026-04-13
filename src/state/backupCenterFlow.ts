import type { CalendarEventPrivacyMode } from "../calendar/calendarMapper";
import type { CalendarImportMode } from "../calendar/importMapper";
import type { CalendarExportRange } from "../calendar/range";
import type { BackupFileInfo, BackupImportSummary } from "./backupService";
import type { CalendarExportResult } from "./calendarExportService";
import type { CalendarImportSummary } from "./calendarImportService";
import type { ImportMode } from "./portability";
import type { GitHubAutoPushPolicy } from "../settings/settings";
import {
  isCalendarBackupAction,
  reduceCalendarBackupFlow,
  resetCalendarExportState,
  resetCalendarImportState,
} from "./backupCenterCalendarFlow";
import {
  isGitHubBackupAction,
  reduceGitHubBackupFlow,
} from "./backupCenterGitHubFlow";
import {
  isJsonBackupAction,
  reduceJsonBackupFlow,
} from "./backupCenterJsonFlow";
import { normalizeOptionalInput } from "./backupCenterShared";

export {
  hasMatchingCalendarImportDryRun,
  isCalendarImportConfirmValid,
  shouldRequireCalendarImportConfirm,
  toCalendarImportFingerprint,
} from "./backupCenterCalendarFlow";

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
  githubRepoIsPublic?: boolean;
  githubSnapshotEncryptionActive: boolean;
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
  | {
      type: "loadImportPickerFilesFailure";
      directoryPath: string;
      error: string;
    }
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
  | {
      type: "calendarExportSucceeded";
      result: CalendarExportResult;
      warnings?: string[];
    }
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
      repoIsPublic?: boolean;
      snapshotEncryptionActive?: boolean;
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
  | {
      type: "jumpGitHubSnapshotSelection";
      target: "start" | "end";
      visibleRows: number;
    }
  | { type: "setGitHubSnapshotSelection"; index: number; visibleRows: number }
  | { type: "startGitHubRestoreDownload" }
  | { type: "githubRestoreDownloadSucceeded"; timestamp?: string }
  | { type: "setGitHubLastRestorePulledAt"; value?: string }
  | {
      type: "setError";
      message: string;
      detail?: string;
      returnScreen?: BackupCenterScreen;
    }
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
  githubSnapshotEncryptionActive: false,
  githubAutoPushPolicy: "off",
  githubConnectMode: "create",
  githubRepoNameInput: "tadoi-backups",
  githubOwnerRepoInput: "",
  githubPublicConfirmInput: "",
  githubSnapshots: [],
  githubSnapshotSelectedIndex: 0,
  githubSnapshotScrollOffset: 0,
  githubSnapshotLoading: false,
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
  action: BackupCenterAction,
): BackupCenterState {
  if (isJsonBackupAction(action)) {
    return reduceJsonBackupFlow(state, action);
  }
  if (isCalendarBackupAction(action)) {
    return reduceCalendarBackupFlow(state, action);
  }
  if (isGitHubBackupAction(action)) {
    return reduceGitHubBackupFlow(state, action);
  }

  switch (action.type) {
    case "reset":
      return { ...initialBackupCenterState };
    case "openMenu":
      return {
        ...state,
        screen: "menu",
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined,
      };
    case "setScreen":
      return {
        ...state,
        screen: action.screen,
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined,
      };
    case "moveMenuIndex": {
      if (state.screen === "calendar_menu") {
        const next = ((state.calendarMenuIndex + action.delta + 4) %
          4) as CalendarMenuIndex;
        return { ...state, calendarMenuIndex: next };
      }
      const next = ((state.menuIndex + action.delta + 4) % 4) as MainMenuIndex;
      return { ...state, menuIndex: next };
    }
    case "setMenuIndex":
      return { ...state, menuIndex: action.index };
    case "moveCalendarMenuIndex": {
      const next = ((state.calendarMenuIndex + action.delta + 4) %
        4) as CalendarMenuIndex;
      return { ...state, calendarMenuIndex: next };
    }
    case "setCalendarMenuIndex":
      return { ...state, calendarMenuIndex: action.index };
    case "setError":
      return {
        ...state,
        screen: "error",
        errorMessage: action.message,
        errorDetail: action.detail,
        errorReturnScreen: action.returnScreen,
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
            screen: "menu",
          };
        case "github_status":
          return { ...state, screen: "calendar_menu" };
        case "github_connect_mode":
          return { ...state, screen: "github_status" };
        case "github_connect_repo_input":
          return { ...state, screen: "github_connect_mode" };
        case "github_connect_public_confirm":
          return {
            ...state,
            screen: "github_connect_repo_input",
            githubPublicConfirmInput: "",
          };
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
            calendarImportConfirmInput: "",
          };
        case "calendar_import_done":
          return { ...state, screen: "calendar_menu" };
        case "error":
          return {
            ...state,
            screen: state.errorReturnScreen ?? "menu",
            errorMessage: undefined,
            errorDetail: undefined,
            errorReturnScreen: undefined,
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
            replaceConfirmed: false,
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
