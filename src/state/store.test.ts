import { describe, expect, it } from "bun:test";
import { createDefaultEngagementState } from "../domain/engagement";
import { applyArchiveAging, createDraftFromTask, initialState, reducer } from "./store";
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
      schemaVersion: 4,
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
      savedViews: [],
      engagement: createDefaultEngagementState()
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

describe("createDraftFromTask priority tag display", () => {
  it("shows the canonical priority tag first with last-priority precedence", () => {
    const draft = createDraftFromTask(
      makeTask({
        id: "priority",
        title: "priority task",
        tags: ["work", "P3", "home", "#p1", "home"]
      })
    );

    expect(draft.tagsText).toBe("#p1 #work #home");
  });
});

describe("engagement reducer actions", () => {
  it("records open->done completion and evaluates first-task milestone", () => {
    const at = new Date(2026, 1, 12, 10, 0, 0).getTime();
    const recorded = reducer(initialState, {
      type: "recordCompletion",
      taskId: "task-1",
      at,
      tags: ["work"]
    });

    expect(recorded.engagement.completionLog).toHaveLength(1);
    expect(recorded.engagement.streak.currentDays).toBe(1);

    const evaluated = reducer(recorded, { type: "evaluateEngagement", at });
    expect(evaluated.engagement.achievements.FIRST_TASK_DONE).toBeDefined();
    expect(evaluated.engagementToastQueue[0]?.id).toBe("FIRST_TASK_DONE");
  });

  it("does not advance streak for same-day completions", () => {
    const day = new Date(2026, 1, 12, 10, 0, 0).getTime();
    const withFirst = reducer(initialState, {
      type: "recordCompletion",
      taskId: "task-1",
      at: day,
      tags: []
    });
    const withSecond = reducer(withFirst, {
      type: "recordCompletion",
      taskId: "task-2",
      at: day + 60_000,
      tags: []
    });

    expect(withSecond.engagement.streak.currentDays).toBe(1);
  });

  it("promotes queued toast only when overlays are clear", () => {
    const now = Date.now();
    const queued = reducer(initialState, {
      type: "pushEngagementToast",
      toast: {
        id: "toast-1",
        message: "First task completed.",
        priority: 1,
        createdAt: now,
        durationMs: 1000
      }
    });

    const blockedTick = reducer(queued, {
      type: "tickEngagementToast",
      now: now + 200,
      overlayBlocked: true
    });
    expect(blockedTick.engagementToastActive).toBeNull();

    const clearTick = reducer(blockedTick, {
      type: "tickEngagementToast",
      now: now + 300,
      overlayBlocked: false
    });
    expect(clearTick.engagementToastActive?.id).toBe("toast-1");
    expect(clearTick.engagementToastQueue).toHaveLength(0);
  });
});
