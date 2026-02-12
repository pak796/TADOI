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
        {
          uiState: {
            ...initialUIState,
            mode: Mode.MODAL_CONFIRM,
            focus: FocusTarget.MODAL,
            modal: {
              type: "emptyNux" as const
            }
          }
        }
      )
    ).toEqual([{ scope: "ui", type: "DISMISS_EMPTY_NUX" }]);
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
            mode: Mode.LIST,
            focus: FocusTarget.DETAILS_LINKS
          }
        }
      )
    ).toEqual([
      { scope: "ui", type: "SET_LIST_FOCUS", focus: FocusTarget.TASK_LIST }
    ]);
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
      focus: FocusTarget.MODAL,
      modal: {
        type: "delete" as const,
        target: "regular_task" as const,
        taskId: "task-1",
        taskTitle: "Task",
        previousMode: Mode.LIST,
        previousFocus: FocusTarget.TASK_LIST
      }
    };
    expect(run({ name: "j", sequence: "j" }, { uiState: modalState })).toEqual([]);
    expect(run({ name: "space" }, { uiState: modalState })).toEqual([]);
    expect(
      run(
        { name: "p", sequence: "p" },
        { uiState: modalState }
      )
    ).toEqual([]);
    expect(run({ name: "y", sequence: "y" }, { uiState: modalState })).toEqual([
      { scope: "domain", type: "MODAL_CONFIRM_DELETE" }
    ]);
    expect(run({ name: "f", sequence: "f" }, { uiState: modalState })).toEqual([]);
    expect(run({ name: "n", sequence: "n" }, { uiState: modalState })).toEqual([
      { scope: "ui", type: "UNWIND" }
    ]);
  });

  it("routes recurring delete modal keys", () => {
    const modalState = {
      ...initialUIState,
      mode: Mode.MODAL_CONFIRM,
      focus: FocusTarget.MODAL,
      modal: {
        type: "delete" as const,
        target: "recurring_occurrence" as const,
        seriesTaskId: "series-task-1",
        seriesId: "series:task-1",
        occurrenceIso: "2026-02-10T09:00:00",
        selectedRowId: "series_occurrence:series%3Atask-1:2026-02-10T09%3A00%3A00",
        taskTitle: "Task",
        previousMode: Mode.LIST,
        previousFocus: FocusTarget.TASK_LIST
      }
    };
    expect(run({ name: "y", sequence: "y" }, { uiState: modalState })).toEqual([
      { scope: "domain", type: "MODAL_CONFIRM_DELETE" }
    ]);
    expect(run({ name: "f", sequence: "f" }, { uiState: modalState })).toEqual([
      { scope: "domain", type: "MODAL_CONFIRM_DELETE_FUTURE" }
    ]);
    expect(run({ name: "n", sequence: "n" }, { uiState: modalState })).toEqual([
      { scope: "ui", type: "UNWIND" }
    ]);
  });

  it("routes overdue modal keys", () => {
    const modalState = {
      ...initialUIState,
      mode: Mode.MODAL_CONFIRM,
      focus: FocusTarget.MODAL,
      modal: {
        type: "overdue" as const,
        event: {
          type: "TASK_OVERDUE" as const,
          taskId: "task-1",
          title: "Task",
          dueAt: "2026-02-10T09:00:00.000Z",
          firedAt: "2026-02-10T09:01:00.000Z"
        },
        previousMode: Mode.LIST,
        previousFocus: FocusTarget.TASK_LIST
      }
    };
    expect(run({ name: "s", sequence: "s" }, { uiState: modalState })).toEqual([
      { scope: "domain", type: "MODAL_OVERDUE_SNOOZE" }
    ]);
    expect(run({ name: "D", sequence: "D" }, { uiState: modalState })).toEqual([
      { scope: "domain", type: "MODAL_OVERDUE_DONE" }
    ]);
    expect(run({ name: "g", sequence: "g" }, { uiState: modalState })).toEqual([
      { scope: "domain", type: "MODAL_OVERDUE_GO_TO_TASK" }
    ]);
  });

  it("routes task-link modal confirm keys", () => {
    const deleteModalState = {
      ...initialUIState,
      mode: Mode.MODAL_CONFIRM,
      focus: FocusTarget.MODAL,
      modal: {
        type: "task_link_delete" as const,
        taskId: "task-1",
        linkId: "link-1",
        target: "https://example.com",
        previousMode: Mode.LIST,
        previousFocus: FocusTarget.DETAILS_LINKS
      }
    };
    expect(run({ name: "y", sequence: "y" }, { uiState: deleteModalState })).toEqual([
      { scope: "domain", type: "MODAL_CONFIRM_TASK_LINK_DELETE" }
    ]);
    expect(run({ name: "n", sequence: "n" }, { uiState: deleteModalState })).toEqual([
      { scope: "ui", type: "UNWIND" }
    ]);

    const externalModalState = {
      ...initialUIState,
      mode: Mode.MODAL_CONFIRM,
      focus: FocusTarget.MODAL,
      modal: {
        type: "task_link_open_external" as const,
        taskId: "task-1",
        linkId: "link-1",
        target: "vscode://repo/file",
        scheme: "vscode",
        previousMode: Mode.LIST,
        previousFocus: FocusTarget.DETAILS_LINKS
      }
    };
    expect(run({ name: "y", sequence: "y" }, { uiState: externalModalState })).toEqual([
      { scope: "domain", type: "MODAL_CONFIRM_TASK_LINK_OPEN_EXTERNAL" }
    ]);
  });

  it("routes task-link form modal focus/type actions", () => {
    const formModalState = {
      ...initialUIState,
      mode: Mode.MODAL_CONFIRM,
      focus: FocusTarget.MODAL,
      modal: {
        type: "task_link_form" as const,
        mode: "add" as const,
        source: { scope: "task" as const, taskId: "task-1" },
        labelValue: "",
        targetValue: "",
        kindValue: "auto" as const,
        activeField: "type" as const,
        previousMode: Mode.LIST,
        previousFocus: FocusTarget.DETAILS_LINKS
      }
    };
    expect(run({ name: "tab" }, { uiState: formModalState })).toEqual([
      { scope: "ui", type: "MODAL_MOVE_TASK_LINK_FORM_FOCUS", direction: 1 }
    ]);
    expect(run({ name: "left" }, { uiState: formModalState })).toEqual([
      { scope: "ui", type: "MODAL_CYCLE_TASK_LINK_FORM_TYPE", direction: -1 }
    ]);
    expect(run({ name: "right" }, { uiState: formModalState })).toEqual([
      { scope: "ui", type: "MODAL_CYCLE_TASK_LINK_FORM_TYPE", direction: 1 }
    ]);
  });

  it("routes empty NUX modal keys", () => {
    const modalState = {
      ...initialUIState,
      mode: Mode.MODAL_CONFIRM,
      focus: FocusTarget.MODAL,
      modal: {
        type: "emptyNux" as const
      }
    };

    expect(run({ name: "a", sequence: "a" }, { uiState: modalState })).toEqual([
      { scope: "ui", type: "DISMISS_EMPTY_NUX" },
      { scope: "domain", type: "OPEN_ADD" }
    ]);
    expect(run({ name: "A", sequence: "A" }, { uiState: modalState })).toEqual([
      { scope: "ui", type: "DISMISS_EMPTY_NUX" },
      { scope: "domain", type: "OPEN_ADD" }
    ]);
    expect(run({ name: "j", sequence: "j" }, { uiState: modalState })).toEqual([]);
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

  it("toggles list/details focus with tab", () => {
    expect(run({ name: "tab" })).toEqual([
      { scope: "ui", type: "SET_LIST_FOCUS", focus: FocusTarget.DETAILS_LINKS }
    ]);
    expect(
      run(
        { name: "tab" },
        {
          uiState: {
            ...initialUIState,
            mode: Mode.LIST,
            focus: FocusTarget.DETAILS_LINKS
          }
        }
      )
    ).toEqual([{ scope: "ui", type: "SET_LIST_FOCUS", focus: FocusTarget.TASK_LIST }]);
  });

  it("routes details-links actions when details focus is active", () => {
    const detailsState = {
      ...initialUIState,
      mode: Mode.LIST,
      focus: FocusTarget.DETAILS_LINKS
    };

    expect(run({ name: "down" }, { uiState: detailsState })).toEqual([
      { scope: "domain", type: "MOVE_LINK_SELECTION", delta: 1 }
    ]);
    expect(run({ name: "up" }, { uiState: detailsState })).toEqual([
      { scope: "domain", type: "MOVE_LINK_SELECTION", delta: -1 }
    ]);
    expect(run({ name: "enter" }, { uiState: detailsState })).toEqual([
      { scope: "domain", type: "OPEN_SELECTED_LINK" }
    ]);
    expect(run({ name: "c", sequence: "c" }, { uiState: detailsState })).toEqual([
      { scope: "domain", type: "COPY_SELECTED_LINK" }
    ]);
    expect(run({ name: "l", sequence: "l" }, { uiState: detailsState })).toEqual([
      { scope: "domain", type: "OPEN_ADD_TASK_LINK_MODAL" }
    ]);
    expect(run({ name: "e", sequence: "e" }, { uiState: detailsState })).toEqual([
      { scope: "domain", type: "OPEN_EDIT_TASK_LINK_MODAL" }
    ]);
    expect(run({ name: "d", sequence: "d" }, { uiState: detailsState })).toEqual([
      { scope: "domain", type: "OPEN_DELETE_TASK_LINK_MODAL" }
    ]);
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
    expect(run({ name: "t", sequence: "t" })).toEqual([
      { scope: "domain", type: "TOGGLE_TAG_FILTER" }
    ]);
    expect(run({ name: "l", sequence: "l" })).toEqual([
      { scope: "domain", type: "OPEN_ADD_TASK_LINK_MODAL" }
    ]);
    expect(run({ name: "p", sequence: "p" })).toEqual([
      { scope: "ui", type: "OPEN_TAG_FILTER_PANEL" }
    ]);
    expect(run({ name: "T", sequence: "T", shift: true })).toEqual([]);
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
    expect(
      run(
        { name: "p", sequence: "p" },
        { uiState: searchState }
      )
    ).toEqual([]);
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
    expect(
      run(
        { name: "p", sequence: "p" },
        { uiState: dashboardState }
      )
    ).toEqual([{ scope: "ui", type: "OPEN_TAG_FILTER_PANEL" }]);
    expect(
      run(
        { name: "T", sequence: "T", shift: true },
        { uiState: dashboardState }
      )
    ).toEqual([]);
    expect(run({ name: "q", sequence: "q" }, { uiState: dashboardState })).toEqual([
      { scope: "domain", type: "EXIT_APP" }
    ]);
    expect(run({ sequence: "?" }, { uiState: dashboardState })).toEqual([
      { scope: "ui", type: "OPEN_HELP" }
    ]);
  });

  it("keeps help mode read-only for settings hotkeys", () => {
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
    expect(run({ ctrl: true, name: "u" }, { uiState: helpState })).toEqual([
      { scope: "ui", type: "HELP_SCROLL_PAGE", direction: -1 }
    ]);
    expect(run({ ctrl: true, name: "d" }, { uiState: helpState })).toEqual([
      { scope: "ui", type: "HELP_SCROLL_PAGE", direction: 1 }
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
    expect(run({ name: "h", sequence: "h" }, { uiState: helpState })).toEqual([]);
    expect(run({ name: "m", sequence: "m" }, { uiState: helpState })).toEqual([]);
    expect(run({ name: "n", sequence: "n" }, { uiState: helpState })).toEqual([]);
    expect(run({ name: "o", sequence: "o" }, { uiState: helpState })).toEqual([]);
    expect(run({ name: "l", sequence: "l" }, { uiState: helpState })).toEqual([]);
    expect(
      run({ name: "h", sequence: "h" }, { uiState: helpState, helpPage: "settings" })
    ).toEqual([]);
    expect(
      run({ name: "m", sequence: "m" }, { uiState: helpState, helpPage: "theme" })
    ).toEqual([]);
    expect(run({ name: "1", sequence: "1" }, { uiState: helpState })).toEqual([
      { scope: "ui", type: "OPEN_BACKUP_CENTER" }
    ]);
    expect(run({ name: "escape" }, { uiState: helpState })).toEqual([
      { scope: "ui", type: "UNWIND" }
    ]);
  });

  it("routes help subpage forward/back navigation actions", () => {
    const helpState = {
      ...initialUIState,
      mode: Mode.HELP,
      focus: FocusTarget.TASK_LIST
    };

    expect(
      run({ name: "enter" }, { uiState: helpState, helpPage: "settings" })
    ).toEqual([{ scope: "ui", type: "HELP_NAV_FORWARD" }]);
    expect(
      run({ name: "right" }, { uiState: helpState, helpPage: "theme" })
    ).toEqual([{ scope: "ui", type: "HELP_NAV_FORWARD" }]);
    expect(
      run({ name: "backspace" }, { uiState: helpState, helpPage: "theme" })
    ).toEqual([{ scope: "ui", type: "HELP_NAV_BACK" }]);
    expect(
      run({ name: "left" }, { uiState: helpState, helpPage: "custom1" })
    ).toEqual([{ scope: "ui", type: "HELP_NAV_BACK" }]);
    expect(
      run({ name: "escape" }, { uiState: helpState, helpPage: "custom1" })
    ).toEqual([{ scope: "ui", type: "HELP_NAV_BACK" }]);
    expect(
      run({ name: "right" }, { uiState: helpState, helpPage: "textTuning" })
    ).toEqual([{ scope: "ui", type: "HELP_NAV_FORWARD" }]);
    expect(
      run({ name: "left" }, { uiState: helpState, helpPage: "textTuningTheme" })
    ).toEqual([{ scope: "ui", type: "HELP_NAV_BACK" }]);
  });

  it("does not consume editor navigation keys on custom1 edit page", () => {
    const helpState = {
      ...initialUIState,
      mode: Mode.HELP,
      focus: FocusTarget.TASK_LIST
    };
    expect(
      run({ name: "up" }, { uiState: helpState, helpPage: "custom1Edit" })
    ).toEqual([]);
    expect(
      run({ name: "down" }, { uiState: helpState, helpPage: "custom1Edit" })
    ).toEqual([]);
    expect(
      run({ name: "left" }, { uiState: helpState, helpPage: "custom1Edit" })
    ).toEqual([]);
    expect(
      run({ name: "right" }, { uiState: helpState, helpPage: "custom1Edit" })
    ).toEqual([]);
    expect(
      run({ name: "enter" }, { uiState: helpState, helpPage: "custom1Edit" })
    ).toEqual([]);
    expect(
      run({ name: "backspace" }, { uiState: helpState, helpPage: "custom1Edit" })
    ).toEqual([]);
    expect(
      run({ name: "up" }, { uiState: helpState, helpPage: "textTuningEdit" })
    ).toEqual([]);
    expect(
      run({ name: "right" }, { uiState: helpState, helpPage: "textTuningEdit" })
    ).toEqual([]);
    expect(
      run({ name: "enter" }, { uiState: helpState, helpPage: "textTuningEdit" })
    ).toEqual([]);
  });

  it("blocks list/dashboard routing while tag filter panel mode is active", () => {
    const panelState = {
      ...initialUIState,
      mode: Mode.TAG_FILTER,
      focus: FocusTarget.TAG_FILTER_INPUT
    };
    expect(run({ name: "j", sequence: "j" }, { uiState: panelState })).toEqual([]);
    expect(run({ name: "t", sequence: "t" }, { uiState: panelState })).toEqual([]);
    expect(
      run(
        { name: "T", sequence: "T", shift: true },
        { uiState: panelState }
      )
    ).toEqual([]);
    expect(run({ name: "escape" }, { uiState: panelState })).toEqual([
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
        { name: "4", sequence: "4" },
        { uiState: backupState, backupScreen: "menu" }
      )
    ).toEqual([{ scope: "ui", type: "BACKUP_SELECT_MENU_OPTION", index: 3 }]);
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
    ).toEqual([{ scope: "ui", type: "BACKUP_SELECT_DIGIT", digit: 3 }]);
    expect(
      run(
        { name: "2", sequence: "2" },
        { uiState: backupState, backupScreen: "calendar_import_mode" }
      )
    ).toEqual([{ scope: "ui", type: "BACKUP_SELECT_DIGIT", digit: 2 }]);
  });

  it("prevents list-key leakage in add/edit text-input modes", () => {
    const addState = {
      ...initialUIState,
      mode: Mode.ADD,
      focus: FocusTarget.EDITOR_TITLE
    };
    expect(run({ name: "j", sequence: "j" }, { uiState: addState })).toEqual([]);
    expect(run({ name: "down" }, { uiState: addState })).toEqual([]);
    expect(
      run(
        { name: "T", sequence: "T", shift: true },
        { uiState: addState }
      )
    ).toEqual([]);
    expect(run({ ctrl: true, name: "s" }, { uiState: addState })).toEqual([
      { scope: "domain", type: "SAVE_EDITOR" }
    ]);
    expect(run({ ctrl: true, name: "l" }, { uiState: addState })).toEqual([
      { scope: "domain", type: "OPEN_ADD_TASK_LINK_MODAL" }
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

  it("keeps link hotkeys scoped to list/details focus and blocks leakage elsewhere", () => {
    const detailsState = {
      ...initialUIState,
      mode: Mode.LIST,
      focus: FocusTarget.DETAILS_LINKS
    };
    expect(run({ name: "o", sequence: "o" }, { uiState: detailsState })).toEqual([
      { scope: "domain", type: "OPEN_SELECTED_LINK" }
    ]);
    expect(run({ name: "backspace" }, { uiState: detailsState })).toEqual([
      { scope: "domain", type: "OPEN_DELETE_TASK_LINK_MODAL" }
    ]);

    const blockedStates = [
      { mode: Mode.MODAL_CONFIRM, focus: FocusTarget.MODAL },
      { mode: Mode.HELP, focus: FocusTarget.TASK_LIST },
      { mode: Mode.SEARCH, focus: FocusTarget.SEARCH_INPUT },
      { mode: Mode.ADD, focus: FocusTarget.EDITOR_TITLE },
      { mode: Mode.EDIT, focus: FocusTarget.EDITOR_TITLE },
      { mode: Mode.TAG_FILTER, focus: FocusTarget.TAG_FILTER_INPUT }
    ];
    const linkHotkeys: Array<Partial<KeyInput>> = [
      { name: "enter" },
      { name: "o", sequence: "o" },
      { name: "c", sequence: "c" },
      { name: "l", sequence: "l" },
      { name: "e", sequence: "e" },
      { name: "d", sequence: "d" },
      { name: "backspace" }
    ];
    const linkActionTypes = new Set([
      "OPEN_SELECTED_LINK",
      "COPY_SELECTED_LINK",
      "OPEN_ADD_TASK_LINK_MODAL",
      "OPEN_EDIT_TASK_LINK_MODAL",
      "OPEN_DELETE_TASK_LINK_MODAL"
    ]);

    for (const blockedState of blockedStates) {
      for (const key of linkHotkeys) {
        const actions = run(key, {
          uiState: {
            ...initialUIState,
            mode: blockedState.mode,
            focus: blockedState.focus
          }
        });
        expect(actions.some((action) => linkActionTypes.has(action.type))).toBe(false);
      }
    }
  });
});
