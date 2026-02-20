import { describe, expect, it } from "bun:test";
import { Mode } from "../domain/models";
import { resolveTaskRowClickIntent, shouldShowScrollbar } from "./TaskList";

describe("task list scrollbar visibility", () => {
  it("hides scrollbar when no tasks are present", () => {
    expect(shouldShowScrollbar(0, 10)).toBe(false);
  });

  it("hides scrollbar when tasks fit in visible rows", () => {
    expect(shouldShowScrollbar(5, 10)).toBe(false);
    expect(shouldShowScrollbar(10, 10)).toBe(false);
  });

  it("shows scrollbar when tasks exceed visible rows", () => {
    expect(shouldShowScrollbar(11, 10)).toBe(true);
  });
});

describe("task row click intent", () => {
  it("returns select for left-click on unselected row", () => {
    expect(
      resolveTaskRowClickIntent({
        button: 0,
        wasSelected: false,
        mode: Mode.LIST
      })
    ).toBe("select");
  });

  it("returns open_edit for left-click on selected row in list mode", () => {
    expect(
      resolveTaskRowClickIntent({
        button: 0,
        wasSelected: true,
        mode: Mode.LIST
      })
    ).toBe("open_edit");
  });

  it("returns open_edit for left-click on selected row in search mode", () => {
    expect(
      resolveTaskRowClickIntent({
        button: 0,
        wasSelected: true,
        mode: Mode.SEARCH
      })
    ).toBe("open_edit");
  });

  it("blocks selected-row left-click in add mode", () => {
    expect(
      resolveTaskRowClickIntent({
        button: 0,
        wasSelected: true,
        mode: Mode.ADD
      })
    ).toBe("none");
  });

  it("blocks selected-row left-click in edit mode", () => {
    expect(
      resolveTaskRowClickIntent({
        button: 0,
        wasSelected: true,
        mode: Mode.EDIT
      })
    ).toBe("none");
  });

  it("returns none for non-left click", () => {
    expect(
      resolveTaskRowClickIntent({
        button: 2,
        wasSelected: true,
        mode: Mode.LIST
      })
    ).toBe("none");
  });
});
