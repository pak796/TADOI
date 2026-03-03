import path from "path";
import { getHelpLine } from "../commands/help";
import type {
  CommandOutput,
  NoteCommand,
  NoteLinkDirection,
  NoteSearchFilters
} from "../commands/types";
import type { NotesSettings } from "../settings/settings";
import { computeNoteSearchRank } from "./index";
import { normalizeTitleKey } from "./links";
import { upsertFrontmatter } from "./frontmatter";
import type { NotesService } from "./service";
import { resolveNotesRootPath } from "./storage";
import { noteTagMatchesFilter } from "./tags";
import type { Note, NoteGraphIndex, NoteListItem, NotePath } from "./types";

const TEMPLATE_DIR = "Templates";

export type ParsedNoteSearchQuery = NoteSearchFilters;

export type ExecuteNoteCommandContext = {
  service: NotesService;
  dataFilePath: string;
  notesSettings: NotesSettings;
  selectedTaskId?: string;
  captureSource?: string;
  createBackup?: (dataFilePath: string) => Promise<unknown>;
  persistNotesSettings?: (next: NotesSettings) => Promise<void> | void;
};

export type ExecuteNoteCommandResult = {
  output: CommandOutput;
  notePath?: NotePath;
  noteId?: string;
  path?: NotePath;
  title?: string;
  capturedAt?: string;
  notesRoot?: string;
  matches?: NotePath[];
  data?: unknown;
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

function parseDateWindowToken(value: string): { after?: string; before?: string } {
  const token = value.trim().toLowerCase();
  const now = new Date();
  const today = `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (token === "today") {
    return {
      after: today,
      before: nextIsoDate(today) ?? undefined
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
      before: endNext ?? undefined
    };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(token)) {
    return {
      after: token,
      before: nextIsoDate(token) ?? undefined
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
    excludedTagFilters: []
  };

  for (const token of query.split(/\s+/).map((value) => value.trim()).filter(Boolean)) {
    const lowered = token.toLowerCase();
    if (lowered.startsWith("-tag:")) {
      const filter = normalizeSearchTagFilter(`tag:${token.slice("-tag:".length)}`);
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
    lines.push("Broken links present. Use TOME view warnings for details.");
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
  limit?: number;
}): string {
  const { rawQuery, matches, noteLookup, snapshot, limit } = options;
  const previewLimit = limit ?? 8;
  const lines = [`TOME search matches (${String(matches.length)}) for "${rawQuery}":`];
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

function parseIsoDate(value: string | undefined): number | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Date.parse(`${value}T00:00:00`);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveTemporalValueMs(note: Note, field: "created" | "updated"): number {
  const fromFrontmatter = parseIsoDate(note[field]);
  return fromFrontmatter ?? note.mtimeMs;
}

function matchesDateWindow(valueMs: number, after?: string, before?: string): boolean {
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
  bodyContent: string
): boolean {
  const lowerTitle = note.title.toLowerCase();
  const lowerPath = note.path.toLowerCase();
  const lowerAliases = (graphNote?.aliases ?? []).map((alias) => alias.toLowerCase());
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
    query.titleFilters.every((term) =>
      lowerTitle.includes(term) || lowerAliases.some((alias) => alias.includes(term))
    );
  if (!titleMatch) return false;

  const pathMatch =
    query.pathFilters.length === 0 ||
    query.pathFilters.every((term) => lowerPath.includes(term));
  if (!pathMatch) return false;

  const tagValues = (graphNote?.tags ?? note.tags).map((tag) => tag.toLowerCase());
  const tagMatch =
    query.tagFilters.length === 0 ||
    query.tagFilters.every((filter) =>
      tagValues.some((tag) => noteTagMatchesFilter(tag, filter))
    );
  if (!tagMatch) return false;

  const excludedTagMatch =
    query.excludedTagFilters.length === 0 ||
    query.excludedTagFilters.every((filter) =>
      tagValues.every((tag) => !noteTagMatchesFilter(tag, filter))
    );
  if (!excludedTagMatch) return false;

  const temporalSource = graphNote ?? {
    id: undefined,
    path: note.path,
    filename: path.posix.basename(note.path),
    title: note.title,
    tags: note.tags,
    aliases: [],
    mtimeMs: note.mtimeMs
  };
  const createdMatch = matchesDateWindow(
    resolveTemporalValueMs(temporalSource as Note, "created"),
    query.createdAfter,
    query.createdBefore
  );
  if (!createdMatch) return false;

  const updatedMatch = matchesDateWindow(
    resolveTemporalValueMs(temporalSource as Note, "updated"),
    query.updatedAfter,
    query.updatedBefore
  );
  return updatedMatch;
}

export function findNoteSearchMatches(
  notes: NoteListItem[],
  query: ParsedNoteSearchQuery,
  options: { snapshot?: NoteGraphIndex; service?: NotesService } = {}
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
        mtimeMs: note.mtimeMs
      };
      const score = computeNoteSearchRank(noteForRank, body, {
        textTerms: query.textTerms,
        titleTerms: query.titleFilters,
        pathTerms: query.pathFilters,
        tagTerms: query.tagFilters
      });
      return {
        path: note.path,
        score,
        mtimeMs: note.mtimeMs
      };
    })
    .filter((entry): entry is { path: NotePath; score: number; mtimeMs: number } => Boolean(entry))
    .sort((left, right) =>
      right.score - left.score ||
      right.mtimeMs - left.mtimeMs ||
      left.path.localeCompare(right.path)
    );

  const rankedPaths = ranked.map((entry) => entry.path);
  if (query.limit !== undefined) {
    return rankedPaths.slice(0, query.limit);
  }
  return rankedPaths;
}

function normalizeTemplatePath(templateId: string): NotePath[] {
  const trimmed = templateId.trim().replace(/\\/g, "/");
  const withExt = trimmed.toLowerCase().endsWith(".md") ? trimmed : `${trimmed}.md`;
  const templatesPath = `${TEMPLATE_DIR}/${withExt}`.replace(/\/+/g, "/");
  return Array.from(new Set([withExt, templatesPath]));
}

async function resolveTemplateContent(
  service: NotesService,
  templateId: string
): Promise<{ path: NotePath; content: string } | null> {
  const candidates = normalizeTemplatePath(templateId);
  for (const candidate of candidates) {
    const document = await service.getNoteContent(candidate);
    if (document) {
      return { path: candidate, content: document.content };
    }
  }
  return null;
}

function withTitleSeed(content: string, title: string): string {
  const replaced = content.replace(/\{\{\s*title\s*\}\}/gi, title);
  if (/^#\s+/m.test(replaced)) {
    return replaced;
  }
  const body = replaced.trim();
  if (!body) {
    return `# ${title}\n\n`;
  }
  return `# ${title}\n\n${body}\n`;
}

function formatGraphText(options: {
  query: string;
  notePath: NotePath;
  direction: NoteLinkDirection;
  outgoing: NotePath[];
  incoming: NotePath[];
  noteLookup: Map<NotePath, NoteListItem>;
  snapshot: NoteGraphIndex;
}): string {
  const lines: string[] = [
    `TOME graph for "${options.query}" (${options.direction})`,
    `Path: ${options.notePath}`
  ];
  if (options.direction === "outgoing" || options.direction === "both") {
    lines.push(`Outgoing (${String(options.outgoing.length)}):`);
    if (options.outgoing.length === 0) {
      lines.push("- (none)");
    } else {
      for (const pathValue of options.outgoing) {
        lines.push(`- ${formatNoteSummaryLine(pathValue, options.noteLookup, options.snapshot)}`);
      }
    }
  }
  if (options.direction === "incoming" || options.direction === "both") {
    lines.push(`Incoming (${String(options.incoming.length)}):`);
    if (options.incoming.length === 0) {
      lines.push("- (none)");
    } else {
      for (const pathValue of options.incoming) {
        lines.push(`- ${formatNoteSummaryLine(pathValue, options.noteLookup, options.snapshot)}`);
      }
    }
  }
  return lines.join("\n");
}

function resolveLinkTargetTaskId(
  command: Extract<NoteCommand, { operation: "quick" }>,
  context: ExecuteNoteCommandContext
): string | undefined {
  if (!command.target) return undefined;
  if (command.target.type === "id") return command.target.id;
  return context.selectedTaskId;
}

export async function executeNoteCommand(
  command: NoteCommand,
  context: ExecuteNoteCommandContext
): Promise<ExecuteNoteCommandResult> {
  if (command.operation === "help") {
    return ok(getHelpLine("note"), {
      data: {
        operation: "help"
      }
    });
  }

  if (!context.notesSettings.enabled && command.operation !== "root_set") {
    return error("Error: TOME is disabled in settings");
  }

  if (command.operation === "new" || command.operation === "template") {
    const templateId = command.operation === "template" ? command.template : command.template;
    const title =
      command.operation === "template"
        ? command.title?.trim() || `${command.template}-${new Date().toISOString().slice(0, 10)}`
        : command.title.trim();
    if (!title) {
      return error('Error: note new requires a title (example: note new "Title")');
    }

    const templateContent = templateId
      ? await resolveTemplateContent(context.service, templateId)
      : null;
    const seededContent = templateContent
      ? withTitleSeed(templateContent.content, title)
      : `# ${title}\n\n`;
    const content = upsertFrontmatter(seededContent, { title });
    const created = await context.service.createNote(title, content);
    const note = context.service.getParsedNote(created.path)?.note;
    const templateSuffix =
      templateId && !templateContent
        ? ` (template "${templateId}" not found; used default seed)`
        : templateContent
          ? ` (template: ${templateContent.path})`
          : "";
    return ok(`Note created: ${created.path}${templateSuffix}`, {
      notePath: created.path,
      noteId: note?.id,
      path: created.path,
      title,
      data: {
        operation: command.operation,
        noteId: note?.id,
        path: created.path,
        title
      }
    });
  }

  if (command.operation === "quick") {
    const title = command.title.trim();
    if (!title) {
      return error('Error: note quick requires a title (example: note q "Title" "Body")');
    }

    const capturedAt = new Date().toISOString();
    const templateContent = command.template
      ? await resolveTemplateContent(context.service, command.template)
      : null;
    let seededContent = templateContent
      ? withTitleSeed(templateContent.content, title)
      : `# ${title}\n\n`;
    const body = (command.body ?? command.stdinBody ?? "").trim();
    if (body.length > 0) {
      seededContent = `${seededContent.trimEnd()}\n\n${body}\n`;
    }

    const linkedTaskId = resolveLinkTargetTaskId(command, context);
    if (linkedTaskId) {
      seededContent = `${seededContent.trimEnd()}\n\nLinked task: @task:${linkedTaskId}\n`;
    }

    const metadata = { ...command.metadata };
    const captureSource =
      metadata["capture.source"] ??
      metadata.source ??
      context.captureSource ??
      "quick";
    const captureTimestamp = metadata["capture.timestamp"] ?? capturedAt;
    delete metadata["capture.source"];
    delete metadata["capture.timestamp"];
    delete metadata.source;

    const content = upsertFrontmatter(seededContent, {
      title,
      tags: command.tags,
      aliases: command.aliases,
      status: command.status,
      captureSource,
      captureTimestamp,
      metadata
    });
    const created = await context.service.createNote(title, content);
    const note = context.service.getParsedNote(created.path)?.note;
    const createdPayload = {
      noteId: note?.id,
      path: created.path,
      title,
      capturedAt,
      linkedTaskId,
      template: templateContent?.path ?? null
    };
    return ok(`Quick note captured: ${created.path}`, {
      notePath: created.path,
      noteId: note?.id,
      path: created.path,
      title,
      capturedAt,
      data: {
        operation: "quick",
        ...createdPayload
      }
    });
  }

  if (command.operation === "open") {
    const notes = context.service.listNotes();
    const snapshot = context.service.getIndexSnapshot();
    const noteLookup = indexNotesByPath(notes);
    const resolved = resolveOpenQuery(notes, snapshot, command.query);
    if (!resolved.ok) {
      const parsedQuery = parseNoteSearchQuery(command.query);
      const searchMatches = findNoteSearchMatches(notes, parsedQuery, {
        snapshot,
        service: context.service
      });
      if (resolved.text.startsWith("Error: note not found") && searchMatches.length === 1) {
        const [matchedPath] = searchMatches;
        const note = snapshot.notesByPath.get(matchedPath);
        return ok(
          formatOpenResultText({
            resolvedPath: matchedPath,
            matchKind: "fuzzy",
            noteLookup,
            snapshot,
            service: context.service
          }),
          {
            notePath: matchedPath,
            noteId: note?.id,
            path: matchedPath,
            title: note?.title,
            data: {
              operation: "open",
              path: matchedPath,
              noteId: note?.id
            }
          }
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

    const note = snapshot.notesByPath.get(resolved.path);
    return ok(
      formatOpenResultText({
        resolvedPath: resolved.path,
        matchKind: resolved.matchKind,
        noteLookup,
        snapshot,
        service: context.service
      }),
      {
        notePath: resolved.path,
        noteId: note?.id,
        path: resolved.path,
        title: note?.title,
        data: {
          operation: "open",
          path: resolved.path,
          noteId: note?.id
        }
      }
    );
  }

  if (command.operation === "search" || command.operation === "query") {
    const rawQuery = command.query.trim();
    if (!rawQuery) {
      return error(`Error: note ${command.operation} requires a query`);
    }
    const notes = context.service.listNotes();
    const snapshot = context.service.getIndexSnapshot();
    const noteLookup = indexNotesByPath(notes);
    const parsedQuery = command.filters ?? parseNoteSearchQuery(rawQuery);
    const matches = findNoteSearchMatches(notes, parsedQuery, {
      snapshot,
      service: context.service
    });
    if (matches.length === 0) {
      return ok(`No TOME notes match "${rawQuery}"`, {
        matches: [],
        data: {
          operation: command.operation,
          query: rawQuery,
          matches: []
        }
      });
    }
    return ok(
      formatSearchResultText({
        rawQuery,
        matches,
        noteLookup,
        snapshot,
        limit: parsedQuery.limit
      }),
      {
        matches,
        data: {
          operation: command.operation,
          query: rawQuery,
          matches: matches.map((pathValue) => {
            const note = snapshot.notesByPath.get(pathValue);
            return {
              path: pathValue,
              noteId: note?.id,
              title: note?.title ?? noteLookup.get(pathValue)?.title
            };
          })
        }
      }
    );
  }

  if (command.operation === "graph" || command.operation === "links") {
    const notes = context.service.listNotes();
    const snapshot = context.service.getIndexSnapshot();
    const noteLookup = indexNotesByPath(notes);
    const resolved = resolveOpenQuery(notes, snapshot, command.query);
    if (!resolved.ok) {
      return error(resolved.text);
    }

    const outgoingResolved = Array.from(
      new Set(
        context.service
          .getResolvedOutgoingRefs(resolved.path)
          .map((ref) => ref.toResolved)
          .filter((value): value is NotePath => Boolean(value))
      )
    ).sort((left, right) => left.localeCompare(right));
    const incomingResolved = context.service.getBacklinks(resolved.path);
    const limit = command.limit;
    const outgoing = limit !== undefined ? outgoingResolved.slice(0, limit) : outgoingResolved;
    const incoming = limit !== undefined ? incomingResolved.slice(0, limit) : incomingResolved;

    const text = formatGraphText({
      query: command.query,
      notePath: resolved.path,
      direction: command.direction,
      outgoing,
      incoming,
      noteLookup,
      snapshot
    });
    const note = snapshot.notesByPath.get(resolved.path);
    return ok(text, {
      notePath: resolved.path,
      noteId: note?.id,
      path: resolved.path,
      title: note?.title,
      data: {
        operation: command.operation,
        query: command.query,
        direction: command.direction,
        path: resolved.path,
        noteId: note?.id,
        outgoing: outgoing.map((pathValue) => ({
          path: pathValue,
          noteId: snapshot.notesByPath.get(pathValue)?.id
        })),
        incoming: incoming.map((pathValue) => ({
          path: pathValue,
          noteId: snapshot.notesByPath.get(pathValue)?.id
        }))
      }
    });
  }

  if (command.operation === "delete") {
    const notes = context.service.listNotes();
    const snapshot = context.service.getIndexSnapshot();
    const resolved = resolveOpenQuery(notes, snapshot, command.query);
    if (!resolved.ok) {
      return error(resolved.text);
    }

    const deleted = await context.service.deleteNote(resolved.path);
    if (!deleted) {
      return error(`Error: note not found for query "${command.query}"`);
    }
    return ok(`Note deleted: ${resolved.path}`, {
      notePath: resolved.path,
      path: resolved.path,
      data: {
        operation: "delete",
        path: resolved.path
      }
    });
  }

  if (command.operation === "restore_defaults") {
    const restored = await context.service.restoreDefaultGuideDocs("restore_missing");
    if (restored.createdPaths.length === 0) {
      return ok("Default TOME guide docs already present", {
        data: {
          operation: "restore_defaults",
          createdPaths: []
        }
      });
    }
    return ok(`Restored default docs: ${restored.createdPaths.join(", ")}`, {
      data: {
        operation: "restore_defaults",
        createdPaths: restored.createdPaths
      }
    });
  }

  if (command.operation === "reindex") {
    await context.service.reindexAll();
    const total = context.service.listNotes().length;
    return ok(`TOME reindex complete (${String(total)} notes)`, {
      data: {
        operation: "reindex",
        total
      }
    });
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
  return ok(`TOME root migrated to ${nextRoot}`, {
    notesRoot: nextRoot,
    data: {
      operation: "root_set",
      notesRoot: nextRoot
    }
  });
}
