import { describe, expect, it } from "bun:test";
import { executeNoteCommand, findNoteSearchMatches, parseNoteSearchQuery } from "./commands";
import { normalizeTitleKey } from "./links";
import type { Note, NoteGraphIndex, NoteListItem, NotePath, NoteRef, TaskRef } from "./types";
import type { NotesService } from "./service";

function createEmptyGraphIndex(): NoteGraphIndex {
  return {
    notesByPath: new Map<NotePath, Note>(),
    notesById: new Map<string, NotePath>(),
    notesByTitle: new Map<string, NotePath[]>(),
    tagToNotes: new Map<string, Set<NotePath>>(),
    outgoingNoteRefs: new Map<NotePath, NoteRef[]>(),
    outgoingTaskRefs: new Map<NotePath, TaskRef[]>(),
    backlinks: new Map<NotePath, Set<NotePath>>(),
    warningsByPath: new Map()
  };
}

function createStubService(options: {
  notes?: NoteListItem[];
  idsByPath?: Record<string, string | undefined>;
}): {
  service: NotesService;
  getCreatedCount: () => number;
  getReindexCount: () => number;
  getMigratedRoots: () => string[];
} {
  let notes = [...(options.notes ?? [])];
  let createdCount = 0;
  let reindexCount = 0;
  const migratedRoots: string[] = [];
  const idsByPath = new Map<string, string | undefined>(
    Object.entries(options.idsByPath ?? {})
  );

  const service = {
    listNotes: () => [...notes],
    getIndexSnapshot: () => {
      const index = createEmptyGraphIndex();
      for (const note of notes) {
        const id = idsByPath.get(note.path);
        index.notesByPath.set(note.path, {
          ...(id ? { id } : {}),
          path: note.path,
          filename: note.path.split("/").at(-1) ?? note.path,
          title: note.title,
          tags: [...note.tags],
          aliases: [],
          mtimeMs: note.mtimeMs
        });
        if (id) {
          index.notesById.set(id, note.path);
        }
        const key = normalizeTitleKey(note.title);
        index.notesByTitle.set(key, [...(index.notesByTitle.get(key) ?? []), note.path]);
      }
      return index;
    },
    createNote: async (title: string, content: string) => {
      createdCount += 1;
      const path = `${title}.md`;
      const createdAt = Date.now();
      notes = [{ path, title, tags: [], mtimeMs: createdAt }, ...notes];
      return {
        path,
        content,
        mtimeMs: createdAt
      };
    },
    reindexAll: async () => {
      reindexCount += 1;
    },
    migrateNotesRootCopyFirst: async (nextRoot: string) => {
      migratedRoots.push(nextRoot);
    },
    getResolvedOutgoingRefs: () => [],
    getBacklinks: () => [],
    getLinkedTasksForNote: () => []
  } as unknown as NotesService;

  return {
    service,
    getCreatedCount: () => createdCount,
    getReindexCount: () => reindexCount,
    getMigratedRoots: () => [...migratedRoots]
  };
}

describe("notes command helpers", () => {
  it("parses note search query tokens with tag filters", () => {
    expect(parseNoteSearchQuery("alpha beta tag:inbox tag:area/ops")).toEqual({
      textTerms: ["alpha", "beta"],
      tagFilters: ["inbox", "area/ops"]
    });
  });

  it("matches note search query including nested tag filters", () => {
    const notes: NoteListItem[] = [
      { path: "A.md", title: "A", tags: ["inbox/to-read"], mtimeMs: 1 },
      { path: "B.md", title: "B", tags: ["work"], mtimeMs: 1 }
    ];
    const matches = findNoteSearchMatches(notes, parseNoteSearchQuery("tag:inbox"));
    expect(matches).toEqual(["A.md"]);
  });
});

describe("executeNoteCommand", () => {
  it("creates notes via the shared notes service path", async () => {
    const { service, getCreatedCount } = createStubService({ notes: [] });
    const result = await executeNoteCommand(
      {
        type: "note",
        operation: "new",
        title: "My Note"
      },
      {
        service,
        dataFilePath: "/tmp/tadoi_data.json",
        notesSettings: { enabled: true, rootPath: null }
      }
    );

    expect(result.output.kind).toBe("ok");
    expect(result.notePath).toBe("My Note.md");
    expect(getCreatedCount()).toBe(1);
  });

  it("prefers id-based disambiguation when title queries are ambiguous", async () => {
    const { service } = createStubService({
      notes: [
        { path: "Conflicts/SameTitle1.md", title: "Same Title", tags: [], mtimeMs: 1 },
        { path: "Conflicts/SameTitle2.md", title: "Same Title", tags: [], mtimeMs: 1 }
      ],
      idsByPath: {
        "Conflicts/SameTitle2.md": "note-2"
      }
    });

    const ambiguous = await executeNoteCommand(
      {
        type: "note",
        operation: "open",
        query: "Same Title"
      },
      {
        service,
        dataFilePath: "/tmp/tadoi_data.json",
        notesSettings: { enabled: true, rootPath: null }
      }
    );
    expect(ambiguous.output.kind).toBe("error");
    expect(ambiguous.output.text).toContain("ambiguous note query");

    const byId = await executeNoteCommand(
      {
        type: "note",
        operation: "open",
        query: "id:note-2"
      },
      {
        service,
        dataFilePath: "/tmp/tadoi_data.json",
        notesSettings: { enabled: true, rootPath: null }
      }
    );
    expect(byId.output.kind).toBe("ok");
    expect(byId.notePath).toBe("Conflicts/SameTitle2.md");
  });

  it("supports note open fallback from search query filters", async () => {
    const { service } = createStubService({
      notes: [
        { path: "Notes/Inbox.md", title: "Inbox", tags: ["inbox/to-read"], mtimeMs: 1 },
        { path: "Notes/Other.md", title: "Other", tags: ["work"], mtimeMs: 1 }
      ]
    });

    const result = await executeNoteCommand(
      {
        type: "note",
        operation: "open",
        query: "tag:inbox"
      },
      {
        service,
        dataFilePath: "/tmp/tadoi_data.json",
        notesSettings: { enabled: true, rootPath: null }
      }
    );

    expect(result.output.kind).toBe("ok");
    expect(result.notePath).toBe("Notes/Inbox.md");
    expect(result.output.text).toContain("Opened note");
    expect(result.output.text).toContain("Path: Notes/Inbox.md");
  });

  it("reindexes notes through the shared service path", async () => {
    const { service, getReindexCount } = createStubService({
      notes: [{ path: "A.md", title: "A", tags: [], mtimeMs: 1 }]
    });
    const result = await executeNoteCommand(
      {
        type: "note",
        operation: "reindex"
      },
      {
        service,
        dataFilePath: "/tmp/tadoi_data.json",
        notesSettings: { enabled: true, rootPath: null }
      }
    );

    expect(result.output.kind).toBe("ok");
    expect(getReindexCount()).toBe(1);
  });

  it("applies root migration with backup + settings persistence", async () => {
    const { service, getMigratedRoots } = createStubService({
      notes: [{ path: "A.md", title: "A", tags: [], mtimeMs: 1 }]
    });
    const backups: string[] = [];
    const persisted: Array<{ enabled: boolean; rootPath: string | null }> = [];

    const result = await executeNoteCommand(
      {
        type: "note",
        operation: "root_set",
        path: "./next-notes"
      },
      {
        service,
        dataFilePath: "/tmp/tadoi_data.json",
        notesSettings: { enabled: true, rootPath: null },
        createBackup: async (dataFilePath) => {
          backups.push(dataFilePath);
        },
        persistNotesSettings: async (next) => {
          persisted.push(next);
        }
      }
    );

    expect(result.output.kind).toBe("ok");
    expect(backups).toEqual(["/tmp/tadoi_data.json"]);
    expect(getMigratedRoots()).toHaveLength(1);
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.enabled).toBe(true);
    expect(typeof persisted[0]?.rootPath).toBe("string");
  });

  it("blocks mutating note commands when notes are disabled", async () => {
    const { service, getCreatedCount } = createStubService({ notes: [] });
    const result = await executeNoteCommand(
      {
        type: "note",
        operation: "new",
        title: "Blocked"
      },
      {
        service,
        dataFilePath: "/tmp/tadoi_data.json",
        notesSettings: { enabled: false, rootPath: null }
      }
    );

    expect(result.output).toEqual({
      kind: "error",
      text: "Error: notes are disabled in settings"
    });
    expect(getCreatedCount()).toBe(0);
  });
});
