import { useEffect, useMemo, useState } from "react";
import { Filters, FocusTarget, Mode, SortMode } from "../domain/models";
import { formatDate } from "../state/store";
import { colorForTag, theme, styles } from "../app/theme";
import { formatTagFilterBooleanSummary } from "../domain/tagFilter";
import { formatTagForDisplay } from "../domain/tagIndex";
import { normalizePriorityFilterValue } from "../domain/priorityTags";
import { APP_VERSION } from "../app/version";
import { getSortModeLabel } from "../domain/query";
import {
  APP_TAGLINE,
  LOGO_MAX_WIDTH,
  LOGO_VARIANTS,
  ROTATING_LOGO_ORDER,
  PRODUCT_NAME_TM
} from "../brand/brand";
import type { FlashMode, LogoMode } from "../settings/settings";
import { formatThemeDisplayName, type ThemeId } from "../theme/themes";
import { centerLogoInBox } from "./logoLayout";

export type LeftRailMenuItem =
  | "LIST"
  | "DASHBOARD"
  | "BACKUP"
  | "ADD"
  | "EDIT"
  | "SEARCH"
  | "TAG_PANEL"
  | "HELP"
  | "DELETE";

type LeftRailProps = {
  mode: Mode;
  focus: FocusTarget;
  filters: Filters;
  sortMode: SortMode;
  fastPulseOn: boolean;
  flashMode: FlashMode;
  logoMode: LogoMode;
  onMenuSelect?: (item: LeftRailMenuItem) => void;
  terminalWidth: number;
  showLogo?: boolean;
  activeThemeId?: ThemeId;
};

const HINT_LINE_WIDTH = 18;
const LOGO_ROTATE_INTERVAL_MS = 30_000;
const LOGO_RENDER_HEIGHT = Math.max(
  ...Object.values(LOGO_VARIANTS).map((lines) => lines.length)
);
const HINT_LINES = [
  "j/k: MOVE",
  "p: TAG PANEL",
  "r: PRIORITY",
  "c: COPY",
  "SPACE: TOGGLE"
] as const;

const LOGO_WIDTH_WARNINGS = Object.entries(LOGO_VARIANTS).flatMap(
  ([variantId, lines]) =>
    lines.flatMap((line, lineIndex) =>
      line.length > LOGO_MAX_WIDTH
        ? [`${variantId}[${lineIndex + 1}] => ${line.length}`]
        : []
    )
);

if (
  typeof process !== "undefined" &&
  process.env.NODE_ENV !== "production" &&
  LOGO_WIDTH_WARNINGS.length > 0
) {
  console.warn(
    `[LeftRail] Logo lines exceed ${LOGO_MAX_WIDTH} columns: ${LOGO_WIDTH_WARNINGS.join(", ")}`
  );
}

function getModeLabel(mode: Mode): string {
  switch (mode) {
    case Mode.DASHBOARD:
      return "DASHBOARD";
    case Mode.ADD:
      return "ADD";
    case Mode.EDIT:
      return "EDIT";
    case Mode.SEARCH:
      return "SEARCH";
    case Mode.TAG_FILTER:
      return "TAG FILTER";
    case Mode.BACKUP_CENTER:
      return "BACKUP";
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
    case FocusTarget.DASHBOARD:
      return "DASHBOARD";
    case FocusTarget.BACKUP_CENTER:
      return "BACKUP";
    case FocusTarget.TASK_LIST:
      return "LIST";
    case FocusTarget.SEARCH_INPUT:
      return "SEARCH";
    case FocusTarget.TAG_FILTER_INPUT:
      return "TAG FILTER";
    case FocusTarget.MODAL:
      return "DELETE";
    case FocusTarget.EDITOR_TITLE:
      return "TITLE";
    case FocusTarget.EDITOR_DUE_DATE:
      return "DUE DATE";
    case FocusTarget.EDITOR_DUE_TIME:
      return "DUE TIME";
    case FocusTarget.EDITOR_REPEAT_MODE:
      return "REPEAT MODE";
    case FocusTarget.EDITOR_REPEAT_INTERVAL:
      return "REPEAT EVERY";
    case FocusTarget.EDITOR_REPEAT_WEEKDAYS:
      return "REPEAT DAYS";
    case FocusTarget.EDITOR_REPEAT_MONTHDAY:
      return "REPEAT DAY#";
    case FocusTarget.EDITOR_REPEAT_END_MODE:
      return "REPEAT END";
    case FocusTarget.EDITOR_REPEAT_UNTIL:
      return "END DATE";
    case FocusTarget.EDITOR_REPEAT_COUNT:
      return "END COUNT";
    case FocusTarget.EDITOR_REPEAT_CUSTOM:
      return "CUSTOM RRULE";
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

function formatHintLine(line: string): string {
  return line.length > HINT_LINE_WIDTH
    ? line.slice(0, HINT_LINE_WIDTH)
    : line.padEnd(HINT_LINE_WIDTH, " ");
}

function formatMenuItemLabel(item: LeftRailMenuItem): string {
  if (item === "DASHBOARD") return "DASHBOARD (B)";
  if (item === "ADD") return "ADD (A)";
  if (item === "EDIT") return "EDIT (E)";
  if (item === "SEARCH") return "SEARCH (/)";
  if (item === "TAG_PANEL") return "TAG PANEL (P)";
  if (item === "HELP") return "HELP (?)";
  if (item === "DELETE") return "DELETE (D)";
  return item;
}

function isLightHexColor(color: string): boolean {
  const match = color.trim().match(/^#([0-9a-fA-F]{6})$/);
  if (!match) return false;
  const hex = match[1];
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness >= 186;
}

export function LeftRail({
  mode,
  focus,
  filters,
  sortMode,
  fastPulseOn,
  flashMode,
  logoMode,
  onMenuSelect,
  terminalWidth,
  showLogo = true,
  activeThemeId
}: LeftRailProps) {
  const [rotatingLogoIndex, setRotatingLogoIndex] = useState(0);

  useEffect(() => {
    if (logoMode !== "rotate") {
      setRotatingLogoIndex(0);
      return;
    }
    // Rotate mode always starts from the default logo when enabled.
    setRotatingLogoIndex(0);
    const intervalId = setInterval(() => {
      setRotatingLogoIndex((prev) => (prev + 1) % ROTATING_LOGO_ORDER.length);
    }, LOGO_ROTATE_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [logoMode]);

  const effectiveLogoId = useMemo(
    () =>
      logoMode === "rotate"
        ? ROTATING_LOGO_ORDER[rotatingLogoIndex % ROTATING_LOGO_ORDER.length]
        : logoMode,
    [logoMode, rotatingLogoIndex]
  );
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

  const menuItems: LeftRailMenuItem[] = [
    "LIST",
    "DASHBOARD",
    "BACKUP",
    "ADD",
    "EDIT",
    "SEARCH",
    "TAG_PANEL",
    "HELP",
    "DELETE"
  ];
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
      ? flashMode === "static"
        ? theme.warn
        : fastPulseOn
          ? theme.warn
          : theme.dueSoon
      : filters.due === "today"
        ? theme.dueSoon
        : filters.due === "next7"
          ? theme.dueLater
          : "transparent";
  const dueText = dueBg === "transparent" ? theme.text : theme.bg;
  const priorityLabel = normalizePriorityFilterValue(filters.priority) ?? "(any)";
  const booleanTagSummary = formatTagFilterBooleanSummary(filters.tagFilter);

  const rawLogoLines = showLogo ? LOGO_VARIANTS[effectiveLogoId] : [];
  const logoLines = showLogo
    ? centerLogoInBox(rawLogoLines, LOGO_MAX_WIDTH, LOGO_RENDER_HEIGHT)
    : [];
  const taglineLines = showLogo ? wrapWords(APP_TAGLINE, LOGO_MAX_WIDTH) : [];
  const activeThemeLabel = activeThemeId ? formatThemeDisplayName(activeThemeId) : null;
  const blocksLogoNeedsDarkInk =
    effectiveLogoId === "alternate_blocks32" && isLightHexColor(theme.accentPurple);
  const logoPrimaryColor = blocksLogoNeedsDarkInk ? "#000000" : theme.text;

  return (
    <box style={{ flexDirection: "column", gap: 0, height: "100%" }}>
      <box style={{ flexDirection: "column", flexGrow: 1 }}>
        {showLogo ? (
          <box style={{ flexDirection: "column", width: "100%", alignItems: "center" }}>
            <box style={{ flexDirection: "column", width: LOGO_MAX_WIDTH }}>
              {logoLines.map((line, index) => (
                <text key={`logo-${effectiveLogoId}-${index}`} style={{ color: logoPrimaryColor }}>
                  {line}
                </text>
              ))}
              {logoLines.length > 0 ? (
                <box style={{ flexDirection: "row", justifyContent: "center", width: "100%" }}>
                  <text style={{ color: logoPrimaryColor, fontWeight: "bold" }}>
                    {PRODUCT_NAME_TM}
                  </text>
                </box>
              ) : null}
              {taglineLines.length > 0 ? (
                <box style={{ flexDirection: "column", width: "100%", alignItems: "center" }}>
                  {taglineLines.map((line, index) => (
                    <text key={`tagline-${index}`} style={{ color: theme.muted }}>
                      {line}
                    </text>
                  ))}
                </box>
              ) : null}
            </box>
          </box>
        ) : null}
        {showLogo && logoLines.length > 0 ? (
          <box style={{ flexDirection: "column", width: "100%", alignItems: "center" }}>
            <box style={{ flexDirection: "column", width: LOGO_MAX_WIDTH }}>
              <text style={{ color: theme.outline }}>{logoDivider}</text>
            </box>
          </box>
        ) : null}
        <text style={{ color: theme.muted }}>{version}</text>
        <text style={{ color: theme.muted, marginTop: 1 }}>DATE: {todayLabel}</text>
        <text style={{ color: theme.muted }}>TIME: {timeLabel}</text>

      <box style={{ marginTop: 1, flexDirection: "column", gap: 0 }}>
        <box style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
          <text style={styles.muted}>MODE:</text>
          <box style={{ backgroundColor: theme.accentPurple, paddingLeft: 1, paddingRight: 1 }}>
            <text style={{ color: theme.bg }}>{modeLabel}</text>
          </box>
        </box>
        <text style={styles.muted}>FOCUS: {focusLabel}</text>
      </box>

      <box style={{ marginTop: 1, flexDirection: "column", gap: 0 }}>
        <text style={styles.muted}>MENU</text>
        {menuItems.map((item) => {
          const active =
            item === modeLabel || (item === "TAG_PANEL" && mode === Mode.TAG_FILTER);
          return (
            <box
              key={item}
              style={{
                backgroundColor: active ? theme.accentBlue : "transparent",
                color: active ? theme.bg : theme.text,
                paddingLeft: 1,
                paddingRight: 1
              }}
              onMouseDown={(event) => {
                if (event.button !== 0 || !onMenuSelect) return;
                onMenuSelect(item);
              }}
            >
              <text>{formatMenuItemLabel(item)}</text>
            </box>
          );
        })}
      </box>

      <box style={{ marginTop: 1, flexDirection: "column", gap: 0 }}>
        <text style={styles.muted}>FILTERS</text>
        <box style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
          <text style={{ color: theme.text }}>STATUS (F):</text>
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
          <text style={{ color: theme.text }}>DUE (G):</text>
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
        <text style={{ color: theme.text }}>PRIORITY (R): {priorityLabel}</text>
        {booleanTagSummary ? (
          <text style={{ color: theme.text }}>TAGS (T): {booleanTagSummary}</text>
        ) : filters.tag ? (
          <box style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
            <text style={{ color: theme.text }}>TAG (T):</text>
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
          <text style={{ color: theme.text }}>TAG (T): (none)</text>
        )}
        <text style={{ color: theme.text }}>
          SEARCH (/): {filters.searchText?.trim() ? filters.searchText : "(none)"}
        </text>
        <text style={{ color: theme.text }}>SORT (S): {sortLabel}</text>
      </box>

      <box style={{ marginTop: 1, flexDirection: "column", gap: 0 }}>
        <text style={styles.muted}>HINTS</text>
        {HINT_LINES.map((line) => (
          <box key={line} style={{ flexDirection: "row" }}>
            <text style={{ color: theme.text }}>{formatHintLine(line)}</text>
          </box>
        ))}
      </box>
      </box>

      {activeThemeLabel ? (
        <text style={{ color: theme.muted }}>THEME: {activeThemeLabel}</text>
      ) : null}
    </box>
  );
}
