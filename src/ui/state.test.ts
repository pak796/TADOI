import { describe, expect, it } from "bun:test";
import { FocusTarget, Mode } from "./modeFocus";
import { initialUIState, unwind } from "./state";

describe("ui state", () => {
  it("initializes to list mode and task list focus", () => {
    expect(initialUIState.mode).toBe(Mode.LIST);
    expect(initialUIState.focus).toBe(FocusTarget.TASK_LIST);
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
