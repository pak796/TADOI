import { describe, expect, it } from "bun:test";
import { FocusTarget, Mode } from "../domain/models";
import {
  getNextSelectedIdAfterDelete,
  nextEditorFocusTarget,
  resolveEscUnwindTarget,
  resolveModalAction,
  shouldCloseHelp,
  shouldCloseSearch,
  toEditorFocus,
  toFocusTarget
} from "./uiState";

describe("uiState routing helpers", () => {
  it("resolves modal actions and blocks unrelated keys", () => {
    expect(resolveModalAction("y", "y")).toBe("confirm");
    expect(resolveModalAction("n", "n")).toBe("cancel");
    expect(resolveModalAction("escape", "")).toBe("cancel");
    expect(resolveModalAction("j", "j")).toBe("none");
  });

  it("closes help and search only on expected keys", () => {
    expect(shouldCloseHelp("escape", "")).toBe(true);
    expect(shouldCloseHelp("", "?")).toBe(true);
    expect(shouldCloseHelp("j", "j")).toBe(false);

    expect(shouldCloseSearch("escape")).toBe(true);
    expect(shouldCloseSearch("enter")).toBe(true);
    expect(shouldCloseSearch("return")).toBe(true);
    expect(shouldCloseSearch("j")).toBe(false);
  });
});

describe("uiState editor focus mapping", () => {
  it("maps editor focus round-trip", () => {
    expect(toEditorFocus(FocusTarget.EDITOR_DUE_DATE)).toBe("due");
    expect(toFocusTarget("time")).toBe(FocusTarget.EDITOR_DUE_TIME);
    expect(toFocusTarget("repeat_mode")).toBe(FocusTarget.EDITOR_REPEAT_MODE);
    expect(toEditorFocus(FocusTarget.EDITOR_REPEAT_CUSTOM)).toBe("repeat_custom");
  });

  it("cycles editor focus with tab order", () => {
    expect(nextEditorFocusTarget(FocusTarget.EDITOR_TITLE, 1)).toBe(
      FocusTarget.EDITOR_DUE_DATE
    );
    expect(nextEditorFocusTarget(FocusTarget.EDITOR_TITLE, -1)).toBe(
      FocusTarget.EDITOR_CANCEL
    );
  });
});

describe("uiState delete selection rules", () => {
  it("returns undefined when deleting the only item", () => {
    expect(getNextSelectedIdAfterDelete(["a"], "a")).toBeUndefined();
  });

  it("selects previous when deleting last item", () => {
    expect(getNextSelectedIdAfterDelete(["a", "b", "c"], "c")).toBe("b");
  });

  it("keeps same index (next item) when deleting middle", () => {
    expect(getNextSelectedIdAfterDelete(["a", "b", "c"], "b")).toBe("c");
  });
});

describe("uiState esc unwind target", () => {
  it("unwinds modal to previous context", () => {
    const target = resolveEscUnwindTarget({
      mode: Mode.MODAL_CONFIRM,
      modal: {
        type: "delete",
        taskId: "t1",
        taskTitle: "task",
        previousMode: Mode.SEARCH,
        previousFocus: FocusTarget.SEARCH_INPUT
      },
      helpReturnMode: Mode.LIST,
      helpReturnFocus: FocusTarget.TASK_LIST
    });
    expect(target).toEqual({
      mode: Mode.SEARCH,
      focus: FocusTarget.SEARCH_INPUT,
      clearEditor: false,
      clearModal: true
    });
  });

  it("unwinds empty NUX modal to list/task-list", () => {
    const target = resolveEscUnwindTarget({
      mode: Mode.MODAL_CONFIRM,
      modal: {
        type: "emptyNux"
      },
      helpReturnMode: Mode.SEARCH,
      helpReturnFocus: FocusTarget.SEARCH_INPUT
    });
    expect(target).toEqual({
      mode: Mode.LIST,
      focus: FocusTarget.TASK_LIST,
      clearEditor: false,
      clearModal: true
    });
  });

  it("unwinds help/search/editor one layer", () => {
    expect(
      resolveEscUnwindTarget({
        mode: Mode.HELP,
        modal: null,
        helpReturnMode: Mode.EDIT,
        helpReturnFocus: FocusTarget.EDITOR_NOTES
      })
    ).toEqual({
      mode: Mode.EDIT,
      focus: FocusTarget.EDITOR_NOTES,
      clearEditor: false,
      clearModal: false
    });

    expect(
      resolveEscUnwindTarget({
        mode: Mode.BACKUP_CENTER,
        modal: null,
        helpReturnMode: Mode.SEARCH,
        helpReturnFocus: FocusTarget.SEARCH_INPUT
      })
    ).toEqual({
      mode: Mode.SEARCH,
      focus: FocusTarget.SEARCH_INPUT,
      clearEditor: false,
      clearModal: false
    });

    expect(
      resolveEscUnwindTarget({
        mode: Mode.TAG_FILTER,
        modal: null,
        helpReturnMode: Mode.DASHBOARD,
        helpReturnFocus: FocusTarget.DASHBOARD
      })
    ).toEqual({
      mode: Mode.DASHBOARD,
      focus: FocusTarget.DASHBOARD,
      clearEditor: false,
      clearModal: false
    });

    expect(
      resolveEscUnwindTarget({
        mode: Mode.SEARCH,
        modal: null,
        helpReturnMode: Mode.LIST,
        helpReturnFocus: FocusTarget.TASK_LIST
      })
    ).toEqual({
      mode: Mode.LIST,
      focus: FocusTarget.TASK_LIST,
      clearEditor: false,
      clearModal: false
    });

    expect(
      resolveEscUnwindTarget({
        mode: Mode.ADD,
        modal: null,
        helpReturnMode: Mode.LIST,
        helpReturnFocus: FocusTarget.TASK_LIST
      })
    ).toEqual({
      mode: Mode.LIST,
      focus: FocusTarget.TASK_LIST,
      clearEditor: true,
      clearModal: false
    });
  });
});
