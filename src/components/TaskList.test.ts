import { describe, expect, it } from "bun:test";
import { Mode } from "../domain/models";
import {
  resolveTaskListWheelDelta,
  resolveTaskListWheelSelectionIndex,
  resolveTaskRowClickIntent,
  shouldShowScrollbar,
} from "./TaskList";

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
        mode: Mode.LIST,
      }),
    ).toBe("select");
  });

  it("returns open_edit for left-click on selected row in list mode", () => {
    expect(
      resolveTaskRowClickIntent({
        button: 0,
        wasSelected: true,
        mode: Mode.LIST,
      }),
    ).toBe("open_edit");
  });

  it("returns open_edit for left-click on selected row in search mode", () => {
    expect(
      resolveTaskRowClickIntent({
        button: 0,
        wasSelected: true,
        mode: Mode.SEARCH,
      }),
    ).toBe("open_edit");
  });

  it("blocks selected-row left-click in add mode", () => {
    expect(
      resolveTaskRowClickIntent({
        button: 0,
        wasSelected: true,
        mode: Mode.ADD,
      }),
    ).toBe("none");
  });

  it("blocks selected-row left-click in edit mode", () => {
    expect(
      resolveTaskRowClickIntent({
        button: 0,
        wasSelected: true,
        mode: Mode.EDIT,
      }),
    ).toBe("none");
  });

  it("returns none for non-left click", () => {
    expect(
      resolveTaskRowClickIntent({
        button: 2,
        wasSelected: true,
        mode: Mode.LIST,
      }),
    ).toBe("none");
  });
});

describe("task list wheel direction mapping", () => {
  it("maps wheel up/down to deterministic list deltas", () => {
    expect(resolveTaskListWheelDelta("up")).toBe(-1);
    expect(resolveTaskListWheelDelta("down")).toBe(1);
  });

  it("returns no-op for non-vertical wheel directions", () => {
    expect(resolveTaskListWheelDelta("left")).toBe(0);
    expect(resolveTaskListWheelDelta("right")).toBe(0);
    expect(resolveTaskListWheelDelta(undefined)).toBe(0);
  });

  it("clamps wheel selection movement at bounds and no-ops at edges", () => {
    expect(
      resolveTaskListWheelSelectionIndex({
        currentIndex: 0,
        delta: -1,
        itemCount: 3,
      }),
    ).toBe(0);
    expect(
      resolveTaskListWheelSelectionIndex({
        currentIndex: 2,
        delta: 1,
        itemCount: 3,
      }),
    ).toBe(2);
    expect(
      resolveTaskListWheelSelectionIndex({
        currentIndex: 1,
        delta: 1,
        itemCount: 3,
      }),
    ).toBe(2);
    expect(
      resolveTaskListWheelSelectionIndex({
        currentIndex: 1,
        delta: -1,
        itemCount: 3,
      }),
    ).toBe(0);
  });
});
