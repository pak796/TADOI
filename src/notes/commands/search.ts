import path from "path";
import { computeNoteSearchRank } from "../index";
import { normalizeTitleKey } from "../links";
import { noteTagMatchesFilter } from "../tags";
import type { NotesService } from "../service";
import type { Note, NoteGraphIndex, NoteListItem, NotePath } from "../types";
import { candidateLabels } from "./format";
import {
  indexNotesByPath,
  type OpenResolutionResult,
  type ParsedNoteSearchQuery,
} from "./shared";

function normalizeSearchTagFilter(token: string): string | null {
  const normalized = token.slice("tag:".length).trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function nextIsoDate(isoDate: string): string | null {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number.parseInt(match[1] as string, 10);
  const month = Number.parseInt(match[2] as string, 10);
  const day = Number.parseInt(match[3] as string, 10);
  const next = new Date(year, month - 1, day + 1);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, "0");
  const d = String(next.getDate()).padStart(2, "0");
  return `${String(y)}-${m}-${d}`;
}

function parseDateWindowToken(value: string): {
  after?: string;
  before?: string;
} {
  const token = value.trim().toLowerCase();
  const now = new Date();
  const today = `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (token === "today") {
    return {
      after: today,
      before: nextIsoDate(today) ?? undefined,
    };
  }
  if (token.startsWith("created:")) {
    return parseDateWindowToken(token.slice("created:".length));
  }
  if (token.startsWith("updated:")) {
    return parseDateWindowToken(token.slice("updated:".length));
  }
  if (token.startsWith(">=")) {
    return { after: token.slice(2).trim() };
  }
  if (token.startsWith("<=")) {
    const date = token.slice(2).trim();
    return { before: nextIsoDate(date) ?? undefined };
  }
  if (token.includes("..")) {
    const [start, end] = token.split("..");
    const endNext = nextIsoDate((end ?? "").trim());
    return {
      after: (start ?? "").trim() || undefined,
      before: endNext ?? undefined,
    };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(token)) {
    return {
      after: token,
      before: nextIsoDate(token) ?? undefined,
    };
  }
  return {};
}

function parseSearchLimit(value: string): number | undefined {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return undefined;
  return parsed;
}

export function parseNoteSearchQuery(query: string): ParsedNoteSearchQuery {
  const parsed: ParsedNoteSearchQuery = {
    textTerms: [],
    titleFilters: [],
    pathFilters: [],
    tagFilters: [],
    excludedTagFilters: [],
  };

  for (const token of query
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean)) {
    const lowered = token.toLowerCase();
    if (lowered.startsWith("-tag:")) {
      const filter = normalizeSearchTagFilter(
        `tag:${token.slice("-tag:".length)}`,
      );
      if (filter) parsed.excludedTagFilters.push(filter);
      continue;
    }
    if (lowered.startsWith("tag:")) {
      const filter = normalizeSearchTagFilter(token);
      if (filter) parsed.tagFilters.push(filter);
      continue;
    }
    if (lowered.startsWith("title:")) {
      const value = token.slice("title:".length).trim().toLowerCase();
      if (value) parsed.titleFilters.push(value);
      continue;
    }
    if (lowered.startsWith("path:")) {
      const value = token.slice("path:".length).trim().toLowerCase();
      if (value) parsed.pathFilters.push(value);
      continue;
    }
    if (lowered.startsWith("text:")) {
      const value = token.slice("text:".length).trim().toLowerCase();
      if (value) parsed.textTerms.push(value);
      continue;
    }
    if (lowered.startsWith("created:")) {
      const window = parseDateWindowToken(token.slice("created:".length));
      if (window.after) parsed.createdAfter = window.after;
      if (window.before) parsed.createdBefore = window.before;
      continue;
    }
    if (lowered.startsWith("updated:")) {
      const window = parseDateWindowToken(token.slice("updated:".length));
      if (window.after) parsed.updatedAfter = window.after;
      if (window.before) parsed.updatedBefore = window.before;
      continue;
    }
    if (lowered.startsWith("limit:")) {
      const limit = parseSearchLimit(token.slice("limit:".length).trim());
      if (limit !== undefined) {
        parsed.limit = limit;
      }
      continue;
    }
    if (lowered.startsWith("format:")) {
      const format = token.slice("format:".length).trim().toLowerCase();
      if (format === "text" || format === "json") {
        parsed.format = format;
      }
      continue;
    }
    parsed.textTerms.push(token.toLowerCase());
  }

  return parsed;
}

export function resolveOpenQuery(
  noteList: NoteListItem[],
  snapshot: NoteGraphIndex,
  query: string,
): OpenResolutionResult {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      ok: false,
      text: 'Error: note open requires a query (example: note open "Query")',
    };
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
  const exactPath = noteList.find(
    (note) => note.path.toLowerCase() === lowered,
  );
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
        snapshot,
      )}\nUse id:<note-id> to disambiguate.`,
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
        snapshot,
      )}\nRefine query or open by explicit path/id.`,
    };
  }

  return { ok: false, text: `Error: note not found for query "${trimmed}"` };
}

function parseIsoDate(value: string | undefined): number | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Date.parse(`${value}T00:00:00`);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveTemporalValueMs(
  note: Note,
  field: "created" | "updated",
): number {
  const fromFrontmatter = parseIsoDate(note[field]);
  return fromFrontmatter ?? note.mtimeMs;
}

function matchesDateWindow(
  valueMs: number,
  after?: string,
  before?: string,
): boolean {
  const afterMs = parseIsoDate(after);
  const beforeMs = parseIsoDate(before);
  if (afterMs !== null && valueMs < afterMs) return false;
  if (beforeMs !== null && valueMs >= beforeMs) return false;
  return true;
}

function matchesSearchQuery(
  note: NoteListItem,
  graphNote: Note | undefined,
  query: ParsedNoteSearchQuery,
  bodyContent: string,
): boolean {
  const lowerTitle = note.title.toLowerCase();
  const lowerPath = note.path.toLowerCase();
  const lowerAliases = (graphNote?.aliases ?? []).map((alias) =>
    alias.toLowerCase(),
  );
  const lowerBody = bodyContent.toLowerCase();

  const textMatch =
    query.textTerms.length === 0 ||
    query.textTerms.every((term) => {
      const loweredTerm = term.toLowerCase();
      return (
        lowerTitle.includes(loweredTerm) ||
        lowerPath.includes(loweredTerm) ||
        lowerAliases.some((alias) => alias.includes(loweredTerm)) ||
        lowerBody.includes(loweredTerm)
      );
    });
  if (!textMatch) return false;

  const titleMatch =
    query.titleFilters.length === 0 ||
    query.titleFilters.every(
      (term) =>
        lowerTitle.includes(term) ||
        lowerAliases.some((alias) => alias.includes(term)),
    );
  if (!titleMatch) return false;

  const pathMatch =
    query.pathFilters.length === 0 ||
    query.pathFilters.every((term) => lowerPath.includes(term));
  if (!pathMatch) return false;

  const tagValues = (graphNote?.tags ?? note.tags).map((tag) =>
    tag.toLowerCase(),
  );
  const tagMatch =
    query.tagFilters.length === 0 ||
    query.tagFilters.every((filter) =>
      tagValues.some((tag) => noteTagMatchesFilter(tag, filter)),
    );
  if (!tagMatch) return false;

  const excludedTagMatch =
    query.excludedTagFilters.length === 0 ||
    query.excludedTagFilters.every((filter) =>
      tagValues.every((tag) => !noteTagMatchesFilter(tag, filter)),
    );
  if (!excludedTagMatch) return false;

  const temporalSource = graphNote ?? {
    id: undefined,
    path: note.path,
    filename: path.posix.basename(note.path),
    title: note.title,
    tags: note.tags,
    aliases: [],
    mtimeMs: note.mtimeMs,
  };
  const createdMatch = matchesDateWindow(
    resolveTemporalValueMs(temporalSource as Note, "created"),
    query.createdAfter,
    query.createdBefore,
  );
  if (!createdMatch) return false;

  const updatedMatch = matchesDateWindow(
    resolveTemporalValueMs(temporalSource as Note, "updated"),
    query.updatedAfter,
    query.updatedBefore,
  );
  return updatedMatch;
}

export function findNoteSearchMatches(
  notes: NoteListItem[],
  query: ParsedNoteSearchQuery,
  options: { snapshot?: NoteGraphIndex; service?: NotesService } = {},
): NotePath[] {
  const snapshot = options.snapshot;
  const service = options.service;
  const ranked = notes
    .map((note) => {
      const graphNote = snapshot?.notesByPath.get(note.path);
      const parsedNote = service?.getParsedNote(note.path);
      const body = parsedNote?.content ?? "";
      if (!matchesSearchQuery(note, graphNote, query, body)) {
        return null;
      }
      const noteForRank: Note = graphNote ?? {
        id: undefined,
        path: note.path,
        filename: path.posix.basename(note.path),
        title: note.title,
        tags: note.tags,
        aliases: [],
        mtimeMs: note.mtimeMs,
      };
      const score = computeNoteSearchRank(noteForRank, body, {
        textTerms: query.textTerms,
        titleTerms: query.titleFilters,
        pathTerms: query.pathFilters,
        tagTerms: query.tagFilters,
      });
      return {
        path: note.path,
        score,
        mtimeMs: note.mtimeMs,
      };
    })
    .filter(
      (entry): entry is { path: NotePath; score: number; mtimeMs: number } =>
        Boolean(entry),
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.mtimeMs - left.mtimeMs ||
        left.path.localeCompare(right.path),
    );

  const rankedPaths = ranked.map((entry) => entry.path);
  if (query.limit !== undefined) {
    return rankedPaths.slice(0, query.limit);
  }
  return rankedPaths;
}
