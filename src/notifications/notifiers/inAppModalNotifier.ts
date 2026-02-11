import type { Notifier } from "../notifier";
import type { TaskOverdueEvent, NotificationEvent } from "../types";

export type InAppModalNotifierOptions = {
  enqueueEvent: (event: TaskOverdueEvent) => void;
  isEnabled?: () => boolean;
};

export class InAppModalNotifier implements Notifier {
  private readonly enqueueEvent: (event: TaskOverdueEvent) => void;
  private readonly isEnabled: () => boolean;

  constructor(options: InAppModalNotifierOptions) {
    this.enqueueEvent = options.enqueueEvent;
    this.isEnabled = options.isEnabled ?? (() => true);
  }

  notify(event: NotificationEvent): void {
    if (!this.isEnabled()) return;
    if (event.type !== "TASK_OVERDUE") return;
    this.enqueueEvent(event);
  }
}
