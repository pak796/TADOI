import type { Filters } from "../domain/models";
import { normalizeTagToken } from "../domain/tagFilter";

export type SelectorDefaults = {
  status: Filters["status"];
  due: Filters["due"];
};

export type SelectorParseResult =
  | { ok: true; filters: Filters }
  | { ok: false; error: string };

const VALID_STATUS = new Set<Filters["status"]>(["all", "open", "done", "archived"]);
const VALID_DUE = new Set<Filters["due"]>(["any", "overdue", "today", "next7"]);
const VALID_STAGE = new Set([
  "backlog",
  "todo",
  "doing",
  "in_progress",
  "in-progress",
  "blocked",
  "review",
  "done"
]);

function mapStageToken(raw: string): Filters["workflowStage"] | null {
  const normalized = raw.trim().toLowerCase();
  if (!VALID_STAGE.has(normalized)) {
    return null;
  }
  if (normalized === "doing") {
    return "in_progress";
  }
  if (normalized === "in-progress") {
    return "in_progress";
  }
  return normalized as Filters["workflowStage"];
}

function normalizeSingletonValue(token: string, prefix: string): string | null {
  const value = token.slice(prefix.length).trim();
  return value.length > 0 ? value : null;
}

function dedupeSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function parseSelectorTokens(
  tokens: string[],
  defaults: SelectorDefaults
): SelectorParseResult {
  const seenSingleton = new Set<string>();
  const includeTags: string[] = [];
  const excludeTags: string[] = [];
  let status: Filters["status"] = defaults.status;
  let due: Filters["due"] = defaults.due;
  let project: string | undefined;
  let assignee: string | undefined;
  let workflowStage: Filters["workflowStage"] | undefined;

  for (const rawToken of tokens) {
    const token = rawToken.trim();
    if (!token) {
      continue;
    }

    if (token.startsWith("id:")) {
      return {
        ok: false,
        error: 'Error: selector mode does not accept "id:<task-id>" tokens.'
      };
    }

    if (token.startsWith("+") || token.startsWith("-")) {
      const polarity = token[0];
      const normalized = normalizeTagToken(token.slice(1));
      if (!normalized) {
        return { ok: false, error: `Error: invalid tag selector "${rawToken}"` };
      }
      if (polarity === "+") {
        includeTags.push(normalized);
      } else {
        excludeTags.push(normalized);
      }
      continue;
    }

    if (token.startsWith("status:")) {
      if (seenSingleton.has("status")) {
        return { ok: false, error: 'Error: duplicate selector for "status".' };
      }
      const value = normalizeSingletonValue(token, "status:");
      if (!value || !VALID_STATUS.has(value as Filters["status"])) {
        return { ok: false, error: `Error: invalid status selector "${rawToken}"` };
      }
      status = value as Filters["status"];
      seenSingleton.add("status");
      continue;
    }

    if (token.startsWith("due:")) {
      if (seenSingleton.has("due")) {
        return { ok: false, error: 'Error: duplicate selector for "due".' };
      }
      const value = normalizeSingletonValue(token, "due:");
      if (!value || !VALID_DUE.has(value as Filters["due"])) {
        return { ok: false, error: `Error: invalid due selector "${rawToken}"` };
      }
      due = value as Filters["due"];
      seenSingleton.add("due");
      continue;
    }

    if (token.startsWith("project:")) {
      if (seenSingleton.has("project")) {
        return { ok: false, error: 'Error: duplicate selector for "project".' };
      }
      const value = normalizeSingletonValue(token, "project:");
      if (!value) {
        return { ok: false, error: `Error: invalid project selector "${rawToken}"` };
      }
      project = value;
      seenSingleton.add("project");
      continue;
    }

    if (token.startsWith("assignee:")) {
      if (seenSingleton.has("assignee")) {
        return { ok: false, error: 'Error: duplicate selector for "assignee".' };
      }
      const value = normalizeSingletonValue(token, "assignee:");
      if (!value) {
        return { ok: false, error: `Error: invalid assignee selector "${rawToken}"` };
      }
      assignee = value;
      seenSingleton.add("assignee");
      continue;
    }

    if (token.startsWith("stage:")) {
      if (seenSingleton.has("stage")) {
        return { ok: false, error: 'Error: duplicate selector for "stage".' };
      }
      const value = normalizeSingletonValue(token, "stage:");
      const mapped = value ? mapStageToken(value) : null;
      if (!mapped) {
        return { ok: false, error: `Error: invalid stage selector "${rawToken}"` };
      }
      workflowStage = mapped;
      seenSingleton.add("stage");
      continue;
    }

    return { ok: false, error: `Error: unrecognized selector "${rawToken}"` };
  }

  const include = dedupeSorted(includeTags);
  const exclude = dedupeSorted(excludeTags);
  const conflicts = include.filter((tag) => exclude.includes(tag));
  if (conflicts.length > 0) {
    return {
      ok: false,
      error: `Error: conflicting selectors for tag(s): ${conflicts.join(", ")}`
    };
  }

  const tagFilter =
    include.length > 0 || exclude.length > 0
      ? {
          ...(include.length > 0 ? { all: include } : {}),
          ...(exclude.length > 0 ? { none: exclude } : {})
        }
      : undefined;

  return {
    ok: true,
    filters: {
      status,
      due,
      ...(tagFilter ? { tagFilter } : {}),
      ...(project ? { project } : {}),
      ...(assignee ? { assignee } : {}),
      ...(workflowStage ? { workflowStage } : {})
    }
  };
}

