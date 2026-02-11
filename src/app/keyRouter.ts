import { FocusTarget, Mode } from "../domain/models";
import { UIState } from "../ui/state";
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
  hasTagInlineSuggestion: boolean;
  hasDueSuggestion: boolean;
  timeAutocompleteStep: "hour" | "minute" | "none" | "invalid";
  hasPendingGPrefix: boolean;
  viewsOverlayOpen: boolean;
  saveViewPromptOpen: boolean;
  backupScreen: BackupCenterScreen | null;
};

export type KeyRouterAction =
  | { scope: "ui"; type: "UNWIND" }
  | { scope: "ui"; type: "DISMISS_EMPTY_NUX" }
  | { scope: "ui"; type: "TOGGLE_DASHBOARD" }
  | { scope: "ui"; type: "OPEN_HELP" }
  | { scope: "ui"; type: "OPEN_BACKUP_CENTER" }
  | { scope: "ui"; type: "OPEN_TAG_FILTER_PANEL" }
  | { scope: "ui"; type: "CLOSE_HELP" }
  | { scope: "ui"; type: "OPEN_SEARCH" }
  | { scope: "ui"; type: "CLOSE_SEARCH" }
  | { scope: "ui"; type: "BACKUP_PRIMARY" }
  | { scope: "ui"; type: "BACKUP_BACK" }
  | { scope: "ui"; type: "BACKUP_MOVE_MENU_SELECTION"; delta: 1 | -1 }
  | { scope: "ui"; type: "BACKUP_SELECT_MENU_OPTION"; index: 0 | 1 | 2 }
  | { scope: "ui"; type: "BACKUP_SET_IMPORT_MODE"; mode: ImportMode }
  | { scope: "ui"; type: "MOVE_EDITOR_FOCUS"; direction: 1 | -1 }
  | { scope: "ui"; type: "SET_G_PREFIX"; active: boolean }
  | { scope: "ui"; type: "TOGGLE_VIEWS_OVERLAY" }
  | { scope: "ui"; type: "CLOSE_VIEWS_OVERLAY" }
  | { scope: "ui"; type: "MOVE_VIEW_SELECTION"; delta: 1 | -1 }
  | { scope: "ui"; type: "OPEN_SAVE_VIEW_PROMPT" }
  | { scope: "ui"; type: "CONFIRM_SAVE_VIEW_PROMPT" }
  | { scope: "ui"; type: "CANCEL_SAVE_VIEW_PROMPT" }
  | { scope: "ui"; type: "MOVE_DASHBOARD_TAG_SELECTION"; delta: 1 | -1 }
  | { scope: "ui"; type: "SCROLL_EDITOR_PAGE"; direction: 1 | -1 }
  | { scope: "ui"; type: "HELP_MOVE_SECTION_FOCUS"; delta: 1 | -1 }
  | { scope: "ui"; type: "HELP_TOGGLE_FOCUSED_SECTION" }
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
  | { scope: "domain"; type: "OPEN_DELETE_CONFIRM" }
  | { scope: "domain"; type: "MODAL_CONFIRM_DELETE" }
  | { scope: "domain"; type: "MODAL_OVERDUE_SNOOZE" }
  | { scope: "domain"; type: "MODAL_OVERDUE_DONE" }
  | { scope: "domain"; type: "MODAL_OVERDUE_GO_TO_TASK" }
  | { scope: "domain"; type: "CYCLE_STATUS" }
  | { scope: "domain"; type: "CYCLE_SORT" }
  | { scope: "domain"; type: "CYCLE_DUE" }
  | { scope: "domain"; type: "TOGGLE_TAG_FILTER" }
  | { scope: "domain"; type: "APPLY_DASHBOARD_SELECTED_TAG" }
  | { scope: "domain"; type: "SAVE_EDITOR" }
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
  if (!ctrl && shift && (name === "T" || sequence === "T")) {
    return [{ scope: "ui", type: "OPEN_TAG_FILTER_PANEL" }];
  }
  if (name === "t") return [{ scope: "domain", type: "TOGGLE_TAG_FILTER" }];
  return [];
}

function isThemeCycleKey(name: string, sequence: string): boolean {
  return name.toLowerCase() === "h" || sequence === "h" || sequence === "H";
}

function isFlashModeToggleKey(name: string, sequence: string): boolean {
  return name.toLowerCase() === "m" || sequence === "m" || sequence === "M";
}

function isNotificationMasterToggleKey(name: string, sequence: string): boolean {
  return name.toLowerCase() === "n" || sequence === "n" || sequence === "N";
}

function isInAppOverdueBannerToggleKey(name: string, sequence: string): boolean {
  return name.toLowerCase() === "o" || sequence === "o" || sequence === "O";
}

function isTerminalBellToggleKey(name: string, sequence: string): boolean {
  return name.toLowerCase() === "l" || sequence === "l" || sequence === "L";
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
  const { name, sequence, ctrl, shift } = key;
  const {
    uiState,
    hasTagInlineSuggestion,
    hasDueSuggestion,
    timeAutocompleteStep,
    hasPendingGPrefix,
    viewsOverlayOpen,
    saveViewPromptOpen,
    backupScreen
  } = context;
  const { mode, focus } = uiState;

  if (name === "escape") {
    if (hasPendingGPrefix) {
      return [{ scope: "ui", type: "SET_G_PREFIX", active: false }];
    }
    if (mode === Mode.MODAL_CONFIRM && uiState.modal?.type === "emptyNux") {
      return [{ scope: "ui", type: "DISMISS_EMPTY_NUX" }];
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
    return [{ scope: "ui", type: "UNWIND" }];
  }

  if (mode === Mode.MODAL_CONFIRM) {
    if (uiState.modal?.type === "emptyNux") {
      if (
        name === "a" ||
        name === "A" ||
        sequence === "a" ||
        sequence === "A"
      ) {
        return [
          { scope: "ui", type: "DISMISS_EMPTY_NUX" },
          { scope: "domain", type: "OPEN_ADD" }
        ];
      }
      return [];
    }
    if (uiState.modal?.type === "delete") {
      if (name === "y" || sequence === "y") {
        return [{ scope: "domain", type: "MODAL_CONFIRM_DELETE" }];
      }
      if (name === "n" || sequence === "n") {
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
    return [];
  }

  if (isDashboardToggleKey(name, sequence, ctrl)) {
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

  if (mode === Mode.HELP) {
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
      return [
        { scope: "ui", type: "HELP_SET_FOCUSED_SECTION_EXPANDED", expanded: false }
      ];
    }
    if (name === "right") {
      return [
        { scope: "ui", type: "HELP_SET_FOCUSED_SECTION_EXPANDED", expanded: true }
      ];
    }
    if (name === "space" || name === "return" || name === "enter") {
      return [{ scope: "ui", type: "HELP_TOGGLE_FOCUSED_SECTION" }];
    }
    if (sequence === "1" || name === "1") {
      return [{ scope: "ui", type: "OPEN_BACKUP_CENTER" }];
    }
    if (isThemeCycleKey(name, sequence)) {
      return [{ scope: "ui", type: "CYCLE_THEME" }];
    }
    if (isFlashModeToggleKey(name, sequence)) {
      return [{ scope: "ui", type: "TOGGLE_FLASH_MODE" }];
    }
    if (isNotificationMasterToggleKey(name, sequence)) {
      return [{ scope: "ui", type: "TOGGLE_NOTIFICATIONS_ENABLED" }];
    }
    if (isInAppOverdueBannerToggleKey(name, sequence)) {
      return [{ scope: "ui", type: "TOGGLE_INAPP_OVERDUE_BANNER" }];
    }
    if (isTerminalBellToggleKey(name, sequence)) {
      return [{ scope: "ui", type: "TOGGLE_TERMINAL_BELL_ON_OVERDUE" }];
    }
    if (isHelpCloseKey(name, sequence)) {
      return [{ scope: "ui", type: "CLOSE_HELP" }];
    }
    return [];
  }

  if (mode === Mode.BACKUP_CENTER) {
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

    if (name === "return" || name === "enter") {
      return [{ scope: "ui", type: "BACKUP_PRIMARY" }];
    }

    return [];
  }

  if (mode === Mode.DASHBOARD) {
    if (sequence === "?") return [{ scope: "ui", type: "OPEN_HELP" }];
    if (name === "q") return [{ scope: "domain", type: "EXIT_APP" }];
    if (name === "f") return [{ scope: "domain", type: "CYCLE_STATUS" }];
    if (!ctrl && name === "g") return [{ scope: "domain", type: "CYCLE_DUE" }];
    if (!ctrl && shift && (name === "T" || sequence === "T")) {
      return [{ scope: "ui", type: "OPEN_TAG_FILTER_PANEL" }];
    }
    if (name === "t") return [{ scope: "domain", type: "TOGGLE_TAG_FILTER" }];
    if (name === "down") {
      return [{ scope: "ui", type: "MOVE_DASHBOARD_TAG_SELECTION", delta: 1 }];
    }
    if (name === "up") {
      return [{ scope: "ui", type: "MOVE_DASHBOARD_TAG_SELECTION", delta: -1 }];
    }
    if (name === "return" || name === "enter") {
      return [{ scope: "domain", type: "APPLY_DASHBOARD_SELECTED_TAG" }];
    }
    return [];
  }

  if (mode === Mode.TAG_FILTER) {
    return [];
  }

  if (mode === Mode.SEARCH) {
    if (isSearchCloseKey(name)) {
      return [{ scope: "ui", type: "CLOSE_SEARCH" }];
    }
    // Text input owns printable characters in SEARCH mode.
    return [];
  }

  if (mode === Mode.ADD || mode === Mode.EDIT) {
    if (ctrl && name === "s") {
      return [{ scope: "domain", type: "SAVE_EDITOR" }];
    }

    if (isPageUpKey(name, ctrl)) {
      return [{ scope: "ui", type: "SCROLL_EDITOR_PAGE", direction: -1 }];
    }

    if (isPageDownKey(name, ctrl)) {
      return [{ scope: "ui", type: "SCROLL_EDITOR_PAGE", direction: 1 }];
    }

    if (name === "tab") {
      const actions: KeyRouterAction[] = [];
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
      if (
        mode === Mode.ADD &&
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

    if (
      (name === "return" || name === "enter") &&
      focus === FocusTarget.EDITOR_SAVE
    ) {
      return [{ scope: "domain", type: "SAVE_EDITOR" }];
    }

    if (
      (name === "return" || name === "enter") &&
      focus === FocusTarget.EDITOR_CANCEL
    ) {
      return [{ scope: "ui", type: "UNWIND" }];
    }

    // Text input owns printable characters in editor modes.
    return [];
  }

  if (mode !== Mode.LIST || focus !== FocusTarget.TASK_LIST) {
    return [];
  }

  if (saveViewPromptOpen) {
    if (name === "escape") return [{ scope: "ui", type: "CANCEL_SAVE_VIEW_PROMPT" }];
    if (name === "return" || name === "enter") {
      return [{ scope: "ui", type: "CONFIRM_SAVE_VIEW_PROMPT" }];
    }
    return [];
  }

  if (viewsOverlayOpen) {
    if (name === "escape" || name === "v") return [{ scope: "ui", type: "CLOSE_VIEWS_OVERLAY" }];
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
