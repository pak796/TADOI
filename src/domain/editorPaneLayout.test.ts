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

  it("hides recurrence rows when repeat mode is off", () => {
    const off = estimateEditorContentLines({ repeatMode: "off" });
    const daily = estimateEditorContentLines({
      repeatMode: "daily",
      repeatEndMode: "never"
    });
    const weekly = estimateEditorContentLines({
      repeatMode: "weekly",
      repeatEndMode: "never"
    });
    const monthly = estimateEditorContentLines({
      repeatMode: "monthly",
      repeatEndMode: "never"
    });
    const custom = estimateEditorContentLines({
      repeatMode: "custom",
      repeatEndMode: "never"
    });

    expect(daily).toBeGreaterThan(off);
    expect(weekly).toBeGreaterThan(daily);
    expect(monthly).toBeGreaterThan(daily);
    expect(custom).toBeGreaterThan(off);
    expect(custom).toBeLessThan(weekly);
  });

  it("only adds one end-condition row based on repeat end mode", () => {
    const neverLines = estimateEditorContentLines({
      repeatMode: "daily",
      repeatEndMode: "never"
    });
    const untilLines = estimateEditorContentLines({
      repeatMode: "daily",
      repeatEndMode: "until"
    });
    const countLines = estimateEditorContentLines({
      repeatMode: "daily",
      repeatEndMode: "count"
    });
    expect(untilLines).toBeGreaterThan(neverLines);
    expect(countLines).toBe(untilLines);
  });

  it("maps focus anchors in top-to-bottom order", () => {
    const title = getEditorFocusAnchorLine("title", { repeatMode: "weekly" });
    const due = getEditorFocusAnchorLine("due", { repeatMode: "weekly" });
    const repeatMode = getEditorFocusAnchorLine("repeat_mode", { repeatMode: "weekly" });
    const repeatWeekdays = getEditorFocusAnchorLine("repeat_weekdays", {
      repeatMode: "weekly"
    });
    const tags = getEditorFocusAnchorLine("tags", { repeatMode: "weekly" });
    const notes = getEditorFocusAnchorLine("notes", { repeatMode: "weekly" });

    expect(title).toBeLessThan(due);
    expect(due).toBeLessThan(repeatMode);
    expect(repeatMode).toBeLessThan(repeatWeekdays);
    expect(repeatWeekdays).toBeLessThan(tags);
    expect(tags).toBeLessThan(notes);
  });

  it("anchors hidden recurrence focuses to repeat mode or nearest visible control", () => {
    const offRepeatModeAnchor = getEditorFocusAnchorLine("repeat_mode", {
      repeatMode: "off"
    });
    const offWeekdaysAnchor = getEditorFocusAnchorLine("repeat_weekdays", {
      repeatMode: "off"
    });
    expect(offWeekdaysAnchor).toBe(offRepeatModeAnchor);

    const dailyIntervalAnchor = getEditorFocusAnchorLine("repeat_interval", {
      repeatMode: "daily",
      repeatEndMode: "never"
    });
    const dailyWeekdaysAnchor = getEditorFocusAnchorLine("repeat_weekdays", {
      repeatMode: "daily",
      repeatEndMode: "never"
    });
    expect(dailyWeekdaysAnchor).toBe(dailyIntervalAnchor);

    const untilAnchor = getEditorFocusAnchorLine("repeat_until", {
      repeatMode: "daily",
      repeatEndMode: "until"
    });
    const repeatEndAnchor = getEditorFocusAnchorLine("repeat_end_mode", {
      repeatMode: "daily",
      repeatEndMode: "until"
    });
    expect(untilAnchor).toBeGreaterThan(repeatEndAnchor);
  });

  it("detects overflow based on content region height", () => {
    const estimated = estimateEditorContentLines();
    expect(hasEditorOverflow(12, estimated)).toBe(true);
    expect(hasEditorOverflow(80, estimated)).toBe(false);
  });
});
