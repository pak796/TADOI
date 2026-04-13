import { describe, expect, it } from "bun:test";
import { Task } from "../models";
import {
  deleteRecurringOccurrence,
  deleteRecurringOccurrenceAndFuture,
} from "./delete";
import { parseRRule } from "./rruleAdapter";

function makeSeriesTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "series-1",
    title: "Daily standup",
    status: "open",
    createdAt: 1,
    updatedAt: 1,
    dueAt: 1760086800000,
    hasExplicitTime: true,
    tags: ["team"],
    recurrence: {
      dtstart: "2026-02-10T09:00:00",
      rrule: "FREQ=DAILY;INTERVAL=1;COUNT=10",
      series_id: "series:standup",
      exdates: ["2026-02-11T09:00:00", "2026-02-13T09:00:00"],
    },
    ...overrides,
  };
}

function makeInstanceTask(id: string, occurrence: string): Task {
  return {
    id,
    title: `instance ${occurrence}`,
    status: "done",
    createdAt: 2,
    updatedAt: 2,
    dueAt: 1760086800000,
    hasExplicitTime: true,
    tags: [],
    instance_of: {
      series_id: "series:standup",
      occurrence,
    },
  };
}

describe("recurring delete helpers", () => {
  it("deletes a single occurrence by adding exdate and removing matching instance", () => {
    const seriesTask = makeSeriesTask();
    const tasks = [
      { ...seriesTask, recurrence: { ...seriesTask.recurrence!, exdates: [] } },
      makeInstanceTask("i-1", "2026-02-12T09:00:00"),
      makeInstanceTask("i-2", "2026-02-14T09:00:00"),
    ];

    const updated = deleteRecurringOccurrence(tasks, {
      seriesTaskId: "series-1",
      seriesId: "series:standup",
      occurrenceIso: "2026-02-12T09:00:00",
      nowMs: 42,
    });

    const series = updated.find((task) => task.id === "series-1");
    expect(series?.recurrence?.exdates).toEqual(["2026-02-12T09:00:00"]);
    expect(series?.updatedAt).toBe(42);
    expect(updated.some((task) => task.id === "i-1")).toBe(false);
    expect(updated.some((task) => task.id === "i-2")).toBe(true);
  });

  it("deletes selected and future occurrences by truncating recurrence and pruning future instances", () => {
    const tasks = [
      makeSeriesTask(),
      makeInstanceTask("i-prev", "2026-02-12T09:00:00"),
      makeInstanceTask("i-target", "2026-02-13T09:00:00"),
      makeInstanceTask("i-future", "2026-02-14T09:00:00"),
    ];

    const updated = deleteRecurringOccurrenceAndFuture(tasks, {
      seriesTaskId: "series-1",
      seriesId: "series:standup",
      occurrenceIso: "2026-02-13T09:00:00",
      nowMs: 77,
    });

    const series = updated.find((task) => task.id === "series-1");
    const parsed = parseRRule(series?.recurrence?.rrule ?? "");
    expect(parsed.count).toBeUndefined();
    expect(parsed.untilIso).toBe("2026-02-12T09:00:00");
    expect(series?.recurrence?.exdates).toEqual(["2026-02-11T09:00:00"]);
    expect(updated.some((task) => task.id === "i-prev")).toBe(true);
    expect(updated.some((task) => task.id === "i-target")).toBe(false);
    expect(updated.some((task) => task.id === "i-future")).toBe(false);
  });

  it("removes series entirely when truncating from first occurrence", () => {
    const tasks = [
      makeSeriesTask(),
      makeInstanceTask("i-first", "2026-02-10T09:00:00"),
      makeInstanceTask("i-next", "2026-02-11T09:00:00"),
    ];

    const updated = deleteRecurringOccurrenceAndFuture(tasks, {
      seriesTaskId: "series-1",
      seriesId: "series:standup",
      occurrenceIso: "2026-02-10T09:00:00",
      nowMs: 99,
    });

    expect(updated.some((task) => task.id === "series-1")).toBe(false);
    expect(updated.some((task) => task.id === "i-first")).toBe(false);
    expect(updated.some((task) => task.id === "i-next")).toBe(false);
  });

  it("keeps past materialized instances when deleting future in a series", () => {
    const tasks = [
      makeSeriesTask(),
      makeInstanceTask("i-past", "2026-02-12T09:00:00"),
      makeInstanceTask("i-selected", "2026-02-13T09:00:00"),
    ];

    const updated = deleteRecurringOccurrenceAndFuture(tasks, {
      seriesTaskId: "series-1",
      seriesId: "series:standup",
      occurrenceIso: "2026-02-13T09:00:00",
      nowMs: 123,
    });

    expect(updated.some((task) => task.id === "i-past")).toBe(true);
    expect(updated.some((task) => task.id === "i-selected")).toBe(false);
  });
});
