import { describe, expect, it } from "bun:test";
import type { Task } from "./models";
import {
  applyReminderDismiss,
  applyReminderFired,
  applyReminderSnooze,
  isReminderPendingForEffectiveAt,
  nextPendingReminderAt,
  resolveEffectiveReminderAt,
} from "./reminders";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? "task-1",
    title: overrides.title ?? "Task",
    status: overrides.status ?? "open",
    createdAt: overrides.createdAt ?? 1,
    updatedAt: overrides.updatedAt ?? 1,
    tags: overrides.tags ?? [],
    ...overrides,
  };
}

describe("reminders", () => {
  it("resolves effective reminder using snooze override, absolute, and before-due values", () => {
    const dueAt = Date.parse("2026-02-12T10:00:00.000Z");
    const absoluteAt = Date.parse("2026-02-12T08:00:00.000Z");
    const snoozedUntilAt = Date.parse("2026-02-12T09:00:00.000Z");

    const absoluteTask = makeTask({
      dueAt,
      reminder: {
        kind: "absolute",
        at: absoluteAt,
      },
    });
    expect(resolveEffectiveReminderAt(absoluteTask)).toBe(absoluteAt);

    const snoozedTask = makeTask({
      dueAt,
      reminder: {
        kind: "absolute",
        at: absoluteAt,
        snoozedUntilAt,
      },
    });
    expect(resolveEffectiveReminderAt(snoozedTask)).toBe(snoozedUntilAt);

    const beforeDueTask = makeTask({
      dueAt,
      reminder: {
        kind: "before_due",
        offsetMs: 30 * 60_000,
      },
    });
    expect(resolveEffectiveReminderAt(beforeDueTask)).toBe(dueAt - 30 * 60_000);
  });

  it("tracks pending reminder state from effective reminder timestamps", () => {
    const effectiveReminderAt = Date.parse("2026-02-12T08:30:00.000Z");
    expect(
      isReminderPendingForEffectiveAt(
        {
          kind: "absolute",
          at: effectiveReminderAt,
        },
        effectiveReminderAt,
      ),
    ).toBe(true);

    expect(
      isReminderPendingForEffectiveAt(
        {
          kind: "absolute",
          at: effectiveReminderAt,
          lastFiredAt: effectiveReminderAt,
        },
        effectiveReminderAt,
      ),
    ).toBe(false);
  });

  it("returns the next pending reminder across open tasks only", () => {
    const nowMs = Date.parse("2026-02-12T08:00:00.000Z");
    const openTaskReminderAt = nowMs + 20 * 60_000;
    const doneTaskReminderAt = nowMs + 5 * 60_000;

    const nextAt = nextPendingReminderAt(
      [
        makeTask({
          id: "done-1",
          status: "done",
          reminder: {
            kind: "absolute",
            at: doneTaskReminderAt,
          },
        }),
        makeTask({
          id: "open-1",
          reminder: {
            kind: "absolute",
            at: openTaskReminderAt,
          },
        }),
      ],
      nowMs,
    );

    expect(nextAt).toBe(openTaskReminderAt);
  });

  it("applies fired, dismiss, and snooze reminder runtime state transitions", () => {
    const nowMs = Date.parse("2026-02-12T08:00:00.000Z");
    const effectiveReminderAt = nowMs - 60_000;

    const base = [
      makeTask({
        reminder: {
          kind: "absolute",
          at: nowMs - 10 * 60_000,
        },
      }),
    ];
    const fired = applyReminderFired(base, "task-1", effectiveReminderAt);
    expect(fired[0]?.reminder?.lastFiredAt).toBe(effectiveReminderAt);
    expect(fired[0]?.reminder?.snoozedUntilAt).toBeUndefined();

    const snoozed = applyReminderSnooze(fired, "task-1", 10 * 60_000, nowMs);
    expect(snoozed[0]?.reminder?.snoozedUntilAt).toBe(nowMs + 10 * 60_000);

    const dismissed = applyReminderDismiss(
      snoozed,
      "task-1",
      nowMs + 10 * 60_000,
      nowMs,
    );
    expect(dismissed[0]?.reminder?.lastFiredAt).toBe(nowMs + 10 * 60_000);
    expect(dismissed[0]?.reminder?.snoozedUntilAt).toBeUndefined();
  });
});
