import { describe, expect, it } from "bun:test";
import { addLocalDaysMs, startOfLocalDayMs } from "./dates";
import { Task } from "./models";
import { computeDashboardKpis } from "./dashboardKpis";

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
  };
}

describe("computeDashboardKpis", () => {
  it("computes overdue/today/next7/open and done7d from filtered tasks", () => {
    const now = new Date(2026, 1, 10, 12, 0, 0).getTime();
    const today = startOfLocalDayMs(now);

    const tasks: Task[] = [
      baseTask({
        id: "ovd-day",
        status: "open",
        dueAt: addLocalDaysMs(today, -1),
      }),
      baseTask({
        id: "ovd-time",
        status: "open",
        dueAt: today + 8 * 60 * 60 * 1000,
        hasExplicitTime: true,
      }),
      baseTask({ id: "tod", status: "open", dueAt: addLocalDaysMs(today, 0) }),
      baseTask({ id: "n7", status: "open", dueAt: addLocalDaysMs(today, 6) }),
      baseTask({ id: "out", status: "open", dueAt: addLocalDaysMs(today, 7) }),
      baseTask({
        id: "done-in",
        status: "done",
        closedAt: addLocalDaysMs(today, -3),
        updatedAt: addLocalDaysMs(today, -3),
      }),
      baseTask({
        id: "done-out",
        status: "done",
        closedAt: addLocalDaysMs(today, -7),
        updatedAt: addLocalDaysMs(today, -7),
      }),
    ];

    expect(computeDashboardKpis(tasks, now)).toEqual({
      overdue: 2,
      today: 2,
      next7: 3,
      open: 5,
      done7d: 1,
    });
  });

  it("uses local-day boundary inclusively for done7d (-6..0)", () => {
    const now = new Date(2026, 1, 10, 12, 0, 0).getTime();
    const today = startOfLocalDayMs(now);

    const tasks: Task[] = [
      baseTask({
        id: "in-oldest",
        status: "done",
        closedAt: addLocalDaysMs(today, -6),
        updatedAt: addLocalDaysMs(today, -6),
      }),
      baseTask({
        id: "in-today",
        status: "done",
        closedAt: addLocalDaysMs(today, 0),
        updatedAt: addLocalDaysMs(today, 0),
      }),
      baseTask({
        id: "out-older",
        status: "done",
        closedAt: addLocalDaysMs(today, -7),
        updatedAt: addLocalDaysMs(today, -7),
      }),
    ];

    expect(computeDashboardKpis(tasks, now).done7d).toBe(2);
  });

  it("returns zeros for empty input", () => {
    const now = new Date(2026, 1, 10, 12, 0, 0).getTime();
    expect(computeDashboardKpis([], now)).toEqual({
      overdue: 0,
      today: 0,
      next7: 0,
      open: 0,
      done7d: 0,
    });
  });
});
