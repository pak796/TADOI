export const Mode = {
  LIST: "list",
  DASHBOARD: "dashboard",
  ADD: "add",
  EDIT: "edit",
  SEARCH: "search",
  TAG_FILTER: "tag_filter",
  NOTES_LIST: "notes_list",
  NOTES_VIEW: "notes_view",
  NOTES_EDIT: "notes_edit",
  NOTES_SEARCH: "notes_search",
  NOTES_TAG_FILTER: "notes_tag_filter",
  HELP: "help",
  BACKUP_CENTER: "backup_center",
  MODAL_CONFIRM: "modal_confirm",
} as const;

export type Mode = (typeof Mode)[keyof typeof Mode];

export const FocusTarget = {
  TASK_LIST: "task_list",
  DETAILS_LINKS: "details_links",
  DETAILS_NOTES: "details_notes",
  DETAILS_CHECKLIST: "details_checklist",
  DASHBOARD: "dashboard",
  BACKUP_CENTER: "backup_center",
  SEARCH_INPUT: "search_input",
  TAG_FILTER_INPUT: "tag_filter_input",
  NOTES_LIST: "notes_list",
  NOTES_VIEW: "notes_view",
  NOTES_EDIT: "notes_edit",
  NOTES_SEARCH_INPUT: "notes_search_input",
  NOTES_TAG_FILTER_INPUT: "notes_tag_filter_input",
  MODAL: "modal",
  EDITOR_TITLE: "editor_title",
  EDITOR_DUE_DATE: "editor_due_date",
  EDITOR_DUE_TIME: "editor_due_time",
  EDITOR_REMINDER_KIND: "editor_reminder_kind",
  EDITOR_REMINDER_AT_DATE: "editor_reminder_at_date",
  EDITOR_REMINDER_AT_TIME: "editor_reminder_at_time",
  EDITOR_REMINDER_OFFSET_VALUE: "editor_reminder_offset_value",
  EDITOR_REMINDER_OFFSET_UNIT: "editor_reminder_offset_unit",
  EDITOR_REPEAT_MODE: "editor_repeat_mode",
  EDITOR_REPEAT_INTERVAL: "editor_repeat_interval",
  EDITOR_REPEAT_WEEKDAYS: "editor_repeat_weekdays",
  EDITOR_REPEAT_MONTHDAY: "editor_repeat_monthday",
  EDITOR_REPEAT_END_MODE: "editor_repeat_end_mode",
  EDITOR_REPEAT_UNTIL: "editor_repeat_until",
  EDITOR_REPEAT_COUNT: "editor_repeat_count",
  EDITOR_REPEAT_CUSTOM: "editor_repeat_custom",
  EDITOR_ASSIGNEE: "editor_assignee",
  EDITOR_PROJECT: "editor_project",
  EDITOR_WORKFLOW_STAGE: "editor_workflow_stage",
  EDITOR_TAGS: "editor_tags",
  EDITOR_CHECKLIST: "editor_checklist",
  EDITOR_NOTES: "editor_notes",
  // Compatibility targets for current editor controls.
  EDITOR_SAVE: "editor_save",
  EDITOR_CANCEL: "editor_cancel",
} as const;

export type FocusTarget = (typeof FocusTarget)[keyof typeof FocusTarget];

export function isEditorMode(
  mode: Mode,
): mode is typeof Mode.ADD | typeof Mode.EDIT {
  return mode === Mode.ADD || mode === Mode.EDIT;
}

export function isModalMode(mode: Mode): mode is typeof Mode.MODAL_CONFIRM {
  return mode === Mode.MODAL_CONFIRM;
}
