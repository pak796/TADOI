import type { NotificationSettings } from "../settings/settings";

export function isInAppOverdueEnabled(settings: NotificationSettings): boolean {
  return settings.enabled && settings.inAppOverdueBanner;
}

export function isTerminalBellOverdueEnabled(settings: NotificationSettings): boolean {
  return settings.enabled && settings.terminalBellOnOverdue;
}

export function getTerminalBellCooldownMs(settings: NotificationSettings): number {
  return settings.bellCooldownMs;
}

export function buildNotificationStatusLabel(settings: NotificationSettings): string {
  return settings.enabled ? "on" : "off";
}
