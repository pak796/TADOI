import path from "path";
import {
  computeContentHash,
  copyNotesRoot,
  createNoteFile,
  ensureNotesRoot,
  readNoteDocument,
  resolveNotesRootPath,
  scanMarkdownFiles,
  statNoteFile,
  writeNoteDocumentAtomic
} from "./storage";
import { NoteGraphRuntimeIndex } from "./index";
import { findUnlinkedMentions, type NoteMention } from "./mentions";
import type {
  NoteDocument,
  NoteGraphIndex,
  NoteListItem,
  NotePath,
  ParsedNote,
  NoteRef,
  NoteWarning
} from "./types";

export type NotesServiceStatus = {
  ready: boolean;
  enabled: boolean;
  notesRoot: string;
  error?: string;
};

export type NotesServiceOptions = {
  dataFilePath: string;
  rootPath: string | null | undefined;
  enabled?: boolean;
};

type NoteCacheEntry = {
  mtimeMs: number;
  content: string;
  hash: string;
};

export type NotesServiceInstrumentation = {
  fullReindexCount: number;
  refreshCount: number;
  upsertCount: number;
  skippedByMtimeCount: number;
  skippedByHashCount: number;
  lastUpsertPath?: NotePath;
  lastResolvedPaths: NotePath[];
};

export class NotesService {
  private readonly dataFilePath: string;
  private notesRoot: string;
  private enabled: boolean;
  private runtime = new NoteGraphRuntimeIndex();
  private cacheByPath = new Map<NotePath, NoteCacheEntry>();
  private initialized = false;
  private instrumentation: NotesServiceInstrumentation = {
    fullReindexCount: 0,
    refreshCount: 0,
    upsertCount: 0,
    skippedByMtimeCount: 0,
    skippedByHashCount: 0,
    lastResolvedPaths: []
  };

  constructor(options: NotesServiceOptions) {
    this.dataFilePath = options.dataFilePath;
    this.notesRoot = resolveNotesRootPath(options.dataFilePath, options.rootPath);
    this.enabled = options.enabled !== false;
  }

  getStatus(): NotesServiceStatus {
    return {
      ready: this.initialized,
      enabled: this.enabled,
      notesRoot: this.notesRoot
    };
  }

  async initialize(): Promise<void> {
    if (!this.enabled) {
      this.initialized = true;
      return;
    }
    await ensureNotesRoot(this.notesRoot);
    await this.reindexAll();
  }

  async setEnabled(enabled: boolean): Promise<void> {
    this.enabled = enabled;
    if (!enabled) {
      this.runtime.clear();
      this.cacheByPath.clear();
      this.initialized = true;
      return;
    }
    await this.initialize();
  }

  getNotesRoot(): string {
    return this.notesRoot;
  }

  getInstrumentation(): NotesServiceInstrumentation {
    return {
      ...this.instrumentation,
      lastResolvedPaths: [...this.instrumentation.lastResolvedPaths]
    };
  }

  async setNotesRoot(rootPath: string | null | undefined): Promise<void> {
    this.notesRoot = resolveNotesRootPath(this.dataFilePath, rootPath);
    if (!this.enabled) {
      this.initialized = true;
      return;
    }
    await ensureNotesRoot(this.notesRoot);
    await this.reindexAll();
  }

  async migrateNotesRootCopyFirst(nextRootPath: string): Promise<void> {
    const nextRoot = resolveNotesRootPath(this.dataFilePath, nextRootPath);
    await ensureNotesRoot(nextRoot);
    await copyNotesRoot({
      sourceRoot: this.notesRoot,
      destinationRoot: nextRoot
    });
    this.notesRoot = nextRoot;
    await this.reindexAll();
  }

  private async loadDocument(notePath: NotePath): Promise<NoteDocument> {
    return readNoteDocument(this.notesRoot, notePath);
  }

  async reindexAll(): Promise<void> {
    if (!this.enabled) {
      this.runtime.clear();
      this.cacheByPath.clear();
      this.initialized = true;
      return;
    }

    const files = await scanMarkdownFiles(this.notesRoot);
    this.instrumentation.fullReindexCount += 1;
    this.runtime.clear();
    this.cacheByPath.clear();

    for (const file of files) {
      const document = await this.loadDocument(file.path);
      this.runtime.upsertDocument(document);
      this.recordUpsert(file.path);
      this.cacheByPath.set(file.path, {
        mtimeMs: document.mtimeMs,
        content: document.content,
        hash: computeContentHash(document.content)
      });
    }

    this.initialized = true;
  }

  async refreshChanged(): Promise<void> {
    if (!this.enabled) return;
    this.instrumentation.refreshCount += 1;

    const scanned = await scanMarkdownFiles(this.notesRoot);
    const scannedMap = new Map(scanned.map((item) => [item.path, item]));

    for (const pathValue of Array.from(this.cacheByPath.keys())) {
      if (scannedMap.has(pathValue)) continue;
      this.cacheByPath.delete(pathValue);
      this.runtime.removeNote(pathValue);
    }

    for (const file of scanned) {
      const cached = this.cacheByPath.get(file.path);
      if (cached && cached.mtimeMs === file.mtimeMs) {
        this.instrumentation.skippedByMtimeCount += 1;
        continue;
      }
      const document = await this.loadDocument(file.path);
      const hash = computeContentHash(document.content);
      if (cached && cached.hash === hash) {
        this.instrumentation.skippedByHashCount += 1;
        this.cacheByPath.set(file.path, {
          mtimeMs: document.mtimeMs,
          content: document.content,
          hash
        });
        continue;
      }
      this.runtime.upsertDocument(document);
      this.recordUpsert(file.path);
      this.cacheByPath.set(file.path, {
        mtimeMs: document.mtimeMs,
        content: document.content,
        hash
      });
    }
  }

  listNotes(): NoteListItem[] {
    const snapshot = this.runtime.snapshot();
    return Array.from(snapshot.notesByPath.values())
      .map((note) => ({
        path: note.path,
        title: note.title,
        mtimeMs: note.mtimeMs,
        tags: [...note.tags]
      }))
      .sort((left, right) => right.mtimeMs - left.mtimeMs || left.path.localeCompare(right.path));
  }

  async getNoteContent(notePath: NotePath): Promise<NoteDocument | null> {
    if (!this.enabled) return null;

    const mtime = await statNoteFile({ notesRoot: this.notesRoot, notePath });
    if (mtime === null) {
      return null;
    }

    const cached = this.cacheByPath.get(notePath);
    if (cached && cached.mtimeMs === mtime) {
      return {
        path: notePath,
        content: cached.content,
        mtimeMs: cached.mtimeMs
      };
    }

    const document = await this.loadDocument(notePath);
    const hash = computeContentHash(document.content);
    if (!cached || cached.hash !== hash) {
      this.runtime.upsertDocument(document);
      this.recordUpsert(notePath);
    } else {
      this.instrumentation.skippedByHashCount += 1;
    }
    this.cacheByPath.set(notePath, {
      mtimeMs: document.mtimeMs,
      content: document.content,
      hash
    });
    return document;
  }

  async createNote(title: string, initialContent = ""): Promise<NoteDocument> {
    const created = await createNoteFile({
      notesRoot: this.notesRoot,
      title,
      initialContent
    });
    this.runtime.upsertDocument(created);
    this.recordUpsert(created.path);
    this.cacheByPath.set(created.path, {
      mtimeMs: created.mtimeMs,
      content: created.content,
      hash: computeContentHash(created.content)
    });
    return created;
  }

  async saveNote(notePath: NotePath, content: string): Promise<NoteDocument> {
    await writeNoteDocumentAtomic({
      notesRoot: this.notesRoot,
      notePath,
      content
    });
    const saved = await this.loadDocument(notePath);
    this.runtime.upsertDocument(saved);
    this.recordUpsert(notePath);
    this.cacheByPath.set(notePath, {
      mtimeMs: saved.mtimeMs,
      content: saved.content,
      hash: computeContentHash(saved.content)
    });
    return saved;
  }

  getIndexSnapshot(): NoteGraphIndex {
    return this.runtime.snapshot();
  }

  getParsedNote(pathValue: NotePath): ParsedNote | undefined {
    return this.runtime.getParsed(pathValue);
  }

  getResolvedOutgoingRefs(pathValue: NotePath): NoteRef[] {
    const refs = this.runtime.snapshot().outgoingNoteRefs.get(pathValue) ?? [];
    return refs.map((ref) => ({ ...ref }));
  }

  getBacklinks(pathValue: NotePath): NotePath[] {
    const backlinks = this.runtime.snapshot().backlinks.get(pathValue) ?? new Set<NotePath>();
    return Array.from(backlinks).sort((left, right) => left.localeCompare(right));
  }

  getWarnings(pathValue: NotePath): NoteWarning[] {
    const warnings = this.runtime.snapshot().warningsByPath.get(pathValue) ?? [];
    return warnings.map((warning) => ({ ...warning }));
  }

  getLinkedNotesForTask(taskId: string): NotePath[] {
    return this.runtime.linkedNotesForTask(taskId);
  }

  getLinkedTasksForNote(notePath: NotePath): string[] {
    return this.runtime.linkedTasksForNote(notePath);
  }

  getUnlinkedMentions(notePath: NotePath): NoteMention[] {
    const parsed = this.runtime.getParsed(notePath);
    if (!parsed) return [];
    return findUnlinkedMentions({
      targetPath: notePath,
      targetTitle: parsed.note.title,
      targetAliases: parsed.note.aliases,
      notes: this.runtime.listParsedNotes(),
      excludeCodeFences: true,
      hideWhenLinked: false
    });
  }

  private recordUpsert(pathValue: NotePath): void {
    this.instrumentation.upsertCount += 1;
    this.instrumentation.lastUpsertPath = pathValue;
    this.instrumentation.lastResolvedPaths = this.runtime.getDebugLastResolvedPaths();
  }
}

export function createNotesService(options: NotesServiceOptions): NotesService {
  return new NotesService(options);
}

export function deriveDefaultNoteTitleFromTaskTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : "Untitled task note";
}

export function buildTaskSeededNoteContent(taskId: string, taskTitle: string): string {
  const safeTitle = taskTitle.trim() || "Task note";
  return `# ${safeTitle}\n\nLinked task: @task:${taskId}\n`;
}

export function isPathWithin(rootPath: string, candidatePath: string): boolean {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedCandidate = path.resolve(candidatePath);
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
