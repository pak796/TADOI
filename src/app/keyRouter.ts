import { FocusTarget, Mode } from "../domain/models";
import { UIState } from "../ui/state";

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
};

export type KeyRouterAction =
  | { scope: "ui"; type: "UNWIND" }
  | { scope: "ui"; type: "OPEN_HELP" }
  | { scope: "ui"; type: "CLOSE_HELP" }
  | { scope: "ui"; type: "OPEN_SEARCH" }
  | { scope: "ui"; type: "CLOSE_SEARCH" }
  | { scope: "ui"; type: "MOVE_EDITOR_FOCUS"; direction: 1 | -1 }
  | { scope: "ui"; type: "CYCLE_THEME" }
  | { scope: "domain"; type: "EXIT_APP" }
  | { scope: "domain"; type: "MOVE_SELECTION"; delta: 1 | -1 }
  | { scope: "domain"; type: "TOGGLE_SELECTED" }
  | { scope: "domain"; type: "OPEN_ADD" }
  | { scope: "domain"; type: "OPEN_EDIT" }
  | { scope: "domain"; type: "OPEN_DUPLICATE" }
  | { scope: "domain"; type: "OPEN_DELETE_CONFIRM" }
  | { scope: "domain"; type: "MODAL_CONFIRM_DELETE" }
  | { scope: "domain"; type: "CYCLE_STATUS" }
  | { scope: "domain"; type: "CYCLE_DUE" }
  | { scope: "domain"; type: "TOGGLE_TAG_FILTER" }
  | { scope: "domain"; type: "SAVE_EDITOR" }
  | { scope: "domain"; type: "APPLY_TIME_AUTOCOMPLETE" }
  | { scope: "domain"; type: "ACCEPT_DUE_SUGGESTION" }
  | { scope: "domain"; type: "ACCEPT_TAG_INLINE" };

function isThemeCycleKey(name: string, sequence: string): boolean {
  return name.toLowerCase() === "h" || sequence === "h" || sequence === "H";
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
  const { uiState, hasTagInlineSuggestion, hasDueSuggestion, timeAutocompleteStep } = context;
  const { mode, focus } = uiState;

  if (name === "escape") {
    return [{ scope: "ui", type: "UNWIND" }];
  }

  if (mode === Mode.MODAL_CONFIRM) {
    if (name === "y" || sequence === "y") {
      return [{ scope: "domain", type: "MODAL_CONFIRM_DELETE" }];
    }
    if (name === "n" || sequence === "n") {
      return [{ scope: "ui", type: "UNWIND" }];
    }
    return [];
  }

  if (mode === Mode.HELP) {
    if (isThemeCycleKey(name, sequence)) {
      return [{ scope: "ui", type: "CYCLE_THEME" }];
    }
    if (isHelpCloseKey(name, sequence)) {
      return [{ scope: "ui", type: "CLOSE_HELP" }];
    }
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

  if (sequence === "?") return [{ scope: "ui", type: "OPEN_HELP" }];
  if (name === "q") return [{ scope: "domain", type: "EXIT_APP" }];
  if (name === "j" || name === "down") {
    return [{ scope: "domain", type: "MOVE_SELECTION", delta: 1 }];
  }
  if (name === "k" || name === "up") {
    return [{ scope: "domain", type: "MOVE_SELECTION", delta: -1 }];
  }
  if (name === "space") return [{ scope: "domain", type: "TOGGLE_SELECTED" }];
  if (name === "a") return [{ scope: "domain", type: "OPEN_ADD" }];
  if (name === "e") return [{ scope: "domain", type: "OPEN_EDIT" }];
  if (name === "c") return [{ scope: "domain", type: "OPEN_DUPLICATE" }];
  if (name === "d") return [{ scope: "domain", type: "OPEN_DELETE_CONFIRM" }];
  if (name === "/") return [{ scope: "ui", type: "OPEN_SEARCH" }];
  if (name === "f") return [{ scope: "domain", type: "CYCLE_STATUS" }];
  if (name === "g") return [{ scope: "domain", type: "CYCLE_DUE" }];
  if (name === "t") return [{ scope: "domain", type: "TOGGLE_TAG_FILTER" }];
  return [];
}
