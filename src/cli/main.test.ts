import { describe, expect, it } from "bun:test";
import { createDefaultEngagementState } from "../domain/engagement";
import type { LoadedData } from "../state/persistence";
import type { TadoiLockPayload } from "../state/lockfile";
import type { CommandOutput, NoteCommand } from "../commands/types";
import { executeCommand } from "../commands/execute";
import { parseCommand } from "../commands/parse";
import {
  TITS_CLI_EXIT_CODE,
  resolveTitsCliInput,
  runTitsCommandCliWithDeps
} from "./main";

function createLoadedData(overrides: Partial<LoadedData> = {}): LoadedData {
  return {
    schemaVersion: 8,
    stateRevision: 0,
    tasks: [],
    tagIndex: {},
    savedViews: [],
    engagement: createDefaultEngagementState(),
    ...overrides
  };
}

function createDeps(options: {
  loadedData?: LoadedData;
  locked?: boolean;
  saveError?: Error;
  releaseError?: Error;
} = {}) {
  const logs: string[] = [];
  const errors: string[] = [];
  const saved: LoadedData[] = [];
  const noteRuns: NoteCommand[] = [];
  let loadedData = options.loadedData ?? createLoadedData();
  let lockAcquired = false;

  const deps = {
    now: () => new Date(2026, 1, 20, 12, 0).getTime(),
    parseCommand,
    executeCommand,
    getDataFilePath: () => "/tmp/tadoi_data.json",
    getLockPath: () => "/tmp/tadoi.lock",
    createLockPayload: (dataFilePath: string): TadoiLockPayload => ({
      pid: 1,
      startedAt: "2026-02-20T12:00:00.000Z",
      version: "test",
      dataFile: dataFilePath
    }),
    acquireLock: async () => {
      if (options.locked) {
        return false;
      }
      if (lockAcquired) {
        return false;
      }
      lockAcquired = true;
      return true;
    },
    releaseLock: async () => {
      if (options.releaseError) {
        throw options.releaseError;
      }
      lockAcquired = false;
    },
    loadData: async () => loadedData,
    saveData: async (data: LoadedData) => {
      if (options.saveError) {
        throw options.saveError;
      }
      loadedData = data;
      saved.push(data);
    },
    runNoteCommand: async (command: NoteCommand): Promise<CommandOutput> => {
      noteRuns.push(command);
      if (command.operation === "help") {
        return {
          kind: "ok",
          text: "NOTES COMMANDS\n- note new \"Title\"      Create note"
        };
      }
      return {
        kind: "ok",
        text: "note command ok"
      };
    },
    log: (line: string) => logs.push(line),
    error: (line: string) => errors.push(line)
  };

  return { deps, logs, errors, saved, noteRuns };
}

describe("resolveTitsCliInput", () => {
  it("resolves subcommand wrapper and raw DSL forms", () => {
    expect(resolveTitsCliInput(["add", "Buy milk", "#errands"])).toEqual({
      mode: "subcommand",
      dsl: 'add "Buy milk" #errands'
    });
    expect(resolveTitsCliInput(['add "Buy milk" #errands'])).toEqual({
      mode: "raw",
      dsl: 'add "Buy milk" #errands'
    });
  });

  it("returns null for non-TITS argv", () => {
    expect(resolveTitsCliInput(["--version"])).toBeNull();
  });

  it("resolves recur wrapper command", () => {
    expect(resolveTitsCliInput(["recur", "id:task-1", "every:week", "on:mon"])).toEqual({
      mode: "subcommand",
      dsl: "recur id:task-1 every:week on:mon"
    });
  });

  it("resolves note wrapper command", () => {
    expect(resolveTitsCliInput(["note", "search", "tag:inbox"])).toEqual({
      mode: "subcommand",
      dsl: "note search tag:inbox"
    });
  });

  it("supports -- delimiter for literal dash-prefixed add titles", () => {
    expect(resolveTitsCliInput(["add", "--", "--help"])).toEqual({
      mode: "subcommand",
      dsl: "add --help"
    });
  });

  it("resolves checklist and all bulk wrapper commands", () => {
    const cases: Array<{ argv: string[]; dsl: string }> = [
      {
        argv: ["check:add", "id:task-1", "Draft", "brief"],
        dsl: "check:add id:task-1 Draft brief"
      },
      {
        argv: ["bulk:done", "id:task-a", "id:task-b"],
        dsl: "bulk:done id:task-a id:task-b"
      },
      {
        argv: ["bulk:tag:add", "id:task-a", "id:task-b", "#home"],
        dsl: "bulk:tag:add id:task-a id:task-b #home"
      },
      {
        argv: ["bulk:tag:rm", "id:task-a", "id:task-b", "#home"],
        dsl: "bulk:tag:rm id:task-a id:task-b #home"
      },
      {
        argv: ["bulk:due", "id:task-a", "id:task-b", "2026-03-01", "at:09:00"],
        dsl: "bulk:due id:task-a id:task-b 2026-03-01 at:09:00"
      },
      {
        argv: ["bulk:due:clear", "id:task-a", "id:task-b"],
        dsl: "bulk:due:clear id:task-a id:task-b"
      },
      {
        argv: ["bulk:priority", "id:task-a", "id:task-b", "#p2"],
        dsl: "bulk:priority id:task-a id:task-b #p2"
      },
      {
        argv: ["bulk:assignee", "id:task-a", "id:task-b", "alice"],
        dsl: "bulk:assignee id:task-a id:task-b alice"
      },
      {
        argv: ["bulk:project", "id:task-a", "id:task-b", "Apollo"],
        dsl: "bulk:project id:task-a id:task-b Apollo"
      },
      {
        argv: ["bulk:stage", "id:task-a", "id:task-b", "doing"],
        dsl: "bulk:stage id:task-a id:task-b doing"
      },
      {
        argv: ["bulk:delete", "id:task-a", "id:task-b"],
        dsl: "bulk:delete id:task-a id:task-b"
      }
    ];

    for (const testCase of cases) {
      expect(resolveTitsCliInput(testCase.argv)).toEqual({
        mode: "subcommand",
        dsl: testCase.dsl
      });
    }
  });
});

describe("runTitsCommandCliWithDeps", () => {
  it("returns locked exit code for write commands when lock is present", async () => {
    const { deps, errors, saved } = createDeps({ locked: true });
    const result = await runTitsCommandCliWithDeps(["add", "X"], deps);

    expect(result).toEqual({ handled: true, exitCode: TITS_CLI_EXIT_CODE.LOCKED });
    expect(errors).toEqual(["Error: TADOI is running (lock present)."]);
    expect(saved).toHaveLength(0);
  });

  it("returns locked exit code for bulk write commands when lock is present", async () => {
    const { deps, errors, saved } = createDeps({ locked: true });
    const result = await runTitsCommandCliWithDeps(["bulk:done", "id:task-a"], deps);

    expect(result).toEqual({ handled: true, exitCode: TITS_CLI_EXIT_CODE.LOCKED });
    expect(errors).toEqual(["Error: TADOI is running (lock present)."]);
    expect(saved).toHaveLength(0);
  });

  it("maps parse/validation failures to exit code 2", async () => {
    const { deps, errors } = createDeps();
    const result = await runTitsCommandCliWithDeps(['add "X" due:2026-02-29'], deps);

    expect(result).toEqual({
      handled: true,
      exitCode: TITS_CLI_EXIT_CODE.PARSE_OR_VALIDATION
    });
    expect(errors[0]).toContain('Error: invalid due date "2026-02-29"');
  });

  it("rejects @selected targets in CLI context", async () => {
    const { deps, errors } = createDeps();
    const result = await runTitsCommandCliWithDeps(["done"], deps);

    expect(result).toEqual({
      handled: true,
      exitCode: TITS_CLI_EXIT_CODE.PARSE_OR_VALIDATION
    });
    expect(errors).toEqual([
      "Error: @selected is only available in-app. Use id:<uuid>."
    ]);
  });

  it("rejects recur @selected target in CLI context", async () => {
    const { deps, errors } = createDeps();
    const result = await runTitsCommandCliWithDeps(["recur", "@selected", "clear"], deps);

    expect(result).toEqual({
      handled: true,
      exitCode: TITS_CLI_EXIT_CODE.PARSE_OR_VALIDATION
    });
    expect(errors).toEqual([
      "Error: @selected is only available in-app. Use id:<uuid>."
    ]);
  });

  it("rejects bulk commands without explicit ids in CLI context", async () => {
    const { deps, errors } = createDeps();
    const result = await runTitsCommandCliWithDeps(["bulk", "done"], deps);
    expect(result).toEqual({
      handled: true,
      exitCode: TITS_CLI_EXIT_CODE.PARSE_OR_VALIDATION
    });
    expect(errors).toEqual([
      'Error: CLI bulk commands require repeated "id:<task-id>" targets.'
    ]);
  });

  it("maps done/due target resolution failures to exit code 3", async () => {
    const { deps, errors } = createDeps();
    const result = await runTitsCommandCliWithDeps(["done", "id:not-a-real-id"], deps);

    expect(result).toEqual({
      handled: true,
      exitCode: TITS_CLI_EXIT_CODE.TARGET_RESOLUTION
    });
    expect(errors[0]).toContain("Error: done requires an existing selected task or id");
  });

  it("supports due id:<uuid> clear and persists due removal", async () => {
    const task = {
      id: "task-1",
      title: "Clear my due",
      status: "open" as const,
      createdAt: 1,
      updatedAt: 2,
      dueAt: new Date(2026, 2, 5, 9, 0).getTime(),
      hasExplicitTime: true,
      tags: []
    };
    const { deps, logs, errors, saved } = createDeps({
      loadedData: createLoadedData({ tasks: [task] })
    });

    const result = await runTitsCommandCliWithDeps(["due", "id:task-1", "clear"], deps);
    expect(result).toEqual({ handled: true, exitCode: TITS_CLI_EXIT_CODE.SUCCESS });
    expect(errors).toHaveLength(0);
    expect(logs).toEqual(["Due cleared: Clear my due"]);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.tasks[0]?.dueAt).toBeUndefined();
    expect(saved[0]?.tasks[0]?.hasExplicitTime).toBe(false);
  });

  it("supports done selector mode and applies bulk done to matched tasks", async () => {
    const { deps, logs, errors, saved } = createDeps({
      loadedData: createLoadedData({
        tasks: [
          {
            id: "task-open-work",
            title: "Work task",
            status: "open",
            createdAt: 1,
            updatedAt: 1,
            tags: ["work"]
          },
          {
            id: "task-open-home",
            title: "Home task",
            status: "open",
            createdAt: 1,
            updatedAt: 1,
            tags: ["home"]
          }
        ]
      })
    });

    const result = await runTitsCommandCliWithDeps(["done", "+work"], deps);
    expect(result).toEqual({ handled: true, exitCode: TITS_CLI_EXIT_CODE.SUCCESS });
    expect(errors).toHaveLength(0);
    expect(logs).toEqual(["Bulk done applied (1 tasks)"]);
    expect(saved).toHaveLength(1);
    const savedTask = saved[0]?.tasks.find((task) => task.id === "task-open-work");
    expect(savedTask?.status).toBe("done");
  });

  it("supports due selector mode with date/time", async () => {
    const { deps, logs, errors, saved } = createDeps({
      loadedData: createLoadedData({
        tasks: [
          {
            id: "task-open-work",
            title: "Work task",
            status: "open",
            createdAt: 1,
            updatedAt: 1,
            tags: ["work"]
          }
        ]
      })
    });

    const result = await runTitsCommandCliWithDeps(
      ["due", "+work", "2026-03-05", "at:09:00"],
      deps
    );
    expect(result).toEqual({ handled: true, exitCode: TITS_CLI_EXIT_CODE.SUCCESS });
    expect(errors).toHaveLength(0);
    expect(logs).toEqual(["Bulk due set (1 tasks)"]);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.tasks[0]?.dueAt).toBeDefined();
    expect(saved[0]?.tasks[0]?.hasExplicitTime).toBe(true);
  });

  it("supports due selector mode clear with selector due filter", async () => {
    const { deps, logs, errors, saved } = createDeps({
      loadedData: createLoadedData({
        tasks: [
          {
            id: "task-open-work",
            title: "Work task",
            status: "open",
            createdAt: 1,
            updatedAt: 1,
            dueAt: new Date(2026, 1, 20, 8, 0).getTime(),
            hasExplicitTime: true,
            tags: ["work"]
          }
        ]
      })
    });

    const result = await runTitsCommandCliWithDeps(
      ["due", "+work", "due:today", "clear"],
      deps
    );
    expect(result).toEqual({ handled: true, exitCode: TITS_CLI_EXIT_CODE.SUCCESS });
    expect(errors).toHaveLength(0);
    expect(logs).toEqual(["Bulk due cleared (1 tasks)"]);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.tasks[0]?.dueAt).toBeUndefined();
    expect(saved[0]?.tasks[0]?.hasExplicitTime).toBe(false);
  });

  it("returns target resolution when selector mode matches no tasks", async () => {
    const { deps, errors, saved } = createDeps({
      loadedData: createLoadedData({
        tasks: [
          {
            id: "task-open-home",
            title: "Home task",
            status: "open",
            createdAt: 1,
            updatedAt: 1,
            tags: ["home"]
          }
        ]
      })
    });

    const result = await runTitsCommandCliWithDeps(["done", "+work"], deps);
    expect(result).toEqual({
      handled: true,
      exitCode: TITS_CLI_EXIT_CODE.TARGET_RESOLUTION
    });
    expect(errors).toEqual(["Error: no tasks match selector."]);
    expect(saved).toHaveLength(0);
  });

  it("rejects mixed id and selector tokens in selector mode", async () => {
    const { deps, errors, saved } = createDeps();
    const result = await runTitsCommandCliWithDeps(["done", "id:task-a", "+work"], deps);
    expect(result).toEqual({
      handled: true,
      exitCode: TITS_CLI_EXIT_CODE.PARSE_OR_VALIDATION
    });
    expect(errors).toEqual([
      'Error: selector mode does not accept "id:<task-id>" tokens.'
    ]);
    expect(saved).toHaveLength(0);
  });

  it("allows help even if lock is present", async () => {
    const { deps, logs, saved } = createDeps({ locked: true });
    const result = await runTitsCommandCliWithDeps(["help"], deps);

    expect(result).toEqual({ handled: true, exitCode: TITS_CLI_EXIT_CODE.SUCCESS });
    expect(logs).toEqual([
      "Commands: add, done, due, recur, check, bulk, note, help. Try: help note"
    ]);
    expect(saved).toHaveLength(0);
  });

  it("handles note help without lock and preserves multiline output", async () => {
    const { deps, logs, errors, saved, noteRuns } = createDeps({ locked: true });
    const result = await runTitsCommandCliWithDeps(["note", "--help"], deps);

    expect(result).toEqual({ handled: true, exitCode: TITS_CLI_EXIT_CODE.SUCCESS });
    expect(errors).toHaveLength(0);
    expect(saved).toHaveLength(0);
    expect(noteRuns).toEqual([]);
    expect(logs[0]).toContain("NOTES COMMANDS");
    expect(logs[0]).toContain('note new "Title"');
  });

  it("routes note commands through shared notes runner", async () => {
    const { deps, logs, errors, saved, noteRuns } = createDeps();
    const result = await runTitsCommandCliWithDeps(["note", "reindex"], deps);

    expect(result).toEqual({ handled: true, exitCode: TITS_CLI_EXIT_CODE.SUCCESS });
    expect(errors).toHaveLength(0);
    expect(saved).toHaveLength(0);
    expect(noteRuns).toEqual([
      {
        type: "note",
        operation: "reindex"
      }
    ]);
    expect(logs).toEqual(["note command ok"]);
  });

  it("preserves multiline output for non-help note commands", async () => {
    const { deps, logs, errors, saved } = createDeps();
    deps.runNoteCommand = async () => ({
      kind: "ok",
      text: "Opened note (title): Design\nPath: notes/Design.md\nGraph: out=1 back=0 tasks=0 broken=0"
    });

    const result = await runTitsCommandCliWithDeps(["note", "open", "Design"], deps);

    expect(result).toEqual({ handled: true, exitCode: TITS_CLI_EXIT_CODE.SUCCESS });
    expect(errors).toHaveLength(0);
    expect(saved).toHaveLength(0);
    expect(logs).toEqual([
      "Opened note (title): Design\nPath: notes/Design.md\nGraph: out=1 back=0 tasks=0 broken=0"
    ]);
  });

  it("treats <command> --help as non-mutating wrapper help", async () => {
    const { deps, logs, errors, saved } = createDeps({ locked: true });
    const result = await runTitsCommandCliWithDeps(["add", "--help"], deps);

    expect(result).toEqual({ handled: true, exitCode: TITS_CLI_EXIT_CODE.SUCCESS });
    expect(errors).toHaveLength(0);
    expect(saved).toHaveLength(0);
    expect(logs[0]).toContain("add <title>");
  });

  it("treats add -- --help as a literal title and persists", async () => {
    const { deps, logs, errors, saved } = createDeps();
    const result = await runTitsCommandCliWithDeps(["add", "--", "--help"], deps);

    expect(result).toEqual({ handled: true, exitCode: TITS_CLI_EXIT_CODE.SUCCESS });
    expect(errors).toHaveLength(0);
    expect(logs[0]).toContain("Added task: --help");
    expect(saved).toHaveLength(1);
    expect(saved[0]?.tasks[0]?.title).toBe("--help");
  });

  it("permits only one concurrent writer when lock is already acquired", async () => {
    let lockHeld = false;
    let allowFirstSave = false;
    let resolveFirstAcquired: () => void = () => {};
    const firstAcquired = new Promise<void>((resolve) => {
      resolveFirstAcquired = resolve;
    });

    const makeDeps = () => {
      const base = createDeps({ loadedData: createLoadedData() });
      return {
        ...base,
        deps: {
          ...base.deps,
          createLockPayload: (): TadoiLockPayload => ({
            pid: 99,
            startedAt: "2026-02-20T12:00:00.000Z",
            version: "test"
          }),
          acquireLock: async () => {
            if (lockHeld) return false;
            lockHeld = true;
            resolveFirstAcquired();
            return true;
          },
          releaseLock: async () => {
            lockHeld = false;
          },
          saveData: async (data: LoadedData) => {
            while (!allowFirstSave) {
              await new Promise((resolve) => setTimeout(resolve, 1));
            }
            base.saved.push(data);
          }
        }
      };
    };

    const first = makeDeps();
    const second = makeDeps();

    const firstRun = runTitsCommandCliWithDeps(["add", "First"], first.deps);
    await firstAcquired;

    const secondRun = await runTitsCommandCliWithDeps(["add", "Second"], second.deps);
    expect(secondRun).toEqual({ handled: true, exitCode: TITS_CLI_EXIT_CODE.LOCKED });
    expect(second.errors).toEqual(["Error: TADOI is running (lock present)."]);
    expect(second.saved).toHaveLength(0);

    allowFirstSave = true;
    const firstResult = await firstRun;
    expect(firstResult).toEqual({ handled: true, exitCode: TITS_CLI_EXIT_CODE.SUCCESS });
    expect(first.saved).toHaveLength(1);
  });
});
