import { describe, expect, it } from "bun:test";
import { isRepeatOccurrenceAfterSeriesStart } from "./repeatOccurrence";

describe("isRepeatOccurrenceAfterSeriesStart", () => {
  it("returns false when series start is missing or invalid", () => {
    expect(
      isRepeatOccurrenceAfterSeriesStart(undefined, "2026-02-12T09:00:00"),
    ).toBe(false);
    expect(
      isRepeatOccurrenceAfterSeriesStart("invalid", "2026-02-12T09:00:00"),
    ).toBe(false);
  });

  it("returns false for the first occurrence equal to dtstart", () => {
    expect(
      isRepeatOccurrenceAfterSeriesStart(
        "2026-02-12T09:00:00",
        "2026-02-12T09:00:00",
      ),
    ).toBe(false);
  });

  it("returns true for an occurrence after dtstart", () => {
    expect(
      isRepeatOccurrenceAfterSeriesStart(
        "2026-02-12T09:00:00",
        "2026-02-13T09:00:00",
      ),
    ).toBe(true);
  });

  it("returns false for an occurrence before dtstart", () => {
    expect(
      isRepeatOccurrenceAfterSeriesStart(
        "2026-02-12T09:00:00",
        "2026-02-11T09:00:00",
      ),
    ).toBe(false);
  });

  it("returns false when occurrence is invalid", () => {
    expect(
      isRepeatOccurrenceAfterSeriesStart(
        "2026-02-12T09:00:00",
        "bad-occurrence",
      ),
    ).toBe(false);
  });
});
