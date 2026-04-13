import type { TaskReminderEvent } from "../notifications/types";
import { formatLocalTimeHHmm } from "../domain/dates";
import type { Task } from "../domain/models";
import { themeForObject } from "../app/theme";
import { formatDate } from "../state/store";
import {
  ModalActionButton,
  ModalActionRow,
  ModalContainer,
} from "./ModalPrimitives";

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

function resolveDueLabel(
  task: Task | undefined,
  fallbackDueAtIso: string | undefined,
): string | null {
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
  onGoToTask,
}: ReminderNotificationModalProps) {
  const theme = themeForObject("modal");
  const dueLabel = resolveDueLabel(task, event.dueAt);
  const reminderTimeLabel = formatDateTimeLabel(event.effectiveReminderAt);

  return (
    <ModalContainer theme={theme} minWidth={72}>
      <text style={{ color: theme.text, fontWeight: "bold" }}>
        REMINDER [ENTER/ESC/1/2/3/G]
      </text>
      <text style={{ color: theme.text }}>Task: {event.title}</text>
      {dueLabel ? (
        <text style={{ color: theme.muted }}>Due: {dueLabel}</text>
      ) : null}
      <text style={{ color: theme.muted }}>
        Reminder time: {reminderTimeLabel}
      </text>
      <ModalActionRow marginTop={1}>
        <ModalActionButton
          theme={theme}
          label="DISMISS [ENTER/ESC]"
          onPress={onDismiss}
          paddingX={2}
        />
        <ModalActionButton
          theme={theme}
          label="GO TO TASK [G]"
          onPress={onGoToTask}
          paddingX={2}
        />
      </ModalActionRow>
      <ModalActionRow>
        <ModalActionButton
          theme={theme}
          label="SNOOZE +10M [1]"
          onPress={onSnooze10m}
          paddingX={2}
        />
        <ModalActionButton
          theme={theme}
          label="SNOOZE +1H [2]"
          onPress={onSnooze1h}
          paddingX={2}
        />
        <ModalActionButton
          theme={theme}
          label="SNOOZE +1D [3]"
          onPress={onSnooze1d}
          paddingX={2}
        />
      </ModalActionRow>
    </ModalContainer>
  );
}
