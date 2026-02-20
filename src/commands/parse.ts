import type {
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
  if (topic !== "add" && topic !== "done" && topic !== "due" && topic !== "recur") {
    return error('Error: help topics are "add", "done", "due", or "recur"');
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
  return error(`Error: unknown command "${commandToken}"`);
}
