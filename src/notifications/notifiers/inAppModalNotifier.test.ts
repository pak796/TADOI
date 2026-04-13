import { describe, expect, it } from "bun:test";
import { InAppModalNotifier } from "./inAppModalNotifier";

const EVENT = {
  type: "TASK_OVERDUE" as const,
  taskId: "task-1",
  title: "Task",
  dueAt: "2026-02-10T09:00:00.000Z",
  firedAt: "2026-02-10T09:00:01.000Z",
};

describe("InAppModalNotifier", () => {
  it("enqueues overdue events when enabled", () => {
    const queued: (typeof EVENT)[] = [];
    const notifier = new InAppModalNotifier({
      enqueueEvent: (event) => {
        queued.push(event);
      },
      isEnabled: () => true,
    });

    notifier.notify(EVENT);
    expect(queued).toEqual([EVENT]);
  });

  it("suppresses events when disabled", () => {
    const queued: (typeof EVENT)[] = [];
    const notifier = new InAppModalNotifier({
      enqueueEvent: (event) => {
        queued.push(event);
      },
      isEnabled: () => false,
    });

    notifier.notify(EVENT);
    expect(queued).toEqual([]);
  });
});
