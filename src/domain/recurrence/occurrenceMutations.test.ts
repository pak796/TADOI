import { describe, expect, it } from "bun:test";
import type { Task } from "../models";
import {
  completeRecurringOccurrenceInTasks,
  skipRecurringOccurrenceInTasks,
  snoozeRecurringOccurrenceInTasks
} from "./occurrenceMutations";

function buildSeriesTask(): Task {
  return {
    id: "series-task",
    title: "Recurring",
    status: "open",
    createdAt: Date.parse("2026-03-01T09:00:00.000Z"),
    updatedAt: Date.parse("2026-03-01T09:00:00.000Z"),
    tags: ["p2"],
    recurrence: {
      dtstart: "2026-03-02T09:00:00",
      rrule: "FREQ=DAILY;INTERVAL=1",
      series_id: "series-1"
    }
  };
}

describe("occurrenceMutations", () => {
  it("complete occurrence adds EXDATE and materializes done instance", () => {
    const nowMs = Date.parse("2026-03-04T10:00:00.000Z");
    const tasks = [buildSeriesTask()];

    const next = completeRecurringOccurrenceInTasks(tasks, {
      seriesId: "series-1",
      occurrenceIso: "2026-03-04T09:00:00",
      nowMs
    });

    const series = next.find((task) => task.id === "series-task");
    const instance = next.find(
      (task) =>
        task.instance_of?.series_id === "series-1" &&
        task.instance_of?.occurrence === "2026-03-04T09:00:00"
    );

    expect(series?.recurrence?.exdates).toContain("2026-03-04T09:00:00");
    expect(instance?.status).toBe("done");
  });

  it("skip occurrence adds EXDATE and removes materialized override", () => {
    const nowMs = Date.parse("2026-03-04T10:00:00.000Z");
    const instance: Task = {
      id: "inst-1",
      title: "Recurring",
      status: "open",
      createdAt: nowMs,
      updatedAt: nowMs,
      dueAt: Date.parse("2026-03-04T09:00:00.000Z"),
      tags: ["p2"],
      instance_of: {
        series_id: "series-1",
        occurrence: "2026-03-04T09:00:00"
      }
    };

    const next = skipRecurringOccurrenceInTasks([buildSeriesTask(), instance], {
      seriesId: "series-1",
      occurrenceIso: "2026-03-04T09:00:00",
      nowMs
    });

    const series = next.find((task) => task.id === "series-task");
    const stillHasInstance = next.some((task) => task.id === "inst-1");
    expect(series?.recurrence?.exdates).toContain("2026-03-04T09:00:00");
    expect(stillHasInstance).toBe(false);
  });

  it("snooze occurrence adds EXDATE and creates +1 day open override", () => {
    const nowMs = Date.parse("2026-03-04T10:00:00.000Z");
    const next = snoozeRecurringOccurrenceInTasks([buildSeriesTask()], {
      seriesId: "series-1",
      occurrenceIso: "2026-03-04T09:00:00",
      nowMs
    });

    const series = next.find((task) => task.id === "series-task");
    const instance = next.find(
      (task) =>
        task.instance_of?.series_id === "series-1" &&
        task.instance_of?.occurrence === "2026-03-04T09:00:00"
    );

    expect(series?.recurrence?.exdates).toContain("2026-03-04T09:00:00");
    expect(instance?.status).toBe("open");
    expect(instance?.dueAt).toBe(Date.parse("2026-03-05T09:00:00.000Z"));
  });
});
