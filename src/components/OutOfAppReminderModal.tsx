import { formatLocalTimeHHmm } from "../domain/dates";
import type { ReminderIndexEvent } from "../reminders/types";
import { themeForObject } from "../app/theme";
import { formatDate } from "../state/store";
import {
  ModalActionButton,
  ModalActionRow,
  ModalContainer,
} from "./ModalPrimitives";

export type OutOfAppReminderActionId =
  | "complete"
  | "snooze10m"
  | "snooze1h"
  | "snooze1d"
  | "open"
  | "close";

export type OutOfAppReminderModalProps = {
  event: ReminderIndexEvent;
  notesSnippet?: string;
  selectedAction: OutOfAppReminderActionId;
  onChooseAction: (action: OutOfAppReminderActionId) => void;
};

function formatDateTimeLabel(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso;
  return `${formatDate(parsed)} ${formatLocalTimeHHmm(parsed)}`;
}

function formatTags(tags: string[]): string {
  if (tags.length === 0) return "(none)";
  return tags.join(" ");
}

function priorityLabel(priority: string): string {
  return priority.trim().length > 0 ? priority : "(none)";
}

export function OutOfAppReminderModal({
  event,
  notesSnippet,
  selectedAction,
  onChooseAction,
}: OutOfAppReminderModalProps) {
  const theme = themeForObject("notifications");

  return (
    <ModalContainer theme={theme} tone="warning" minWidth={86}>
      <text style={{ fontWeight: "bold", color: theme.bg }}>
        REMINDER [ESC close | ENTER confirm | TAB/ARROWS move]
      </text>
      <text style={{ color: theme.bg }}>Task: {event.title}</text>
      <text style={{ color: theme.bg }}>
        Due: {formatDateTimeLabel(event.dueAt)}
      </text>
      <text style={{ color: theme.bg }}>
        Reminder: {formatDateTimeLabel(event.remindAt)}
      </text>
      <text style={{ color: theme.bg }}>
        Priority: {priorityLabel(event.priority)}
      </text>
      <text style={{ color: theme.bg }}>Tags: {formatTags(event.tags)}</text>
      {notesSnippet ? (
        <text style={{ color: theme.bg }}>Notes: {notesSnippet}</text>
      ) : null}

      <ModalActionRow marginTop={1}>
        <ModalActionButton
          theme={theme}
          tone="warning"
          label="COMPLETE"
          onPress={() => onChooseAction("complete")}
          active={selectedAction === "complete"}
          paddingX={2}
        />
        <ModalActionButton
          theme={theme}
          tone="warning"
          label="OPEN TADOI"
          onPress={() => onChooseAction("open")}
          active={selectedAction === "open"}
          paddingX={2}
        />
        <ModalActionButton
          theme={theme}
          tone="warning"
          label="CLOSE"
          onPress={() => onChooseAction("close")}
          active={selectedAction === "close"}
          paddingX={2}
        />
      </ModalActionRow>

      <ModalActionRow>
        <ModalActionButton
          theme={theme}
          tone="warning"
          label="SNOOZE +10M"
          onPress={() => onChooseAction("snooze10m")}
          active={selectedAction === "snooze10m"}
          paddingX={2}
        />
        <ModalActionButton
          theme={theme}
          tone="warning"
          label="SNOOZE +1H"
          onPress={() => onChooseAction("snooze1h")}
          active={selectedAction === "snooze1h"}
          paddingX={2}
        />
        <ModalActionButton
          theme={theme}
          tone="warning"
          label="SNOOZE +1D"
          onPress={() => onChooseAction("snooze1d")}
          active={selectedAction === "snooze1d"}
          paddingX={2}
        />
      </ModalActionRow>
    </ModalContainer>
  );
}
