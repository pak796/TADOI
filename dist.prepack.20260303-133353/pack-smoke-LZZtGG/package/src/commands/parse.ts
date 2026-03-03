import type {
  BulkTarget,
  CommandTarget,
  HelpTopic,
  RecurEvery,
  ParseCommandResult
} from "./types";
import { parseStrictLocalDate, parseStrictTime } from "./validate";

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

function parseAddCommand(tokens: string[], firstTokenQuoted: boolean): ParseCommandResult {
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
      if (!parseStrictLocalDate(value)) {
        return error(`Error: invalid due date "${value}"`);
      }
      dueDate = value;
      continue;
    }
    if (token.startsWith("at:")) {
      if (atTime !== undefined) {
        return error("Error: duplicate at: token");
      }
      const value = token.slice(3).trim();
      if (!value) return error("Error: at: value is required");
      if (!parseStrictTime(value)) {
        return error(`Error: invalid time "${value}"`);
      }
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

function parseDueCommand(tokens: string[]): ParseCommandResult {
  if (tokens.length < 2) {
    return error("Error: due requires target and date/clear");
  }

  const target = parseCommandTarget(tokens[0]);
  if (!target) {
    return error('Error: due target must be "@selected" or "id:<task-id>"');
  }

  const second = tokens[1];
  if (second === "clear") {
    if (tokens.length !== 2) {
      return error("Error: due clear takes no extra tokens");
    }
    return {
      ok: true,
      command: { type: "due", target, clear: true }
    };
  }

  if (!parseStrictLocalDate(second)) {
    return error(`Error: invalid due date "${second}"`);
  }

  if (tokens.length === 2) {
    return {
      ok: true,
      command: {
        type: "due",
        target,
        clear: false,
        dueDate: second
      }
    };
  }

  if (tokens.length > 3) {
    return error("Error: due accepts only one optional at: token");
  }

  const timeToken = tokens[2];
  if (!timeToken.startsWith("at:")) {
    return error('Error: due optional token must be "at:HH:MM"');
  }

  const atTime = timeToken.slice(3).trim();
  if (!atTime) {
    return error("Error: at: value is required");
  }
  if (!parseStrictTime(atTime)) {
    return error(`Error: invalid time "${atTime}"`);
  }

  return {
    ok: true,
    command: {
      type: "due",
      target,
      clear: false,
      dueDate: second,
      atTime
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
  tokens: string[]
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
    const dueDate = rest[0];
    if (!parseStrictLocalDate(dueDate)) {
      return error(`Error: invalid due date "${dueDate}"`);
    }
    if (rest.length === 1) {
      return {
        ok: true,
        command: {
          type: "bulk",
          operation: "due",
          target,
          clear: false,
          dueDate
        }
      };
    }
    if (rest.length !== 2 || !rest[1].startsWith("at:")) {
      return error('Error: bulk due optional token must be "at:HH:MM"');
    }
    const atTime = rest[1].slice(3).trim();
    if (!atTime) {
      return error("Error: at: value is required");
    }
    if (!parseStrictTime(atTime)) {
      return error(`Error: invalid time "${atTime}"`);
    }
    return {
      ok: true,
      command: {
        type: "bulk",
        operation: "due",
        target,
        clear: false,
        dueDate,
        atTime
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
    topic !== "bulk"
  ) {
    return error('Error: help topics are "add", "done", "due", "recur", "check", or "bulk"');
  }

  return {
    ok: true,
    command: { type: "help", topic }
  };
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

export function parseCommand(input: string): ParseCommandResult {
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

  if (commandName === "add") {
    return parseAddCommand(args, firstTokenQuoted);
  }
  if (commandName === "done") {
    return parseDoneCommand(args);
  }
  if (commandName === "due") {
    return parseDueCommand(args);
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
    return parseBulkCommand(args[0], args.slice(1));
  }
  if (commandName.startsWith("bulk:")) {
    return parseBulkCommand(commandName.slice("bulk:".length), args);
  }
  return error(`Error: unknown command "${commandToken}"`);
}
