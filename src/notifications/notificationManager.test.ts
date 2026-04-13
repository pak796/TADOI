import { describe, expect, it } from "bun:test";
import type { Task } from "../domain/models";
import { formatDateToLocalIso } from "../domain/recurrence/rruleAdapter";
import { NotificationManager } from "./notificationManager";

function makeTask(partial: Partial<Task> & Pick<Task, "id" | "title">): Task {
  const now = partial.createdAt ?? 1;
  return {
    id: partial.id,
    title: partial.title,
    status: partial.status ?? "open",
    createdAt: now,
    updatedAt: partial.updatedAt ?? now,
    dueAt: partial.dueAt,
    hasExplicitTime: partial.hasExplicitTime,
    closedAt: partial.closedAt,
    notes: partial.notes,
    tags: partial.tags ?? [],
    recurrence: partial.recurrence,
    instance_of: partial.instance_of,
  };
}

describe("NotificationManager", () => {
  it("does not emit startup notifications for already overdue tasks", () => {
    const manager = new NotificationManager();
    const now = new Date(2026, 1, 11, 12, 0, 0).getTime();
    const overdueTask = makeTask({
      id: "t1",
      title: "overdue",
      dueAt: new Date(2026, 1, 11, 9, 0, 0).getTime(),
      hasExplicitTime: true,
    });

    const events = manager.evaluate([overdueTask], now);
    expect(events).toHaveLength(0);
  });

  it("emits exactly once when a regular task transitions to overdue", () => {
    const manager = new NotificationManager();
    const dueAt = new Date(2026, 1, 11, 9, 0, 0).getTime();
    const task = makeTask({
      id: "t2",
      title: "transition",
      dueAt,
      hasExplicitTime: true,
    });

    manager.evaluate([task], new Date(2026, 1, 11, 8, 55, 0).getTime());
    const first = manager.evaluate(
      [task],
      new Date(2026, 1, 11, 9, 5, 0).getTime(),
    );
    const second = manager.evaluate(
      [task],
      new Date(2026, 1, 11, 9, 10, 0).getTime(),
    );

    expect(first).toHaveLength(1);
    expect(first[0]?.type).toBe("TASK_OVERDUE");
    expect(first[0]?.taskId).toBe("t2");
    expect(new Date(first[0]?.dueAt ?? "").getTime()).toBe(dueAt);
    expect(second).toHaveLength(0);
  });

  it("clears overdue state when dueAt is removed and can notify a new due occurrence", () => {
    const manager = new NotificationManager();
    const t0 = new Date(2026, 1, 11, 8, 0, 0).getTime();
    const firstDueAt = new Date(2026, 1, 11, 8, 30, 0).getTime();
    const secondDueAt = new Date(2026, 1, 11, 8, 45, 0).getTime();

    const baseTask = makeTask({
      id: "t3",
      title: "reset",
      dueAt: firstDueAt,
      hasExplicitTime: true,
    });

    manager.evaluate([baseTask], t0);
    const first = manager.evaluate(
      [baseTask],
      new Date(2026, 1, 11, 8, 40, 0).getTime(),
    );
    expect(first).toHaveLength(1);

    const noDueTask = { ...baseTask, dueAt: undefined, hasExplicitTime: false };
    const cleared = manager.evaluate(
      [noDueTask],
      new Date(2026, 1, 11, 8, 41, 0).getTime(),
    );
    expect(cleared).toHaveLength(0);

    const nextDueTask = {
      ...baseTask,
      dueAt: secondDueAt,
      hasExplicitTime: true,
    };
    const second = manager.evaluate(
      [nextDueTask],
      new Date(2026, 1, 11, 8, 46, 0).getTime(),
    );
    expect(second).toHaveLength(1);
    expect(new Date(second[0]?.dueAt ?? "").getTime()).toBe(secondDueAt);
  });

  it("emits one event per newly overdue recurring occurrence across an interval", () => {
    const manager = new NotificationManager();
    const start = new Date(2026, 1, 10, 9, 0, 0);
    const seriesTask = makeTask({
      id: "series-1",
      title: "daily series",
      dueAt: start.getTime(),
      hasExplicitTime: true,
      recurrence: {
        dtstart: formatDateToLocalIso(start),
        rrule: "FREQ=DAILY;INTERVAL=1;COUNT=3",
        series_id: "series:1",
      },
    });

    manager.evaluate([seriesTask], new Date(2026, 1, 10, 8, 59, 0).getTime());
    const burst = manager.evaluate(
      [seriesTask],
      new Date(2026, 1, 12, 9, 30, 0).getTime(),
    );
    const next = manager.evaluate(
      [seriesTask],
      new Date(2026, 1, 12, 10, 0, 0).getTime(),
    );

    expect(burst).toHaveLength(3);
    expect(burst.map((event) => event.taskId)).toEqual([
      "series-1",
      "series-1",
      "series-1",
    ]);
    expect(next).toHaveLength(0);
  });
});
