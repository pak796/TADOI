import type { TaskReminderEvent } from "../notifications/types";
import { formatLocalTimeHHmm } from "../domain/dates";
import type { Task } from "../domain/models";
import { themeForObject } from "../app/theme";
import { formatDate } from "../state/store";

type ReminderNotificationModalProps = {
  event: TaskReminderEvent;
  task?: Task;
  onDismiss: () => void;
  onSnooze10m: () => void;
  onSnooze1h: () => void;
  onSnooze1d: () => void;
  onGoToTask: () => void;
};

function formatDateTimeLabel(epochMs: number): string {
  if (!Number.isFinite(epochMs)) return "unknown";
  return `${formatDate(epochMs)} ${formatLocalTimeHHmm(epochMs)}`;
}

function resolveDueLabel(task: Task | undefined, fallbackDueAtIso: string | undefined): string | null {
  if (typeof task?.dueAt === "number" && Number.isFinite(task.dueAt)) {
    return formatDateTimeLabel(task.dueAt);
  }
  if (typeof fallbackDueAtIso !== "string") return null;
  const parsed = Date.parse(fallbackDueAtIso);
  if (!Number.isFinite(parsed)) return null;
  return formatDateTimeLabel(parsed);
}

export function ReminderNotificationModal({
  event,
  task,
  onDismiss,
  onSnooze10m,
  onSnooze1h,
  onSnooze1d,
  onGoToTask
}: ReminderNotificationModalProps) {
  const theme = themeForObject("modal");
  const dueLabel = resolveDueLabel(task, event.dueAt);
  const reminderTimeLabel = formatDateTimeLabel(event.effectiveReminderAt);

  return (
    <box
      style={{
        padding: 2,
        backgroundColor: theme.panel,
        border: true,
        borderStyle: "single",
        borderColor: theme.outline,
        minWidth: 72,
        flexDirection: "column",
        gap: 1
      }}
    >
      <text style={{ color: theme.text, fontWeight: "bold" }}>
        REMINDER [ENTER/ESC/1/2/3/G]
      </text>
      <text style={{ color: theme.text }}>Task: {event.title}</text>
      {dueLabel ? <text style={{ color: theme.muted }}>Due: {dueLabel}</text> : null}
      <text style={{ color: theme.muted }}>Reminder time: {reminderTimeLabel}</text>
      <box style={{ flexDirection: "row", gap: 1, marginTop: 1 }}>
        <box
          style={{ backgroundColor: theme.bg, paddingLeft: 1, paddingRight: 1 }}
          onMouseDown={(mouseEvent) => {
            if (mouseEvent.button !== 0) return;
            onDismiss();
          }}
        >
          <text style={{ color: theme.text, fontWeight: "bold" }}>[Enter/Esc] DISMISS</text>
        </box>
        <box
          style={{ backgroundColor: theme.bg, paddingLeft: 1, paddingRight: 1 }}
          onMouseDown={(mouseEvent) => {
            if (mouseEvent.button !== 0) return;
            onGoToTask();
          }}
        >
          <text style={{ color: theme.text, fontWeight: "bold" }}>[G] GO TO TASK</text>
        </box>
      </box>
      <box style={{ flexDirection: "row", gap: 1 }}>
        <box
          style={{ backgroundColor: theme.bg, paddingLeft: 1, paddingRight: 1 }}
          onMouseDown={(mouseEvent) => {
            if (mouseEvent.button !== 0) return;
            onSnooze10m();
          }}
        >
          <text style={{ color: theme.text, fontWeight: "bold" }}>[1] +10M</text>
        </box>
        <box
          style={{ backgroundColor: theme.bg, paddingLeft: 1, paddingRight: 1 }}
          onMouseDown={(mouseEvent) => {
            if (mouseEvent.button !== 0) return;
            onSnooze1h();
          }}
        >
          <text style={{ color: theme.text, fontWeight: "bold" }}>[2] +1H</text>
        </box>
        <box
          style={{ backgroundColor: theme.bg, paddingLeft: 1, paddingRight: 1 }}
          onMouseDown={(mouseEvent) => {
            if (mouseEvent.button !== 0) return;
            onSnooze1d();
          }}
        >
          <text style={{ color: theme.text, fontWeight: "bold" }}>[3] +1D</text>
        </box>
      </box>
    </box>
  );
}
