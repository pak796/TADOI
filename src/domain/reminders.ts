import {
  combineLocalDateAndTime,
  formatLocalTimeHHmm,
  parseDateToLocalMidnight,
  parseTimeToMinutes
} from "./dates";
import type { EditorDraft, Task, TaskReminder, TaskReminderOffsetUnit } from "./models";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const DEFAULT_REMINDER_OFFSET_TEXT = "10";
const DEFAULT_REMINDER_OFFSET_UNIT: TaskReminderOffsetUnit = "minutes";

const OFFSET_UNIT_MS: Record<TaskReminderOffsetUnit, number> = {
  minutes: MINUTE_MS,
  hours: HOUR_MS,
  days: DAY_MS
};

export type ReminderDraftFields = Pick<
  EditorDraft,
  | "reminderKind"
  | "reminderAtDateText"
  | "reminderAtTimeText"
  | "reminderOffsetText"
  | "reminderOffsetUnit"
>;

type ReminderComparableRule = Pick<TaskReminder, "kind" | "at" | "offsetMs">;

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizePositiveInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : undefined;
}

function normalizeTaskReminderKind(value: unknown): TaskReminder["kind"] {
  return value === "absolute" || value === "before_due" ? value : "none";
}

export function normalizeReminderOffsetUnit(value: unknown): TaskReminderOffsetUnit {
  return value === "hours" || value === "days" ? value : "minutes";
}

export function createDefaultReminderDraftFields(): ReminderDraftFields {
  return {
    reminderKind: "none",
    reminderAtDateText: "",
    reminderAtTimeText: "",
    reminderOffsetText: DEFAULT_REMINDER_OFFSET_TEXT,
    reminderOffsetUnit: DEFAULT_REMINDER_OFFSET_UNIT
  };
}

export function parseReminderOffsetMs(
  offsetText: string,
  unit: TaskReminderOffsetUnit
): number | undefined {
  const parsed = Number.parseInt(offsetText.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.max(1, parsed) * OFFSET_UNIT_MS[unit];
}

function deriveOffsetDraftFromMs(offsetMs: number | undefined): {
  reminderOffsetText: string;
  reminderOffsetUnit: TaskReminderOffsetUnit;
} {
  if (!offsetMs || offsetMs <= 0) {
    return {
      reminderOffsetText: DEFAULT_REMINDER_OFFSET_TEXT,
      reminderOffsetUnit: DEFAULT_REMINDER_OFFSET_UNIT
    };
  }
  if (offsetMs % DAY_MS === 0) {
    return {
      reminderOffsetText: String(offsetMs / DAY_MS),
      reminderOffsetUnit: "days"
    };
  }
  if (offsetMs % HOUR_MS === 0) {
    return {
      reminderOffsetText: String(offsetMs / HOUR_MS),
      reminderOffsetUnit: "hours"
    };
  }
  return {
    reminderOffsetText: String(Math.max(1, Math.floor(offsetMs / MINUTE_MS))),
    reminderOffsetUnit: "minutes"
  };
}

export function reminderDraftFieldsFromTask(task: Task): ReminderDraftFields {
  const reminder = normalizeTaskReminder(task.reminder);
  if (!reminder) return createDefaultReminderDraftFields();

  if (reminder.kind === "absolute") {
    const at = reminder.at;
    const dateText = isFiniteTimestamp(at) ? formatDateYyyyMmDd(at) : "";
    const timeText = isFiniteTimestamp(at) ? formatLocalTimeHHmm(at) : "";
    return {
      reminderKind: "absolute",
      reminderAtDateText: dateText,
      reminderAtTimeText: timeText,
      ...deriveOffsetDraftFromMs(reminder.offsetMs)
    };
  }

  if (reminder.kind === "before_due") {
    return {
      reminderKind: "before_due",
      reminderAtDateText: "",
      reminderAtTimeText: "",
      ...deriveOffsetDraftFromMs(reminder.offsetMs)
    };
  }

  return createDefaultReminderDraftFields();
}

function parseReminderAbsoluteAt(
  dateText: string,
  timeText: string
): number | undefined {
  const date = parseDateToLocalMidnight(dateText);
  if (!date) return undefined;

  const trimmedTime = timeText.trim();
  if (trimmedTime.length === 0) {
    return date.getTime();
  }
  if (parseTimeToMinutes(trimmedTime) === undefined) {
    return undefined;
  }
  const combined = combineLocalDateAndTime(date, trimmedTime);
  return combined ? combined.getTime() : undefined;
}

function reminderRuleMatches(
  left: ReminderComparableRule | undefined,
  right: ReminderComparableRule | undefined
): boolean {
  if (!left && !right) return true;
  if (!left || !right) return false;
  if (left.kind !== right.kind) return false;
  if (left.kind === "absolute") {
    return left.at === right.at;
  }
  if (left.kind === "before_due") {
    return left.offsetMs === right.offsetMs;
  }
  return true;
}

function withReminderRuntimeState(
  reminder: TaskReminder | undefined,
  previous: TaskReminder | undefined
): TaskReminder | undefined {
  if (!reminder) return undefined;
  if (!previous) return reminder;
  if (!reminderRuleMatches(reminder, previous)) {
    return reminder;
  }
  return {
    ...reminder,
    ...(isFiniteTimestamp(previous.lastFiredAt)
      ? { lastFiredAt: previous.lastFiredAt }
      : {}),
    ...(isFiniteTimestamp(previous.snoozedUntilAt)
      ? { snoozedUntilAt: previous.snoozedUntilAt }
      : {})
  };
}

export function buildReminderFromDraft(input: {
  draft: ReminderDraftFields;
  dueAt?: number;
  previousReminder?: TaskReminder;
}): {
  reminder?: TaskReminder;
  validationMessage?: string;
} {
  const normalizedPrevious = normalizeTaskReminder(input.previousReminder);
  const kind = normalizeTaskReminderKind(input.draft.reminderKind);

  if (kind === "none") {
    return { reminder: undefined };
  }

  if (kind === "absolute") {
    const at = parseReminderAbsoluteAt(
      input.draft.reminderAtDateText,
      input.draft.reminderAtTimeText
    );
    const reminder: TaskReminder = {
      kind: "absolute",
      ...(isFiniteTimestamp(at) ? { at } : {})
    };
    return {
      reminder: withReminderRuntimeState(reminder, normalizedPrevious)
    };
  }

  const offsetMs = parseReminderOffsetMs(
    input.draft.reminderOffsetText,
    input.draft.reminderOffsetUnit
  );
  const reminder: TaskReminder = {
    kind: "before_due",
    ...(offsetMs !== undefined ? { offsetMs } : {})
  };
  return {
    reminder: withReminderRuntimeState(reminder, normalizedPrevious),
    validationMessage:
      input.dueAt === undefined
        ? "Set a due date to use 'before due' reminders"
        : undefined
  };
}

export function normalizeTaskReminder(
  reminder: Task["reminder"] | undefined
): TaskReminder | undefined {
  if (!reminder || typeof reminder !== "object") return undefined;
  const kind = normalizeTaskReminderKind(reminder.kind);
  if (kind === "none") return undefined;

  const at = normalizePositiveInteger(reminder.at);
  const offsetMs = normalizePositiveInteger(reminder.offsetMs);
  const lastFiredAt = normalizePositiveInteger(reminder.lastFiredAt);
  const snoozedUntilAt = normalizePositiveInteger(reminder.snoozedUntilAt);

  if (kind === "absolute") {
    return {
      kind,
      ...(at !== undefined ? { at } : {}),
      ...(lastFiredAt !== undefined ? { lastFiredAt } : {}),
      ...(snoozedUntilAt !== undefined ? { snoozedUntilAt } : {})
    };
  }

  return {
    kind,
    ...(offsetMs !== undefined ? { offsetMs } : {}),
    ...(lastFiredAt !== undefined ? { lastFiredAt } : {}),
    ...(snoozedUntilAt !== undefined ? { snoozedUntilAt } : {})
  };
}

export function stripReminderRuntimeState(
  reminder: Task["reminder"] | undefined
): TaskReminder | undefined {
  const normalized = normalizeTaskReminder(reminder);
  if (!normalized) return undefined;
  if (normalized.kind === "absolute") {
    return {
      kind: "absolute",
      ...(normalized.at !== undefined ? { at: normalized.at } : {})
    };
  }
  return {
    kind: "before_due",
    ...(normalized.offsetMs !== undefined ? { offsetMs: normalized.offsetMs } : {})
  };
}

export function resolveEffectiveReminderAt(
  task: Pick<Task, "dueAt" | "reminder">
): number | undefined {
  const reminder = normalizeTaskReminder(task.reminder);
  if (!reminder) return undefined;

  if (isFiniteTimestamp(reminder.snoozedUntilAt)) {
    return reminder.snoozedUntilAt;
  }

  if (reminder.kind === "absolute") {
    return reminder.at;
  }

  if (isFiniteTimestamp(task.dueAt) && reminder.offsetMs !== undefined) {
    return task.dueAt - reminder.offsetMs;
  }

  return undefined;
}

export function isReminderPendingForEffectiveAt(
  reminder: Task["reminder"] | undefined,
  effectiveReminderAt: number | undefined
): boolean {
  if (!isFiniteTimestamp(effectiveReminderAt)) return false;
  const normalized = normalizeTaskReminder(reminder);
  if (!normalized) return false;
  if (!isFiniteTimestamp(normalized.lastFiredAt)) return true;
  return normalized.lastFiredAt < effectiveReminderAt;
}

export function nextPendingReminderAt(tasks: Task[], nowMs = Date.now()): number | undefined {
  let nextAt: number | undefined;
  for (const task of tasks) {
    if (task.status !== "open") continue;
    const effectiveAt = resolveEffectiveReminderAt(task);
    if (!isFiniteTimestamp(effectiveAt)) continue;
    if (!isReminderPendingForEffectiveAt(task.reminder, effectiveAt)) continue;
    if (effectiveAt <= nowMs) {
      return effectiveAt;
    }
    if (nextAt === undefined || effectiveAt < nextAt) {
      nextAt = effectiveAt;
    }
  }
  return nextAt;
}

export function applyReminderFired(
  tasks: Task[],
  taskId: string,
  effectiveReminderAt: number
): Task[] {
  let changed = false;
  const nextTasks = tasks.map((task) => {
    if (task.id !== taskId) return task;
    const reminder = normalizeTaskReminder(task.reminder);
    if (!reminder) return task;
    if (
      reminder.lastFiredAt !== undefined &&
      reminder.lastFiredAt >= effectiveReminderAt &&
      reminder.snoozedUntilAt === undefined
    ) {
      return task;
    }
    changed = true;
    return {
      ...task,
      reminder: {
        ...reminder,
        lastFiredAt: effectiveReminderAt,
        snoozedUntilAt: undefined
      }
    };
  });
  return changed ? nextTasks : tasks;
}

export function applyReminderDismiss(
  tasks: Task[],
  taskId: string,
  effectiveReminderAt: number,
  nowMs = Date.now()
): Task[] {
  const targetFiredAt =
    isFiniteTimestamp(effectiveReminderAt) ? effectiveReminderAt : nowMs;
  return applyReminderFired(tasks, taskId, targetFiredAt);
}

export function applyReminderSnooze(
  tasks: Task[],
  taskId: string,
  deltaMs: number,
  nowMs = Date.now()
): Task[] {
  const snoozeMs = Math.max(MINUTE_MS, Math.floor(deltaMs));
  const snoozedUntilAt = nowMs + snoozeMs;
  let changed = false;
  const nextTasks = tasks.map((task) => {
    if (task.id !== taskId) return task;
    const reminder = normalizeTaskReminder(task.reminder);
    if (!reminder) return task;
    if (reminder.snoozedUntilAt === snoozedUntilAt) return task;
    changed = true;
    return {
      ...task,
      reminder: {
        ...reminder,
        snoozedUntilAt
      }
    };
  });
  return changed ? nextTasks : tasks;
}

function formatDateYyyyMmDd(epochMs: number): string {
  const date = new Date(epochMs);
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
