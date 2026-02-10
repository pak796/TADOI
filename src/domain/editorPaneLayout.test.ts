import { describe, expect, it } from "bun:test";
import {
  EDITOR_FOOTER_HEIGHT,
  estimateEditorContentLines,
  getEditorFocusAnchorLine,
  getEditorViewportHeights,
  hasEditorOverflow
} from "./editorPaneLayout";

describe("editorPaneLayout", () => {
  it("splits editor viewport into content and footer regions", () => {
    const heights = getEditorViewportHeights(20);
    expect(heights).toEqual({
      contentHeight: 20 - EDITOR_FOOTER_HEIGHT,
      footerHeight: EDITOR_FOOTER_HEIGHT
    });
  });

  it("keeps at least one content row on very small heights", () => {
    expect(getEditorViewportHeights(1)).toEqual({ contentHeight: 1, footerHeight: 0 });
    expect(getEditorViewportHeights(2)).toEqual({ contentHeight: 1, footerHeight: 1 });
  });

  it("estimates larger content when optional hint rows are visible", () => {
    const baseline = estimateEditorContentLines();
    const withHints = estimateEditorContentLines({
      hasDueSuggestion: true,
      hasTimeSuggestion: true,
      hasTagSuggestion: true
    });
    expect(withHints).toBeGreaterThan(baseline);
  });

  it("maps focus anchors in top-to-bottom order", () => {
    const title = getEditorFocusAnchorLine("title");
    const due = getEditorFocusAnchorLine("due");
    const repeatMode = getEditorFocusAnchorLine("repeat_mode");
    const repeatCustom = getEditorFocusAnchorLine("repeat_custom");
    const tags = getEditorFocusAnchorLine("tags");
    const notes = getEditorFocusAnchorLine("notes");

    expect(title).toBeLessThan(due);
    expect(due).toBeLessThan(repeatMode);
    expect(repeatMode).toBeLessThan(repeatCustom);
    expect(repeatCustom).toBeLessThan(tags);
    expect(tags).toBeLessThan(notes);
  });

  it("detects overflow based on content region height", () => {
    const estimated = estimateEditorContentLines();
    expect(hasEditorOverflow(12, estimated)).toBe(true);
    expect(hasEditorOverflow(80, estimated)).toBe(false);
  });
});
