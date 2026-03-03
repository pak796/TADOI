import type {
  BulkTarget,
  CommandTarget,
  HelpTopic,
  NoteLinkDirection,
  NoteOutputFormat,
  NoteSearchFilters,
  RecurEvery,
  ParseCommandResult
} from "./types";
import {
  MINI_DEFAULT_TIMEZONE,
  canonicalizeDueAtInput
} from "../lib/datetime/due_at_canonicalizer";

export type ParseCommandOptions = {
  now?: number;
  tz?: string;
};

type ParseContext = {
  now: number;
  tz: string;
};

function error(message: string): ParseCommandResult {
  return { ok: false, error: message };
}

function isAddOptionToken(token: string): boolean {
  return (
    token.startsWith("#") ||
    token.startsWith("due:") ||
    token.startsWith("at:") ||
    token.startsWith("notes:")
  );
}

function parseCommandTarget(token: string): CommandTarget | null {
  if (token === "@selected") {
    return { type: "selected" };
  }
  if (token.startsWith("id:")) {
    const id = token.slice(3).trim();
    if (!id) return null;
    return { type: "id", id };
  }
  return null;
}

function parsePositiveOneBasedIndex(token: string): number | null {
  if (!/^[1-9]\d*$/.test(token.trim())) {
    return null;
  }
  const parsed = Number.parseInt(token, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
}

function parseBulkTarget(tokens: string[]): { target: BulkTarget; rest: string[] } | null {
  const ids: string[] = [];
  const seen = new Set<string>();
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    if (!token.startsWith("id:")) break;
    const id = token.slice(3).trim();
    if (!id) {
      return null;
    }
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
    index += 1;
  }

  if (ids.length > 0) {
    return {
      target: { type: "ids", ids },
      rest: tokens.slice(index)
    };
  }

  return {
    target: { type: "marked" },
    rest: tokens
  };
}

function parseAddCommand(
  tokens: string[],
  firstTokenQuoted: boolean,
  context: ParseContext
): ParseCommandResult {
  if (tokens.length === 0) {
    return error("Error: add requires a title");
  }

  let title = "";
  let index = 0;
  if (firstTokenQuoted) {
    title = tokens[0].trim();
    index = 1;
  } else {
    if (isAddOptionToken(tokens[0])) {
      return error(
        'Error: add title is required before options (quote titles starting with #, due:, at:, or notes:)'
      );
    }
    const titleParts: string[] = [];
    while (index < tokens.length && !isAddOptionToken(tokens[index])) {
      titleParts.push(tokens[index]);
      index += 1;
    }
    title = titleParts.join(" ").trim();
  }

  if (!title) {
    return error("Error: add requires a title");
  }

  let dueDate: string | undefined;
  let atTime: string | undefined;
  let notes: string | undefined;
  const tags: string[] = [];

  for (; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.startsWith("#")) {
      tags.push(token);
      continue;
    }
    if (token.startsWith("due:")) {
      if (dueDate !== undefined) {
        return error("Error: duplicate due: token");
      }
      const value = token.slice(4).trim();
      if (!value) return error("Error: due: value is required");
      dueDate = value;
      continue;
    }
    if (token.startsWith("at:")) {
      if (atTime !== undefined) {
        return error("Error: duplicate at: token");
      }
      const value = token.slice(3).trim();
      if (!value) return error("Error: at: value is required");
      atTime = value;
      continue;
    }
    if (token.startsWith("notes:")) {
      if (notes !== undefined) {
        return error("Error: duplicate notes: token");
      }
      const value = token.slice(6).trim();
      notes = value || undefined;
      continue;
    }
    return error(`Error: unrecognized add token "${token}"`);
  }

  if (atTime && !dueDate) {
    return error("Error: at: requires due:");
  }

  if (dueDate) {
    const canonicalized = canonicalizeDueAtInput(dueDate, atTime, {
      now: context.now,
      tz: context.tz
    });
    if (!canonicalized.ok) {
      return error(canonicalized.message);
    }
    dueDate = canonicalized.dueDate;
    atTime = canonicalized.atTime;
  }

  return {
    ok: true,
    command: {
      type: "add",
      title,
      dueDate,
      atTime,
      tags,
      notes
    }
  };
}

function parseDoneCommand(tokens: string[]): ParseCommandResult {
  if (tokens.length === 0) {
    return {
      ok: true,
      command: { type: "done", target: { type: "selected" } }
    };
  }
  if (tokens.length !== 1) {
    return error("Error: done accepts at most one target");
  }

  const target = parseCommandTarget(tokens[0]);
  if (!target) {
    return error('Error: done target must be "@selected" or "id:<task-id>"');
  }
  return {
    ok: true,
    command: { type: "done", target }
  };
}

function parseDueCommand(tokens: string[], context: ParseContext): ParseCommandResult {
  if (tokens.length < 2) {
    return error("Error: due requires target and date/clear");
  }

  const target = parseCommandTarget(tokens[0]);
  if (!target) {
    return error('Error: due target must be "@selected" or "id:<task-id>"');
  }

  const dueTokens = tokens.slice(1);
  const firstDueToken = dueTokens[0] ?? "";
  if (firstDueToken === "clear") {
    if (tokens.length !== 2) {
      return error("Error: due clear takes no extra tokens");
    }
    return {
      ok: true,
      command: { type: "due", target, clear: true }
    };
  }

  let atInput: string | undefined;
  if ((dueTokens[dueTokens.length - 1] ?? "").startsWith("at:")) {
    const atToken = dueTokens.pop() ?? "";
    const parsedAt = atToken.slice(3).trim();
    if (!parsedAt) {
      return error("Error: at: value is required");
    }
    atInput = parsedAt;
  }

  if (dueTokens.length === 0) {
    return error("Error: due requires target and date/clear");
  }

  if (dueTokens.length > 2) {
    return error("Error: due accepts only one optional at: token");
  }

  const dueInput = dueTokens.join(" ").trim();
  const canonicalized = canonicalizeDueAtInput(dueInput, atInput, {
    now: context.now,
    tz: context.tz
  });
  if (!canonicalized.ok) {
    return error(canonicalized.message);
  }

  return {
    ok: true,
    command: {
      type: "due",
      target,
      clear: false,
      dueDate: canonicalized.dueDate,
      ...(canonicalized.atTime ? { atTime: canonicalized.atTime } : {})
    }
  };
}

function parseCheckCommand(
  operationToken: string | undefined,
  tokens: string[]
): ParseCommandResult {
  const operation = operationToken?.toLowerCase().trim();
  if (!operation) {
    return error("Error: check requires operation add|toggle|edit|del|clear");
  }

  const targetToken = tokens[0];
  if (!targetToken) {
    return error('Error: check target must be "@selected" or "id:<task-id>"');
  }
  const target = parseCommandTarget(targetToken);
  if (!target) {
    return error('Error: check target must be "@selected" or "id:<task-id>"');
  }

  if (operation === "add") {
    const text = tokens.slice(1).join(" ").trim();
    if (!text) {
      return error("Error: check add requires text");
    }
    return {
      ok: true,
      command: {
        type: "check",
        operation: "add",
        target,
        text
      }
    };
  }

  if (operation === "toggle" || operation === "del" || operation === "delete") {
    if (tokens.length !== 2) {
      return error(`Error: check ${operation === "toggle" ? "toggle" : "del"} requires index`);
    }
    const index = parsePositiveOneBasedIndex(tokens[1] ?? "");
    if (index === null) {
      return error("Error: checklist index must be a positive integer");
    }
    return {
      ok: true,
      command: {
        type: "check",
        operation: operation === "toggle" ? "toggle" : "del",
        target,
        index
      }
    };
  }

  if (operation === "edit") {
    const index = parsePositiveOneBasedIndex(tokens[1] ?? "");
    if (index === null) {
      return error("Error: checklist index must be a positive integer");
    }
    const text = tokens.slice(2).join(" ").trim();
    if (!text) {
      return error("Error: check edit requires text");
    }
    return {
      ok: true,
      command: {
        type: "check",
        operation: "edit",
        target,
        index,
        text
      }
    };
  }

  if (operation === "clear") {
    if (tokens.length !== 1) {
      return error("Error: check clear takes no extra tokens");
    }
    return {
      ok: true,
      command: {
        type: "check",
        operation: "clear",
        target
      }
    };
  }

  return error("Error: check requires operation add|toggle|edit|del|clear");
}

function parseBulkCommand(
  operationToken: string | undefined,
  tokens: string[],
  context: ParseContext
): ParseCommandResult {
  const operationRaw = operationToken?.toLowerCase().trim();
  if (!operationRaw) {
    return error(
      "Error: bulk requires operation done|tag add|tag rm|due|priority|assignee|project|stage|delete"
    );
  }

  let operation = operationRaw;
  let remainder = [...tokens];
  let forceDueClear = false;
  if (operation === "tag") {
    const subOp = (remainder[0] ?? "").toLowerCase();
    if (subOp !== "add" && subOp !== "rm") {
      return error("Error: bulk tag requires add|rm");
    }
    operation = `tag:${subOp}`;
    remainder = remainder.slice(1);
  }
  if (operation === "tag:add") {
    operation = "tag_add";
  }
  if (operation === "tag:rm") {
    operation = "tag_rm";
  }
  if (operation === "due:clear") {
    operation = "due";
    forceDueClear = true;
  }

  const parsedTarget = parseBulkTarget(remainder);
  if (!parsedTarget) {
    return error('Error: bulk targets must be repeated "id:<task-id>" tokens');
  }
  const { target, rest: parsedRest } = parsedTarget;
  const rest = forceDueClear ? ["clear", ...parsedRest] : parsedRest;

  if (operation === "done") {
    if (rest.length !== 0) {
      return error("Error: bulk done takes no extra tokens");
    }
    return {
      ok: true,
      command: {
        type: "bulk",
        operation: "done",
        target
      }
    };
  }

  if (operation === "delete") {
    if (rest.length !== 0) {
      return error("Error: bulk delete takes no extra tokens");
    }
    return {
      ok: true,
      command: {
        type: "bulk",
        operation: "delete",
        target
      }
    };
  }

  if (operation === "tag_add" || operation === "tag_rm") {
    if (rest.length === 0) {
      return error(`Error: bulk tag ${operation === "tag_add" ? "add" : "rm"} requires tags`);
    }
    if (!rest.every((token) => token.startsWith("#"))) {
      return error('Error: bulk tag tokens must start with "#"');
    }
    return {
      ok: true,
      command: {
        type: "bulk",
        operation,
        target,
        tags: rest
      }
    };
  }

  if (operation === "due") {
    if (rest.length === 0) {
      return error("Error: bulk due requires date or clear");
    }
    if (rest[0] === "clear") {
      if (rest.length !== 1) {
        return error("Error: bulk due clear takes no extra tokens");
      }
      return {
        ok: true,
        command: {
          type: "bulk",
          operation: "due",
          target,
          clear: true
        }
      };
    }
    const dueTokens = [...rest];
    let atInput: string | undefined;
    if ((dueTokens[dueTokens.length - 1] ?? "").startsWith("at:")) {
      const atToken = dueTokens.pop() ?? "";
      const parsedAt = atToken.slice(3).trim();
      if (!parsedAt) {
        return error("Error: at: value is required");
      }
      atInput = parsedAt;
    }

    if (dueTokens.length === 0) {
      return error("Error: bulk due requires date or clear");
    }

    if (dueTokens.length > 2) {
      return error("Error: bulk due accepts only one optional at: token");
    }

    const dueInput = dueTokens.join(" ").trim();
    const canonicalized = canonicalizeDueAtInput(dueInput, atInput, {
      now: context.now,
      tz: context.tz
    });
    if (!canonicalized.ok) {
      return error(canonicalized.message);
    }

    return {
      ok: true,
      command: {
        type: "bulk",
        operation: "due",
        target,
        clear: false,
        dueDate: canonicalized.dueDate,
        ...(canonicalized.atTime ? { atTime: canonicalized.atTime } : {})
      }
    };
  }

  if (operation === "priority") {
    if (rest.length !== 1) {
      return error("Error: bulk priority requires one value");
    }
    const value = rest[0]?.trim();
    if (!value) {
      return error("Error: bulk priority value is required");
    }
    if (value.toLowerCase() === "clear") {
      return {
        ok: true,
        command: {
          type: "bulk",
          operation: "priority",
          target,
          clear: true
        }
      };
    }
    return {
      ok: true,
      command: {
        type: "bulk",
        operation: "priority",
        target,
        clear: false,
        value
      }
    };
  }

  if (operation === "assignee" || operation === "project") {
    if (rest.length !== 1) {
      return error(`Error: bulk ${operation} requires one value`);
    }
    const value = rest[0]?.trim();
    if (!value) {
      return error(`Error: bulk ${operation} value is required`);
    }
    if (value.toLowerCase() === "clear") {
      return {
        ok: true,
        command: {
          type: "bulk",
          operation,
          target,
          clear: true
        }
      };
    }
    return {
      ok: true,
      command: {
        type: "bulk",
        operation,
        target,
        clear: false,
        value
      }
    };
  }

  if (operation === "stage") {
    if (rest.length !== 1) {
      return error("Error: bulk stage requires one value");
    }
    const stage = rest[0]?.toLowerCase();
    if (stage !== "todo" && stage !== "doing" && stage !== "blocked" && stage !== "done") {
      return error('Error: bulk stage must be "todo", "doing", "blocked", or "done"');
    }
    return {
      ok: true,
      command: {
        type: "bulk",
        operation: "stage",
        target,
        stage
      }
    };
  }

  return error(
    "Error: bulk requires operation done|tag add|tag rm|due|priority|assignee|project|stage|delete"
  );
}

function parseHelpCommand(tokens: string[]): ParseCommandResult {
  if (tokens.length === 0) {
    return {
      ok: true,
      command: { type: "help" }
    };
  }
  if (tokens.length !== 1) {
    return error("Error: help accepts at most one topic");
  }

  const topic = tokens[0].toLowerCase() as HelpTopic;
  if (
    topic !== "add" &&
    topic !== "done" &&
    topic !== "due" &&
    topic !== "recur" &&
    topic !== "check" &&
    topic !== "bulk" &&
    topic !== "note" &&
    topic !== "tag"
  ) {
    return error(
      'Error: help topics are "add", "done", "due", "recur", "check", "bulk", "note", or "tag"'
    );
  }

  return {
    ok: true,
    command: { type: "help", topic }
  };
}

type SplitTagDryRunResult =
  | { ok: true; args: string[]; dryRun: boolean }
  | { ok: false; error: string };

function splitTagDryRun(tokens: string[]): SplitTagDryRunResult {
  const dryRunIndexes = tokens
    .map((token, index) => (token === "--dry-run" ? index : -1))
    .filter((index) => index >= 0);
  if (dryRunIndexes.length === 0) {
    return { ok: true, args: tokens, dryRun: false };
  }
  if (dryRunIndexes.length > 1) {
    return { ok: false, error: "Error: --dry-run can be provided only once" };
  }
  const dryRunIndex = dryRunIndexes[0] as number;
  if (dryRunIndex !== tokens.length - 1) {
    return { ok: false, error: "Error: --dry-run must be the last token" };
  }
  return {
    ok: true,
    args: tokens.slice(0, -1),
    dryRun: true
  };
}

function parseTagCommand(tokens: string[]): ParseCommandResult {
  const operation = tokens[0]?.toLowerCase();
  const rest = tokens.slice(1);

  if (!operation) {
    return error("Error: tag requires subcommand rename|merge|hygiene|cleanup");
  }

  if (operation === "rename") {
    const parsedDryRun = splitTagDryRun(rest);
    if (!parsedDryRun.ok) return error(parsedDryRun.error);
    const { args, dryRun } = parsedDryRun;
    if (args.length !== 2) {
      return error("Error: tag rename requires <old> <new>");
    }
    return {
      ok: true,
      command: {
        type: "tag",
        operation: "rename",
        oldTag: args[0] as string,
        newTag: args[1] as string,
        dryRun
      }
    };
  }

  if (operation === "merge") {
    const parsedDryRun = splitTagDryRun(rest);
    if (!parsedDryRun.ok) return error(parsedDryRun.error);
    const { args, dryRun } = parsedDryRun;
    if (args.length !== 3 || args[1] !== "->") {
      return error("Error: tag merge requires <src1,src2,...> -> <target>");
    }
    const sourceList = (args[0] as string)
      .split(",")
      .map((source) => source.trim())
      .filter((source) => source.length > 0);
    const target = (args[2] as string).trim();
    if (sourceList.length === 0 || target.length === 0) {
      return error("Error: tag merge requires at least one source and a target");
    }
    return {
      ok: true,
      command: {
        type: "tag",
        operation: "merge",
        sources: sourceList,
        target,
        dryRun
      }
    };
  }

  if (operation === "hygiene" || operation === "cleanup") {
    const parsedDryRun = splitTagDryRun(rest);
    if (!parsedDryRun.ok) return error(parsedDryRun.error);
    const { args, dryRun } = parsedDryRun;
    if (args.length > 0) {
      return error(`Error: tag ${operation} takes no extra tokens`);
    }
    return {
      ok: true,
      command: {
        type: "tag",
        operation,
        dryRun
      }
    };
  }

  return error("Error: tag requires subcommand rename|merge|hygiene|cleanup");
}

function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${String(year)}-${month}-${day}`;
}

function shiftIsoDate(isoDate: string, deltaDays: number): string | null {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number.parseInt(match[1] as string, 10);
  const month = Number.parseInt(match[2] as string, 10);
  const day = Number.parseInt(match[3] as string, 10);
  const shifted = new Date(year, month - 1, day + deltaDays);
  return localIsoDate(shifted);
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  return localIsoDate(parsed) === value;
}

function parseDateWindowToken(
  value: string,
  context: ParseContext
): { after?: string; before?: string; error?: string } {
  const trimmed = value.trim().toLowerCase();
  const today = localIsoDate(new Date(context.now));

  if (trimmed === "today") {
    return {
      after: today,
      before: shiftIsoDate(today, 1) ?? undefined
    };
  }
  if (trimmed === "yesterday") {
    const yesterday = shiftIsoDate(today, -1);
    return {
      ...(yesterday ? { after: yesterday } : {}),
      before: today
    };
  }

  if (trimmed.startsWith(">=")) {
    const date = trimmed.slice(2).trim();
    if (!isIsoDate(date)) {
      return { error: `Error: invalid date filter "${value}"` };
    }
    return { after: date };
  }

  if (trimmed.startsWith("<=")) {
    const date = trimmed.slice(2).trim();
    if (!isIsoDate(date)) {
      return { error: `Error: invalid date filter "${value}"` };
    }
    const next = shiftIsoDate(date, 1);
    return next ? { before: next } : { error: `Error: invalid date filter "${value}"` };
  }

  if (trimmed.includes("..")) {
    const [start, end] = trimmed.split("..");
    const startDate = start?.trim() ?? "";
    const endDate = end?.trim() ?? "";
    if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
      return { error: `Error: invalid date range "${value}"` };
    }
    const next = shiftIsoDate(endDate, 1);
    return next
      ? { after: startDate, before: next }
      : { error: `Error: invalid date range "${value}"` };
  }

  if (isIsoDate(trimmed)) {
    const next = shiftIsoDate(trimmed, 1);
    return next ? { after: trimmed, before: next } : { error: `Error: invalid date "${value}"` };
  }

  return { error: `Error: invalid date filter "${value}"` };
}

function createEmptyNoteSearchFilters(): NoteSearchFilters {
  return {
    textTerms: [],
    titleFilters: [],
    pathFilters: [],
    tagFilters: [],
    excludedTagFilters: []
  };
}

function parseFormatToken(value: string): NoteOutputFormat | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "text" || normalized === "json") {
    return normalized;
  }
  return null;
}

function parseNoteSearchFilters(rawQuery: string, context: ParseContext): {
  ok: true;
  filters: NoteSearchFilters;
} | {
  ok: false;
  error: string;
} {
  const filters = createEmptyNoteSearchFilters();
  const tokens = rawQuery.split(/\s+/).map((token) => token.trim()).filter(Boolean);

  for (const token of tokens) {
    const lowered = token.toLowerCase();
    if (lowered.startsWith("-tag:")) {
      const value = token.slice("-tag:".length).trim().toLowerCase();
      if (value.length > 0) {
        filters.excludedTagFilters.push(value);
      }
      continue;
    }
    if (lowered.startsWith("tag:")) {
      const value = token.slice("tag:".length).trim().toLowerCase();
      if (value.length > 0) {
        filters.tagFilters.push(value);
      }
      continue;
    }
    if (lowered.startsWith("title:")) {
      const value = token.slice("title:".length).trim().toLowerCase();
      if (value.length > 0) {
        filters.titleFilters.push(value);
      }
      continue;
    }
    if (lowered.startsWith("path:")) {
      const value = token.slice("path:".length).trim().toLowerCase();
      if (value.length > 0) {
        filters.pathFilters.push(value);
      }
      continue;
    }
    if (lowered.startsWith("text:")) {
      const value = token.slice("text:".length).trim().toLowerCase();
      if (value.length > 0) {
        filters.textTerms.push(value);
      }
      continue;
    }
    if (lowered.startsWith("created:")) {
      const parsed = parseDateWindowToken(token.slice("created:".length), context);
      if (parsed.error) {
        return { ok: false, error: parsed.error };
      }
      if (parsed.after) filters.createdAfter = parsed.after;
      if (parsed.before) filters.createdBefore = parsed.before;
      continue;
    }
    if (lowered.startsWith("updated:")) {
      const parsed = parseDateWindowToken(token.slice("updated:".length), context);
      if (parsed.error) {
        return { ok: false, error: parsed.error };
      }
      if (parsed.after) filters.updatedAfter = parsed.after;
      if (parsed.before) filters.updatedBefore = parsed.before;
      continue;
    }
    if (lowered.startsWith("limit:")) {
      const parsed = Number.parseInt(token.slice("limit:".length), 10);
      if (!Number.isInteger(parsed) || parsed < 1) {
        return { ok: false, error: `Error: invalid note search limit "${token}"` };
      }
      filters.limit = parsed;
      continue;
    }
    if (lowered.startsWith("format:")) {
      const parsed = parseFormatToken(token.slice("format:".length));
      if (!parsed) {
        return { ok: false, error: `Error: note search format must be text|json` };
      }
      filters.format = parsed;
      continue;
    }

    filters.textTerms.push(token.toLowerCase());
  }

  return {
    ok: true,
    filters
  };
}

function parseNoteQuickCommand(tokens: string[], context: ParseContext): ParseCommandResult {
  const tags: string[] = [];
  const aliases: string[] = [];
  const metadata: Record<string, string> = {};
  const positional: string[] = [];
  let status: string | undefined;
  let template: string | undefined;
  let target: CommandTarget | undefined;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] ?? "";
    const lowered = token.toLowerCase();
    if (token.startsWith("#")) {
      tags.push(token.slice(1).trim().toLowerCase());
      continue;
    }
    if (lowered.startsWith("tag:")) {
      const tag = token.slice("tag:".length).trim().toLowerCase();
      if (tag.length > 0) {
        tags.push(tag);
      }
      continue;
    }
    if (lowered.startsWith("--meta:")) {
      const pair = token.slice("--meta:".length);
      const separator = pair.indexOf("=");
      if (separator <= 0 || separator >= pair.length - 1) {
        return error('Error: --meta:key=value requires non-empty key and value');
      }
      const key = pair.slice(0, separator).trim();
      const value = pair.slice(separator + 1).trim();
      if (!key || !value) {
        return error('Error: --meta:key=value requires non-empty key and value');
      }
      metadata[key] = value;
      continue;
    }
    if (lowered === "--status" || lowered.startsWith("--status=")) {
      const value =
        lowered === "--status"
          ? (tokens[(index += 1)] ?? "")
          : token.slice("--status=".length);
      if (!value.trim()) {
        return error("Error: --status requires a value");
      }
      status = value.trim();
      continue;
    }
    if (lowered === "--alias" || lowered.startsWith("--alias=")) {
      const value =
        lowered === "--alias"
          ? (tokens[(index += 1)] ?? "")
          : token.slice("--alias=".length);
      if (!value.trim()) {
        return error("Error: --alias requires a value");
      }
      aliases.push(value.trim());
      continue;
    }
    if (lowered === "--template" || lowered.startsWith("--template=")) {
      const value =
        lowered === "--template"
          ? (tokens[(index += 1)] ?? "")
          : token.slice("--template=".length);
      if (!value.trim()) {
        return error("Error: --template requires a value");
      }
      template = value.trim();
      continue;
    }
    if (token === "@selected" || token.startsWith("id:")) {
      const parsedTarget = parseCommandTarget(token);
      if (!parsedTarget) {
        return error('Error: note quick target must be "@selected" or "id:<task-id>"');
      }
      if (target) {
        return error("Error: note quick accepts at most one task target");
      }
      target = parsedTarget;
      continue;
    }
    if (token.startsWith("--")) {
      return error(`Error: unrecognized note quick option "${token}"`);
    }
    positional.push(token);
  }

  let title = "";
  let body: string | undefined;
  if (positional.length === 0) {
    if (
      tags.length > 0 ||
      aliases.length > 0 ||
      Object.keys(metadata).length > 0 ||
      Boolean(status) ||
      Boolean(template) ||
      Boolean(target)
    ) {
      title = `Quick Capture ${localIsoDate(new Date(context.now))}`;
    } else {
      return error('Error: note quick requires a title (example: note q "Title" "Body")');
    }
  } else if (positional.length === 1) {
    const pipeIndex = positional[0].indexOf("|");
    if (pipeIndex > 0) {
      title = positional[0].slice(0, pipeIndex).trim();
      body = positional[0].slice(pipeIndex + 1).trim() || undefined;
    } else {
      title = positional[0].trim();
    }
  } else {
    title = positional[0]?.trim() ?? "";
    body = positional.slice(1).join(" ").trim() || undefined;
  }

  if (!title) {
    return error('Error: note quick requires a title (example: note q "Title" "Body")');
  }

  return {
    ok: true,
    command: {
      type: "note",
      operation: "quick",
      title,
      ...(body ? { body } : {}),
      tags: Array.from(new Set(tags.filter((tag) => tag.length > 0))),
      ...(status ? { status } : {}),
      aliases: Array.from(new Set(aliases)),
      metadata,
      ...(template ? { template } : {}),
      ...(target ? { target } : {})
    }
  };
}

function parseNoteSearchLikeCommand(
  operation: "search" | "query",
  tokens: string[],
  context: ParseContext
): ParseCommandResult {
  const queryTokens: string[] = [];
  let flagLimit: number | undefined;
  let flagFormat: NoteOutputFormat | undefined;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] ?? "";
    const lowered = token.toLowerCase();
    if (lowered === "--limit" || lowered.startsWith("--limit=")) {
      const rawValue =
        lowered === "--limit"
          ? (tokens[(index += 1)] ?? "")
          : token.slice("--limit=".length);
      const parsed = Number.parseInt(rawValue, 10);
      if (!Number.isInteger(parsed) || parsed < 1) {
        return error("Error: --limit requires a positive integer");
      }
      flagLimit = parsed;
      continue;
    }
    if (lowered === "--format" || lowered.startsWith("--format=")) {
      const rawValue =
        lowered === "--format"
          ? (tokens[(index += 1)] ?? "")
          : token.slice("--format=".length);
      const parsed = parseFormatToken(rawValue);
      if (!parsed) {
        return error("Error: --format must be text|json");
      }
      flagFormat = parsed;
      continue;
    }
    queryTokens.push(token);
  }

  const query = queryTokens.join(" ").trim();
  if (!query) {
    return error(
      `Error: note ${operation} requires a query (example: note ${operation} \"tag:work title:retro\")`
    );
  }

  const parsed = parseNoteSearchFilters(query, context);
  if (!parsed.ok) {
    return error(parsed.error);
  }
  if (flagLimit !== undefined) {
    parsed.filters.limit = flagLimit;
  }
  if (flagFormat) {
    parsed.filters.format = flagFormat;
  }

  return {
    ok: true,
    command: {
      type: "note",
      operation,
      query,
      filters: parsed.filters
    }
  };
}

function parseNoteGraphLikeCommand(
  operation: "graph" | "links",
  tokens: string[]
): ParseCommandResult {
  const queryTokens: string[] = [];
  let direction: NoteLinkDirection = "both";
  let limit: number | undefined;
  let format: NoteOutputFormat | undefined;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] ?? "";
    const lowered = token.toLowerCase();
    if (lowered === "incoming" || lowered === "outgoing" || lowered === "both") {
      direction = lowered;
      continue;
    }
    if (lowered.startsWith("dir:")) {
      const raw = lowered.slice("dir:".length);
      if (raw === "incoming" || raw === "outgoing" || raw === "both") {
        direction = raw;
        continue;
      }
      return error("Error: note links direction must be incoming|outgoing|both");
    }
    if (lowered === "--limit" || lowered.startsWith("--limit=") || lowered.startsWith("limit:")) {
      const rawValue = lowered.startsWith("limit:")
        ? token.slice("limit:".length)
        : lowered === "--limit"
          ? (tokens[(index += 1)] ?? "")
          : token.slice("--limit=".length);
      const parsed = Number.parseInt(rawValue, 10);
      if (!Number.isInteger(parsed) || parsed < 1) {
        return error("Error: note links limit must be a positive integer");
      }
      limit = parsed;
      continue;
    }
    if (lowered === "--format" || lowered.startsWith("--format=") || lowered.startsWith("format:")) {
      const rawValue = lowered.startsWith("format:")
        ? token.slice("format:".length)
        : lowered === "--format"
          ? (tokens[(index += 1)] ?? "")
          : token.slice("--format=".length);
      const parsed = parseFormatToken(rawValue);
      if (!parsed) {
        return error("Error: note links format must be text|json");
      }
      format = parsed;
      continue;
    }
    queryTokens.push(token);
  }

  const query = queryTokens.join(" ").trim();
  if (!query) {
    return error(`Error: note ${operation} requires a query`);
  }

  return {
    ok: true,
    command: {
      type: "note",
      operation,
      query,
      direction,
      ...(limit !== undefined ? { limit } : {}),
      ...(format ? { format } : {})
    }
  };
}

function parseNoteCommand(tokens: string[], context: ParseContext): ParseCommandResult {
  if (tokens.length === 0) {
    return error(
      "Error: note requires subcommand new|template|q|quick|capture|open|search|query|graph|links|delete|restore-defaults|reindex|help|root set"
    );
  }

  const operation = tokens[0]?.toLowerCase();
  const rest = tokens.slice(1);

  if (operation === "help" || operation === "--help" || operation === "-h") {
    if (rest.length > 0) {
      return error("Error: note help takes no extra tokens");
    }
    return {
      ok: true,
      command: {
        type: "note",
        operation: "help"
      }
    };
  }

  if (operation === "new") {
    const titleTokens: string[] = [];
    let template: string | undefined;
    for (let index = 0; index < rest.length; index += 1) {
      const token = rest[index] ?? "";
      const lowered = token.toLowerCase();
      if (lowered === "--template" || lowered.startsWith("--template=")) {
        const value =
          lowered === "--template"
            ? (rest[(index += 1)] ?? "")
            : token.slice("--template=".length);
        if (!value.trim()) {
          return error("Error: note new --template requires a value");
        }
        template = value.trim();
        continue;
      }
      titleTokens.push(token);
    }
    const title = titleTokens.join(" ").trim();
    if (!title) {
      return error('Error: note new requires a title (example: note new "Title")');
    }
    return {
      ok: true,
      command: {
        type: "note",
        operation: "new",
        title,
        ...(template ? { template } : {})
      }
    };
  }

  if (operation === "template") {
    const template = rest[0]?.trim() ?? "";
    const title = rest.slice(1).join(" ").trim();
    if (!template) {
      return error('Error: note template requires a template id (example: note template meeting)');
    }
    return {
      ok: true,
      command: {
        type: "note",
        operation: "template",
        template,
        ...(title ? { title } : {})
      }
    };
  }

  if (operation === "q" || operation === "quick" || operation === "capture") {
    return parseNoteQuickCommand(rest, context);
  }

  if (operation === "open") {
    const query = rest.join(" ").trim();
    if (!query) {
      return error('Error: note open requires a query (example: note open "Query")');
    }
    return {
      ok: true,
      command: {
        type: "note",
        operation: "open",
        query
      }
    };
  }

  if (operation === "search") {
    return parseNoteSearchLikeCommand("search", rest, context);
  }

  if (operation === "query") {
    return parseNoteSearchLikeCommand("query", rest, context);
  }

  if (operation === "graph") {
    return parseNoteGraphLikeCommand("graph", rest);
  }

  if (operation === "links") {
    return parseNoteGraphLikeCommand("links", rest);
  }

  if (operation === "delete") {
    const query = rest.join(" ").trim();
    if (!query) {
      return error('Error: note delete requires a query (example: note delete "Query")');
    }
    return {
      ok: true,
      command: {
        type: "note",
        operation: "delete",
        query
      }
    };
  }

  if (operation === "restore-defaults") {
    if (rest.length > 0) {
      return error("Error: note restore-defaults takes no extra tokens");
    }
    return {
      ok: true,
      command: {
        type: "note",
        operation: "restore_defaults"
      }
    };
  }

  if (operation === "reindex") {
    if (rest.length > 0) {
      return error("Error: note reindex takes no extra tokens");
    }
    return {
      ok: true,
      command: {
        type: "note",
        operation: "reindex"
      }
    };
  }

  if (operation === "root") {
    const subOperation = rest[0]?.toLowerCase();
    if (subOperation !== "set") {
      return error('Error: note root only supports "set"');
    }
    const rootPath = rest.slice(1).join(" ").trim();
    if (!rootPath) {
      return error('Error: note root set requires a path (example: note root set "/path/to/notes")');
    }
    return {
      ok: true,
      command: {
        type: "note",
        operation: "root_set",
        path: rootPath
      }
    };
  }

  return error(
    "Error: note requires subcommand new|template|q|quick|capture|open|search|query|graph|links|delete|restore-defaults|reindex|help|root set"
  );
}

const WEEKDAYS = new Set(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

function parseRecurCommand(tokens: string[]): ParseCommandResult {
  if (tokens.length < 2) {
    return error("Error: recur requires target and rule/clear");
  }

  const target = parseCommandTarget(tokens[0]);
  if (!target) {
    return error('Error: recur target must be "@selected" or "id:<task-id>"');
  }

  const second = tokens[1];
  if (second === "clear") {
    if (tokens.length !== 2) {
      return error("Error: recur clear takes no extra tokens");
    }
    return {
      ok: true,
      command: { type: "recur", target, clear: true }
    };
  }

  if (!second.startsWith("every:")) {
    return error('Error: recur requires every:day|week|month');
  }

  const rawEvery = second.slice(6).trim().toLowerCase();
  const normalizedEvery =
    rawEvery === "daily"
      ? "day"
      : rawEvery === "weekly"
        ? "week"
        : rawEvery === "monthly"
          ? "month"
          : rawEvery;

  if (normalizedEvery !== "day" && normalizedEvery !== "week" && normalizedEvery !== "month") {
    return error(`Error: invalid every value "${rawEvery}"`);
  }
  const every = normalizedEvery as RecurEvery;
  let interval = 1;
  let onDays: Array<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"> | undefined;
  let onMonthDays: number[] | undefined;

  for (let i = 2; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.startsWith("interval:")) {
      const raw = token.slice(9).trim();
      if (!/^[0-9]+$/.test(raw)) {
        return error(`Error: invalid interval "${raw}"`);
      }
      const parsedInterval = Number.parseInt(raw, 10);
      if (!Number.isInteger(parsedInterval) || parsedInterval < 1) {
        return error(`Error: invalid interval "${raw}"`);
      }
      interval = parsedInterval;
      continue;
    }
    if (token.startsWith("on:")) {
      const raw = token.slice(3).trim();
      if (!raw) {
        return error("Error: on: value is required");
      }
      const values = raw
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.length > 0);
      if (values.length === 0) {
        return error("Error: on: value is required");
      }
      if (every === "day") {
        return error("Error: on: is not supported for every:day");
      }
      if (every === "week") {
        if (!values.every((value) => WEEKDAYS.has(value))) {
          return error(`Error: invalid weekly on value "${raw}"`);
        }
        onDays = Array.from(new Set(values)) as Array<
          "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
        >;
        continue;
      }
      if (!values.every((value) => /^[0-9]+$/.test(value))) {
        return error(`Error: invalid monthly on value "${raw}"`);
      }
      const parsedMonthDays = Array.from(
        new Set(values.map((value) => Number.parseInt(value, 10)))
      );
      if (
        parsedMonthDays.some((value) => !Number.isInteger(value) || value < 1 || value > 31)
      ) {
        return error(`Error: invalid monthly on value "${raw}"`);
      }
      onMonthDays = parsedMonthDays.sort((left, right) => left - right);
      continue;
    }
    return error(`Error: unrecognized recur token "${token}"`);
  }

  return {
    ok: true,
    command: {
      type: "recur",
      target,
      clear: false,
      every,
      interval,
      ...(onDays ? { onDays } : {}),
      ...(onMonthDays ? { onMonthDays } : {})
    }
  };
}

export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of input) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && /\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }

  if (inQuotes) {
    throw new Error("Error: unmatched quote");
  }
  if (current.length > 0) {
    tokens.push(current);
  }
  return tokens;
}

export function parseCommand(
  input: string,
  options: ParseCommandOptions = {}
): ParseCommandResult {
  const trimmed = input.trim();
  if (!trimmed) return error("Error: command is empty");

  let tokens: string[];
  try {
    tokens = tokenize(trimmed);
  } catch (tokenError) {
    return error(tokenError instanceof Error ? tokenError.message : "Error: invalid command");
  }
  if (tokens.length === 0) return error("Error: command is empty");

  const commandToken = tokens[0];
  const commandName = commandToken.toLowerCase();
  const args = tokens.slice(1);
  const remainder = trimmed.slice(commandToken.length).trimStart();
  const firstTokenQuoted = remainder.startsWith('"');
  const context: ParseContext = {
    now: options.now ?? Date.now(),
    tz: options.tz ?? MINI_DEFAULT_TIMEZONE
  };

  if (commandName === "add") {
    return parseAddCommand(args, firstTokenQuoted, context);
  }
  if (commandName === "done") {
    return parseDoneCommand(args);
  }
  if (commandName === "due") {
    return parseDueCommand(args, context);
  }
  if (commandName === "help") {
    return parseHelpCommand(args);
  }
  if (commandName === "recur") {
    return parseRecurCommand(args);
  }
  if (commandName === "check") {
    return parseCheckCommand(args[0], args.slice(1));
  }
  if (commandName.startsWith("check:")) {
    return parseCheckCommand(commandName.slice("check:".length), args);
  }
  if (commandName === "bulk") {
    return parseBulkCommand(args[0], args.slice(1), context);
  }
  if (commandName.startsWith("bulk:")) {
    return parseBulkCommand(commandName.slice("bulk:".length), args, context);
  }
  if (commandName === "note") {
    return parseNoteCommand(args, context);
  }
  if (commandName.startsWith("note:")) {
    return parseNoteCommand([commandName.slice("note:".length), ...args], context);
  }
  if (commandName === "nq") {
    return parseNoteCommand(["q", ...args], context);
  }
  if (commandName === "tag") {
    return parseTagCommand(args);
  }
  if (commandName.startsWith("tag:")) {
    return parseTagCommand([commandName.slice("tag:".length), ...args]);
  }
  return error(`Error: unknown command "${commandToken}"`);
}
