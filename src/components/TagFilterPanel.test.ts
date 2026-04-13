import { describe, expect, it } from "bun:test";
import type { TagFilter } from "../domain/models";
import { getBucketTags, splitBucketTags } from "./TagFilterPanel";

describe("TagFilterPanel helpers", () => {
  it("returns empty bucket tags when draft is missing", () => {
    expect(getBucketTags(undefined, "all")).toEqual([]);
    expect(getBucketTags(undefined, "any")).toEqual([]);
    expect(getBucketTags(undefined, "none")).toEqual([]);
  });

  it("returns tags for the requested bucket", () => {
    const draft: TagFilter = {
      all: ["work", "urgent"],
      any: ["home"],
      none: ["blocked"],
    };
    expect(getBucketTags(draft, "all")).toEqual(["work", "urgent"]);
    expect(getBucketTags(draft, "any")).toEqual(["home"]);
    expect(getBucketTags(draft, "none")).toEqual(["blocked"]);
  });

  it("splits visible and hidden tags by limit", () => {
    const tags = Array.from(
      { length: 30 },
      (_, index) => `tag-${String(index)}`,
    );
    const { visibleTags, hiddenTagCount } = splitBucketTags(tags, 24);
    expect(visibleTags.length).toBe(24);
    expect(hiddenTagCount).toBe(6);
  });

  it("reports no hidden tags when list is below the limit", () => {
    const tags = ["work", "home"];
    const { visibleTags, hiddenTagCount } = splitBucketTags(tags, 24);
    expect(visibleTags).toEqual(tags);
    expect(hiddenTagCount).toBe(0);
  });
});
