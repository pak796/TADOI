import { parseCommand } from "../commands/parse";
import { executeCommand } from "../commands/execute";
import type { Command, CommandResult, ParseCommandResult } from "../commands/types";
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
  getTadoiLockPath,
  removeTadoiLock,
  tryAcquireTadoiLock,
  type TadoiLockPayload
} from "../state/lockfile";

export const TITS_CLI_EXIT_CODE = {
  SUCCESS: 0,
  PARSE_OR_VALIDATION: 2,
  TARGET_RESOLUTION: 3,
  LOCKED: 4,
  IO_ERROR: 5
} as const;

type TitsCommandName = "add" | "done" | "due" | "recur" | "help";

type SaveDataOptions = {
  expectedStateRevision?: number;
};

type TitsCliDeps = {
  now: () => number;
  parseCommand: (input: string) => ParseCommandResult;
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
  log: (line: string) => console.log(line),
  error: (line: string) => console.error(line)
};

function isTitsCommandName(value: string): value is TitsCommandName {
  return (
    value === "add" ||
    value === "done" ||
    value === "due" ||
    value === "recur" ||
    value === "help"
  );
}

function toSingleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
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

export function resolveTitsCliInput(
  argv: string[]
): { mode: "raw" | "subcommand"; dsl: string } | null {
  if (argv.length === 0) return null;

  const first = argv[0]?.trim().toLowerCase() ?? "";
  if (isTitsCommandName(first)) {
    const dsl = [first, ...argv.slice(1).map(formatDslToken)].join(" ").trim();
    return { mode: "subcommand", dsl };
  }

  if (argv.length === 1) {
    const raw = argv[0]?.trim() ?? "";
    if (!raw) return null;
    const rawFirst = raw.split(/\s+/)[0]?.toLowerCase() ?? "";
    if (isTitsCommandName(rawFirst)) {
      return { mode: "raw", dsl: raw };
    }
  }

  return null;
}

function commandRequiresInAppSelection(command: Command): boolean {
  return (
    (command.type === "done" || command.type === "due" || command.type === "recur") &&
    command.target.type === "selected"
  );
}

function classifyExecutionError(command: Command): number {
  return command.type === "done" || command.type === "due" || command.type === "recur"
    ? TITS_CLI_EXIT_CODE.TARGET_RESOLUTION
    : TITS_CLI_EXIT_CODE.PARSE_OR_VALIDATION;
}

export async function runTitsCommandCliWithDeps(
  argv: string[],
  deps: TitsCliDeps
): Promise<{ handled: boolean; exitCode?: number }> {
  const resolved = resolveTitsCliInput(argv);
  if (!resolved) {
    return { handled: false };
  }

  const parsed = deps.parseCommand(resolved.dsl);
  if (!parsed.ok) {
    deps.error(toSingleLine(parsed.error));
    return { handled: true, exitCode: TITS_CLI_EXIT_CODE.PARSE_OR_VALIDATION };
  }
  const command = parsed.command;

  if (commandRequiresInAppSelection(command)) {
    deps.error("Error: @selected is only available in-app. Use id:<uuid>.");
    return { handled: true, exitCode: TITS_CLI_EXIT_CODE.PARSE_OR_VALIDATION };
  }

  if (command.type === "help") {
    const result = deps.executeCommand(command, {
      now: deps.now(),
      state: initialState,
      visibleTasks: [],
      selectedTaskId: undefined
    });
    if (result.output.kind === "error") {
      deps.error(toSingleLine(result.output.text));
      return { handled: true, exitCode: TITS_CLI_EXIT_CODE.PARSE_OR_VALIDATION };
    }
    deps.log(toSingleLine(result.output.text));
    return { handled: true, exitCode: TITS_CLI_EXIT_CODE.SUCCESS };
  }

  const dataFilePath = deps.getDataFilePath();
  const lockPath = deps.getLockPath(dataFilePath);
  let lockAcquired = false;

  try {
    lockAcquired = await deps.acquireLock(lockPath, deps.createLockPayload(dataFilePath));
    if (!lockAcquired) {
      deps.error("Error: TADOI is running (lock present).");
      return { handled: true, exitCode: TITS_CLI_EXIT_CODE.LOCKED };
    }

    const loaded = await deps.loadData(dataFilePath);
    const expectedStateRevision =
      typeof loaded.stateRevision === "number" &&
      Number.isInteger(loaded.stateRevision) &&
      loaded.stateRevision >= 0
        ? loaded.stateRevision
        : 0;
    let state = reducer(initialState, { type: "load", data: loaded });
    const now = deps.now();
    const result = deps.executeCommand(command, {
      now,
      state,
      visibleTasks: getVisibleTasks(state, now),
      selectedTaskId: undefined
    });

    if (result.output.kind === "error") {
      deps.error(toSingleLine(result.output.text));
      return { handled: true, exitCode: classifyExecutionError(command) };
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
): Promise<{ handled: boolean; exitCode?: number }> {
  return runTitsCommandCliWithDeps(argv, DEFAULT_DEPS);
}
