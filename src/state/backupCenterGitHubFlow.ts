import type { BackupCenterAction, BackupCenterState } from "./backupCenterFlow";
import {
  ensureGitHubSnapshotSelectionVisible,
  normalizeImportPickerVisibleRows,
  normalizeOptionalInput,
} from "./backupCenterShared";

type GitHubBackupAction = Extract<
  BackupCenterAction,
  | { type: "openGitHubStatus" }
  | { type: "setGitHubStatus" }
  | { type: "openGitHubConnectMode" }
  | { type: "setGitHubConnectMode" }
  | { type: "setGitHubRepoNameInput" }
  | { type: "setGitHubOwnerRepoInput" }
  | { type: "setGitHubPublicConfirmInput" }
  | { type: "startGitHubConnect" }
  | { type: "githubConnectSucceeded" }
  | { type: "startGitHubPush" }
  | { type: "githubPushSucceeded" }
  | { type: "startGitHubRestoreLoad" }
  | { type: "githubRestoreLoadSucceeded" }
  | { type: "githubRestoreLoadFailed" }
  | { type: "moveGitHubSnapshotSelection" }
  | { type: "pageGitHubSnapshotSelection" }
  | { type: "jumpGitHubSnapshotSelection" }
  | { type: "setGitHubSnapshotSelection" }
  | { type: "startGitHubRestoreDownload" }
  | { type: "githubRestoreDownloadSucceeded" }
  | { type: "setGitHubLastRestorePulledAt" }
>;

export function isGitHubBackupAction(
  action: BackupCenterAction,
): action is GitHubBackupAction {
  return (
    action.type === "openGitHubStatus" ||
    action.type === "setGitHubStatus" ||
    action.type === "openGitHubConnectMode" ||
    action.type === "setGitHubConnectMode" ||
    action.type === "setGitHubRepoNameInput" ||
    action.type === "setGitHubOwnerRepoInput" ||
    action.type === "setGitHubPublicConfirmInput" ||
    action.type === "startGitHubConnect" ||
    action.type === "githubConnectSucceeded" ||
    action.type === "startGitHubPush" ||
    action.type === "githubPushSucceeded" ||
    action.type === "startGitHubRestoreLoad" ||
    action.type === "githubRestoreLoadSucceeded" ||
    action.type === "githubRestoreLoadFailed" ||
    action.type === "moveGitHubSnapshotSelection" ||
    action.type === "pageGitHubSnapshotSelection" ||
    action.type === "jumpGitHubSnapshotSelection" ||
    action.type === "setGitHubSnapshotSelection" ||
    action.type === "startGitHubRestoreDownload" ||
    action.type === "githubRestoreDownloadSucceeded" ||
    action.type === "setGitHubLastRestorePulledAt"
  );
}

export function reduceGitHubBackupFlow(
  state: BackupCenterState,
  action: GitHubBackupAction,
): BackupCenterState {
  switch (action.type) {
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
        errorReturnScreen: undefined,
      };
    case "setGitHubStatus":
      return {
        ...state,
        githubGhDetected: action.ghDetected,
        githubLoggedIn: action.loggedIn,
        githubUsername: normalizeOptionalInput(action.username),
        githubOwnerRepoConfigured: normalizeOptionalInput(
          action.ownerRepoConfigured,
        ),
        githubRepoIsPublic: action.repoIsPublic,
        githubSnapshotEncryptionActive:
          action.snapshotEncryptionActive === true,
        githubAutoPushPolicy: action.autoPushPolicy,
        githubLastPushedAt: normalizeOptionalInput(action.lastPushedAt),
        githubLastRestorePulledAt: normalizeOptionalInput(
          action.lastRestorePulledAt,
        ),
      };
    case "openGitHubConnectMode":
      return {
        ...state,
        screen: "github_connect_mode",
        githubPublicConfirmInput: "",
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined,
      };
    case "setGitHubConnectMode":
      return {
        ...state,
        githubConnectMode: action.mode,
        githubPublicConfirmInput: "",
      };
    case "setGitHubRepoNameInput":
      return { ...state, githubRepoNameInput: action.value };
    case "setGitHubOwnerRepoInput":
      return { ...state, githubOwnerRepoInput: action.value };
    case "setGitHubPublicConfirmInput":
      return { ...state, githubPublicConfirmInput: action.value };
    case "startGitHubConnect":
      return {
        ...state,
        screen: "github_connecting",
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined,
      };
    case "githubConnectSucceeded":
      return {
        ...state,
        screen: "github_status",
        githubOwnerRepoConfigured: normalizeOptionalInput(action.ownerRepo),
        githubPublicConfirmInput: "",
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined,
      };
    case "startGitHubPush":
      return {
        ...state,
        screen: "github_push_running",
        githubPushCommitSha: undefined,
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined,
      };
    case "githubPushSucceeded":
      return {
        ...state,
        screen: "github_push_done",
        githubLastPushedAt: normalizeOptionalInput(action.timestamp),
        githubPushCommitSha: normalizeOptionalInput(action.commitSha),
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined,
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
        errorReturnScreen: undefined,
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
        errorReturnScreen: undefined,
      };
    case "githubRestoreLoadFailed":
      return {
        ...state,
        screen: "github_restore_picker",
        githubSnapshots: [],
        githubSnapshotSelectedIndex: 0,
        githubSnapshotScrollOffset: 0,
        githubSnapshotLoading: false,
        githubSnapshotError: action.error,
      };
    case "moveGitHubSnapshotSelection": {
      if (state.screen !== "github_restore_picker") return state;
      const current = ensureGitHubSnapshotSelectionVisible(
        state.githubSnapshots,
        state.githubSnapshotSelectedIndex + action.delta,
        state.githubSnapshotScrollOffset,
        action.visibleRows,
      );
      return {
        ...state,
        githubSnapshotSelectedIndex: current.selectedIndex,
        githubSnapshotScrollOffset: current.scrollOffset,
      };
    }
    case "pageGitHubSnapshotSelection": {
      if (state.screen !== "github_restore_picker") return state;
      const rows = normalizeImportPickerVisibleRows(action.visibleRows);
      const current = ensureGitHubSnapshotSelectionVisible(
        state.githubSnapshots,
        state.githubSnapshotSelectedIndex + action.delta * rows,
        state.githubSnapshotScrollOffset,
        rows,
      );
      return {
        ...state,
        githubSnapshotSelectedIndex: current.selectedIndex,
        githubSnapshotScrollOffset: current.scrollOffset,
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
        action.visibleRows,
      );
      return {
        ...state,
        githubSnapshotSelectedIndex: current.selectedIndex,
        githubSnapshotScrollOffset: current.scrollOffset,
      };
    }
    case "setGitHubSnapshotSelection": {
      if (state.screen !== "github_restore_picker") return state;
      const current = ensureGitHubSnapshotSelectionVisible(
        state.githubSnapshots,
        action.index,
        state.githubSnapshotScrollOffset,
        action.visibleRows,
      );
      return {
        ...state,
        githubSnapshotSelectedIndex: current.selectedIndex,
        githubSnapshotScrollOffset: current.scrollOffset,
      };
    }
    case "startGitHubRestoreDownload":
      return {
        ...state,
        screen: "github_restore_downloading",
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined,
      };
    case "githubRestoreDownloadSucceeded":
      return {
        ...state,
        screen: "github_status",
        githubLastRestorePulledAt:
          normalizeOptionalInput(action.timestamp) ??
          state.githubLastRestorePulledAt,
        githubSelectedSnapshotTimestamp: normalizeOptionalInput(
          action.timestamp,
        ),
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined,
      };
    case "setGitHubLastRestorePulledAt":
      return {
        ...state,
        githubLastRestorePulledAt: normalizeOptionalInput(action.value),
      };
  }
}
