import { describe, expect, it } from "bun:test";
import { parseFrontmatter } from "./frontmatter";

describe("parseFrontmatter", () => {
  it("parses supported fields and returns body", () => {
    const result = parseFrontmatter(`---\nid: note-1\ntitle: Inbox\ntags: [inbox, inbox/to-read]\naliases:\n  - Start\n  - Backlog\ncreated: 2026-02-20T00:00:00Z\nupdated: 2026-02-21T00:00:00Z\n---\n\n# Heading\nBody`);

    expect(result.frontmatter).toEqual({
      id: "note-1",
      title: "Inbox",
      tags: ["inbox", "inbox/to-read"],
      aliases: ["Start", "Backlog"],
      created: "2026-02-20T00:00:00Z",
      updated: "2026-02-21T00:00:00Z"
    });
    expect(result.body).toContain("# Heading");
    expect(result.warnings).toEqual([]);
  });

  it("keeps content and warns when delimiter is missing", () => {
    const input = "---\ntitle: Missing end\n";
    const result = parseFrontmatter(input);

    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe(input);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
