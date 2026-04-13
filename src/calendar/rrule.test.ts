import { describe, expect, it } from "bun:test";
import {
  formatRecurrenceExdates,
  isValidRRuleFragment,
  toRRuleLine,
} from "./rrule";

describe("calendar rrule helpers", () => {
  it("gates RRULE fragments with strict validity checks", () => {
    expect(isValidRRuleFragment("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE")).toBe(
      true,
    );
    expect(isValidRRuleFragment("RRULE:FREQ=DAILY;INTERVAL=1")).toBe(true);
    expect(isValidRRuleFragment("FREQ=NOPE;INTERVAL=1")).toBe(false);
    expect(isValidRRuleFragment("X-CUSTOM=1")).toBe(false);
    expect(isValidRRuleFragment("")).toBe(false);
  });

  it("formats RRULE lines with RRULE: prefix", () => {
    expect(toRRuleLine("FREQ=DAILY;INTERVAL=1")).toBe(
      "RRULE:FREQ=DAILY;INTERVAL=1",
    );
    expect(toRRuleLine("RRULE:FREQ=DAILY;INTERVAL=1")).toBe(
      "RRULE:FREQ=DAILY;INTERVAL=1",
    );
  });

  it("formats EXDATE values for date and date-time forms", () => {
    const exdates = ["2026-02-11T09:00:00", "2026-02-10T09:00:00"];

    expect(formatRecurrenceExdates(exdates, "date-time")).toEqual([
      "20260210T090000",
      "20260211T090000",
    ]);
    expect(formatRecurrenceExdates(exdates, "date")).toEqual([
      "20260210",
      "20260211",
    ]);
  });
});
