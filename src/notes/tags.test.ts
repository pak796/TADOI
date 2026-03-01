import { describe, expect, it } from "bun:test";
import {
  expandHierarchicalTagKeys,
  noteTagMatchesFilter,
  parseNoteTags
} from "./tags";

describe("parseNoteTags", () => {
  it("parses inline and frontmatter tags with nested support", () => {
    const result = parseNoteTags({
      markdown: "#inbox/to-read and #team\n```\n#ignore/me\n```",
      frontmatterTags: ["focus", "inbox/to-read"]
    });

    expect(result.tags).toEqual(["focus", "inbox/to-read", "team"]);
  });

  it("surfaces normalization warnings and keeps valid tokens", () => {
    const result = parseNoteTags({
      markdown: "#In!box #ok",
      frontmatterTags: []
    });

    expect(result.tags).toContain("ok");
    expect(result.warnings.some((warning) => warning.code === "tag_normalization")).toBe(true);
  });
});

describe("noteTagMatchesFilter", () => {
  it("matches parent filter against nested tags", () => {
    expect(noteTagMatchesFilter("inbox/to-read", "inbox")).toBe(true);
    expect(noteTagMatchesFilter("inbox", "inbox")).toBe(true);
    expect(noteTagMatchesFilter("other", "inbox")).toBe(false);
  });
});

describe("expandHierarchicalTagKeys", () => {
  it("expands nested keys", () => {
    expect(expandHierarchicalTagKeys("inbox/to-read")).toEqual([
      "inbox",
      "inbox/to-read"
    ]);
  });
});
