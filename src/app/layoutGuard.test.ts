import { describe, expect, it } from "bun:test";
import {
  getTerminalSizeWarning,
  isTerminalSizeSupported,
  MIN_TERMINAL_HEIGHT,
  MIN_TERMINAL_WIDTH,
} from "./layoutGuard";

describe("layoutGuard", () => {
  it("validates minimum supported terminal size", () => {
    expect(
      isTerminalSizeSupported(MIN_TERMINAL_WIDTH, MIN_TERMINAL_HEIGHT),
    ).toBe(true);
    expect(
      isTerminalSizeSupported(MIN_TERMINAL_WIDTH - 1, MIN_TERMINAL_HEIGHT),
    ).toBe(false);
    expect(
      isTerminalSizeSupported(MIN_TERMINAL_WIDTH, MIN_TERMINAL_HEIGHT - 1),
    ).toBe(false);
  });

  it("builds warning text with minimum and current dimensions", () => {
    const warning = getTerminalSizeWarning(79, 22);
    expect(warning).toContain("104x24");
    expect(warning).toContain("79x22");
  });
});
