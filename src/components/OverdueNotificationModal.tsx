import { formatLocalTimeHHmm } from "../domain/dates";
import type { Task } from "../domain/models";
import { normalizePriorityTags } from "../domain/priorityTags";
import { formatTagForDisplay } from "../domain/tagIndex";
import { themeForObject } from "../app/theme";
import { formatDate } from "../state/store";
import type { TaskOverdueEvent } from "../notifications/types";

type OverdueNotificationModalProps = {
  event: TaskOverdueEvent;
  task?: Task;
  nowMs: number;
  onSnooze: () => void;
  onDone: () => void;
  onGoToTask: () => void;
  onDismiss: () => void;
};

function formatDueDateTimeLabel(dueAtIso: string): string {
  const dueAtMs = Date.parse(dueAtIso);
  if (!Number.isFinite(dueAtMs)) return dueAtIso;
  return `${formatDate(dueAtMs)} ${formatLocalTimeHHmm(dueAtMs)}`;
}

function formatOverdueBy(nowMs: number, dueAtIso: string): string {
  const dueAtMs = Date.parse(dueAtIso);
  if (!Number.isFinite(dueAtMs)) return "unknown";
  const overdueMs = Math.max(0, nowMs - dueAtMs);
  const totalMinutes = Math.floor(overdueMs / 60_000);
  if (totalMinutes <= 0) return "<1m";

  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function OverdueNotificationModal({
  event,
  task,
  nowMs,
  onSnooze,
  onDone,
  onGoToTask,
  onDismiss
}: OverdueNotificationModalProps) {
  const theme = themeForObject("notifications");
  const dueLabel = formatDueDateTimeLabel(event.dueAt);
  const overdueBy = formatOverdueBy(nowMs, event.dueAt);
  const tags = normalizePriorityTags(task?.tags ?? []);

  return (
    <box
      style={{
        padding: 2,
        backgroundColor: theme.warn,
        color: theme.bg,
        minWidth: 56,
        border: true,
        borderStyle: "single",
        borderColor: theme.outline
      }}
    >
      <text style={{ fontWeight: "bold" }}>Task Overdue</text>
      <text>Task: {event.title}</text>
      <text>Due: {dueLabel}</text>
      <text>Status: Overdue by {overdueBy}</text>
      {tags.length > 0 ? (
        <text>Tags: {tags.map((tag) => formatTagForDisplay(tag)).join(" ")}</text>
      ) : null}
      <box style={{ flexDirection: "row", gap: 1, marginTop: 1 }}>
        <box
          style={{ backgroundColor: theme.bg, paddingLeft: 1, paddingRight: 1 }}
          onMouseDown={(mouseEvent) => {
            if (mouseEvent.button !== 0) return;
            onSnooze();
          }}
        >
          <text style={{ color: theme.warn, fontWeight: "bold" }}>[S] Snooze 10m</text>
        </box>
        <box
          style={{ backgroundColor: theme.bg, paddingLeft: 1, paddingRight: 1 }}
          onMouseDown={(mouseEvent) => {
            if (mouseEvent.button !== 0) return;
            onDone();
          }}
        >
          <text style={{ color: theme.warn, fontWeight: "bold" }}>[D] Mark Done</text>
        </box>
        <box
          style={{ backgroundColor: theme.bg, paddingLeft: 1, paddingRight: 1 }}
          onMouseDown={(mouseEvent) => {
            if (mouseEvent.button !== 0) return;
            onGoToTask();
          }}
        >
          <text style={{ color: theme.warn, fontWeight: "bold" }}>[G] Go to Task</text>
        </box>
        <box
          style={{ backgroundColor: theme.bg, paddingLeft: 1, paddingRight: 1 }}
          onMouseDown={(mouseEvent) => {
            if (mouseEvent.button !== 0) return;
            onDismiss();
          }}
        >
          <text style={{ color: theme.warn, fontWeight: "bold" }}>[Esc] Dismiss</text>
        </box>
      </box>
    </box>
  );
}
