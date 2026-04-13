import { describe, expect, it } from "bun:test";
import {
  runPrimaryMouseDownAction,
  shouldHandlePrimaryMouseDown,
} from "./EditorPane";

describe("editor pane mouse guards", () => {
  it("treats only button=0 as actionable", () => {
    expect(shouldHandlePrimaryMouseDown(0)).toBe(true);
    expect(shouldHandlePrimaryMouseDown(1)).toBe(false);
    expect(shouldHandlePrimaryMouseDown(2)).toBe(false);
  });

  it("ignores non-left clicks for save/cancel/repeat action callbacks", () => {
    const calls = { save: 0, cancel: 0, repeat: 0 };

    const saveHandled = runPrimaryMouseDownAction(2, () => {
      calls.save += 1;
    });
    const cancelHandled = runPrimaryMouseDownAction(1, () => {
      calls.cancel += 1;
    });
    const repeatHandled = runPrimaryMouseDownAction(2, () => {
      calls.repeat += 1;
    });

    expect(saveHandled).toBe(false);
    expect(cancelHandled).toBe(false);
    expect(repeatHandled).toBe(false);
    expect(calls).toEqual({ save: 0, cancel: 0, repeat: 0 });
  });

  it("executes callbacks exactly once for left clicks", () => {
    let callCount = 0;

    const handled = runPrimaryMouseDownAction(0, () => {
      callCount += 1;
    });

    expect(handled).toBe(true);
    expect(callCount).toBe(1);
  });
});
