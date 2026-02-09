import { describe, expect, it } from "bun:test";
import { addLocalDaysMs, startOfLocalDayMs } from "./dates";
import { filterTasks, sortTasks } from "./query";
import { Filters, Task } from "./models";

function makeTask(partial: Partial<Task> & Pick<Task, "id" | "title">): Task {
  const now = Date.now();
  return {
    id: partial.id,
    title: partial.title,
    status: partial.status ?? "open",
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    dueAt: partial.dueAt,
    hasExplicitTime: partial.hasExplicitTime,
    closedAt: partial.closedAt,
    notes: partial.notes,
    tags: partial.tags ?? []
  };
}

describe("filterTasks next7/THIS WEEK boundaries", () => {
  it("includes today and +7 days, excludes +8 days", () => {
    const now = new Date(2026, 1, 8, 12, 0, 0, 0).getTime();
    const start = startOfLocalDayMs(now);
    const tasks: Task[] = [
      makeTask({ id: "t0", title: "today", dueAt: start }),
      makeTask({ id: "t7", title: "plus7", dueAt: addLocalDaysMs(start, 7) }),
      makeTask({ id: "t8", title: "plus8", dueAt: addLocalDaysMs(start, 8) })
    ];
    const filters: Filters = { status: "all", due: "next7" };
    const result = filterTasks(tasks, filters, now).map((task) => task.id);
    expect(result).toContain("t0");
    expect(result).toContain("t7");
    expect(result).not.toContain("t8");
  });
});

describe("sortTasks with explicit time on same day", () => {
  it("orders explicit time tasks before date-only on the same day", () => {
    const now = new Date(2026, 1, 8, 12, 0, 0, 0).getTime();
    const dayStart = startOfLocalDayMs(now);
    const tasks: Task[] = [
      makeTask({
        id: "date-only",
        title: "date-only",
        dueAt: dayStart
      }),
      makeTask({
        id: "time-late",
        title: "time-late",
        dueAt: new Date(2026, 1, 8, 16, 0, 0, 0).getTime(),
        hasExplicitTime: true
      }),
      makeTask({
        id: "time-early",
        title: "time-early",
        dueAt: new Date(2026, 1, 8, 9, 0, 0, 0).getTime(),
        hasExplicitTime: true
      })
    ];

    const sorted = sortTasks(tasks, now).map((task) => task.id);
    expect(sorted).toEqual(["time-early", "time-late", "date-only"]);
  });
});
