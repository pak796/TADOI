import { describe, expect, it } from "bun:test";
import { completeTaskWithRecurrence } from "./recurrence";
import type { ChecklistItem, Task } from "./models";

function makeTask(overrides: Partial<Task> & Pick<Task, "id" | "title">): Task {
  return {
    status: "open",
    createdAt: 1,
    updatedAt: 1,
    tags: [],
    ...overrides
  } as Task;
}

const NOW = Date.parse("2026-05-05T12:00:00Z");

describe("completeTaskWithRecurrence", () => {
  it("marks the task done and spawns the next instance for daily recurrence", () => {
    const original = makeTask({
      id: "series-1",
      title: "Daily standup",
      dueAt: NOW,
      hasExplicitTime: true,
      recurrence: {
        rrule: "FREQ=DAILY;INTERVAL=1",
        dtstart: "2026-05-05",
        series_id: "series:series-1",
        freq: "daily",
        interval: 1
      }
    });

    const result = completeTaskWithRecurrence([original], "series-1", NOW);
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0].status).toBe("done");
    expect(result.tasks[1].status).toBe("open");
    expect(result.spawnedId).toBe(result.tasks[1].id);
    expect(result.tasks[1].dueAt).toBe(NOW + 24 * 60 * 60 * 1000);
  });

  it("clones the checklist with all items reset to undone on the next instance", () => {
    const SOURCE_ISO = "2026-05-04T12:00:00.000Z";
    const COMPLETED_ISO = "2026-05-04T12:30:00.000Z";
    const checklist: ChecklistItem[] = [
      { id: "c1", text: "Make coffee", isDone: true, createdAt: SOURCE_ISO, updatedAt: SOURCE_ISO, completedAt: COMPLETED_ISO, sort: 1 },
      { id: "c2", text: "Read RFCs", isDone: true, createdAt: SOURCE_ISO, updatedAt: SOURCE_ISO, completedAt: COMPLETED_ISO, sort: 2 },
      { id: "c3", text: "Sync with team", isDone: false, createdAt: SOURCE_ISO, updatedAt: SOURCE_ISO, sort: 3 }
    ];

    const original = makeTask({
      id: "series-2",
      title: "Daily standup",
      dueAt: NOW,
      hasExplicitTime: true,
      checklist,
      recurrence: {
        rrule: "FREQ=DAILY;INTERVAL=1",
        dtstart: "2026-05-05",
        series_id: "series:series-2",
        freq: "daily",
        interval: 1
      }
    });

    const result = completeTaskWithRecurrence([original], "series-2", NOW);
    const spawned = result.tasks[1];
    expect(spawned.checklist).toBeDefined();
    expect(spawned.checklist).toHaveLength(3);
    const expectedNowIso = new Date(NOW).toISOString();
    for (const item of spawned.checklist!) {
      expect(item.isDone).toBe(false);
      expect(item.completedAt).toBeUndefined();
      expect(item.updatedAt).toBe(expectedNowIso);
      expect(item.text).toBeTruthy();
    }
    // Original task's checklist must remain untouched (immutable).
    expect(original.checklist![0].isDone).toBe(true);
  });

  it("does not add an empty checklist field when the source task has none", () => {
    const original = makeTask({
      id: "series-3",
      title: "Daily standup",
      dueAt: NOW,
      hasExplicitTime: true,
      recurrence: {
        rrule: "FREQ=DAILY;INTERVAL=1",
        dtstart: "2026-05-05",
        series_id: "series:series-3",
        freq: "daily",
        interval: 1
      }
    });

    const result = completeTaskWithRecurrence([original], "series-3", NOW);
    const spawned = result.tasks[1];
    expect(spawned.checklist).toBeUndefined();
  });

  it("does not spawn for non-recurring tasks", () => {
    const original = makeTask({
      id: "one-shot",
      title: "Plain task",
      dueAt: NOW
    });

    const result = completeTaskWithRecurrence([original], "one-shot", NOW);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].status).toBe("done");
    expect(result.spawnedId).toBeUndefined();
  });
});
