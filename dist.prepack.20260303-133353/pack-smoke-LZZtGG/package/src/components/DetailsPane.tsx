import { diffLocalDays, formatLocalTimeHHmm, startOfLocalDayMs } from "../domain/dates";
import { getChecklistProgress, sortChecklistItems } from "../domain/checklist";
import { getRecurrenceSummary } from "../domain/recurrence/draft";
import { formatTagForReadOnlyDisplay } from "../domain/priorityTags";
import { resolveTaskLinkKind } from "../domain/taskLinks";
import { VisibleTaskRow } from "../domain/taskRows";
import { formatDate, getDueLabel } from "../state/store";
import { colorForTag, theme } from "../app/theme";
import type { FlashMode } from "../settings/settings";

const LINK_PRIMARY_MAX = 38;
const LINK_SECONDARY_MAX = 40;

function truncateWithEllipsis(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  if (maxLength <= 1) return value.slice(0, maxLength);
  return `${value.slice(0, maxLength - 1)}…`;
}

function summarizeUrlTarget(target: string): string {
  try {
    const parsed = new URL(target);
    if (parsed.host && parsed.pathname) {
      return `${parsed.host}${parsed.pathname}`;
    }
    if (parsed.host) {
      return parsed.host;
    }
    if (parsed.pathname) {
      return parsed.pathname;
    }
  } catch {
    // Fall through to target fallback.
  }
  return target;
}

function summarizePathTarget(target: string): string {
  const segments = target.split(/[\\/]+/).filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : target;
}

type DetailsPaneProps = {
  task?: VisibleTaskRow;
  now: number;
  pulseOn: boolean;
  fastPulseOn: boolean;
  flashMode: FlashMode;
  selectedLinkId?: string;
  linksFocused: boolean;
  selectedChecklistItemId?: string;
  checklistFocused: boolean;
  checklistWindowStart?: number;
  checklistWindowSize?: number;
  onSelectLink?: (linkId: string) => void;
  onOpenLink?: (linkId: string) => void;
  onSelectChecklistItem?: (itemId: string) => void;
};

export function DetailsPane({
  task,
  now,
  pulseOn,
  fastPulseOn,
  flashMode,
  selectedLinkId,
  linksFocused,
  selectedChecklistItemId,
  checklistFocused,
  checklistWindowStart = 0,
  checklistWindowSize = 6,
  onSelectLink,
  onOpenLink,
  onSelectChecklistItem
}: DetailsPaneProps) {
  if (!task) {
    return <text style={{ color: theme.muted }}>Select a task to view details.</text>;
  }

  const startOfToday = startOfLocalDayMs(now);
  const dayDiff =
    task.status === "open" && task.dueAt !== undefined
      ? diffLocalDays(task.dueAt, startOfToday)
      : null;
  const hasExplicitTime = task.hasExplicitTime === true;
  const isTimeOverdue =
    task.status === "open" &&
    hasExplicitTime &&
    dayDiff === 0 &&
    task.dueAt !== undefined &&
    now > task.dueAt;
  const isDueToday =
    task.status === "open" && dayDiff !== null && dayDiff === 0 && !isTimeOverdue;
  const isOverdue =
    task.status === "open" && dayDiff !== null && (dayDiff < 0 || isTimeOverdue);
  const isDueSoon =
    task.status === "open" && dayDiff !== null && dayDiff >= 1 && dayDiff <= 7;
  const isDueLater = task.status === "open" && dayDiff !== null && dayDiff >= 8;
  const dueTodayPulseOn = flashMode !== "static" && pulseOn;
  const attentionColor = isOverdue
    ? theme.warn
    : isDueToday
      ? theme.dueSoon
      : isDueSoon
        ? theme.dueSoon
        : isDueLater
          ? theme.dueLater
          : theme.muted;
  const highlightBackground = isOverdue
    ? flashMode === "static"
      ? theme.warn
      : fastPulseOn
        ? theme.warn
        : theme.dueSoon
    : isDueToday && dueTodayPulseOn
      ? theme.dueSoon
      : "transparent";
  const highlightText = isOverdue
    ? theme.bg
    : isDueToday && dueTodayPulseOn
      ? theme.bg
      : attentionColor;
  const recurrenceSummary = getRecurrenceSummary(task.recurrence);
  const isOccurrenceRow =
    task.rowKind === "series_occurrence_virtual" ||
    task.rowKind === "series_occurrence_instance";
  const links = task.links ?? [];
  const checklistItems = sortChecklistItems(task.checklist ?? []);
  const checklistProgress = getChecklistProgress(task.checklist);
  const checklistVisibleRows = Math.max(1, checklistWindowSize);
  const checklistStart = Math.max(
    0,
    Math.min(checklistWindowStart, Math.max(0, checklistItems.length - checklistVisibleRows))
  );
  const checklistWindow = checklistItems.slice(
    checklistStart,
    checklistStart + checklistVisibleRows
  );
  const checklistHiddenAbove = checklistStart;
  const checklistHiddenBelow = Math.max(
    0,
    checklistItems.length - (checklistStart + checklistWindow.length)
  );

  return (
    <box style={{ flexDirection: "column" }}>
      <text style={{ color: theme.text, fontWeight: "bold" }}>{task.title}</text>
      <box
        style={{
          flexDirection: "row",
          gap: 1,
          backgroundColor: highlightBackground
        }}
      >
        <text style={{ color: highlightText }}>STATUS:</text>
        <text
          style={{
            color:
              task.status === "done"
                ? theme.ok
                : task.status === "archived"
                  ? theme.muted
                : isOverdue
                  ? theme.bg
                  : isDueToday && dueTodayPulseOn
                    ? theme.bg
                    : isDueToday
                      ? theme.dueSoon
                      : isDueSoon
                        ? theme.dueSoon
                        : isDueLater
                          ? theme.dueLater
                          : theme.accentOrange
          }}
        >
          {task.status === "done"
            ? "DONE"
            : task.status === "archived"
              ? "ARCHIVED"
              : "OPEN"}
        </text>
      </box>
      <box
        style={{
          backgroundColor: highlightBackground
        }}
      >
        <text style={{ color: highlightText }}>{getDueLabel(task, now)}</text>
      </box>
      {task.dueAt && hasExplicitTime ? (
        <text style={{ color: theme.muted }}>
          DUE TIME: {formatLocalTimeHHmm(task.dueAt)}
        </text>
      ) : null}
      {task.status === "done" ? (
        <text style={{ color: theme.ok }}>
          CLOSED: {formatDate(task.closedAt ?? task.updatedAt)}
        </text>
      ) : null}
      {recurrenceSummary ? (
        <text style={{ color: theme.muted }}>REPEATS: {recurrenceSummary}</text>
      ) : null}
      {isOccurrenceRow && task.occurrenceIso ? (
        <text style={{ color: theme.muted }}>OCCURRENCE: {task.occurrenceIso}</text>
      ) : null}
      {isOccurrenceRow && task.seriesId ? (
        <text style={{ color: theme.muted }}>SERIES: {task.seriesId}</text>
      ) : null}
      <box style={{ flexDirection: "column", marginTop: 1 }}>
        <text style={{ color: theme.muted }}>PRIORITY & TAGS</text>
        {task.tags.length ? (
          <box style={{ flexDirection: "row", gap: 1 }}>
            {task.tags.map((tag) => (
              <box
                key={tag}
                style={{
                  backgroundColor: colorForTag(tag),
                  color: theme.bg,
                  paddingLeft: 1,
                  paddingRight: 1
                }}
              >
                <text>{formatTagForReadOnlyDisplay(tag)}</text>
              </box>
            ))}
          </box>
        ) : (
          <text style={{ color: theme.muted }}>NONE</text>
        )}
      </box>
      <box style={{ marginTop: 1 }}>
        <text style={{ color: theme.muted }}>NOTES</text>
      </box>
      <text style={{ color: theme.text }}>{task.notes || "(no notes)"}</text>
      <box style={{ flexDirection: "column", marginTop: 1 }}>
        <text style={{ color: theme.muted }}>
          Links / Attachments ({links.length})
        </text>
        {links.length === 0 ? (
          <text style={{ color: theme.muted }}>No links yet — press L to add</text>
        ) : (
          <box style={{ flexDirection: "column", marginTop: 1 }}>
            {links.map((link) => {
              const selected = selectedLinkId === link.id;
              const rowBackground = selected
                ? linksFocused
                  ? theme.accentBlue
                  : theme.outline
                : "transparent";
              const rowTextColor = selected && linksFocused ? theme.bg : theme.text;
              const secondaryColor = selected && linksFocused ? theme.bg : theme.muted;
              const primary = link.label?.trim().length
                ? link.label.trim()
                : link.target;
              const secondary = resolveTaskLinkKind(link) === "url"
                ? summarizeUrlTarget(link.target)
                : summarizePathTarget(link.target);

              return (
                <box
                  key={link.id}
                  style={{
                    flexDirection: "column",
                    paddingLeft: 1,
                    paddingRight: 1,
                    backgroundColor: rowBackground
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    if (selected) {
                      onOpenLink?.(link.id);
                      return;
                    }
                    onSelectLink?.(link.id);
                  }}
                >
                  <text style={{ color: rowTextColor }}>
                    {truncateWithEllipsis(primary, LINK_PRIMARY_MAX)}
                  </text>
                  <text style={{ color: secondaryColor }}>
                    {truncateWithEllipsis(secondary, LINK_SECONDARY_MAX)}
                  </text>
                </box>
              );
            })}
          </box>
        )}
      </box>
      <box style={{ flexDirection: "column", marginTop: 1 }}>
        <text style={{ color: theme.muted }}>
          CHECKLIST ({String(checklistProgress.done)}/{String(checklistProgress.total)})
        </text>
        {checklistItems.length === 0 ? (
          <text style={{ color: theme.muted }}>No checklist items</text>
        ) : (
          <box style={{ flexDirection: "column", marginTop: 1 }}>
            {checklistHiddenAbove > 0 ? (
              <text style={{ color: theme.muted }}>
                ↑ {String(checklistHiddenAbove)} more
              </text>
            ) : null}
            {checklistWindow.map((item) => {
              const selected = item.id === selectedChecklistItemId;
              const rowBackground = selected
                ? checklistFocused
                  ? theme.accentBlue
                  : theme.outline
                : "transparent";
              const rowTextColor = selected && checklistFocused ? theme.bg : theme.text;
              const status = item.isDone ? "[x]" : "[ ]";
              return (
                <box
                  key={item.id}
                  style={{
                    flexDirection: "row",
                    gap: 1,
                    paddingLeft: 1,
                    paddingRight: 1,
                    backgroundColor: rowBackground
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    onSelectChecklistItem?.(item.id);
                  }}
                >
                  <text style={{ color: rowTextColor }}>{status}</text>
                  <text style={{ color: rowTextColor }}>{item.text}</text>
                </box>
              );
            })}
            {checklistHiddenBelow > 0 ? (
              <text style={{ color: theme.muted }}>
                ↓ {String(checklistHiddenBelow)} more
              </text>
            ) : null}
          </box>
        )}
      </box>
      {isOccurrenceRow ? (
        <box style={{ marginTop: 1 }}>
          <text style={{ color: theme.muted }}>space: complete/reopen · x: skip · z: snooze · e: edit occurrence · E: edit series</text>
        </box>
      ) : null}
    </box>
  );
}
