import React, { useEffect, useRef } from "react";
import type { ScrollBoxRenderable } from "@opentui/core";
import type { CalendarEventPrivacyMode } from "../calendar/calendarMapper";
import type { CalendarImportMode } from "../calendar/importMapper";
import type { CalendarExportRange } from "../calendar/range";
import { themeForObject, type RuntimeTheme } from "../app/theme";
import type { BackupCenterState } from "../state/backupCenterFlow";

type BackupButtonTone = "primary" | "danger" | "neutral";

type BackupCenterScreenProps = {
  state: BackupCenterState;
  dataPath: string;
  importPickerVisibleRows: number;
  bodyScrollRequest: { token: number; delta: number };
  savedViewNames: string[];
  onImportPathChange: (value: string) => void;
  onImportPickerSelectIndex: (index: number) => void;
  onImportPickerWheelScroll: (delta: 1 | -1) => void;
  onOpenImportPathFallback: () => void;
  onReplaceConfirmChange: (value: string) => void;
  onCalendarExportPathChange: (value: string) => void;
  onCalendarImportPathChange: (value: string) => void;
  onCalendarImportHorizonChange: (value: string) => void;
  onCalendarImportTagChange: (value: string) => void;
  onCalendarImportConfirmChange: (value: string) => void;
  onPrimaryAction: () => void;
  onBackAction: () => void;
  onMenuSelect: (index: 0 | 1 | 2 | 3) => void;
  onCalendarMenuSelect: (index: 0 | 1 | 2) => void;
  onImportModeSelect: (mode: "merge" | "replace") => void;
  onCalendarExportRangeSelect: (range: CalendarExportRange) => void;
  onCalendarExportViewSelect: (viewName?: string) => void;
  onCalendarExportPrivacySelect: (privacy: CalendarEventPrivacyMode) => void;
  onCalendarImportRangeSelect: (range: CalendarExportRange) => void;
  onCalendarImportViewSelect: (viewName?: string) => void;
  onCalendarImportModeSelect: (mode: CalendarImportMode) => void;
};

type BackupActionButtonProps = {
  label: string;
  onPress: () => void;
  tone?: BackupButtonTone;
  active?: boolean;
};

type SelectableOptionLineProps = {
  label: string;
  theme: RuntimeTheme;
  selected?: boolean;
  onSelect?: () => void;
};

type BackupFooterAction = {
  key: string;
  label: string;
  onPress: () => void;
  tone?: BackupButtonTone;
  active?: boolean;
};

function renderImportStats(
  label: string,
  value: number,
  theme: RuntimeTheme
): React.ReactNode {
  return (
    <box style={{ flexDirection: "row", gap: 1 }}>
      <text style={{ color: theme.muted }}>{label}:</text>
      <text style={{ color: theme.text }}>{value}</text>
    </box>
  );
}

export function formatBackupFileTimestamp(mtimeMs: number): string {
  const date = new Date(mtimeMs);
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

export function formatBackupFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${String(sizeBytes)} B`;
  const kib = sizeBytes / 1024;
  if (kib < 1024) return `${kib.toFixed(1)} KiB`;
  const mib = kib / 1024;
  return `${mib.toFixed(1)} MiB`;
}

export function getStepLabel(screen: BackupCenterState["screen"]): string {
  switch (screen) {
    case "menu":
      return "MENU";
    case "calendar_menu":
      return "CALENDAR / MENU";
    case "exporting":
    case "export_done":
      return "DATA / EXPORT";
    case "import_picker":
    case "import_path":
    case "import_mode":
    case "import_confirm":
    case "import_dryrun":
    case "importing":
    case "import_done":
      return "DATA / IMPORT";
    case "show_path":
      return "DATA PATH";
    case "calendar_export_intro":
    case "calendar_export_range":
    case "calendar_export_view":
    case "calendar_export_privacy":
    case "calendar_export_path":
    case "calendar_export_confirm":
    case "calendar_exporting":
    case "calendar_export_done":
      return "CALENDAR / EXPORT";
    case "calendar_import_intro":
    case "calendar_import_path":
    case "calendar_import_range":
    case "calendar_import_view":
    case "calendar_import_mode":
    case "calendar_import_horizon":
    case "calendar_import_tag":
    case "calendar_import_dryrun_running":
    case "calendar_import_dryrun":
    case "calendar_import_confirm":
    case "calendar_importing":
    case "calendar_import_done":
      return "CALENDAR / IMPORT";
    case "error":
      return "ERROR";
    default:
      return "BACKUP";
  }
}

function BackupActionButton({
  label,
  onPress,
  tone = "primary",
  active = false
}: BackupActionButtonProps) {
  const theme = themeForObject("modal");
  const backgroundColor = active
    ? theme.accentBlue
    : tone === "danger"
      ? theme.warn
      : tone === "neutral"
        ? theme.bg
        : theme.accentBlue;
  const textColor = active
    ? theme.bg
    : tone === "danger"
      ? theme.bg
      : tone === "neutral"
        ? theme.text
        : theme.bg;

  return (
    <box
      style={{ backgroundColor, paddingLeft: 1, paddingRight: 1 }}
      onMouseDown={(event) => {
        if (typeof event.button === "number" && event.button !== 0) return;
        onPress();
      }}
    >
      <text style={{ color: textColor, fontWeight: "bold" }}>{label}</text>
    </box>
  );
}

function SelectableOptionLine({
  label,
  theme,
  selected = false,
  onSelect
}: SelectableOptionLineProps) {
  return (
    <box
      style={{
        backgroundColor: selected ? theme.accentBlue : "transparent",
        paddingLeft: 1,
        paddingRight: 1
      }}
      onMouseDown={(event) => {
        if (!onSelect) return;
        if (typeof event.button === "number" && event.button !== 0) return;
        onSelect();
      }}
    >
      <text style={{ color: selected ? theme.bg : theme.text }}>
        {selected ? "> " : "  "}
        {label}
      </text>
    </box>
  );
}

export function isScreenForInput(state: BackupCenterState["screen"], kind: string): boolean {
  if (kind === "data-import-path") return state === "import_path";
  if (kind === "data-replace-confirm") return state === "import_confirm";
  if (kind === "calendar-export-path") return state === "calendar_export_path";
  if (kind === "calendar-import-path") return state === "calendar_import_path";
  if (kind === "calendar-import-horizon") return state === "calendar_import_horizon";
  if (kind === "calendar-import-tag") return state === "calendar_import_tag";
  if (kind === "calendar-import-confirm") return state === "calendar_import_confirm";
  return false;
}

export type ImportPickerWindow = {
  selectedIndex: number;
  start: number;
  end: number;
};

export function resolveImportPickerWindow(options: {
  fileCount: number;
  selectedIndex: number;
  scrollOffset: number;
  visibleRows: number;
}): ImportPickerWindow {
  const pickerRows = Math.max(4, Math.min(8, options.visibleRows));
  const pickerSelectedIndex = Math.max(
    0,
    Math.min(options.selectedIndex, Math.max(0, options.fileCount - 1))
  );
  const pickerMaxOffset = Math.max(0, options.fileCount - pickerRows);
  let pickerStart = Math.max(0, Math.min(options.scrollOffset, pickerMaxOffset));
  if (pickerSelectedIndex < pickerStart) {
    pickerStart = pickerSelectedIndex;
  } else if (pickerSelectedIndex >= pickerStart + pickerRows) {
    pickerStart = pickerSelectedIndex - pickerRows + 1;
  }
  pickerStart = Math.max(0, Math.min(pickerStart, pickerMaxOffset));
  const pickerEnd = Math.min(options.fileCount, pickerStart + pickerRows);
  return {
    selectedIndex: pickerSelectedIndex,
    start: pickerStart,
    end: pickerEnd
  };
}

export function resolveBackupWheelDelta(
  direction: "up" | "down" | "left" | "right" | undefined
): 1 | -1 | 0 {
  if (direction === "up") return -1;
  if (direction === "down") return 1;
  return 0;
}

export function BackupCenterScreen({
  state,
  dataPath,
  importPickerVisibleRows,
  bodyScrollRequest,
  savedViewNames,
  onImportPathChange,
  onImportPickerSelectIndex,
  onImportPickerWheelScroll,
  onOpenImportPathFallback,
  onReplaceConfirmChange,
  onCalendarExportPathChange,
  onCalendarImportPathChange,
  onCalendarImportHorizonChange,
  onCalendarImportTagChange,
  onCalendarImportConfirmChange,
  onPrimaryAction,
  onBackAction,
  onMenuSelect,
  onCalendarMenuSelect,
  onImportModeSelect,
  onCalendarExportRangeSelect,
  onCalendarExportViewSelect,
  onCalendarExportPrivacySelect,
  onCalendarImportRangeSelect,
  onCalendarImportViewSelect,
  onCalendarImportModeSelect
}: BackupCenterScreenProps) {
  const theme = themeForObject("modal");
  const inputTheme = themeForObject("inputs");
  const modeLabel = state.importMode === "replace" ? "REPLACE" : "MERGE";
  const replaceArmed =
    state.importMode === "replace" && state.replaceConfirmed ? "YES" : "NO";
  const dryRun = state.dryRun;
  const committed = state.committed;
  const stepLabel = getStepLabel(state.screen);

  const rootMenuOptions: Array<{ index: 0 | 1 | 2 | 3; label: string }> = [
    { index: 0, label: "1) Export backup (recommended)" },
    { index: 1, label: "2) Import data..." },
    { index: 2, label: "3) Show data path" },
    { index: 3, label: "4) Calendar (ICS)..." }
  ];
  const calendarMenuOptions: Array<{ index: 0 | 1 | 2; label: string }> = [
    { index: 0, label: "1) Export Calendar (.ics)" },
    { index: 1, label: "2) Import Calendar (.ics)" },
    { index: 2, label: "3) Back" }
  ];

  const calendarViewChoices: Array<{ label: string; value?: string }> = [
    { label: "(All tasks)", value: undefined },
    ...savedViewNames.map((name) => ({ label: name, value: name }))
  ];

  const shouldBlockCalendarCommit =
    !state.calendarImportDryRun ||
    state.calendarImportDryRunHasErrors ||
    state.calendarImportDryRunFingerprint === undefined;
  const pickerWindow = resolveImportPickerWindow({
    fileCount: state.importPickerFiles.length,
    selectedIndex: state.importPickerSelectedIndex,
    scrollOffset: state.importPickerScrollOffset,
    visibleRows: importPickerVisibleRows
  });
  const pickerVisibleFiles = state.importPickerFiles.slice(pickerWindow.start, pickerWindow.end);
  const bodyScrollboxRef = useRef<ScrollBoxRenderable | null>(null);

  useEffect(() => {
    bodyScrollboxRef.current?.scrollTo({ x: 0, y: 0 });
  }, [state.screen]);

  useEffect(() => {
    if (bodyScrollRequest.delta === 0) return;
    bodyScrollboxRef.current?.scrollBy({ x: 0, y: bodyScrollRequest.delta });
  }, [bodyScrollRequest.token, bodyScrollRequest.delta]);

  let footerActions: BackupFooterAction[] = [];
  switch (state.screen) {
    case "menu":
      footerActions = [
        { key: "export", label: "EXPORT", onPress: () => onMenuSelect(0) },
        { key: "import", label: "IMPORT", onPress: () => onMenuSelect(1) },
        { key: "show-path", label: "SHOW PATH", onPress: () => onMenuSelect(2) },
        { key: "calendar", label: "CALENDAR", onPress: () => onMenuSelect(3) },
        { key: "close", label: "CLOSE", onPress: onBackAction, tone: "neutral" }
      ];
      break;
    case "calendar_menu":
      footerActions = [
        { key: "cal-export", label: "EXPORT ICS", onPress: () => onCalendarMenuSelect(0) },
        { key: "cal-import", label: "IMPORT ICS", onPress: () => onCalendarMenuSelect(1) },
        { key: "back", label: "BACK", onPress: () => onCalendarMenuSelect(2), tone: "neutral" }
      ];
      break;
    case "import_mode":
      footerActions = [
        {
          key: "merge",
          label: "MERGE",
          onPress: () => onImportModeSelect("merge"),
          active: state.importMode === "merge"
        },
        {
          key: "replace",
          label: "REPLACE",
          onPress: () => onImportModeSelect("replace"),
          tone: "danger",
          active: state.importMode === "replace"
        },
        { key: "dry-run", label: "DRY-RUN", onPress: onPrimaryAction },
        { key: "back", label: "BACK", onPress: onBackAction, tone: "neutral" }
      ];
      break;
    case "calendar_export_range":
      footerActions = [
        {
          key: "next7",
          label: "NEXT7",
          onPress: () => onCalendarExportRangeSelect("next7"),
          active: state.calendarExportRange === "next7"
        },
        {
          key: "month",
          label: "MONTH",
          onPress: () => onCalendarExportRangeSelect("month"),
          active: state.calendarExportRange === "month"
        },
        {
          key: "all",
          label: "ALL",
          onPress: () => onCalendarExportRangeSelect("all"),
          active: state.calendarExportRange === "all"
        },
        { key: "continue", label: "CONTINUE", onPress: onPrimaryAction },
        { key: "back", label: "BACK", onPress: onBackAction, tone: "neutral" }
      ];
      break;
    case "calendar_export_view":
      footerActions = [
        { key: "continue", label: "CONTINUE", onPress: onPrimaryAction },
        { key: "back", label: "BACK", onPress: onBackAction, tone: "neutral" }
      ];
      break;
    case "calendar_export_privacy":
      footerActions = [
        {
          key: "minimal",
          label: "MINIMAL",
          onPress: () => onCalendarExportPrivacySelect("minimal"),
          active: state.calendarExportPrivacy === "minimal"
        },
        {
          key: "full",
          label: "FULL",
          onPress: () => onCalendarExportPrivacySelect("full"),
          active: state.calendarExportPrivacy === "full"
        },
        { key: "continue", label: "CONTINUE", onPress: onPrimaryAction },
        { key: "back", label: "BACK", onPress: onBackAction, tone: "neutral" }
      ];
      break;
    case "calendar_import_range":
      footerActions = [
        {
          key: "next7",
          label: "NEXT7",
          onPress: () => onCalendarImportRangeSelect("next7"),
          active: state.calendarImportRange === "next7"
        },
        {
          key: "month",
          label: "MONTH",
          onPress: () => onCalendarImportRangeSelect("month"),
          active: state.calendarImportRange === "month"
        },
        {
          key: "all",
          label: "ALL",
          onPress: () => onCalendarImportRangeSelect("all"),
          active: state.calendarImportRange === "all"
        },
        { key: "continue", label: "CONTINUE", onPress: onPrimaryAction },
        { key: "back", label: "BACK", onPress: onBackAction, tone: "neutral" }
      ];
      break;
    case "calendar_import_view":
      footerActions = [
        { key: "continue", label: "CONTINUE", onPress: onPrimaryAction },
        { key: "back", label: "BACK", onPress: onBackAction, tone: "neutral" }
      ];
      break;
    case "calendar_import_mode":
      footerActions = [
        {
          key: "merge",
          label: "MERGE",
          onPress: () => onCalendarImportModeSelect("merge"),
          active: state.calendarImportMode === "merge"
        },
        {
          key: "update",
          label: "UPDATE",
          onPress: () => onCalendarImportModeSelect("update"),
          active: state.calendarImportMode === "update"
        },
        {
          key: "create",
          label: "CREATE",
          onPress: () => onCalendarImportModeSelect("create"),
          active: state.calendarImportMode === "create"
        },
        { key: "continue", label: "CONTINUE", onPress: onPrimaryAction },
        { key: "back", label: "BACK", onPress: onBackAction, tone: "neutral" }
      ];
      break;
    case "calendar_import_dryrun":
      footerActions = [
        {
          key: "commit",
          label: shouldBlockCalendarCommit ? "COMMIT BLOCKED" : "COMMIT IMPORT",
          onPress: shouldBlockCalendarCommit ? () => {} : onPrimaryAction,
          tone: shouldBlockCalendarCommit ? "neutral" : "primary"
        },
        { key: "back", label: "BACK", onPress: onBackAction, tone: "neutral" }
      ];
      break;
    case "import_picker":
      footerActions = [
        {
          key: "select",
          label: state.importPickerFiles.length > 0 ? "SELECT" : "SELECT (NONE)",
          onPress: state.importPickerFiles.length > 0 ? onPrimaryAction : () => {}
        },
        {
          key: "manual-path",
          label: "MANUAL PATH",
          onPress: onOpenImportPathFallback,
          tone: "neutral"
        },
        { key: "back", label: "BACK", onPress: onBackAction, tone: "neutral" }
      ];
      break;
    case "import_path":
    case "calendar_export_intro":
    case "calendar_export_path":
    case "calendar_export_confirm":
    case "calendar_import_intro":
    case "calendar_import_path":
    case "calendar_import_horizon":
    case "calendar_import_tag":
    case "calendar_import_confirm":
      footerActions = [
        { key: "continue", label: "CONTINUE", onPress: onPrimaryAction },
        { key: "back", label: "BACK", onPress: onBackAction, tone: "neutral" }
      ];
      break;
    case "import_confirm":
      footerActions = [
        {
          key: "confirm-replace",
          label: "CONFIRM REPLACE",
          onPress: onPrimaryAction,
          tone: "danger"
        },
        { key: "cancel", label: "CANCEL", onPress: onBackAction, tone: "neutral" }
      ];
      break;
    case "import_dryrun":
      footerActions = [
        { key: "commit", label: "COMMIT IMPORT", onPress: onPrimaryAction },
        { key: "back", label: "BACK", onPress: onBackAction, tone: "neutral" }
      ];
      break;
    case "export_done":
    case "import_done":
    case "show_path":
    case "calendar_export_done":
    case "calendar_import_done":
    case "error":
      footerActions = [{ key: "back", label: "BACK", onPress: onPrimaryAction }];
      break;
    case "exporting":
    case "importing":
    case "calendar_exporting":
    case "calendar_import_dryrun_running":
    case "calendar_importing":
    default:
      footerActions = [];
      break;
  }

  return (
    <box
      style={{
        width: 98,
        maxWidth: "100%",
        height: "100%",
        maxHeight: "100%",
        flexDirection: "column",
        backgroundColor: theme.panel,
        border: true,
        borderStyle: "single",
        borderColor: theme.outline,
        padding: 1,
        overflow: "hidden"
      }}
    >
      <text style={{ color: theme.text, fontWeight: "bold" }}>Backup Center</text>
      <text style={{ color: theme.muted }}>Guided backup, import, and calendar flows</text>
      <box style={{ flexDirection: "row", gap: 2, marginTop: 1 }}>
        <text style={{ color: theme.muted }}>STEP: {stepLabel}</text>
        <text style={{ color: theme.muted }}>DATA MODE: {modeLabel}</text>
      </box>

      <box style={{ flexDirection: "column", flexGrow: 1, marginTop: 1, overflow: "hidden" }}>
        <scrollbox ref={bodyScrollboxRef} scrollY style={{ flexGrow: 1, paddingRight: 1 }}>
      {state.screen === "menu" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          {rootMenuOptions.map((option) => {
            const selected = state.menuIndex === option.index;
            return (
              <SelectableOptionLine
                key={option.label}
                label={option.label}
                selected={selected}
                theme={theme}
                onSelect={() => onMenuSelect(option.index)}
              />
            );
          })}
          <text style={{ color: theme.muted, marginTop: 1 }}>
            1/2/3/4 or Enter: select   j/k: move   Esc: close Backup Center
          </text>
        </box>
      ) : null}

      {state.screen === "calendar_menu" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.text, fontWeight: "bold" }}>
            CALENDAR (ICS): Export / Import
          </text>
          {calendarMenuOptions.map((option) => {
            const selected = state.calendarMenuIndex === option.index;
            return (
              <SelectableOptionLine
                key={option.label}
                label={option.label}
                selected={selected}
                theme={theme}
                onSelect={() => onCalendarMenuSelect(option.index)}
              />
            );
          })}
          <text style={{ color: theme.muted, marginTop: 1 }}>
            One-way per action (not sync). Import can round-trip by X-TADOI-TASK-ID.
          </text>
          <text style={{ color: theme.muted }}>1/2/3 or Enter: select   j/k: move   Esc: back</text>
        </box>
      ) : null}

      {state.screen === "exporting" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.text }}>Creating timestamped backup...</text>
          <text style={{ color: theme.muted }}>Please wait. This may take a moment.</text>
        </box>
      ) : null}

      {state.screen === "export_done" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.ok, fontWeight: "bold" }}>Backup created</text>
          <text style={{ color: theme.muted }}>Saved to:</text>
          <text style={{ color: theme.text }}>{state.lastExportPath ?? "(unknown)"}</text>
          <text style={{ color: theme.muted, marginTop: 1 }}>
            Enter or Esc: return
          </text>
        </box>
      ) : null}

      {state.screen === "import_picker" ? (
        <box
          style={{ flexDirection: "column", marginTop: 1 }}
          onMouseScroll={(event) => {
            const delta = resolveBackupWheelDelta(event.scroll?.direction);
            if (delta === 0 || state.importPickerFiles.length === 0) return;
            if (typeof event.stopPropagation === "function") {
              event.stopPropagation();
            }
            onImportPickerWheelScroll(delta);
          }}
        >
          <text style={{ color: theme.text, fontWeight: "bold" }}>Select backup file</text>
          <text style={{ color: theme.muted }}>
            Directory: {state.importPickerDirectoryPath || "(unresolved)"}
          </text>
          {state.importPickerLoading ? (
            <text style={{ color: theme.muted, marginTop: 1 }}>Loading backups...</text>
          ) : null}
          {state.importPickerError ? (
            <text style={{ color: theme.warn, marginTop: 1 }}>
              Unable to list backups: {state.importPickerError}
            </text>
          ) : null}
          {!state.importPickerLoading && state.importPickerFiles.length === 0 ? (
            <>
              <text style={{ color: theme.warn, marginTop: 1 }}>
                No backups found in {state.importPickerDirectoryPath || "(unresolved)"}.
              </text>
              <text style={{ color: theme.muted }}>
                Create one with Export backup, or place backup files in this directory.
              </text>
              <text style={{ color: theme.muted }}>Press m for manual path fallback.</text>
            </>
          ) : null}
          {!state.importPickerLoading && state.importPickerFiles.length > 0 ? (
            <>
              <box
                style={{
                  flexDirection: "column",
                  marginTop: 1,
                  border: true,
                  borderStyle: "single",
                  borderColor: theme.outline
                }}
              >
                {pickerVisibleFiles.map((file, visibleIndex) => {
                  const index = pickerWindow.start + visibleIndex;
                  const selected = index === pickerWindow.selectedIndex;
                  return (
                    <SelectableOptionLine
                      key={file.path}
                      label={`${file.filename}  ${formatBackupFileTimestamp(file.mtimeMs)}  ${formatBackupFileSize(file.sizeBytes)}`}
                      selected={selected}
                      theme={theme}
                      onSelect={() => onImportPickerSelectIndex(index)}
                    />
                  );
                })}
              </box>
              <text style={{ color: theme.muted, marginTop: 1 }}>
                Showing {String(pickerWindow.start + 1)}-{String(pickerWindow.end)} of{" "}
                {String(state.importPickerFiles.length)} backups
              </text>
            </>
          ) : null}
          <text style={{ color: theme.muted, marginTop: 1 }}>
            ↑/↓: move   PgUp/PgDn: page   Home/End: jump
          </text>
          <text style={{ color: theme.muted }}>
            Enter: select   m: manual path   Esc: back
          </text>
        </box>
      ) : null}

      {state.screen === "import_path" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.text }}>Paste backup/export file path:</text>
          <input
            value={state.importPathInput}
            onChange={onImportPathChange}
            onSubmit={(value) => {
              onImportPathChange(value);
              onPrimaryAction();
            }}
            focused={isScreenForInput(state.screen, "data-import-path")}
            placeholder="/absolute/or/relative/path/to/export.json"
            style={{ backgroundColor: inputTheme.bg, color: inputTheme.text }}
          />
          <text style={{ color: theme.muted }}>
            Relative paths resolve from the current working directory.
          </text>
          <text style={{ color: theme.muted }}>Enter: continue   Esc: back</text>
        </box>
      ) : null}

      {state.screen === "import_mode" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.text, fontWeight: "bold" }}>Select import mode</text>
          <SelectableOptionLine
            label={`1) Merge (recommended) ${state.importMode === "merge" ? "(selected)" : ""}`}
            selected={state.importMode === "merge"}
            theme={theme}
            onSelect={() => onImportModeSelect("merge")}
          />
          <SelectableOptionLine
            label={`2) Replace ${state.importMode === "replace" ? "(selected)" : ""}`}
            selected={state.importMode === "replace"}
            theme={theme}
            onSelect={() => onImportModeSelect("replace")}
          />
          <text style={{ color: theme.muted }}>
            Merge keeps local-only tasks. Replace overwrites local data.
          </text>
          <text style={{ color: theme.muted, marginTop: 1 }}>
            Replace confirmed: {replaceArmed}
          </text>
          <text style={{ color: theme.muted }}>1/2: switch mode   Enter: dry-run   Esc: back</text>
        </box>
      ) : null}

      {state.screen === "import_confirm" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.warn, fontWeight: "bold" }}>Replace is destructive.</text>
          <text style={{ color: theme.text }}>Type REPLACE to continue:</text>
          <input
            value={state.replaceConfirmInput}
            onChange={onReplaceConfirmChange}
            onSubmit={(value) => {
              onReplaceConfirmChange(value);
              onPrimaryAction();
            }}
            focused={isScreenForInput(state.screen, "data-replace-confirm")}
            placeholder="REPLACE"
            style={{ backgroundColor: inputTheme.bg, color: inputTheme.text }}
          />
          <text style={{ color: theme.muted }}>
            Enter: confirm   Any other value returns to mode select
          </text>
        </box>
      ) : null}

      {state.screen === "import_dryrun" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.text, fontWeight: "bold" }}>Dry-run summary</text>
          {dryRun ? (
            <>
              <text style={{ color: theme.muted }}>Mode: {dryRun.mode.toUpperCase()}</text>
              <text style={{ color: theme.muted }}>No data has been written yet.</text>
              {renderImportStats("Added", dryRun.tasks.added, theme)}
              {renderImportStats("Updated", dryRun.tasks.updated, theme)}
              {renderImportStats("Overwritten (removed)", dryRun.tasks.removed, theme)}
              {renderImportStats("Unchanged", dryRun.tasks.unchanged, theme)}
              <text style={{ color: theme.muted, marginTop: 1 }}>
                Enter: commit import   Esc: cancel
              </text>
            </>
          ) : (
            <text style={{ color: theme.warn }}>Dry-run result unavailable.</text>
          )}
        </box>
      ) : null}

      {state.screen === "importing" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.text }}>Applying import...</text>
          <text style={{ color: theme.muted }}>Writing data and creating backup if enabled.</text>
        </box>
      ) : null}

      {state.screen === "import_done" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.ok, fontWeight: "bold" }}>Import complete</text>
          {committed ? (
            <>
              {renderImportStats("Added", committed.tasks.added, theme)}
              {renderImportStats("Updated", committed.tasks.updated, theme)}
              {renderImportStats("Overwritten (removed)", committed.tasks.removed, theme)}
              {renderImportStats("Unchanged", committed.tasks.unchanged, theme)}
              {committed.backupPath ? (
                <>
                  <text style={{ color: theme.muted, marginTop: 1 }}>Backup:</text>
                  <text style={{ color: theme.text }}>{committed.backupPath}</text>
                </>
              ) : null}
            </>
          ) : null}
          <text style={{ color: theme.muted, marginTop: 1 }}>Enter or Esc: return</text>
        </box>
      ) : null}

      {state.screen === "show_path" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.text, fontWeight: "bold" }}>Data location</text>
          <text style={{ color: theme.text }}>{state.shownDataPath ?? dataPath}</text>
          <text style={{ color: theme.muted, marginTop: 1 }}>Enter or Esc: back</text>
        </box>
      ) : null}

      {state.screen === "calendar_export_intro" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.text, fontWeight: "bold" }}>Export Calendar (.ics)</text>
          <text style={{ color: theme.text }}>
            Exports open tasks as calendar events. Range and optional view filter apply.
          </text>
          <text style={{ color: theme.muted }}>
            This is a one-way export action, not continuous sync.
          </text>
          <text style={{ color: theme.muted }}>
            Timezone: {state.calendarTimeZoneHint ?? "System default"}
          </text>
          <text style={{ color: theme.muted, marginTop: 1 }}>Enter: continue   Esc: back</text>
        </box>
      ) : null}

      {state.screen === "calendar_export_range" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.text, fontWeight: "bold" }}>Choose range</text>
          <SelectableOptionLine
            label={`1) next7 ${state.calendarExportRange === "next7" ? "(selected)" : ""}`}
            selected={state.calendarExportRange === "next7"}
            theme={theme}
            onSelect={() => onCalendarExportRangeSelect("next7")}
          />
          <SelectableOptionLine
            label={`2) month ${state.calendarExportRange === "month" ? "(selected)" : ""}`}
            selected={state.calendarExportRange === "month"}
            theme={theme}
            onSelect={() => onCalendarExportRangeSelect("month")}
          />
          <SelectableOptionLine
            label={`3) all ${state.calendarExportRange === "all" ? "(selected)" : ""}`}
            selected={state.calendarExportRange === "all"}
            theme={theme}
            onSelect={() => onCalendarExportRangeSelect("all")}
          />
          <text style={{ color: theme.muted }}>
            next7 = today..+6, month = today..+29 (local start-of-day boundaries).
          </text>
          <text style={{ color: theme.muted }}>1/2/3 select   Enter continue   Esc back</text>
        </box>
      ) : null}

      {state.screen === "calendar_export_view" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.text, fontWeight: "bold" }}>Choose saved view (optional)</text>
          {calendarViewChoices.map((choice, index) => {
            const active =
              (choice.value ?? "") === (state.calendarExportViewName ?? "");
            return (
              <SelectableOptionLine
                key={`${choice.label}-${String(index)}`}
                label={`${String(index + 1)}) ${choice.label} ${active ? "(selected)" : ""}`}
                selected={active}
                theme={theme}
                onSelect={() => onCalendarExportViewSelect(choice.value)}
              />
            );
          })}
          {savedViewNames.length === 0 ? (
            <text style={{ color: theme.muted }}>No saved views available. Using all tasks.</text>
          ) : null}
          <text style={{ color: theme.muted }}>Number to select   Enter continue   Esc back</text>
        </box>
      ) : null}

      {state.screen === "calendar_export_privacy" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.text, fontWeight: "bold" }}>Choose privacy level</text>
          <SelectableOptionLine
            label={`1) minimal ${state.calendarExportPrivacy === "minimal" ? "(selected)" : ""}`}
            selected={state.calendarExportPrivacy === "minimal"}
            theme={theme}
            onSelect={() => onCalendarExportPrivacySelect("minimal")}
          />
          <SelectableOptionLine
            label={`2) full ${state.calendarExportPrivacy === "full" ? "(selected)" : ""}`}
            selected={state.calendarExportPrivacy === "full"}
            theme={theme}
            onSelect={() => onCalendarExportPrivacySelect("full")}
          />
          <text style={{ color: theme.muted }}>
            minimal omits notes/tags/links/url. full includes all mapped metadata.
          </text>
          <text style={{ color: theme.muted }}>1/2 select   Enter continue   Esc back</text>
        </box>
      ) : null}

      {state.screen === "calendar_export_path" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.text }}>Output path (.ics):</text>
          <input
            value={state.calendarExportPathInput}
            onChange={onCalendarExportPathChange}
            onSubmit={(value) => {
              onCalendarExportPathChange(value);
              onPrimaryAction();
            }}
            focused={isScreenForInput(state.screen, "calendar-export-path")}
            placeholder="Defaults to backups/tadoi-calendar.YYYYMMDD-HHMMSS.ics"
            style={{ backgroundColor: inputTheme.bg, color: inputTheme.text }}
          />
          <text style={{ color: theme.muted }}>
            Leave blank to use a timestamped path in the backups folder.
          </text>
          <text style={{ color: theme.muted }}>Enter: continue   Esc: back</text>
        </box>
      ) : null}

      {state.screen === "calendar_export_confirm" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.text, fontWeight: "bold" }}>Confirm calendar export</text>
          <text style={{ color: theme.muted }}>Range: {state.calendarExportRange}</text>
          <text style={{ color: theme.muted }}>
            View: {state.calendarExportViewName ?? "(All tasks)"}
          </text>
          <text style={{ color: theme.muted }}>Privacy: {state.calendarExportPrivacy}</text>
          <text style={{ color: theme.muted }}>
            Output: {state.calendarExportPathInput.trim() || "(auto timestamped path)"}
          </text>
          <text style={{ color: theme.muted, marginTop: 1 }}>Enter: export   Esc: back</text>
        </box>
      ) : null}

      {state.screen === "calendar_exporting" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.text }}>Exporting calendar ICS...</text>
          <text style={{ color: theme.muted }}>Please wait.</text>
        </box>
      ) : null}

      {state.screen === "calendar_export_done" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.ok, fontWeight: "bold" }}>Calendar export complete</text>
          <text style={{ color: theme.muted }}>
            Path: {state.calendarExportResult?.outputPath ?? "(unknown)"}
          </text>
          <text style={{ color: theme.muted }}>
            Events written: {String(state.calendarExportResult?.eventsWritten ?? 0)}
          </text>
          <text style={{ color: theme.muted }}>
            Series RRULE exported: {String(state.calendarExportResult?.seriesRruleExported ?? 0)}
          </text>
          <text style={{ color: theme.muted }}>
            Instance overrides: {String(state.calendarExportResult?.instanceOverridesExported ?? 0)}
          </text>
          <text style={{ color: theme.muted }}>EXDATE count: {String(state.calendarExportResult?.exdateCount ?? 0)}</text>
          {state.calendarExportWarnings.length > 0 ? (
            <>
              <text style={{ color: theme.warn, marginTop: 1, fontWeight: "bold" }}>
                Warnings:
              </text>
              {state.calendarExportWarnings.map((warning) => (
                <text key={warning} style={{ color: theme.warn }}>
                  - {warning}
                </text>
              ))}
            </>
          ) : null}
          <text style={{ color: theme.muted }}>Enter or Esc: back</text>
        </box>
      ) : null}

      {state.screen === "calendar_import_intro" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.text, fontWeight: "bold" }}>Import Calendar (.ics)</text>
          <text style={{ color: theme.text }}>
            Imports events into tasks and can round-trip update existing tasks by X-TADOI-TASK-ID.
          </text>
          <text style={{ color: theme.muted }}>
            Default mode is merge: tags/links union, notes append, minimal overwrite.
          </text>
          <text style={{ color: theme.muted }}>
            Recurrence guardrails: RRULE must be valid. RECURRENCE-ID overrides supported.
          </text>
          <text style={{ color: theme.muted, marginTop: 1 }}>Enter: continue   Esc: back</text>
        </box>
      ) : null}

      {state.screen === "calendar_import_path" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.text }}>Input ICS file path:</text>
          <input
            value={state.calendarImportPathInput}
            onChange={onCalendarImportPathChange}
            onSubmit={(value) => {
              onCalendarImportPathChange(value);
              onPrimaryAction();
            }}
            focused={isScreenForInput(state.screen, "calendar-import-path")}
            placeholder="/absolute/or/relative/path/to/file.ics"
            style={{ backgroundColor: inputTheme.bg, color: inputTheme.text }}
          />
          <text style={{ color: theme.muted }}>
            .ics extension is recommended. Relative paths resolve from CWD.
          </text>
          <text style={{ color: theme.muted }}>Enter: continue   Esc: back</text>
        </box>
      ) : null}

      {state.screen === "calendar_import_range" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.text, fontWeight: "bold" }}>Choose range</text>
          <SelectableOptionLine
            label={`1) next7 ${state.calendarImportRange === "next7" ? "(selected)" : ""}`}
            selected={state.calendarImportRange === "next7"}
            theme={theme}
            onSelect={() => onCalendarImportRangeSelect("next7")}
          />
          <SelectableOptionLine
            label={`2) month ${state.calendarImportRange === "month" ? "(selected)" : ""}`}
            selected={state.calendarImportRange === "month"}
            theme={theme}
            onSelect={() => onCalendarImportRangeSelect("month")}
          />
          <SelectableOptionLine
            label={`3) all ${state.calendarImportRange === "all" ? "(selected)" : ""}`}
            selected={state.calendarImportRange === "all"}
            theme={theme}
            onSelect={() => onCalendarImportRangeSelect("all")}
          />
          {state.calendarImportRange === "all" ? (
            <text style={{ color: theme.warn }}>Warning: all can apply broader task updates.</text>
          ) : null}
          <text style={{ color: theme.muted }}>1/2/3 select   Enter continue   Esc back</text>
        </box>
      ) : null}

      {state.screen === "calendar_import_view" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.text, fontWeight: "bold" }}>Choose saved view (optional)</text>
          {calendarViewChoices.map((choice, index) => {
            const active =
              (choice.value ?? "") === (state.calendarImportViewName ?? "");
            return (
              <SelectableOptionLine
                key={`import-view-${choice.label}-${String(index)}`}
                label={`${String(index + 1)}) ${choice.label} ${active ? "(selected)" : ""}`}
                selected={active}
                theme={theme}
                onSelect={() => onCalendarImportViewSelect(choice.value)}
              />
            );
          })}
          {savedViewNames.length === 0 ? (
            <text style={{ color: theme.muted }}>No saved views available. No view filter will apply.</text>
          ) : null}
          <text style={{ color: theme.muted }}>Number to select   Enter continue   Esc back</text>
        </box>
      ) : null}

      {state.screen === "calendar_import_mode" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.text, fontWeight: "bold" }}>Choose import mode</text>
          <SelectableOptionLine
            label={`1) merge ${state.calendarImportMode === "merge" ? "(selected)" : ""}`}
            selected={state.calendarImportMode === "merge"}
            theme={theme}
            onSelect={() => onCalendarImportModeSelect("merge")}
          />
          <SelectableOptionLine
            label={`2) update ${state.calendarImportMode === "update" ? "(selected)" : ""}`}
            selected={state.calendarImportMode === "update"}
            theme={theme}
            onSelect={() => onCalendarImportModeSelect("update")}
          />
          <SelectableOptionLine
            label={`3) create ${state.calendarImportMode === "create" ? "(selected)" : ""}`}
            selected={state.calendarImportMode === "create"}
            theme={theme}
            onSelect={() => onCalendarImportModeSelect("create")}
          />
          <text style={{ color: theme.muted }}>
            merge = conservative, update = calendar wins, create = always new tasks.
          </text>
          <text style={{ color: theme.muted }}>1/2/3 select   Enter continue   Esc back</text>
        </box>
      ) : null}

      {state.screen === "calendar_import_horizon" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.text }}>Horizon days (default 365, max 3650):</text>
          <input
            value={state.calendarImportHorizonInput}
            onChange={onCalendarImportHorizonChange}
            onSubmit={(value) => {
              onCalendarImportHorizonChange(value);
              onPrimaryAction();
            }}
            focused={isScreenForInput(state.screen, "calendar-import-horizon")}
            placeholder="365"
            style={{ backgroundColor: inputTheme.bg, color: inputTheme.text }}
          />
          <text style={{ color: theme.muted }}>
            Bounds recurrence expansion paths and hard-cap checks.
          </text>
          <text style={{ color: theme.muted }}>Enter: continue   Esc: back</text>
        </box>
      ) : null}

      {state.screen === "calendar_import_tag" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.text }}>
            Optional tag for newly created tasks (recommended: imported):
          </text>
          <input
            value={state.calendarImportTagInput}
            onChange={onCalendarImportTagChange}
            onSubmit={(value) => {
              onCalendarImportTagChange(value);
              onPrimaryAction();
            }}
            focused={isScreenForInput(state.screen, "calendar-import-tag")}
            placeholder="(optional)"
            style={{ backgroundColor: inputTheme.bg, color: inputTheme.text }}
          />
          <text style={{ color: theme.muted }}>
            Applies to created tasks only.
          </text>
          <text style={{ color: theme.muted }}>Enter: run mandatory dry-run   Esc: back</text>
        </box>
      ) : null}

      {state.screen === "calendar_import_dryrun_running" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.text }}>Running dry-run import...</text>
          <text style={{ color: theme.muted }}>
            Validating RRULE, range/view filters, and recurrence safeguards.
          </text>
        </box>
      ) : null}

      {state.screen === "calendar_import_dryrun" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.text, fontWeight: "bold" }}>Dry-run summary (required)</text>
          {state.calendarImportDryRun ? (
            <>
              {renderImportStats("Events parsed", state.calendarImportDryRun.eventsParsed, theme)}
              {renderImportStats("Matched by X-TADOI-TASK-ID", state.calendarImportDryRun.matchedByTaskId, theme)}
              {renderImportStats("Matched by UID", state.calendarImportDryRun.matchedByUid, theme)}
              {renderImportStats("Created", state.calendarImportDryRun.created, theme)}
              {renderImportStats("Updated", state.calendarImportDryRun.updated, theme)}
              {renderImportStats("Merged", state.calendarImportDryRun.merged, theme)}
              {renderImportStats("Skipped", state.calendarImportDryRun.skipped, theme)}
              {renderImportStats("Errors", state.calendarImportDryRun.errors, theme)}
              {renderImportStats("Series imported", state.calendarImportDryRun.recurringSeriesImported, theme)}
              {renderImportStats("Overrides created", state.calendarImportDryRun.overridesCreated, theme)}
              {renderImportStats("Overrides updated", state.calendarImportDryRun.overridesUpdated, theme)}
              {renderImportStats("Cancellations applied", state.calendarImportDryRun.cancellationsApplied, theme)}
              {state.calendarImportDryRunHasErrors &&
              state.calendarImportDryRunErrorReasons.length > 0 ? (
                <>
                  <text style={{ color: theme.warn, marginTop: 1, fontWeight: "bold" }}>
                    Top errors:
                  </text>
                  {state.calendarImportDryRunErrorReasons.map((reason) => (
                    <text key={reason} style={{ color: theme.warn }}>
                      - {reason}
                    </text>
                  ))}
                </>
              ) : null}
              {state.calendarImportDryRunReportPath ? (
                <>
                  <text style={{ color: theme.muted, marginTop: 1 }}>Report details:</text>
                  <text style={{ color: theme.text }}>{state.calendarImportDryRunReportPath}</text>
                </>
              ) : null}
              {state.calendarImportDryRunWarnings.length > 0 ? (
                <>
                  <text style={{ color: theme.warn, marginTop: 1, fontWeight: "bold" }}>
                    Warnings:
                  </text>
                  {state.calendarImportDryRunWarnings.map((warning) => (
                    <text key={warning} style={{ color: theme.warn }}>
                      - {warning}
                    </text>
                  ))}
                </>
              ) : null}
              <text style={{ color: theme.muted, marginTop: 1 }}>
                Enter: {shouldBlockCalendarCommit ? "commit blocked (fix dry-run errors)" : "commit import"}
              </text>
            </>
          ) : (
            <text style={{ color: theme.warn }}>Dry-run result unavailable.</text>
          )}
        </box>
      ) : null}

      {state.screen === "calendar_import_confirm" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.warn, fontWeight: "bold" }}>
            High-impact import confirmation required.
          </text>
          <text style={{ color: theme.text }}>
            Type IMPORT to continue (mode={state.calendarImportMode}, range={state.calendarImportRange}).
          </text>
          <input
            value={state.calendarImportConfirmInput}
            onChange={onCalendarImportConfirmChange}
            onSubmit={(value) => {
              onCalendarImportConfirmChange(value);
              onPrimaryAction();
            }}
            focused={isScreenForInput(state.screen, "calendar-import-confirm")}
            placeholder="IMPORT"
            style={{ backgroundColor: inputTheme.bg, color: inputTheme.text }}
          />
          <text style={{ color: theme.muted }}>Enter: confirm   Esc: back</text>
        </box>
      ) : null}

      {state.screen === "calendar_importing" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.text }}>Applying calendar import...</text>
          <text style={{ color: theme.muted }}>
            Creating pre-import backup and writing updates atomically.
          </text>
        </box>
      ) : null}

      {state.screen === "calendar_import_done" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.ok, fontWeight: "bold" }}>Calendar import complete</text>
          {state.calendarImportCommitted ? (
            <>
              {renderImportStats("Created", state.calendarImportCommitted.created, theme)}
              {renderImportStats("Updated", state.calendarImportCommitted.updated, theme)}
              {renderImportStats("Merged", state.calendarImportCommitted.merged, theme)}
              {renderImportStats("Skipped", state.calendarImportCommitted.skipped, theme)}
              {renderImportStats("Series imported", state.calendarImportCommitted.recurringSeriesImported, theme)}
              {renderImportStats("Overrides created", state.calendarImportCommitted.overridesCreated, theme)}
              {renderImportStats("Overrides updated", state.calendarImportCommitted.overridesUpdated, theme)}
              {renderImportStats("Cancellations applied", state.calendarImportCommitted.cancellationsApplied, theme)}
            </>
          ) : null}
          {state.calendarImportCommittedBackupPath ? (
            <>
              <text style={{ color: theme.muted, marginTop: 1 }}>Pre-import backup:</text>
              <text style={{ color: theme.text }}>{state.calendarImportCommittedBackupPath}</text>
            </>
          ) : null}
          {state.calendarImportCommittedReportPath ? (
            <>
              <text style={{ color: theme.muted, marginTop: 1 }}>Report:</text>
              <text style={{ color: theme.text }}>{state.calendarImportCommittedReportPath}</text>
            </>
          ) : null}
          {state.calendarImportCommittedWarnings.length > 0 ? (
            <>
              <text style={{ color: theme.warn, marginTop: 1, fontWeight: "bold" }}>
                Warnings:
              </text>
              {state.calendarImportCommittedWarnings.map((warning) => (
                <text key={warning} style={{ color: theme.warn }}>
                  - {warning}
                </text>
              ))}
            </>
          ) : null}
          <text style={{ color: theme.muted, marginTop: 1 }}>
            Enter or Esc: back
          </text>
        </box>
      ) : null}

      {state.screen === "error" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.warn, fontWeight: "bold" }}>Operation failed</text>
          <text style={{ color: theme.text }}>{state.errorMessage ?? "Unknown error"}</text>
          {state.errorDetail ? (
            <>
              <text style={{ color: theme.muted }}>Detail:</text>
              <text style={{ color: theme.muted }}>{state.errorDetail}</text>
            </>
          ) : null}
          <text style={{ color: theme.muted, marginTop: 1 }}>Enter or Esc: back</text>
        </box>
      ) : null}
        </scrollbox>
      </box>

      {footerActions.length > 0 ? (
        <box style={{ flexDirection: "row", gap: 1, marginTop: 1, flexWrap: "wrap" }}>
          {footerActions.map((action) => (
            <BackupActionButton
              key={action.key}
              label={action.label}
              onPress={action.onPress}
              tone={action.tone}
              active={action.active}
            />
          ))}
        </box>
      ) : null}
    </box>
  );
}
