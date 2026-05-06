import { describe, expect, it } from "bun:test";
import { createDefaultEngagementState } from "../domain/engagement";
import type { LoadedData } from "../state/persistence";
import {
  formatEmptyListHint,
  parseListArgs,
  runListCommandWithDeps
} from "./listCommand";

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

describe("parseListArgs", () => {
  it("parses selectors, sort, and limit", () => {
    const result = parseListArgs(["+work", "--sort", "updated", "--limit=3"]);
    expect(result).toEqual({
      ok: true,
      selectors: ["+work"],
      sortMode: "updated",
      limit: 3,
      isoDates: false,
      help: false
    });
  });

  it("recognizes the --iso-dates opt-out flag", () => {
    const result = parseListArgs(["--iso-dates"]);
    expect(result).toEqual({
      ok: true,
      selectors: [],
      sortMode: "due",
      isoDates: true,
      help: false
    });
  });

  it("rejects invalid sort and limit values", () => {
    expect(parseListArgs(["--sort", "rank"])).toEqual({
      ok: false,
      error: "--sort must be due, updated, created, or title"
    });
    expect(parseListArgs(["--limit", "0"])).toEqual({
      ok: false,
      error: "--limit must be a positive integer"
    });
  });
});

describe("runListCommandWithDeps", () => {
  function createDeps(loadedData: LoadedData) {
    const logs: string[] = [];
    const errors: string[] = [];
    const deps = {
      now: () => new Date(2026, 1, 20, 12, 0).getTime(),
      getDataFilePath: () => "/tmp/tadoi_data.json",
      loadData: async () => loadedData,
      log: (line: string) => logs.push(line),
      error: (line: string) => errors.push(line)
    };
    return { deps, logs, errors };
  }

  it("returns versioned JSON payload with default open-task baseline", async () => {
    const loaded = createLoadedData({
      tasks: [
        {
          id: "open-a",
          title: "Open A",
          status: "open",
          createdAt: 1,
          updatedAt: 2,
          tags: ["work"],
          workflowStage: "todo"
        },
        {
          id: "done-b",
          title: "Done B",
          status: "done",
          createdAt: 1,
          updatedAt: 3,
          tags: ["work"],
          workflowStage: "done"
        }
      ]
    });
    const { deps, errors } = createDeps(loaded);

    const result = await runListCommandWithDeps([], { json: true }, deps);
    expect(result.exitCode).toBe(0);
    expect(errors).toHaveLength(0);
    expect(result.data).toMatchObject({
      type: "tadoi.list.v1",
      filters: { status: "open", due: "any" },
      sort: "due",
      count: 1
    });
    expect(result.data?.tasks[0]).toMatchObject({
      id: "open-a",
      status: "open",
      dueAt: null,
      hasExplicitTime: false
    });
  });

  it("applies selector filtering, sort, and limit", async () => {
    const loaded = createLoadedData({
      tasks: [
        {
          id: "a",
          title: "A",
          status: "open",
          createdAt: 1,
          updatedAt: 10,
          tags: ["work"],
          workflowStage: "todo"
        },
        {
          id: "b",
          title: "B",
          status: "open",
          createdAt: 1,
          updatedAt: 20,
          tags: ["work"],
          workflowStage: "todo"
        },
        {
          id: "c",
          title: "C",
          status: "open",
          createdAt: 1,
          updatedAt: 30,
          tags: ["home"],
          workflowStage: "todo"
        }
      ]
    });
    const { deps } = createDeps(loaded);

    const result = await runListCommandWithDeps(
      ["+work", "--sort", "updated", "--limit", "1"],
      { json: true },
      deps
    );
    expect(result.exitCode).toBe(0);
    expect(result.data?.count).toBe(1);
    expect(result.data?.tasks[0]?.id).toBe("b");
  });

  it("prints deterministic text rows for non-json mode", async () => {
    const loaded = createLoadedData({
      tasks: [
        {
          id: "task-1",
          title: "Alpha",
          status: "open",
          createdAt: 1,
          updatedAt: 1,
          tags: [],
          workflowStage: "todo"
        }
      ]
    });
    const { deps, logs, errors } = createDeps(loaded);
    const result = await runListCommandWithDeps([], { json: false }, deps);

    expect(result).toEqual({ exitCode: 0 });
    expect(errors).toHaveLength(0);
    expect(logs).toEqual(["[list] count: 1", "[open] task-1 Alpha"]);
  });

  it("renders friendly due dates in text mode by default", async () => {
    const now = new Date(2026, 1, 20, 12, 0).getTime();
    const loaded = createLoadedData({
      tasks: [
        {
          id: "task-today",
          title: "Lunch",
          status: "open",
          createdAt: 1,
          updatedAt: 1,
          dueAt: new Date(2026, 1, 20, 13, 0).getTime(),
          hasExplicitTime: true,
          tags: [],
          workflowStage: "todo"
        },
        {
          id: "task-soon",
          title: "Report",
          status: "open",
          createdAt: 1,
          updatedAt: 1,
          dueAt: new Date(2026, 1, 23).getTime(),
          tags: [],
          workflowStage: "todo"
        }
      ]
    });
    const { deps, logs } = createDeps(loaded);
    deps.now = () => now;

    const result = await runListCommandWithDeps([], { json: false }, deps);
    expect(result.exitCode).toBe(0);
    expect(logs).toEqual([
      "[list] count: 2",
      "[open] task-today Lunch due:today 1pm",
      "[open] task-soon Report due:in 3d"
    ]);
  });

  it("emits ISO due dates when --iso-dates is set", async () => {
    const now = new Date(2026, 1, 20, 12, 0).getTime();
    const loaded = createLoadedData({
      tasks: [
        {
          id: "task-iso",
          title: "Beta",
          status: "open",
          createdAt: 1,
          updatedAt: 1,
          dueAt: new Date(2026, 1, 23, 9, 30).getTime(),
          hasExplicitTime: true,
          tags: [],
          workflowStage: "todo"
        }
      ]
    });
    const { deps, logs } = createDeps(loaded);
    deps.now = () => now;

    const result = await runListCommandWithDeps(["--iso-dates"], { json: false }, deps);
    expect(result.exitCode).toBe(0);
    expect(logs).toEqual([
      "[list] count: 1",
      "[open] task-iso Beta due:2026-02-23T09:30"
    ]);
  });

  it("emits a hint when the data file is empty", async () => {
    const loaded = createLoadedData({ tasks: [] });
    const { deps, logs } = createDeps(loaded);
    const result = await runListCommandWithDeps([], { json: false }, deps);
    expect(result.exitCode).toBe(0);
    expect(logs).toEqual([
      "[list] count: 0",
      'No tasks yet. Add one with: tadoi add "Your first task" due:tomorrow'
    ]);
  });

  it("emits a filter-aware hint when selectors filtered everything out", async () => {
    const loaded = createLoadedData({
      tasks: [
        {
          id: "a",
          title: "Has work tag",
          status: "open",
          createdAt: 1,
          updatedAt: 1,
          tags: ["work"]
        }
      ]
    });
    const { deps, logs } = createDeps(loaded);
    const result = await runListCommandWithDeps(["+nonexistent"], { json: false }, deps);
    expect(result.exitCode).toBe(0);
    expect(logs[0]).toBe("[list] count: 0");
    expect(logs[1]).toContain("No tasks match the active filter (+nonexistent)");
  });
});

describe("formatEmptyListHint", () => {
  it("offers a starter command when the store has no tasks at all", () => {
    expect(formatEmptyListHint(0, [])).toContain("tadoi add");
  });

  it("nudges status:all when defaults filtered everything out", () => {
    expect(formatEmptyListHint(5, [])).toContain("status:all");
  });

  it("echoes active selectors so users can see what to remove", () => {
    expect(formatEmptyListHint(10, ["+work", "due:today"])).toContain(
      "+work due:today"
    );
  });
});

