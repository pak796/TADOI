import type { RecurrenceRule, RecurrenceWeekday, Task } from "./models";
import { stripReminderRuntimeState } from "./reminders";

const WEEKDAY_ORDER: RecurrenceWeekday[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

const WEEKDAY_TO_INDEX: Record<RecurrenceWeekday, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

function toWeekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function toSortedWeekdays(values: RecurrenceWeekday[]): RecurrenceWeekday[] {
  return Array.from(new Set(values)).sort(
    (left, right) => WEEKDAY_TO_INDEX[left] - WEEKDAY_TO_INDEX[right],
  );
}

function clampMonthDay(year: number, monthIndex: number, day: number): number {
  const maxDay = new Date(year, monthIndex + 1, 0).getDate();
  return Math.max(1, Math.min(day, maxDay));
}

function nextDailyDueAt(date: Date, interval: number): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + interval,
    date.getHours(),
    date.getMinutes(),
  ).getTime();
}

function nextWeeklyDueAt(date: Date, rule: RecurrenceRule): number {
  const interval = Math.max(1, Math.floor(rule.interval));
  const sourceDays =
    rule.byDay && rule.byDay.length > 0
      ? rule.byDay
      : [WEEKDAY_ORDER[toWeekdayIndex(date)]];
  const byDay = toSortedWeekdays(sourceDays);
  const currentIndex = toWeekdayIndex(date);
  const sameWeekOffset = byDay
    .map((weekday) => WEEKDAY_TO_INDEX[weekday])
    .filter((value) => value > currentIndex)
    .map((value) => value - currentIndex)
    .sort((left, right) => left - right)[0];

  if (sameWeekOffset !== undefined) {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() + sameWeekOffset,
      date.getHours(),
      date.getMinutes(),
    ).getTime();
  }

  const firstTarget = WEEKDAY_TO_INDEX[byDay[0] ?? WEEKDAY_ORDER[0]];
  const daysUntilWeekStart = currentIndex;
  const weekStart = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() - daysUntilWeekStart,
    date.getHours(),
    date.getMinutes(),
  );
  return new Date(
    weekStart.getFullYear(),
    weekStart.getMonth(),
    weekStart.getDate() + interval * 7 + firstTarget,
    weekStart.getHours(),
    weekStart.getMinutes(),
  ).getTime();
}

function nextMonthlyDueAt(date: Date, rule: RecurrenceRule): number {
  const interval = Math.max(1, Math.floor(rule.interval));
  const sourceDays =
    rule.byMonthDay && rule.byMonthDay.length > 0
      ? rule.byMonthDay
      : [date.getDate()];
  const byMonthDay = Array.from(
    new Set(
      sourceDays
        .map((value) => Math.floor(value))
        .filter((value) => Number.isFinite(value) && value >= 1 && value <= 31),
    ),
  ).sort((left, right) => left - right);
  const year = date.getFullYear();
  const monthIndex = date.getMonth();
  const currentDay = date.getDate();

  for (const candidate of byMonthDay) {
    const clamped = clampMonthDay(year, monthIndex, candidate);
    if (clamped > currentDay) {
      return new Date(
        year,
        monthIndex,
        clamped,
        date.getHours(),
        date.getMinutes(),
      ).getTime();
    }
  }

  const shifted = new Date(
    year,
    monthIndex + interval,
    1,
    date.getHours(),
    date.getMinutes(),
  );
  const nextYear = shifted.getFullYear();
  const nextMonth = shifted.getMonth();
  const targetDay = clampMonthDay(
    nextYear,
    nextMonth,
    byMonthDay[0] ?? date.getDate(),
  );
  return new Date(
    nextYear,
    nextMonth,
    targetDay,
    date.getHours(),
    date.getMinutes(),
  ).getTime();
}

type TaskRecurrenceWithRule = NonNullable<Task["recurrence"]> & RecurrenceRule;

function hasRuleFrequency(
  recurrence: Task["recurrence"],
): recurrence is TaskRecurrenceWithRule {
  return (
    Boolean(recurrence) &&
    typeof recurrence === "object" &&
    (recurrence.freq === "daily" ||
      recurrence.freq === "weekly" ||
      recurrence.freq === "monthly")
  );
}

export function computeNextDueAt(dueAt: number, rule: RecurrenceRule): number {
  const date = new Date(dueAt);
  if (rule.freq === "daily") {
    return nextDailyDueAt(date, Math.max(1, Math.floor(rule.interval)));
  }
  if (rule.freq === "weekly") {
    return nextWeeklyDueAt(date, rule);
  }
  return nextMonthlyDueAt(date, rule);
}

export function completeTaskWithRecurrence(
  tasks: Task[],
  taskId: string,
  now: number,
): { tasks: Task[]; spawnedId?: string } {
  const task = tasks.find((candidate) => candidate.id === taskId);
  if (!task || task.status !== "open") {
    return { tasks };
  }

  let spawnedTask: Task | undefined;
  const recurrence = task.recurrence;
  const dueAt = task.dueAt;
  const shouldSpawn = hasRuleFrequency(recurrence) && typeof dueAt === "number";
  let nextDueAt: number | undefined;
  if (shouldSpawn) {
    nextDueAt = computeNextDueAt(dueAt, recurrence);
  }

  const nextTasks = tasks.map((candidate) => {
    if (candidate.id !== taskId) return candidate;
    return {
      ...candidate,
      status: "done" as const,
      updatedAt: now,
      closedAt: candidate.closedAt ?? now,
    };
  });

  if (shouldSpawn && nextDueAt !== undefined) {
    const reminder = stripReminderRuntimeState(task.reminder);
    spawnedTask = {
      id: crypto.randomUUID(),
      title: task.title,
      status: "open",
      createdAt: now,
      updatedAt: now,
      dueAt: nextDueAt,
      hasExplicitTime: task.hasExplicitTime,
      tags: [...task.tags],
      ...(task.notes !== undefined ? { notes: task.notes } : {}),
      ...(task.noteRef !== undefined ? { noteRef: { ...task.noteRef } } : {}),
      ...(reminder ? { reminder } : {}),
      recurrence,
    };
    nextTasks.push(spawnedTask);
  }

  return spawnedTask
    ? { tasks: nextTasks, spawnedId: spawnedTask.id }
    : { tasks: nextTasks };
}
