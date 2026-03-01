import path from "path";
import { parseFrontmatter } from "./frontmatter";
import { parseOutgoingNoteRefs, resolveNoteRef, normalizeTitleKey } from "./links";
import { parseTaskRefs } from "./taskRefs";
import { expandHierarchicalTagKeys, parseNoteTags } from "./tags";
import { computeContentHash } from "./storage";
import type {
  Note,
  NoteDocument,
  NoteGraphIndex,
  NotePath,
  NoteRef,
  NoteWarning,
  ParsedNote,
  TaskRef
} from "./types";

type IdentitySnapshot = {
  id?: string;
  title: string;
  aliases: string[];
};

function titleFromBody(body: string): string | null {
  const match = body.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || null;
}

function noteTitleFallback(notePath: NotePath): string {
  const filename = path.posix.basename(notePath);
  return path.posix.basename(filename, path.posix.extname(filename));
}

function mapWarning(notePath: NotePath, warning: {
  code: NoteWarning["code"];
  message: string;
  raw?: string;
  normalized?: string;
}): NoteWarning {
  return {
    notePath,
    code: warning.code,
    message: warning.message,
    ...(warning.raw ? { raw: warning.raw } : {}),
    ...(warning.normalized ? { normalized: warning.normalized } : {})
  };
}

export function parseNoteDocument(doc: NoteDocument): ParsedNote {
  const frontmatter = parseFrontmatter(doc.content);
  const parsedTags = parseNoteTags({
    markdown: frontmatter.body,
    frontmatterTags: frontmatter.frontmatter.tags
  });

  const title =
    frontmatter.frontmatter.title?.trim() ||
    titleFromBody(frontmatter.body) ||
    noteTitleFallback(doc.path);

  const warnings: NoteWarning[] = [
    ...frontmatter.warnings.map((warning) =>
      mapWarning(doc.path, {
        code: "frontmatter_parse",
        message: warning
      })
    ),
    ...parsedTags.warnings.map((warning) => mapWarning(doc.path, warning))
  ];

  const note: Note = {
    ...(frontmatter.frontmatter.id ? { id: frontmatter.frontmatter.id } : {}),
    path: doc.path,
    filename: path.posix.basename(doc.path),
    title,
    tags: parsedTags.tags,
    aliases: (frontmatter.frontmatter.aliases ?? [])
      .map((alias) => alias.trim())
      .filter((alias) => alias.length > 0),
    ...(frontmatter.frontmatter.created ? { created: frontmatter.frontmatter.created } : {}),
    ...(frontmatter.frontmatter.updated ? { updated: frontmatter.frontmatter.updated } : {}),
    mtimeMs: doc.mtimeMs
  };

  const outgoingNoteRefs = parseOutgoingNoteRefs(doc.path, frontmatter.body);
  const outgoingTaskRefs = parseTaskRefs(doc.path, frontmatter.body);

  return {
    note,
    content: frontmatter.body,
    outgoingNoteRefs,
    outgoingTaskRefs,
    rawTitle: title,
    titleKey: normalizeTitleKey(title),
    hash: computeContentHash(doc.content),
    warnings
  };
}

function createEmptyGraphIndex(): NoteGraphIndex {
  return {
    notesByPath: new Map(),
    notesById: new Map(),
    notesByTitle: new Map(),
    tagToNotes: new Map(),
    outgoingNoteRefs: new Map(),
    outgoingTaskRefs: new Map(),
    backlinks: new Map(),
    warningsByPath: new Map()
  };
}

function noteIdentity(parsed: ParsedNote | undefined): IdentitySnapshot | null {
  if (!parsed) return null;
  return {
    id: parsed.note.id,
    title: parsed.note.title,
    aliases: [...parsed.note.aliases]
  };
}

function identityChanged(previous: IdentitySnapshot | null, next: IdentitySnapshot | null): boolean {
  if (!previous && next) return true;
  if (previous && !next) return true;
  if (!previous || !next) return false;
  if ((previous.id ?? "") !== (next.id ?? "")) return true;
  if (previous.title !== next.title) return true;
  if (previous.aliases.length !== next.aliases.length) return true;
  for (let index = 0; index < previous.aliases.length; index += 1) {
    if (previous.aliases[index] !== next.aliases[index]) {
      return true;
    }
  }
  return false;
}

export class NoteGraphRuntimeIndex {
  private readonly parsedByPath = new Map<NotePath, ParsedNote>();
  private notesByPath = new Map<NotePath, Note>();
  private notesById = new Map<string, NotePath>();
  private notesByTitle = new Map<string, NotePath[]>();
  private tagToNotes = new Map<string, Set<NotePath>>();
  private outgoingNoteRefs = new Map<NotePath, NoteRef[]>();
  private outgoingTaskRefs = new Map<NotePath, TaskRef[]>();
  private backlinks = new Map<NotePath, Set<NotePath>>();
  private warningsByPath = new Map<NotePath, NoteWarning[]>();
  private lastResolvedPaths: NotePath[] = [];

  clear(): void {
    this.parsedByPath.clear();
    this.notesByPath.clear();
    this.notesById.clear();
    this.notesByTitle.clear();
    this.tagToNotes.clear();
    this.outgoingNoteRefs.clear();
    this.outgoingTaskRefs.clear();
    this.backlinks.clear();
    this.warningsByPath.clear();
    this.lastResolvedPaths = [];
  }

  listParsedNotes(): Map<NotePath, ParsedNote> {
    return new Map(this.parsedByPath);
  }

  getParsed(pathValue: NotePath): ParsedNote | undefined {
    return this.parsedByPath.get(pathValue);
  }

  upsertDocument(doc: NoteDocument): void {
    const previousParsed = this.parsedByPath.get(doc.path);
    const previousIdentity = noteIdentity(previousParsed);
    const nextParsed = parseNoteDocument(doc);
    const nextIdentity = noteIdentity(nextParsed);
    const changedIdentity = identityChanged(previousIdentity, nextIdentity);

    this.parsedByPath.set(doc.path, nextParsed);
    this.rebuildIdentityAndTagMaps();

    const pathsToResolve = changedIdentity
      ? Array.from(this.parsedByPath.keys())
      : Array.from(
          new Set<NotePath>([
            doc.path,
            ...(this.backlinks.get(doc.path) ? Array.from(this.backlinks.get(doc.path) ?? []) : [])
          ])
        );

    this.resolveRefsForPaths(pathsToResolve);
  }

  removeNote(pathValue: NotePath): void {
    const hadPath = this.parsedByPath.delete(pathValue);
    if (!hadPath) return;

    this.notesByPath.delete(pathValue);
    this.outgoingTaskRefs.delete(pathValue);
    this.outgoingNoteRefs.delete(pathValue);
    this.warningsByPath.delete(pathValue);

    this.backlinks.delete(pathValue);
    for (const backlinks of this.backlinks.values()) {
      backlinks.delete(pathValue);
    }

    this.rebuildIdentityAndTagMaps();
    this.resolveRefsForPaths(Array.from(this.parsedByPath.keys()));
  }

  private rebuildIdentityAndTagMaps(): void {
    this.notesByPath = new Map();
    this.notesById = new Map();
    this.notesByTitle = new Map();
    this.tagToNotes = new Map();

    const duplicateIdWarnings = new Map<NotePath, NoteWarning[]>();
    const duplicateTitleWarnings = new Map<NotePath, NoteWarning[]>();

    const titleToPaths = new Map<string, NotePath[]>();
    const idToPaths = new Map<string, NotePath[]>();

    for (const [pathValue, parsed] of this.parsedByPath.entries()) {
      this.notesByPath.set(pathValue, parsed.note);

      const titleKeys = new Set<string>([
        normalizeTitleKey(parsed.note.title),
        normalizeTitleKey(path.posix.basename(parsed.note.filename, ".md")),
        ...parsed.note.aliases.map((alias) => normalizeTitleKey(alias))
      ]);
      for (const key of titleKeys) {
        if (!key) continue;
        const next = this.notesByTitle.get(key) ?? [];
        next.push(pathValue);
        this.notesByTitle.set(key, next);

        const titlePaths = titleToPaths.get(key) ?? [];
        titlePaths.push(pathValue);
        titleToPaths.set(key, titlePaths);
      }

      if (parsed.note.id) {
        const id = parsed.note.id;
        const existing = idToPaths.get(id) ?? [];
        existing.push(pathValue);
        idToPaths.set(id, existing);
        if (!this.notesById.has(id)) {
          this.notesById.set(id, pathValue);
        }
      }

      for (const tag of parsed.note.tags) {
        for (const key of expandHierarchicalTagKeys(tag)) {
          const bucket = this.tagToNotes.get(key) ?? new Set<NotePath>();
          bucket.add(pathValue);
          this.tagToNotes.set(key, bucket);
        }
      }
    }

    for (const [id, paths] of idToPaths.entries()) {
      if (paths.length < 2) continue;
      for (const pathValue of paths) {
        const warnings = duplicateIdWarnings.get(pathValue) ?? [];
        warnings.push({
          notePath: pathValue,
          code: "id_duplicate",
          message: `Duplicate note id detected: ${id}`,
          raw: id
        });
        duplicateIdWarnings.set(pathValue, warnings);
      }
    }

    for (const [titleKey, paths] of titleToPaths.entries()) {
      if (paths.length < 2) continue;
      for (const pathValue of paths) {
        const warnings = duplicateTitleWarnings.get(pathValue) ?? [];
        warnings.push({
          notePath: pathValue,
          code: "title_duplicate",
          message: `Duplicate note title key detected: ${titleKey}`,
          raw: titleKey
        });
        duplicateTitleWarnings.set(pathValue, warnings);
      }
    }

    for (const [pathValue, parsed] of this.parsedByPath.entries()) {
      const mergedWarnings = [
        ...parsed.warnings,
        ...(duplicateIdWarnings.get(pathValue) ?? []),
        ...(duplicateTitleWarnings.get(pathValue) ?? [])
      ];
      this.warningsByPath.set(pathValue, mergedWarnings);
      this.outgoingTaskRefs.set(pathValue, parsed.outgoingTaskRefs.map((ref) => ({ ...ref })));
    }
  }

  private resolveRefsForPaths(paths: NotePath[]): void {
    const uniquePaths = Array.from(new Set(paths));
    this.lastResolvedPaths = uniquePaths;
    for (const pathValue of uniquePaths) {
      const parsed = this.parsedByPath.get(pathValue);
      if (!parsed) {
        continue;
      }

      const resolved = parsed.outgoingNoteRefs.map((ref) =>
        resolveNoteRef(ref, {
          fromPath: pathValue,
          notesByPath: new Map(
            Array.from(this.notesByPath.entries()).map(([pathKey, note]) => [
              pathKey,
              {
                id: note.id,
                title: note.title,
                filename: note.filename
              }
            ])
          ),
          notesById: this.notesById,
          notesByTitle: this.notesByTitle
        })
      );

      this.applyResolvedOutgoing(pathValue, resolved);
    }
  }

  getDebugLastResolvedPaths(): NotePath[] {
    return [...this.lastResolvedPaths];
  }

  private applyResolvedOutgoing(pathValue: NotePath, nextOutgoing: NoteRef[]): void {
    const previousOutgoing = this.outgoingNoteRefs.get(pathValue) ?? [];

    const previousTargets = new Set(
      previousOutgoing
        .map((ref) => ref.toResolved)
        .filter((target): target is NotePath => typeof target === "string")
    );
    const nextTargets = new Set(
      nextOutgoing
        .map((ref) => ref.toResolved)
        .filter((target): target is NotePath => typeof target === "string")
    );

    for (const target of previousTargets) {
      if (nextTargets.has(target)) continue;
      const backlinks = this.backlinks.get(target);
      if (!backlinks) continue;
      backlinks.delete(pathValue);
      if (backlinks.size === 0) {
        this.backlinks.delete(target);
      } else {
        this.backlinks.set(target, backlinks);
      }
    }

    for (const target of nextTargets) {
      const backlinks = this.backlinks.get(target) ?? new Set<NotePath>();
      backlinks.add(pathValue);
      this.backlinks.set(target, backlinks);
    }

    this.outgoingNoteRefs.set(pathValue, nextOutgoing);

    const baseWarnings = (this.warningsByPath.get(pathValue) ?? []).filter(
      (warning) => warning.code !== "link_broken" && warning.code !== "link_ambiguous"
    );

    for (const ref of nextOutgoing) {
      if (ref.ambiguous) {
        baseWarnings.push({
          notePath: pathValue,
          code: "link_ambiguous",
          message: `Ambiguous note link: ${ref.toRaw}`,
          raw: ref.toRaw
        });
      }
      if (ref.broken) {
        baseWarnings.push({
          notePath: pathValue,
          code: "link_broken",
          message: `Broken note link: ${ref.toRaw}`,
          raw: ref.toRaw
        });
      }
    }

    this.warningsByPath.set(pathValue, baseWarnings);
  }

  snapshot(): NoteGraphIndex {
    const cloneSetMap = <T>(input: Map<string, Set<T>>): Map<string, Set<T>> =>
      new Map(Array.from(input.entries()).map(([key, set]) => [key, new Set(set)]));

    return {
      notesByPath: new Map(this.notesByPath),
      notesById: new Map(this.notesById),
      notesByTitle: new Map(
        Array.from(this.notesByTitle.entries()).map(([key, paths]) => [key, [...paths]])
      ),
      tagToNotes: cloneSetMap(this.tagToNotes),
      outgoingNoteRefs: new Map(
        Array.from(this.outgoingNoteRefs.entries()).map(([pathValue, refs]) => [
          pathValue,
          refs.map((ref) => ({ ...ref }))
        ])
      ),
      outgoingTaskRefs: new Map(
        Array.from(this.outgoingTaskRefs.entries()).map(([pathValue, refs]) => [
          pathValue,
          refs.map((ref) => ({ ...ref }))
        ])
      ),
      backlinks: cloneSetMap(this.backlinks),
      warningsByPath: new Map(
        Array.from(this.warningsByPath.entries()).map(([pathValue, warnings]) => [
          pathValue,
          warnings.map((warning) => ({ ...warning }))
        ])
      )
    };
  }

  linkedNotesForTask(taskId: string): NotePath[] {
    const linked = Array.from(this.outgoingTaskRefs.entries())
      .filter(([, refs]) => refs.some((ref) => ref.taskId === taskId))
      .map(([pathValue]) => pathValue)
      .sort((left, right) => left.localeCompare(right));
    return linked;
  }

  linkedTasksForNote(notePath: NotePath): string[] {
    const refs = this.outgoingTaskRefs.get(notePath) ?? [];
    return Array.from(new Set(refs.map((ref) => ref.taskId))).sort((left, right) =>
      left.localeCompare(right)
    );
  }
}

export function buildNoteGraphIndex(documents: NoteDocument[]): NoteGraphIndex {
  const runtime = new NoteGraphRuntimeIndex();
  for (const document of documents) {
    runtime.upsertDocument(document);
  }
  return runtime.snapshot();
}
