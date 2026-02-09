import { describe, expect, it } from "bun:test";
import { addLocalDaysMs, startOfLocalDayMs } from "./dates";
import { Task } from "./models";
import { computeTopTagStats } from "./tagStats";

function makeTask(partial: Partial<Task>): Task {
  return {
    id: partial.id ?? "t",
    title: partial.title ?? "Task",
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

describe("tag stats", () => {
  it("computes top tags with due-this-week counts", () => {
    const now = new Date(2026, 1, 9, 9, 0, 0).getTime();
    const today = startOfLocalDayMs(now);

    const tasks: Task[] = [
      makeTask({ id: "1", tags: ["work"], dueAt: addLocalDaysMs(today, 0) }),
      makeTask({ id: "2", tags: ["work", "chore"], dueAt: addLocalDaysMs(today, 3) }),
      makeTask({ id: "3", tags: ["chore"], dueAt: addLocalDaysMs(today, 8) }),
      makeTask({ id: "4", tags: ["misc"] }),
      makeTask({ id: "5", tags: ["work"], dueAt: addLocalDaysMs(today, 2), status: "done" }),
      makeTask({ id: "6", tags: ["archive"], status: "archived" })
    ];

    const stats = computeTopTagStats(tasks, now, 5);
    expect(stats.map((stat) => stat.tag)).toEqual(["work", "chore", "misc"]);

    const work = stats.find((stat) => stat.tag === "work");
    const chore = stats.find((stat) => stat.tag === "chore");
    const misc = stats.find((stat) => stat.tag === "misc");

    expect(work).toEqual({ tag: "work", total: 3, dueThisWeek: 3 });
    expect(chore).toEqual({ tag: "chore", total: 2, dueThisWeek: 1 });
    expect(misc).toEqual({ tag: "misc", total: 1, dueThisWeek: 0 });
  });
});
