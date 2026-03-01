import path from "path";
import { getHelpLine } from "../commands/help";
import type { CommandOutput, NoteCommand } from "../commands/types";
import type { NotesSettings } from "../settings/settings";
import { normalizeTitleKey } from "./links";
import type { NotesService } from "./service";
import { resolveNotesRootPath } from "./storage";
import { noteTagMatchesFilter } from "./tags";
import type { NoteGraphIndex, NoteListItem, NotePath } from "./types";

export type ParsedNoteSearchQuery = {
  textTerms: string[];
  tagFilters: string[];
};

export type ExecuteNoteCommandContext = {
  service: NotesService;
  dataFilePath: string;
  notesSettings: NotesSettings;
  createBackup?: (dataFilePath: string) => Promise<unknown>;
  persistNotesSettings?: (next: NotesSettings) => Promise<void> | void;
};

export type ExecuteNoteCommandResult = {
  output: CommandOutput;
  notePath?: NotePath;
  notesRoot?: string;
  matches?: NotePath[];
};

type OpenResolutionResult =
  | { ok: true; path: NotePath; matchKind: "id" | "path" | "title" | "fuzzy" }
  | { ok: false; text: string };

function ok(text: string, extras: Omit<ExecuteNoteCommandResult, "output"> = {}): ExecuteNoteCommandResult {
  return {
    output: {
      kind: "ok",
      text
    },
    ...extras
  };
}

function error(text: string): ExecuteNoteCommandResult {
  return {
    output: {
      kind: "error",
      text
    }
  };
}

function normalizeSearchTagFilter(token: string): string | null {
  const normalized = token.slice("tag:".length).trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function indexNotesByPath(noteList: NoteListItem[]): Map<NotePath, NoteListItem> {
  return new Map(noteList.map((note) => [note.path, note]));
}

export function parseNoteSearchQuery(query: string): ParsedNoteSearchQuery {
  const textTerms: string[] = [];
  const tagFilters: string[] = [];

  for (const token of query.split(/\s+/).map((value) => value.trim()).filter(Boolean)) {
    if (token.toLowerCase().startsWith("tag:")) {
      const filter = normalizeSearchTagFilter(token);
      if (filter) {
        tagFilters.push(filter);
      }
      continue;
    }
    textTerms.push(token.toLowerCase());
  }

  return {
    textTerms,
    tagFilters
  };
}

function candidateLabels(
  paths: NotePath[],
  noteLookup: Map<NotePath, NoteListItem>,
  snapshot: NoteGraphIndex,
  options: { max?: number } = {}
): string {
  const max = options.max ?? 8;
  const preview = paths.slice(0, max);
  const lines = preview.map((pathValue, index) => {
    const listNote = noteLookup.get(pathValue);
    const graphNote = snapshot.notesByPath.get(pathValue);
    const title =
      listNote?.title ?? graphNote?.title ?? path.posix.basename(pathValue, ".md");
    const idToken = graphNote?.id ? ` [id:${graphNote.id}]` : "";
    return `${String(index + 1)}. ${title} (${pathValue})${idToken}`;
  });
  if (paths.length > max) {
    lines.push(`... +${String(paths.length - max)} more`);
  }
  return lines.join("\n");
}

function resolveOpenQuery(
  noteList: NoteListItem[],
  snapshot: NoteGraphIndex,
  query: string
): OpenResolutionResult {
  const trimmed = query.trim();
  if (!trimmed) {
    return { ok: false, text: 'Error: note open requires a query (example: note open "Query")' };
  }

  const noteLookup = indexNotesByPath(noteList);
  if (trimmed.toLowerCase().startsWith("id:")) {
    const noteId = trimmed.slice(3).trim();
    if (!noteId) {
      return { ok: false, text: "Error: note open id target is empty" };
    }
    const resolvedById = snapshot.notesById.get(noteId);
    if (!resolvedById) {
      return { ok: false, text: `Error: note id not found (${noteId})` };
    }
    return { ok: true, path: resolvedById, matchKind: "id" };
  }

  const lowered = trimmed.toLowerCase();
  const exactPath = noteList.find((note) => note.path.toLowerCase() === lowered);
  if (exactPath) {
    return { ok: true, path: exactPath.path, matchKind: "path" };
  }

  const stemmedQuery = normalizeTitleKey(trimmed.replace(/\.md$/i, ""));
  const titleMatches = snapshot.notesByTitle.get(stemmedQuery) ?? [];
  if (titleMatches.length === 1) {
    return { ok: true, path: titleMatches[0], matchKind: "title" };
  }
  if (titleMatches.length > 1) {
    return {
      ok: false,
      text: `Error: ambiguous note query "${trimmed}". Candidates:\n${candidateLabels(
        titleMatches,
        noteLookup,
        snapshot
      )}\nUse id:<note-id> to disambiguate.`
    };
  }

  const fuzzyMatches = noteList
    .map((note) => {
      const noteTitle = note.title.toLowerCase();
      const notePath = note.path.toLowerCase();
      let score = Number.POSITIVE_INFINITY;
      if (noteTitle.startsWith(lowered)) {
        score = Math.min(score, 0);
      } else if (noteTitle.includes(lowered)) {
        score = Math.min(score, 1);
      }
      if (notePath.startsWith(lowered)) {
        score = Math.min(score, 2);
      } else if (notePath.includes(lowered)) {
        score = Math.min(score, 3);
      }
      return { note, score };
    })
    .filter((candidate) => Number.isFinite(candidate.score))
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }
      return (
        left.note.title.localeCompare(right.note.title) ||
        left.note.path.localeCompare(right.note.path)
      );
    })
    .map((candidate) => candidate.note.path);
  if (fuzzyMatches.length === 1) {
    return { ok: true, path: fuzzyMatches[0], matchKind: "fuzzy" };
  }
  if (fuzzyMatches.length > 1) {
    return {
      ok: false,
      text: `Error: ambiguous note query "${trimmed}". Candidates:\n${candidateLabels(
        fuzzyMatches,
        noteLookup,
        snapshot
      )}\nRefine query or open by explicit path/id.`
    };
  }

  return { ok: false, text: `Error: note not found for query "${trimmed}"` };
}

function formatNoteSummaryLine(
  pathValue: NotePath,
  noteLookup: Map<NotePath, NoteListItem>,
  snapshot: NoteGraphIndex
): string {
  const listNote = noteLookup.get(pathValue);
  const graphNote = snapshot.notesByPath.get(pathValue);
  const title =
    listNote?.title ?? graphNote?.title ?? path.posix.basename(pathValue, ".md");
  const idToken = graphNote?.id ? ` [id:${graphNote.id}]` : "";
  const tags = listNote?.tags ?? graphNote?.tags ?? [];
  const tagsToken =
    tags.length > 0
      ? ` [tags:${tags.slice(0, 3).join(",")}${tags.length > 3 ? ",..." : ""}]`
      : "";
  return `${title} (${pathValue})${idToken}${tagsToken}`;
}

function formatOpenResultText(options: {
  resolvedPath: NotePath;
  matchKind: "id" | "path" | "title" | "fuzzy";
  noteLookup: Map<NotePath, NoteListItem>;
  snapshot: NoteGraphIndex;
  service: NotesService;
}): string {
  const { resolvedPath, matchKind, noteLookup, snapshot, service } = options;
  const noteMeta = snapshot.notesByPath.get(resolvedPath);
  const title =
    noteLookup.get(resolvedPath)?.title ??
    noteMeta?.title ??
    path.posix.basename(resolvedPath, ".md");
  const outRefs = service.getResolvedOutgoingRefs(resolvedPath);
  const resolvedOutCount = outRefs.filter((ref) => Boolean(ref.toResolved)).length;
  const brokenOutCount = outRefs.filter((ref) => !ref.toResolved).length;
  const backlinks = service.getBacklinks(resolvedPath);
  const backlinksCount = backlinks.length;
  const linkedTasks = service.getLinkedTasksForNote(resolvedPath);
  const linkedTasksCount = linkedTasks.length;
  const aliases = noteMeta?.aliases ?? [];
  const tags = noteLookup.get(resolvedPath)?.tags ?? noteMeta?.tags ?? [];
  const resolvedOutTargets = outRefs
    .map((ref) => ref.toResolved)
    .filter((pathValue): pathValue is NotePath => Boolean(pathValue));

  const lines: string[] = [
    `Opened note (${matchKind}): ${title}`,
    `Path: ${resolvedPath}`
  ];
  if (noteMeta?.id) {
    lines.push(`ID: ${noteMeta.id}`);
  }
  if (aliases.length > 0) {
    lines.push(`Aliases: ${aliases.slice(0, 4).join(", ")}${aliases.length > 4 ? ", ..." : ""}`);
  }
  if (tags.length > 0) {
    lines.push(`Tags: ${tags.join(", ")}`);
  }
  lines.push(
    `Graph: out=${String(resolvedOutCount)} back=${String(backlinksCount)} tasks=${String(linkedTasksCount)} broken=${String(brokenOutCount)}`
  );
  if (resolvedOutTargets.length > 0) {
    const preview = resolvedOutTargets
      .slice(0, 3)
      .map((pathValue) => formatNoteSummaryLine(pathValue, noteLookup, snapshot));
    lines.push(`Outgoing links: ${preview.join(" | ")}${resolvedOutTargets.length > 3 ? " | ..." : ""}`);
  }
  if (backlinks.length > 0) {
    const preview = backlinks
      .slice(0, 3)
      .map((pathValue) => formatNoteSummaryLine(pathValue, noteLookup, snapshot));
    lines.push(`Backlinks: ${preview.join(" | ")}${backlinks.length > 3 ? " | ..." : ""}`);
  }
  if (linkedTasks.length > 0) {
    lines.push(
      `Linked tasks: ${linkedTasks.slice(0, 5).join(", ")}${linkedTasks.length > 5 ? ", ..." : ""}`
    );
  }
  if (brokenOutCount > 0) {
    lines.push("Broken links present. Use NOTES_VIEW warnings for details.");
  }
  return lines.join("\n");
}

function formatOpenFallbackAmbiguousText(options: {
  query: string;
  matches: NotePath[];
  noteLookup: Map<NotePath, NoteListItem>;
  snapshot: NoteGraphIndex;
}): string {
  return `Error: note open query "${options.query}" matched multiple notes.\n${candidateLabels(
    options.matches,
    options.noteLookup,
    options.snapshot
  )}\nUse an exact title/path or id:<note-id>.`;
}

function formatSearchResultText(options: {
  rawQuery: string;
  matches: NotePath[];
  noteLookup: Map<NotePath, NoteListItem>;
  snapshot: NoteGraphIndex;
}): string {
  const { rawQuery, matches, noteLookup, snapshot } = options;
  const lines = [`Notes search matches (${String(matches.length)}) for "${rawQuery}":`];
  const previewLimit = 8;
  const preview = matches.slice(0, previewLimit);
  for (let index = 0; index < preview.length; index += 1) {
    const pathValue = preview[index];
    lines.push(`${String(index + 1)}. ${formatNoteSummaryLine(pathValue, noteLookup, snapshot)}`);
  }
  if (matches.length > previewLimit) {
    lines.push(`... +${String(matches.length - previewLimit)} more`);
  }
  return lines.join("\n");
}

function matchesSearchQuery(note: NoteListItem, query: ParsedNoteSearchQuery): boolean {
  const textMatch =
    query.textTerms.length === 0 ||
    query.textTerms.every((term) => {
      const loweredTerm = term.toLowerCase();
      return (
        note.title.toLowerCase().includes(loweredTerm) ||
        note.path.toLowerCase().includes(loweredTerm)
      );
    });
  if (!textMatch) {
    return false;
  }

  if (query.tagFilters.length === 0) {
    return true;
  }

  return query.tagFilters.every((filter) =>
    note.tags.some((tag) => noteTagMatchesFilter(tag, filter))
  );
}

export function findNoteSearchMatches(
  notes: NoteListItem[],
  query: ParsedNoteSearchQuery
): NotePath[] {
  return notes.filter((note) => matchesSearchQuery(note, query)).map((note) => note.path);
}

export async function executeNoteCommand(
  command: NoteCommand,
  context: ExecuteNoteCommandContext
): Promise<ExecuteNoteCommandResult> {
  if (command.operation === "help") {
    return ok(getHelpLine("note"));
  }

  if (!context.notesSettings.enabled && command.operation !== "root_set") {
    return error("Error: notes are disabled in settings");
  }

  if (command.operation === "new") {
    const title = command.title.trim();
    if (!title) {
      return error('Error: note new requires a title (example: note new "Title")');
    }
    const seededContent = `# ${title}\n\n`;
    const created = await context.service.createNote(title, seededContent);
    return ok(`Note created: ${created.path}`, { notePath: created.path });
  }

  if (command.operation === "open") {
    const notes = context.service.listNotes();
    const snapshot = context.service.getIndexSnapshot();
    const noteLookup = indexNotesByPath(notes);
    const resolved = resolveOpenQuery(notes, snapshot, command.query);
    if (!resolved.ok) {
      const parsedQuery = parseNoteSearchQuery(command.query);
      const searchMatches = findNoteSearchMatches(notes, parsedQuery);
      if (resolved.text.startsWith("Error: note not found") && searchMatches.length === 1) {
        const [matchedPath] = searchMatches;
        return ok(
          formatOpenResultText({
            resolvedPath: matchedPath,
            matchKind: "fuzzy",
            noteLookup,
            snapshot,
            service: context.service
          }),
          { notePath: matchedPath }
        );
      }
      if (resolved.text.startsWith("Error: note not found") && searchMatches.length > 1) {
        return error(
          formatOpenFallbackAmbiguousText({
            query: command.query,
            matches: searchMatches,
            noteLookup,
            snapshot
          })
        );
      }
      return error(resolved.text);
    }

    return ok(
      formatOpenResultText({
        resolvedPath: resolved.path,
        matchKind: resolved.matchKind,
        noteLookup,
        snapshot,
        service: context.service
      }),
      { notePath: resolved.path }
    );
  }

  if (command.operation === "search") {
    const rawQuery = command.query.trim();
    if (!rawQuery) {
      return error('Error: note search requires a query (example: note search "Term")');
    }
    const notes = context.service.listNotes();
    const snapshot = context.service.getIndexSnapshot();
    const noteLookup = indexNotesByPath(notes);
    const parsedQuery = parseNoteSearchQuery(rawQuery);
    const matches = findNoteSearchMatches(notes, parsedQuery);
    if (matches.length === 0) {
      return ok(`No notes match "${rawQuery}"`, { matches: [] });
    }
    return ok(
      formatSearchResultText({
        rawQuery,
        matches,
        noteLookup,
        snapshot
      }),
      { matches }
    );
  }

  if (command.operation === "reindex") {
    await context.service.reindexAll();
    const total = context.service.listNotes().length;
    return ok(`Notes reindex complete (${String(total)} notes)`);
  }

  if (!context.createBackup || !context.persistNotesSettings) {
    return error("Error: note root set is not available in this context");
  }

  const inputPath = command.path.trim();
  if (!inputPath) {
    return error('Error: note root set requires a path (example: note root set "/path/to/notes")');
  }

  const nextRoot = resolveNotesRootPath(context.dataFilePath, inputPath);
  await context.createBackup(context.dataFilePath);
  await context.service.migrateNotesRootCopyFirst(nextRoot);
  const nextSettings: NotesSettings = {
    enabled: context.notesSettings.enabled,
    rootPath: nextRoot
  };
  await context.persistNotesSettings(nextSettings);
  return ok(`Notes root migrated to ${nextRoot}`, { notesRoot: nextRoot });
}
