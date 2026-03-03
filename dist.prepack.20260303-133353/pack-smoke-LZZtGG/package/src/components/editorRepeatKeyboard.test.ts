import { describe, expect, it } from "bun:test";
import {
  cycleRepeatEndModeClamp,
  cycleRepeatModeClamp,
  REPEAT_END_MODE_KEYBOARD_ORDER,
  REPEAT_MODE_KEYBOARD_ORDER,
  shouldInterceptRepeatArrowAtEdge
} from "./editorRepeatKeyboard";

describe("editorRepeatKeyboard", () => {
  it("uses the expected repeat order for keyboard cycling", () => {
    expect(REPEAT_MODE_KEYBOARD_ORDER).toEqual([
      "off",
      "daily",
      "weekly",
      "monthly",
      "custom"
    ]);
    expect(REPEAT_END_MODE_KEYBOARD_ORDER).toEqual(["never", "until", "count"]);
  });

  it("cycles repeat mode forward/backward with clamp behavior", () => {
    expect(cycleRepeatModeClamp("off", -1)).toBe("off");
    expect(cycleRepeatModeClamp("off", 1)).toBe("daily");
    expect(cycleRepeatModeClamp("daily", 1)).toBe("weekly");
    expect(cycleRepeatModeClamp("weekly", 1)).toBe("monthly");
    expect(cycleRepeatModeClamp("monthly", 1)).toBe("custom");
    expect(cycleRepeatModeClamp("custom", 1)).toBe("custom");
    expect(cycleRepeatModeClamp("custom", -1)).toBe("monthly");
  });

  it("cycles repeat end mode forward/backward with clamp behavior", () => {
    expect(cycleRepeatEndModeClamp("never", -1)).toBe("never");
    expect(cycleRepeatEndModeClamp("never", 1)).toBe("until");
    expect(cycleRepeatEndModeClamp("until", 1)).toBe("count");
    expect(cycleRepeatEndModeClamp("count", 1)).toBe("count");
    expect(cycleRepeatEndModeClamp("count", -1)).toBe("until");
  });

  it("intercepts arrows only when caret is at edge and no selection exists", () => {
    expect(
      shouldInterceptRepeatArrowAtEdge({
        keyName: "left",
        cursorOffset: 0,
        valueLength: 5,
        hasSelection: false
      })
    ).toBe(true);
    expect(
      shouldInterceptRepeatArrowAtEdge({
        keyName: "right",
        cursorOffset: 5,
        valueLength: 5,
        hasSelection: false
      })
    ).toBe(true);
    expect(
      shouldInterceptRepeatArrowAtEdge({
        keyName: "left",
        cursorOffset: 2,
        valueLength: 5,
        hasSelection: false
      })
    ).toBe(false);
    expect(
      shouldInterceptRepeatArrowAtEdge({
        keyName: "right",
        cursorOffset: 2,
        valueLength: 5,
        hasSelection: false
      })
    ).toBe(false);
    expect(
      shouldInterceptRepeatArrowAtEdge({
        keyName: "left",
        cursorOffset: 0,
        valueLength: 5,
        hasSelection: true
      })
    ).toBe(false);
  });
});
