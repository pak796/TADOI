import type {
  CommandTarget,
  HelpTopic,
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
  if (topic !== "add" && topic !== "done" && topic !== "due") {
    return error('Error: help topics are "add", "done", or "due"');
  }

  return {
    ok: true,
    command: { type: "help", topic }
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
  return error(`Error: unknown command "${commandToken}"`);
}
