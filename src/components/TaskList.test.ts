import { describe, expect, it } from "bun:test";
import { shouldShowScrollbar } from "./TaskList";

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
