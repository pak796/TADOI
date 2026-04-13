import { describe, expect, it } from "bun:test";
import {
  clampScrollOffset,
  clampSelectedIndex,
  ensureSelectedVisible,
} from "./scroll";

describe("ensureSelectedVisible", () => {
  it("keeps selection visible near top", () => {
    const offset = ensureSelectedVisible({
      selectedIndex: 0,
      scrollOffset: 5,
      visibleRows: 5,
      itemCount: 20,
    });
    expect(offset).toBe(0);
  });

  it("scrolls down when selection falls below viewport", () => {
    const offset = ensureSelectedVisible({
      selectedIndex: 10,
      scrollOffset: 5,
      visibleRows: 5,
      itemCount: 20,
    });
    expect(offset).toBe(10 - 5 + 1);
  });

  it("clamps offset when list is shorter than viewport", () => {
    const offset = ensureSelectedVisible({
      selectedIndex: 0,
      scrollOffset: 5,
      visibleRows: 10,
      itemCount: 3,
    });
    expect(offset).toBe(0);
  });

  it("handles empty list", () => {
    const offset = ensureSelectedVisible({
      selectedIndex: 0,
      scrollOffset: 2,
      visibleRows: 5,
      itemCount: 0,
    });
    expect(offset).toBe(0);
  });

  it("clamps selected index and scroll offset", () => {
    expect(clampSelectedIndex(-2, 10)).toBe(0);
    expect(clampSelectedIndex(50, 10)).toBe(9);
    expect(clampSelectedIndex(0, 0)).toBe(0);

    expect(clampScrollOffset(-3, 5, 20)).toBe(0);
    expect(clampScrollOffset(99, 5, 20)).toBe(15);
    expect(clampScrollOffset(2, 5, 0)).toBe(0);
  });

  it("handles visibleRows changes without invalid offset", () => {
    const offset = ensureSelectedVisible({
      selectedIndex: 8,
      scrollOffset: 6,
      visibleRows: 2,
      itemCount: 9,
    });
    expect(offset).toBe(7);
  });
});
