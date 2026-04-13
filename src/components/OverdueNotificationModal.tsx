import { formatLocalTimeHHmm } from "../domain/dates";
import type { Task } from "../domain/models";
import {
  formatTagForReadOnlyDisplay,
  normalizePriorityTags,
} from "../domain/priorityTags";
import { themeForObject } from "../app/theme";
import { formatDate } from "../state/store";
import type { TaskOverdueEvent } from "../notifications/types";
import {
  ModalActionButton,
  ModalActionRow,
  ModalContainer,
} from "./ModalPrimitives";

type OverdueNotificationModalProps = {
  event: TaskOverdueEvent;
  task?: Task;
  nowMs: number;
  onSnooze: () => void;
  onDone: () => void;
  onGoToTask: () => void;
  onDismiss: () => void;
};

export function formatDueDateTimeLabel(dueAtIso: string): string {
  const dueAtMs = Date.parse(dueAtIso);
  if (!Number.isFinite(dueAtMs)) return dueAtIso;
  return `${formatDate(dueAtMs)} ${formatLocalTimeHHmm(dueAtMs)}`;
}

export function formatOverdueBy(nowMs: number, dueAtIso: string): string {
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
  onDismiss,
}: OverdueNotificationModalProps) {
  const theme = themeForObject("notifications");
  const modalWidth = 64;
  const dueLabel = formatDueDateTimeLabel(event.dueAt);
  const overdueBy = formatOverdueBy(nowMs, event.dueAt);
  const tags = normalizePriorityTags(task?.tags ?? []);

  return (
    <ModalContainer theme={theme} tone="warning" minWidth={modalWidth}>
      <text style={{ fontWeight: "bold" }}>TASK OVERDUE [S/D/G/ESC]</text>
      <text>Task: {event.title}</text>
      <text>Due: {dueLabel}</text>
      <text>Status: overdue by {overdueBy}</text>
      {tags.length > 0 ? (
        <text>
          Tags: {tags.map((tag) => formatTagForReadOnlyDisplay(tag)).join(" ")}
        </text>
      ) : null}
      <ModalActionRow marginTop={1}>
        <ModalActionButton
          theme={theme}
          tone="warning"
          label="SNOOZE 10M [S]"
          onPress={onSnooze}
          paddingX={2}
        />
        <ModalActionButton
          theme={theme}
          tone="warning"
          label="MARK DONE [D]"
          onPress={onDone}
          paddingX={2}
        />
      </ModalActionRow>
      <ModalActionRow>
        <ModalActionButton
          theme={theme}
          tone="warning"
          label="GO TO TASK [G]"
          onPress={onGoToTask}
          paddingX={2}
        />
        <ModalActionButton
          theme={theme}
          tone="warning"
          label="DISMISS [ESC]"
          onPress={onDismiss}
          paddingX={2}
        />
      </ModalActionRow>
    </ModalContainer>
  );
}
