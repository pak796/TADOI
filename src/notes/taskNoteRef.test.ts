import { describe, expect, it } from "bun:test";
import { createTaskNoteRefFromNote, resolveTaskNoteRef } from "./taskNoteRef";
import type { Note, NoteGraphIndex, NotePath, NoteRef, TaskRef } from "./types";

function createEmptyGraphIndex(): NoteGraphIndex {
  return {
    notesByPath: new Map<NotePath, Note>(),
    notesById: new Map<string, NotePath>(),
    notesByTitle: new Map<string, NotePath[]>(),
    tagToNotes: new Map<string, Set<NotePath>>(),
    outgoingNoteRefs: new Map<NotePath, NoteRef[]>(),
    outgoingTaskRefs: new Map<NotePath, TaskRef[]>(),
    backlinks: new Map<NotePath, Set<NotePath>>(),
    warningsByPath: new Map(),
  };
}

describe("resolveTaskNoteRef", () => {
  it("resolves id references before filenames", () => {
    const snapshot = createEmptyGraphIndex();
    snapshot.notesByPath.set("Tasks/One.md", {
      id: "note-1",
      path: "Tasks/One.md",
      filename: "One.md",
      title: "One",
      tags: [],
      aliases: [],
      mtimeMs: 1,
    });
    snapshot.notesById.set("note-1", "Tasks/One.md");

    const result = resolveTaskNoteRef(
      {
        type: "id",
        value: "note-1",
      },
      snapshot,
    );
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.notePath).toBe("Tasks/One.md");
    }
  });

  it("detects ambiguous filename references", () => {
    const snapshot = createEmptyGraphIndex();
    snapshot.notesByPath.set("A/One.md", {
      path: "A/One.md",
      filename: "One.md",
      title: "One A",
      tags: [],
      aliases: [],
      mtimeMs: 1,
    });
    snapshot.notesByPath.set("B/One.md", {
      path: "B/One.md",
      filename: "One.md",
      title: "One B",
      tags: [],
      aliases: [],
      mtimeMs: 1,
    });

    const result = resolveTaskNoteRef(
      {
        type: "filename",
        value: "One.md",
      },
      snapshot,
    );
    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") {
      expect(result.candidates).toEqual(["A/One.md", "B/One.md"]);
    }
  });

  it("resolves exact filename references when unique", () => {
    const snapshot = createEmptyGraphIndex();
    snapshot.notesByPath.set("A/One.md", {
      path: "A/One.md",
      filename: "One.md",
      title: "One A",
      tags: [],
      aliases: [],
      mtimeMs: 1,
    });

    const result = resolveTaskNoteRef(
      {
        type: "filename",
        value: "One.md",
      },
      snapshot,
    );
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.notePath).toBe("A/One.md");
    }
  });

  it("returns missing state for unresolved id references", () => {
    const snapshot = createEmptyGraphIndex();
    const result = resolveTaskNoteRef(
      {
        type: "id",
        value: "missing-id",
      },
      snapshot,
    );
    expect(result.status).toBe("missing");
    if (result.status === "missing") {
      expect(result.message).toContain("missing-id");
    }
  });
});

describe("createTaskNoteRefFromNote", () => {
  it("prefers id when available", () => {
    expect(
      createTaskNoteRefFromNote({
        id: "note-123",
        filename: "Any.md",
      }),
    ).toEqual({
      type: "id",
      value: "note-123",
    });
  });

  it("falls back to filename", () => {
    expect(
      createTaskNoteRefFromNote({
        filename: "Any.md",
      }),
    ).toEqual({
      type: "filename",
      value: "Any.md",
    });
  });
});
