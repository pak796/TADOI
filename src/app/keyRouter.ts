import { FocusTarget, Mode } from "../domain/models";
import { UIState, type EmptyNuxStep } from "../ui/state";
import type { BackupCenterScreen } from "../state/backupCenterFlow";
import type { ImportMode } from "../state/portability";
import {
  resolveAliasActionIdForInput,
  type ActionAliasId,
  type ResolvedKeymapAliases
} from "./keymapAliases";

export type KeyInput = {
  name: string;
  sequence: string;
  ctrl: boolean;
  shift: boolean;
};

export type KeyRouterContext = {
  uiState: UIState;
  hasTitleInlineSuggestion?: boolean;
  hasTagInlineSuggestion: boolean;
  hasDueSuggestion: boolean;
  timeAutocompleteStep: "hour" | "minute" | "none" | "invalid";
  hasPendingGPrefix: boolean;
  bulkActive: boolean;
  viewsOverlayOpen: boolean;
  saveViewPromptOpen: boolean;
  allowEmptyNuxRecoveryImport: boolean;
  backupScreen: BackupCenterScreen | null;
  selectedTaskHasChecklistItems?: boolean;
  resolvedKeymapAliases?: ResolvedKeymapAliases | null;
  notesRootSettingsOpen?: boolean;
  notesCreatePromptOpen?: boolean;
  notesRenamePromptOpen?: boolean;
  notesDeletePromptOpen?: boolean;
  helpPage?:
    | "help"
    | "settings"
    | "keymapAliases"
    | "theme"
    | "custom1"
    | "custom1Edit"
    | "textTuning"
    | "textTuningTheme"
    | "textTuningEdit";
};

export type KeyRouterAction =
  | { scope: "ui"; type: "UNWIND" }
  | { scope: "ui"; type: "OPEN_NOTES" }
  | { scope: "ui"; type: "OPEN_NOTES_SEARCH" }
  | { scope: "ui"; type: "CLOSE_NOTES_SEARCH" }
  | { scope: "ui"; type: "OPEN_NOTES_TAG_FILTER" }
  | { scope: "ui"; type: "CLOSE_NOTES_TAG_FILTER" }
  | { scope: "ui"; type: "NOTES_MOVE_SELECTION"; delta: 1 | -1 }
  | { scope: "ui"; type: "NOTES_OPEN_SELECTED" }
  | { scope: "ui"; type: "NOTES_OPEN_CREATE" }
  | { scope: "ui"; type: "NOTES_CLOSE_CREATE" }
  | { scope: "ui"; type: "NOTES_CONFIRM_CREATE" }
  | { scope: "ui"; type: "NOTES_OPEN_RENAME" }
  | { scope: "ui"; type: "NOTES_CLOSE_RENAME" }
  | { scope: "ui"; type: "NOTES_CONFIRM_RENAME" }
  | { scope: "ui"; type: "NOTES_OPEN_DELETE" }
  | { scope: "ui"; type: "NOTES_CLOSE_DELETE" }
  | { scope: "ui"; type: "NOTES_CONFIRM_DELETE" }
  | { scope: "ui"; type: "NOTES_EDIT_SELECTED" }
  | { scope: "ui"; type: "NOTES_REINDEX" }
  | { scope: "ui"; type: "NOTES_OPEN_ROOT_SETTINGS" }
  | { scope: "ui"; type: "NOTES_CLOSE_ROOT_SETTINGS" }
  | { scope: "ui"; type: "NOTES_CONFIRM_ROOT_SETTINGS" }
  | { scope: "ui"; type: "NOTES_VIEW_MOVE_LINK_SELECTION"; delta: 1 | -1 }
  | { scope: "ui"; type: "NOTES_FOLLOW_LINK" }
  | { scope: "ui"; type: "NOTES_BACK_TO_LIST" }
  | { scope: "ui"; type: "NOTES_EXIT_TO_LIST" }
  | { scope: "ui"; type: "NOTES_SAVE_EDIT" }
  | { scope: "ui"; type: "NOTES_CANCEL_EDIT" }
  | {
      scope: "ui";
      type: "OPEN_EMPTY_NUX";
      step?: EmptyNuxStep;
      startedFromNux?: boolean;
      createdTaskId?: string;
    }
  | { scope: "ui"; type: "DISMISS_EMPTY_NUX" }
  | { scope: "ui"; type: "CLEAR_EMPTY_NUX" }
  | { scope: "ui"; type: "SET_MODAL"; modal: UIState["modal"] }
  | { scope: "ui"; type: "TOGGLE_DASHBOARD" }
  | { scope: "ui"; type: "OPEN_HELP" }
  | { scope: "ui"; type: "OPEN_BACKUP_CENTER" }
  | { scope: "ui"; type: "OPEN_BACKUP_CENTER_IMPORT" }
  | { scope: "ui"; type: "OPEN_TAG_FILTER_PANEL" }
  | { scope: "ui"; type: "CLOSE_HELP" }
  | { scope: "ui"; type: "OPEN_SEARCH" }
  | { scope: "ui"; type: "CLOSE_SEARCH" }
  | { scope: "ui"; type: "BACKUP_PRIMARY" }
  | { scope: "ui"; type: "BACKUP_BACK" }
  | { scope: "ui"; type: "BACKUP_MOVE_MENU_SELECTION"; delta: 1 | -1 }
  | { scope: "ui"; type: "BACKUP_SELECT_MENU_OPTION"; index: 0 | 1 | 2 | 3 }
  | { scope: "ui"; type: "BACKUP_SELECT_DIGIT"; digit: number }
  | { scope: "ui"; type: "BACKUP_SET_IMPORT_MODE"; mode: ImportMode }
  | { scope: "ui"; type: "BACKUP_PICKER_MOVE_SELECTION"; delta: 1 | -1 }
  | { scope: "ui"; type: "BACKUP_PICKER_PAGE_SELECTION"; delta: 1 | -1 }
  | { scope: "ui"; type: "BACKUP_PICKER_JUMP_SELECTION"; target: "start" | "end" }
  | { scope: "ui"; type: "BACKUP_PICKER_CONFIRM_SELECTION" }
  | { scope: "ui"; type: "BACKUP_PICKER_OPEN_MANUAL_PATH" }
  | { scope: "ui"; type: "BACKUP_SCROLL_BODY"; delta: number }
  | { scope: "ui"; type: "MOVE_EDITOR_FOCUS"; direction: 1 | -1 }
  | {
      scope: "ui";
      type: "SET_LIST_FOCUS";
      focus:
        | typeof FocusTarget.TASK_LIST
        | typeof FocusTarget.DETAILS_LINKS
        | typeof FocusTarget.DETAILS_CHECKLIST;
    }
  | { scope: "ui"; type: "CLEAR_BULK_MARKS" }
  | { scope: "ui"; type: "SET_G_PREFIX"; active: boolean }
  | { scope: "ui"; type: "TOGGLE_VIEWS_OVERLAY" }
  | { scope: "ui"; type: "CLOSE_VIEWS_OVERLAY" }
  | { scope: "ui"; type: "MOVE_VIEW_SELECTION"; delta: 1 | -1 }
  | { scope: "ui"; type: "OPEN_SAVE_VIEW_PROMPT" }
  | { scope: "ui"; type: "CONFIRM_SAVE_VIEW_PROMPT" }
  | { scope: "ui"; type: "CANCEL_SAVE_VIEW_PROMPT" }
  | { scope: "ui"; type: "MOVE_DASHBOARD_TAG_SELECTION"; delta: 1 | -1 }
  | { scope: "ui"; type: "DASHBOARD_NEXT_FOCUS_GROUP" }
  | { scope: "ui"; type: "DASHBOARD_PREV_FOCUS_GROUP" }
  | { scope: "ui"; type: "DASHBOARD_MOVE_ACTIVE_SELECTION"; delta: 1 | -1 }
  | { scope: "ui"; type: "SCROLL_EDITOR_PAGE"; direction: 1 | -1 }
  | { scope: "ui"; type: "HELP_MOVE_SECTION_FOCUS"; delta: 1 | -1 }
  | { scope: "ui"; type: "HELP_TOGGLE_FOCUSED_SECTION" }
  | { scope: "ui"; type: "HELP_NAV_FORWARD" }
  | { scope: "ui"; type: "HELP_NAV_BACK" }
  | {
      scope: "ui";
      type: "HELP_SET_FOCUSED_SECTION_EXPANDED";
      expanded: boolean;
    }
  | { scope: "ui"; type: "HELP_SCROLL_PAGE"; direction: 1 | -1 }
  | { scope: "ui"; type: "CYCLE_THEME" }
  | { scope: "ui"; type: "TOGGLE_FLASH_MODE" }
  | { scope: "ui"; type: "TOGGLE_NOTIFICATIONS_ENABLED" }
  | { scope: "ui"; type: "TOGGLE_INAPP_OVERDUE_BANNER" }
  | { scope: "ui"; type: "TOGGLE_TERMINAL_BELL_ON_OVERDUE" }
  | { scope: "domain"; type: "EXIT_APP" }
  | { scope: "domain"; type: "MOVE_SELECTION"; delta: 1 | -1 }
  | { scope: "domain"; type: "MOVE_SELECTION_PAGE"; direction: 1 | -1 }
  | { scope: "domain"; type: "JUMP_TOP" }
  | { scope: "domain"; type: "JUMP_BOTTOM" }
  | { scope: "domain"; type: "APPLY_VIEW_SLOT"; slot: number }
  | { scope: "domain"; type: "APPLY_SELECTED_VIEW" }
  | { scope: "domain"; type: "DELETE_SELECTED_VIEW" }
  | {
      scope: "domain";
      type: "JUMP_TO_ATTENTION";
      kind: "overdue" | "today";
      direction: 1 | -1;
    }
  | { scope: "domain"; type: "TOGGLE_SELECTED" }
  | { scope: "domain"; type: "OPEN_ADD" }
  | { scope: "domain"; type: "OPEN_EDIT" }
  | { scope: "domain"; type: "OPEN_EDIT_CHECKLIST_QUICK" }
  | { scope: "domain"; type: "OPEN_EDIT_SERIES" }
  | { scope: "domain"; type: "OPEN_DUPLICATE" }
  | { scope: "domain"; type: "SKIP_SELECTED_OCCURRENCE" }
  | { scope: "domain"; type: "SNOOZE_SELECTED_OCCURRENCE" }
  | { scope: "domain"; type: "MOVE_LINK_SELECTION"; delta: 1 | -1 }
  | { scope: "domain"; type: "MOVE_CHECKLIST_SELECTION"; delta: 1 | -1 }
  | { scope: "domain"; type: "OPEN_SELECTED_LINK" }
  | { scope: "domain"; type: "COPY_SELECTED_LINK" }
  | { scope: "domain"; type: "TOGGLE_SELECTED_CHECKLIST_ITEM" }
  | { scope: "domain"; type: "OPEN_ADD_CHECKLIST_ITEM_MODAL" }
  | { scope: "domain"; type: "OPEN_EDIT_CHECKLIST_ITEM_MODAL" }
  | { scope: "domain"; type: "OPEN_DELETE_CHECKLIST_ITEM_MODAL" }
  | { scope: "domain"; type: "TOGGLE_BULK_MARK" }
  | { scope: "domain"; type: "OPEN_ADD_TASK_LINK_MODAL" }
  | { scope: "domain"; type: "OPEN_EDIT_TASK_LINK_MODAL" }
  | { scope: "domain"; type: "OPEN_DELETE_TASK_LINK_MODAL" }
  | { scope: "domain"; type: "OPEN_DELETE_CONFIRM" }
  | {
      scope: "ui";
      type: "OPEN_UNSAVED_CHANGES_MODAL";
      modal: Extract<NonNullable<UIState["modal"]>, { type: "unsaved_changes" }>;
    }
  | { scope: "domain"; type: "MODAL_CONFIRM_UNSAVED_SAVE_CONTINUE" }
  | { scope: "domain"; type: "MODAL_CONFIRM_UNSAVED_DISCARD_CONTINUE" }
  | { scope: "ui"; type: "MODAL_CANCEL_UNSAVED_CONTINUE" }
  | {
      scope: "ui";
      type: "OPEN_BACKUP_FINAL_CHECKPOINT_MODAL";
      modal: Extract<NonNullable<UIState["modal"]>, { type: "backup_final_checkpoint" }>;
    }
  | { scope: "domain"; type: "MODAL_CONFIRM_BACKUP_FINAL_CHECKPOINT" }
  | { scope: "ui"; type: "MODAL_CANCEL_BACKUP_FINAL_CHECKPOINT" }
  | {
      scope: "ui";
      type: "OPEN_RECURRING_DELETE_FUTURE_CHECKPOINT_MODAL";
      modal: Extract<
        NonNullable<UIState["modal"]>,
        { type: "recurring_delete_future_checkpoint" }
      >;
    }
  | { scope: "domain"; type: "MODAL_CONFIRM_RECURRING_DELETE_FUTURE_CHECKPOINT" }
  | { scope: "ui"; type: "MODAL_CANCEL_RECURRING_DELETE_FUTURE_CHECKPOINT" }
  | { scope: "domain"; type: "MODAL_CONFIRM_DELETE" }
  | { scope: "domain"; type: "MODAL_CONFIRM_DELETE_FUTURE" }
  | { scope: "domain"; type: "MODAL_CONFIRM_CHECKLIST_DELETE" }
  | { scope: "domain"; type: "MODAL_SUBMIT_CHECKLIST_INPUT" }
  | { scope: "domain"; type: "MODAL_CONFIRM_BULK_DELETE" }
  | { scope: "domain"; type: "MODAL_CONFIRM_TASK_LINK_DELETE" }
  | { scope: "domain"; type: "MODAL_CONFIRM_TASK_LINK_OPEN_EXTERNAL" }
  | { scope: "domain"; type: "MODAL_EDIT_SWITCH_SAVE" }
  | { scope: "domain"; type: "MODAL_EDIT_SWITCH_DISCARD_SWITCH" }
  | { scope: "domain"; type: "MODAL_EDIT_SWITCH_DISCARD_CLOSE" }
  | { scope: "domain"; type: "MODAL_SUBMIT_TASK_LINK_FORM" }
  | { scope: "ui"; type: "MODAL_MOVE_TASK_LINK_FORM_FOCUS"; direction: 1 | -1 }
  | { scope: "ui"; type: "MODAL_CYCLE_TASK_LINK_FORM_TYPE"; direction: 1 | -1 }
  | { scope: "domain"; type: "MODAL_OVERDUE_SNOOZE" }
  | { scope: "domain"; type: "MODAL_OVERDUE_DONE" }
  | { scope: "domain"; type: "MODAL_OVERDUE_GO_TO_TASK" }
  | { scope: "domain"; type: "MODAL_REMINDER_DISMISS" }
  | { scope: "domain"; type: "MODAL_REMINDER_SNOOZE"; deltaMs: number }
  | { scope: "domain"; type: "MODAL_REMINDER_GO_TO_TASK" }
  | { scope: "domain"; type: "CYCLE_STATUS" }
  | { scope: "domain"; type: "CYCLE_SORT" }
  | { scope: "domain"; type: "CYCLE_DUE" }
  | { scope: "domain"; type: "CYCLE_ANALYTICS_WINDOW" }
  | { scope: "domain"; type: "CYCLE_PRIORITY" }
  | { scope: "domain"; type: "TOGGLE_TAG_FILTER" }
  | { scope: "domain"; type: "APPLY_DASHBOARD_SELECTED_TAG" }
  | { scope: "domain"; type: "APPLY_DASHBOARD_ACTIVE_SELECTION" }
  | { scope: "domain"; type: "SAVE_EDITOR" }
  | { scope: "domain"; type: "ACCEPT_TITLE_INLINE" }
  | { scope: "domain"; type: "APPLY_TIME_AUTOCOMPLETE" }
  | { scope: "domain"; type: "ACCEPT_DUE_SUGGESTION" }
  | { scope: "domain"; type: "ACCEPT_TAG_INLINE" };

function isLowerG(name: string, sequence: string, ctrl: boolean, shift: boolean): boolean {
  return !ctrl && !shift && (name === "g" || sequence === "g");
}

function isUpperG(name: string, sequence: string, ctrl: boolean): boolean {
  return !ctrl && (sequence === "G" || name === "G");
}

function isPageUpKey(name: string, ctrl: boolean): boolean {
  return (
    (ctrl && name === "u") ||
    name === "pageup" ||
    name === "page_up" ||
    name === "prior"
  );
}

function isPageDownKey(name: string, ctrl: boolean): boolean {
  return (
    (ctrl && name === "d") ||
    name === "pagedown" ||
    name === "page_down" ||
    name === "next"
  );
}

function isDashboardToggleKey(name: string, sequence: string, ctrl: boolean): boolean {
  return !ctrl && (name === "b" || name === "B" || sequence === "b" || sequence === "B");
}

function isTagPanelOpenKey(
  name: string,
  sequence: string,
  ctrl: boolean,
  shift: boolean
): boolean {
  return !ctrl && !shift && (name === "p" || sequence === "p");
}

function isNotesOpenKey(
  name: string,
  sequence: string,
  ctrl: boolean,
  shift: boolean
): boolean {
  return !ctrl && !shift && (name === "n" || sequence === "n");
}

const BACKUP_INPUT_SUBMIT_SCREENS = new Set<BackupCenterScreen>([
  "import_path",
  "import_confirm",
  "calendar_export_path",
  "calendar_import_path",
  "calendar_import_horizon",
  "calendar_import_tag",
  "calendar_import_confirm",
  "github_connect_repo_input",
  "github_connect_public_confirm"
]);

const BACKUP_PICKER_JUMP_KEYS = {
  start: "home",
  end: "end"
} as const;

function backupScreenSupportsBodyScrollKeys(screen: BackupCenterScreen | null): boolean {
  return (
    screen !== null &&
    screen !== "menu" &&
    screen !== "calendar_menu" &&
    screen !== "import_mode" &&
    screen !== "import_picker" &&
    !BACKUP_INPUT_SUBMIT_SCREENS.has(screen)
  );
}

function resolveContextAliasActionId(
  context: "list" | "dashboard" | "backup" | "help",
  key: KeyInput,
  routerContext: KeyRouterContext
): ActionAliasId | null {
  return resolveAliasActionIdForInput(context, key, routerContext.resolvedKeymapAliases);
}

function resolveListAliasActions(
  key: KeyInput,
  context: KeyRouterContext
): KeyRouterAction[] | null {
  const actionId = resolveContextAliasActionId("list", key, context);
  if (!actionId) return null;
  switch (actionId) {
    case "list_open_add":
      return [{ scope: "domain", type: "OPEN_ADD" }];
    case "list_open_edit":
      return [{ scope: "domain", type: "OPEN_EDIT" }];
    case "list_toggle_selected":
      return [{ scope: "domain", type: "TOGGLE_SELECTED" }];
    case "list_open_search":
      return [{ scope: "ui", type: "OPEN_SEARCH" }];
    case "list_cycle_status":
      return [{ scope: "domain", type: "CYCLE_STATUS" }];
    case "list_cycle_sort":
      return [{ scope: "domain", type: "CYCLE_SORT" }];
    case "list_cycle_due":
      return [{ scope: "domain", type: "CYCLE_DUE" }];
    case "list_cycle_priority":
      return [{ scope: "domain", type: "CYCLE_PRIORITY" }];
    case "list_cycle_tag":
      return [{ scope: "domain", type: "TOGGLE_TAG_FILTER" }];
    case "list_open_tag_panel":
      return [{ scope: "ui", type: "OPEN_TAG_FILTER_PANEL" }];
    case "list_toggle_dashboard":
      return [{ scope: "ui", type: "TOGGLE_DASHBOARD" }];
    case "list_open_backup_center":
      return [{ scope: "ui", type: "OPEN_BACKUP_CENTER" }];
    case "list_move_up":
      return [{ scope: "domain", type: "MOVE_SELECTION", delta: -1 }];
    case "list_move_down":
      return [{ scope: "domain", type: "MOVE_SELECTION", delta: 1 }];
    case "list_page_up":
      return [{ scope: "domain", type: "MOVE_SELECTION_PAGE", direction: -1 }];
    case "list_page_down":
      return [{ scope: "domain", type: "MOVE_SELECTION_PAGE", direction: 1 }];
    case "list_jump_top":
      return [{ scope: "domain", type: "JUMP_TOP" }];
    case "list_jump_bottom":
      return [{ scope: "domain", type: "JUMP_BOTTOM" }];
    default:
      return null;
  }
}

function resolveDashboardAliasActions(
  key: KeyInput,
  context: KeyRouterContext
): KeyRouterAction[] | null {
  const actionId = resolveContextAliasActionId("dashboard", key, context);
  if (!actionId) return null;
  switch (actionId) {
    case "dashboard_move_up":
      return [{ scope: "ui", type: "DASHBOARD_MOVE_ACTIVE_SELECTION", delta: -1 }];
    case "dashboard_move_down":
      return [{ scope: "ui", type: "DASHBOARD_MOVE_ACTIVE_SELECTION", delta: 1 }];
    case "dashboard_apply_selection":
      return [{ scope: "domain", type: "APPLY_DASHBOARD_ACTIVE_SELECTION" }];
    case "dashboard_cycle_status":
      return [{ scope: "domain", type: "CYCLE_STATUS" }];
    case "dashboard_cycle_due":
      return [{ scope: "domain", type: "CYCLE_DUE" }];
    case "dashboard_cycle_priority":
      return [{ scope: "domain", type: "CYCLE_PRIORITY" }];
    case "dashboard_cycle_tag":
      return [{ scope: "domain", type: "TOGGLE_TAG_FILTER" }];
    case "dashboard_open_tag_panel":
      return [{ scope: "ui", type: "OPEN_TAG_FILTER_PANEL" }];
    case "dashboard_cycle_window":
      return [{ scope: "domain", type: "CYCLE_ANALYTICS_WINDOW" }];
    case "dashboard_next_focus":
      return [{ scope: "ui", type: "DASHBOARD_NEXT_FOCUS_GROUP" }];
    case "dashboard_prev_focus":
      return [{ scope: "ui", type: "DASHBOARD_PREV_FOCUS_GROUP" }];
    case "dashboard_toggle_dashboard":
      return [{ scope: "ui", type: "TOGGLE_DASHBOARD" }];
    case "dashboard_open_help":
      return [{ scope: "ui", type: "OPEN_HELP" }];
    case "dashboard_open_backup_center":
      return [{ scope: "ui", type: "OPEN_BACKUP_CENTER" }];
    default:
      return null;
  }
}

function resolveHelpAliasActions(
  key: KeyInput,
  context: KeyRouterContext
): KeyRouterAction[] | null {
  const actionId = resolveContextAliasActionId("help", key, context);
  if (!actionId) return null;
  switch (actionId) {
    case "help_move_up":
      return [{ scope: "ui", type: "HELP_MOVE_SECTION_FOCUS", delta: -1 }];
    case "help_move_down":
      return [{ scope: "ui", type: "HELP_MOVE_SECTION_FOCUS", delta: 1 }];
    case "help_page_up":
      return [{ scope: "ui", type: "HELP_SCROLL_PAGE", direction: -1 }];
    case "help_page_down":
      return [{ scope: "ui", type: "HELP_SCROLL_PAGE", direction: 1 }];
    case "help_nav_back":
      return [{ scope: "ui", type: "HELP_NAV_BACK" }];
    case "help_nav_forward":
      return [{ scope: "ui", type: "HELP_NAV_FORWARD" }];
    case "help_toggle_focused_section":
      return [{ scope: "ui", type: "HELP_TOGGLE_FOCUSED_SECTION" }];
    case "help_close":
      return [{ scope: "ui", type: "CLOSE_HELP" }];
    case "help_open_backup_center":
      return [{ scope: "ui", type: "OPEN_BACKUP_CENTER" }];
    default:
      return null;
  }
}

function resolveBackupAliasActions(
  key: KeyInput,
  context: KeyRouterContext
): KeyRouterAction[] | null {
  const actionId = resolveContextAliasActionId("backup", key, context);
  if (!actionId) return null;
  const { backupScreen } = context;

  switch (actionId) {
    case "backup_primary":
      if (
        backupScreen &&
        BACKUP_INPUT_SUBMIT_SCREENS.has(backupScreen)
      ) {
        return [];
      }
      if (backupScreen === "import_picker" || backupScreen === "github_restore_picker") {
        return [{ scope: "ui", type: "BACKUP_PICKER_CONFIRM_SELECTION" }];
      }
      return [{ scope: "ui", type: "BACKUP_PRIMARY" }];
    case "backup_back":
      return [{ scope: "ui", type: "BACKUP_BACK" }];
    case "backup_move_up":
      if (backupScreen === "import_picker" || backupScreen === "github_restore_picker") {
        return [{ scope: "ui", type: "BACKUP_PICKER_MOVE_SELECTION", delta: -1 }];
      }
      if (backupScreen === "menu" || backupScreen === "calendar_menu") {
        return [{ scope: "ui", type: "BACKUP_MOVE_MENU_SELECTION", delta: -1 }];
      }
      if (backupScreenSupportsBodyScrollKeys(backupScreen)) {
        return [{ scope: "ui", type: "BACKUP_SCROLL_BODY", delta: -1 }];
      }
      return [];
    case "backup_move_down":
      if (backupScreen === "import_picker" || backupScreen === "github_restore_picker") {
        return [{ scope: "ui", type: "BACKUP_PICKER_MOVE_SELECTION", delta: 1 }];
      }
      if (backupScreen === "menu" || backupScreen === "calendar_menu") {
        return [{ scope: "ui", type: "BACKUP_MOVE_MENU_SELECTION", delta: 1 }];
      }
      if (backupScreenSupportsBodyScrollKeys(backupScreen)) {
        return [{ scope: "ui", type: "BACKUP_SCROLL_BODY", delta: 1 }];
      }
      return [];
    case "backup_page_up":
      if (backupScreen === "import_picker" || backupScreen === "github_restore_picker") {
        return [{ scope: "ui", type: "BACKUP_PICKER_PAGE_SELECTION", delta: -1 }];
      }
      if (backupScreenSupportsBodyScrollKeys(backupScreen)) {
        return [{ scope: "ui", type: "BACKUP_SCROLL_BODY", delta: -8 }];
      }
      return [];
    case "backup_page_down":
      if (backupScreen === "import_picker" || backupScreen === "github_restore_picker") {
        return [{ scope: "ui", type: "BACKUP_PICKER_PAGE_SELECTION", delta: 1 }];
      }
      if (backupScreenSupportsBodyScrollKeys(backupScreen)) {
        return [{ scope: "ui", type: "BACKUP_SCROLL_BODY", delta: 8 }];
      }
      return [];
    case "backup_jump_start":
      if (backupScreen === "import_picker" || backupScreen === "github_restore_picker") {
        return [{ scope: "ui", type: "BACKUP_PICKER_JUMP_SELECTION", target: "start" }];
      }
      return [];
    case "backup_jump_end":
      if (backupScreen === "import_picker" || backupScreen === "github_restore_picker") {
        return [{ scope: "ui", type: "BACKUP_PICKER_JUMP_SELECTION", target: "end" }];
      }
      return [];
    case "backup_open_manual_path":
      if (backupScreen === "import_picker") {
        return [{ scope: "ui", type: "BACKUP_PICKER_OPEN_MANUAL_PATH" }];
      }
      return [];
    case "backup_menu_option_1":
      if (backupScreen === "menu") {
        return [{ scope: "ui", type: "BACKUP_SELECT_MENU_OPTION", index: 0 }];
      }
      return [];
    case "backup_menu_option_2":
      if (backupScreen === "menu") {
        return [{ scope: "ui", type: "BACKUP_SELECT_MENU_OPTION", index: 1 }];
      }
      return [];
    case "backup_menu_option_3":
      if (backupScreen === "menu") {
        return [{ scope: "ui", type: "BACKUP_SELECT_MENU_OPTION", index: 2 }];
      }
      return [];
    case "backup_menu_option_4":
      if (backupScreen === "menu") {
        return [{ scope: "ui", type: "BACKUP_SELECT_MENU_OPTION", index: 3 }];
      }
      return [];
    default:
      return null;
  }
}

function listModeActions(
  key: KeyInput,
  context: KeyRouterContext
): KeyRouterAction[] {
  const { name, sequence, ctrl, shift } = key;
  const selectedTaskHasChecklistItems = context.selectedTaskHasChecklistItems ?? false;
  const aliasedActions = resolveListAliasActions(key, context);
  if (aliasedActions !== null) return aliasedActions;
  if (sequence === "?") return [{ scope: "ui", type: "OPEN_HELP" }];
  if (name === "q") return [{ scope: "domain", type: "EXIT_APP" }];
  if (isUpperG(name, sequence, ctrl)) return [{ scope: "domain", type: "JUMP_BOTTOM" }];
  if (isPageUpKey(name, ctrl)) {
    return [{ scope: "domain", type: "MOVE_SELECTION_PAGE", direction: -1 }];
  }
  if (isPageDownKey(name, ctrl)) {
    return [{ scope: "domain", type: "MOVE_SELECTION_PAGE", direction: 1 }];
  }
  if (sequence === "]" || name === "]") {
    return [
      { scope: "domain", type: "JUMP_TO_ATTENTION", kind: "overdue", direction: 1 }
    ];
  }
  if (sequence === "[" || name === "[") {
    return [
      { scope: "domain", type: "JUMP_TO_ATTENTION", kind: "overdue", direction: -1 }
    ];
  }
  if (sequence === "}" || name === "}") {
    return [
      { scope: "domain", type: "JUMP_TO_ATTENTION", kind: "today", direction: 1 }
    ];
  }
  if (sequence === "{" || name === "{") {
    return [
      { scope: "domain", type: "JUMP_TO_ATTENTION", kind: "today", direction: -1 }
    ];
  }
  if (name === "j" || name === "down") {
    return [{ scope: "domain", type: "MOVE_SELECTION", delta: 1 }];
  }
  if (name === "k" || name === "up") {
    return [{ scope: "domain", type: "MOVE_SELECTION", delta: -1 }];
  }
  if (!ctrl && !shift && (name === "m" || sequence === "m")) {
    return [{ scope: "domain", type: "TOGGLE_BULK_MARK" }];
  }
  if (name === "space") return [{ scope: "domain", type: "TOGGLE_SELECTED" }];
  if (name === "v") return [{ scope: "ui", type: "TOGGLE_VIEWS_OVERLAY" }];
  if (ctrl && name === "s") return [{ scope: "ui", type: "OPEN_SAVE_VIEW_PROMPT" }];
  if (/^[1-9]$/.test(sequence)) {
    return [{ scope: "domain", type: "APPLY_VIEW_SLOT", slot: Number(sequence) - 1 }];
  }
  if (name === "a") return [{ scope: "domain", type: "OPEN_ADD" }];
  if (name === "right" && selectedTaskHasChecklistItems) {
    return [{ scope: "domain", type: "OPEN_EDIT_CHECKLIST_QUICK" }];
  }
  if (name === "l" || name === "L" || sequence === "l" || sequence === "L") {
    return [{ scope: "domain", type: "OPEN_ADD_TASK_LINK_MODAL" }];
  }
  if (name === "e") return [{ scope: "domain", type: "OPEN_EDIT" }];
  if (name === "E" || sequence === "E") {
    return [{ scope: "domain", type: "OPEN_EDIT_SERIES" }];
  }
  if (name === "c") return [{ scope: "domain", type: "OPEN_DUPLICATE" }];
  if (name === "x") return [{ scope: "domain", type: "SKIP_SELECTED_OCCURRENCE" }];
  if (name === "z") return [{ scope: "domain", type: "SNOOZE_SELECTED_OCCURRENCE" }];
  if (!ctrl && name === "d") return [{ scope: "domain", type: "OPEN_DELETE_CONFIRM" }];
  if (name === "/") return [{ scope: "ui", type: "OPEN_SEARCH" }];
  if (name === "f") return [{ scope: "domain", type: "CYCLE_STATUS" }];
  if (!ctrl && name === "s") return [{ scope: "domain", type: "CYCLE_SORT" }];
  if (!ctrl && name === "g") return [{ scope: "domain", type: "CYCLE_DUE" }];
  if (!ctrl && name === "r") return [{ scope: "domain", type: "CYCLE_PRIORITY" }];
  if (!ctrl && !shift && (name === "u" || sequence === "u")) {
    return [{ scope: "ui", type: "OPEN_BACKUP_CENTER" }];
  }
  if (isNotesOpenKey(name, sequence, ctrl, shift)) {
    return [{ scope: "ui", type: "OPEN_NOTES" }];
  }
  if (isTagPanelOpenKey(name, sequence, ctrl, shift)) {
    return [{ scope: "ui", type: "OPEN_TAG_FILTER_PANEL" }];
  }
  if (name === "t") return [{ scope: "domain", type: "TOGGLE_TAG_FILTER" }];
  return [];
}

function isSearchCloseKey(name: string): boolean {
  return name === "escape" || name === "return" || name === "enter";
}

function isHelpCloseKey(name: string, sequence: string): boolean {
  return name === "escape" || sequence === "?";
}

export function handleKey(
  key: KeyInput,
  context: KeyRouterContext
): KeyRouterAction[] {
  const resolvers: Array<(k: KeyInput, c: KeyRouterContext) => KeyRouterAction[] | null> = [
    resolveEscapeActions,
    resolveModalModeActions,
    resolveDashboardToggleActions,
    resolveHelpModeActions,
    resolveBackupCenterModeActions,
    resolveDashboardModeActions,
    resolveNotesModeActions,
    resolveSearchModeActions,
    resolveEditorModeActions,
    resolveListModeActions
  ];

  for (const resolve of resolvers) {
    const actions = resolve(key, context);
    if (actions !== null) return actions;
  }

  return [];
}

function resolveEscapeActions(
  key: KeyInput,
  context: KeyRouterContext
): KeyRouterAction[] | null {
  const { name } = key;
  if (name !== "escape") return null;

  const {
    uiState,
    hasPendingGPrefix,
    bulkActive,
    saveViewPromptOpen,
    viewsOverlayOpen,
    helpPage,
    notesRootSettingsOpen = false,
    notesCreatePromptOpen = false,
    notesRenamePromptOpen = false,
    notesDeletePromptOpen = false
  } = context;
  const { mode, focus } = uiState;

  if (notesCreatePromptOpen) {
    return [{ scope: "ui", type: "NOTES_CLOSE_CREATE" }];
  }

  if (notesRenamePromptOpen) {
    return [{ scope: "ui", type: "NOTES_CLOSE_RENAME" }];
  }

  if (notesDeletePromptOpen) {
    return [{ scope: "ui", type: "NOTES_CLOSE_DELETE" }];
  }

  if (notesRootSettingsOpen) {
    return [{ scope: "ui", type: "NOTES_CLOSE_ROOT_SETTINGS" }];
  }

  if (mode === Mode.NOTES_EDIT) {
    return [{ scope: "ui", type: "NOTES_CANCEL_EDIT" }];
  }
  if (mode === Mode.NOTES_VIEW) {
    return [{ scope: "ui", type: "NOTES_BACK_TO_LIST" }];
  }
  if (mode === Mode.NOTES_LIST) {
    return [{ scope: "ui", type: "NOTES_EXIT_TO_LIST" }];
  }
  if (mode === Mode.NOTES_SEARCH) {
    return [{ scope: "ui", type: "CLOSE_NOTES_SEARCH" }];
  }
  if (mode === Mode.NOTES_TAG_FILTER) {
    return [{ scope: "ui", type: "CLOSE_NOTES_TAG_FILTER" }];
  }

  if (mode === Mode.HELP && (helpPage ?? "help") !== "help") {
    return [{ scope: "ui", type: "HELP_NAV_BACK" }];
  }
  if (hasPendingGPrefix) {
    return [{ scope: "ui", type: "SET_G_PREFIX", active: false }];
  }
  if (mode === Mode.MODAL_CONFIRM && uiState.modal?.type === "emptyNux") {
    // Step-specific Escape behavior is handled by resolveModalModeActions.
    return null;
  }
  if (mode === Mode.MODAL_CONFIRM && uiState.modal?.type === "recurring_delete_future_checkpoint") {
    return [{ scope: "ui", type: "MODAL_CANCEL_RECURRING_DELETE_FUTURE_CHECKPOINT" }];
  }
  if (mode === Mode.MODAL_CONFIRM && uiState.modal?.type === "unsaved_changes") {
    return [{ scope: "ui", type: "MODAL_CANCEL_UNSAVED_CONTINUE" }];
  }
  if (mode === Mode.MODAL_CONFIRM && uiState.modal?.type === "backup_final_checkpoint") {
    return [{ scope: "ui", type: "MODAL_CANCEL_BACKUP_FINAL_CHECKPOINT" }];
  }
  if (mode === Mode.MODAL_CONFIRM && uiState.modal?.type === "reminder") {
    return [{ scope: "domain", type: "MODAL_REMINDER_DISMISS" }];
  }
  if (mode === Mode.BACKUP_CENTER) {
    return [{ scope: "ui", type: "BACKUP_BACK" }];
  }
  if (mode === Mode.LIST && bulkActive) {
    return [{ scope: "ui", type: "CLEAR_BULK_MARKS" }];
  }
  if (mode === Mode.LIST && saveViewPromptOpen) {
    return [{ scope: "ui", type: "CANCEL_SAVE_VIEW_PROMPT" }];
  }
  if (mode === Mode.LIST && viewsOverlayOpen) {
    return [{ scope: "ui", type: "CLOSE_VIEWS_OVERLAY" }];
  }
  if (
    mode === Mode.LIST &&
    (focus === FocusTarget.DETAILS_LINKS || focus === FocusTarget.DETAILS_CHECKLIST)
  ) {
    return [{ scope: "ui", type: "SET_LIST_FOCUS", focus: FocusTarget.TASK_LIST }];
  }
  return [{ scope: "ui", type: "UNWIND" }];
}

function resolveModalModeActions(
  key: KeyInput,
  context: KeyRouterContext
): KeyRouterAction[] | null {
  const { name, sequence, ctrl, shift } = key;
  const { uiState, allowEmptyNuxRecoveryImport } = context;
  if (uiState.mode !== Mode.MODAL_CONFIRM) return null;

  if (uiState.modal?.type === "emptyNux") {
    const step = uiState.emptyNux?.step ?? "welcome";
    const lowerName = name.toLowerCase();
    const lowerSequence = sequence.toLowerCase();
    const createActions: KeyRouterAction[] = [
      {
        scope: "ui",
        type: "OPEN_EMPTY_NUX",
        step: "adding",
        startedFromNux: true
      },
      {
        scope: "ui",
        type: "SET_MODAL",
        modal: null
      },
      { scope: "domain", type: "OPEN_ADD" }
    ];

    if (step === "welcome") {
      if (
        name === "return" ||
        name === "enter" ||
        lowerName === "a" ||
        lowerSequence === "a"
      ) {
        return createActions;
      }
      if (
        allowEmptyNuxRecoveryImport &&
        (lowerName === "i" || lowerSequence === "i")
      ) {
        return [{ scope: "ui", type: "OPEN_BACKUP_CENTER_IMPORT" }];
      }
      if (lowerName === "h" || lowerSequence === "h") {
        return [{ scope: "ui", type: "OPEN_EMPTY_NUX", step: "shortcuts" }];
      }
      if (lowerName === "s" || lowerSequence === "s" || name === "escape") {
        return [{ scope: "ui", type: "DISMISS_EMPTY_NUX" }];
      }
      return [];
    }

    if (step === "shortcuts") {
      if (name === "escape") {
        return [{ scope: "ui", type: "OPEN_EMPTY_NUX", step: "welcome" }];
      }
      if (
        name === "return" ||
        name === "enter" ||
        lowerName === "a" ||
        lowerSequence === "a"
      ) {
        return createActions;
      }
      return [];
    }

    if (step === "celebrate") {
      if (name === "return" || name === "enter") {
        return [
          { scope: "ui", type: "CLEAR_EMPTY_NUX" },
          { scope: "ui", type: "SET_LIST_FOCUS", focus: FocusTarget.TASK_LIST }
        ];
      }
      if (lowerName === "a" || lowerSequence === "a") {
        return createActions;
      }
      if (lowerName === "h" || lowerSequence === "h") {
        return [{ scope: "ui", type: "OPEN_EMPTY_NUX", step: "shortcuts" }];
      }
      if (name === "escape") {
        return [{ scope: "ui", type: "CLEAR_EMPTY_NUX" }];
      }
      return [];
    }

    return [];
  }
  if (uiState.modal?.type === "delete") {
    const lowerName = name.toLowerCase();
    const lowerSequence = sequence.toLowerCase();
    if (lowerName === "y" || lowerSequence === "y") {
      return [{ scope: "domain", type: "MODAL_CONFIRM_DELETE" }];
    }
    if (
      uiState.modal.target === "recurring_occurrence" &&
      (lowerName === "f" || lowerSequence === "f")
    ) {
      return [{ scope: "ui", type: "OPEN_RECURRING_DELETE_FUTURE_CHECKPOINT_MODAL", modal: {
        type: "recurring_delete_future_checkpoint",
        deleteModal: uiState.modal,
        previousMode: uiState.modal.previousMode,
        previousFocus: uiState.modal.previousFocus
      } }];
    }
    if (lowerName === "n" || lowerSequence === "n") {
      return [{ scope: "ui", type: "UNWIND" }];
    }
    return [];
  }
  if (uiState.modal?.type === "note_delete") {
    const lowerName = name.toLowerCase();
    const lowerSequence = sequence.toLowerCase();
    if (lowerName === "y" || lowerSequence === "y") {
      return [
        { scope: "ui", type: "NOTES_CONFIRM_DELETE" },
        { scope: "ui", type: "NOTES_BACK_TO_LIST" }
      ];
    }
    if (lowerName === "n" || lowerSequence === "n") {
      return [{ scope: "ui", type: "UNWIND" }];
    }
    return [];
  }
  if (uiState.modal?.type === "checklist_delete") {
    const lowerName = name.toLowerCase();
    const lowerSequence = sequence.toLowerCase();
    if (lowerName === "y" || lowerSequence === "y") {
      return [{ scope: "domain", type: "MODAL_CONFIRM_CHECKLIST_DELETE" }];
    }
    if (lowerName === "n" || lowerSequence === "n") {
      return [{ scope: "ui", type: "UNWIND" }];
    }
    return [];
  }
  if (uiState.modal?.type === "checklist_input") {
    if (name === "return" || name === "enter") {
      return [{ scope: "domain", type: "MODAL_SUBMIT_CHECKLIST_INPUT" }];
    }
    return [];
  }
  if (uiState.modal?.type === "bulk_delete") {
    const lowerName = name.toLowerCase();
    const lowerSequence = sequence.toLowerCase();
    if (lowerName === "y" || lowerSequence === "y") {
      return [{ scope: "domain", type: "MODAL_CONFIRM_BULK_DELETE" }];
    }
    if (lowerName === "n" || lowerSequence === "n") {
      return [{ scope: "ui", type: "UNWIND" }];
    }
    return [];
  }
  if (uiState.modal?.type === "overdue") {
    const lowerName = name.toLowerCase();
    if (lowerName === "s" || sequence === "s" || sequence === "S") {
      return [{ scope: "domain", type: "MODAL_OVERDUE_SNOOZE" }];
    }
    if (lowerName === "d" || sequence === "d" || sequence === "D") {
      return [{ scope: "domain", type: "MODAL_OVERDUE_DONE" }];
    }
    if (lowerName === "g" || sequence === "g" || sequence === "G") {
      return [{ scope: "domain", type: "MODAL_OVERDUE_GO_TO_TASK" }];
    }
    return [];
  }
  if (uiState.modal?.type === "reminder") {
    const lowerName = name.toLowerCase();
    const lowerSequence = sequence.toLowerCase();
    if (name === "return" || name === "enter") {
      return [{ scope: "domain", type: "MODAL_REMINDER_DISMISS" }];
    }
    if (lowerName === "g" || lowerSequence === "g") {
      return [{ scope: "domain", type: "MODAL_REMINDER_GO_TO_TASK" }];
    }
    if (name === "1" || sequence === "1") {
      return [{ scope: "domain", type: "MODAL_REMINDER_SNOOZE", deltaMs: 10 * 60_000 }];
    }
    if (name === "2" || sequence === "2") {
      return [{ scope: "domain", type: "MODAL_REMINDER_SNOOZE", deltaMs: 60 * 60_000 }];
    }
    if (name === "3" || sequence === "3") {
      return [{ scope: "domain", type: "MODAL_REMINDER_SNOOZE", deltaMs: 24 * 60 * 60_000 }];
    }
    return [];
  }
  if (uiState.modal?.type === "task_link_delete") {
    const lowerName = name.toLowerCase();
    const lowerSequence = sequence.toLowerCase();
    if (lowerName === "y" || lowerSequence === "y") {
      return [{ scope: "domain", type: "MODAL_CONFIRM_TASK_LINK_DELETE" }];
    }
    if (lowerName === "n" || lowerSequence === "n") {
      return [{ scope: "ui", type: "UNWIND" }];
    }
    return [];
  }
  if (uiState.modal?.type === "task_link_open_external") {
    const lowerName = name.toLowerCase();
    const lowerSequence = sequence.toLowerCase();
    if (lowerName === "y" || lowerSequence === "y") {
      return [{ scope: "domain", type: "MODAL_CONFIRM_TASK_LINK_OPEN_EXTERNAL" }];
    }
    if (lowerName === "n" || lowerSequence === "n") {
      return [{ scope: "ui", type: "UNWIND" }];
    }
    return [];
  }
  if (uiState.modal?.type === "edit_switch_confirm") {
    const lowerName = name.toLowerCase();
    const lowerSequence = sequence.toLowerCase();
    if (lowerName === "s" || lowerSequence === "s") {
      return [{ scope: "domain", type: "MODAL_EDIT_SWITCH_SAVE" }];
    }
    if (lowerName === "d" || lowerSequence === "d") {
      return [{ scope: "domain", type: "MODAL_EDIT_SWITCH_DISCARD_SWITCH" }];
    }
    if (lowerName === "c" || lowerSequence === "c") {
      return [{ scope: "domain", type: "MODAL_EDIT_SWITCH_DISCARD_CLOSE" }];
    }
    return [];
  }
  if (uiState.modal?.type === "recurring_delete_future_checkpoint") {
    const lowerName = name.toLowerCase();
    const lowerSequence = sequence.toLowerCase();
    if (lowerName === "y" || lowerSequence === "y") {
      return [{ scope: "domain", type: "MODAL_CONFIRM_RECURRING_DELETE_FUTURE_CHECKPOINT" }];
    }
    if (lowerName === "n" || lowerSequence === "n") {
      return [{ scope: "ui", type: "MODAL_CANCEL_RECURRING_DELETE_FUTURE_CHECKPOINT" }];
    }
    return [];
  }
  if (uiState.modal?.type === "unsaved_changes") {
    const lowerName = name.toLowerCase();
    const lowerSequence = sequence.toLowerCase();
    if (lowerName === "s" || lowerSequence === "s") {
      return [{ scope: "domain", type: "MODAL_CONFIRM_UNSAVED_SAVE_CONTINUE" }];
    }
    if (lowerName === "d" || lowerSequence === "d") {
      return [{ scope: "domain", type: "MODAL_CONFIRM_UNSAVED_DISCARD_CONTINUE" }];
    }
    if (lowerName === "c" || lowerSequence === "c" || lowerName === "n" || lowerSequence === "n") {
      return [{ scope: "ui", type: "MODAL_CANCEL_UNSAVED_CONTINUE" }];
    }
    return [];
  }
  if (uiState.modal?.type === "backup_final_checkpoint") {
    const lowerName = name.toLowerCase();
    const lowerSequence = sequence.toLowerCase();
    if (lowerName === "y" || lowerSequence === "y") {
      return [{ scope: "domain", type: "MODAL_CONFIRM_BACKUP_FINAL_CHECKPOINT" }];
    }
    if (lowerName === "n" || lowerSequence === "n") {
      return [{ scope: "ui", type: "MODAL_CANCEL_BACKUP_FINAL_CHECKPOINT" }];
    }
    return [];
  }
  if (uiState.modal?.type === "task_link_form") {
    if (ctrl && name === "s") {
      return [{ scope: "domain", type: "MODAL_SUBMIT_TASK_LINK_FORM" }];
    }
    if (name === "tab") {
      return [
        {
          scope: "ui",
          type: "MODAL_MOVE_TASK_LINK_FORM_FOCUS",
          direction: shift ? -1 : 1
        }
      ];
    }
    if (name === "left" && uiState.modal.activeField === "type") {
      return [{ scope: "ui", type: "MODAL_CYCLE_TASK_LINK_FORM_TYPE", direction: -1 }];
    }
    if (name === "right" && uiState.modal.activeField === "type") {
      return [{ scope: "ui", type: "MODAL_CYCLE_TASK_LINK_FORM_TYPE", direction: 1 }];
    }
    if (name === "up") {
      return [{ scope: "ui", type: "MODAL_MOVE_TASK_LINK_FORM_FOCUS", direction: -1 }];
    }
    if (name === "down") {
      return [{ scope: "ui", type: "MODAL_MOVE_TASK_LINK_FORM_FOCUS", direction: 1 }];
    }
    if (name === "return" || name === "enter") {
      if (uiState.modal.activeField === "cancel") {
        return [{ scope: "ui", type: "UNWIND" }];
      }
      if (uiState.modal.activeField === "type") {
        return [{ scope: "ui", type: "MODAL_CYCLE_TASK_LINK_FORM_TYPE", direction: 1 }];
      }
      if (uiState.modal.activeField === "save") {
        return [{ scope: "domain", type: "MODAL_SUBMIT_TASK_LINK_FORM" }];
      }
    }
    return [];
  }
  return [];
}

function resolveDashboardToggleActions(
  key: KeyInput,
  context: KeyRouterContext
): KeyRouterAction[] | null {
  const { name, sequence, ctrl } = key;
  const { uiState, saveViewPromptOpen } = context;
  const { mode } = uiState;
  if (!isDashboardToggleKey(name, sequence, ctrl)) return null;

  const inTextEntryContext =
    mode === Mode.SEARCH ||
    mode === Mode.ADD ||
    mode === Mode.EDIT ||
    mode === Mode.NOTES_LIST ||
    mode === Mode.NOTES_VIEW ||
    mode === Mode.NOTES_SEARCH ||
    mode === Mode.NOTES_EDIT ||
    mode === Mode.NOTES_TAG_FILTER ||
    mode === Mode.HELP ||
    mode === Mode.BACKUP_CENTER ||
    saveViewPromptOpen;
  if (inTextEntryContext) return [];
  return [{ scope: "ui", type: "TOGGLE_DASHBOARD" }];
}

function resolveHelpModeActions(
  key: KeyInput,
  context: KeyRouterContext
): KeyRouterAction[] | null {
  const { name, sequence, ctrl } = key;
  const { uiState, helpPage } = context;
  if (uiState.mode !== Mode.HELP) return null;

  const activeHelpPage = helpPage ?? "help";
  if (activeHelpPage === "custom1Edit" || activeHelpPage === "textTuningEdit") {
    if (isHelpCloseKey(name, sequence)) {
      return [{ scope: "ui", type: "CLOSE_HELP" }];
    }
    return [];
  }

  const aliasedActions = resolveHelpAliasActions(key, context);
  if (aliasedActions !== null) return aliasedActions;

  if (activeHelpPage !== "help") {
    if (name === "up") {
      return [{ scope: "ui", type: "HELP_MOVE_SECTION_FOCUS", delta: -1 }];
    }
    if (name === "down") {
      return [{ scope: "ui", type: "HELP_MOVE_SECTION_FOCUS", delta: 1 }];
    }
    if (name === "left" || name === "backspace") {
      return [{ scope: "ui", type: "HELP_NAV_BACK" }];
    }
    if (name === "right" || name === "return" || name === "enter") {
      return [{ scope: "ui", type: "HELP_NAV_FORWARD" }];
    }
    if (isHelpCloseKey(name, sequence)) {
      return [{ scope: "ui", type: "CLOSE_HELP" }];
    }
    return [];
  }

  if (name === "up") {
    return [{ scope: "ui", type: "HELP_MOVE_SECTION_FOCUS", delta: -1 }];
  }
  if (name === "down") {
    return [{ scope: "ui", type: "HELP_MOVE_SECTION_FOCUS", delta: 1 }];
  }
  if (isPageUpKey(name, ctrl)) {
    return [{ scope: "ui", type: "HELP_SCROLL_PAGE", direction: -1 }];
  }
  if (isPageDownKey(name, ctrl)) {
    return [{ scope: "ui", type: "HELP_SCROLL_PAGE", direction: 1 }];
  }
  if (name === "left") {
    return [{ scope: "ui", type: "HELP_SET_FOCUSED_SECTION_EXPANDED", expanded: false }];
  }
  if (name === "right") {
    return [{ scope: "ui", type: "HELP_SET_FOCUSED_SECTION_EXPANDED", expanded: true }];
  }
  if (name === "space" || name === "return" || name === "enter") {
    return [{ scope: "ui", type: "HELP_TOGGLE_FOCUSED_SECTION" }];
  }
  if (sequence === "1" || name === "1") {
    return [{ scope: "ui", type: "OPEN_BACKUP_CENTER" }];
  }
  if (isHelpCloseKey(name, sequence)) {
    return [{ scope: "ui", type: "CLOSE_HELP" }];
  }
  return [];
}

function resolveBackupCenterModeActions(
  key: KeyInput,
  context: KeyRouterContext
): KeyRouterAction[] | null {
  const { name, sequence, ctrl } = key;
  const { uiState, backupScreen } = context;
  if (uiState.mode !== Mode.BACKUP_CENTER) return null;

  const aliasedActions = resolveBackupAliasActions(key, context);
  if (aliasedActions !== null) return aliasedActions;

  const maybeDigit = sequence.length === 1 && /\d/.test(sequence) ? Number(sequence) : NaN;

  if (backupScreen === "menu") {
    if (sequence === "1" || name === "1") {
      return [{ scope: "ui", type: "BACKUP_SELECT_MENU_OPTION", index: 0 }];
    }
    if (sequence === "2" || name === "2") {
      return [{ scope: "ui", type: "BACKUP_SELECT_MENU_OPTION", index: 1 }];
    }
    if (sequence === "3" || name === "3") {
      return [{ scope: "ui", type: "BACKUP_SELECT_MENU_OPTION", index: 2 }];
    }
    if (sequence === "4" || name === "4") {
      return [{ scope: "ui", type: "BACKUP_SELECT_MENU_OPTION", index: 3 }];
    }
    if (name === "j" || name === "down") {
      return [{ scope: "ui", type: "BACKUP_MOVE_MENU_SELECTION", delta: 1 }];
    }
    if (name === "k" || name === "up") {
      return [{ scope: "ui", type: "BACKUP_MOVE_MENU_SELECTION", delta: -1 }];
    }
  }

  if (backupScreen === "calendar_menu") {
    if (name === "j" || name === "down") {
      return [{ scope: "ui", type: "BACKUP_MOVE_MENU_SELECTION", delta: 1 }];
    }
    if (name === "k" || name === "up") {
      return [{ scope: "ui", type: "BACKUP_MOVE_MENU_SELECTION", delta: -1 }];
    }
  }

  if (backupScreen === "import_mode") {
    if (sequence === "1" || name === "1") {
      return [{ scope: "ui", type: "BACKUP_SET_IMPORT_MODE", mode: "merge" }];
    }
    if (sequence === "2" || name === "2") {
      return [{ scope: "ui", type: "BACKUP_SET_IMPORT_MODE", mode: "replace" }];
    }
  }

  if (backupScreen === "import_picker" || backupScreen === "github_restore_picker") {
    const lowerName = name.toLowerCase();
    const lowerSequence = sequence.toLowerCase();
    if (name === "up" || lowerName === "k" || lowerSequence === "k") {
      return [{ scope: "ui", type: "BACKUP_PICKER_MOVE_SELECTION", delta: -1 }];
    }
    if (name === "down" || lowerName === "j" || lowerSequence === "j") {
      return [{ scope: "ui", type: "BACKUP_PICKER_MOVE_SELECTION", delta: 1 }];
    }
    if (isPageUpKey(name, ctrl)) {
      return [{ scope: "ui", type: "BACKUP_PICKER_PAGE_SELECTION", delta: -1 }];
    }
    if (isPageDownKey(name, ctrl)) {
      return [{ scope: "ui", type: "BACKUP_PICKER_PAGE_SELECTION", delta: 1 }];
    }
    if (name === BACKUP_PICKER_JUMP_KEYS.start) {
      return [{ scope: "ui", type: "BACKUP_PICKER_JUMP_SELECTION", target: "start" }];
    }
    if (name === BACKUP_PICKER_JUMP_KEYS.end) {
      return [{ scope: "ui", type: "BACKUP_PICKER_JUMP_SELECTION", target: "end" }];
    }
    if (name === "return" || name === "enter") {
      return [{ scope: "ui", type: "BACKUP_PICKER_CONFIRM_SELECTION" }];
    }
    if (
      backupScreen === "import_picker" &&
      (lowerName === "m" || lowerSequence === "m")
    ) {
      return [{ scope: "ui", type: "BACKUP_PICKER_OPEN_MANUAL_PATH" }];
    }
    return [];
  }

  const supportsBodyScrollKeys = backupScreenSupportsBodyScrollKeys(backupScreen);
  if (supportsBodyScrollKeys) {
    const lowerName = name.toLowerCase();
    const lowerSequence = sequence.toLowerCase();
    if (name === "up" || lowerName === "k" || lowerSequence === "k") {
      return [{ scope: "ui", type: "BACKUP_SCROLL_BODY", delta: -1 }];
    }
    if (name === "down" || lowerName === "j" || lowerSequence === "j") {
      return [{ scope: "ui", type: "BACKUP_SCROLL_BODY", delta: 1 }];
    }
    if (isPageUpKey(name, ctrl)) {
      return [{ scope: "ui", type: "BACKUP_SCROLL_BODY", delta: -8 }];
    }
    if (isPageDownKey(name, ctrl)) {
      return [{ scope: "ui", type: "BACKUP_SCROLL_BODY", delta: 8 }];
    }
  }

  if (
    (name === "return" || name === "enter") &&
    backupScreen &&
    BACKUP_INPUT_SUBMIT_SCREENS.has(backupScreen)
  ) {
    // Input screens handle Enter via onSubmit to avoid stale-state races.
    return [];
  }

  if (Number.isFinite(maybeDigit)) {
    return [{ scope: "ui", type: "BACKUP_SELECT_DIGIT", digit: maybeDigit }];
  }
  if (name === "return" || name === "enter") {
    return [{ scope: "ui", type: "BACKUP_PRIMARY" }];
  }
  return [];
}

function resolveDashboardModeActions(
  key: KeyInput,
  context: KeyRouterContext
): KeyRouterAction[] | null {
  const { name, sequence, ctrl, shift } = key;
  const { uiState } = context;
  if (uiState.mode !== Mode.DASHBOARD) return null;

  const aliasedActions = resolveDashboardAliasActions(key, context);
  if (aliasedActions !== null) return aliasedActions;

  if (sequence === "?") return [{ scope: "ui", type: "OPEN_HELP" }];
  if (name === "q") return [{ scope: "domain", type: "EXIT_APP" }];
  if (name === "f") return [{ scope: "domain", type: "CYCLE_STATUS" }];
  if (!ctrl && name === "g") return [{ scope: "domain", type: "CYCLE_DUE" }];
  if (!ctrl && !shift && (name === "w" || sequence === "w")) {
    return [{ scope: "domain", type: "CYCLE_ANALYTICS_WINDOW" }];
  }
  if (!ctrl && name === "r") return [{ scope: "domain", type: "CYCLE_PRIORITY" }];
  if (!ctrl && !shift && (name === "u" || sequence === "u")) {
    return [{ scope: "ui", type: "OPEN_BACKUP_CENTER" }];
  }
  if (isNotesOpenKey(name, sequence, ctrl, shift)) {
    return [{ scope: "ui", type: "OPEN_NOTES" }];
  }
  if (isTagPanelOpenKey(name, sequence, ctrl, shift)) {
    return [{ scope: "ui", type: "OPEN_TAG_FILTER_PANEL" }];
  }
  if (name === "t") return [{ scope: "domain", type: "TOGGLE_TAG_FILTER" }];
  if (name === "tab" && !shift) {
    return [{ scope: "ui", type: "DASHBOARD_NEXT_FOCUS_GROUP" }];
  }
  if (name === "tab" && shift) {
    return [{ scope: "ui", type: "DASHBOARD_PREV_FOCUS_GROUP" }];
  }
  if (name === "down") {
    return [{ scope: "ui", type: "DASHBOARD_MOVE_ACTIVE_SELECTION", delta: 1 }];
  }
  if (name === "up") {
    return [{ scope: "ui", type: "DASHBOARD_MOVE_ACTIVE_SELECTION", delta: -1 }];
  }
  if (name === "return" || name === "enter") {
    return [{ scope: "domain", type: "APPLY_DASHBOARD_ACTIVE_SELECTION" }];
  }
  return [];
}

function resolveNotesModeActions(
  key: KeyInput,
  context: KeyRouterContext
): KeyRouterAction[] | null {
  const { name, sequence, ctrl, shift } = key;
  const {
    uiState,
    notesRootSettingsOpen = false,
    notesCreatePromptOpen = false,
    notesRenamePromptOpen = false,
    notesDeletePromptOpen = false
  } = context;

  if (
    uiState.mode !== Mode.NOTES_LIST &&
    uiState.mode !== Mode.NOTES_VIEW &&
    uiState.mode !== Mode.NOTES_EDIT &&
    uiState.mode !== Mode.NOTES_SEARCH &&
    uiState.mode !== Mode.NOTES_TAG_FILTER
  ) {
    return null;
  }

  if (notesRootSettingsOpen) {
    if (name === "escape") {
      return [{ scope: "ui", type: "NOTES_CLOSE_ROOT_SETTINGS" }];
    }
    if (name === "return" || name === "enter") {
      return [{ scope: "ui", type: "NOTES_CONFIRM_ROOT_SETTINGS" }];
    }
    return [];
  }

  if (notesCreatePromptOpen) {
    if (name === "escape") {
      return [{ scope: "ui", type: "NOTES_CLOSE_CREATE" }];
    }
    if (name === "return" || name === "enter") {
      return [{ scope: "ui", type: "NOTES_CONFIRM_CREATE" }];
    }
    return [];
  }

  if (notesRenamePromptOpen) {
    if (name === "escape") {
      return [{ scope: "ui", type: "NOTES_CLOSE_RENAME" }];
    }
    if (name === "return" || name === "enter") {
      return [{ scope: "ui", type: "NOTES_CONFIRM_RENAME" }];
    }
    return [];
  }

  if (notesDeletePromptOpen) {
    if (name === "escape") {
      return [{ scope: "ui", type: "NOTES_CLOSE_DELETE" }];
    }
    if (name === "return" || name === "enter") {
      return [{ scope: "ui", type: "NOTES_CONFIRM_DELETE" }];
    }
    return [];
  }

  if (uiState.mode === Mode.NOTES_SEARCH) {
    if (name === "escape" || name === "return" || name === "enter") {
      return [{ scope: "ui", type: "CLOSE_NOTES_SEARCH" }];
    }
    return [];
  }

  if (uiState.mode === Mode.NOTES_TAG_FILTER) {
    if (name === "escape" || name === "return" || name === "enter") {
      return [{ scope: "ui", type: "CLOSE_NOTES_TAG_FILTER" }];
    }
    return [];
  }

  if (uiState.mode === Mode.NOTES_VIEW) {
    if (name === "j" || name === "down") {
      return [{ scope: "ui", type: "NOTES_VIEW_MOVE_LINK_SELECTION", delta: 1 }];
    }
    if (name === "k" || name === "up") {
      return [{ scope: "ui", type: "NOTES_VIEW_MOVE_LINK_SELECTION", delta: -1 }];
    }
    if (name === "return" || name === "enter") {
      return [{ scope: "ui", type: "NOTES_FOLLOW_LINK" }];
    }
    if (!ctrl && !shift && (name === "e" || sequence === "e")) {
      return [{ scope: "ui", type: "NOTES_EDIT_SELECTED" }];
    }
    if (!ctrl && !shift && (name === "d" || sequence === "d")) {
      return [{ scope: "ui", type: "NOTES_OPEN_DELETE" }];
    }
    if (
      !ctrl &&
      (name === "i" || name === "I" || sequence === "i" || sequence === "I")
    ) {
      return [{ scope: "ui", type: "NOTES_REINDEX" }];
    }
    if (name === "tab") {
      return [];
    }
    return [];
  }

  if (uiState.mode === Mode.NOTES_EDIT) {
    if (ctrl && name === "s") {
      return [{ scope: "ui", type: "NOTES_SAVE_EDIT" }];
    }
    if (name === "escape") {
      return [{ scope: "ui", type: "NOTES_CANCEL_EDIT" }];
    }
    return [];
  }

  if (uiState.mode === Mode.NOTES_LIST) {
    if (name === "j" || name === "down") {
      return [{ scope: "ui", type: "NOTES_MOVE_SELECTION", delta: 1 }];
    }
    if (name === "k" || name === "up") {
      return [{ scope: "ui", type: "NOTES_MOVE_SELECTION", delta: -1 }];
    }
    if (name === "return" || name === "enter") {
      return [{ scope: "ui", type: "NOTES_OPEN_SELECTED" }];
    }
    if (!ctrl && !shift && (name === "a" || sequence === "a")) {
      return [{ scope: "ui", type: "NOTES_OPEN_CREATE" }];
    }
    if (!ctrl && !shift && (name === "d" || sequence === "d")) {
      return [{ scope: "ui", type: "NOTES_OPEN_DELETE" }];
    }
    if (!ctrl && !shift && (name === "e" || sequence === "e")) {
      return [{ scope: "ui", type: "NOTES_EDIT_SELECTED" }];
    }
    if (
      !ctrl &&
      (name === "r" || name === "R" || sequence === "r" || sequence === "R")
    ) {
      return [{ scope: "ui", type: "NOTES_OPEN_RENAME" }];
    }
    if (!ctrl && !shift && (name === "/" || sequence === "/")) {
      return [{ scope: "ui", type: "OPEN_NOTES_SEARCH" }];
    }
    if (!ctrl && !shift && (name === "p" || sequence === "p")) {
      return [{ scope: "ui", type: "OPEN_NOTES_TAG_FILTER" }];
    }
    if (
      !ctrl &&
      (name === "i" || name === "I" || sequence === "i" || sequence === "I")
    ) {
      return [{ scope: "ui", type: "NOTES_REINDEX" }];
    }
    if (!ctrl && !shift && (name === "o" || sequence === "o")) {
      return [{ scope: "ui", type: "NOTES_OPEN_ROOT_SETTINGS" }];
    }
    return [];
  }

  return [];
}

function resolveSearchModeActions(
  key: KeyInput,
  context: KeyRouterContext
): KeyRouterAction[] | null {
  const { name } = key;
  const { uiState } = context;
  if (uiState.mode !== Mode.SEARCH) return null;

  if (isSearchCloseKey(name)) {
    return [{ scope: "ui", type: "CLOSE_SEARCH" }];
  }
  // Text input owns printable characters in SEARCH mode.
  return [];
}

function resolveEditorModeActions(
  key: KeyInput,
  context: KeyRouterContext
): KeyRouterAction[] | null {
  const { name, sequence, ctrl, shift } = key;
  const {
    uiState,
    hasTitleInlineSuggestion = false,
    hasTagInlineSuggestion,
    hasDueSuggestion,
    timeAutocompleteStep
  } = context;
  const { mode, focus } = uiState;
  if (mode !== Mode.ADD && mode !== Mode.EDIT) return null;

  if (ctrl && name === "s") {
    return [{ scope: "domain", type: "SAVE_EDITOR" }];
  }
  if (mode === Mode.ADD && ctrl && name === "l") {
    return [{ scope: "domain", type: "OPEN_ADD_TASK_LINK_MODAL" }];
  }

  if (isPageUpKey(name, ctrl)) {
    return [{ scope: "ui", type: "SCROLL_EDITOR_PAGE", direction: -1 }];
  }
  if (isPageDownKey(name, ctrl)) {
    return [{ scope: "ui", type: "SCROLL_EDITOR_PAGE", direction: 1 }];
  }
  if (name === "tab") {
    const actions: KeyRouterAction[] = [];
    if (focus === FocusTarget.EDITOR_TITLE && hasTitleInlineSuggestion) {
      actions.push({ scope: "domain", type: "ACCEPT_TITLE_INLINE" });
    }
    if (focus === FocusTarget.EDITOR_TAGS && hasTagInlineSuggestion) {
      actions.push({ scope: "domain", type: "ACCEPT_TAG_INLINE" });
    }
    actions.push({
      scope: "ui",
      type: "MOVE_EDITOR_FOCUS",
      direction: shift ? -1 : 1
    });
    return actions;
  }
  if (focus === FocusTarget.EDITOR_CHECKLIST) {
    const lowerName = name.toLowerCase();
    const lowerSequence = sequence.toLowerCase();
    if (lowerName === "j" || name === "down") {
      return [{ scope: "domain", type: "MOVE_CHECKLIST_SELECTION", delta: 1 }];
    }
    if (lowerName === "k" || name === "up") {
      return [{ scope: "domain", type: "MOVE_CHECKLIST_SELECTION", delta: -1 }];
    }
    if (name === "space") {
      return [{ scope: "domain", type: "TOGGLE_SELECTED_CHECKLIST_ITEM" }];
    }
    if (lowerName === "a" || lowerSequence === "a") {
      return [{ scope: "domain", type: "OPEN_ADD_CHECKLIST_ITEM_MODAL" }];
    }
    if (lowerName === "e" || lowerSequence === "e") {
      return [{ scope: "domain", type: "OPEN_EDIT_CHECKLIST_ITEM_MODAL" }];
    }
    if (lowerName === "d" || lowerSequence === "d" || name === "backspace") {
      return [{ scope: "domain", type: "OPEN_DELETE_CHECKLIST_ITEM_MODAL" }];
    }
    if (name === "return" || name === "enter") {
      return [];
    }
    if (!ctrl && !shift && name === "left") {
      return [{ scope: "domain", type: "SAVE_EDITOR" }];
    }
    return [];
  }
  if (name === "right") {
    if (focus === FocusTarget.EDITOR_TITLE && hasTitleInlineSuggestion) {
      return [{ scope: "domain", type: "ACCEPT_TITLE_INLINE" }];
    }
    if (
      focus === FocusTarget.EDITOR_DUE_TIME &&
      (timeAutocompleteStep === "hour" || timeAutocompleteStep === "minute")
    ) {
      return [{ scope: "domain", type: "APPLY_TIME_AUTOCOMPLETE" }];
    }
    if (focus === FocusTarget.EDITOR_DUE_DATE && hasDueSuggestion) {
      return [{ scope: "domain", type: "ACCEPT_DUE_SUGGESTION" }];
    }
    if (focus === FocusTarget.EDITOR_TAGS && hasTagInlineSuggestion) {
      return [{ scope: "domain", type: "ACCEPT_TAG_INLINE" }];
    }
    return [];
  }
  if (
    (name === "return" || name === "enter") &&
    focus === FocusTarget.EDITOR_TAGS &&
    hasTagInlineSuggestion
  ) {
    return [{ scope: "domain", type: "ACCEPT_TAG_INLINE" }];
  }
  if ((name === "return" || name === "enter") && focus === FocusTarget.EDITOR_SAVE) {
    return [{ scope: "domain", type: "SAVE_EDITOR" }];
  }
  if ((name === "return" || name === "enter") && focus === FocusTarget.EDITOR_CANCEL) {
    return [{ scope: "ui", type: "UNWIND" }];
  }

  // Text input owns printable characters in editor modes.
  return [];
}

function resolveListModeActions(
  key: KeyInput,
  context: KeyRouterContext
): KeyRouterAction[] | null {
  const { name, sequence, ctrl, shift } = key;
  const { uiState, hasPendingGPrefix, viewsOverlayOpen, saveViewPromptOpen } = context;
  const { mode, focus } = uiState;

  if (mode === Mode.TAG_FILTER) return [];
  if (mode !== Mode.LIST) return null;

  if (saveViewPromptOpen) {
    if (name === "escape") return [{ scope: "ui", type: "CANCEL_SAVE_VIEW_PROMPT" }];
    if (name === "return" || name === "enter") {
      return [{ scope: "ui", type: "CONFIRM_SAVE_VIEW_PROMPT" }];
    }
    return [];
  }

  if (viewsOverlayOpen) {
    if (name === "escape" || name === "v") {
      return [{ scope: "ui", type: "CLOSE_VIEWS_OVERLAY" }];
    }
    if (name === "j" || name === "down") {
      return [{ scope: "ui", type: "MOVE_VIEW_SELECTION", delta: 1 }];
    }
    if (name === "k" || name === "up") {
      return [{ scope: "ui", type: "MOVE_VIEW_SELECTION", delta: -1 }];
    }
    if (name === "d") return [{ scope: "domain", type: "DELETE_SELECTED_VIEW" }];
    if (name === "return" || name === "enter") {
      return [{ scope: "domain", type: "APPLY_SELECTED_VIEW" }];
    }
    if (/^[1-9]$/.test(sequence)) {
      return [{ scope: "domain", type: "APPLY_VIEW_SLOT", slot: Number(sequence) - 1 }];
    }
    if (ctrl && name === "s") return [{ scope: "ui", type: "OPEN_SAVE_VIEW_PROMPT" }];
    return [];
  }

  if (name === "tab") {
    return [
      {
        scope: "ui",
        type: "SET_LIST_FOCUS",
        focus:
          focus === FocusTarget.TASK_LIST
            ? FocusTarget.DETAILS_LINKS
            : FocusTarget.TASK_LIST
      }
    ];
  }

  if (
    focus === FocusTarget.DETAILS_LINKS ||
    focus === FocusTarget.DETAILS_CHECKLIST
  ) {
    if (name === "left") {
      return [
        {
          scope: "ui",
          type: "SET_LIST_FOCUS",
          focus: FocusTarget.DETAILS_LINKS
        }
      ];
    }
    if (name === "right") {
      return [
        {
          scope: "ui",
          type: "SET_LIST_FOCUS",
          focus: FocusTarget.DETAILS_CHECKLIST
        }
      ];
    }
  }

  if (focus === FocusTarget.DETAILS_LINKS) {
    if (name === "j" || name === "down") {
      return [{ scope: "domain", type: "MOVE_LINK_SELECTION", delta: 1 }];
    }
    if (name === "k" || name === "up") {
      return [{ scope: "domain", type: "MOVE_LINK_SELECTION", delta: -1 }];
    }
    if (
      name === "return" ||
      name === "enter" ||
      name === "o" ||
      name === "O" ||
      sequence === "o" ||
      sequence === "O"
    ) {
      return [{ scope: "domain", type: "OPEN_SELECTED_LINK" }];
    }
    if (name === "c" || name === "C" || sequence === "c" || sequence === "C") {
      return [{ scope: "domain", type: "COPY_SELECTED_LINK" }];
    }
    if (name === "l" || name === "L" || sequence === "l" || sequence === "L") {
      return [{ scope: "domain", type: "OPEN_ADD_TASK_LINK_MODAL" }];
    }
    if (name === "e" || name === "E" || sequence === "e" || sequence === "E") {
      return [{ scope: "domain", type: "OPEN_EDIT_TASK_LINK_MODAL" }];
    }
    if (
      name === "d" ||
      name === "D" ||
      sequence === "d" ||
      sequence === "D" ||
      name === "backspace"
    ) {
      return [{ scope: "domain", type: "OPEN_DELETE_TASK_LINK_MODAL" }];
    }
    return [];
  }

  if (focus === FocusTarget.DETAILS_CHECKLIST) {
    if (name === "j" || name === "down") {
      return [{ scope: "domain", type: "MOVE_CHECKLIST_SELECTION", delta: 1 }];
    }
    if (name === "k" || name === "up") {
      return [{ scope: "domain", type: "MOVE_CHECKLIST_SELECTION", delta: -1 }];
    }
    if (name === "space") {
      return [{ scope: "domain", type: "TOGGLE_SELECTED_CHECKLIST_ITEM" }];
    }
    if (name === "a" || name === "A" || sequence === "a" || sequence === "A") {
      return [{ scope: "domain", type: "OPEN_ADD_CHECKLIST_ITEM_MODAL" }];
    }
    if (name === "e" || name === "E" || sequence === "e" || sequence === "E") {
      return [{ scope: "domain", type: "OPEN_EDIT_CHECKLIST_ITEM_MODAL" }];
    }
    if (
      name === "d" ||
      name === "D" ||
      sequence === "d" ||
      sequence === "D" ||
      name === "backspace"
    ) {
      return [{ scope: "domain", type: "OPEN_DELETE_CHECKLIST_ITEM_MODAL" }];
    }
    if (name === "return" || name === "enter") {
      return [];
    }
    return [];
  }

  if (focus !== FocusTarget.TASK_LIST) return [];

  if (hasPendingGPrefix) {
    if (isLowerG(name, sequence, ctrl, shift)) {
      return [
        { scope: "ui", type: "SET_G_PREFIX", active: false },
        { scope: "domain", type: "JUMP_TOP" }
      ];
    }
    if (isUpperG(name, sequence, ctrl)) {
      return [
        { scope: "ui", type: "SET_G_PREFIX", active: false },
        { scope: "domain", type: "JUMP_BOTTOM" }
      ];
    }
    return [
      { scope: "ui", type: "SET_G_PREFIX", active: false },
      ...listModeActions(key, context)
    ];
  }

  if (ctrl && !shift && (name === "g" || sequence === "g")) {
    return [{ scope: "ui", type: "SET_G_PREFIX", active: true }];
  }

  if (ctrl && !shift && (name === "p" || sequence === "p")) {
    return [{ scope: "ui", type: "SET_G_PREFIX", active: true }];
  }

  if (ctrl && !shift && (name === "y" || sequence === "y")) {
    return [{ scope: "ui", type: "SET_G_PREFIX", active: true }];
  }

  return listModeActions(key, context);
}
