import { describe, expect, it } from "bun:test";
import { executeNoteCommand, findNoteSearchMatches, parseNoteSearchQuery } from "./commands";
import { normalizeTitleKey } from "./links";
import type {
  Note,
  NoteGraphIndex,
  NoteListItem,
  NotePath,
  NoteRef,
  ParsedNote,
  TaskRef
} from "./types";
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
  aliasesByPath?: Record<string, string[]>;
  parsedContentByPath?: Record<string, string>;
  templatesByPath?: Record<string, string>;
  outgoingByPath?: Record<string, string[]>;
  backlinksByPath?: Record<string, string[]>;
}): {
  service: NotesService;
  getCreatedContentByPath: (notePath: string) => string | undefined;
  getReindexCount: () => number;
  getMigratedRoots: () => string[];
} {
  let notes = [...(options.notes ?? [])];
  let reindexCount = 0;
  const migratedRoots: string[] = [];
  const idsByPath = new Map<string, string | undefined>(
    Object.entries(options.idsByPath ?? {})
  );
  const aliasesByPath = new Map<string, string[]>(
    Object.entries(options.aliasesByPath ?? {})
  );
  const parsedContentByPath = new Map<string, string>(
    Object.entries(options.parsedContentByPath ?? {})
  );
  const templatesByPath = new Map<string, string>(
    Object.entries(options.templatesByPath ?? {})
  );
  const createdContentByPath = new Map<string, string>();
  const outgoingByPath = new Map<string, string[]>(
    Object.entries(options.outgoingByPath ?? {})
  );
  const backlinksByPath = new Map<string, string[]>(
    Object.entries(options.backlinksByPath ?? {})
  );

  const service = {
    listNotes: () => [...notes],
    getIndexSnapshot: () => {
      const index = createEmptyGraphIndex();
      for (const note of notes) {
        const id = idsByPath.get(note.path);
        const aliases = aliasesByPath.get(note.path) ?? [];
        index.notesByPath.set(note.path, {
          ...(id ? { id } : {}),
          path: note.path,
          filename: note.path.split("/").at(-1) ?? note.path,
          title: note.title,
          tags: [...note.tags],
          aliases: [...aliases],
          mtimeMs: note.mtimeMs
        });
        if (id) {
          index.notesById.set(id, note.path);
        }
        const keys = new Set([normalizeTitleKey(note.title), ...aliases.map((alias) => normalizeTitleKey(alias))]);
        for (const key of keys) {
          index.notesByTitle.set(key, [...(index.notesByTitle.get(key) ?? []), note.path]);
        }
      }
      return index;
    },
    getParsedNote: (notePath: string): ParsedNote | undefined => {
      const note = notes.find((item) => item.path === notePath);
      if (!note) return undefined;
      const id = idsByPath.get(note.path);
      const aliases = aliasesByPath.get(note.path) ?? [];
      const parsed = {
        note: {
          ...(id ? { id } : {}),
          path: note.path,
          filename: note.path.split("/").at(-1) ?? note.path,
          title: note.title,
          tags: note.tags,
          aliases,
          mtimeMs: note.mtimeMs
        },
        content: parsedContentByPath.get(note.path) ?? "",
        outgoingNoteRefs: [],
        outgoingTaskRefs: [],
        rawTitle: note.title,
        titleKey: normalizeTitleKey(note.title),
        hash: "",
        warnings: []
      };
      return parsed as ParsedNote;
    },
    getNoteContent: async (notePath: string) => {
      const content = templatesByPath.get(notePath);
      if (!content) return null;
      return {
        path: notePath,
        content,
        mtimeMs: Date.now()
      };
    },
    createNote: async (title: string, content: string) => {
      const path = `${title}.md`;
      const createdAt = Date.now();
      notes = [{ path, title, tags: [], mtimeMs: createdAt }, ...notes];
      createdContentByPath.set(path, content);
      return {
        path,
        content,
        mtimeMs: createdAt
      };
    },
    reindexAll: async () => {
      reindexCount += 1;
    },
    deleteNote: async (notePath: string) => {
      const before = notes.length;
      notes = notes.filter((note) => note.path !== notePath);
      return notes.length < before;
    },
    restoreDefaultGuideDocs: async () => ({
      mode: "restore_missing" as const,
      createdPaths: [] as string[],
      skippedPaths: [] as string[]
    }),
    migrateNotesRootCopyFirst: async (nextRoot: string) => {
      migratedRoots.push(nextRoot);
    },
    getResolvedOutgoingRefs: (notePath: string) =>
      (outgoingByPath.get(notePath) ?? []).map((toResolved) => ({
        from: notePath,
        toRaw: toResolved,
        toResolved,
        kind: "wikilink" as const
      })),
    getBacklinks: (notePath: string) => backlinksByPath.get(notePath) ?? [],
    getLinkedTasksForNote: () => []
  } as unknown as NotesService;

  return {
    service,
    getCreatedContentByPath: (notePath: string) => createdContentByPath.get(notePath),
    getReindexCount: () => reindexCount,
    getMigratedRoots: () => [...migratedRoots]
  };
}

describe("notes command helpers", () => {
  it("parses note search filters", () => {
    const now = new Date();
    const today = `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const tomorrowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const tomorrow = `${String(tomorrowDate.getFullYear())}-${String(tomorrowDate.getMonth() + 1).padStart(2, "0")}-${String(tomorrowDate.getDate()).padStart(2, "0")}`;
    expect(parseNoteSearchQuery("tag:work title:retro -tag:closed created:today limit:20")).toEqual({
      textTerms: [],
      titleFilters: ["retro"],
      pathFilters: [],
      tagFilters: ["work"],
      excludedTagFilters: ["closed"],
      createdAfter: today,
      createdBefore: tomorrow,
      limit: 20
    });
  });

  it("returns ranked note search matches with limit", () => {
    const notes: NoteListItem[] = [
      { path: "Retro Meeting.md", title: "Retro Meeting", tags: ["work"], mtimeMs: 10 },
      { path: "Retro Notes.md", title: "Retro Notes", tags: ["work"], mtimeMs: 20 },
      { path: "Other.md", title: "Other", tags: ["home"], mtimeMs: 30 }
    ];
    const matches = findNoteSearchMatches(
      notes,
      {
        textTerms: [],
        titleFilters: ["retro"],
        pathFilters: [],
        tagFilters: ["work"],
        excludedTagFilters: [],
        limit: 1
      },
      {}
    );
    expect(matches).toHaveLength(1);
  });
});

describe("executeNoteCommand", () => {
  it("captures quick notes with metadata and selected-task linking", async () => {
    const { service, getCreatedContentByPath } = createStubService({ notes: [] });
    const result = await executeNoteCommand(
      {
        type: "note",
        operation: "quick",
        title: "Daily",
        body: "Body line",
        tags: ["work"],
        aliases: ["d1"],
        status: "done",
        metadata: { source: "cli", "x-custom": "1" },
        target: { type: "selected" }
      },
      {
        service,
        dataFilePath: "/tmp/tadoi_data.json",
        notesSettings: { enabled: true, rootPath: null },
        selectedTaskId: "task-1",
        captureSource: "tits"
      }
    );

    expect(result.output.kind).toBe("ok");
    expect(result.path).toBe("Daily.md");
    const created = getCreatedContentByPath("Daily.md") ?? "";
    expect(created).toContain("status: done");
    expect(created).toContain("capture.source: cli");
    expect(created).toContain("x-custom: 1");
    expect(created).toContain("Linked task: @task:task-1");
  });

  it("supports template fallback behavior for note new --template", async () => {
    const { service } = createStubService({ notes: [] });
    const result = await executeNoteCommand(
      {
        type: "note",
        operation: "new",
        title: "With Template",
        template: "meeting"
      },
      {
        service,
        dataFilePath: "/tmp/tadoi_data.json",
        notesSettings: { enabled: true, rootPath: null }
      }
    );

    expect(result.output.kind).toBe("ok");
    expect(result.output.text).toContain("template \"meeting\" not found");
  });

  it("executes graph/links discoverability queries", async () => {
    const { service } = createStubService({
      notes: [
        { path: "A.md", title: "A", tags: [], mtimeMs: 1 },
        { path: "B.md", title: "B", tags: [], mtimeMs: 1 },
        { path: "C.md", title: "C", tags: [], mtimeMs: 1 }
      ],
      outgoingByPath: {
        "A.md": ["B.md"]
      },
      backlinksByPath: {
        "A.md": ["C.md"]
      }
    });

    const result = await executeNoteCommand(
      {
        type: "note",
        operation: "graph",
        query: "A",
        direction: "both"
      },
      {
        service,
        dataFilePath: "/tmp/tadoi_data.json",
        notesSettings: { enabled: true, rootPath: null }
      }
    );

    expect(result.output.kind).toBe("ok");
    expect(result.output.text).toContain("Outgoing (1)");
    expect(result.output.text).toContain("Incoming (1)");
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
  });

  it("blocks mutating note commands when notes are disabled", async () => {
    const { service } = createStubService({ notes: [] });
    const result = await executeNoteCommand(
      {
        type: "note",
        operation: "quick",
        title: "Blocked",
        tags: [],
        aliases: [],
        metadata: {}
      },
      {
        service,
        dataFilePath: "/tmp/tadoi_data.json",
        notesSettings: { enabled: false, rootPath: null }
      }
    );

    expect(result.output).toEqual({
      kind: "error",
      text: "Error: TOME is disabled in settings"
    });
  });
});
