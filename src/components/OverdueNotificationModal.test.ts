import { describe, expect, it } from "bun:test";
import { formatDueDateTimeLabel, formatOverdueBy } from "./OverdueNotificationModal";

describe("OverdueNotificationModal helpers", () => {
  it("passes through invalid due date strings", () => {
    expect(formatDueDateTimeLabel("not-a-date")).toBe("not-a-date");
    expect(formatOverdueBy(Date.now(), "not-a-date")).toBe("unknown");
  });

  it("formats valid due date strings into date+time labels", () => {
    const iso = new Date(2026, 1, 10, 9, 30, 0).toISOString();
    const formatted = formatDueDateTimeLabel(iso);
    expect(formatted).not.toBe(iso);
    expect(formatted.includes(" ")).toBe(true);
  });

  it("formats overdue duration buckets", () => {
    const nowMs = Date.parse("2026-02-10T10:00:00.000Z");
    expect(formatOverdueBy(nowMs, "2026-02-10T10:01:00.000Z")).toBe("<1m");
    expect(formatOverdueBy(nowMs, "2026-02-10T09:30:00.000Z")).toBe("30m");
    expect(formatOverdueBy(nowMs, "2026-02-10T06:45:00.000Z")).toBe("3h 15m");
    expect(formatOverdueBy(nowMs, "2026-02-08T05:00:00.000Z")).toBe("2d 5h");
  });
});
