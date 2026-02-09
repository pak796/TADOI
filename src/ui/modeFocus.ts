export const Mode = {
  LIST: "list",
  ADD: "add",
  EDIT: "edit",
  SEARCH: "search",
  HELP: "help",
  MODAL_CONFIRM: "modal_confirm"
} as const;

export type Mode = (typeof Mode)[keyof typeof Mode];

export const FocusTarget = {
  TASK_LIST: "task_list",
  SEARCH_INPUT: "search_input",
  MODAL: "modal",
  EDITOR_TITLE: "editor_title",
  EDITOR_DUE_DATE: "editor_due_date",
  EDITOR_DUE_TIME: "editor_due_time",
  EDITOR_TAGS: "editor_tags",
  EDITOR_NOTES: "editor_notes",
  // Compatibility targets for current editor controls.
  EDITOR_SAVE: "editor_save",
  EDITOR_CANCEL: "editor_cancel"
} as const;

export type FocusTarget = (typeof FocusTarget)[keyof typeof FocusTarget];

export function isEditorMode(
  mode: Mode
): mode is typeof Mode.ADD | typeof Mode.EDIT {
  return mode === Mode.ADD || mode === Mode.EDIT;
}

export function isModalMode(
  mode: Mode
): mode is typeof Mode.MODAL_CONFIRM {
  return mode === Mode.MODAL_CONFIRM;
}
