import { describe, expect, it } from "bun:test";
import {
  addLocalDaysMs,
  combineLocalDateAndTime,
  diffLocalDays,
  isSameLocalDay,
  parseTimeToMinutes,
  parseDateToLocalMidnight,
  startOfLocalDayMs,
  toLocalMidnight
} from "./dates";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("date-only helpers", () => {
  it("parses YYYY-MM-DD to local midnight", () => {
    const parsed = parseDateToLocalMidnight("2026-02-09");
    expect(parsed).not.toBeUndefined();
    if (!parsed) return;
    expect(parsed.getHours()).toBe(0);
    expect(parsed.getMinutes()).toBe(0);
    expect(parsed.getSeconds()).toBe(0);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(1);
    expect(parsed.getDate()).toBe(9);
  });

  it("parses HH:mm time strictly", () => {
    expect(parseTimeToMinutes("09:30")).toBe(570);
    expect(parseTimeToMinutes("23:59")).toBe(1439);
    expect(parseTimeToMinutes("24:00")).toBeUndefined();
    expect(parseTimeToMinutes("9:30")).toBeUndefined();
    expect(parseTimeToMinutes("12:60")).toBeUndefined();
  });

  it("combines local date + time", () => {
    const date = parseDateToLocalMidnight("2026-02-09");
    const combined = date ? combineLocalDateAndTime(date, "14:05") : undefined;
    expect(combined).not.toBeUndefined();
    if (!combined) return;
    expect(combined.getFullYear()).toBe(2026);
    expect(combined.getMonth()).toBe(1);
    expect(combined.getDate()).toBe(9);
    expect(combined.getHours()).toBe(14);
    expect(combined.getMinutes()).toBe(5);
  });

  it("treats today based on local midnight (time-of-day invariant)", () => {
    const now = new Date(2026, 1, 9, 18, 30, 0, 0);
    const midnight = toLocalMidnight(now).getTime();
    const laterSameDay = new Date(2026, 1, 9, 23, 59, 59, 999).getTime();
    expect(diffLocalDays(laterSameDay, midnight)).toBe(0);
    expect(isSameLocalDay(new Date(midnight), new Date(laterSameDay))).toBe(true);
  });

  it("handles DST boundaries using local-day math when applicable", () => {
    const reference = new Date(2026, 2, 8, 12, 0, 0, 0).getTime();
    const start = startOfLocalDayMs(reference);
    const next = addLocalDaysMs(start, 1);
    expect(diffLocalDays(next, start)).toBe(1);

    const offsetStart = new Date(start).getTimezoneOffset();
    const offsetNext = new Date(next).getTimezoneOffset();
    if (offsetStart !== offsetNext) {
      // On DST shifts, the ms delta may not equal 24h, but day diff should still be 1.
      expect(next - start).not.toBe(DAY_MS);
    }
  });
});
