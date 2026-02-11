import type { Notifier } from "../notifier";
import type { NotificationEvent } from "../types";

export type TerminalBellNotifierOptions = {
  isEnabled?: () => boolean;
  getCooldownMs?: () => number;
  nowProvider?: () => number;
  writeBell?: () => void;
};

function clampCooldownMs(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 2000;
  }
  return Math.floor(value);
}

function defaultWriteBell(): void {
  try {
    process.stdout?.write?.("\x07");
  } catch {
    // Best effort only.
  }
}

export class TerminalBellNotifier implements Notifier {
  private readonly isEnabled: () => boolean;
  private readonly getCooldownMs: () => number;
  private readonly nowProvider: () => number;
  private readonly writeBell: () => void;
  private lastBellAt: number | undefined = undefined;

  constructor(options: TerminalBellNotifierOptions = {}) {
    this.isEnabled = options.isEnabled ?? (() => false);
    this.getCooldownMs = options.getCooldownMs ?? (() => 2000);
    this.nowProvider = options.nowProvider ?? (() => Date.now());
    this.writeBell = options.writeBell ?? defaultWriteBell;
  }

  notify(event: NotificationEvent): void {
    if (event.type !== "TASK_OVERDUE") return;
    if (!this.isEnabled()) return;

    const nowMs = this.nowProvider();
    const cooldownMs = clampCooldownMs(this.getCooldownMs());
    if (this.lastBellAt !== undefined && nowMs - this.lastBellAt < cooldownMs) {
      return;
    }

    this.writeBell();
    this.lastBellAt = nowMs;
  }
}
