import { describe, expect, it } from "bun:test";
import { addLocalDaysMs, startOfLocalDayMs } from "../domain/dates";
import { isTimestampInRange, resolveCalendarRangeWindow } from "./range";

describe("calendar range", () => {
  it("computes next7 as local start-of-day(today) through start-of-day(+7)", () => {
    const now = new Date(2026, 1, 12, 15, 45, 0).getTime();
    const start = startOfLocalDayMs(now);
    const end = addLocalDaysMs(start, 7);

    const window = resolveCalendarRangeWindow("next7", now);
    expect(window.startMs).toBe(start);
    expect(window.endMs).toBe(end);
    expect(isTimestampInRange(start, window)).toBe(true);
    expect(isTimestampInRange(addLocalDaysMs(start, 6), window)).toBe(true);
    expect(isTimestampInRange(end, window)).toBe(false);
  });

  it("computes month as local start-of-day(today) through start-of-day(+30)", () => {
    const now = new Date(2026, 1, 12, 8, 0, 0).getTime();
    const start = startOfLocalDayMs(now);
    const end = addLocalDaysMs(start, 30);

    const window = resolveCalendarRangeWindow("month", now);
    expect(window.startMs).toBe(start);
    expect(window.endMs).toBe(end);
    expect(isTimestampInRange(addLocalDaysMs(start, 29), window)).toBe(true);
    expect(isTimestampInRange(end, window)).toBe(false);
  });
});
