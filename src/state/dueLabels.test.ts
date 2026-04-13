import { describe, expect, it } from "bun:test";
import { getDueInLabel, getDueLabel } from "./store";
import { Task } from "../domain/models";

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
    tags: partial.tags ?? [],
  };
}

describe("due labels with optional time", () => {
  it("shows time-based labels for today with explicit time", () => {
    const now = new Date(2026, 1, 9, 10, 0, 0, 0).getTime();
    const dueLater = new Date(2026, 1, 9, 12, 30, 0, 0).getTime();
    const dueTask = makeTask({
      id: "time",
      title: "time",
      dueAt: dueLater,
      hasExplicitTime: true,
    });
    expect(getDueInLabel(dueTask, now)).toBe("DUE IN 3 HOURS");
    expect(getDueLabel(dueTask, now)).toBe("DUE IN 3 HOURS");
  });

  it("uses minutes when under an hour", () => {
    const now = new Date(2026, 1, 9, 10, 0, 0, 0).getTime();
    const dueSoon = new Date(2026, 1, 9, 10, 20, 0, 0).getTime();
    const dueTask = makeTask({
      id: "minutes",
      title: "minutes",
      dueAt: dueSoon,
      hasExplicitTime: true,
    });
    expect(getDueInLabel(dueTask, now)).toBe("DUE IN 20 MIN");
  });

  it("shows overdue-by labels when explicit time has passed", () => {
    const now = new Date(2026, 1, 9, 14, 0, 0, 0).getTime();
    const dueEarlier = new Date(2026, 1, 9, 12, 15, 0, 0).getTime();
    const dueTask = makeTask({
      id: "overdue",
      title: "overdue",
      dueAt: dueEarlier,
      hasExplicitTime: true,
    });
    expect(getDueInLabel(dueTask, now)).toBe("OVERDUE BY 2 HOURS");
  });

  it("uses minutes for overdue-by labels when under an hour", () => {
    const now = new Date(2026, 1, 9, 10, 45, 0, 0).getTime();
    const dueEarlier = new Date(2026, 1, 9, 10, 20, 0, 0).getTime();
    const dueTask = makeTask({
      id: "overdue-minutes",
      title: "overdue-minutes",
      dueAt: dueEarlier,
      hasExplicitTime: true,
    });
    expect(getDueInLabel(dueTask, now)).toBe("OVERDUE BY 25 MIN");
  });

  it("keeps date-only today behavior", () => {
    const now = new Date(2026, 1, 9, 22, 0, 0, 0).getTime();
    const dueAt = new Date(2026, 1, 9, 0, 0, 0, 0).getTime();
    const dueTask = makeTask({
      id: "date-only",
      title: "date-only",
      dueAt,
      hasExplicitTime: false,
    });
    expect(getDueLabel(dueTask, now)).toBe("DUE TODAY");
  });
});
