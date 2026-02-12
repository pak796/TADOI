import { describe, expect, it } from "bun:test";
import type { Task } from "../domain/models";
import { mapNonRecurringTaskToEvent } from "./calendarMapper";

const GENERATED_AT = new Date(Date.UTC(2026, 1, 12, 12, 30, 0));

function makeTask(partial: Partial<Task> & Pick<Task, "id" | "title">): Task {
  return {
    id: partial.id,
    title: partial.title,
    status: partial.status ?? "open",
    createdAt: partial.createdAt ?? 0,
    updatedAt: partial.updatedAt ?? 0,
    dueAt: partial.dueAt,
    hasExplicitTime: partial.hasExplicitTime,
    tags: partial.tags ?? [],
    notes: partial.notes,
    links: partial.links,
    recurrence: partial.recurrence,
    instance_of: partial.instance_of
  };
}

describe("calendarMapper", () => {
  it("maps date-only tasks as all-day with end-exclusive next-day DTEND", () => {
    const task = makeTask({
      id: "all-day",
      title: "All day",
      dueAt: Date.UTC(2026, 1, 15, 0, 0, 0),
      hasExplicitTime: false
    });

    const event = mapNonRecurringTaskToEvent(
      task,
      { mode: "utc", timeZone: "UTC" },
      GENERATED_AT
    );
    expect(event).not.toBeNull();
    if (!event) return;

    expect(event.dtstart).toEqual({ kind: "date", value: "20260215" });
    expect(event.dtend).toEqual({ kind: "date", value: "20260216" });
  });

  it("maps timed tasks with a default 30-minute duration", () => {
    const task = makeTask({
      id: "timed",
      title: "Timed",
      dueAt: Date.UTC(2026, 1, 16, 14, 0, 0),
      hasExplicitTime: true
    });

    const event = mapNonRecurringTaskToEvent(
      task,
      { mode: "utc", timeZone: "UTC" },
      GENERATED_AT
    );
    expect(event).not.toBeNull();
    if (!event) return;

    expect(event.dtstart).toEqual({
      kind: "date-time",
      value: "20260216T140000Z",
      utc: true
    });
    expect(event.dtend).toEqual({
      kind: "date-time",
      value: "20260216T143000Z",
      utc: true
    });
  });

  it("keeps local wall-clock DTSTART stable across DST in America/Chicago", () => {
    const beforeDst = makeTask({
      id: "dst-before",
      title: "DST Before",
      dueAt: Date.parse("2026-03-07T15:00:00Z"),
      hasExplicitTime: true
    });
    const afterDst = makeTask({
      id: "dst-after",
      title: "DST After",
      dueAt: Date.parse("2026-03-10T14:00:00Z"),
      hasExplicitTime: true
    });

    const beforeEvent = mapNonRecurringTaskToEvent(
      beforeDst,
      { mode: "tzid", timeZone: "America/Chicago" },
      GENERATED_AT
    );
    const afterEvent = mapNonRecurringTaskToEvent(
      afterDst,
      { mode: "tzid", timeZone: "America/Chicago" },
      GENERATED_AT
    );

    expect(beforeEvent?.dtstart).toEqual({
      kind: "date-time",
      value: "20260307T090000",
      tzid: "America/Chicago"
    });
    expect(afterEvent?.dtstart).toEqual({
      kind: "date-time",
      value: "20260310T090000",
      tzid: "America/Chicago"
    });
  });
});
