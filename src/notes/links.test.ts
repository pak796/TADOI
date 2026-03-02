import { describe, expect, it } from "bun:test";
import {
  normalizeTitleKey,
  parseOutgoingNoteRefs,
  resolveNoteRef
} from "./links";

describe("parseOutgoingNoteRefs", () => {
  it("parses wikilinks and markdown links", () => {
    const refs = parseOutgoingNoteRefs(
      "A.md",
      "[[Note B|B]] and [B path](./B.md) and ![img](a.png) and [[task:abc-123]] and [task](tadoi://task/abc-123)"
    );

    expect(refs).toEqual([
      {
        from: "A.md",
        kind: "wikilink",
        toRaw: "Note B",
        display: "B"
      },
      {
        from: "A.md",
        kind: "mdlink",
        toRaw: "./B.md",
        display: "B path"
      }
    ]);
  });
});

describe("resolveNoteRef", () => {
  it("resolves by title and path and flags unresolved", () => {
    const notesByPath = new Map([
      ["B.md", { title: "Note B", filename: "B.md", id: "note-b" }],
      ["sub/C.md", { title: "Note C", filename: "C.md", id: undefined }]
    ]);
    const notesById = new Map([["note-b", "B.md"]]);
    const notesByTitle = new Map([
      [normalizeTitleKey("Note B"), ["B.md"]],
      [normalizeTitleKey("Note C"), ["sub/C.md"]]
    ]);

    const byTitle = resolveNoteRef(
      { from: "A.md", kind: "wikilink", toRaw: "Note B" },
      { fromPath: "A.md", notesByPath, notesById, notesByTitle }
    );
    expect(byTitle.toResolved).toBe("B.md");

    const byPath = resolveNoteRef(
      { from: "A.md", kind: "mdlink", toRaw: "./sub/C.md" },
      { fromPath: "A.md", notesByPath, notesById, notesByTitle }
    );
    expect(byPath.toResolved).toBe("sub/C.md");

    const missing = resolveNoteRef(
      { from: "A.md", kind: "wikilink", toRaw: "Missing" },
      { fromPath: "A.md", notesByPath, notesById, notesByTitle }
    );
    expect(missing.broken).toBe(true);
  });
});
