import { describe, expect, it } from "bun:test";
import {
  getNextSelectedIdAfterDelete,
  nextEditorFocusTarget,
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
    expect(toEditorFocus("editor_due_date")).toBe("due");
    expect(toFocusTarget("time")).toBe("editor_due_time");
  });

  it("cycles editor focus with tab order", () => {
    expect(nextEditorFocusTarget("editor_title", 1)).toBe("editor_due_date");
    expect(nextEditorFocusTarget("editor_title", -1)).toBe("editor_cancel");
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
