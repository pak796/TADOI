import type { BackupCenterAction, BackupCenterState } from "./backupCenterFlow";
import { normalizeOptionalInput } from "./backupCenterShared";

type CalendarBackupAction = Extract<
  BackupCenterAction,
  | { type: "setCalendarTimeZoneHint" }
  | { type: "setCalendarExportRange" }
  | { type: "setCalendarExportViewName" }
  | { type: "setCalendarExportPrivacy" }
  | { type: "setCalendarExportPath" }
  | { type: "startCalendarExport" }
  | { type: "calendarExportSucceeded" }
  | { type: "setCalendarImportPath" }
  | { type: "setCalendarImportRange" }
  | { type: "setCalendarImportViewName" }
  | { type: "setCalendarImportMode" }
  | { type: "setCalendarImportHorizonInput" }
  | { type: "setCalendarImportTagInput" }
  | { type: "setCalendarImportConfirmInput" }
  | { type: "startCalendarImportDryRun" }
  | { type: "calendarImportDryRunSucceeded" }
  | { type: "startCalendarImporting" }
  | { type: "calendarImportSucceeded" }
>;

export function toCalendarImportFingerprint(
  state: BackupCenterState,
): string | undefined {
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
    importTag: normalizeOptionalInput(state.calendarImportTagInput),
  });
}

export function shouldRequireCalendarImportConfirm(
  state: BackupCenterState,
): boolean {
  return (
    state.calendarImportMode === "update" || state.calendarImportRange === "all"
  );
}

export function isCalendarImportConfirmValid(
  state: BackupCenterState,
): boolean {
  return state.calendarImportConfirmInput.trim() === "IMPORT";
}

export function hasMatchingCalendarImportDryRun(
  state: BackupCenterState,
): boolean {
  if (!state.calendarImportDryRun || !state.calendarImportDryRunFingerprint) {
    return false;
  }
  return (
    state.calendarImportDryRunFingerprint === toCalendarImportFingerprint(state)
  );
}

export function resetCalendarExportState(
  state: BackupCenterState,
): BackupCenterState {
  return {
    ...state,
    calendarExportRange: "next7",
    calendarExportViewName: undefined,
    calendarExportPrivacy: "minimal",
    calendarExportPathInput: "",
    calendarExportResult: undefined,
    calendarExportWarnings: [],
  };
}

export function resetCalendarImportState(
  state: BackupCenterState,
): BackupCenterState {
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
    calendarImportConfirmInput: "",
  };
}

function resetCalendarImportProgress(
  state: BackupCenterState,
): Partial<BackupCenterState> {
  return {
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
    calendarImportConfirmInput: "",
  };
}

export function isCalendarBackupAction(
  action: BackupCenterAction,
): action is CalendarBackupAction {
  return (
    action.type === "setCalendarTimeZoneHint" ||
    action.type === "setCalendarExportRange" ||
    action.type === "setCalendarExportViewName" ||
    action.type === "setCalendarExportPrivacy" ||
    action.type === "setCalendarExportPath" ||
    action.type === "startCalendarExport" ||
    action.type === "calendarExportSucceeded" ||
    action.type === "setCalendarImportPath" ||
    action.type === "setCalendarImportRange" ||
    action.type === "setCalendarImportViewName" ||
    action.type === "setCalendarImportMode" ||
    action.type === "setCalendarImportHorizonInput" ||
    action.type === "setCalendarImportTagInput" ||
    action.type === "setCalendarImportConfirmInput" ||
    action.type === "startCalendarImportDryRun" ||
    action.type === "calendarImportDryRunSucceeded" ||
    action.type === "startCalendarImporting" ||
    action.type === "calendarImportSucceeded"
  );
}

export function reduceCalendarBackupFlow(
  state: BackupCenterState,
  action: CalendarBackupAction,
): BackupCenterState {
  switch (action.type) {
    case "setCalendarTimeZoneHint":
      return {
        ...state,
        calendarTimeZoneHint: normalizeOptionalInput(action.value),
      };
    case "setCalendarExportRange":
      return { ...state, calendarExportRange: action.range };
    case "setCalendarExportViewName":
      return {
        ...state,
        calendarExportViewName: normalizeOptionalInput(action.viewName),
      };
    case "setCalendarExportPrivacy":
      return { ...state, calendarExportPrivacy: action.privacy };
    case "setCalendarExportPath":
      return { ...state, calendarExportPathInput: action.value };
    case "startCalendarExport":
      return {
        ...state,
        screen: "calendar_exporting",
        calendarExportResult: undefined,
        calendarExportWarnings: [],
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined,
      };
    case "calendarExportSucceeded":
      return {
        ...state,
        screen: "calendar_export_done",
        calendarExportResult: action.result,
        calendarExportWarnings: [...(action.warnings ?? [])],
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined,
      };
    case "setCalendarImportPath":
      return {
        ...state,
        calendarImportPathInput: action.value,
        ...resetCalendarImportProgress(state),
      };
    case "setCalendarImportRange":
      return {
        ...state,
        calendarImportRange: action.range,
        ...resetCalendarImportProgress(state),
      };
    case "setCalendarImportViewName":
      return {
        ...state,
        calendarImportViewName: normalizeOptionalInput(action.viewName),
        ...resetCalendarImportProgress(state),
      };
    case "setCalendarImportMode":
      return {
        ...state,
        calendarImportMode: action.mode,
        ...resetCalendarImportProgress(state),
      };
    case "setCalendarImportHorizonInput":
      return {
        ...state,
        calendarImportHorizonInput: action.value,
        ...resetCalendarImportProgress(state),
      };
    case "setCalendarImportTagInput":
      return {
        ...state,
        calendarImportTagInput: action.value,
        ...resetCalendarImportProgress(state),
      };
    case "setCalendarImportConfirmInput":
      return { ...state, calendarImportConfirmInput: action.value };
    case "startCalendarImportDryRun":
      return {
        ...state,
        screen: "calendar_import_dryrun_running",
        ...resetCalendarImportProgress(state),
        errorMessage: undefined,
        errorDetail: undefined,
        errorReturnScreen: undefined,
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
        errorReturnScreen: undefined,
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
        errorReturnScreen: undefined,
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
        errorReturnScreen: undefined,
      };
  }
}
