import type { NotificationEvent } from "./types";

export interface Notifier {
  notify(event: NotificationEvent): void;
}
