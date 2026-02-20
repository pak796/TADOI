import { describe, expect, it } from "bun:test";
import { decideEditTargetSwitch } from "./editTargetSwitchFlow";

describe("decideEditTargetSwitch", () => {
  it("returns switch_now for clean draft targeting a different task", () => {
    expect(
      decideEditTargetSwitch({
        fromTaskId: "task-a",
        toTaskId: "task-b",
        isDirty: false,
        hasActiveModal: false
      })
    ).toEqual({
      type: "switch_now",
      toTaskId: "task-b"
    });
  });

  it("returns prompt for dirty draft targeting a different task", () => {
    expect(
      decideEditTargetSwitch({
        fromTaskId: "task-a",
        toTaskId: "task-b",
        isDirty: true,
        hasActiveModal: false
      })
    ).toEqual({
      type: "prompt",
      fromTaskId: "task-a",
      toTaskId: "task-b"
    });
  });

  it("returns ignore for same target", () => {
    expect(
      decideEditTargetSwitch({
        fromTaskId: "task-a",
        toTaskId: "task-a",
        isDirty: true,
        hasActiveModal: false
      })
    ).toEqual({ type: "ignore" });
  });

  it("returns ignore while a modal is active", () => {
    expect(
      decideEditTargetSwitch({
        fromTaskId: "task-a",
        toTaskId: "task-b",
        isDirty: true,
        hasActiveModal: true
      })
    ).toEqual({ type: "ignore" });
  });
});
