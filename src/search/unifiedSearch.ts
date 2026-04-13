import type { Task } from "../domain/models";

export type UnifiedSearchScope = "all" | "tasks" | "notes";

export type UnifiedTaskResult = {
  kind: "task";
  taskId: string;
  title: string;
  secondary: string;
  score: number;
};

export type UnifiedNoteResult = {
  kind: "note";
  notePath: string;
  title: string;
  secondary: string;
  score: number;
};

export type UnifiedSearchResult = UnifiedTaskResult | UnifiedNoteResult;

export type SearchableNote = {
  path: string;
  title: string;
  tags: string[];
  content: string;
};

function tokenize(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function scoreTask(task: Task, terms: string[]): number {
  const title = task.title.toLowerCase();
  const tags = task.tags.join(" ").toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) {
      score += 6;
      continue;
    }
    if (tags.includes(term)) {
      score += 2;
      continue;
    }
    return -1;
  }
  return score;
}

function scoreNote(note: SearchableNote, terms: string[]): number {
  const title = note.title.toLowerCase();
  const path = note.path.toLowerCase();
  const tags = note.tags.join(" ").toLowerCase();
  const content = note.content.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) {
      score += 5;
      continue;
    }
    if (path.includes(term)) {
      score += 3;
      continue;
    }
    if (tags.includes(term)) {
      score += 2;
      continue;
    }
    if (content.includes(term)) {
      score += 1;
      continue;
    }
    return -1;
  }
  return score;
}

function buildContentExcerpt(content: string, terms: string[]): string {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return "(empty note)";
  const loweredTerms = terms.map((term) => term.toLowerCase());
  const matchedLine =
    lines.find((line) => {
      const lowered = line.toLowerCase();
      return loweredTerms.some((term) => lowered.includes(term));
    }) ?? lines[0];
  return matchedLine.length <= 56
    ? matchedLine
    : `${matchedLine.slice(0, 55)}…`;
}

function compareResults(
  left: UnifiedSearchResult,
  right: UnifiedSearchResult,
): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }
  if (left.kind !== right.kind) {
    return left.kind === "task" ? -1 : 1;
  }
  if (left.kind === "task" && right.kind === "task") {
    return left.title.localeCompare(right.title);
  }
  if (left.kind === "note" && right.kind === "note") {
    return (
      left.title.localeCompare(right.title) ||
      left.notePath.localeCompare(right.notePath)
    );
  }
  return 0;
}

export function runUnifiedSearch(params: {
  query: string;
  scope: UnifiedSearchScope;
  tasks: Task[];
  notes: SearchableNote[];
}): UnifiedSearchResult[] {
  const { query, scope, tasks, notes } = params;
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  const results: UnifiedSearchResult[] = [];

  if (scope === "all" || scope === "tasks") {
    for (const task of tasks) {
      const score = scoreTask(task, terms);
      if (score < 0) continue;
      results.push({
        kind: "task",
        taskId: task.id,
        title: task.title,
        secondary: `tags: ${task.tags.join(", ") || "(none)"}`,
        score,
      });
    }
  }

  if (scope === "all" || scope === "notes") {
    for (const note of notes) {
      const score = scoreNote(note, terms);
      if (score < 0) continue;
      results.push({
        kind: "note",
        notePath: note.path,
        title: note.title,
        secondary: `${note.path} · ${buildContentExcerpt(note.content, terms)}`,
        score,
      });
    }
  }

  return results.sort(compareResults);
}
