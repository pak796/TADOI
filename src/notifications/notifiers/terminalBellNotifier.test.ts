import { describe, expect, it } from "bun:test";
import { TerminalBellNotifier } from "./terminalBellNotifier";

const EVENT = {
  type: "TASK_OVERDUE" as const,
  taskId: "task-1",
  title: "Task",
  dueAt: "2026-02-10T09:00:00.000Z",
  firedAt: "2026-02-10T09:00:01.000Z"
};

describe("TerminalBellNotifier", () => {
  it("rings when enabled", () => {
    let rings = 0;
    const notifier = new TerminalBellNotifier({
      isEnabled: () => true,
      writeBell: () => {
        rings += 1;
      },
      nowProvider: () => 1
    });

    notifier.notify(EVENT);
    expect(rings).toBe(1);
  });

  it("does not ring when disabled", () => {
    let rings = 0;
    const notifier = new TerminalBellNotifier({
      isEnabled: () => false,
      writeBell: () => {
        rings += 1;
      }
    });

    notifier.notify(EVENT);
    expect(rings).toBe(0);
  });

  it("enforces cooldown between bells", () => {
    let rings = 0;
    let now = 1000;
    const notifier = new TerminalBellNotifier({
      isEnabled: () => true,
      getCooldownMs: () => 2000,
      nowProvider: () => now,
      writeBell: () => {
        rings += 1;
      }
    });

    notifier.notify(EVENT);
    now = 2500;
    notifier.notify(EVENT);
    now = 3001;
    notifier.notify(EVENT);

    expect(rings).toBe(2);
  });
});
