import { describe, expect, it } from "bun:test";
import { formatDueDisplay } from "./formatDueDisplay";

const NOW = new Date(2026, 4, 5, 14, 30, 0).getTime(); // Tue 5 May 2026 14:30 local

function localDate(year: number, month: number, day: number, hour = 0, minute = 0): number {
  return new Date(year, month - 1, day, hour, minute, 0).getTime();
}

describe("formatDueDisplay", () => {
  it("renders today without explicit time", () => {
    expect(formatDueDisplay(localDate(2026, 5, 5), NOW, false)).toBe("today");
  });

  it("renders today with explicit time in 12-hour lowercase form", () => {
    expect(formatDueDisplay(localDate(2026, 5, 5, 14, 30), NOW, true)).toBe("today 2:30pm");
    expect(formatDueDisplay(localDate(2026, 5, 5, 9, 0), NOW, true)).toBe("today 9am");
    expect(formatDueDisplay(localDate(2026, 5, 5, 0, 0), NOW, true)).toBe("today 12am");
    expect(formatDueDisplay(localDate(2026, 5, 5, 12, 0), NOW, true)).toBe("today 12pm");
  });

  it("renders tomorrow and yesterday", () => {
    expect(formatDueDisplay(localDate(2026, 5, 6), NOW, false)).toBe("tomorrow");
    expect(formatDueDisplay(localDate(2026, 5, 4), NOW, false)).toBe("yesterday");
    expect(formatDueDisplay(localDate(2026, 5, 6, 17, 0), NOW, true)).toBe("tomorrow 5pm");
  });

  it("renders near-future as 'in Nd'", () => {
    expect(formatDueDisplay(localDate(2026, 5, 7), NOW, false)).toBe("in 2d");
    expect(formatDueDisplay(localDate(2026, 5, 11), NOW, false)).toBe("in 6d");
  });

  it("renders near-past as 'Nd overdue'", () => {
    expect(formatDueDisplay(localDate(2026, 5, 3), NOW, false)).toBe("2d overdue");
    expect(formatDueDisplay(localDate(2026, 4, 29), NOW, false)).toBe("6d overdue");
  });

  it("renders far-future as a calendar date without year (same year)", () => {
    expect(formatDueDisplay(localDate(2026, 5, 15), NOW, false)).toBe("Fri 15 May");
    expect(formatDueDisplay(localDate(2026, 12, 25), NOW, false)).toBe("Fri 25 Dec");
  });

  it("includes the year for cross-year dates", () => {
    expect(formatDueDisplay(localDate(2027, 1, 15), NOW, false)).toBe("Fri 15 Jan 2027");
  });

  it("flags far-past dates as overdue with the calendar date", () => {
    expect(formatDueDisplay(localDate(2026, 4, 20), NOW, false)).toBe("Mon 20 Apr (overdue)");
  });

  it("appends time on far-future calendar dates when explicit time set", () => {
    expect(formatDueDisplay(localDate(2026, 5, 15, 14, 30), NOW, true)).toBe(
      "Fri 15 May 2:30pm"
    );
  });
});
