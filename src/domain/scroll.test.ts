import { describe, expect, it } from "bun:test";
import { ensureSelectedVisible } from "./scroll";

describe("ensureSelectedVisible", () => {
  it("keeps selection visible near top", () => {
    const offset = ensureSelectedVisible({
      selectedIndex: 0,
      scrollOffset: 5,
      visibleRows: 5,
      itemCount: 20
    });
    expect(offset).toBe(0);
  });

  it("scrolls down when selection falls below viewport", () => {
    const offset = ensureSelectedVisible({
      selectedIndex: 10,
      scrollOffset: 5,
      visibleRows: 5,
      itemCount: 20
    });
    expect(offset).toBe(10 - 5 + 1);
  });

  it("clamps offset when list is shorter than viewport", () => {
    const offset = ensureSelectedVisible({
      selectedIndex: 0,
      scrollOffset: 5,
      visibleRows: 10,
      itemCount: 3
    });
    expect(offset).toBe(0);
  });

  it("handles empty list", () => {
    const offset = ensureSelectedVisible({
      selectedIndex: 0,
      scrollOffset: 2,
      visibleRows: 5,
      itemCount: 0
    });
    expect(offset).toBe(0);
  });
});
