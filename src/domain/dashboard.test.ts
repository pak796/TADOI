import { describe, expect, it } from "bun:test";
import { addLocalDaysMs, startOfLocalDayMs } from "./dates";
import { Task } from "./models";
import { computeBacklogTrend7, computeDueBuckets8 } from "./dashboard";

function baseTask(partial: Partial<Task>): Task {
  return {
    id: partial.id ?? crypto.randomUUID(),
    title: partial.title ?? "task",
    status: partial.status ?? "open",
    createdAt: partial.createdAt ?? 0,
    updatedAt: partial.updatedAt ?? 0,
    dueAt: partial.dueAt,
    hasExplicitTime: partial.hasExplicitTime,
    closedAt: partial.closedAt,
    notes: partial.notes,
    tags: partial.tags ?? []
  };
}

describe("computeDueBuckets8", () => {
  it("counts overdue, today, and next six local days", () => {
    const now = new Date(2026, 1, 10, 12, 0, 0).getTime();
    const today = startOfLocalDayMs(now);

    const tasks: Task[] = [
      baseTask({ id: "ovd", dueAt: addLocalDaysMs(today, -1) }),
      baseTask({ id: "tod", dueAt: addLocalDaysMs(today, 0) }),
      baseTask({ id: "p1", dueAt: addLocalDaysMs(today, 1) }),
      baseTask({ id: "p6", dueAt: addLocalDaysMs(today, 6) }),
      baseTask({ id: "p7", dueAt: addLocalDaysMs(today, 7) }),
      baseTask({ id: "nodue" })
    ];

    const buckets = computeDueBuckets8(tasks, now);

    expect(buckets).toEqual([1, 1, 1, 0, 0, 0, 0, 1]);
  });

  it("returns all zeros when there are no due dates", () => {
    const now = new Date(2026, 1, 10, 12, 0, 0).getTime();
    const tasks: Task[] = [baseTask({ id: "a" }), baseTask({ id: "b" })];

    expect(computeDueBuckets8(tasks, now)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });
});

describe("computeBacklogTrend7", () => {
  it("reconstructs open backlog at end-of-day for last seven local days", () => {
    const now = new Date(2026, 1, 10, 12, 0, 0).getTime();
    const today = startOfLocalDayMs(now);

    const tasks: Task[] = [
      // Open all week.
      baseTask({
        id: "a",
        status: "open",
        createdAt: addLocalDaysMs(today, -6),
        updatedAt: addLocalDaysMs(today, -6)
      }),
      // Open on day -3 and -2, then closed day -1 midday.
      baseTask({
        id: "b",
        status: "done",
        createdAt: addLocalDaysMs(today, -3),
        updatedAt: addLocalDaysMs(today, -1) + 12 * 60 * 60 * 1000,
        closedAt: addLocalDaysMs(today, -1) + 12 * 60 * 60 * 1000
      }),
      // Open only today.
      baseTask({
        id: "c",
        status: "open",
        createdAt: addLocalDaysMs(today, 0),
        updatedAt: addLocalDaysMs(today, 0)
      }),
      // Done task without closedAt uses updatedAt as effective close.
      baseTask({
        id: "d",
        status: "done",
        createdAt: addLocalDaysMs(today, -5),
        updatedAt: addLocalDaysMs(today, -2) + 12 * 60 * 60 * 1000
      })
    ];

    const trend = computeBacklogTrend7(tasks, now);

    expect(trend).toEqual([1, 2, 2, 3, 2, 1, 2]);
  });

  it("returns seven zeros for empty input", () => {
    const now = new Date(2026, 1, 10, 12, 0, 0).getTime();
    expect(computeBacklogTrend7([], now)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});
