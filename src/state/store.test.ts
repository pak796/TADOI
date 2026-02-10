import { describe, expect, it } from "bun:test";
import { applyArchiveAging } from "./store";
import { LoadedData } from "./persistence";
import { Task } from "../domain/models";

const DAY_MS = 24 * 60 * 60 * 1000;

function makeTask(partial: Partial<Task> & Pick<Task, "id" | "title">): Task {
  return {
    id: partial.id,
    title: partial.title,
    status: partial.status ?? "open",
    createdAt: partial.createdAt ?? 1,
    updatedAt: partial.updatedAt ?? 1,
    dueAt: partial.dueAt,
    closedAt: partial.closedAt,
    notes: partial.notes,
    tags: partial.tags ?? []
  };
}

describe("applyArchiveAging startup behavior", () => {
  it("archives done tasks older than 7 days and leaves others", () => {
    const now = new Date(2026, 1, 8, 12, 0, 0, 0).getTime();
    const data: LoadedData = {
      schemaVersion: 3,
      tasks: [
        makeTask({
          id: "old",
          title: "old done",
          status: "done",
          closedAt: now - 8 * DAY_MS
        }),
        makeTask({
          id: "recent",
          title: "recent done",
          status: "done",
          closedAt: now - 3 * DAY_MS
        }),
        makeTask({
          id: "open",
          title: "open task",
          status: "open"
        })
      ],
      tagIndex: {},
      savedViews: []
    };

    const result = applyArchiveAging(data, now);
    expect(result.changed).toBe(true);
    const statuses = result.data.tasks.reduce<Record<string, string>>((acc, task) => {
      acc[task.id] = task.status;
      return acc;
    }, {});
    expect(statuses.old).toBe("archived");
    expect(statuses.recent).toBe("done");
    expect(statuses.open).toBe("open");
  });
});
