import { describe, expect, it } from "bun:test";
import type { Task } from "../domain/models";
import { buildSeriesOccurrenceRowId } from "../domain/taskRows";
import { formatDateToLocalIso } from "../domain/recurrence/rruleAdapter";
import {
  applyOverdueMarkDone,
  applyOverdueSnooze,
  resolveGoToTaskTarget
} from "./overdueTaskActions";
import type { TaskOverdueEvent } from "./types";

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
    instance_of: partial.instance_of
  };
}

function makeEvent(taskId: string, dueAtMs: number, title = "Task"): TaskOverdueEvent {
  return {
    type: "TASK_OVERDUE",
    taskId,
    title,
    dueAt: new Date(dueAtMs).toISOString(),
    firedAt: new Date(dueAtMs + 1000).toISOString()
  };
}

describe("overdueTaskActions", () => {
  it("snoozes a regular task to now + 10 minutes", () => {
    const dueAt = new Date(2026, 1, 10, 9, 0, 0).getTime();
    const nowMs = new Date(2026, 1, 10, 9, 5, 0).getTime();
    const task = makeTask({
      id: "task-1",
      title: "Regular",
      dueAt,
      hasExplicitTime: true
    });

    const updated = applyOverdueSnooze([task], makeEvent(task.id, dueAt), nowMs, 10);
    expect(updated).toHaveLength(1);
    expect(updated[0]?.dueAt).toBe(nowMs + 10 * 60_000);
    expect(updated[0]?.hasExplicitTime).toBe(true);
  });

  it("marks a regular task done with closedAt", () => {
    const dueAt = new Date(2026, 1, 10, 9, 0, 0).getTime();
    const nowMs = new Date(2026, 1, 10, 9, 5, 0).getTime();
    const task = makeTask({
      id: "task-2",
      title: "Regular",
      dueAt,
      hasExplicitTime: true
    });

    const updated = applyOverdueMarkDone([task], makeEvent(task.id, dueAt), nowMs);
    expect(updated[0]?.status).toBe("done");
    expect(updated[0]?.closedAt).toBe(nowMs);
  });

  it("snoozes a recurring virtual occurrence by creating/updating an instance and exdate", () => {
    const dueDate = new Date(2026, 1, 10, 9, 0, 0);
    const dueAtMs = dueDate.getTime();
    const occurrenceIso = formatDateToLocalIso(dueDate);
    const nowMs = new Date(2026, 1, 10, 9, 5, 0).getTime();
    const series = makeTask({
      id: "series-1",
      title: "Daily",
      dueAt: dueAtMs,
      hasExplicitTime: true,
      recurrence: {
        dtstart: occurrenceIso,
        rrule: "FREQ=DAILY;INTERVAL=1",
        series_id: "series:1"
      },
      tags: ["work"]
    });

    const updated = applyOverdueSnooze([series], makeEvent(series.id, dueAtMs, series.title), nowMs, 10);
    expect(updated).toHaveLength(2);

    const nextSeries = updated.find((task) => task.id === series.id);
    expect(nextSeries?.recurrence?.exdates).toContain(occurrenceIso);

    const instance = updated.find((task) => task.instance_of?.series_id === "series:1");
    expect(instance?.instance_of?.occurrence).toBe(occurrenceIso);
    expect(instance?.status).toBe("open");
    expect(instance?.dueAt).toBe(nowMs + 10 * 60_000);
  });

  it("marks a recurring virtual occurrence done once and adds exdate", () => {
    const dueDate = new Date(2026, 1, 10, 9, 0, 0);
    const dueAtMs = dueDate.getTime();
    const occurrenceIso = formatDateToLocalIso(dueDate);
    const nowMs = new Date(2026, 1, 10, 9, 5, 0).getTime();
    const series = makeTask({
      id: "series-2",
      title: "Daily",
      dueAt: dueAtMs,
      hasExplicitTime: true,
      recurrence: {
        dtstart: occurrenceIso,
        rrule: "FREQ=DAILY;INTERVAL=1",
        series_id: "series:2"
      }
    });

    const updated = applyOverdueMarkDone([series], makeEvent(series.id, dueAtMs, series.title), nowMs);
    expect(updated).toHaveLength(2);

    const nextSeries = updated.find((task) => task.id === series.id);
    expect(nextSeries?.recurrence?.exdates).toContain(occurrenceIso);

    const instance = updated.find((task) => task.instance_of?.series_id === "series:2");
    expect(instance?.status).toBe("done");
    expect(instance?.closedAt).toBe(nowMs);
    expect(instance?.dueAt).toBe(dueAtMs);
  });

  it("resolves go-to target with recurring fallback when exact row is not renderable", () => {
    const dueDate = new Date(2026, 1, 10, 9, 0, 0);
    const dueAtMs = dueDate.getTime();
    const occurrenceIso = formatDateToLocalIso(dueDate);
    const series = makeTask({
      id: "series-3",
      title: "Daily",
      dueAt: dueAtMs,
      hasExplicitTime: true,
      recurrence: {
        dtstart: occurrenceIso,
        rrule: "FREQ=DAILY;INTERVAL=1",
        series_id: "series:3"
      }
    });

    const target = resolveGoToTaskTarget([series], makeEvent(series.id, dueAtMs, series.title));
    expect(target).toEqual({
      preferredTaskId: buildSeriesOccurrenceRowId("series:3", occurrenceIso),
      fallbackSourceTaskId: "series-3"
    });
  });
});
