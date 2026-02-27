import { describe, expect, it } from "bun:test";
import { createDefaultEngagementState } from "../domain/engagement";
import type { LoadedData } from "../state/persistence";
import { parseListArgs, runListCommandWithDeps } from "./listCommand";

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
});

