import type { Notifier } from "../notifier";
import type { NotificationEvent } from "../types";

export type InAppBannerNotifierOptions = {
  enqueueBanner: (message: string) => void;
  isEnabled?: () => boolean;
};

export class InAppBannerNotifier implements Notifier {
  private readonly enqueueBanner: (message: string) => void;
  private readonly isEnabled: () => boolean;

  constructor(options: InAppBannerNotifierOptions) {
    this.enqueueBanner = options.enqueueBanner;
    this.isEnabled = options.isEnabled ?? (() => true);
  }

  notify(event: NotificationEvent): void {
    if (!this.isEnabled()) return;
    if (event.type !== "TASK_OVERDUE") return;
    this.enqueueBanner(`Task overdue: ${event.title}`);
  }
}
