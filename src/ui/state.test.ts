import { describe, expect, it } from "bun:test";
import { FocusTarget, Mode } from "./modeFocus";
import { initialUIState, uiReducer, unwind } from "./state";

const OVERDUE_EVENT = {
  type: "TASK_OVERDUE" as const,
  taskId: "task-1",
  title: "Task 1",
  dueAt: "2026-02-10T09:00:00.000Z",
  firedAt: "2026-02-10T09:01:00.000Z"
};

describe("ui state", () => {
  it("initializes to list mode and task list focus", () => {
    expect(initialUIState.mode).toBe(Mode.LIST);
    expect(initialUIState.focus).toBe(FocusTarget.TASK_LIST);
    expect(initialUIState.emptyNuxDismissed).toBe(false);
    expect(initialUIState.emptyNux).toBeUndefined();
    expect(initialUIState.emptyNuxCelebratePending).toBe(false);
  });

  it("enqueues and dequeues notification modal events", () => {
    const queued = uiReducer(initialUIState, {
      type: "enqueueNotificationModal",
      event: OVERDUE_EVENT
    });
    expect(queued.notificationModalQueue).toEqual([OVERDUE_EVENT]);

    const dequeued = uiReducer(queued, { type: "dequeueNotificationModal" });
    expect(dequeued.notificationModalQueue).toEqual([]);
  });

  it("clears notification modal queue", () => {
    const queued = uiReducer(initialUIState, {
      type: "enqueueNotificationModal",
      event: OVERDUE_EVENT
    });
    const cleared = uiReducer(queued, { type: "clearNotificationModalQueue" });
    expect(cleared.notificationModalQueue).toEqual([]);
  });

  it("opens empty NUX with default welcome step and merges payload", () => {
    const opened = uiReducer(initialUIState, { type: "OPEN_EMPTY_NUX" });
    expect(opened.modal).toEqual({ type: "emptyNux" });
    expect(opened.emptyNux).toEqual({ step: "welcome" });

    const blockedByModal = uiReducer(
      {
        ...initialUIState,
        modal: {
          type: "delete",
          target: "regular_task",
          taskId: "task-1",
          taskTitle: "Task",
          previousMode: Mode.LIST,
          previousFocus: FocusTarget.TASK_LIST
        }
      },
      { type: "OPEN_EMPTY_NUX" }
    );
    expect(blockedByModal.modal?.type).toBe("delete");

    const blockedByDismissed = uiReducer(
      { ...initialUIState, emptyNuxDismissed: true },
      { type: "OPEN_EMPTY_NUX" }
    );
    expect(blockedByDismissed.modal).toBeNull();

    const merged = uiReducer(opened, {
      type: "OPEN_EMPTY_NUX",
      step: "shortcuts",
      startedFromNux: true,
      createdTaskId: "task-123"
    });
    expect(merged.modal).toEqual({ type: "emptyNux" });
    expect(merged.emptyNux).toEqual({
      step: "shortcuts",
      startedFromNux: true,
      createdTaskId: "task-123"
    });
  });

  it("dismisses empty NUX and marks session dismissed", () => {
    const dismissed = uiReducer(
      {
        ...initialUIState,
        mode: Mode.MODAL_CONFIRM,
        focus: FocusTarget.MODAL,
        modal: { type: "emptyNux" },
        emptyNux: { step: "celebrate", startedFromNux: true, createdTaskId: "task-1" },
        emptyNuxCelebratePending: true
      },
      { type: "DISMISS_EMPTY_NUX" }
    );

    expect(dismissed.mode).toBe(Mode.LIST);
    expect(dismissed.focus).toBe(FocusTarget.TASK_LIST);
    expect(dismissed.modal).toBeNull();
    expect(dismissed.emptyNuxDismissed).toBe(true);
    expect(dismissed.emptyNux).toBeUndefined();
    expect(dismissed.emptyNuxCelebratePending).toBe(false);
  });

  it("clears empty NUX transient state without session dismissal", () => {
    const cleared = uiReducer(
      {
        ...initialUIState,
        mode: Mode.MODAL_CONFIRM,
        focus: FocusTarget.MODAL,
        modal: { type: "emptyNux" },
        emptyNux: { step: "shortcuts" },
        emptyNuxCelebratePending: true
      },
      { type: "CLEAR_EMPTY_NUX" }
    );

    expect(cleared.mode).toBe(Mode.LIST);
    expect(cleared.focus).toBe(FocusTarget.TASK_LIST);
    expect(cleared.modal).toBeNull();
    expect(cleared.emptyNuxDismissed).toBe(false);
    expect(cleared.emptyNux).toBeUndefined();
    expect(cleared.emptyNuxCelebratePending).toBe(false);
  });

  it("toggles empty NUX celebrate pending", () => {
    const enabled = uiReducer(initialUIState, {
      type: "SET_EMPTY_NUX_CELEBRATE_PENDING",
      pending: true
    });
    expect(enabled.emptyNuxCelebratePending).toBe(true);

    const disabled = uiReducer(enabled, {
      type: "SET_EMPTY_NUX_CELEBRATE_PENDING",
      pending: false
    });
    expect(disabled.emptyNuxCelebratePending).toBe(false);
  });
});

describe("unwind", () => {
  it("returns to previous mode/focus from modal_confirm", () => {
    const result = unwind({
      ...initialUIState,
      mode: Mode.MODAL_CONFIRM,
      focus: FocusTarget.MODAL,
      modal: {
        type: "delete",
        target: "regular_task",
        taskId: "task-1",
        taskTitle: "Task",
        previousMode: Mode.SEARCH,
        previousFocus: FocusTarget.SEARCH_INPUT
      }
    });

    expect(result).toEqual({
      state: {
        ...initialUIState,
        mode: Mode.SEARCH,
        focus: FocusTarget.SEARCH_INPUT,
        modal: null
      },
      clearEditorDraft: false
    });
  });

  it("returns to previous mode/focus from overdue modal", () => {
    const result = unwind({
      ...initialUIState,
      mode: Mode.MODAL_CONFIRM,
      focus: FocusTarget.MODAL,
      modal: {
        type: "overdue",
        event: OVERDUE_EVENT,
        previousMode: Mode.DASHBOARD,
        previousFocus: FocusTarget.DASHBOARD
      }
    });

    expect(result).toEqual({
      state: {
        ...initialUIState,
        mode: Mode.DASHBOARD,
        focus: FocusTarget.DASHBOARD,
        modal: null
      },
      clearEditorDraft: false
    });
  });

  it("returns to previous mode/focus from edit switch modal", () => {
    const result = unwind({
      ...initialUIState,
      mode: Mode.MODAL_CONFIRM,
      focus: FocusTarget.MODAL,
      modal: {
        type: "edit_switch_confirm",
        fromTaskId: "task-a",
        toTaskId: "task-b",
        toTaskTitle: "Task B",
        previousMode: Mode.EDIT,
        previousFocus: FocusTarget.EDITOR_NOTES
      }
    });

    expect(result).toEqual({
      state: {
        ...initialUIState,
        mode: Mode.EDIT,
        focus: FocusTarget.EDITOR_NOTES,
        modal: null
      },
      clearEditorDraft: false
    });
  });

  it("returns to previous mode/focus from unsaved-changes modal", () => {
    const result = unwind({
      ...initialUIState,
      mode: Mode.MODAL_CONFIRM,
      focus: FocusTarget.MODAL,
      modal: {
        type: "unsaved_changes",
        source: "task_editor",
        continuation: "open_backup_center",
        previousMode: Mode.EDIT,
        previousFocus: FocusTarget.EDITOR_TAGS
      }
    });

    expect(result).toEqual({
      state: {
        ...initialUIState,
        mode: Mode.EDIT,
        focus: FocusTarget.EDITOR_TAGS,
        modal: null
      },
      clearEditorDraft: false
    });
  });

  it("returns to previous mode/focus from backup final-checkpoint modal", () => {
    const result = unwind({
      ...initialUIState,
      mode: Mode.MODAL_CONFIRM,
      focus: FocusTarget.MODAL,
      modal: {
        type: "backup_final_checkpoint",
        checkpoint: "calendar_import",
        sourceScreen: "calendar_import_confirm",
        previousMode: Mode.BACKUP_CENTER,
        previousFocus: FocusTarget.BACKUP_CENTER
      }
    });

    expect(result).toEqual({
      state: {
        ...initialUIState,
        mode: Mode.BACKUP_CENTER,
        focus: FocusTarget.BACKUP_CENTER,
        modal: null
      },
      clearEditorDraft: false
    });
  });

  it("returns to previous mode/focus from recurring-delete-future checkpoint modal", () => {
    const result = unwind({
      ...initialUIState,
      mode: Mode.MODAL_CONFIRM,
      focus: FocusTarget.MODAL,
      modal: {
        type: "recurring_delete_future_checkpoint",
        deleteModal: {
          type: "delete",
          target: "recurring_occurrence",
          seriesTaskId: "series-task-1",
          seriesId: "series:task-1",
          occurrenceIso: "2026-02-10T09:00:00",
          selectedRowId: "series_occurrence:series%3Atask-1:2026-02-10T09%3A00%3A00",
          taskTitle: "Task",
          previousMode: Mode.LIST,
          previousFocus: FocusTarget.TASK_LIST
        },
        previousMode: Mode.LIST,
        previousFocus: FocusTarget.TASK_LIST
      }
    });

    expect(result).toEqual({
      state: {
        ...initialUIState,
        mode: Mode.LIST,
        focus: FocusTarget.TASK_LIST,
        modal: null
      },
      clearEditorDraft: false
    });
  });

  it("dismisses empty NUX to list/task-list and records dismissal", () => {
    const result = unwind({
      ...initialUIState,
      mode: Mode.MODAL_CONFIRM,
      focus: FocusTarget.MODAL,
      modal: {
        type: "emptyNux"
      }
    });

    expect(result).toEqual({
      state: {
        ...initialUIState,
        mode: Mode.LIST,
        focus: FocusTarget.TASK_LIST,
        modal: null,
        emptyNuxDismissed: true,
        emptyNux: undefined,
        emptyNuxCelebratePending: false
      },
      clearEditorDraft: false
    });
  });

  it("returns to previous captured context from help", () => {
    const result = unwind({
      ...initialUIState,
      mode: Mode.HELP,
      previousMode: Mode.EDIT,
      previousFocus: FocusTarget.EDITOR_NOTES
    });

    expect(result).toEqual({
      state: {
        ...initialUIState,
        mode: Mode.EDIT,
        focus: FocusTarget.EDITOR_NOTES,
        previousMode: Mode.EDIT,
        previousFocus: FocusTarget.EDITOR_NOTES
      },
      clearEditorDraft: false
    });
  });

  it("returns to previous captured context from backup center", () => {
    const result = unwind({
      ...initialUIState,
      mode: Mode.BACKUP_CENTER,
      previousMode: Mode.SEARCH,
      previousFocus: FocusTarget.SEARCH_INPUT
    });

    expect(result).toEqual({
      state: {
        ...initialUIState,
        mode: Mode.SEARCH,
        focus: FocusTarget.SEARCH_INPUT,
        previousMode: Mode.SEARCH,
        previousFocus: FocusTarget.SEARCH_INPUT
      },
      clearEditorDraft: false
    });
  });

  it("returns to previous captured context from tag filter panel", () => {
    const result = unwind({
      ...initialUIState,
      mode: Mode.TAG_FILTER,
      focus: FocusTarget.TAG_FILTER_INPUT,
      previousMode: Mode.DASHBOARD,
      previousFocus: FocusTarget.DASHBOARD
    });

    expect(result).toEqual({
      state: {
        ...initialUIState,
        mode: Mode.DASHBOARD,
        focus: FocusTarget.DASHBOARD,
        previousMode: Mode.DASHBOARD,
        previousFocus: FocusTarget.DASHBOARD
      },
      clearEditorDraft: false
    });
  });

  it("closes search back to list/task list", () => {
    const result = unwind({
      ...initialUIState,
      mode: Mode.SEARCH,
      focus: FocusTarget.SEARCH_INPUT
    });

    expect(result).toEqual({
      state: {
        ...initialUIState,
        mode: Mode.LIST,
        focus: FocusTarget.TASK_LIST
      },
      clearEditorDraft: false
    });
  });

  it("closes dashboard back to list/task list", () => {
    const result = unwind({
      ...initialUIState,
      mode: Mode.DASHBOARD,
      focus: FocusTarget.DASHBOARD
    });

    expect(result).toEqual({
      state: {
        ...initialUIState,
        mode: Mode.LIST,
        focus: FocusTarget.TASK_LIST
      },
      clearEditorDraft: false
    });
  });

  it("exits add/edit and requests editor draft clear", () => {
    const addResult = unwind({
      ...initialUIState,
      mode: Mode.ADD,
      focus: FocusTarget.EDITOR_TITLE
    });
    const editResult = unwind({
      ...initialUIState,
      mode: Mode.EDIT,
      focus: FocusTarget.EDITOR_NOTES
    });

    expect(addResult).toEqual({
      state: {
        ...initialUIState,
        mode: Mode.LIST,
        focus: FocusTarget.TASK_LIST
      },
      clearEditorDraft: true
    });
    expect(editResult).toEqual({
      state: {
        ...initialUIState,
        mode: Mode.LIST,
        focus: FocusTarget.TASK_LIST
      },
      clearEditorDraft: true
    });
  });

  it("returns null from list mode", () => {
    expect(unwind(initialUIState)).toBeNull();
  });
});
