import { diffLocalDays, formatLocalTimeHHmm, startOfLocalDayMs } from "../domain/dates";
import { getRecurrenceSummary } from "../domain/recurrence/draft";
import { formatTagForDisplay } from "../domain/tagIndex";
import { VisibleTaskRow } from "../domain/taskRows";
import { formatDate, getDueLabel } from "../state/store";
import { colorForTag, theme } from "../app/theme";
import type { FlashMode } from "../settings/settings";

type DetailsPaneProps = {
  task?: VisibleTaskRow;
  now: number;
  pulseOn: boolean;
  fastPulseOn: boolean;
  flashMode: FlashMode;
};

export function DetailsPane({
  task,
  now,
  pulseOn,
  fastPulseOn,
  flashMode
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
        <text style={{ color: theme.muted }}>TAGS</text>
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
                <text>{formatTagForDisplay(tag)}</text>
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
      {isOccurrenceRow ? (
        <box style={{ marginTop: 1 }}>
          <text style={{ color: theme.muted }}>space: complete/reopen · x: skip · z: snooze · e: edit occurrence · E: edit series</text>
        </box>
      ) : null}
    </box>
  );
}
