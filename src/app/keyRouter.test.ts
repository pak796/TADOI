import { describe, expect, it } from "bun:test";
import { FocusTarget, Mode } from "../domain/models";
import { handleKey, type KeyInput, type KeyRouterContext } from "./keyRouter";
import { initialUIState, unwind } from "../ui/state";
import { normalizeKeymapAliases, resolveKeymapAliases } from "./keymapAliases";

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
    hasTitleInlineSuggestion: false,
    hasTagInlineSuggestion: false,
    hasDueSuggestion: false,
    timeAutocompleteStep: "none",
    hasPendingGPrefix: false,
    bulkActive: false,
    viewsOverlayOpen: false,
    saveViewPromptOpen: false,
    allowEmptyNuxRecoveryImport: false,
    backupScreen: null,
    selectedTaskHasChecklistItems: false,
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
            mode: Mode.LIST,
            focus: FocusTarget.DETAILS_CHECKLIST
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
            mode: Mode.LIST,
            focus: FocusTarget.TASK_LIST
          },
          bulkActive: true
        }
      )
    ).toEqual([{ scope: "ui", type: "CLEAR_BULK_MARKS" }]);
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

  it("esc from dashboard returns to list/task-list after unwind", () => {
    const dashboardState = {
      ...initialUIState,
      mode: Mode.DASHBOARD,
      focus: FocusTarget.DASHBOARD
    };
    expect(run({ name: "escape" }, { uiState: dashboardState })).toEqual([
      { scope: "ui", type: "UNWIND" }
    ]);

    const result = unwind(dashboardState);
    expect(result.state.mode).toBe(Mode.LIST);
    expect(result.state.focus).toBe(FocusTarget.TASK_LIST);
    expect(result.clearEditorDraft).toBe(false);
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
      {
        scope: "ui",
        type: "OPEN_RECURRING_DELETE_FUTURE_CHECKPOINT_MODAL",
        modal: {
          type: "recurring_delete_future_checkpoint",
          deleteModal: modalState.modal,
          previousMode: Mode.LIST,
          previousFocus: FocusTarget.TASK_LIST
        }
      }
    ]);
    expect(run({ name: "n", sequence: "n" }, { uiState: modalState })).toEqual([
      { scope: "ui", type: "UNWIND" }
    ]);
  });

  it("routes recurring delete future checkpoint modal keys", () => {
    const recurringDeleteModal = {
      type: "delete" as const,
      target: "recurring_occurrence" as const,
      seriesTaskId: "series-task-1",
      seriesId: "series:task-1",
      occurrenceIso: "2026-02-10T09:00:00",
      selectedRowId: "series_occurrence:series%3Atask-1:2026-02-10T09%3A00%3A00",
      taskTitle: "Task",
      previousMode: Mode.LIST,
      previousFocus: FocusTarget.TASK_LIST
    };
    const modalState = {
      ...initialUIState,
      mode: Mode.MODAL_CONFIRM,
      focus: FocusTarget.MODAL,
      modal: {
        type: "recurring_delete_future_checkpoint" as const,
        deleteModal: recurringDeleteModal,
        previousMode: Mode.LIST,
        previousFocus: FocusTarget.TASK_LIST
      }
    };
    expect(run({ name: "y", sequence: "y" }, { uiState: modalState })).toEqual([
      { scope: "domain", type: "MODAL_CONFIRM_RECURRING_DELETE_FUTURE_CHECKPOINT" }
    ]);
    expect(run({ name: "n", sequence: "n" }, { uiState: modalState })).toEqual([
      { scope: "ui", type: "MODAL_CANCEL_RECURRING_DELETE_FUTURE_CHECKPOINT" }
    ]);
    expect(run({ name: "escape" }, { uiState: modalState })).toEqual([
      { scope: "ui", type: "MODAL_CANCEL_RECURRING_DELETE_FUTURE_CHECKPOINT" }
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

  it("routes reminder modal keys", () => {
    const modalState = {
      ...initialUIState,
      mode: Mode.MODAL_CONFIRM,
      focus: FocusTarget.MODAL,
      modal: {
        type: "reminder" as const,
        event: {
          type: "TASK_REMINDER" as const,
          taskId: "task-2",
          title: "Task",
          effectiveReminderAt: Date.parse("2026-02-10T08:00:00.000Z"),
          dueAt: "2026-02-10T09:00:00.000Z",
          firedAt: "2026-02-10T08:00:00.000Z"
        },
        previousMode: Mode.LIST,
        previousFocus: FocusTarget.TASK_LIST
      }
    };
    expect(run({ name: "enter" }, { uiState: modalState })).toEqual([
      { scope: "domain", type: "MODAL_REMINDER_DISMISS" }
    ]);
    expect(run({ name: "escape" }, { uiState: modalState })).toEqual([
      { scope: "domain", type: "MODAL_REMINDER_DISMISS" }
    ]);
    expect(run({ name: "1", sequence: "1" }, { uiState: modalState })).toEqual([
      { scope: "domain", type: "MODAL_REMINDER_SNOOZE", deltaMs: 600000 }
    ]);
    expect(run({ name: "2", sequence: "2" }, { uiState: modalState })).toEqual([
      { scope: "domain", type: "MODAL_REMINDER_SNOOZE", deltaMs: 3600000 }
    ]);
    expect(run({ name: "3", sequence: "3" }, { uiState: modalState })).toEqual([
      { scope: "domain", type: "MODAL_REMINDER_SNOOZE", deltaMs: 86400000 }
    ]);
    expect(run({ name: "g", sequence: "g" }, { uiState: modalState })).toEqual([
      { scope: "domain", type: "MODAL_REMINDER_GO_TO_TASK" }
    ]);
  });

  it("routes edit-switch modal keys", () => {
    const modalState = {
      ...initialUIState,
      mode: Mode.MODAL_CONFIRM,
      focus: FocusTarget.MODAL,
      modal: {
        type: "edit_switch_confirm" as const,
        fromTaskId: "task-a",
        toTaskId: "task-b",
        toTaskTitle: "Task B",
        previousMode: Mode.EDIT,
        previousFocus: FocusTarget.EDITOR_TITLE
      }
    };
    expect(run({ name: "s", sequence: "s" }, { uiState: modalState })).toEqual([
      { scope: "domain", type: "MODAL_EDIT_SWITCH_SAVE" }
    ]);
    expect(run({ name: "d", sequence: "d" }, { uiState: modalState })).toEqual([
      { scope: "domain", type: "MODAL_EDIT_SWITCH_DISCARD_SWITCH" }
    ]);
    expect(run({ name: "c", sequence: "c" }, { uiState: modalState })).toEqual([
      { scope: "domain", type: "MODAL_EDIT_SWITCH_DISCARD_CLOSE" }
    ]);
    expect(run({ name: "enter" }, { uiState: modalState })).toEqual([]);
  });

  it("routes unsaved-changes modal keys", () => {
    const modalState = {
      ...initialUIState,
      mode: Mode.MODAL_CONFIRM,
      focus: FocusTarget.MODAL,
      modal: {
        type: "unsaved_changes" as const,
        source: "task_editor" as const,
        continuation: "open_dashboard" as const,
        previousMode: Mode.EDIT,
        previousFocus: FocusTarget.EDITOR_TITLE
      }
    };
    expect(run({ name: "s", sequence: "s" }, { uiState: modalState })).toEqual([
      { scope: "domain", type: "MODAL_CONFIRM_UNSAVED_SAVE_CONTINUE" }
    ]);
    expect(run({ name: "d", sequence: "d" }, { uiState: modalState })).toEqual([
      { scope: "domain", type: "MODAL_CONFIRM_UNSAVED_DISCARD_CONTINUE" }
    ]);
    expect(run({ name: "c", sequence: "c" }, { uiState: modalState })).toEqual([
      { scope: "ui", type: "MODAL_CANCEL_UNSAVED_CONTINUE" }
    ]);
    expect(run({ name: "escape" }, { uiState: modalState })).toEqual([
      { scope: "ui", type: "MODAL_CANCEL_UNSAVED_CONTINUE" }
    ]);
  });

  it("routes backup final-checkpoint modal keys", () => {
    const modalState = {
      ...initialUIState,
      mode: Mode.MODAL_CONFIRM,
      focus: FocusTarget.MODAL,
      modal: {
        type: "backup_final_checkpoint" as const,
        checkpoint: "calendar_import" as const,
        sourceScreen: "calendar_import_confirm" as const,
        previousMode: Mode.BACKUP_CENTER,
        previousFocus: FocusTarget.BACKUP_CENTER
      }
    };
    expect(run({ name: "y", sequence: "y" }, { uiState: modalState })).toEqual([
      { scope: "domain", type: "MODAL_CONFIRM_BACKUP_FINAL_CHECKPOINT" }
    ]);
    expect(run({ name: "n", sequence: "n" }, { uiState: modalState })).toEqual([
      { scope: "ui", type: "MODAL_CANCEL_BACKUP_FINAL_CHECKPOINT" }
    ]);
    expect(run({ name: "escape" }, { uiState: modalState })).toEqual([
      { scope: "ui", type: "MODAL_CANCEL_BACKUP_FINAL_CHECKPOINT" }
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
    const welcomeModalState = {
      ...initialUIState,
      mode: Mode.MODAL_CONFIRM,
      focus: FocusTarget.MODAL,
      modal: {
        type: "emptyNux" as const
      }
    };

    const createFromWelcome = [
      {
        scope: "ui",
        type: "OPEN_EMPTY_NUX" as const,
        step: "adding" as const,
        startedFromNux: true
      },
      { scope: "ui", type: "SET_MODAL" as const, modal: null },
      { scope: "domain", type: "OPEN_ADD" }
    ] as const;

    expect(run({ name: "a", sequence: "a" }, { uiState: welcomeModalState })).toEqual(
      createFromWelcome
    );
    expect(run({ name: "enter" }, { uiState: welcomeModalState })).toEqual(
      createFromWelcome
    );
    expect(run({ name: "h", sequence: "h" }, { uiState: welcomeModalState })).toEqual([
      { scope: "ui", type: "OPEN_EMPTY_NUX", step: "shortcuts" }
    ]);
    expect(
      run(
        { name: "i", sequence: "i" },
        { uiState: welcomeModalState, allowEmptyNuxRecoveryImport: false }
      )
    ).toEqual([]);
    expect(
      run(
        { name: "i", sequence: "i" },
        { uiState: welcomeModalState, allowEmptyNuxRecoveryImport: true }
      )
    ).toEqual([{ scope: "ui", type: "OPEN_BACKUP_CENTER_IMPORT" }]);
    expect(run({ name: "s", sequence: "s" }, { uiState: welcomeModalState })).toEqual([
      { scope: "ui", type: "DISMISS_EMPTY_NUX" }
    ]);
    expect(run({ name: "escape" }, { uiState: welcomeModalState })).toEqual([
      { scope: "ui", type: "DISMISS_EMPTY_NUX" }
    ]);

    const shortcutsModalState = {
      ...welcomeModalState,
      emptyNux: { step: "shortcuts" as const }
    };
    expect(run({ name: "escape" }, { uiState: shortcutsModalState })).toEqual([
      { scope: "ui", type: "OPEN_EMPTY_NUX", step: "welcome" }
    ]);
    expect(run({ name: "a", sequence: "a" }, { uiState: shortcutsModalState })).toEqual(
      createFromWelcome
    );
    expect(
      run(
        { name: "i", sequence: "i" },
        { uiState: shortcutsModalState, allowEmptyNuxRecoveryImport: true }
      )
    ).toEqual([]);

    const celebrateModalState = {
      ...welcomeModalState,
      emptyNux: { step: "celebrate" as const, startedFromNux: true, createdTaskId: "task-1" }
    };
    expect(run({ name: "enter" }, { uiState: celebrateModalState })).toEqual([
      { scope: "ui", type: "CLEAR_EMPTY_NUX" },
      { scope: "ui", type: "SET_LIST_FOCUS", focus: FocusTarget.TASK_LIST }
    ]);
    expect(run({ name: "a", sequence: "a" }, { uiState: celebrateModalState })).toEqual(
      createFromWelcome
    );
    expect(run({ name: "h", sequence: "h" }, { uiState: celebrateModalState })).toEqual([
      { scope: "ui", type: "OPEN_EMPTY_NUX", step: "shortcuts" }
    ]);
    expect(
      run(
        { name: "i", sequence: "i" },
        { uiState: celebrateModalState, allowEmptyNuxRecoveryImport: true }
      )
    ).toEqual([]);
    expect(run({ name: "escape" }, { uiState: celebrateModalState })).toEqual([
      { scope: "ui", type: "CLEAR_EMPTY_NUX" }
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

  it("switches details subpane focus with left/right arrows", () => {
    const linksState = {
      ...initialUIState,
      mode: Mode.LIST,
      focus: FocusTarget.DETAILS_LINKS
    };
    const checklistState = {
      ...initialUIState,
      mode: Mode.LIST,
      focus: FocusTarget.DETAILS_CHECKLIST
    };
    expect(run({ name: "right" }, { uiState: linksState })).toEqual([
      { scope: "ui", type: "SET_LIST_FOCUS", focus: FocusTarget.DETAILS_CHECKLIST }
    ]);
    expect(run({ name: "left" }, { uiState: checklistState })).toEqual([
      { scope: "ui", type: "SET_LIST_FOCUS", focus: FocusTarget.DETAILS_LINKS }
    ]);
  });

  it("routes task-list right arrow to checklist quick edit only when checklist exists", () => {
    expect(run({ name: "right" })).toEqual([]);
    expect(run({ name: "right" }, { selectedTaskHasChecklistItems: true })).toEqual([
      { scope: "domain", type: "OPEN_EDIT_CHECKLIST_QUICK" }
    ]);
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

  it("routes details-checklist actions without leaking list movement", () => {
    const checklistState = {
      ...initialUIState,
      mode: Mode.LIST,
      focus: FocusTarget.DETAILS_CHECKLIST
    };
    expect(run({ name: "j", sequence: "j" }, { uiState: checklistState })).toEqual([
      { scope: "domain", type: "MOVE_CHECKLIST_SELECTION", delta: 1 }
    ]);
    expect(run({ name: "k", sequence: "k" }, { uiState: checklistState })).toEqual([
      { scope: "domain", type: "MOVE_CHECKLIST_SELECTION", delta: -1 }
    ]);
    expect(run({ name: "space" }, { uiState: checklistState })).toEqual([
      { scope: "domain", type: "TOGGLE_SELECTED_CHECKLIST_ITEM" }
    ]);
    expect(run({ name: "a", sequence: "a" }, { uiState: checklistState })).toEqual([
      { scope: "domain", type: "OPEN_ADD_CHECKLIST_ITEM_MODAL" }
    ]);
    expect(run({ name: "e", sequence: "e" }, { uiState: checklistState })).toEqual([
      { scope: "domain", type: "OPEN_EDIT_CHECKLIST_ITEM_MODAL" }
    ]);
    expect(run({ name: "d", sequence: "d" }, { uiState: checklistState })).toEqual([
      { scope: "domain", type: "OPEN_DELETE_CHECKLIST_ITEM_MODAL" }
    ]);
    expect(run({ name: "enter" }, { uiState: checklistState })).toEqual([]);
  });

  it("routes jump and paging keys in list mode", () => {
    expect(run({ name: "m", sequence: "m" })).toEqual([
      { scope: "domain", type: "TOGGLE_BULK_MARK" }
    ]);
    expect(run({ ctrl: true, name: "g", sequence: "g" })).toEqual([
      { scope: "ui", type: "SET_G_PREFIX", active: true }
    ]);
    expect(run({ ctrl: true, name: "p", sequence: "p" })).toEqual([
      { scope: "ui", type: "SET_G_PREFIX", active: true }
    ]);
    expect(run({ ctrl: true, name: "y", sequence: "y" })).toEqual([
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
    expect(run({ name: "g", sequence: "g" })).toEqual([
      { scope: "domain", type: "CYCLE_DUE" }
    ]);
    expect(run({ name: "r", sequence: "r" })).toEqual([
      { scope: "domain", type: "CYCLE_PRIORITY" }
    ]);
    expect(run({ name: "u", sequence: "u" })).toEqual([
      { scope: "ui", type: "OPEN_BACKUP_CENTER" }
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

  it("clears pending g prefix and routes only the continuation key when next key is not g/G", () => {
    expect(
      run(
        { name: "j", sequence: "j" },
        { hasPendingGPrefix: true }
      )
    ).toEqual([
      { scope: "ui", type: "SET_G_PREFIX", active: false },
      { scope: "domain", type: "MOVE_SELECTION", delta: 1 }
    ]);
  });

  it("routes list aliases before defaults and preserves fallback when unmapped", () => {
    const resolvedAliases = resolveKeymapAliases(
      normalizeKeymapAliases({
        list: {
          list_open_search: ["Ctrl+F"],
          list_open_add: ["n"]
        }
      })
    );
    expect(
      run(
        { ctrl: true, name: "f", sequence: "f" },
        { resolvedKeymapAliases: resolvedAliases }
      )
    ).toEqual([{ scope: "ui", type: "OPEN_SEARCH" }]);
    expect(
      run(
        { name: "n", sequence: "n" },
        { resolvedKeymapAliases: resolvedAliases }
      )
    ).toEqual([{ scope: "domain", type: "OPEN_ADD" }]);
    expect(
      run(
        { name: "a", sequence: "a" },
        { resolvedKeymapAliases: resolvedAliases }
      )
    ).toEqual([{ scope: "domain", type: "OPEN_ADD" }]);
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
    expect(
      run(
        { name: "r", sequence: "r" },
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
      { scope: "ui", type: "DASHBOARD_MOVE_ACTIVE_SELECTION", delta: -1 }
    ]);
    expect(run({ name: "down" }, { uiState: dashboardState })).toEqual([
      { scope: "ui", type: "DASHBOARD_MOVE_ACTIVE_SELECTION", delta: 1 }
    ]);
    expect(run({ name: "enter" }, { uiState: dashboardState })).toEqual([
      { scope: "domain", type: "APPLY_DASHBOARD_ACTIVE_SELECTION" }
    ]);
    expect(run({ name: "f", sequence: "f" }, { uiState: dashboardState })).toEqual([
      { scope: "domain", type: "CYCLE_STATUS" }
    ]);
    expect(run({ name: "g", sequence: "g" }, { uiState: dashboardState })).toEqual([
      { scope: "domain", type: "CYCLE_DUE" }
    ]);
    expect(run({ name: "w", sequence: "w" }, { uiState: dashboardState })).toEqual([
      { scope: "domain", type: "CYCLE_ANALYTICS_WINDOW" }
    ]);
    expect(run({ name: "r", sequence: "r" }, { uiState: dashboardState })).toEqual([
      { scope: "domain", type: "CYCLE_PRIORITY" }
    ]);
    expect(run({ name: "tab" }, { uiState: dashboardState })).toEqual([
      { scope: "ui", type: "DASHBOARD_NEXT_FOCUS_GROUP" }
    ]);
    expect(run({ name: "tab", shift: true }, { uiState: dashboardState })).toEqual([
      { scope: "ui", type: "DASHBOARD_PREV_FOCUS_GROUP" }
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
    expect(run({ name: "u", sequence: "u" }, { uiState: dashboardState })).toEqual([
      { scope: "ui", type: "OPEN_BACKUP_CENTER" }
    ]);
    expect(run({ sequence: "?" }, { uiState: dashboardState })).toEqual([
      { scope: "ui", type: "OPEN_HELP" }
    ]);
  });

  it("routes dashboard aliases before defaults", () => {
    const dashboardState = {
      ...initialUIState,
      mode: Mode.DASHBOARD,
      focus: FocusTarget.DASHBOARD
    };
    const resolvedAliases = resolveKeymapAliases(
      normalizeKeymapAliases({
        dashboard: {
          dashboard_cycle_status: ["x"],
          dashboard_apply_selection: ["Space"]
        }
      })
    );

    expect(
      run(
        { name: "x", sequence: "x" },
        { uiState: dashboardState, resolvedKeymapAliases: resolvedAliases }
      )
    ).toEqual([{ scope: "domain", type: "CYCLE_STATUS" }]);
    expect(
      run(
        { name: "space", sequence: " " },
        { uiState: dashboardState, resolvedKeymapAliases: resolvedAliases }
      )
    ).toEqual([{ scope: "domain", type: "APPLY_DASHBOARD_ACTIVE_SELECTION" }]);
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

  it("routes help aliases on root page and keeps editor pages read-only", () => {
    const helpState = {
      ...initialUIState,
      mode: Mode.HELP,
      focus: FocusTarget.TASK_LIST
    };
    const resolvedAliases = resolveKeymapAliases(
      normalizeKeymapAliases({
        help: {
          help_open_backup_center: ["9"],
          help_close: ["q"]
        }
      })
    );

    expect(
      run(
        { name: "9", sequence: "9" },
        { uiState: helpState, resolvedKeymapAliases: resolvedAliases }
      )
    ).toEqual([{ scope: "ui", type: "OPEN_BACKUP_CENTER" }]);
    expect(
      run(
        { name: "q", sequence: "q" },
        { uiState: helpState, resolvedKeymapAliases: resolvedAliases }
      )
    ).toEqual([{ scope: "ui", type: "CLOSE_HELP" }]);
    expect(
      run(
        { name: "q", sequence: "q" },
        { uiState: helpState, helpPage: "custom1Edit", resolvedKeymapAliases: resolvedAliases }
      )
    ).toEqual([]);
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
    expect(run({ name: "r", sequence: "r" }, { uiState: panelState })).toEqual([]);
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
        { name: "pagedown" },
        { uiState: backupState, backupScreen: "import_dryrun" }
      )
    ).toEqual([{ scope: "ui", type: "BACKUP_SCROLL_BODY", delta: 8 }]);
    expect(
      run(
        { ctrl: true, name: "u" },
        { uiState: backupState, backupScreen: "calendar_import_dryrun" }
      )
    ).toEqual([{ scope: "ui", type: "BACKUP_SCROLL_BODY", delta: -8 }]);
    expect(
      run(
        { name: "3", sequence: "3" },
        { uiState: backupState, backupScreen: "import_path" }
      )
    ).toEqual([{ scope: "ui", type: "BACKUP_SELECT_DIGIT", digit: 3 }]);
    expect(
      run(
        { name: "down" },
        { uiState: backupState, backupScreen: "import_path" }
      )
    ).toEqual([]);
    expect(
      run(
        { name: "2", sequence: "2" },
        { uiState: backupState, backupScreen: "calendar_import_mode" }
      )
    ).toEqual([{ scope: "ui", type: "BACKUP_SELECT_DIGIT", digit: 2 }]);
    expect(
      run(
        { name: "up" },
        { uiState: backupState, backupScreen: "import_picker" }
      )
    ).toEqual([{ scope: "ui", type: "BACKUP_PICKER_MOVE_SELECTION", delta: -1 }]);
    expect(
      run(
        { name: "down" },
        { uiState: backupState, backupScreen: "import_picker" }
      )
    ).toEqual([{ scope: "ui", type: "BACKUP_PICKER_MOVE_SELECTION", delta: 1 }]);
    expect(
      run(
        { name: "pageup" },
        { uiState: backupState, backupScreen: "import_picker" }
      )
    ).toEqual([{ scope: "ui", type: "BACKUP_PICKER_PAGE_SELECTION", delta: -1 }]);
    expect(
      run(
        { name: "pagedown" },
        { uiState: backupState, backupScreen: "import_picker" }
      )
    ).toEqual([{ scope: "ui", type: "BACKUP_PICKER_PAGE_SELECTION", delta: 1 }]);
    expect(
      run(
        { name: "home" },
        { uiState: backupState, backupScreen: "import_picker" }
      )
    ).toEqual([{ scope: "ui", type: "BACKUP_PICKER_JUMP_SELECTION", target: "start" }]);
    expect(
      run(
        { name: "end" },
        { uiState: backupState, backupScreen: "import_picker" }
      )
    ).toEqual([{ scope: "ui", type: "BACKUP_PICKER_JUMP_SELECTION", target: "end" }]);
    expect(
      run(
        { name: "enter" },
        { uiState: backupState, backupScreen: "import_picker" }
      )
    ).toEqual([{ scope: "ui", type: "BACKUP_PICKER_CONFIRM_SELECTION" }]);
    expect(
      run(
        { name: "m", sequence: "m" },
        { uiState: backupState, backupScreen: "import_picker" }
      )
    ).toEqual([{ scope: "ui", type: "BACKUP_PICKER_OPEN_MANUAL_PATH" }]);
    expect(
      run(
        { name: "3", sequence: "3" },
        { uiState: backupState, backupScreen: "import_picker" }
      )
    ).toEqual([]);
  });

  it("routes backup aliases with screen-aware no-op behavior", () => {
    const backupState = {
      ...initialUIState,
      mode: Mode.BACKUP_CENTER,
      focus: FocusTarget.BACKUP_CENTER
    };
    const resolvedAliases = resolveKeymapAliases(
      normalizeKeymapAliases({
        backup: {
          backup_primary: ["Space"],
          backup_jump_start: ["h"],
          backup_menu_option_4: ["9"]
        }
      })
    );

    expect(
      run(
        { name: "space", sequence: " " },
        { uiState: backupState, backupScreen: "menu", resolvedKeymapAliases: resolvedAliases }
      )
    ).toEqual([{ scope: "ui", type: "BACKUP_PRIMARY" }]);
    expect(
      run(
        { name: "h", sequence: "h" },
        {
          uiState: backupState,
          backupScreen: "import_picker",
          resolvedKeymapAliases: resolvedAliases
        }
      )
    ).toEqual([{ scope: "ui", type: "BACKUP_PICKER_JUMP_SELECTION", target: "start" }]);
    expect(
      run(
        { name: "h", sequence: "h" },
        { uiState: backupState, backupScreen: "menu", resolvedKeymapAliases: resolvedAliases }
      )
    ).toEqual([]);
    expect(
      run(
        { name: "9", sequence: "9" },
        { uiState: backupState, backupScreen: "menu", resolvedKeymapAliases: resolvedAliases }
      )
    ).toEqual([{ scope: "ui", type: "BACKUP_SELECT_MENU_OPTION", index: 3 }]);
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

    const notesState = {
      ...initialUIState,
      mode: Mode.EDIT,
      focus: FocusTarget.EDITOR_NOTES
    };
    expect(run({ name: "j", sequence: "j" }, { uiState: notesState })).toEqual([]);
    expect(run({ name: "down" }, { uiState: notesState })).toEqual([]);
    expect(run({ name: "b", sequence: "b" }, { uiState: notesState })).toEqual([]);
    expect(run({ name: "/", sequence: "/" }, { uiState: notesState })).toEqual([]);
    expect(run({ name: "t", sequence: "t" }, { uiState: notesState })).toEqual([]);
    expect(run({ name: "enter" }, { uiState: notesState })).toEqual([]);
    expect(run({ name: "escape" }, { uiState: notesState })).toEqual([
      { scope: "ui", type: "UNWIND" }
    ]);
  });

  it("returns focused editor actions for tab/right/enter", () => {
    const titleState = {
      ...initialUIState,
      mode: Mode.EDIT,
      focus: FocusTarget.EDITOR_TITLE
    };
    expect(
      run(
        { name: "tab" },
        { uiState: titleState, hasTitleInlineSuggestion: true }
      )
    ).toEqual([
      { scope: "domain", type: "ACCEPT_TITLE_INLINE" },
      { scope: "ui", type: "MOVE_EDITOR_FOCUS", direction: 1 }
    ]);
    expect(
      run(
        { name: "right" },
        { uiState: titleState, hasTitleInlineSuggestion: true }
      )
    ).toEqual([{ scope: "domain", type: "ACCEPT_TITLE_INLINE" }]);

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

    const timeEditState = {
      ...initialUIState,
      mode: Mode.EDIT,
      focus: FocusTarget.EDITOR_DUE_TIME
    };
    expect(
      run(
        { name: "right" },
        { uiState: timeEditState, timeAutocompleteStep: "hour" }
      )
    ).toEqual([{ scope: "domain", type: "APPLY_TIME_AUTOCOMPLETE" }]);
  });

  it("routes editor checklist actions without leaking list movement", () => {
    const checklistEditorState = {
      ...initialUIState,
      mode: Mode.EDIT,
      focus: FocusTarget.EDITOR_CHECKLIST
    };

    expect(run({ name: "j", sequence: "j" }, { uiState: checklistEditorState })).toEqual([
      { scope: "domain", type: "MOVE_CHECKLIST_SELECTION", delta: 1 }
    ]);
    expect(run({ name: "k", sequence: "k" }, { uiState: checklistEditorState })).toEqual([
      { scope: "domain", type: "MOVE_CHECKLIST_SELECTION", delta: -1 }
    ]);
    expect(run({ name: "down" }, { uiState: checklistEditorState })).toEqual([
      { scope: "domain", type: "MOVE_CHECKLIST_SELECTION", delta: 1 }
    ]);
    expect(run({ name: "space" }, { uiState: checklistEditorState })).toEqual([
      { scope: "domain", type: "TOGGLE_SELECTED_CHECKLIST_ITEM" }
    ]);
    expect(run({ name: "a", sequence: "a" }, { uiState: checklistEditorState })).toEqual([
      { scope: "domain", type: "OPEN_ADD_CHECKLIST_ITEM_MODAL" }
    ]);
    expect(run({ name: "e", sequence: "e" }, { uiState: checklistEditorState })).toEqual([
      { scope: "domain", type: "OPEN_EDIT_CHECKLIST_ITEM_MODAL" }
    ]);
    expect(run({ name: "d", sequence: "d" }, { uiState: checklistEditorState })).toEqual([
      { scope: "domain", type: "OPEN_DELETE_CHECKLIST_ITEM_MODAL" }
    ]);
    expect(run({ name: "left" }, { uiState: checklistEditorState })).toEqual([
      { scope: "domain", type: "SAVE_EDITOR" }
    ]);
    expect(run({ name: "enter" }, { uiState: checklistEditorState })).toEqual([]);
    expect(run({ name: "b", sequence: "b" }, { uiState: checklistEditorState })).toEqual([]);
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

  it("opens notes from list/dashboard and keeps notes mode key scope isolated", () => {
    expect(
      run({
        name: "n",
        sequence: "n"
      })
    ).toEqual([{ scope: "ui", type: "OPEN_NOTES" }]);

    expect(
      run(
        {
          name: "n",
          sequence: "n"
        },
        {
          uiState: {
            ...initialUIState,
            mode: Mode.DASHBOARD,
            focus: FocusTarget.DASHBOARD
          }
        }
      )
    ).toEqual([{ scope: "ui", type: "OPEN_NOTES" }]);

    const notesListState = {
      ...initialUIState,
      mode: Mode.NOTES_LIST,
      focus: FocusTarget.NOTES_LIST
    };
    expect(run({ name: "j", sequence: "j" }, { uiState: notesListState })).toEqual([
      { scope: "ui", type: "NOTES_MOVE_SELECTION", delta: 1 }
    ]);
    expect(run({ name: "return" }, { uiState: notesListState })).toEqual([
      { scope: "ui", type: "NOTES_OPEN_SELECTED" }
    ]);
    expect(run({ name: "/", sequence: "/" }, { uiState: notesListState })).toEqual([
      { scope: "ui", type: "OPEN_NOTES_SEARCH" }
    ]);

    const notesViewState = {
      ...initialUIState,
      mode: Mode.NOTES_VIEW,
      focus: FocusTarget.NOTES_VIEW
    };
    expect(run({ name: "escape" }, { uiState: notesViewState })).toEqual([
      { scope: "ui", type: "NOTES_BACK_TO_LIST" }
    ]);
    expect(run({ name: "b", sequence: "b" }, { uiState: notesViewState })).toEqual([]);
  });
});
