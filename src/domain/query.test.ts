import { describe, expect, it } from "bun:test";
import { addLocalDaysMs, startOfLocalDayMs } from "./dates";
import { filterTasks, sortTasks } from "./query";
import { Filters, Task } from "./models";

function makeTask(partial: Partial<Task> & Pick<Task, "id" | "title">): Task {
  return {
    id: partial.id,
    title: partial.title,
    status: partial.status ?? "open",
    createdAt: partial.createdAt ?? 1,
    updatedAt: partial.updatedAt ?? 1,
    dueAt: partial.dueAt,
    hasExplicitTime: partial.hasExplicitTime,
    closedAt: partial.closedAt,
    notes: partial.notes,
    tags: partial.tags ?? []
  };
}

describe("filterTasks next7/THIS WEEK boundaries", () => {
  it("includes today and +6 days, excludes +7 days", () => {
    const now = new Date(2026, 1, 8, 12, 0, 0, 0).getTime();
    const start = startOfLocalDayMs(now);
    const tasks: Task[] = [
      makeTask({ id: "t0", title: "today", dueAt: start }),
      makeTask({ id: "t6", title: "plus6", dueAt: addLocalDaysMs(start, 6) }),
      makeTask({ id: "t7", title: "plus7", dueAt: addLocalDaysMs(start, 7) })
    ];
    const filters: Filters = { status: "all", due: "next7" };
    const result = filterTasks(tasks, filters, now).map((task) => task.id);
    expect(result).toContain("t0");
    expect(result).toContain("t6");
    expect(result).not.toContain("t7");
  });
});

describe("filterTasks due=today boundaries", () => {
  it("includes tasks due today and excludes yesterday/tomorrow", () => {
    const now = new Date(2026, 1, 8, 12, 0, 0, 0).getTime();
    const start = startOfLocalDayMs(now);
    const tasks: Task[] = [
      makeTask({ id: "yesterday", title: "yesterday", dueAt: addLocalDaysMs(start, -1) }),
      makeTask({ id: "today", title: "today", dueAt: start }),
      makeTask({ id: "tomorrow", title: "tomorrow", dueAt: addLocalDaysMs(start, 1) })
    ];
    const filters: Filters = { status: "all", due: "today" };
    const result = filterTasks(tasks, filters, now).map((task) => task.id);
    expect(result).toEqual(["today"]);
  });
});

describe("filterTasks due=overdue boundaries", () => {
  it("includes tasks before today and explicit-time tasks passed today", () => {
    const now = new Date(2026, 1, 8, 12, 0, 0, 0).getTime();
    const start = startOfLocalDayMs(now);
    const tasks: Task[] = [
      makeTask({ id: "yesterday", title: "yesterday", dueAt: addLocalDaysMs(start, -1) }),
      makeTask({
        id: "today-past-time",
        title: "today-past-time",
        dueAt: new Date(2026, 1, 8, 9, 0, 0, 0).getTime(),
        hasExplicitTime: true
      }),
      makeTask({
        id: "today-future-time",
        title: "today-future-time",
        dueAt: new Date(2026, 1, 8, 13, 0, 0, 0).getTime(),
        hasExplicitTime: true
      }),
      makeTask({ id: "tomorrow", title: "tomorrow", dueAt: addLocalDaysMs(start, 1) })
    ];
    const filters: Filters = { status: "all", due: "overdue" };
    const result = filterTasks(tasks, filters, now).map((task) => task.id);
    expect(result).toContain("yesterday");
    expect(result).toContain("today-past-time");
    expect(result).not.toContain("today-future-time");
    expect(result).not.toContain("tomorrow");
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
    expect(sorted.indexOf("time-early")).toBeLessThan(sorted.indexOf("time-late"));
    expect(sorted.indexOf("time-late")).toBeLessThan(sorted.indexOf("date-only"));
  });
});

describe("sortTasks due mode priority", () => {
  it("keeps open+due tasks at the top before other status/due combinations", () => {
    const now = new Date(2026, 1, 8, 12, 0, 0, 0).getTime();
    const start = startOfLocalDayMs(now);
    const tasks: Task[] = [
      makeTask({ id: "done-due", title: "done-due", status: "done", dueAt: addLocalDaysMs(start, -1) }),
      makeTask({ id: "open-no-due", title: "open-no-due", status: "open" }),
      makeTask({ id: "open-due-later", title: "open-due-later", status: "open", dueAt: addLocalDaysMs(start, 1) }),
      makeTask({ id: "open-due-soon", title: "open-due-soon", status: "open", dueAt: addLocalDaysMs(start, 0) }),
      makeTask({ id: "done-no-due", title: "done-no-due", status: "done" })
    ];

    expect(sortTasks(tasks, now).map((task) => task.id)).toEqual([
      "open-due-soon",
      "open-due-later",
      "open-no-due",
      "done-due",
      "done-no-due"
    ]);
  });
});

describe("sortTasks by mode", () => {
  it("sorts by updatedAt descending in UPDATED mode", () => {
    const now = new Date(2026, 1, 8, 12, 0, 0, 0).getTime();
    const tasks: Task[] = [
      makeTask({ id: "older", title: "older", updatedAt: 100 }),
      makeTask({ id: "newest", title: "newest", updatedAt: 300 }),
      makeTask({ id: "middle", title: "middle", updatedAt: 200 })
    ];
    expect(sortTasks(tasks, now, "updated").map((task) => task.id)).toEqual([
      "newest",
      "middle",
      "older"
    ]);
  });

  it("sorts by createdAt descending in CREATED mode", () => {
    const now = new Date(2026, 1, 8, 12, 0, 0, 0).getTime();
    const tasks: Task[] = [
      makeTask({ id: "older", title: "older", createdAt: 100, updatedAt: 100 }),
      makeTask({ id: "newest", title: "newest", createdAt: 300, updatedAt: 100 }),
      makeTask({ id: "middle", title: "middle", createdAt: 200, updatedAt: 100 })
    ];
    expect(sortTasks(tasks, now, "created").map((task) => task.id)).toEqual([
      "newest",
      "middle",
      "older"
    ]);
  });

  it("sorts title case-insensitively in TITLE mode with stable fallback", () => {
    const now = new Date(2026, 1, 8, 12, 0, 0, 0).getTime();
    const tasks: Task[] = [
      makeTask({ id: "b", title: "beta", updatedAt: 1, createdAt: 1 }),
      makeTask({ id: "a2", title: "Alpha", updatedAt: 1, createdAt: 1 }),
      makeTask({ id: "a1", title: "alpha", updatedAt: 1, createdAt: 1 })
    ];
    expect(sortTasks(tasks, now, "title").map((task) => task.id)).toEqual([
      "a1",
      "a2",
      "b"
    ]);
  });
});
