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
