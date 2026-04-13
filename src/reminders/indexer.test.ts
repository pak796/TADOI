import { describe, expect, it } from "bun:test";
import { buildReminderIndex } from "./indexer";
import type { Task } from "../domain/models";
import { parseSeriesOccurrenceRowId } from "../domain/taskRows";

function buildTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Reminder task",
    status: "open",
    createdAt: Date.parse("2026-03-01T12:00:00.000Z"),
    updatedAt: Date.parse("2026-03-01T12:00:00.000Z"),
    tags: ["p2", "ops"],
    dueAt: Date.parse("2026-03-03T15:00:00.000Z"),
    reminder: {
      kind: "before_due",
      offsetMs: 10 * 60_000,
    },
    ...overrides,
  };
}

describe("buildReminderIndex", () => {
  it("produces stable event ids for same task/occurrence/remindAt", () => {
    const nowMs = Date.parse("2026-03-03T00:00:00.000Z");
    const task = buildTask();

    const first = buildReminderIndex([task], nowMs);
    const second = buildReminderIndex([task], nowMs);

    expect(first.events).toHaveLength(1);
    expect(second.events).toHaveLength(1);
    expect(first.events[0]?.eventId).toBe(second.events[0]?.eventId);
  });

  it("changes event id when reminder time changes", () => {
    const nowMs = Date.parse("2026-03-03T00:00:00.000Z");
    const task = buildTask();
    const shifted = buildTask({
      reminder: {
        kind: "before_due",
        offsetMs: 60 * 60_000,
      },
    });

    const first = buildReminderIndex([task], nowMs);
    const second = buildReminderIndex([shifted], nowMs);

    expect(first.events[0]?.eventId).not.toBe(second.events[0]?.eventId);
  });

  it("indexes recurring series occurrences and dedupes materialized instance rows", () => {
    const nowMs = Date.parse("2026-03-03T00:00:00.000Z");
    const seriesTask = buildTask({
      id: "series-1",
      title: "Recurring",
      dueAt: undefined,
      recurrence: {
        dtstart: "2026-03-03T09:00:00",
        rrule: "FREQ=DAILY;INTERVAL=1",
        series_id: "series-abc",
      },
    });

    const instanceTask = buildTask({
      id: "instance-1",
      title: "Recurring",
      dueAt: Date.parse("2026-03-04T09:00:00.000Z"),
      instance_of: {
        series_id: "series-abc",
        occurrence: "2026-03-04T09:00:00",
      },
    });

    const index = buildReminderIndex([seriesTask, instanceTask], nowMs);

    const recurringEvents = index.events.filter((event) =>
      event.occurrenceKey.startsWith("series_occurrence:"),
    );
    expect(recurringEvents.length).toBeGreaterThan(0);

    const parsed = recurringEvents
      .map((event) => parseSeriesOccurrenceRowId(event.occurrenceKey))
      .filter((value) => value !== null);
    expect(parsed.length).toBeGreaterThan(0);

    const matchingOccurrences = parsed.filter(
      (entry) =>
        entry?.seriesId === "series-abc" &&
        entry?.occurrenceIso === "2026-03-04T09:00:00",
    );
    expect(matchingOccurrences).toHaveLength(1);
  });
});
