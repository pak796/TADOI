import { diffLocalDays, startOfLocalDayMs } from "../domain/dates";
import { Task } from "../domain/models";
import { formatDate, getDueInLabel } from "../state/store";
import { colorForTag, theme } from "../app/theme";

type TaskListProps = {
  tasks: Task[];
  selectedId?: string;
  now: number;
  pulseOn: boolean;
  fastPulseOn: boolean;
  scrollOffset: number;
  visibleRows: number;
  visibleLines: number;
};

export function TaskList({
  tasks,
  selectedId,
  now,
  pulseOn,
  fastPulseOn,
  scrollOffset,
  visibleRows,
  visibleLines
}: TaskListProps) {
  const windowed = tasks.slice(scrollOffset, scrollOffset + visibleRows);
  const clampedOffset = Math.max(
    0,
    Math.min(scrollOffset, Math.max(0, tasks.length - visibleRows))
  );
  const hasScroll = tasks.length > visibleRows;
  const thumbSize = hasScroll
    ? Math.max(1, Math.round((visibleRows / tasks.length) * visibleLines))
    : visibleLines;
  const maxThumbTop = Math.max(0, visibleLines - thumbSize);
  const thumbTop = hasScroll
    ? Math.round((clampedOffset / Math.max(1, tasks.length - visibleRows)) * maxThumbTop)
    : 0;
  return (
    <box style={{ flexGrow: 1, flexDirection: "row" }}>
      <box style={{ flexGrow: 1, paddingLeft: 1, paddingRight: 1 }}>
        {tasks.length === 0 ? (
          <text style={{ color: theme.muted }}>No tasks yet.</text>
        ) : (
          windowed.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              selected={task.id === selectedId}
              now={now}
              pulseOn={pulseOn}
              fastPulseOn={fastPulseOn}
            />
          ))
        )}
      </box>
      <box style={{ width: 2, alignItems: "center" }}>
        {Array.from({ length: visibleLines }).map((_, index) => {
          const active = index >= thumbTop && index < thumbTop + thumbSize;
          return (
            <box
              key={index}
              style={{
                justifyContent: "center",
                alignItems: "center"
              }}
            >
              <text style={{ color: active ? theme.text : theme.outline }}>
                {active ? "█" : "│"}
              </text>
            </box>
          );
        })}
      </box>
    </box>
  );
}

type TaskRowProps = {
  task: Task;
  selected: boolean;
  now: number;
  pulseOn: boolean;
  fastPulseOn: boolean;
};

function TaskRow({ task, selected, now, pulseOn, fastPulseOn }: TaskRowProps) {
  const statusIcon = task.status === "done" ? "✓" : task.status === "archived" ? "✱" : "•";
  const closedText =
    task.status === "done" ? formatDate(task.closedAt ?? task.updatedAt) : "";
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
  const isDone = task.status === "done";
  const dueInDays =
    task.status === "open" && dayDiff !== null && dayDiff >= 0 ? dayDiff : null;
  const dueLabel = task.dueAt
    ? hasExplicitTime && dayDiff === 0
      ? getDueInLabel(task, now)
      : dayDiff === 0
        ? "DUE TODAY"
        : `DUE ${formatDate(task.dueAt)}`
    : "NO DUE DATE";
  const dueInLabel = task.status === "open" && task.dueAt ? getDueInLabel(task, now) : "";

  const baseOpenColor = isOverdue
    ? theme.warn
    : isDueToday || isDueSoon
      ? theme.dueSoon
      : isDueLater
        ? theme.dueLater
        : theme.text;
  const statusColor =
    isDone
      ? theme.bg
      : task.status === "archived"
        ? theme.muted
        : selected
          ? theme.bg
          : baseOpenColor;
  const titleColor =
    isDone
      ? theme.bg
      : task.status === "archived"
        ? theme.muted
        : selected
          ? theme.bg
          : baseOpenColor;
  const rowBackground = isDone
    ? theme.ok
    : task.status === "archived"
      ? "transparent"
      : selected && isOverdue
        ? theme.warn
        : selected && (isDueToday || isDueSoon)
          ? theme.dueSoon
          : selected && isDueLater
            ? theme.dueLater
            : selected
              ? theme.accentBlue
              : "transparent";

  const dueHighlightBackground = isOverdue
    ? fastPulseOn
      ? theme.warn
      : theme.dueSoon
    : "transparent";
  const dueHighlightText = isOverdue ? theme.bg : baseOpenColor;

  return (
    <box
      style={{
        paddingLeft: 1,
        paddingRight: 1,
        backgroundColor: rowBackground,
        color: selected ? theme.bg : theme.text
      }}
    >
      <box style={{ flexDirection: "row", flexGrow: 1 }}>
        <box style={{ width: 2, justifyContent: "center" }}>
          <text style={{ color: selected ? theme.bg : theme.muted }}>
            {selected ? "▶" : " "}
          </text>
        </box>
        <box style={{ flexDirection: "column", flexGrow: 1 }}>
          <box style={{ flexDirection: "row", gap: 1 }}>
            <text style={{ color: statusColor }}>{statusIcon}</text>
            <text style={{ color: titleColor }}>{task.title}</text>
          </box>
          <box style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {isOverdue ? (
              <box style={{ backgroundColor: dueHighlightBackground }}>
                <text style={{ color: dueHighlightText }}>{dueLabel}</text>
              </box>
            ) : (
              <text style={{ color: baseOpenColor }}>{dueLabel}</text>
            )}
          {closedText ? (
            <text style={{ color: isDone ? theme.bg : selected ? theme.bg : theme.ok }}>
              DONE {closedText}
            </text>
          ) : isOverdue && dueInLabel ? (
            <box style={{ backgroundColor: dueHighlightBackground }}>
              <text style={{ color: dueHighlightText }}>{dueInLabel}</text>
            </box>
          ) : dueInDays !== null && dueInLabel ? (
            isDueToday ? (
              <box style={{ backgroundColor: theme.dueSoon }}>
                <text style={{ color: pulseOn ? theme.bg : theme.text }}>{dueInLabel}</text>
              </box>
            ) : (
              <text style={{ color: selected ? theme.bg : baseOpenColor }}>{dueInLabel}</text>
            )
          ) : null}
          </box>
          <box style={{ flexDirection: "row", gap: 1 }}>
            {task.tags.length > 0 ? (
              task.tags.map((tag) => (
                <box
                  key={tag}
                  style={{
                    backgroundColor: colorForTag(tag),
                    color: theme.bg,
                    paddingLeft: 1,
                    paddingRight: 1
                  }}
                >
                  <text>#{tag}</text>
                </box>
              ))
            ) : (
              <text style={{ color: "transparent" }}>.</text>
            )}
          </box>
        </box>
      </box>
    </box>
  );
}
