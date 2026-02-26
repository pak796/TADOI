import { FocusTarget, Mode } from "../domain/models";
import { UIState, type EmptyNuxStep } from "../ui/state";
import type { BackupCenterScreen } from "../state/backupCenterFlow";
import type { ImportMode } from "../state/portability";

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
  viewsOverlayOpen: boolean;
  saveViewPromptOpen: boolean;
  allowEmptyNuxRecoveryImport: boolean;
  backupScreen: BackupCenterScreen | null;
  helpPage?:
    | "help"
    | "settings"
    | "theme"
    | "custom1"
    | "custom1Edit"
    | "textTuning"
    | "textTuningTheme"
    | "textTuningEdit";
};

export type KeyRouterAction =
  | { scope: "ui"; type: "UNWIND" }
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
      focus: typeof FocusTarget.TASK_LIST | typeof FocusTarget.DETAILS_LINKS;
    }
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
  | { scope: "domain"; type: "OPEN_EDIT_SERIES" }
  | { scope: "domain"; type: "OPEN_DUPLICATE" }
  | { scope: "domain"; type: "SKIP_SELECTED_OCCURRENCE" }
  | { scope: "domain"; type: "SNOOZE_SELECTED_OCCURRENCE" }
  | { scope: "domain"; type: "MOVE_LINK_SELECTION"; delta: 1 | -1 }
  | { scope: "domain"; type: "OPEN_SELECTED_LINK" }
  | { scope: "domain"; type: "COPY_SELECTED_LINK" }
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

function listModeActions(key: KeyInput): KeyRouterAction[] {
  const { name, sequence, ctrl, shift } = key;
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
  if (name === "space") return [{ scope: "domain", type: "TOGGLE_SELECTED" }];
  if (name === "v") return [{ scope: "ui", type: "TOGGLE_VIEWS_OVERLAY" }];
  if (ctrl && name === "s") return [{ scope: "ui", type: "OPEN_SAVE_VIEW_PROMPT" }];
  if (/^[1-9]$/.test(sequence)) {
    return [{ scope: "domain", type: "APPLY_VIEW_SLOT", slot: Number(sequence) - 1 }];
  }
  if (name === "a") return [{ scope: "domain", type: "OPEN_ADD" }];
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
    saveViewPromptOpen,
    viewsOverlayOpen,
    helpPage
  } = context;
  const { mode, focus } = uiState;

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
  if (mode === Mode.BACKUP_CENTER) {
    return [{ scope: "ui", type: "BACKUP_BACK" }];
  }
  if (mode === Mode.LIST && saveViewPromptOpen) {
    return [{ scope: "ui", type: "CANCEL_SAVE_VIEW_PROMPT" }];
  }
  if (mode === Mode.LIST && viewsOverlayOpen) {
    return [{ scope: "ui", type: "CLOSE_VIEWS_OVERLAY" }];
  }
  if (mode === Mode.LIST && focus === FocusTarget.DETAILS_LINKS) {
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

  if (backupScreen === "import_picker") {
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
    if (name === "home") {
      return [{ scope: "ui", type: "BACKUP_PICKER_JUMP_SELECTION", target: "start" }];
    }
    if (name === "end") {
      return [{ scope: "ui", type: "BACKUP_PICKER_JUMP_SELECTION", target: "end" }];
    }
    if (name === "return" || name === "enter") {
      return [{ scope: "ui", type: "BACKUP_PICKER_CONFIRM_SELECTION" }];
    }
    if (lowerName === "m" || lowerSequence === "m") {
      return [{ scope: "ui", type: "BACKUP_PICKER_OPEN_MANUAL_PATH" }];
    }
    return [];
  }

  const inputSubmitScreens = new Set([
    "import_path",
    "import_confirm",
    "calendar_export_path",
    "calendar_import_path",
    "calendar_import_horizon",
    "calendar_import_tag",
    "calendar_import_confirm"
  ]);

  const supportsBodyScrollKeys =
    backupScreen !== null &&
    backupScreen !== "menu" &&
    backupScreen !== "calendar_menu" &&
    backupScreen !== "import_mode" &&
    backupScreen !== "import_picker" &&
    !inputSubmitScreens.has(backupScreen);
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
    inputSubmitScreens.has(backupScreen)
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
  const { name, ctrl, shift } = key;
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
      { scope: "domain", type: "CYCLE_DUE" },
      ...listModeActions(key)
    ];
  }

  if (isLowerG(name, sequence, ctrl, shift)) {
    return [{ scope: "ui", type: "SET_G_PREFIX", active: true }];
  }

  return listModeActions(key);
}
