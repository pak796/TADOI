import { Filters, FocusTarget, Mode } from "../domain/models";
import { formatDate } from "../state/store";
import { colorForTag, theme, styles } from "../app/theme";
import { formatTagForDisplay } from "../domain/tagIndex";

type LeftRailProps = {
  mode: Mode;
  focus: FocusTarget;
  filters: Filters;
  fastPulseOn: boolean;
};

function getModeLabel(mode: Mode): string {
  switch (mode) {
    case "add":
      return "ADD";
    case "edit":
      return "EDIT";
    case "search":
      return "SEARCH";
    case "help":
      return "HELP";
    case "modal_confirm":
      return "MODAL";
    default:
      return "LIST";
  }
}

function getFocusLabel(focus: FocusTarget): string {
  switch (focus) {
    case "task_list":
      return "LIST";
    case "search_input":
      return "SEARCH";
    case "modal":
      return "MODAL";
    case "editor_title":
      return "TITLE";
    case "editor_due_date":
      return "DUE DATE";
    case "editor_due_time":
      return "DUE TIME";
    case "editor_tags":
      return "TAGS";
    case "editor_notes":
      return "NOTES";
    case "editor_save":
      return "SAVE";
    case "editor_cancel":
      return "CANCEL";
    default:
      return "LIST";
  }
}

export function LeftRail({ mode, focus, filters, fastPulseOn }: LeftRailProps) {
  const version = "v0.2.1";
  const now = new Date();
  const todayLabel = formatDate(now.getTime());
  const timeLabel = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
  const modeLabel = getModeLabel(mode);
  const focusLabel = getFocusLabel(focus);

  const menuItems = ["LIST", "ADD", "EDIT", "SEARCH", "HELP", "MODAL"];
  const statusLabel = filters.status === "all" ? "ACTIVE" : filters.status.toUpperCase();
  const statusBg =
    filters.status === "done"
      ? theme.ok
      : filters.status === "open"
        ? theme.dueLater
        : filters.status === "archived"
          ? theme.outline
          : "transparent";
  const statusText = statusBg === "transparent" ? theme.text : theme.bg;
  const dueLabel =
    filters.due === "next7" ? "THIS WEEK" : filters.due.toUpperCase();
  const dueBg =
    filters.due === "overdue"
      ? fastPulseOn
        ? theme.warn
        : theme.dueSoon
      : filters.due === "today"
        ? theme.dueSoon
        : filters.due === "next7"
          ? theme.dueLater
          : "transparent";
  const dueText = dueBg === "transparent" ? theme.text : theme.bg;

  const logoLines = [
    " _____   ___  ____  _   _ ___ ",
    "|_   _| / _ \\|  _ \\| | | |_ _|",
    "  | |  | | | | | | | | | || | ",
    "  | |  | |_| | |_| | |_| || | ",
    "  |_|   \\___/|____/ \\___/|___|"
  ];

  return (
    <box style={{ flexDirection: "column", gap: 0 }}>
      <box style={{ flexDirection: "column" }}>
        {logoLines.map((line) => (
          <text key={line} style={{ color: theme.text }}>
            {line}
          </text>
        ))}
        <text style={{ color: theme.muted, marginTop: 1 }}>{version}</text>
        <text style={{ color: theme.muted, marginTop: 1 }}>DATE: {todayLabel}</text>
        <text style={{ color: theme.muted }}>TIME: {timeLabel}</text>
      </box>

      <text style={{ ...styles.muted, marginTop: 1 }}>MODE</text>
      <box style={{ backgroundColor: theme.accentPurple, paddingLeft: 1, paddingRight: 1 }}>
        <text style={{ color: theme.bg }}>{modeLabel}</text>
      </box>
      <text style={{ ...styles.muted, marginTop: 1 }}>FOCUS: {focusLabel}</text>

      <box style={{ marginTop: 1, flexDirection: "column", gap: 0 }}>
        <text style={styles.muted}>MENU</text>
        {menuItems.map((item) => {
          const active = item === modeLabel;
          return (
            <box
              key={item}
              style={{
                backgroundColor: active ? theme.accentBlue : "transparent",
                color: active ? theme.bg : theme.text,
                paddingLeft: 1,
                paddingRight: 1
              }}
            >
              <text>{item}</text>
            </box>
          );
        })}
      </box>

      <box style={{ marginTop: 1, flexDirection: "column", gap: 0 }}>
        <text style={styles.muted}>FILTERS</text>
        <box style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
          <text style={{ color: theme.text }}>STATUS:</text>
          <box
            style={{
              backgroundColor: statusBg,
              paddingLeft: 1,
              paddingRight: 1
            }}
          >
            <text style={{ color: statusText }}>{statusLabel}</text>
          </box>
        </box>
        <box style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
          <text style={{ color: theme.text }}>DUE:</text>
          <box
            style={{
              backgroundColor: dueBg,
              paddingLeft: 1,
              paddingRight: 1
            }}
          >
            <text style={{ color: dueText }}>{dueLabel}</text>
          </box>
        </box>
        {filters.tag ? (
          <box style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
            <text style={{ color: theme.text }}>TAG:</text>
            <box
              style={{
                backgroundColor: colorForTag(filters.tag),
                paddingLeft: 1,
                paddingRight: 1
              }}
            >
              <text style={{ color: theme.bg }}>{formatTagForDisplay(filters.tag)}</text>
            </box>
          </box>
        ) : (
          <text style={{ color: theme.text }}>TAG: (none)</text>
        )}
        <text style={{ color: theme.text }}>
          SEARCH: {filters.searchText?.trim() ? filters.searchText : "(none)"}
        </text>
      </box>

      <box style={{ marginTop: 1, flexDirection: "column", gap: 0 }}>
        <text style={styles.muted}>HINTS</text>
        <text style={{ color: theme.text }}>j/k: MOVE</text>
        <text style={{ color: theme.text }}>a: ADD</text>
        <text style={{ color: theme.text }}>e: EDIT</text>
        <text style={{ color: theme.text }}>c: COPY</text>
        <text style={{ color: theme.text }}>SPACE: TOGGLE</text>
        <text style={{ color: theme.text }}>d: DELETE</text>
        <text style={{ color: theme.text }}>/: SEARCH</text>
        <text style={{ color: theme.text }}>f: STATUS</text>
        <text style={{ color: theme.text }}>g: DUE</text>
        <text style={{ color: theme.text }}>t: TAG FILTER</text>
        <text style={{ color: theme.text }}>?: HELP</text>
      </box>
    </box>
  );
}
