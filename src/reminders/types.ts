export const REMINDER_INDEX_VERSION = 1;
export const REMINDER_HELPER_STATE_VERSION = 1;
export const REMINDER_INDEX_LOOKAHEAD_DAYS = 30;
export const REMINDER_HELPER_STATE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type ReminderIndexEvent = {
  eventId: string;
  taskId: string;
  occurrenceKey: string;
  remindAt: string;
  dueAt: string;
  title: string;
  priority: string;
  tags: string[];
};

export type ReminderIndex = {
  version: number;
  generatedAt: string;
  events: ReminderIndexEvent[];
};

export type ReminderHelperState = {
  version: number;
  updatedAt: string;
  fired: Record<string, string>;
};

export type ReminderCommandStatus = {
  installed: boolean;
  enabled?: boolean;
  details: string[];
};
