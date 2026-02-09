import { EditorFocus, FocusTarget, Mode } from "../domain/models";

const editorFocusOrder: FocusTarget[] = [
  "editor_title",
  "editor_due_date",
  "editor_due_time",
  "editor_tags",
  "editor_notes",
  "editor_save",
  "editor_cancel"
];

export function isEditorMode(mode: Mode): mode is "add" | "edit" {
  return mode === "add" || mode === "edit";
}

export function toFocusTarget(editorFocus: EditorFocus): FocusTarget {
  switch (editorFocus) {
    case "title":
      return "editor_title";
    case "due":
      return "editor_due_date";
    case "time":
      return "editor_due_time";
    case "tags":
      return "editor_tags";
    case "notes":
      return "editor_notes";
    case "save":
      return "editor_save";
    case "cancel":
      return "editor_cancel";
    default:
      return "editor_title";
  }
}

export function toEditorFocus(focus: FocusTarget): EditorFocus {
  switch (focus) {
    case "editor_title":
      return "title";
    case "editor_due_date":
      return "due";
    case "editor_due_time":
      return "time";
    case "editor_tags":
      return "tags";
    case "editor_notes":
      return "notes";
    case "editor_save":
      return "save";
    case "editor_cancel":
      return "cancel";
    default:
      return "title";
  }
}

export function nextEditorFocusTarget(
  current: FocusTarget,
  direction: 1 | -1
): FocusTarget {
  const index = editorFocusOrder.indexOf(current);
  const safeIndex = index === -1 ? 0 : index;
  const nextIndex = (safeIndex + direction + editorFocusOrder.length) % editorFocusOrder.length;
  return editorFocusOrder[nextIndex];
}

export function resolveModalAction(
  name: string,
  sequence: string
): "confirm" | "cancel" | "none" {
  if (sequence === "y" || name === "y") return "confirm";
  if (sequence === "n" || name === "n" || name === "escape") return "cancel";
  return "none";
}

export function shouldCloseHelp(name: string, sequence: string): boolean {
  return name === "escape" || sequence === "?";
}

export function shouldCloseSearch(name: string): boolean {
  return name === "escape" || name === "return" || name === "enter";
}

export function getNextSelectedIdAfterDelete(
  visibleIds: string[],
  deletedId: string
): string | undefined {
  if (visibleIds.length <= 1) return undefined;
  const index = visibleIds.indexOf(deletedId);
  if (index === -1) return visibleIds[0];
  if (index === visibleIds.length - 1) {
    return visibleIds[index - 1];
  }
  return visibleIds[index + 1];
}
