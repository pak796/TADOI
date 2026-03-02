import { describe, expect, it } from "bun:test";
import { runUnifiedSearch } from "./unifiedSearch";
import type { Task } from "../domain/models";

function makeTask(id: string, title: string, tags: string[]): Task {
  return {
    id,
    title,
    status: "open",
    createdAt: 1,
    updatedAt: 1,
    workflowStage: "todo",
    tags
  };
}

describe("runUnifiedSearch", () => {
  it("returns task and note matches for all scope", () => {
    const results = runUnifiedSearch({
      query: "alpha",
      scope: "all",
      tasks: [makeTask("task-1", "Alpha task", ["work"])],
      notes: [
        {
          path: "Alpha.md",
          title: "Alpha note",
          tags: ["work"],
          content: "Contains alpha context"
        }
      ]
    });
    expect(results.map((result) => result.kind)).toEqual(["task", "note"]);
  });

  it("filters by notes scope", () => {
    const results = runUnifiedSearch({
      query: "alpha",
      scope: "notes",
      tasks: [makeTask("task-1", "Alpha task", ["work"])],
      notes: [
        {
          path: "Alpha.md",
          title: "Alpha note",
          tags: [],
          content: "Contains alpha context"
        }
      ]
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.kind).toBe("note");
  });
});
