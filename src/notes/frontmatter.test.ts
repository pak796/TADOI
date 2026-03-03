import { describe, expect, it } from "bun:test";
import { parseFrontmatter, upsertFrontmatter, upsertFrontmatterTags } from "./frontmatter";

describe("parseFrontmatter", () => {
  it("parses supported fields and returns body", () => {
    const result = parseFrontmatter(`---\nid: note-1\ntitle: Inbox\ntags: [inbox, inbox/to-read]\naliases:\n  - Start\n  - Backlog\ncreated: 2026-02-20T00:00:00Z\nupdated: 2026-02-21T00:00:00Z\n---\n\n# Heading\nBody`);

    expect(result.frontmatter).toEqual({
      id: "note-1",
      title: "Inbox",
      tags: ["inbox", "inbox/to-read"],
      aliases: ["Start", "Backlog"],
      created: "2026-02-20T00:00:00Z",
      updated: "2026-02-21T00:00:00Z",
      extra: {}
    });
    expect(result.body).toContain("# Heading");
    expect(result.warnings).toEqual([]);
  });

  it("keeps content and warns when delimiter is missing", () => {
    const input = "---\ntitle: Missing end\n";
    const result = parseFrontmatter(input);

    expect(result.frontmatter).toEqual({ extra: {} });
    expect(result.body).toBe(input);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("parses reserved capture fields and preserves unknown keys", () => {
    const result = parseFrontmatter(`---\ntitle: Daily\nstatus: done\ncapture.source: cli\ncapture.timestamp: 2026-03-01T00:00:00Z\nx-custom: value\n---\n\nBody`);
    expect(result.frontmatter).toEqual({
      title: "Daily",
      status: "done",
      capture: {
        source: "cli",
        timestamp: "2026-03-01T00:00:00Z"
      },
      extra: {
        "x-custom": "value"
      }
    });
  });
});

describe("upsertFrontmatterTags", () => {
  it("adds frontmatter tags when the note has no frontmatter", () => {
    const content = "# Title\n\nBody";
    const updated = upsertFrontmatterTags(content, ["focus", "inbox/to-read"]);
    expect(updated).toBe("---\ntags: [focus, inbox/to-read]\n---\n\n# Title\n\nBody");
  });

  it("replaces existing tags and preserves other frontmatter fields", () => {
    const content = `---
id: note-1
title: Inbox
tags: [old]
aliases:
  - Alpha
---

# Heading
Body`;
    const updated = upsertFrontmatterTags(content, ["work", "inbox/to-read"]);
    expect(updated).toContain("id: note-1");
    expect(updated).toContain("title: Inbox");
    expect(updated).toContain("aliases:");
    expect(updated).toContain("tags: [work, inbox/to-read]");
    expect(updated).not.toContain("tags: [old]");
  });

  it("removes tags from frontmatter when an empty tag list is provided", () => {
    const content = `---
title: Inbox
tags: [focus]
---

Body`;
    const updated = upsertFrontmatterTags(content, []);
    expect(updated).toBe(`---
title: Inbox
---

Body`);
  });

  it("upserts canonical capture fields while preserving unknown keys", () => {
    const content = `---
title: Inbox
x-custom: keep
---

Body`;
    const updated = upsertFrontmatter(content, {
      captureSource: "cli",
      captureTimestamp: "2026-03-02T12:00:00Z",
      status: "open",
      metadata: {
        "x-second": "value"
      }
    });
    expect(updated).toContain("status: open");
    expect(updated).toContain("capture.source: cli");
    expect(updated).toContain("capture.timestamp: 2026-03-02T12:00:00Z");
    expect(updated).toContain("x-custom: keep");
    expect(updated).toContain("x-second: value");
  });
});
