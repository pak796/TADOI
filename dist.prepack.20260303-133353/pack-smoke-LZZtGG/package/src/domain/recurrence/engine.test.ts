import { describe, expect, it } from "bun:test";
import { addLocalDaysMs, startOfLocalDayMs } from "../dates";
import { Task } from "../models";
import {
  applyExdates,
  getOccurrences,
  latestOverdueOccurrence,
  nextOccurrence
} from "./engine";
import { formatDateToLocalIso } from "./rruleAdapter";

function makeSeriesTask(options: {
  id: string;
  start: Date;
  rrule: string;
  hasExplicitTime?: boolean;
  exdates?: string[];
}): Task {
  return {
    id: options.id,
    title: options.id,
    status: "open",
    createdAt: options.start.getTime(),
    updatedAt: options.start.getTime(),
    dueAt: options.start.getTime(),
    hasExplicitTime: options.hasExplicitTime ?? true,
    tags: ["work"],
    recurrence: {
      dtstart: formatDateToLocalIso(options.start),
      rrule: options.rrule,
      exdates: options.exdates,
      series_id: `series:${options.id}`
    }
  };
}

describe("recurrence engine", () => {
  it("expands weekly rules on specific weekdays", () => {
    const start = new Date(2026, 1, 9, 9, 0, 0); // Monday
    const task = makeSeriesTask({
      id: "weekly",
      start,
      rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE"
    });
    const rangeStart = startOfLocalDayMs(start.getTime());
    const rangeEnd = addLocalDaysMs(rangeStart, 8) - 1;
    const occurrences = getOccurrences(task, rangeStart, rangeEnd);

    expect(occurrences).toEqual([
      formatDateToLocalIso(new Date(2026, 1, 9, 9, 0, 0)),
      formatDateToLocalIso(new Date(2026, 1, 11, 9, 0, 0)),
      formatDateToLocalIso(new Date(2026, 1, 16, 9, 0, 0))
    ]);
  });

  it("skips months lacking day 31 for BYMONTHDAY=31", () => {
    const start = new Date(2026, 0, 31, 9, 0, 0);
    const task = makeSeriesTask({
      id: "monthly-31",
      start,
      rrule: "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=31;COUNT=5"
    });

    const rangeStart = startOfLocalDayMs(new Date(2026, 0, 1, 0, 0, 0).getTime());
    const rangeEnd = startOfLocalDayMs(new Date(2026, 3, 30, 23, 59, 59).getTime());
    const occurrences = getOccurrences(task, rangeStart, rangeEnd);

    expect(occurrences).toEqual([
      formatDateToLocalIso(new Date(2026, 0, 31, 9, 0, 0)),
      formatDateToLocalIso(new Date(2026, 2, 31, 9, 0, 0))
    ]);
  });

  it("applies EXDATE exclusions", () => {
    const start = new Date(2026, 1, 9, 9, 0, 0);
    const excluded = formatDateToLocalIso(new Date(2026, 1, 11, 9, 0, 0));
    const task = makeSeriesTask({
      id: "with-exdate",
      start,
      rrule: "FREQ=DAILY;INTERVAL=1;COUNT=4",
      exdates: [excluded]
    });

    const rangeStart = startOfLocalDayMs(start.getTime());
    const rangeEnd = addLocalDaysMs(rangeStart, 4) - 1;
    const occurrences = getOccurrences(task, rangeStart, rangeEnd);

    expect(occurrences).toEqual([
      formatDateToLocalIso(new Date(2026, 1, 9, 9, 0, 0)),
      formatDateToLocalIso(new Date(2026, 1, 10, 9, 0, 0)),
      formatDateToLocalIso(new Date(2026, 1, 12, 9, 0, 0))
    ]);
  });

  it("keeps local wall-clock time stable across DST boundaries", () => {
    const start = new Date(2026, 2, 1, 9, 0, 0); // around US DST transition window
    const task = makeSeriesTask({
      id: "dst-weekly",
      start,
      rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=SU;COUNT=4"
    });

    const rangeStart = startOfLocalDayMs(start.getTime());
    const rangeEnd = addLocalDaysMs(rangeStart, 30) - 1;
    const occurrences = getOccurrences(task, rangeStart, rangeEnd);
    const occurrenceDates = occurrences
      .map((iso) => {
        const [date, time] = iso.split("T");
        const [y, m, d] = date.split("-").map((value) => Number(value));
        const [hh, mm, ss] = time.split(":").map((value) => Number(value));
        return new Date(y, m - 1, d, hh, mm, ss);
      });

    expect(occurrenceDates.length).toBeGreaterThanOrEqual(3);
    for (const date of occurrenceDates) {
      expect(date.getHours()).toBe(9);
      expect(date.getMinutes()).toBe(0);
    }
  });

  it("completion exclusion does not end series; next occurrence still resolves", () => {
    const start = new Date(2026, 1, 9, 9, 0, 0);
    const firstOccurrence = formatDateToLocalIso(start);
    const task = makeSeriesTask({
      id: "complete-one",
      start,
      rrule: "FREQ=DAILY;INTERVAL=1",
      exdates: [firstOccurrence]
    });

    const after = new Date(2026, 1, 9, 0, 0, 0).getTime();
    const next = nextOccurrence(task, after);
    expect(next).toBe(formatDateToLocalIso(new Date(2026, 1, 10, 9, 0, 0)));

    const overdueNow = new Date(2026, 1, 11, 12, 0, 0).getTime();
    const latestOverdue = latestOverdueOccurrence(task, overdueNow);
    expect(latestOverdue).toBe(formatDateToLocalIso(new Date(2026, 1, 11, 9, 0, 0)));
  });

  it("filters explicit exdates from occurrence arrays", () => {
    const occurrences = [
      "2026-02-09T09:00:00",
      "2026-02-10T09:00:00",
      "2026-02-11T09:00:00"
    ];
    expect(applyExdates(occurrences, ["2026-02-10T09:00:00"])).toEqual([
      "2026-02-09T09:00:00",
      "2026-02-11T09:00:00"
    ]);
  });

  it("returns empty/null when recurrence metadata is malformed", () => {
    const start = new Date(2026, 1, 9, 9, 0, 0);
    const task = makeSeriesTask({
      id: "invalid-dtstart",
      start,
      rrule: "FREQ=DAILY;INTERVAL=1"
    });
    if (!task.recurrence) {
      throw new Error("Expected recurrence for test setup");
    }
    task.recurrence.dtstart = "not-a-date";

    const rangeStart = startOfLocalDayMs(start.getTime());
    const rangeEnd = addLocalDaysMs(rangeStart, 2) - 1;

    expect(() => getOccurrences(task, rangeStart, rangeEnd)).not.toThrow();
    expect(() => nextOccurrence(task, rangeStart)).not.toThrow();
    expect(() => latestOverdueOccurrence(task, rangeEnd)).not.toThrow();

    expect(getOccurrences(task, rangeStart, rangeEnd)).toEqual([]);
    expect(nextOccurrence(task, rangeStart)).toBeNull();
    expect(latestOverdueOccurrence(task, rangeEnd)).toBeNull();
  });
});
