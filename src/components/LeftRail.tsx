import { Filters, FocusTarget, Mode, SortMode } from "../domain/models";
import { formatDate } from "../state/store";
import { colorForTag, theme, styles } from "../app/theme";
import { formatTagForDisplay } from "../domain/tagIndex";
import { APP_VERSION } from "../app/version";
import { getSortModeLabel } from "../domain/query";
import { APP_TAGLINE, getAsciiLogoLines, getHeaderLogoVariant } from "../brand/brand";

type LeftRailProps = {
  mode: Mode;
  focus: FocusTarget;
  filters: Filters;
  sortMode: SortMode;
  fastPulseOn: boolean;
  terminalWidth: number;
  showLogo?: boolean;
};

function getModeLabel(mode: Mode): string {
  switch (mode) {
    case Mode.ADD:
      return "ADD";
    case Mode.EDIT:
      return "EDIT";
    case Mode.SEARCH:
      return "SEARCH";
    case Mode.HELP:
      return "HELP";
    case Mode.MODAL_CONFIRM:
      return "DELETE";
    default:
      return "LIST";
  }
}

function getFocusLabel(focus: FocusTarget): string {
  switch (focus) {
    case FocusTarget.TASK_LIST:
      return "LIST";
    case FocusTarget.SEARCH_INPUT:
      return "SEARCH";
    case FocusTarget.MODAL:
      return "DELETE";
    case FocusTarget.EDITOR_TITLE:
      return "TITLE";
    case FocusTarget.EDITOR_DUE_DATE:
      return "DUE DATE";
    case FocusTarget.EDITOR_DUE_TIME:
      return "DUE TIME";
    case FocusTarget.EDITOR_TAGS:
      return "TAGS";
    case FocusTarget.EDITOR_NOTES:
      return "NOTES";
    case FocusTarget.EDITOR_SAVE:
      return "SAVE";
    case FocusTarget.EDITOR_CANCEL:
      return "CANCEL";
    default:
      return "LIST";
  }
}

function wrapWords(text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current.length ? `${current} ${word}` : word;
    if (next.length <= maxWidth) {
      current = next;
      continue;
    }
    if (current.length) {
      lines.push(current);
    }
    current = word;
  }
  if (current.length) {
    lines.push(current);
  }
  return lines;
}

export function LeftRail({
  mode,
  focus,
  filters,
  sortMode,
  fastPulseOn,
  terminalWidth,
  showLogo = true
}: LeftRailProps) {
  const version = APP_VERSION;
  const logoDivider = "--------------------------------";
  const now = new Date();
  const todayLabel = formatDate(now.getTime());
  const timeLabel = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
  const modeLabel = getModeLabel(mode);
  const focusLabel = getFocusLabel(focus);
  const sortLabel = getSortModeLabel(sortMode);

  const menuItems = ["LIST", "ADD", "EDIT", "SEARCH", "HELP", "DELETE"];
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

  const logoVariant = getHeaderLogoVariant(terminalWidth);
  const logoLines = showLogo ? getAsciiLogoLines(logoVariant) : [];
  const taglineLines = showLogo ? wrapWords(APP_TAGLINE, 32) : [];

  return (
    <box style={{ flexDirection: "column", gap: 0 }}>
      <box style={{ flexDirection: "column" }}>
        {logoLines.length > 0
          ? logoLines.map((line) => (
              <text key={line} style={{ color: theme.text }}>
                {line}
              </text>
            ))
          : null}
        {taglineLines.length > 0 ? (
          <box style={{ flexDirection: "column", width: "100%", alignItems: "center" }}>
            {taglineLines.map((line) => (
              <text key={`tagline-${line}`} style={{ color: theme.muted }}>
                {line}
              </text>
            ))}
          </box>
        ) : null}
        {logoLines.length > 0 ? (
          <text style={{ color: theme.outline }}>{logoDivider}</text>
        ) : null}
        <text style={{ color: theme.muted }}>{version}</text>
        <text style={{ color: theme.muted, marginTop: 1 }}>DATE: {todayLabel}</text>
        <text style={{ color: theme.muted }}>TIME: {timeLabel}</text>
      </box>

      <box style={{ marginTop: 1, flexDirection: "row", alignItems: "center", gap: 1 }}>
        <text style={styles.muted}>MODE:</text>
        <box style={{ backgroundColor: theme.accentPurple, paddingLeft: 1, paddingRight: 1 }}>
          <text style={{ color: theme.bg }}>{modeLabel}</text>
        </box>
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
        <text style={{ color: theme.text }}>SORT: {sortLabel}</text>
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
        <text style={{ color: theme.text }}>s: SORT</text>
        <text style={{ color: theme.text }}>g: DUE</text>
        <text style={{ color: theme.text }}>t: TAG FILTER</text>
        <text style={{ color: theme.text }}>?: HELP</text>
      </box>
    </box>
  );
}
