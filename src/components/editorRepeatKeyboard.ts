import { EditorDraft } from "../domain/models";

export type RepeatMode = EditorDraft["repeatMode"];
export type RepeatEndMode = EditorDraft["repeatEndMode"];

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
