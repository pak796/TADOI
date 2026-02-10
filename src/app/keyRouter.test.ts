import { describe, expect, it } from "bun:test";
import { FocusTarget, Mode } from "../domain/models";
import { handleKey, type KeyInput, type KeyRouterContext } from "./keyRouter";
import { initialUIState } from "../ui/state";

function run(
  key: Partial<KeyInput>,
  contextOverrides: Partial<KeyRouterContext> = {}
) {
  const input: KeyInput = {
    name: "",
    sequence: "",
    ctrl: false,
    shift: false,
    ...key
  };
  const context: KeyRouterContext = {
    uiState: initialUIState,
    hasTagInlineSuggestion: false,
    hasDueSuggestion: false,
    timeAutocompleteStep: "none",
    hasPendingGPrefix: false,
    viewsOverlayOpen: false,
    saveViewPromptOpen: false,
    backupScreen: null,
    ...contextOverrides
  };
  return handleKey(input, context);
}

describe("handleKey", () => {
  it("always routes escape to unwind", () => {
    expect(run({ name: "escape" })).toEqual([{ scope: "ui", type: "UNWIND" }]);
    expect(
      run(
        { name: "escape" },
        {
          uiState: {
            ...initialUIState,
            mode: Mode.MODAL_CONFIRM,
            focus: FocusTarget.MODAL
          }
        }
      )
    ).toEqual([{ scope: "ui", type: "UNWIND" }]);
    expect(
      run(
        { name: "escape" },
        { hasPendingGPrefix: true }
      )
    ).toEqual([{ scope: "ui", type: "SET_G_PREFIX", active: false }]);
    expect(
      run(
        { name: "escape" },
        { viewsOverlayOpen: true }
      )
    ).toEqual([{ scope: "ui", type: "CLOSE_VIEWS_OVERLAY" }]);
    expect(
      run(
        { name: "escape" },
        { saveViewPromptOpen: true }
      )
    ).toEqual([{ scope: "ui", type: "CANCEL_SAVE_VIEW_PROMPT" }]);
    expect(
      run(
        { name: "escape" },
        {
          uiState: {
            ...initialUIState,
            mode: Mode.BACKUP_CENTER,
            focus: FocusTarget.BACKUP_CENTER
          },
          backupScreen: "menu"
        }
      )
    ).toEqual([{ scope: "ui", type: "BACKUP_BACK" }]);
  });

  it("blocks non-modal keys while modal is open", () => {
    const modalState = {
      ...initialUIState,
      mode: Mode.MODAL_CONFIRM,
      focus: FocusTarget.MODAL
    };
    expect(run({ name: "j", sequence: "j" }, { uiState: modalState })).toEqual([]);
    expect(run({ name: "space" }, { uiState: modalState })).toEqual([]);
    expect(run({ name: "y", sequence: "y" }, { uiState: modalState })).toEqual([
      { scope: "domain", type: "MODAL_CONFIRM_DELETE" }
    ]);
    expect(run({ name: "n", sequence: "n" }, { uiState: modalState })).toEqual([
      { scope: "ui", type: "UNWIND" }
    ]);
  });

  it("keeps list navigation active only in list/task_list focus", () => {
    expect(
      run({
        name: "j",
        sequence: "j"
      })
    ).toEqual([{ scope: "domain", type: "MOVE_SELECTION", delta: 1 }]);

    expect(
      run(
        {
          name: "j",
          sequence: "j"
        },
        {
          uiState: { ...initialUIState, mode: Mode.LIST, focus: FocusTarget.SEARCH_INPUT }
        }
      )
    ).toEqual([]);
  });

  it("routes jump and paging keys in list mode", () => {
    expect(run({ name: "g", sequence: "g" })).toEqual([
      { scope: "ui", type: "SET_G_PREFIX", active: true }
    ]);
    expect(
      run(
        { name: "g", sequence: "g" },
        { hasPendingGPrefix: true }
      )
    ).toEqual([
      { scope: "ui", type: "SET_G_PREFIX", active: false },
      { scope: "domain", type: "JUMP_TOP" }
    ]);
    expect(run({ name: "G", sequence: "G" })).toEqual([
      { scope: "domain", type: "JUMP_BOTTOM" }
    ]);
    expect(run({ ctrl: true, name: "u" })).toEqual([
      { scope: "domain", type: "MOVE_SELECTION_PAGE", direction: -1 }
    ]);
    expect(run({ ctrl: true, name: "d" })).toEqual([
      { scope: "domain", type: "MOVE_SELECTION_PAGE", direction: 1 }
    ]);
    expect(run({ name: "v", sequence: "v" })).toEqual([
      { scope: "ui", type: "TOGGLE_VIEWS_OVERLAY" }
    ]);
    expect(run({ ctrl: true, name: "s" })).toEqual([
      { scope: "ui", type: "OPEN_SAVE_VIEW_PROMPT" }
    ]);
    expect(run({ name: "s", sequence: "s" })).toEqual([
      { scope: "domain", type: "CYCLE_SORT" }
    ]);
    expect(run({ name: "x", sequence: "x" })).toEqual([
      { scope: "domain", type: "SKIP_SELECTED_OCCURRENCE" }
    ]);
    expect(run({ name: "z", sequence: "z" })).toEqual([
      { scope: "domain", type: "SNOOZE_SELECTED_OCCURRENCE" }
    ]);
    expect(run({ name: "E", sequence: "E" })).toEqual([
      { scope: "domain", type: "OPEN_EDIT_SERIES" }
    ]);
    expect(run({ sequence: "3", name: "3" })).toEqual([
      { scope: "domain", type: "APPLY_VIEW_SLOT", slot: 2 }
    ]);
    expect(run({ sequence: "]", name: "]" })).toEqual([
      { scope: "domain", type: "JUMP_TO_ATTENTION", kind: "overdue", direction: 1 }
    ]);
    expect(run({ sequence: "{", name: "{" })).toEqual([
      { scope: "domain", type: "JUMP_TO_ATTENTION", kind: "today", direction: -1 }
    ]);
  });

  it("routes b/B to dashboard toggle outside text-entry contexts", () => {
    expect(run({ name: "b", sequence: "b" })).toEqual([
      { scope: "ui", type: "TOGGLE_DASHBOARD" }
    ]);
    expect(run({ name: "B", sequence: "B" })).toEqual([
      { scope: "ui", type: "TOGGLE_DASHBOARD" }
    ]);
    expect(
      run(
        { name: "b", sequence: "b" },
        {
          uiState: {
            ...initialUIState,
            mode: Mode.SEARCH,
            focus: FocusTarget.SEARCH_INPUT
          }
        }
      )
    ).toEqual([]);
    expect(
      run(
        { name: "b", sequence: "b" },
        {
          uiState: {
            ...initialUIState,
            mode: Mode.ADD,
            focus: FocusTarget.EDITOR_TITLE
          }
        }
      )
    ).toEqual([]);
    expect(
      run(
        { name: "B", sequence: "B" },
        {
          saveViewPromptOpen: true
        }
      )
    ).toEqual([]);
  });

  it("flushes pending g to due-cycle when next key is not g/G", () => {
    expect(
      run(
        { name: "j", sequence: "j" },
        { hasPendingGPrefix: true }
      )
    ).toEqual([
      { scope: "ui", type: "SET_G_PREFIX", active: false },
      { scope: "domain", type: "CYCLE_DUE" },
      { scope: "domain", type: "MOVE_SELECTION", delta: 1 }
    ]);
  });

  it("routes view overlay keys without leaking list movement", () => {
    expect(
      run(
        { name: "j", sequence: "j" },
        { viewsOverlayOpen: true }
      )
    ).toEqual([{ scope: "ui", type: "MOVE_VIEW_SELECTION", delta: 1 }]);
    expect(
      run(
        { name: "d", sequence: "d" },
        { viewsOverlayOpen: true }
      )
    ).toEqual([{ scope: "domain", type: "DELETE_SELECTED_VIEW" }]);
    expect(
      run(
        { name: "enter" },
        { viewsOverlayOpen: true }
      )
    ).toEqual([{ scope: "domain", type: "APPLY_SELECTED_VIEW" }]);
  });

  it("routes save-view prompt keys only to prompt actions", () => {
    expect(
      run(
        { name: "enter" },
        { saveViewPromptOpen: true }
      )
    ).toEqual([{ scope: "ui", type: "CONFIRM_SAVE_VIEW_PROMPT" }]);
    expect(
      run(
        { name: "escape" },
        { saveViewPromptOpen: true }
      )
    ).toEqual([{ scope: "ui", type: "CANCEL_SAVE_VIEW_PROMPT" }]);
    expect(
      run(
        { name: "j", sequence: "j" },
        { saveViewPromptOpen: true }
      )
    ).toEqual([]);
  });

  it("prevents list-key leakage while typing in search", () => {
    const searchState = {
      ...initialUIState,
      mode: Mode.SEARCH,
      focus: FocusTarget.SEARCH_INPUT
    };
    expect(run({ name: "j", sequence: "j" }, { uiState: searchState })).toEqual([]);
    expect(run({ name: "enter" }, { uiState: searchState })).toEqual([
      { scope: "ui", type: "CLOSE_SEARCH" }
    ]);
  });

  it("routes dashboard mode keys and blocks list navigation leakage", () => {
    const dashboardState = {
      ...initialUIState,
      mode: Mode.DASHBOARD,
      focus: FocusTarget.DASHBOARD
    };

    expect(run({ name: "j", sequence: "j" }, { uiState: dashboardState })).toEqual([]);
    expect(run({ name: "up" }, { uiState: dashboardState })).toEqual([
      { scope: "ui", type: "MOVE_DASHBOARD_TAG_SELECTION", delta: -1 }
    ]);
    expect(run({ name: "down" }, { uiState: dashboardState })).toEqual([
      { scope: "ui", type: "MOVE_DASHBOARD_TAG_SELECTION", delta: 1 }
    ]);
    expect(run({ name: "enter" }, { uiState: dashboardState })).toEqual([
      { scope: "domain", type: "APPLY_DASHBOARD_SELECTED_TAG" }
    ]);
    expect(run({ name: "f", sequence: "f" }, { uiState: dashboardState })).toEqual([
      { scope: "domain", type: "CYCLE_STATUS" }
    ]);
    expect(run({ name: "g", sequence: "g" }, { uiState: dashboardState })).toEqual([
      { scope: "domain", type: "CYCLE_DUE" }
    ]);
    expect(run({ name: "t", sequence: "t" }, { uiState: dashboardState })).toEqual([
      { scope: "domain", type: "TOGGLE_TAG_FILTER" }
    ]);
    expect(run({ name: "q", sequence: "q" }, { uiState: dashboardState })).toEqual([
      { scope: "domain", type: "EXIT_APP" }
    ]);
    expect(run({ sequence: "?" }, { uiState: dashboardState })).toEqual([
      { scope: "ui", type: "OPEN_HELP" }
    ]);
  });

  it("routes help mode theme + flash toggles without leaking list navigation", () => {
    const helpState = {
      ...initialUIState,
      mode: Mode.HELP,
      focus: FocusTarget.TASK_LIST
    };
    expect(run({ name: "j", sequence: "j" }, { uiState: helpState })).toEqual([]);
    expect(run({ name: "up" }, { uiState: helpState })).toEqual([
      { scope: "ui", type: "HELP_MOVE_SECTION_FOCUS", delta: -1 }
    ]);
    expect(run({ name: "down" }, { uiState: helpState })).toEqual([
      { scope: "ui", type: "HELP_MOVE_SECTION_FOCUS", delta: 1 }
    ]);
    expect(run({ name: "left" }, { uiState: helpState })).toEqual([
      { scope: "ui", type: "HELP_SET_FOCUSED_SECTION_EXPANDED", expanded: false }
    ]);
    expect(run({ name: "right" }, { uiState: helpState })).toEqual([
      { scope: "ui", type: "HELP_SET_FOCUSED_SECTION_EXPANDED", expanded: true }
    ]);
    expect(run({ name: "space" }, { uiState: helpState })).toEqual([
      { scope: "ui", type: "HELP_TOGGLE_FOCUSED_SECTION" }
    ]);
    expect(run({ name: "enter" }, { uiState: helpState })).toEqual([
      { scope: "ui", type: "HELP_TOGGLE_FOCUSED_SECTION" }
    ]);
    expect(run({ name: "h", sequence: "h" }, { uiState: helpState })).toEqual([
      { scope: "ui", type: "CYCLE_THEME" }
    ]);
    expect(run({ name: "m", sequence: "m" }, { uiState: helpState })).toEqual([
      { scope: "ui", type: "TOGGLE_FLASH_MODE" }
    ]);
    expect(run({ name: "1", sequence: "1" }, { uiState: helpState })).toEqual([
      { scope: "ui", type: "OPEN_BACKUP_CENTER" }
    ]);
    expect(run({ name: "escape" }, { uiState: helpState })).toEqual([
      { scope: "ui", type: "UNWIND" }
    ]);
  });

  it("routes backup center actions by screen", () => {
    const backupState = {
      ...initialUIState,
      mode: Mode.BACKUP_CENTER,
      focus: FocusTarget.BACKUP_CENTER
    };

    expect(
      run(
        { name: "1", sequence: "1" },
        { uiState: backupState, backupScreen: "menu" }
      )
    ).toEqual([{ scope: "ui", type: "BACKUP_SELECT_MENU_OPTION", index: 0 }]);
    expect(
      run(
        { name: "down" },
        { uiState: backupState, backupScreen: "menu" }
      )
    ).toEqual([{ scope: "ui", type: "BACKUP_MOVE_MENU_SELECTION", delta: 1 }]);
    expect(
      run(
        { name: "2", sequence: "2" },
        { uiState: backupState, backupScreen: "import_mode" }
      )
    ).toEqual([{ scope: "ui", type: "BACKUP_SET_IMPORT_MODE", mode: "replace" }]);
    expect(
      run(
        { name: "enter" },
        { uiState: backupState, backupScreen: "import_dryrun" }
      )
    ).toEqual([{ scope: "ui", type: "BACKUP_PRIMARY" }]);
    expect(
      run(
        { name: "3", sequence: "3" },
        { uiState: backupState, backupScreen: "import_path" }
      )
    ).toEqual([]);
  });

  it("prevents list-key leakage in add/edit text-input modes", () => {
    const addState = {
      ...initialUIState,
      mode: Mode.ADD,
      focus: FocusTarget.EDITOR_TITLE
    };
    expect(run({ name: "j", sequence: "j" }, { uiState: addState })).toEqual([]);
    expect(run({ name: "down" }, { uiState: addState })).toEqual([]);
    expect(run({ ctrl: true, name: "s" }, { uiState: addState })).toEqual([
      { scope: "domain", type: "SAVE_EDITOR" }
    ]);
    expect(run({ name: "pageup" }, { uiState: addState })).toEqual([
      { scope: "ui", type: "SCROLL_EDITOR_PAGE", direction: -1 }
    ]);
    expect(run({ name: "pagedown" }, { uiState: addState })).toEqual([
      { scope: "ui", type: "SCROLL_EDITOR_PAGE", direction: 1 }
    ]);
    expect(run({ ctrl: true, name: "u" }, { uiState: addState })).toEqual([
      { scope: "ui", type: "SCROLL_EDITOR_PAGE", direction: -1 }
    ]);
    expect(run({ ctrl: true, name: "d" }, { uiState: addState })).toEqual([
      { scope: "ui", type: "SCROLL_EDITOR_PAGE", direction: 1 }
    ]);
  });

  it("returns focused editor actions for tab/right/enter", () => {
    const tagsState = {
      ...initialUIState,
      mode: Mode.EDIT,
      focus: FocusTarget.EDITOR_TAGS
    };
    expect(
      run(
        { name: "tab" },
        { uiState: tagsState, hasTagInlineSuggestion: true }
      )
    ).toEqual([
      { scope: "domain", type: "ACCEPT_TAG_INLINE" },
      { scope: "ui", type: "MOVE_EDITOR_FOCUS", direction: 1 }
    ]);
    expect(
      run(
        { name: "right" },
        { uiState: tagsState, hasTagInlineSuggestion: true }
      )
    ).toEqual([{ scope: "domain", type: "ACCEPT_TAG_INLINE" }]);
    expect(
      run(
        { name: "enter" },
        { uiState: tagsState, hasTagInlineSuggestion: true }
      )
    ).toEqual([{ scope: "domain", type: "ACCEPT_TAG_INLINE" }]);
  });
});
