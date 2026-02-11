import React from "react";
import { theme } from "../app/theme";
import type { BackupCenterState } from "../state/backupCenterFlow";

type BackupButtonTone = "primary" | "danger" | "neutral";

type BackupCenterScreenProps = {
  state: BackupCenterState;
  dataPath: string;
  onImportPathChange: (value: string) => void;
  onReplaceConfirmChange: (value: string) => void;
  onPrimaryAction: () => void;
  onBackAction: () => void;
  onMenuSelect: (index: 0 | 1 | 2) => void;
  onImportModeSelect: (mode: "merge" | "replace") => void;
};

type BackupActionButtonProps = {
  label: string;
  onPress: () => void;
  tone?: BackupButtonTone;
  active?: boolean;
};

type BackupFooterAction = {
  key: string;
  label: string;
  onPress: () => void;
  tone?: BackupButtonTone;
  active?: boolean;
};

function renderImportStats(label: string, value: number): React.ReactNode {
  return (
    <box style={{ flexDirection: "row", gap: 1 }}>
      <text style={{ color: theme.muted }}>{label}:</text>
      <text style={{ color: theme.text }}>{value}</text>
    </box>
  );
}

function getStepLabel(screen: BackupCenterState["screen"]): string {
  switch (screen) {
    case "menu":
      return "MENU";
    case "exporting":
    case "export_done":
      return "EXPORT";
    case "import_path":
      return "IMPORT / PATH";
    case "import_mode":
      return "IMPORT / MODE";
    case "import_confirm":
      return "IMPORT / CONFIRM";
    case "import_dryrun":
      return "IMPORT / DRY-RUN";
    case "importing":
    case "import_done":
      return "IMPORT / COMMIT";
    case "show_path":
      return "DATA PATH";
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

export function BackupCenterScreen({
  state,
  dataPath,
  onImportPathChange,
  onReplaceConfirmChange,
  onPrimaryAction,
  onBackAction,
  onMenuSelect,
  onImportModeSelect
}: BackupCenterScreenProps) {
  const modeLabel = state.importMode === "replace" ? "REPLACE" : "MERGE";
  const replaceArmed =
    state.importMode === "replace" && state.replaceConfirmed ? "YES" : "NO";
  const dryRun = state.dryRun;
  const committed = state.committed;
  const stepLabel = getStepLabel(state.screen);
  const menuOptions: Array<{ index: 0 | 1 | 2; label: string }> = [
    { index: 0, label: "1) Export backup (recommended)" },
    { index: 1, label: "2) Import data..." },
    { index: 2, label: "3) Show data path" }
  ];

  let footerActions: BackupFooterAction[] = [];
  switch (state.screen) {
    case "menu":
      footerActions = [
        { key: "export", label: "Export", onPress: () => onMenuSelect(0) },
        { key: "import", label: "Import", onPress: () => onMenuSelect(1) },
        { key: "show-path", label: "Show Path", onPress: () => onMenuSelect(2) },
        { key: "close", label: "Close", onPress: onBackAction, tone: "neutral" }
      ];
      break;
    case "import_path":
      footerActions = [
        { key: "continue", label: "Continue", onPress: onPrimaryAction },
        { key: "back", label: "Back", onPress: onBackAction, tone: "neutral" }
      ];
      break;
    case "import_mode":
      footerActions = [
        {
          key: "merge",
          label: "Merge",
          onPress: () => onImportModeSelect("merge"),
          active: state.importMode === "merge"
        },
        {
          key: "replace",
          label: "Replace",
          onPress: () => onImportModeSelect("replace"),
          tone: "danger",
          active: state.importMode === "replace"
        },
        { key: "dry-run", label: "Dry-run", onPress: onPrimaryAction },
        { key: "back", label: "Back", onPress: onBackAction, tone: "neutral" }
      ];
      break;
    case "import_confirm":
      footerActions = [
        {
          key: "confirm-replace",
          label: "Confirm Replace",
          onPress: onPrimaryAction,
          tone: "danger"
        },
        { key: "cancel", label: "Cancel", onPress: onBackAction, tone: "neutral" }
      ];
      break;
    case "import_dryrun":
      footerActions = [
        { key: "commit", label: "Commit Import", onPress: onPrimaryAction },
        { key: "back", label: "Back", onPress: onBackAction, tone: "neutral" }
      ];
      break;
    case "export_done":
    case "import_done":
    case "show_path":
    case "error":
      footerActions = [{ key: "back-menu", label: "Back to Menu", onPress: onPrimaryAction }];
      break;
    case "exporting":
    case "importing":
    default:
      footerActions = [];
      break;
  }

  return (
    <box
      style={{
        width: 86,
        maxWidth: "100%",
        flexDirection: "column",
        backgroundColor: theme.panel,
        border: true,
        borderStyle: "single",
        borderColor: theme.outline,
        padding: 1
      }}
    >
      <text style={{ color: theme.text, fontWeight: "bold" }}>Backup Center</text>
      <text style={{ color: theme.muted }}>Guided backup, import, and restore</text>
      <box style={{ flexDirection: "row", gap: 2, marginTop: 1 }}>
        <text style={{ color: theme.muted }}>STEP: {stepLabel}</text>
        <text style={{ color: theme.muted }}>MODE: {modeLabel}</text>
      </box>
      {state.screen === "menu" ? (
        <box style={{ flexDirection: "column", marginTop: 1, gap: 0 }}>
          {menuOptions.map((option) => {
            const selected = state.menuIndex === option.index;
            return (
              <box
                key={option.label}
                style={{
                  backgroundColor: selected ? theme.accentBlue : "transparent",
                  paddingLeft: 1,
                  paddingRight: 1
                }}
              >
                <text style={{ color: selected ? theme.bg : theme.text }}>
                  {selected ? "> " : "  "}
                  {option.label}
                </text>
              </box>
            );
          })}
          <text style={{ color: theme.muted, marginTop: 1 }}>
            1/2/3 or Enter: select   j/k: move   Esc: close Backup Center
          </text>
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
            Enter or Esc: return to Backup Center menu
          </text>
        </box>
      ) : null}

      {state.screen === "import_path" ? (
        <box style={{ flexDirection: "column", marginTop: 1, gap: 0 }}>
          <text style={{ color: theme.text }}>Paste backup/export file path:</text>
          <input
            value={state.importPathInput}
            onChange={onImportPathChange}
            focused
            placeholder="/absolute/or/relative/path/to/export.json"
            style={{ backgroundColor: theme.bg, color: theme.text }}
          />
          <text style={{ color: theme.muted }}>
            Relative paths resolve from the current working directory.
          </text>
          <text style={{ color: theme.muted }}>Enter: continue   Esc: back</text>
        </box>
      ) : null}

      {state.screen === "import_mode" ? (
        <box style={{ flexDirection: "column", marginTop: 1, gap: 0 }}>
          <text style={{ color: theme.text, fontWeight: "bold" }}>Select import mode</text>
          <text style={{ color: theme.text }}>
            1) Merge (recommended) {state.importMode === "merge" ? "(selected)" : ""}
          </text>
          <text style={{ color: theme.text }}>
            2) Replace {state.importMode === "replace" ? "(selected)" : ""}
          </text>
          <text style={{ color: theme.muted }}>
            Merge keeps local-only tasks. Replace overwrites local data.
          </text>
          <text style={{ color: theme.muted, marginTop: 1 }}>
            Current mode: {modeLabel}
          </text>
          <text style={{ color: theme.muted }}>Replace confirmed: {replaceArmed}</text>
          <text style={{ color: theme.muted, marginTop: 1 }}>
            1/2: switch mode   Enter: dry-run   Esc: back
          </text>
        </box>
      ) : null}

      {state.screen === "import_confirm" ? (
        <box style={{ flexDirection: "column", marginTop: 1, gap: 0 }}>
          <text style={{ color: theme.warn, fontWeight: "bold" }}>Replace is destructive.</text>
          <text style={{ color: theme.text }}>Type REPLACE to continue:</text>
          <input
            value={state.replaceConfirmInput}
            onChange={onReplaceConfirmChange}
            focused
            placeholder="REPLACE"
            style={{ backgroundColor: theme.bg, color: theme.text }}
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
              <text style={{ color: theme.muted }}>
                Mode: {dryRun.mode.toUpperCase()}
              </text>
              <text style={{ color: theme.muted }}>
                No data has been written yet.
              </text>
              {renderImportStats("Added", dryRun.tasks.added)}
              {renderImportStats("Updated", dryRun.tasks.updated)}
              {renderImportStats("Overwritten (removed)", dryRun.tasks.removed)}
              {renderImportStats("Unchanged", dryRun.tasks.unchanged)}
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
              {renderImportStats("Added", committed.tasks.added)}
              {renderImportStats("Updated", committed.tasks.updated)}
              {renderImportStats("Overwritten (removed)", committed.tasks.removed)}
              {renderImportStats("Unchanged", committed.tasks.unchanged)}
              {committed.backupPath ? (
                <>
                  <text style={{ color: theme.muted, marginTop: 1 }}>Backup:</text>
                  <text style={{ color: theme.text }}>{committed.backupPath}</text>
                </>
              ) : null}
            </>
          ) : null}
          <text style={{ color: theme.muted, marginTop: 1 }}>
            Enter or Esc: return to Backup Center menu
          </text>
        </box>
      ) : null}

      {state.screen === "show_path" ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: theme.text, fontWeight: "bold" }}>Data location</text>
          <text style={{ color: theme.text }}>{state.shownDataPath ?? dataPath}</text>
          <text style={{ color: theme.muted, marginTop: 1 }}>Enter or Esc: back</text>
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

      {footerActions.length > 0 ? (
        <box style={{ flexDirection: "row", gap: 1, marginTop: 1 }}>
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
