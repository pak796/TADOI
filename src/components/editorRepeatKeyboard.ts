import { EditorDraft } from "../domain/models";

export type RepeatMode = EditorDraft["repeatMode"];
export type RepeatEndMode = EditorDraft["repeatEndMode"];
export type ReminderKind = EditorDraft["reminderKind"];

export const REPEAT_MODE_KEYBOARD_ORDER: readonly RepeatMode[] = [
  "off",
  "daily",
  "weekly",
  "monthly",
  "custom"
];

export const REPEAT_END_MODE_KEYBOARD_ORDER: readonly RepeatEndMode[] = [
  "never",
  "until",
  "count"
];

export const REMINDER_KIND_KEYBOARD_ORDER: readonly ReminderKind[] = [
  "none",
  "absolute",
  "before_due"
];

export function cycleRepeatModeClamp(
  currentMode: RepeatMode,
  direction: 1 | -1
): RepeatMode {
  const currentIndex = REPEAT_MODE_KEYBOARD_ORDER.indexOf(currentMode);
  const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = Math.max(
    0,
    Math.min(REPEAT_MODE_KEYBOARD_ORDER.length - 1, safeCurrentIndex + direction)
  );
  return REPEAT_MODE_KEYBOARD_ORDER[nextIndex];
}

export function cycleRepeatEndModeClamp(
  currentMode: RepeatEndMode,
  direction: 1 | -1
): RepeatEndMode {
  const currentIndex = REPEAT_END_MODE_KEYBOARD_ORDER.indexOf(currentMode);
  const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = Math.max(
    0,
    Math.min(REPEAT_END_MODE_KEYBOARD_ORDER.length - 1, safeCurrentIndex + direction)
  );
  return REPEAT_END_MODE_KEYBOARD_ORDER[nextIndex];
}

export function cycleReminderKindClamp(
  currentKind: ReminderKind,
  direction: 1 | -1
): ReminderKind {
  const currentIndex = REMINDER_KIND_KEYBOARD_ORDER.indexOf(currentKind);
  const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = Math.max(
    0,
    Math.min(REMINDER_KIND_KEYBOARD_ORDER.length - 1, safeCurrentIndex + direction)
  );
  return REMINDER_KIND_KEYBOARD_ORDER[nextIndex];
}

export function shouldInterceptRepeatArrowAtEdge(params: {
  keyName: string;
  cursorOffset: number;
  valueLength: number;
  hasSelection: boolean;
}): boolean {
  if (params.hasSelection) return false;
  if (params.keyName === "left") return params.cursorOffset <= 0;
  if (params.keyName === "right") return params.cursorOffset >= params.valueLength;
  return false;
}
