import type { Filters, SortMode, Task } from "../domain/models";
import { filterTasks, sortTasks } from "../domain/query";
import { CLI_EXIT_CODE } from "./exitCodes";
import { parseSelectorTokens } from "./selectors";
import { getDataFilePath, safeLoadState, type LoadedData } from "../state/persistence";
import { initialState, reducer } from "../state/store";
import { redactedLogger } from "../logging/redactedLogger";

export type ListTaskRecord = {
  id: string;
  title: string;
  status: Task["status"];
  createdAt: number;
  updatedAt: number;
  dueAt: number | null;
  hasExplicitTime: boolean;
  tags: string[];
  assignee: string | null;
  project: string | null;
  workflowStage: string | null;
};

export type ListJsonData = {
  type: "tadoi.list.v1";
  generatedAt: string;
  filters: Filters;
  sort: SortMode;
  count: number;
  tasks: ListTaskRecord[];
};

type ListParseResult =
  | {
      ok: true;
      selectors: string[];
      sortMode: SortMode;
      limit?: number;
      help: boolean;
    }
  | { ok: false; error: string };

type ListCommandDeps = {
  now: () => number;
  getDataFilePath: () => string;
  loadData: (filePath: string) => Promise<LoadedData>;
  log: (line: string) => void;
  error: (line: string) => void;
};

const DEFAULT_DEPS: ListCommandDeps = {
  now: () => Date.now(),
  getDataFilePath,
  loadData: async (filePath: string) => {
    const result = await safeLoadState({ filePath });
    return result.data;
  },
  log: (line: string) => redactedLogger.log(line),
  error: (line: string) => redactedLogger.error(line)
};

const VALID_SORT_MODE = new Set<SortMode>(["due", "updated", "created", "title"]);

function parsePositiveInteger(raw: string, flag: string): number | null {
  if (!/^[0-9]+$/.test(raw.trim())) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function parseListArgs(args: string[]): ListParseResult {
  const selectors: string[] = [];
  let sortMode: SortMode = "due";
  let limit: number | undefined;
  let help = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] ?? "";
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }

    if (arg === "--sort") {
      const next = args[i + 1];
      if (!next) {
        return { ok: false, error: "--sort requires a value" };
      }
      const normalized = next.trim().toLowerCase();
      if (!VALID_SORT_MODE.has(normalized as SortMode)) {
        return { ok: false, error: `--sort must be due, updated, created, or title` };
      }
      sortMode = normalized as SortMode;
      i += 1;
      continue;
    }
    if (arg.startsWith("--sort=")) {
      const normalized = arg.slice("--sort=".length).trim().toLowerCase();
      if (!VALID_SORT_MODE.has(normalized as SortMode)) {
        return { ok: false, error: `--sort must be due, updated, created, or title` };
      }
      sortMode = normalized as SortMode;
      continue;
    }

    if (arg === "--limit") {
      const next = args[i + 1];
      if (!next) {
        return { ok: false, error: "--limit requires a value" };
      }
      const parsed = parsePositiveInteger(next, "--limit");
      if (parsed === null) {
        return { ok: false, error: "--limit must be a positive integer" };
      }
      limit = parsed;
      i += 1;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const parsed = parsePositiveInteger(arg.slice("--limit=".length), "--limit");
      if (parsed === null) {
        return { ok: false, error: "--limit must be a positive integer" };
      }
      limit = parsed;
      continue;
    }

    if (arg.startsWith("-")) {
      return { ok: false, error: `Unknown option for list: ${arg}` };
    }

    selectors.push(arg);
  }

  return {
    ok: true,
    selectors,
    sortMode,
    ...(limit !== undefined ? { limit } : {}),
    help
  };
}

export function printListHelp(log: (line: string) => void = redactedLogger.log): void {
  log("Usage: tadoi list [selectors...] [--sort <due|updated|created|title>] [--limit <n>] [--json]");
  log("");
  log("Selectors:");
  log("  +tag            Require tag");
  log("  -tag            Exclude tag");
  log("  project:<value> Match exact project");
  log("  assignee:<value> Match exact assignee");
  log("  status:all|open|done|archived");
  log("  due:any|overdue|today|next7");
  log("  stage:backlog|todo|doing|in_progress|blocked|review|done");
  log("");
  log("Defaults:");
  log("  status:open, due:any, sort:due");
}

function toListTaskRecord(task: Task): ListTaskRecord {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    dueAt: task.dueAt ?? null,
    hasExplicitTime: task.hasExplicitTime === true,
    tags: [...task.tags],
    assignee: task.assignee ?? null,
    project: task.project ?? null,
    workflowStage: task.workflowStage ?? null
  };
}

export async function runListCommandWithDeps(
  args: string[],
  options: { json: boolean },
  deps: ListCommandDeps
): Promise<{ exitCode: number; data?: ListJsonData }> {
  const parsed = parseListArgs(args);
  if (!parsed.ok) {
    deps.error(`[list] ${parsed.error}`);
    return { exitCode: CLI_EXIT_CODE.PARSE_OR_VALIDATION };
  }

  if (parsed.help) {
    printListHelp(deps.log);
    return { exitCode: CLI_EXIT_CODE.SUCCESS };
  }

  const selectorResult = parseSelectorTokens(parsed.selectors, {
    status: "open",
    due: "any"
  });
  if (!selectorResult.ok) {
    deps.error(selectorResult.error);
    return { exitCode: CLI_EXIT_CODE.PARSE_OR_VALIDATION };
  }

  try {
    const loaded = await deps.loadData(deps.getDataFilePath());
    const state = reducer(initialState, { type: "load", data: loaded });
    const now = deps.now();
    const filtered = filterTasks(state.tasks, selectorResult.filters, now);
    const sorted = sortTasks(filtered, now, parsed.sortMode);
    const limited = parsed.limit !== undefined ? sorted.slice(0, parsed.limit) : sorted;
    const records = limited.map(toListTaskRecord);

    const payload: ListJsonData = {
      type: "tadoi.list.v1",
      generatedAt: new Date(now).toISOString(),
      filters: selectorResult.filters,
      sort: parsed.sortMode,
      count: records.length,
      tasks: records
    };

    if (options.json) {
      return { exitCode: CLI_EXIT_CODE.SUCCESS, data: payload };
    }

    deps.log(`[list] count: ${records.length}`);
    for (const task of records) {
      deps.log(`[${task.status}] ${task.id} ${task.title}`);
    }
    return { exitCode: CLI_EXIT_CODE.SUCCESS };
  } catch (error: unknown) {
    deps.error(
      `Error: could not read data file (${error instanceof Error ? error.message : String(error)})`
    );
    return { exitCode: CLI_EXIT_CODE.IO_ERROR };
  }
}

export async function runListCommand(
  args: string[],
  options: { json: boolean }
): Promise<{ exitCode: number; data?: ListJsonData }> {
  return runListCommandWithDeps(args, options, DEFAULT_DEPS);
}
