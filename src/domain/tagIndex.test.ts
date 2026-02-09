import { describe, expect, it } from "bun:test";
import {
  MAX_TAG_LENGTH,
  normalizeTag,
  normalizeTags,
  normalizeTagsFromInput
} from "./tagIndex";

describe("tag normalization", () => {
  it("normalizes case, strips hash, removes emojis, keeps _ and -", () => {
    const result = normalizeTag("#My_Tag-Name🔥");
    expect(result).toBe("my_tag-name");
  });

  it("dedupes and sorts tags alphabetically", () => {
    const result = normalizeTagsFromInput("#Work #home #work #Home");
    expect(result).toEqual(["home", "work"]);
  });

  it("truncates tags longer than max length", () => {
    const long = "a".repeat(MAX_TAG_LENGTH + 5);
    const result = normalizeTag(long);
    expect(result?.length).toBe(MAX_TAG_LENGTH);
  });

  it("drops tags that become empty after normalization", () => {
    const result = normalizeTags(["🔥", "#", "  "]);
    expect(result).toEqual([]);
  });
});
