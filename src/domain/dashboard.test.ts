import { describe, expect, it } from "bun:test";
import { addLocalDaysMs, startOfLocalDayMs } from "./dates";
import { Task } from "./models";
import {
  computeBacklogTrend7,
  computeDueBuckets8,
  computeTopTagsOpen
} from "./dashboard";

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

describe("computeTopTagsOpen", () => {
  it("counts tags from open tasks only and sorts by count desc then tag asc", () => {
    const tasks: Task[] = [
      baseTask({ id: "o1", status: "open", tags: ["work", "home"] }),
      baseTask({ id: "o2", status: "open", tags: ["work", "tadoi"] }),
      baseTask({ id: "o3", status: "open", tags: ["tadoi"] }),
      baseTask({ id: "o4", status: "done", tags: ["work", "zzz"] }),
      baseTask({ id: "o5", status: "archived", tags: ["home", "zzz"] })
    ];

    expect(computeTopTagsOpen(tasks, 10)).toEqual([
      { tag: "tadoi", count: 2 },
      { tag: "work", count: 2 },
      { tag: "home", count: 1 }
    ]);
  });

  it("applies limit and returns empty for non-positive limits", () => {
    const tasks: Task[] = [
      baseTask({ id: "a", status: "open", tags: ["alpha"] }),
      baseTask({ id: "b", status: "open", tags: ["beta"] }),
      baseTask({ id: "c", status: "open", tags: ["alpha"] })
    ];

    expect(computeTopTagsOpen(tasks, 1)).toEqual([{ tag: "alpha", count: 2 }]);
    expect(computeTopTagsOpen(tasks, 0)).toEqual([]);
    expect(computeTopTagsOpen(tasks, -3)).toEqual([]);
  });

  it("returns empty when there are no tagged open tasks", () => {
    const tasks: Task[] = [
      baseTask({ id: "x", status: "open", tags: [] }),
      baseTask({ id: "y", status: "done", tags: ["work"] })
    ];
    expect(computeTopTagsOpen(tasks, 5)).toEqual([]);
  });
});
