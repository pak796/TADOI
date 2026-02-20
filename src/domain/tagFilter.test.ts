import { describe, expect, it } from "bun:test";
import { type Filters } from "./models";
import {
  formatTagFilterBooleanSummary,
  isEmptyTagFilter,
  matchesTagFilter,
  normalizeTagFilter,
  normalizeTagToken
} from "./tagFilter";

function baseFilters(patch: Partial<Filters> = {}): Filters {
  return {
    status: "all",
    due: "any",
    ...patch
  };
}

describe("tagFilter helpers", () => {
  it("normalizes a single token into canonical hashless tag text", () => {
    expect(normalizeTagToken(" #Work ")).toBe("work");
    expect(normalizeTagToken("###home!")).toBe("home");
    expect(normalizeTagToken("#p2")).toBeUndefined();
    expect(normalizeTagToken("p10")).toBeUndefined();
    expect(normalizeTagToken("   ")).toBeUndefined();
  });

  it("legacy filters.tag still enforces exact membership", () => {
    const filters = baseFilters({ tag: "work" });
    expect(matchesTagFilter(["work", "home"], filters)).toBe(true);
    expect(matchesTagFilter(["home"], filters)).toBe(false);
  });

  it("ALL bucket requires all tags", () => {
    const filters = baseFilters({ tagFilter: { all: ["work", "urgent"] } });
    expect(matchesTagFilter(["work", "urgent"], filters)).toBe(true);
    expect(matchesTagFilter(["work"], filters)).toBe(false);
  });

  it("ANY bucket requires at least one tag when non-empty", () => {
    const filters = baseFilters({ tagFilter: { any: ["work", "urgent"] } });
    expect(matchesTagFilter(["work"], filters)).toBe(true);
    expect(matchesTagFilter(["home"], filters)).toBe(false);
  });

  it("NONE bucket excludes matches", () => {
    const filters = baseFilters({ tagFilter: { none: ["blocked"] } });
    expect(matchesTagFilter(["work"], filters)).toBe(true);
    expect(matchesTagFilter(["work", "blocked"], filters)).toBe(false);
  });

  it("non-empty tagFilter takes precedence over legacy tag", () => {
    const filters = baseFilters({
      tag: "work",
      tagFilter: { any: ["home"] }
    });
    expect(matchesTagFilter(["home"], filters)).toBe(true);
    expect(matchesTagFilter(["work"], filters)).toBe(false);
  });

  it("empty tagFilter buckets are no-op and fall back to legacy tag", () => {
    const normalized = normalizeTagFilter({ all: [], any: [], none: [] });
    expect(normalized).toBeUndefined();
    expect(isEmptyTagFilter({ all: [], any: [], none: [] })).toBe(true);

    const filters = baseFilters({
      tag: "work",
      tagFilter: { all: [], any: [], none: [] }
    });
    expect(matchesTagFilter(["work"], filters)).toBe(true);
    expect(matchesTagFilter(["home"], filters)).toBe(false);
  });

  it("ignores legacy priority tokens in filters.tag", () => {
    const filters = baseFilters({ tag: "#p2" });
    expect(matchesTagFilter(["home"], filters)).toBe(true);
    expect(matchesTagFilter(["work"], filters)).toBe(true);
  });

  it("ignores priority tokens inside boolean tagFilter buckets", () => {
    const allFilters = baseFilters({ tagFilter: { all: ["work", "#p2"] } });
    expect(matchesTagFilter(["work"], allFilters)).toBe(true);
    expect(matchesTagFilter(["home"], allFilters)).toBe(false);

    const noneFilters = baseFilters({ tagFilter: { none: ["#p3"] } });
    expect(matchesTagFilter(["work", "p3"], noneFilters)).toBe(true);
  });

  it("formats boolean summary with canonical non-priority tags", () => {
    expect(
      formatTagFilterBooleanSummary({
        all: ["work"],
        any: ["home"],
        none: ["blocked"]
      })
    ).toBe("+#work ~#home -#blocked");
  });

  it("never includes priority tokens in boolean summary output", () => {
    expect(
      formatTagFilterBooleanSummary({
        all: ["work", "#p2"],
        any: ["#p3"],
        none: ["#p4"]
      })
    ).toBe("+#work");
  });
});
