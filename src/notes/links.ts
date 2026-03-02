import path from "path";
import type { NotePath, NoteRef } from "./types";

const WIKILINK_PATTERN = /\[\[([^\]]+?)\]\]/g;
const MDLINK_PATTERN = /(!?)\[([^\]]+)\]\(([^)]+)\)/g;
const TASK_WIKILINK_PREFIX = /^task:/i;
const TASK_URL_PREFIX = /^tadoi:\/\/task\//i;

export type NoteReferenceTarget = {
  rawTarget: string;
  display?: string;
  kind: "wikilink" | "mdlink";
};

export type NoteReferenceResolverContext = {
  fromPath: NotePath;
  notesByPath: Map<NotePath, { id?: string; title: string; filename: string }>;
  notesById: Map<string, NotePath>;
  notesByTitle: Map<string, NotePath[]>;
};

function cleanLinkTarget(value: string): string {
  return value.trim().replace(/^<|>$/g, "");
}

function extractIdTarget(rawTarget: string): string | null {
  const cleaned = rawTarget.trim();
  const direct = cleaned.match(/^id:([A-Za-z0-9._:-]+)$/i);
  if (direct) return direct[1];
  const hashMatch = cleaned.match(/#id:([A-Za-z0-9._:-]+)$/i);
  if (hashMatch) return hashMatch[1];
  return null;
}

export function normalizeTitleKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeMarkdownPath(fromPath: NotePath, rawTarget: string): NotePath | null {
  const cleaned = cleanLinkTarget(rawTarget);
  if (!cleaned) return null;

  const withoutFragment = cleaned.split("#", 1)[0] ?? "";
  if (!withoutFragment) return null;

  const looksPath =
    withoutFragment.includes("/") ||
    withoutFragment.startsWith(".") ||
    withoutFragment.endsWith(".md");
  if (!looksPath) return null;

  const fromDir = path.posix.dirname(fromPath);
  const resolved = path.posix.normalize(path.posix.resolve("/", fromDir, withoutFragment));
  const relative = resolved.startsWith("/") ? resolved.slice(1) : resolved;

  if (!relative) return null;
  return relative.endsWith(".md") ? relative : `${relative}.md`;
}

function resolveByTitle(
  rawTarget: string,
  notesByTitle: Map<string, NotePath[]>
): { resolved?: NotePath; ambiguous?: boolean } {
  const key = normalizeTitleKey(rawTarget.replace(/\.md$/i, ""));
  const candidates = notesByTitle.get(key) ?? [];
  if (candidates.length === 1) {
    return { resolved: candidates[0] };
  }
  if (candidates.length > 1) {
    return { ambiguous: true };
  }
  return {};
}

export function parseOutgoingNoteRefs(fromPath: NotePath, markdown: string): NoteRef[] {
  const refs: NoteRef[] = [];

  WIKILINK_PATTERN.lastIndex = 0;
  let wikiMatch = WIKILINK_PATTERN.exec(markdown);
  while (wikiMatch) {
    const value = wikiMatch[1]?.trim() ?? "";
    if (value.length > 0) {
      const [target, alias] = value.split("|", 2);
      if (TASK_WIKILINK_PREFIX.test(target.trim())) {
        wikiMatch = WIKILINK_PATTERN.exec(markdown);
        continue;
      }
      refs.push({
        from: fromPath,
        kind: "wikilink",
        toRaw: target.trim(),
        ...(alias?.trim() ? { display: alias.trim() } : {})
      });
    }
    wikiMatch = WIKILINK_PATTERN.exec(markdown);
  }

  MDLINK_PATTERN.lastIndex = 0;
  let mdMatch = MDLINK_PATTERN.exec(markdown);
  while (mdMatch) {
    if (mdMatch[1] === "!") {
      mdMatch = MDLINK_PATTERN.exec(markdown);
      continue;
    }
    const text = mdMatch[2]?.trim() ?? "";
    const target = mdMatch[3]?.trim() ?? "";
    if (target.length > 0) {
      if (TASK_URL_PREFIX.test(target)) {
        mdMatch = MDLINK_PATTERN.exec(markdown);
        continue;
      }
      refs.push({
        from: fromPath,
        kind: "mdlink",
        toRaw: target,
        ...(text ? { display: text } : {})
      });
    }
    mdMatch = MDLINK_PATTERN.exec(markdown);
  }

  return refs;
}

export function resolveNoteRef(
  ref: NoteRef,
  context: NoteReferenceResolverContext
): NoteRef {
  const idTarget = extractIdTarget(ref.toRaw);
  if (idTarget) {
    const byId = context.notesById.get(idTarget);
    if (byId) {
      return { ...ref, toResolved: byId, broken: false, ambiguous: false };
    }
  }

  const pathTarget = normalizeMarkdownPath(context.fromPath, ref.toRaw);
  if (pathTarget && context.notesByPath.has(pathTarget)) {
    return { ...ref, toResolved: pathTarget, broken: false, ambiguous: false };
  }

  const byTitle = resolveByTitle(ref.toRaw, context.notesByTitle);
  if (byTitle.resolved) {
    return { ...ref, toResolved: byTitle.resolved, broken: false, ambiguous: false };
  }
  if (byTitle.ambiguous) {
    return { ...ref, ambiguous: true, broken: false };
  }

  return { ...ref, broken: true, ambiguous: false };
}
