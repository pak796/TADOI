import { describe, expect, it } from "bun:test";
import { addLocalDaysMs, startOfLocalDayMs } from "./dates";
import { Task } from "./models";
import {
  computeCreatedCompleted7d,
  computeBacklogTrend7,
  computeDueBuckets8,
  computeOverdueAgingBuckets,
  computePriorityBucketBreakdown,
  computeTopTagsOpen
} from "./dashboard";
import { buildVisibleTaskRows } from "./taskRows";

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
    tags: partial.tags ?? [],
    recurrence: partial.recurrence,
    instance_of: partial.instance_of
  };
}

describe("computeDueBuckets8", () => {
  it("counts overdue, today, and next six local days", () => {
    const now = new Date(2026, 1, 10, 12, 0, 0).getTime();
    const today = startOfLocalDayMs(now);

    const tasks: Task[] = [
      baseTask({ id: "ovd", dueAt: addLocalDaysMs(today, -1) }),
      baseTask({
        id: "ovd-time",
        dueAt: today + 8 * 60 * 60 * 1000,
        hasExplicitTime: true
      }),
      baseTask({ id: "tod", dueAt: addLocalDaysMs(today, 0) }),
      baseTask({ id: "p1", dueAt: addLocalDaysMs(today, 1) }),
      baseTask({ id: "p6", dueAt: addLocalDaysMs(today, 6) }),
      baseTask({ id: "p7", dueAt: addLocalDaysMs(today, 7) }),
      baseTask({ id: "nodue" })
    ];

    const buckets = computeDueBuckets8(tasks, now);

    expect(buckets).toEqual([2, 1, 1, 0, 0, 0, 0, 1]);
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
  it("counts tags from open tasks only, excludes P1..P5 tags, and sorts by count desc then tag asc", () => {
    const tasks: Task[] = [
      baseTask({ id: "o1", status: "open", tags: ["work", "home", "p1"] }),
      baseTask({ id: "o2", status: "open", tags: ["work", "tadoi"] }),
      baseTask({ id: "o3", status: "open", tags: ["tadoi", "#P2"] }),
      baseTask({ id: "o4", status: "done", tags: ["work", "zzz"] }),
      baseTask({ id: "o5", status: "archived", tags: ["home", "zzz"] })
    ];

    expect(computeTopTagsOpen(tasks, 10)).toEqual([
      { tag: "tadoi", count: 2 },
      { tag: "work", count: 2 },
      { tag: "home", count: 1 }
    ]);
  });

  it("keeps non-priority tags from mixed [tag + priority] tasks", () => {
    const tasks: Task[] = [
      baseTask({ id: "a", status: "open", tags: ["work", "p2"] }),
      baseTask({ id: "b", status: "open", tags: ["work"] }),
      baseTask({ id: "c", status: "open", tags: ["#P1"] })
    ];

    expect(computeTopTagsOpen(tasks, 10)).toEqual([{ tag: "work", count: 2 }]);
  });

  it("excludes all priority tokens including #p10", () => {
    const tasks: Task[] = [
      baseTask({ id: "a", status: "open", tags: ["#p10", "work"] }),
      baseTask({ id: "b", status: "open", tags: ["work"] })
    ];

    expect(computeTopTagsOpen(tasks, 10)).toEqual([{ tag: "work", count: 2 }]);
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

describe("computePriorityBucketBreakdown", () => {
  it("counts effective priorities and normalizes variants", () => {
    const tasks: Task[] = [
      baseTask({ id: "a", status: "open", tags: ["work", "P1"] }),
      baseTask({ id: "b", status: "open", tags: ["#p1", "home"] }),
      baseTask({ id: "c", status: "open", tags: ["p2"] }),
      baseTask({ id: "d", status: "open", tags: ["work", "#P2"] })
    ];

    expect(computePriorityBucketBreakdown(tasks)).toEqual([
      { priority: "P1", count: 2 },
      { priority: "P2", count: 2 }
    ]);
  });

  it("renders only priorities present and omits tasks with no priority", () => {
    const tasks: Task[] = [
      baseTask({ id: "a", status: "open", tags: ["work"] }),
      baseTask({ id: "b", status: "open", tags: ["p2"] }),
      baseTask({ id: "c", status: "done", tags: ["#P2"] })
    ];

    expect(computePriorityBucketBreakdown(tasks)).toEqual([{ priority: "P2", count: 2 }]);
  });

  it("ignores non-P1..P5 priorities", () => {
    const tasks: Task[] = [
      baseTask({ id: "a", status: "open", tags: ["#p10"] }),
      baseTask({ id: "b", status: "open", tags: ["p5"] })
    ];

    expect(computePriorityBucketBreakdown(tasks)).toEqual([{ priority: "P5", count: 1 }]);
  });

  it("respects visible-task row pipeline inputs", () => {
    const now = new Date(2026, 1, 13, 12, 0, 0, 0).getTime();
    const tasks: Task[] = [
      baseTask({
        id: "series-1",
        title: "daily standup",
        status: "open",
        hasExplicitTime: true,
        tags: ["work", "#P2"],
        recurrence: {
          dtstart: "2026-02-13T09:00:00",
          rrule: "FREQ=DAILY;INTERVAL=1;COUNT=3",
          series_id: "series:standup"
        }
      })
    ];

    const visibleRows = buildVisibleTaskRows(tasks, { status: "all", due: "today" }, "due", now);
    expect(visibleRows).toHaveLength(1);
    expect(computeTopTagsOpen(visibleRows, 5)).toEqual([{ tag: "work", count: 1 }]);
    expect(computePriorityBucketBreakdown(visibleRows)).toEqual([{ priority: "P2", count: 1 }]);
  });
});

describe("computeOverdueAgingBuckets", () => {
  it("groups overdue open tasks into fixed aging buckets", () => {
    const now = new Date(2026, 1, 10, 12, 0, 0);
    const today = startOfLocalDayMs(now.getTime());
    const tasks: Task[] = [
      baseTask({
        id: "d0-time",
        status: "open",
        dueAt: today + 8 * 60 * 60 * 1000,
        hasExplicitTime: true
      }),
      baseTask({ id: "d1", status: "open", dueAt: addLocalDaysMs(today, -1) }),
      baseTask({ id: "d2", status: "open", dueAt: addLocalDaysMs(today, -2) }),
      baseTask({ id: "d5", status: "open", dueAt: addLocalDaysMs(today, -5) }),
      baseTask({ id: "d10", status: "open", dueAt: addLocalDaysMs(today, -10) }),
      baseTask({ id: "d20", status: "open", dueAt: addLocalDaysMs(today, -20) }),
      baseTask({ id: "d31", status: "open", dueAt: addLocalDaysMs(today, -31) }),
      baseTask({ id: "done", status: "done", dueAt: addLocalDaysMs(today, -3) }),
      baseTask({ id: "nodue", status: "open" })
    ];

    expect(computeOverdueAgingBuckets(tasks, now)).toEqual([
      { label: "0d", count: 1 },
      { label: "1d", count: 1 },
      { label: "2-3d", count: 1 },
      { label: "4-7d", count: 1 },
      { label: "8-14d", count: 1 },
      { label: "15-30d", count: 1 },
      { label: "30d+", count: 1 }
    ]);
  });

  it("uses local day boundaries around midnight", () => {
    const now = new Date(2026, 1, 10, 0, 5, 0, 0);
    const today = startOfLocalDayMs(now.getTime());
    const tasks: Task[] = [
      baseTask({ id: "yesterday-late", status: "open", dueAt: today - 1 }),
      baseTask({
        id: "today-early-time",
        status: "open",
        dueAt: today + 60 * 1000,
        hasExplicitTime: true
      })
    ];

    expect(computeOverdueAgingBuckets(tasks, now)).toEqual([
      { label: "0d", count: 1 },
      { label: "1d", count: 1 },
      { label: "2-3d", count: 0 },
      { label: "4-7d", count: 0 },
      { label: "8-14d", count: 0 },
      { label: "15-30d", count: 0 },
      { label: "30d+", count: 0 }
    ]);
  });
});

describe("computeCreatedCompleted7d", () => {
  it("buckets createdAt and closedAt on local days and tracks totals", () => {
    const now = new Date(2026, 1, 10, 12, 0, 0);
    const today = startOfLocalDayMs(now.getTime());
    const tasks: Task[] = [
      baseTask({ id: "a", createdAt: addLocalDaysMs(today, -6) }),
      baseTask({
        id: "b",
        createdAt: addLocalDaysMs(today, -3),
        status: "done",
        closedAt: addLocalDaysMs(today, -2),
        updatedAt: addLocalDaysMs(today, -2)
      }),
      baseTask({
        id: "c",
        createdAt: addLocalDaysMs(today, 0),
        status: "done",
        closedAt: addLocalDaysMs(today, 0),
        updatedAt: addLocalDaysMs(today, 0)
      }),
      baseTask({ id: "d", createdAt: addLocalDaysMs(today, -7) }),
      baseTask({
        id: "e",
        createdAt: addLocalDaysMs(today, -1),
        status: "done",
        closedAt: addLocalDaysMs(today, -8),
        updatedAt: addLocalDaysMs(today, -8)
      }),
      baseTask({
        id: "f",
        createdAt: addLocalDaysMs(today, -10),
        status: "done",
        closedAt: addLocalDaysMs(today, -4),
        updatedAt: addLocalDaysMs(today, -4)
      })
    ];

    expect(computeCreatedCompleted7d(tasks, now)).toEqual({
      labels: ["-6", "-5", "-4", "-3", "-2", "-1", "0"],
      created: [1, 0, 0, 1, 0, 1, 1],
      completed: [0, 0, 1, 0, 1, 0, 1],
      totals: {
        created: 4,
        completed: 3,
        net: 1
      }
    });
  });

  it("applies inclusive today/-6 and excludes outside 7-day window", () => {
    const now = new Date(2026, 1, 10, 0, 5, 0, 0);
    const today = startOfLocalDayMs(now.getTime());
    const tasks: Task[] = [
      baseTask({
        id: "created-in-oldest",
        createdAt: addLocalDaysMs(today, -6) + (23 * 60 * 60 + 59 * 60) * 1000
      }),
      baseTask({
        id: "created-out",
        createdAt: addLocalDaysMs(today, -7) + (23 * 60 * 60 + 59 * 60) * 1000
      }),
      baseTask({
        id: "closed-in-today",
        status: "done",
        createdAt: addLocalDaysMs(today, -9),
        closedAt: today,
        updatedAt: today
      }),
      baseTask({
        id: "closed-out-tomorrow",
        status: "done",
        createdAt: addLocalDaysMs(today, -9),
        closedAt: addLocalDaysMs(today, 1),
        updatedAt: addLocalDaysMs(today, 1)
      })
    ];

    expect(computeCreatedCompleted7d(tasks, now)).toEqual({
      labels: ["-6", "-5", "-4", "-3", "-2", "-1", "0"],
      created: [1, 0, 0, 0, 0, 0, 0],
      completed: [0, 0, 0, 0, 0, 0, 1],
      totals: {
        created: 1,
        completed: 1,
        net: 0
      }
    });
  });
});
