import { describe, expect, it } from "bun:test";
import { createDefaultEngagementState } from "../domain/engagement";
import type { LoadedData } from "../state/persistence";
import { executeCommand } from "../commands/execute";
import { parseCommand } from "../commands/parse";
import {
  TITS_CLI_EXIT_CODE,
  resolveTitsCliInput,
  runTitsCommandCliWithDeps
} from "./main";

function createLoadedData(overrides: Partial<LoadedData> = {}): LoadedData {
  return {
    schemaVersion: 5,
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
} = {}) {
  const logs: string[] = [];
  const errors: string[] = [];
  const saved: LoadedData[] = [];
  let loadedData = options.loadedData ?? createLoadedData();

  const deps = {
    now: () => new Date(2026, 1, 20, 12, 0).getTime(),
    parseCommand,
    executeCommand,
    getDataFilePath: () => "/tmp/tadoi_data.json",
    getLockPath: () => "/tmp/tadoi.lock",
    isLockPresent: async () => options.locked ?? false,
    loadData: async () => loadedData,
    saveData: async (data: LoadedData) => {
      if (options.saveError) {
        throw options.saveError;
      }
      loadedData = data;
      saved.push(data);
    },
    log: (line: string) => logs.push(line),
    error: (line: string) => errors.push(line)
  };

  return { deps, logs, errors, saved };
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
});

describe("runTitsCommandCliWithDeps", () => {
  it("returns locked exit code for write commands when lock is present", async () => {
    const { deps, errors, saved } = createDeps({ locked: true });
    const result = await runTitsCommandCliWithDeps(["add", "X"], deps);

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

  it("allows help even if lock is present", async () => {
    const { deps, logs, saved } = createDeps({ locked: true });
    const result = await runTitsCommandCliWithDeps(["help"], deps);

    expect(result).toEqual({ handled: true, exitCode: TITS_CLI_EXIT_CODE.SUCCESS });
    expect(logs).toEqual(["Commands: add, done, due, recur, help. Try: help recur"]);
    expect(saved).toHaveLength(0);
  });
});
