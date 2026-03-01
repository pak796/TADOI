import { describe, expect, it } from "bun:test";
import { computeVisibleTagPills } from "./tagPills";

describe("computeVisibleTagPills", () => {
  it("returns all tags when row width permits", () => {
    const result = computeVisibleTagPills(["help", "work"], 20);
    expect(result).toEqual({
      visibleTags: ["help", "work"],
      hiddenCount: 0
    });
  });

  it("caps visible pills and returns hidden count when width is constrained", () => {
    const result = computeVisibleTagPills(["help", "work", "docs"], 20);
    expect(result).toEqual({
      visibleTags: ["help", "work"],
      hiddenCount: 1
    });
  });

  it("falls back to overflow-only when no visible pills can fit", () => {
    const result = computeVisibleTagPills(["help", "work"], 4);
    expect(result).toEqual({
      visibleTags: [],
      hiddenCount: 2
    });
  });

  it("measures priority tags using read-only display format", () => {
    const result = computeVisibleTagPills(["p1", "help", "work"], 12);
    expect(result).toEqual({
      visibleTags: ["p1"],
      hiddenCount: 2
    });
  });
});
