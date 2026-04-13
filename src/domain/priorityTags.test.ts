import { describe, expect, it } from "bun:test";
import {
  canonicalPriorityTag,
  formatPriorityForDisplay,
  formatTagForReadOnlyDisplay,
  isPriorityToken,
  normalizePriorityFilterValue,
  normalizePriorityFromTokens,
  normalizePriorityTags,
  resolveTaskPriorityTag,
} from "./priorityTags";

describe("priorityTags", () => {
  it("recognizes priority tokens with optional leading hash", () => {
    expect(isPriorityToken("p1")).toEqual({ digits: "1" });
    expect(isPriorityToken("P2")).toEqual({ digits: "2" });
    expect(isPriorityToken("#p3")).toEqual({ digits: "3" });
    expect(isPriorityToken("#P10")).toEqual({ digits: "10" });
  });

  it("rejects invalid priority tokens", () => {
    expect(isPriorityToken("p")).toBeNull();
    expect(isPriorityToken("p-1")).toBeNull();
    expect(isPriorityToken("p1x")).toBeNull();
    expect(isPriorityToken("#work")).toBeNull();
  });

  it("canonicalizes priority tags with lowercase p", () => {
    expect(canonicalPriorityTag("1")).toBe("#p1");
    expect(canonicalPriorityTag("001")).toBe("#p001");
  });

  it("keeps only the last priority token and places it first", () => {
    const result = normalizePriorityFromTokens(["#p1", "foo", "P3", "bar"]);
    expect(result).toEqual(["#p3", "foo", "bar"]);
  });

  it("preserves non-priority stable order and dedupes them", () => {
    const result = normalizePriorityFromTokens([
      "#work",
      "home",
      "WORK",
      "p2",
      "home",
      "#errand",
      "p1",
    ]);
    expect(result).toEqual(["#p1", "work", "home", "errand"]);
  });

  it("normalizes legacy stored tags and preserves priority digits", () => {
    expect(normalizePriorityTags(["work", "P3", "home", "#p1"])).toEqual([
      "#p1",
      "work",
      "home",
    ]);
    expect(normalizePriorityTags(["p001", "work", "home"])).toEqual([
      "#p001",
      "work",
      "home",
    ]);
  });

  it("resolves the last task priority tag as canonical", () => {
    expect(resolveTaskPriorityTag(["work", "P3", "home", "#p1"])).toBe("#p1");
    expect(resolveTaskPriorityTag(["work", "home"])).toBeUndefined();
  });

  it("normalizes priority filter values to canonical form", () => {
    expect(normalizePriorityFilterValue("p1")).toBe("#p1");
    expect(normalizePriorityFilterValue("P2")).toBe("#p2");
    expect(normalizePriorityFilterValue("#P3")).toBe("#p3");
    expect(normalizePriorityFilterValue("work")).toBeUndefined();
    expect(normalizePriorityFilterValue(undefined)).toBeUndefined();
  });

  it("formats priority values for display without hash and uppercase P", () => {
    expect(formatPriorityForDisplay("#p1")).toBe("P1");
    expect(formatPriorityForDisplay("p02")).toBe("P02");
    expect(formatPriorityForDisplay("#P3")).toBe("P3");
    expect(formatPriorityForDisplay("work")).toBeUndefined();
    expect(formatPriorityForDisplay(undefined)).toBeUndefined();
  });

  it("formats read-only tag labels with priority-aware display semantics", () => {
    expect(formatTagForReadOnlyDisplay("#p1")).toBe("P1");
    expect(formatTagForReadOnlyDisplay("p02")).toBe("P02");
    expect(formatTagForReadOnlyDisplay("#work")).toBe("#work");
    expect(formatTagForReadOnlyDisplay("work")).toBe("#work");
  });
});
