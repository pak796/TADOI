import { describe, expect, it } from "bun:test";
import {
  canonicalPriorityTag,
  isPriorityToken,
  normalizePriorityFromTokens,
  normalizePriorityTags
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
      "p1"
    ]);
    expect(result).toEqual(["#p1", "work", "home", "errand"]);
  });

  it("normalizes legacy stored tags and preserves priority digits", () => {
    expect(normalizePriorityTags(["work", "P3", "home", "#p1"])).toEqual([
      "#p1",
      "work",
      "home"
    ]);
    expect(normalizePriorityTags(["p001", "work", "home"])).toEqual([
      "#p001",
      "work",
      "home"
    ]);
  });
});
