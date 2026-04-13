import { describe, expect, it } from "bun:test";
import { addLocalDaysMs, startOfLocalDayMs } from "./dates";
import { Task } from "./models";
import { computeOpenPriorityStats, computeTopTagStats } from "./tagStats";

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
    tags: partial.tags ?? [],
  };
}

describe("tag stats", () => {
  it("computes top tags with due-this-week counts and excludes priority tags", () => {
    const now = new Date(2026, 1, 9, 9, 0, 0).getTime();
    const today = startOfLocalDayMs(now);

    const tasks: Task[] = [
      makeTask({
        id: "1",
        tags: ["work", "p1"],
        dueAt: addLocalDaysMs(today, 0),
      }),
      makeTask({
        id: "2",
        tags: ["work", "chore"],
        dueAt: addLocalDaysMs(today, 3),
      }),
      makeTask({
        id: "3",
        tags: ["chore", "#P2"],
        dueAt: addLocalDaysMs(today, 8),
      }),
      makeTask({ id: "4", tags: ["misc"] }),
      makeTask({
        id: "5",
        tags: ["work"],
        dueAt: addLocalDaysMs(today, 2),
        status: "done",
      }),
      makeTask({ id: "6", tags: ["archive"], status: "archived" }),
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

  it("keeps non-priority tags from mixed [tag + priority] tasks", () => {
    const now = new Date(2026, 1, 9, 9, 0, 0).getTime();
    const tasks: Task[] = [
      makeTask({ id: "1", tags: ["work", "p2"] }),
      makeTask({ id: "2", tags: ["work"] }),
      makeTask({ id: "3", tags: ["#P1"] }),
    ];

    expect(computeTopTagStats(tasks, now, 10)).toEqual([
      { tag: "work", total: 2, dueThisWeek: 0 },
    ]);
  });

  it("computes open priority stats and sorts by priority magnitude", () => {
    const tasks: Task[] = [
      makeTask({ id: "1", status: "open", tags: ["work", "P2"] }),
      makeTask({ id: "2", status: "open", tags: ["#p10"] }),
      makeTask({ id: "3", status: "open", tags: ["home", "#P2"] }),
      makeTask({ id: "4", status: "done", tags: ["p2"] }),
      makeTask({ id: "5", status: "archived", tags: ["#p1"] }),
    ];

    expect(computeOpenPriorityStats(tasks)).toEqual([
      { priorityTag: "#p2", displayPriority: "P2", total: 2 },
      { priorityTag: "#p10", displayPriority: "P10", total: 1 },
    ]);
  });

  it("uses effective priority when multiple priority tokens exist on a task", () => {
    const tasks: Task[] = [
      makeTask({ id: "1", status: "open", tags: ["p1", "work", "#p4"] }),
      makeTask({ id: "2", status: "open", tags: ["#p2", "#p5"] }),
    ];

    expect(computeOpenPriorityStats(tasks)).toEqual([
      { priorityTag: "#p4", displayPriority: "P4", total: 1 },
      { priorityTag: "#p5", displayPriority: "P5", total: 1 },
    ]);
  });

  it("resolves aliases when computing top tag stats", () => {
    const now = new Date(2026, 1, 9, 9, 0, 0).getTime();
    const aliases = { wrk: "work" };
    const tasks: Task[] = [
      makeTask({ id: "1", tags: ["work", "wrk"] }),
      makeTask({ id: "2", tags: ["wrk"] }),
    ];

    expect(computeTopTagStats(tasks, now, 10, aliases)).toEqual([
      { tag: "work", total: 2, dueThisWeek: 0 },
    ]);
  });
});
