import { addLocalDaysMs, startOfLocalDayMs } from "../domain/dates";

export type CalendarExportRange = "next7" | "month" | "all";

export type CalendarRangeWindow = {
  range: CalendarExportRange;
  startMs?: number;
  endMs?: number; // exclusive
};

export function resolveCalendarRangeWindow(
  range: CalendarExportRange,
  nowMs: number
): CalendarRangeWindow {
  if (range === "all") {
    return { range };
  }

  const startMs = startOfLocalDayMs(nowMs);
  const days = range === "month" ? 30 : 7;
  return {
    range,
    startMs,
    endMs: addLocalDaysMs(startMs, days)
  };
}

export function isTimestampInRange(
  timestampMs: number,
  rangeWindow: CalendarRangeWindow
): boolean {
  if (rangeWindow.range === "all") return true;
  if (rangeWindow.startMs === undefined || rangeWindow.endMs === undefined) {
    return false;
  }
  return timestampMs >= rangeWindow.startMs && timestampMs < rangeWindow.endMs;
}
