import path from "path";
import {
  computeContentHash,
  copyNotesRoot,
  createNoteFile,
  deleteNoteFile,
  ensureNotesRoot,
  hasDefaultGuideSeedMarker,
  readNoteDocument,
  renameNoteFile,
  resolveNotesRootPath,
  scanMarkdownFiles,
  statNoteFile,
  writeDefaultGuideSeedMarker,
  writeNoteDocumentAtomic,
} from "./storage";
import { NoteGraphRuntimeIndex } from "./index";
import { findUnlinkedMentions, type NoteMention } from "./mentions";
import { DEFAULT_TOME_GUIDE_DOCS } from "./defaultDocs";
import { watchMarkdownTree } from "./watch";
import type {
  NoteDocument,
  NoteGraphIndex,
  NoteListItem,
  NotePath,
  ParsedNote,
  NoteRef,
  NoteWarning,
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

export type RestoreDefaultGuideDocsMode = "seed_if_empty" | "restore_missing";

export type RestoreDefaultGuideDocsResult = {
  mode: RestoreDefaultGuideDocsMode;
  createdPaths: NotePath[];
  skippedPaths: NotePath[];
  skippedReason?: "disabled" | "non_empty" | "already_seeded";
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

export type NotesAutoRefreshOptions = {
  onRefreshed?: () => void | Promise<void>;
  onError?: (error: unknown) => void;
  pollingFallbackIntervalMs?: number;
  watchDebounceMs?: number;
};

const DEFAULT_NOTES_POLLING_FALLBACK_INTERVAL_MS = 15_000;

export class NotesService {
  private readonly dataFilePath: string;
  private notesRoot: string;
  private enabled: boolean;
  private runtime = new NoteGraphRuntimeIndex();
  private cacheByPath = new Map<NotePath, NoteCacheEntry>();
  private initialized = false;
  private autoRefreshStop: (() => void) | null = null;
  private autoRefreshInFlight = false;
  private autoRefreshPending = false;
  private instrumentation: NotesServiceInstrumentation = {
    fullReindexCount: 0,
    refreshCount: 0,
    upsertCount: 0,
    skippedByMtimeCount: 0,
    skippedByHashCount: 0,
    lastResolvedPaths: [],
  };

  constructor(options: NotesServiceOptions) {
    this.dataFilePath = options.dataFilePath;
    this.notesRoot = resolveNotesRootPath(
      options.dataFilePath,
      options.rootPath,
    );
    this.enabled = options.enabled !== false;
  }

  getStatus(): NotesServiceStatus {
    return {
      ready: this.initialized,
      enabled: this.enabled,
      notesRoot: this.notesRoot,
    };
  }

  async initialize(): Promise<void> {
    if (!this.enabled) {
      this.stopAutoRefresh();
      this.initialized = true;
      return;
    }
    await ensureNotesRoot(this.notesRoot);
    await this.reindexAll();
  }

  async setEnabled(enabled: boolean): Promise<void> {
    this.enabled = enabled;
    if (!enabled) {
      this.stopAutoRefresh();
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
      lastResolvedPaths: [...this.instrumentation.lastResolvedPaths],
    };
  }

  async setNotesRoot(rootPath: string | null | undefined): Promise<void> {
    this.stopAutoRefresh();
    this.notesRoot = resolveNotesRootPath(this.dataFilePath, rootPath);
    if (!this.enabled) {
      this.initialized = true;
      return;
    }
    await ensureNotesRoot(this.notesRoot);
    await this.reindexAll();
  }

  async migrateNotesRootCopyFirst(nextRootPath: string): Promise<void> {
    this.stopAutoRefresh();
    const nextRoot = resolveNotesRootPath(this.dataFilePath, nextRootPath);
    await ensureNotesRoot(nextRoot);
    await copyNotesRoot({
      sourceRoot: this.notesRoot,
      destinationRoot: nextRoot,
    });
    this.notesRoot = nextRoot;
    await this.reindexAll();
  }

  private async loadDocument(notePath: NotePath): Promise<NoteDocument> {
    return readNoteDocument(this.notesRoot, notePath);
  }

  private cacheDocument(document: NoteDocument): void {
    this.cacheByPath.set(document.path, {
      mtimeMs: document.mtimeMs,
      content: document.content,
      hash: computeContentHash(document.content),
    });
  }

  private upsertDocument(document: NoteDocument): void {
    this.runtime.upsertDocument(document);
    this.recordUpsert(document.path);
    this.cacheDocument(document);
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
      this.upsertDocument(document);
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
        this.cacheDocument(document);
        continue;
      }
      this.upsertDocument(document);
    }
  }

  stopAutoRefresh(): void {
    if (this.autoRefreshStop) {
      this.autoRefreshStop();
      this.autoRefreshStop = null;
    }
    this.autoRefreshInFlight = false;
    this.autoRefreshPending = false;
  }

  private async runAutoRefreshCycle(
    options: Pick<NotesAutoRefreshOptions, "onRefreshed" | "onError">,
  ): Promise<void> {
    if (!this.enabled) return;
    if (this.autoRefreshInFlight) {
      this.autoRefreshPending = true;
      return;
    }

    this.autoRefreshInFlight = true;
    try {
      do {
        this.autoRefreshPending = false;
        await this.refreshChanged();
        await options.onRefreshed?.();
      } while (this.autoRefreshPending);
    } catch (error: unknown) {
      options.onError?.(error);
    } finally {
      this.autoRefreshInFlight = false;
    }
  }

  async startAutoRefresh(options: NotesAutoRefreshOptions = {}): Promise<void> {
    this.stopAutoRefresh();
    if (!this.enabled) return;

    const pollingFallbackIntervalMs =
      typeof options.pollingFallbackIntervalMs === "number" &&
      Number.isFinite(options.pollingFallbackIntervalMs) &&
      options.pollingFallbackIntervalMs > 0
        ? Math.floor(options.pollingFallbackIntervalMs)
        : DEFAULT_NOTES_POLLING_FALLBACK_INTERVAL_MS;

    const triggerRefresh = () => {
      void this.runAutoRefreshCycle({
        onRefreshed: options.onRefreshed,
        onError: options.onError,
      });
    };

    const watcher = await watchMarkdownTree({
      rootPath: this.notesRoot,
      onChange: triggerRefresh,
      onError: options.onError,
      debounceMs: options.watchDebounceMs,
    });

    let pollTimer: ReturnType<typeof setInterval> | undefined;
    if (!watcher.active) {
      pollTimer = setInterval(triggerRefresh, pollingFallbackIntervalMs);
      pollTimer.unref?.();
    }

    this.autoRefreshStop = () => {
      watcher.close();
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = undefined;
      }
    };

    await this.runAutoRefreshCycle({
      onRefreshed: options.onRefreshed,
      onError: options.onError,
    });
  }

  listNotes(): NoteListItem[] {
    const snapshot = this.runtime.snapshot();
    return Array.from(snapshot.notesByPath.values())
      .map((note) => ({
        path: note.path,
        title: note.title,
        mtimeMs: note.mtimeMs,
        tags: [...note.tags],
      }))
      .sort(
        (left, right) =>
          right.mtimeMs - left.mtimeMs || left.path.localeCompare(right.path),
      );
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
        mtimeMs: cached.mtimeMs,
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
    this.cacheDocument(document);
    return document;
  }

  async createNote(title: string, initialContent = ""): Promise<NoteDocument> {
    const created = await createNoteFile({
      notesRoot: this.notesRoot,
      title,
      initialContent,
    });
    this.upsertDocument(created);
    return created;
  }

  async saveNote(notePath: NotePath, content: string): Promise<NoteDocument> {
    await writeNoteDocumentAtomic({
      notesRoot: this.notesRoot,
      notePath,
      content,
    });
    const saved = await this.loadDocument(notePath);
    this.upsertDocument(saved);
    return saved;
  }

  async renameNote(
    notePath: NotePath,
    title: string,
  ): Promise<NoteDocument | null> {
    if (!this.enabled) return null;
    const nextPath = await renameNoteFile({
      notesRoot: this.notesRoot,
      notePath,
      title,
    });
    if (nextPath !== notePath) {
      this.cacheByPath.delete(notePath);
      this.runtime.removeNote(notePath);
    }
    const renamed = await this.loadDocument(nextPath);
    this.upsertDocument(renamed);
    return renamed;
  }

  async deleteNote(notePath: NotePath): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      await deleteNoteFile({
        notesRoot: this.notesRoot,
        notePath,
      });
    } catch (error: unknown) {
      const maybeErrno = error as NodeJS.ErrnoException;
      if (maybeErrno?.code === "ENOENT") {
        return false;
      }
      throw error;
    }
    this.cacheByPath.delete(notePath);
    this.runtime.removeNote(notePath);
    return true;
  }

  async seedDefaultGuideDocsIfEmpty(): Promise<RestoreDefaultGuideDocsResult> {
    if (!this.enabled) {
      return {
        mode: "seed_if_empty",
        createdPaths: [],
        skippedPaths: [],
        skippedReason: "disabled",
      };
    }

    if (await hasDefaultGuideSeedMarker(this.notesRoot)) {
      return {
        mode: "seed_if_empty",
        createdPaths: [],
        skippedPaths: [],
        skippedReason: "already_seeded",
      };
    }

    const files = await scanMarkdownFiles(this.notesRoot);
    if (files.length > 0) {
      await writeDefaultGuideSeedMarker(this.notesRoot);
      return {
        mode: "seed_if_empty",
        createdPaths: [],
        skippedPaths: [],
        skippedReason: "non_empty",
      };
    }

    const result = await this.restoreDefaultGuideDocs("seed_if_empty");
    await writeDefaultGuideSeedMarker(this.notesRoot);
    return result;
  }

  async restoreDefaultGuideDocs(
    mode: RestoreDefaultGuideDocsMode = "restore_missing",
  ): Promise<RestoreDefaultGuideDocsResult> {
    if (!this.enabled) {
      return {
        mode,
        createdPaths: [],
        skippedPaths: [],
        skippedReason: "disabled",
      };
    }

    const existing = new Set(
      (await scanMarkdownFiles(this.notesRoot)).map((item) => item.path),
    );
    const createdPaths: NotePath[] = [];
    const skippedPaths: NotePath[] = [];

    for (const doc of DEFAULT_TOME_GUIDE_DOCS) {
      if (existing.has(doc.path)) {
        skippedPaths.push(doc.path);
        continue;
      }
      await writeNoteDocumentAtomic({
        notesRoot: this.notesRoot,
        notePath: doc.path,
        content: doc.content,
      });
      const created = await this.loadDocument(doc.path);
      this.upsertDocument(created);
      createdPaths.push(doc.path);
      existing.add(doc.path);
    }

    if (createdPaths.length > 0) {
      await writeDefaultGuideSeedMarker(this.notesRoot);
    }

    return {
      mode,
      createdPaths,
      skippedPaths,
    };
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
    const backlinks =
      this.runtime.snapshot().backlinks.get(pathValue) ?? new Set<NotePath>();
    return Array.from(backlinks).sort((left, right) =>
      left.localeCompare(right),
    );
  }

  getWarnings(pathValue: NotePath): NoteWarning[] {
    const warnings =
      this.runtime.snapshot().warningsByPath.get(pathValue) ?? [];
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
      hideWhenLinked: false,
    });
  }

  private recordUpsert(pathValue: NotePath): void {
    this.instrumentation.upsertCount += 1;
    this.instrumentation.lastUpsertPath = pathValue;
    this.instrumentation.lastResolvedPaths =
      this.runtime.getDebugLastResolvedPaths();
  }
}

export function createNotesService(options: NotesServiceOptions): NotesService {
  return new NotesService(options);
}

export function deriveDefaultNoteTitleFromTaskTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : "Untitled task note";
}

export function buildTaskSeededNoteContent(
  taskId: string,
  taskTitle: string,
): string {
  const safeTitle = taskTitle.trim() || "Task note";
  return `# ${safeTitle}\n\nLinked task: @task:${taskId}\n`;
}

export function isPathWithin(rootPath: string, candidatePath: string): boolean {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedCandidate = path.resolve(candidatePath);
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}
