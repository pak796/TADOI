import { describe, expect, it } from "bun:test";
import type { EngagementState, EngagementToast } from "./models";
import {
  computeDayKey,
  createDefaultEngagementState,
  enqueueToastsWithCap,
  enforceCompletionRetention,
  evaluateMilestones,
  mergeEngagementStates,
  ONBOARDING_ENGAGEMENT_ACHIEVEMENTS,
  normalizeEngagementState,
  suppressActiveToastWithCap,
  updateStreak
} from "./engagement";

const DAY_MS = 24 * 60 * 60 * 1000;

function makeToast(partial: Partial<EngagementToast> & Pick<EngagementToast, "id">): EngagementToast {
  return {
    id: partial.id,
    message: partial.message ?? partial.id,
    priority: partial.priority ?? 4,
    createdAt: partial.createdAt ?? 1,
    durationMs: partial.durationMs ?? 1000
  };
}

function withCompletionEvents(events: Array<{ at: number; tags?: string[] }>): EngagementState {
  let engagement = createDefaultEngagementState();
  for (const [index, event] of events.entries()) {
    engagement = {
      ...engagement,
      completionLog: [
        ...engagement.completionLog,
        {
          taskId: `task-${index + 1}`,
          at: event.at,
          tags: event.tags ?? []
        }
      ],
      streak: updateStreak(engagement.streak, event.at)
    };
  }
  return engagement;
}

describe("engagement helpers", () => {
  it("formats a local day key", () => {
    const at = new Date(2026, 1, 12, 15, 45, 0).getTime();
    expect(computeDayKey(at)).toBe("2026-02-12");
  });

  it("updates streak by local day transitions", () => {
    const day1 = new Date(2026, 1, 10, 9, 0, 0).getTime();
    const day1Again = new Date(2026, 1, 10, 18, 0, 0).getTime();
    const day2 = new Date(2026, 1, 11, 10, 0, 0).getTime();
    const day4 = new Date(2026, 1, 13, 10, 0, 0).getTime();

    let streak = createDefaultEngagementState().streak;
    streak = updateStreak(streak, day1);
    expect(streak.currentDays).toBe(1);
    streak = updateStreak(streak, day1Again);
    expect(streak.currentDays).toBe(1);
    streak = updateStreak(streak, day2);
    expect(streak.currentDays).toBe(2);
    expect(streak.bestDays).toBe(2);
    streak = updateStreak(streak, day4);
    expect(streak.currentDays).toBe(1);
    expect(streak.bestDays).toBe(2);
  });

  it("triggers first-task milestone once", () => {
    const at = new Date(2026, 1, 10, 9, 0, 0).getTime();
    const engagement = withCompletionEvents([{ at }]);
    const first = evaluateMilestones(engagement, at);
    expect(first.toasts.map((toast) => toast.id)).toEqual(["FIRST_TASK_DONE"]);
    const second = evaluateMilestones(first.engagement, at);
    expect(second.toasts).toEqual([]);
  });

  it("triggers done-3-today once per day", () => {
    const now = new Date(2026, 1, 10, 12, 0, 0).getTime();
    const engagement = withCompletionEvents([
      { at: new Date(2026, 1, 10, 9, 0, 0).getTime() },
      { at: new Date(2026, 1, 10, 10, 0, 0).getTime() },
      { at: now }
    ]);
    const evaluated = evaluateMilestones(engagement, now);
    expect(evaluated.toasts.some((toast) => toast.id.startsWith("DONE_3_TODAY:"))).toBe(true);
    const repeated = evaluateMilestones(evaluated.engagement, now);
    expect(repeated.toasts.some((toast) => toast.id.startsWith("DONE_3_TODAY:"))).toBe(false);
  });

  it("triggers weekly tag milestone with cooldown", () => {
    const now = new Date(2026, 1, 12, 12, 0, 0).getTime();
    const engagement = withCompletionEvents([
      { at: now - 6 * 24 * 60 * 60 * 1000, tags: ["work"] },
      { at: now - 5 * 24 * 60 * 60 * 1000, tags: ["work"] },
      { at: now - 4 * 24 * 60 * 60 * 1000, tags: ["work"] },
      { at: now - 3 * 24 * 60 * 60 * 1000, tags: ["work"] },
      { at: now, tags: ["work"] }
    ]);

    const evaluated = evaluateMilestones(engagement, now);
    expect(evaluated.toasts.some((toast) => toast.id === "TAG_5_LAST_7_DAYS:work")).toBe(true);

    const cooldownCheck = evaluateMilestones(evaluated.engagement, now + 60_000);
    expect(cooldownCheck.toasts.some((toast) => toast.id === "TAG_5_LAST_7_DAYS:work")).toBe(
      false
    );
  });

  it("triggers 3-day streak milestone once", () => {
    const day1 = new Date(2026, 1, 10, 10, 0, 0).getTime();
    const day2 = new Date(2026, 1, 11, 10, 0, 0).getTime();
    const day3 = new Date(2026, 1, 12, 10, 0, 0).getTime();
    const engagement = withCompletionEvents([{ at: day1 }, { at: day2 }, { at: day3 }]);
    const evaluated = evaluateMilestones(engagement, day3);
    expect(evaluated.toasts.some((toast) => toast.id === "STREAK_3_DAYS")).toBe(true);
    const repeated = evaluateMilestones(evaluated.engagement, day3);
    expect(repeated.toasts.some((toast) => toast.id === "STREAK_3_DAYS")).toBe(false);
  });

  it("normalizes engagement via enforceCompletionRetention", () => {
    const now = Date.now();
    const dayLog = Array.from({ length: 550 }, (_value, index) => ({
      taskId: `task-${index}`,
      at: now - index * 1_000,
      tags: ["task"]
    }));

    const retained = enforceCompletionRetention(dayLog, now);
    expect(retained).toHaveLength(500);
    expect(retained[0]?.taskId).toBe("task-50");
    expect(retained[retained.length - 1]?.taskId).toBe("task-549");
  });

  it("normalizes completion-log and rebuilds streak ignoring stale stored counters", () => {
    const base = new Date(2026, 1, 20, 8, 0, 0, 0).getTime();
    const state = normalizeEngagementState({
      completionLog: [
        { taskId: "a", at: base - 2 * DAY_MS, tags: [" home ", "alpha", "home"] },
        { taskId: "b", at: base - 1 * DAY_MS, tags: ["alpha"] },
        { taskId: "c", at: base, tags: ["beta", "alpha", "  beta  "] },
        { taskId: "d", at: base + DAY_MS, tags: ["alpha"] }
      ],
      achievements: {
        "FIRST_TASK_DONE": {
          id: "FIRST_TASK_DONE",
          unlockedAt: base - 3 * DAY_MS,
          meta: {}
        }
      },
      streak: {
        currentDays: 99,
        bestDays: 101,
        lastCompletionDayKey: "1999-01-01"
      }
    }, base + DAY_MS);

    expect(state.streak.currentDays).toBe(4);
    expect(state.streak.bestDays).toBe(4);
    expect(state.completionLog[0]?.tags).toEqual(["alpha", "beta"]);
  });

  it("selects a deterministic tag when multiple tag-5 milestones fire on the same completion", () => {
    const now = new Date(2026, 1, 20, 10, 0, 0, 0).getTime();
    const recentEvents = [];
    for (let dayOffset = 1; dayOffset <= 4; dayOffset += 1) {
      recentEvents.push(
        { taskId: `a-${dayOffset}`, at: now - dayOffset * DAY_MS, tags: ["beta"] },
        { taskId: `b-${dayOffset}`, at: now - dayOffset * DAY_MS, tags: ["alpha"] }
      );
    }
    const engagement = normalizeEngagementState({
      completionLog: [
        ...recentEvents,
        {
          taskId: "latest",
          at: now,
          tags: ["beta", "alpha"]
        }
      ],
      achievements: {},
      streak: {
        currentDays: 0,
        bestDays: 0,
        lastCompletionDayKey: null
      }
    }, now);

    const outcome = evaluateMilestones(engagement, now);
    const toastIds = outcome.toasts.map((toast) => toast.id);
    expect(toastIds).toContain("TAG_5_LAST_7_DAYS:alpha");
    expect(toastIds).not.toContain("TAG_5_LAST_7_DAYS:beta");
  });

  it("caps queued toasts and drops lowest priority first (fifo for ties)", () => {
    const queue = [
      makeToast({ id: "a", priority: 4 }),
      makeToast({ id: "b", priority: 4 }),
      makeToast({ id: "c", priority: 3 })
    ];
    const next = enqueueToastsWithCap(queue, [makeToast({ id: "d", priority: 1 })], 3);
    expect(next.map((toast) => toast.id)).toEqual(["b", "c", "d"]);
  });

  it("keeps active toast when suppressing under blocking overlays", () => {
    const active = makeToast({ id: "active", priority: 4 });
    const queue = [
      makeToast({ id: "q1", priority: 4 }),
      makeToast({ id: "q2", priority: 3 }),
      makeToast({ id: "q3", priority: 2 })
    ];
    const next = suppressActiveToastWithCap(active, queue, 3);
    expect(next.map((toast) => toast.id)).toEqual(["active", "q2", "q3"]);
  });

  it("merges engagement achievements by latest unlock timestamp", () => {
    const now = Date.now();
    const left = createDefaultEngagementState();
    const right = createDefaultEngagementState();
    left.achievements.FIRST_TASK_DONE = {
      id: "FIRST_TASK_DONE",
      unlockedAt: now - 5000
    };
    right.achievements.FIRST_TASK_DONE = {
      id: "FIRST_TASK_DONE",
      unlockedAt: now
    };
    const merged = mergeEngagementStates(left, right, now);
    expect(merged.achievements.FIRST_TASK_DONE?.unlockedAt).toBe(now);
  });

  it("exposes onboarding achievement keys", () => {
    expect(ONBOARDING_ENGAGEMENT_ACHIEVEMENTS).toEqual({
      FIRST_TOME_CREATED: "FIRST_TOME_CREATED",
      FIRST_CHECKLIST_CREATED: "FIRST_CHECKLIST_CREATED",
      FIRST_CHECKLIST_FULLY_COMPLETED: "FIRST_CHECKLIST_FULLY_COMPLETED"
    });
  });
});
