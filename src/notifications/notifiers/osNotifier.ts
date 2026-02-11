import type { Notifier } from "../notifier";
import type { NotificationEvent } from "../types";

export class OSNotifier implements Notifier {
  notify(_event: NotificationEvent): void {
    // Tier 3 scaffold: no-op adapter for future OS integrations.
  }
}
