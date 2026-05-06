import {
  parseCommand,
  resolveTitsCommandAlias,
  type ParseCommandOptions
} from "../commands/parse";
import { executeCommand } from "../commands/execute";
import path from "path";
import type {
  BulkCommand,
  Command,
  CommandResult,
  HelpTopic,
  NoteCommand,
  ParseCommandResult
} from "../commands/types";
import { filterTasks } from "../domain/query";
import {
  MINI_DEFAULT_TIMEZONE,
  canonicalizeDueAtInput
} from "../lib/datetime/due_at_canonicalizer";
import { getVisibleTasks, initialState, reducer } from "../state/store";
import {
  CURRENT_SCHEMA_VERSION,
  getDataFilePath,
  safeLoadState,
  saveStateAtomic,
  type LoadedData
} from "../state/persistence";
import {
  createDefaultLockPayload,
  formatTadoiLockBusyMessage,
  getTadoiLockPath,
  removeTadoiLock,
  tryAcquireTadoiLock,
  type TadoiLockPayload
} from "../state/lockfile";
import { CLI_EXIT_CODE } from "./exitCodes";
import { parseSelectorTokens } from "./selectors";
import { runNoteCommandCli } from "./noteCommands";
import type { ExecuteNoteCommandResult } from "../notes/commands";
import { redactedLogger } from "../logging/redactedLogger";

export const TITS_CLI_EXIT_CODE = CLI_EXIT_CODE;

type TitsCommandName =
  | "add"
  | "done"
  | "due"
  | "recur"
  | "check"
  | "bulk"
  | "check:add"
  | "check:toggle"
  | "check:edit"
  | "check:del"
  | "check:clear"
  | "bulk:done"
  | "bulk:tag:add"
  | "bulk:tag:rm"
  | "bulk:due"
  | "bulk:due:clear"
  | "bulk:priority"
  | "bulk:assignee"
  | "bulk:project"
  | "bulk:stage"
  | "bulk:delete"
  | "note"
  | "capture"
  | "nq"
  | "help";

type SaveDataOptions = {
  expectedStateRevision?: number;
};

type TitsCliDeps = {
  now: () => number;
  parseCommand: (input: string, options?: ParseCommandOptions) => ParseCommandResult;
  executeCommand: (
    command: Command,
    ctx: Parameters<typeof executeCommand>[1]
  ) => CommandResult;
  getDataFilePath: () => string;
  getLockPath: (dataFilePath: string) => string;
  createLockPayload: (dataFilePath: string) => TadoiLockPayload;
  acquireLock: (lockPath: string, payload: TadoiLockPayload) => Promise<boolean>;
  releaseLock: (lockPath: string) => Promise<void>;
  loadData: (filePath: string) => Promise<LoadedData>;
  saveData: (data: LoadedData, filePath: string, options?: SaveDataOptions) => Promise<void>;
  runNoteCommand: (
    command: NoteCommand,
    dataFilePath: string,
    options?: {
      tasks?: LoadedData["tasks"];
      selectedTaskId?: string;
    }
  ) => Promise<ExecuteNoteCommandResult>;
  readStdin: () => Promise<string>;
  log: (line: string) => void;
  error: (line: string) => void;
};

const DEFAULT_DEPS: TitsCliDeps = {
  now: () => Date.now(),
  parseCommand,
  executeCommand,
  getDataFilePath,
  getLockPath: getTadoiLockPath,
  createLockPayload: createDefaultLockPayload,
  acquireLock: tryAcquireTadoiLock,
  releaseLock: removeTadoiLock,
  loadData: async (filePath: string) => {
    const result = await safeLoadState({ filePath });
    return result.data;
  },
  saveData: async (data: LoadedData, filePath: string, options?: SaveDataOptions) => {
    await saveStateAtomic(data, filePath, undefined, options);
  },
  runNoteCommand: runNoteCommandCli,
  readStdin: async () => {
    if (process.stdin.isTTY) return "";
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        if (typeof chunk === "string") {
          chunks.push(Buffer.from(chunk));
        } else {
          chunks.push(chunk);
        }
      }
      return Buffer.concat(chunks).toString("utf8");
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      redactedLogger.error(
        `Warning: could not read stdin (${reason}); continuing without piped input.`
      );
      return "";
    }
  },
  log: (line: string) => redactedLogger.log(line),
  error: (line: string) => redactedLogger.error(line)
};

function isTitsCommandName(value: string): value is TitsCommandName {
  return (
    value === "add" ||
    value === "done" ||
    value === "due" ||
    value === "recur" ||
    value === "check" ||
    value === "bulk" ||
    value === "check:add" ||
    value === "check:toggle" ||
    value === "check:edit" ||
    value === "check:del" ||
    value === "check:clear" ||
    value === "bulk:done" ||
    value === "bulk:tag:add" ||
    value === "bulk:tag:rm" ||
    value === "bulk:due" ||
    value === "bulk:due:clear" ||
    value === "bulk:priority" ||
    value === "bulk:assignee" ||
    value === "bulk:project" ||
    value === "bulk:stage" ||
    value === "bulk:delete" ||
    value === "note" ||
    value === "capture" ||
    value === "nq" ||
    value === "help"
  );
}

function toSingleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function formatCliOutput(
  text: string,
  options: { preserveMultiline?: boolean } = {}
): string {
  if (options.preserveMultiline) {
    return text.trimEnd();
  }
  return toSingleLine(text);
}

function shouldPreserveHelpFormatting(command: Command): boolean {
  return command.type === "help";
}

function formatDslToken(token: string): string {
  if (token.length === 0) {
    return "\"\"";
  }
  if (/\s/.test(token) && !token.includes('"')) {
    return `"${token}"`;
  }
  return token;
}

function isHelpFlag(token: string): boolean {
  return token === "--help" || token === "-h";
}

function resolveWrapperHelpCommand(argv: string[]): Command | null {
  if (argv.length < 2) {
    return null;
  }
  const first = resolveTitsCommandAlias(argv[0]?.trim() ?? "");
  if (!isTitsCommandName(first)) {
    return null;
  }
  if (!isHelpFlag(argv[1] ?? "") || argv.length !== 2) {
    return null;
  }

  if (first === "help") {
    return { type: "help" };
  }

  const topic = (
    first === "note" || first === "nq" || first === "capture"
      ? "note"
      : first.startsWith("check")
        ? "check"
        : first.startsWith("bulk")
          ? "bulk"
          : first
  ) as HelpTopic;
  return {
    type: "help",
    topic
  };
}

export function resolveTitsCliInput(
  argv: string[]
): { mode: "raw" | "subcommand"; dsl: string } | null {
  if (argv.length === 0) return null;

  const first = resolveTitsCommandAlias(argv[0]?.trim() ?? "");
  if (isTitsCommandName(first)) {
    const tail = argv.slice(1);
    const delimiterIndex = tail.indexOf("--");
    const normalizedTail =
      delimiterIndex >= 0
        ? [...tail.slice(0, delimiterIndex), ...tail.slice(delimiterIndex + 1)]
        : tail;
    const dsl = [first, ...normalizedTail.map(formatDslToken)].join(" ").trim();
    return { mode: "subcommand", dsl };
  }

  if (argv.length === 1) {
    const raw = argv[0]?.trim() ?? "";
    if (!raw) return null;
    const rawFirst = resolveTitsCommandAlias(raw.split(/\s+/)[0] ?? "");
    if (isTitsCommandName(rawFirst)) {
      return { mode: "raw", dsl: raw };
    }
  }

  return null;
}

function commandRequiresInAppSelection(command: Command): boolean {
  if (
    (command.type === "done" || command.type === "due" || command.type === "recur") &&
    command.target.type === "selected"
  ) {
    return true;
  }
  if (command.type === "check" && command.target.type === "selected") {
    return true;
  }
  if (command.type === "bulk" && command.target.type === "marked") {
    return true;
  }
  if (
    command.type === "note" &&
    command.operation === "quick" &&
    command.target?.type === "selected"
  ) {
    return true;
  }
  return false;
}

function classifyExecutionError(command: Command, outputText: string): number {
  if (
    outputText.includes("requires an existing selected task or id") ||
    outputText.includes("target id not found")
  ) {
    return TITS_CLI_EXIT_CODE.TARGET_RESOLUTION;
  }
  if (
    command.type === "done" ||
    command.type === "due" ||
    command.type === "recur" ||
    command.type === "check"
  ) {
    return TITS_CLI_EXIT_CODE.TARGET_RESOLUTION;
  }
  return TITS_CLI_EXIT_CODE.PARSE_OR_VALIDATION;
}

type SelectorCommandIntent =
  | {
      kind: "done";
      selectorTokens: string[];
    }
  | {
      kind: "due";
      selectorTokens: string[];
      clear: true;
    }
  | {
      kind: "due";
      selectorTokens: string[];
      clear: false;
      dueDate: string;
      atTime?: string;
    };

function parseSelectorIntent(
  argv: string[],
  now: number,
  tz: string
): {
  ok: true;
  intent: SelectorCommandIntent;
} | {
  ok: false;
  error: string;
} | null {
  const command = resolveTitsCommandAlias(argv[0]?.trim() ?? "");
  if (command !== "done" && command !== "due") {
    return null;
  }

  const args = argv.slice(1);
  if (args.length === 0) {
    return null;
  }
  if (isHelpFlag(args[0] ?? "") && args.length === 1) {
    return null;
  }

  if (command === "done") {
    const idTokens = args.filter((token) => token.startsWith("id:"));
    if (idTokens.length === 1 && args.length === 1) {
      return null;
    }
    if (idTokens.length === args.length) {
      return null;
    }
    if (idTokens.length > 0) {
      return {
        ok: false,
        error: 'Error: selector mode does not accept "id:<task-id>" tokens.'
      };
    }
    return {
      ok: true,
      intent: {
        kind: "done",
        selectorTokens: args
      }
    };
  }

  const first = args[0] ?? "";
  if (first.startsWith("id:") || first === "@selected") {
    return null;
  }
  if (args.some((token) => token.startsWith("id:"))) {
    return {
      ok: false,
      error: 'Error: selector mode does not accept "id:<task-id>" tokens.'
    };
  }

  const tail = [...args];
  let atInput: string | undefined;
  const maybeAt = tail[tail.length - 1] ?? "";
  if (maybeAt.startsWith("at:")) {
    const value = maybeAt.slice(3).trim();
    if (!value) {
      return { ok: false, error: "Error: at: value is required" };
    }
    atInput = value;
    tail.pop();
  }

  if (tail.length < 2) {
    return {
      ok: false,
      error: "Error: due selector mode requires selectors and date/clear."
    };
  }

  const dueArg = tail.pop() ?? "";
  if (dueArg === "clear") {
    if (atInput) {
      return { ok: false, error: "Error: due clear takes no at: token" };
    }
    return {
      ok: true,
      intent: {
        kind: "due",
        selectorTokens: tail,
        clear: true
      }
    };
  }

  const dueCandidates = [
    { selectorTokens: tail, dueInput: dueArg },
    ...(tail.length > 0
      ? [{ selectorTokens: tail.slice(0, -1), dueInput: `${tail[tail.length - 1]} ${dueArg}` }]
      : [])
  ];

  let firstSelectorError: string | undefined;
  let firstDueError: string | undefined;
  for (const candidate of dueCandidates) {
    if (candidate.selectorTokens.length === 0) {
      continue;
    }

    const selectorCheck = parseSelectorTokens(candidate.selectorTokens, {
      status: "open",
      due: "any"
    });
    if (!selectorCheck.ok) {
      if (!firstSelectorError) {
        firstSelectorError = selectorCheck.error;
      }
      continue;
    }

    const canonicalized = canonicalizeDueAtInput(candidate.dueInput, atInput, {
      now,
      tz
    });
    if (!canonicalized.ok) {
      if (!firstDueError) {
        firstDueError = canonicalized.message;
      }
      continue;
    }

    return {
      ok: true,
      intent: {
        kind: "due",
        selectorTokens: candidate.selectorTokens,
        clear: false,
        dueDate: canonicalized.dueDate,
        ...(canonicalized.atTime ? { atTime: canonicalized.atTime } : {})
      }
    };
  }

  if (firstDueError) {
    return { ok: false, error: firstDueError };
  }
  if (firstSelectorError) {
    return { ok: false, error: firstSelectorError };
  }

  return {
    ok: false,
    error: "Error: due selector mode requires selectors and date/clear."
  };
}

function buildSelectorCommand(
  intent: SelectorCommandIntent,
  state: Parameters<typeof reducer>[0],
  now: number
): { ok: true; command: BulkCommand } | { ok: false; error: string; exitCode: number } {
  const selectorResult = parseSelectorTokens(intent.selectorTokens, {
    status: "open",
    due: "any"
  });
  if (!selectorResult.ok) {
    return {
      ok: false,
      error: selectorResult.error,
      exitCode: TITS_CLI_EXIT_CODE.PARSE_OR_VALIDATION
    };
  }

  const ids = filterTasks(state.tasks, selectorResult.filters, now)
    .map((task) => task.id)
    .sort((left, right) => left.localeCompare(right));
  if (ids.length === 0) {
    return {
      ok: false,
      error: "Error: no tasks match selector.",
      exitCode: TITS_CLI_EXIT_CODE.TARGET_RESOLUTION
    };
  }

  if (intent.kind === "done") {
    return {
      ok: true,
      command: {
        type: "bulk",
        operation: "done",
        target: { type: "ids", ids }
      }
    };
  }

  if (intent.clear) {
    return {
      ok: true,
      command: {
        type: "bulk",
        operation: "due",
        target: { type: "ids", ids },
        clear: true
      }
    };
  }

  return {
    ok: true,
    command: {
      type: "bulk",
      operation: "due",
      target: { type: "ids", ids },
      clear: false,
      dueDate: intent.dueDate,
      ...(intent.atTime ? { atTime: intent.atTime } : {})
    }
  };
}

export async function runTitsCommandCliWithDeps(
  argv: string[],
  deps: TitsCliDeps
): Promise<{ handled: boolean; exitCode?: number; data?: unknown }> {
  const invocationNow = deps.now();
  const wrapperHelpCommand = resolveWrapperHelpCommand(argv);
  if (wrapperHelpCommand) {
    const result = deps.executeCommand(wrapperHelpCommand, {
      now: invocationNow,
      state: initialState,
      visibleTasks: [],
      selectedTaskId: undefined
    });
    if (result.output.kind === "error") {
      deps.error(toSingleLine(result.output.text));
      return { handled: true, exitCode: TITS_CLI_EXIT_CODE.PARSE_OR_VALIDATION };
    }
    deps.log(
      formatCliOutput(result.output.text, {
        preserveMultiline: shouldPreserveHelpFormatting(wrapperHelpCommand)
      })
    );
    return { handled: true, exitCode: TITS_CLI_EXIT_CODE.SUCCESS };
  }

  const selectorIntentResult = parseSelectorIntent(
    argv,
    invocationNow,
    MINI_DEFAULT_TIMEZONE
  );
  if (selectorIntentResult && !selectorIntentResult.ok) {
    deps.error(selectorIntentResult.error);
    return { handled: true, exitCode: TITS_CLI_EXIT_CODE.PARSE_OR_VALIDATION };
  }

  const selectorIntent = selectorIntentResult?.intent;

  let parsedCommand: Command | null = null;
  if (!selectorIntent) {
    const resolved = resolveTitsCliInput(argv);
    if (!resolved) {
      return { handled: false };
    }
    const parsed = deps.parseCommand(resolved.dsl, {
      now: invocationNow,
      tz: MINI_DEFAULT_TIMEZONE
    });
    if (!parsed.ok) {
      deps.error(toSingleLine(parsed.error));
      return { handled: true, exitCode: TITS_CLI_EXIT_CODE.PARSE_OR_VALIDATION };
    }
    parsedCommand = parsed.command;

    if (parsedCommand.type === "note" && parsedCommand.operation === "quick" && !parsedCommand.body) {
      const stdinBody = (await deps.readStdin()).trimEnd();
      if (stdinBody.trim().length > 0) {
        parsedCommand = {
          ...parsedCommand,
          stdinBody
        };
      }
    }
    if (
      parsedCommand.type === "note" &&
      parsedCommand.operation === "quick" &&
      parsedCommand.target?.type === "id" &&
      !parsedCommand.captureMode
    ) {
      parsedCommand = {
        ...parsedCommand,
        captureMode: "append"
      };
    }

    if (commandRequiresInAppSelection(parsedCommand)) {
      if (parsedCommand.type === "bulk") {
        deps.error('Error: CLI bulk commands require repeated "id:<task-id>" targets.');
      } else {
        deps.error("Error: @selected is only available in-app. Use id:<uuid>.");
      }
      return { handled: true, exitCode: TITS_CLI_EXIT_CODE.PARSE_OR_VALIDATION };
    }

    if (parsedCommand.type === "help") {
      const result = deps.executeCommand(parsedCommand, {
        now: invocationNow,
        state: initialState,
        visibleTasks: [],
        selectedTaskId: undefined
      });
      if (result.output.kind === "error") {
        deps.error(toSingleLine(result.output.text));
        return { handled: true, exitCode: TITS_CLI_EXIT_CODE.PARSE_OR_VALIDATION };
      }
      deps.log(
        formatCliOutput(result.output.text, {
          preserveMultiline: shouldPreserveHelpFormatting(parsedCommand)
        })
      );
      return { handled: true, exitCode: TITS_CLI_EXIT_CODE.SUCCESS };
    }

    if (parsedCommand.type === "note" && parsedCommand.operation === "help") {
      const result = await deps.runNoteCommand(parsedCommand, deps.getDataFilePath());
      if (result.output.kind === "error") {
        deps.error(toSingleLine(result.output.text));
        return { handled: true, exitCode: TITS_CLI_EXIT_CODE.PARSE_OR_VALIDATION };
      }
      deps.log(formatCliOutput(result.output.text, { preserveMultiline: true }));
      return {
        handled: true,
        exitCode: TITS_CLI_EXIT_CODE.SUCCESS,
        ...(result.data !== undefined ? { data: result.data } : {})
      };
    }
  }

  const dataFilePath = deps.getDataFilePath();
  const lockPath = deps.getLockPath(dataFilePath);
  let lockAcquired = false;

  try {
    lockAcquired = await deps.acquireLock(lockPath, deps.createLockPayload(dataFilePath));
    if (!lockAcquired) {
      deps.error(await formatTadoiLockBusyMessage(lockPath));
      return { handled: true, exitCode: TITS_CLI_EXIT_CODE.LOCKED };
    }

    if (parsedCommand?.type === "note") {
      const loadedForNote = await deps.loadData(dataFilePath);
      const noteExpectedStateRevision =
        typeof loadedForNote.stateRevision === "number" &&
        Number.isInteger(loadedForNote.stateRevision) &&
        loadedForNote.stateRevision >= 0
          ? loadedForNote.stateRevision
          : 0;
      const result = await deps.runNoteCommand(parsedCommand, dataFilePath, {
        tasks: loadedForNote.tasks
      });
      if (result.output.kind === "error") {
        deps.error(toSingleLine(result.output.text));
        return { handled: true, exitCode: TITS_CLI_EXIT_CODE.PARSE_OR_VALIDATION };
      }
      if (result.taskSideEffects) {
        const sideEffect = result.taskSideEffects;
        const taskIndex = loadedForNote.tasks.findIndex((task) => task.id === sideEffect.taskId);
        if (taskIndex >= 0) {
          const targetTask = loadedForNote.tasks[taskIndex];
          const nextNoteRef =
            sideEffect.primaryNoteAction === "set" && sideEffect.primaryNotePath
              ? result.noteId
                ? { type: "id" as const, value: result.noteId }
                : {
                    type: "filename" as const,
                    value: path.posix.basename(sideEffect.primaryNotePath)
                  }
              : targetTask.noteRef;
          const nextInlineNotes = sideEffect.clearInlineNotes ? undefined : targetTask.notes;
          const shouldUpdateTask =
            nextNoteRef !== targetTask.noteRef || nextInlineNotes !== targetTask.notes;
          if (shouldUpdateTask) {
            const nextTasks = [...loadedForNote.tasks];
            nextTasks[taskIndex] = {
              ...targetTask,
              noteRef: nextNoteRef,
              notes: nextInlineNotes,
              updatedAt: invocationNow
            };
            await deps.saveData(
              {
                ...loadedForNote,
                tasks: nextTasks
              },
              dataFilePath,
              { expectedStateRevision: noteExpectedStateRevision }
            );
          }
        }
      }
      deps.log(formatCliOutput(result.output.text, { preserveMultiline: true }));
      return {
        handled: true,
        exitCode: TITS_CLI_EXIT_CODE.SUCCESS,
        ...(result.data !== undefined ? { data: result.data } : {})
      };
    }

    const loaded = await deps.loadData(dataFilePath);
    const expectedStateRevision =
      typeof loaded.stateRevision === "number" &&
      Number.isInteger(loaded.stateRevision) &&
      loaded.stateRevision >= 0
        ? loaded.stateRevision
        : 0;
    let state = reducer(initialState, { type: "load", data: loaded });
    const now = invocationNow;
    const command = (() => {
      if (!selectorIntent) {
        return parsedCommand as Command;
      }
      const resolved = buildSelectorCommand(selectorIntent, state, now);
      if (!resolved.ok) {
        deps.error(resolved.error);
        return resolved;
      }
      return resolved.command;
    })();

    if ("ok" in command && command.ok === false) {
      return {
        handled: true,
        exitCode: command.exitCode
      };
    }

    const result = deps.executeCommand(command, {
      now,
      state,
      visibleTasks: getVisibleTasks(state, now),
      selectedTaskId: undefined
    });

    if (result.output.kind === "error") {
      deps.error(toSingleLine(result.output.text));
      return {
        handled: true,
        exitCode: classifyExecutionError(command, result.output.text)
      };
    }

    for (const action of result.actions) {
      state = reducer(state, action);
    }

    await deps.saveData(
      {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        tasks: state.tasks,
        tagIndex: state.tagIndex,
        savedViews: state.savedViews,
        engagement: state.engagement
      },
      dataFilePath,
      { expectedStateRevision }
    );

    deps.log(toSingleLine(result.output.text));
    return { handled: true, exitCode: TITS_CLI_EXIT_CODE.SUCCESS };
  } catch (error: unknown) {
    deps.error(
      `Error: could not read/write data file (${error instanceof Error ? error.message : String(error)})`
    );
    return { handled: true, exitCode: TITS_CLI_EXIT_CODE.IO_ERROR };
  } finally {
    if (lockAcquired) {
      try {
        await deps.releaseLock(lockPath);
      } catch (error: unknown) {
        deps.error(
          `Warning: could not release lock file (${error instanceof Error ? error.message : String(error)})`
        );
      }
    }
  }
}

export async function runTitsCommandCli(
  argv: string[]
): Promise<{ handled: boolean; exitCode?: number; data?: unknown }> {
  return runTitsCommandCliWithDeps(argv, DEFAULT_DEPS);
}
