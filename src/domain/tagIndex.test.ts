import { describe, expect, it } from "bun:test";
import {
  formatTagForDisplay,
  getTagCompletion,
  MAX_TAG_LENGTH,
  mergeTagIndexWithTaskHistory,
  normalizeTag,
  normalizeTagPrefix,
  normalizeTags,
  normalizeTagsFromInput
} from "./tagIndex";

describe("tag normalization", () => {
  it("normalizes case, strips hash, removes emojis, keeps _ and -", () => {
    const result = normalizeTag("#My_Tag-Name🔥");
    expect(result).toBe("my_tag-name");
  });

  it("normalizes tags with or without leading #", () => {
    expect(normalizeTag("#work")).toBe("work");
    expect(normalizeTag("work")).toBe("work");
  });

  it("returns null for a lone #", () => {
    expect(normalizeTag("#")).toBeNull();
  });

  it("dedupes and sorts tags alphabetically", () => {
    const result = normalizeTagsFromInput("#Work #home #work #Home");
    expect(result).toEqual(["home", "work"]);
  });

  it("supports comma delimiters", () => {
    const result = normalizeTagsFromInput("#Work,home,#errand");
    expect(result).toEqual(["errand", "home", "work"]);
  });

  it("truncates tags longer than max length", () => {
    const long = "a".repeat(MAX_TAG_LENGTH + 5);
    const result = normalizeTag(long);
    expect(result?.length).toBe(MAX_TAG_LENGTH);
  });

  it("applies max length, dedupe, and sorting in one pass", () => {
    const long = `${"z".repeat(MAX_TAG_LENGTH + 8)}🔥`;
    const result = normalizeTagsFromInput(`${long} #work #Work #alpha`);
    expect(result).toEqual(["alpha", "work", "z".repeat(MAX_TAG_LENGTH)]);
  });

  it("drops tags that become empty after normalization", () => {
    const result = normalizeTags(["🔥", "#", "  "]);
    expect(result).toEqual([]);
  });

  it("normalizes tag prefixes without stripping to null", () => {
    expect(normalizeTagPrefix("#Work!")).toBe("work");
    expect(normalizeTagPrefix("#")).toBe("");
  });

  it("formats tags with exactly one leading #", () => {
    expect(formatTagForDisplay("work")).toBe("#work");
    expect(formatTagForDisplay("#work")).toBe("#work");
  });

  it("chooses a completion and remainder", () => {
    const completion = getTagCompletion("wo", ["work", "world"]);
    expect(completion).toEqual({ full: "work", remainder: "rk" });
  });

  it("merges persisted tag index with live task history", () => {
    const merged = mergeTagIndexWithTaskHistory(
      {
        work: { tagName: "work", usageCount: 5, lastUsedAt: 100 },
        home: { tagName: "home", usageCount: 2, lastUsedAt: 80 }
      },
      [
        {
          tags: ["#work", "p1"],
          createdAt: 90,
          updatedAt: 95
        },
        {
          tags: ["home", "chore"],
          createdAt: 120,
          updatedAt: 130
        }
      ]
    );

    expect(merged.work).toEqual({ tagName: "work", usageCount: 6, lastUsedAt: 100 });
    expect(merged.home).toEqual({ tagName: "home", usageCount: 3, lastUsedAt: 130 });
    expect(merged.chore).toEqual({ tagName: "chore", usageCount: 1, lastUsedAt: 130 });
    expect(merged.p1).toEqual({ tagName: "p1", usageCount: 1, lastUsedAt: 95 });
  });
});
