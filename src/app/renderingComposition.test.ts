import { describe, expect, it } from "bun:test";
import {
  buildPriorityTickerSegments,
  buildTagTickerSegments,
  fitLineToWidth,
  pickHelpCloseButtonLabel,
  truncateToWidth,
} from "./renderingComposition";

describe("renderingComposition helpers", () => {
  it("truncates and pads lines deterministically", () => {
    expect(truncateToWidth("abcdef", 4)).toBe("a...");
    expect(fitLineToWidth("abc", 6)).toBe("abc   ");
  });

  it("selects close button labels by width budget", () => {
    expect(pickHelpCloseButtonLabel(20)).toBe("[Esc] Close");
    expect(pickHelpCloseButtonLabel(7)).toBe("Close");
    expect(pickHelpCloseButtonLabel(3)).toBe("X");
    expect(pickHelpCloseButtonLabel(1)).toBe("");
  });

  it("builds bounded ticker segments", () => {
    const tagSegments = buildTagTickerSegments(
      [
        { tag: "work", total: 5, dueThisWeek: 2 },
        { tag: "home", total: 2, dueThisWeek: 1 },
      ],
      24,
    );
    expect(tagSegments.length).toBeGreaterThan(0);

    const prioritySegments = buildPriorityTickerSegments(
      [
        { priorityTag: "p1", displayPriority: "P1", total: 3 },
        { priorityTag: "p2", displayPriority: "P2", total: 2 },
      ],
      24,
    );
    expect(prioritySegments.length).toBeGreaterThan(0);
  });
});
