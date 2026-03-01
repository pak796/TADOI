import { describe, expect, it } from "bun:test";
import { NoteGraphRuntimeIndex } from "./index";

describe("NoteGraphRuntimeIndex", () => {
  it("builds links, backlinks, tags, and task refs", () => {
    const runtime = new NoteGraphRuntimeIndex();

    runtime.upsertDocument({
      path: "A.md",
      mtimeMs: 1,
      content: "# A\n\n[[B]]\n@task:task-1\n#inbox/to-read"
    });
    runtime.upsertDocument({
      path: "B.md",
      mtimeMs: 1,
      content: "# B\n\nHello"
    });

    const snapshot = runtime.snapshot();
    const backlinks = snapshot.backlinks.get("B.md");
    expect(backlinks ? Array.from(backlinks) : []).toEqual(["A.md"]);

    expect(runtime.linkedNotesForTask("task-1")).toEqual(["A.md"]);
    expect(runtime.linkedTasksForNote("A.md")).toEqual(["task-1"]);

    const inboxBucket = snapshot.tagToNotes.get("inbox");
    expect(inboxBucket ? Array.from(inboxBucket) : []).toContain("A.md");
  });

  it("marks unresolved links as warnings", () => {
    const runtime = new NoteGraphRuntimeIndex();
    runtime.upsertDocument({
      path: "A.md",
      mtimeMs: 1,
      content: "# A\n\n[[Missing]]"
    });

    const warnings = runtime.snapshot().warningsByPath.get("A.md") ?? [];
    expect(warnings.some((warning) => warning.code === "link_broken")).toBe(true);
  });
});
