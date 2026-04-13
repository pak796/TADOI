import { describe, expect, it } from "bun:test";
import { addLocalDaysMs, startOfLocalDayMs } from "./dates";
import { Task } from "./models";
import {
  findNextMatchingIndex,
  isTaskDueToday,
  isTaskOverdue,
} from "./navigation";

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    title: overrides.title ?? "task",
    status: overrides.status ?? "open",
    createdAt: overrides.createdAt ?? 1,
    updatedAt: overrides.updatedAt ?? 1,
    dueAt: overrides.dueAt,
    hasExplicitTime: overrides.hasExplicitTime,
    closedAt: overrides.closedAt,
    notes: overrides.notes,
    tags: overrides.tags ?? [],
  };
}

describe("findNextMatchingIndex", () => {
  it("finds next and wraps by default", () => {
    const values = [false, false, true, false];
    expect(findNextMatchingIndex(values, 1, 1, (value) => value)).toBe(2);
    expect(findNextMatchingIndex(values, 2, 1, (value) => value)).toBe(2);
    expect(findNextMatchingIndex(values, 3, 1, (value) => value)).toBe(2);
  });

  it("finds previous with wrap", () => {
    const values = [false, true, false, true];
    expect(findNextMatchingIndex(values, 2, -1, (value) => value)).toBe(1);
    expect(findNextMatchingIndex(values, 1, -1, (value) => value)).toBe(3);
  });

  it("returns null when there are no matches", () => {
    const values = [false, false, false];
    expect(findNextMatchingIndex(values, 0, 1, (value) => value)).toBeNull();
  });

  it("supports non-wrapping search", () => {
    const values = [false, false, true, false];
    expect(
      findNextMatchingIndex(values, 2, 1, (value) => value, false),
    ).toBeNull();
    expect(findNextMatchingIndex(values, 3, -1, (value) => value, false)).toBe(
      2,
    );
  });
});

describe("attention predicates", () => {
  it("flags overdue based on day and explicit-time semantics", () => {
    const now = new Date("2026-02-09T14:00:00").getTime();
    const today = startOfLocalDayMs(now);

    const dayOverdue = makeTask({ dueAt: addLocalDaysMs(today, -1) });
    const sameDayDateOnly = makeTask({ dueAt: today, hasExplicitTime: false });
    const sameDayTimeFuture = makeTask({
      dueAt: new Date("2026-02-09T18:00:00").getTime(),
      hasExplicitTime: true,
    });
    const sameDayTimePast = makeTask({
      dueAt: new Date("2026-02-09T09:00:00").getTime(),
      hasExplicitTime: true,
    });
    const doneTask = makeTask({
      status: "done",
      dueAt: addLocalDaysMs(today, -2),
    });

    expect(isTaskOverdue(dayOverdue, now)).toBe(true);
    expect(isTaskOverdue(sameDayDateOnly, now)).toBe(false);
    expect(isTaskOverdue(sameDayTimeFuture, now)).toBe(false);
    expect(isTaskOverdue(sameDayTimePast, now)).toBe(true);
    expect(isTaskOverdue(doneTask, now)).toBe(false);
  });

  it("flags due-today by local day", () => {
    const now = new Date("2026-02-09T14:00:00").getTime();
    const today = startOfLocalDayMs(now);
    const todayTimedPast = makeTask({
      dueAt: new Date("2026-02-09T08:00:00").getTime(),
      hasExplicitTime: true,
    });
    const tomorrow = makeTask({ dueAt: addLocalDaysMs(today, 1) });
    const archivedToday = makeTask({ status: "archived", dueAt: today });

    expect(isTaskDueToday(todayTimedPast, now)).toBe(true);
    expect(isTaskDueToday(tomorrow, now)).toBe(false);
    expect(isTaskDueToday(archivedToday, now)).toBe(false);
  });
});
