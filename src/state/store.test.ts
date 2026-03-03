import { describe, expect, it } from "bun:test";
import { createDefaultEngagementState } from "../domain/engagement";
import {
  applyArchiveAging,
  combineDueDateTime,
  createDraftFromTask,
  initialState,
  reducer
} from "./store";
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
      schemaVersion: 8,
      stateRevision: 0,
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

  it("triggers first recurring milestones once and queues non-interactive toasts", () => {
    const now = Date.now();
    const withRecurringCreated = reducer(initialState, {
      type: "triggerEngagementMilestone",
      achievementKey: "FIRST_RECURRING_TASK_CREATED",
      achievementId: "FIRST_RECURRING_TASK_CREATED",
      at: now,
      meta: { seriesId: "series:task-1" },
      toast: {
        message: "Created your first recurring task.",
        priority: 3,
        durationMs: 10_000
      }
    });

    expect(withRecurringCreated.engagement.achievements.FIRST_RECURRING_TASK_CREATED).toBeDefined();
    expect(withRecurringCreated.engagementToastQueue[0]?.id).toBe("FIRST_RECURRING_TASK_CREATED");

    const repeated = reducer(withRecurringCreated, {
      type: "triggerEngagementMilestone",
      achievementKey: "FIRST_RECURRING_TASK_CREATED",
      achievementId: "FIRST_RECURRING_TASK_CREATED",
      at: now + 1_000,
      toast: {
        message: "Created your first recurring task.",
        priority: 3,
        durationMs: 10_000
      }
    });
    expect(repeated.engagementToastQueue).toHaveLength(1);

    const withRecurringRepeatDone = reducer(repeated, {
      type: "triggerEngagementMilestone",
      achievementKey: "FIRST_RECURRING_REPEAT_DONE",
      achievementId: "FIRST_RECURRING_REPEAT_DONE",
      at: now + 2_000,
      meta: {
        seriesId: "series:task-1",
        occurrenceIso: "2026-02-15T09:00:00"
      },
      toast: {
        message: "Completed your first recurring repeat occurrence.",
        priority: 2,
        durationMs: 10_000
      }
    });

    expect(withRecurringRepeatDone.engagement.achievements.FIRST_RECURRING_REPEAT_DONE).toBeDefined();
    expect(withRecurringRepeatDone.engagementToastQueue).toHaveLength(2);
  });

  it("dedupes onboarding milestones and preserves first unlock timestamp", () => {
    const now = Date.now();
    const withFirstChecklistCreated = reducer(initialState, {
      type: "triggerEngagementMilestone",
      achievementKey: "FIRST_CHECKLIST_CREATED",
      achievementId: "FIRST_CHECKLIST_CREATED",
      at: now,
      meta: { taskId: "task-1", total: 1 },
      toast: {
        message: "Created your first checklist.",
        priority: 3,
        durationMs: 10_000
      }
    });

    const repeatedChecklistCreated = reducer(withFirstChecklistCreated, {
      type: "triggerEngagementMilestone",
      achievementKey: "FIRST_CHECKLIST_CREATED",
      achievementId: "FIRST_CHECKLIST_CREATED",
      at: now + 1200,
      meta: { taskId: "task-1", total: 2 },
      toast: {
        message: "Created your first checklist.",
        priority: 3,
        durationMs: 10_000
      }
    });

    expect(
      repeatedChecklistCreated.engagement.achievements.FIRST_CHECKLIST_CREATED?.unlockedAt
    ).toBe(now);
    expect(repeatedChecklistCreated.engagementToastQueue).toHaveLength(1);

    const withRemainingOnboardingMilestones = reducer(repeatedChecklistCreated, {
      type: "triggerEngagementMilestone",
      achievementKey: "FIRST_TOME_CREATED",
      achievementId: "FIRST_TOME_CREATED",
      at: now + 2400,
      meta: { notePath: "First Tome Milestone.md" },
      toast: {
        message: "Created your first TOME note.",
        priority: 3,
        durationMs: 10_000
      }
    });

    const withChecklistCompleted = reducer(withRemainingOnboardingMilestones, {
      type: "triggerEngagementMilestone",
      achievementKey: "FIRST_CHECKLIST_FULLY_COMPLETED",
      achievementId: "FIRST_CHECKLIST_FULLY_COMPLETED",
      at: now + 3600,
      meta: { taskId: "task-1", total: 1 },
      toast: {
        message: "Completed your first checklist.",
        priority: 2,
        durationMs: 10_000
      }
    });

    expect(withChecklistCompleted.engagement.achievements.FIRST_TOME_CREATED).toBeDefined();
    expect(
      withChecklistCompleted.engagement.achievements.FIRST_CHECKLIST_FULLY_COMPLETED
    ).toBeDefined();
    expect(withChecklistCompleted.engagementToastQueue).toHaveLength(3);
  });
});

describe("combineDueDateTime", () => {
  const miniOptions = {
    now: Date.parse("2026-03-02T10:00:00-06:00"),
    tz: "America/Chicago"
  };

  it("resolves mini time as same-day datetime when still in future", () => {
    const result = combineDueDateTime("3pm", "", {
      ...miniOptions
    });
    expect(result).toEqual({
      dueAt: new Date(2026, 2, 2, 15, 0, 0, 0).getTime(),
      hasExplicitTime: true
    });
  });

  it("resolves mini time as next-day datetime when today's time has passed", () => {
    const result = combineDueDateTime("3pm", "", {
      ...miniOptions,
      now: Date.parse("2026-03-02T16:00:00-06:00")
    });
    expect(result).toEqual({
      dueAt: new Date(2026, 2, 3, 15, 0, 0, 0).getTime(),
      hasExplicitTime: true
    });
  });

  it("resolves mini weekday+time using today when in the future", () => {
    const result = combineDueDateTime("mon 3pm", "", {
      now: Date.parse("2026-03-02T10:00:00-06:00"),
      tz: "America/Chicago"
    });
    expect(result).toEqual({
      dueAt: new Date(2026, 2, 2, 15, 0, 0, 0).getTime(),
      hasExplicitTime: true
    });
  });

  it("resolves mini weekday+time to next occurrence when current weekday time has passed", () => {
    const result = combineDueDateTime("mon 3pm", "", {
      now: Date.parse("2026-03-02T16:00:00-06:00"),
      tz: "America/Chicago"
    });
    expect(result).toEqual({
      dueAt: new Date(2026, 2, 9, 15, 0, 0, 0).getTime(),
      hasExplicitTime: true
    });
  });

  it("supports 24-hour mini time", () => {
    const result = combineDueDateTime("15:30", "", {
      now: Date.parse("2026-03-02T10:00:00-06:00"),
      tz: "America/Chicago"
    });
    expect(result).toEqual({
      dueAt: new Date(2026, 2, 2, 15, 30, 0, 0).getTime(),
      hasExplicitTime: true
    });
  });

  it("ignores ambiguous single-number time in mini preview parse", () => {
    expect(combineDueDateTime("3", "", {
      now: Date.parse("2026-03-02T10:00:00-06:00"),
      tz: "America/Chicago"
    })).toEqual({ dueAt: undefined, hasExplicitTime: false });
  });

  it("keeps strict ISO behavior with options provided", () => {
    const result = combineDueDateTime("2026-03-05", "09:00", {
      now: Date.parse("2026-03-02T10:00:00-06:00"),
      tz: "America/Chicago"
    });
    expect(result).toEqual({
      dueAt: new Date(2026, 2, 5, 9, 0, 0, 0).getTime(),
      hasExplicitTime: true
    });
  });
});
