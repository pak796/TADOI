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
});

describe("unwind", () => {
  it("returns to previous mode/focus from modal_confirm", () => {
    const result = unwind({
      ...initialUIState,
      mode: Mode.MODAL_CONFIRM,
      focus: FocusTarget.MODAL,
      modal: {
        type: "delete",
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
