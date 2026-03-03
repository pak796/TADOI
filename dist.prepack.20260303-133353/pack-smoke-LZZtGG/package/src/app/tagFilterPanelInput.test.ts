import { describe, expect, it } from "bun:test";
import {
  addTagToTagFilterDraftBucket,
  resolveTagFilterDraftForApplyFromInput,
  resolveTagFilterPanelHotkeyAction
} from "./tagFilterPanelInput";

describe("tag filter panel input behavior", () => {
  it("adds typed tag on Enter to the active bucket", () => {
    const action = resolveTagFilterPanelHotkeyAction({
      key: { name: "enter", sequence: "\r", ctrl: false, shift: false },
      hasInlineSuggestion: false,
      inputValue: "#work"
    });
    expect(action).toEqual({ type: "addInputCandidate" });

    const nextDraft = addTagToTagFilterDraftBucket(undefined, "#work", "all");
    expect(nextDraft).toEqual({ all: ["work"], any: undefined, none: undefined });
  });

  it("applies with typed candidate on Ctrl+Enter", () => {
    const action = resolveTagFilterPanelHotkeyAction({
      key: { name: "enter", sequence: "\r", ctrl: true, shift: false },
      hasInlineSuggestion: false,
      inputValue: "#work"
    });
    expect(action).toEqual({ type: "applyWithInputCandidate" });

    const nextDraft = resolveTagFilterDraftForApplyFromInput({
      draft: undefined,
      includeInputCandidate: true,
      inputValue: "#work",
      inlineSuggestion: null,
      bucket: "all"
    });
    expect(nextDraft).toEqual({ all: ["work"], any: undefined, none: undefined });
  });

  it("applies with typed candidate on Ctrl+S", () => {
    const action = resolveTagFilterPanelHotkeyAction({
      key: { name: "s", sequence: "s", ctrl: true, shift: false },
      hasInlineSuggestion: false,
      inputValue: "#ops"
    });
    expect(action).toEqual({ type: "applyWithInputCandidate" });

    const nextDraft = resolveTagFilterDraftForApplyFromInput({
      draft: { all: ["work"] },
      includeInputCandidate: true,
      inputValue: "#ops",
      inlineSuggestion: null,
      bucket: "any"
    });
    expect(nextDraft).toEqual({ all: ["work"], any: ["ops"], none: undefined });
  });

  it("does not add empty input on Enter", () => {
    const action = resolveTagFilterPanelHotkeyAction({
      key: { name: "enter", sequence: "\r", ctrl: false, shift: false },
      hasInlineSuggestion: false,
      inputValue: "   "
    });
    expect(action).toEqual({ type: "addInputCandidate" });

    const nextDraft = addTagToTagFilterDraftBucket(undefined, "   ", "all");
    expect(nextDraft).toBeUndefined();
  });

  it("does not add priority tokens to a boolean tag filter bucket", () => {
    const nextDraft = addTagToTagFilterDraftBucket(undefined, "#p3", "all");
    expect(nextDraft).toBeUndefined();
  });

  it("maps backspace-on-empty to remove-last-tag action", () => {
    const removeAction = resolveTagFilterPanelHotkeyAction({
      key: { name: "backspace", sequence: "", ctrl: false, shift: false },
      hasInlineSuggestion: false,
      inputValue: ""
    });
    expect(removeAction).toEqual({ type: "removeLastDraftTag" });

    const noRemoveAction = resolveTagFilterPanelHotkeyAction({
      key: { name: "backspace", sequence: "", ctrl: false, shift: false },
      hasInlineSuggestion: false,
      inputValue: "  "
    });
    expect(noRemoveAction).toBeNull();

    const noRemoveActionWithText = resolveTagFilterPanelHotkeyAction({
      key: { name: "backspace", sequence: "", ctrl: false, shift: false },
      hasInlineSuggestion: false,
      inputValue: "#work"
    });
    expect(noRemoveActionWithText).toBeNull();
  });

  it("keeps Esc/Tab hotkey behavior", () => {
    expect(
      resolveTagFilterPanelHotkeyAction({
        key: { name: "escape", sequence: "", ctrl: false, shift: false },
        hasInlineSuggestion: false,
        inputValue: ""
      })
    ).toEqual({ type: "closePanel" });

    expect(
      resolveTagFilterPanelHotkeyAction({
        key: { name: "tab", sequence: "\t", ctrl: false, shift: false },
        hasInlineSuggestion: false,
        inputValue: ""
      })
    ).toEqual({ type: "cycleBucket", step: 1 });

    expect(
      resolveTagFilterPanelHotkeyAction({
        key: { name: "tab", sequence: "\t", ctrl: false, shift: true },
        hasInlineSuggestion: false,
        inputValue: ""
      })
    ).toEqual({ type: "cycleBucket", step: -1 });
  });

  it("does not intercept numeric typing keys 1/2/3 when input is empty", () => {
    expect(
      resolveTagFilterPanelHotkeyAction({
        key: { name: "1", sequence: "1", ctrl: false, shift: false },
        hasInlineSuggestion: false,
        inputValue: ""
      })
    ).toBeNull();

    expect(
      resolveTagFilterPanelHotkeyAction({
        key: { name: "2", sequence: "2", ctrl: false, shift: false },
        hasInlineSuggestion: false,
        inputValue: ""
      })
    ).toBeNull();

    expect(
      resolveTagFilterPanelHotkeyAction({
        key: { name: "3", sequence: "3", ctrl: false, shift: false },
        hasInlineSuggestion: false,
        inputValue: ""
      })
    ).toBeNull();
  });

  it("does not intercept numeric typing keys 1/2/3 when input is non-empty", () => {
    expect(
      resolveTagFilterPanelHotkeyAction({
        key: { name: "1", sequence: "1", ctrl: false, shift: false },
        hasInlineSuggestion: false,
        inputValue: "abc"
      })
    ).toBeNull();
    expect(
      resolveTagFilterPanelHotkeyAction({
        key: { name: "2", sequence: "2", ctrl: false, shift: false },
        hasInlineSuggestion: false,
        inputValue: "abc"
      })
    ).toBeNull();
    expect(
      resolveTagFilterPanelHotkeyAction({
        key: { name: "3", sequence: "3", ctrl: false, shift: false },
        hasInlineSuggestion: false,
        inputValue: "abc"
      })
    ).toBeNull();
  });

  it("cycles buckets with arrows when input is empty", () => {
    expect(
      resolveTagFilterPanelHotkeyAction({
        key: { name: "left", sequence: "", ctrl: false, shift: false },
        hasInlineSuggestion: false,
        inputValue: ""
      })
    ).toEqual({ type: "cycleBucket", step: -1 });

    expect(
      resolveTagFilterPanelHotkeyAction({
        key: { name: "up", sequence: "", ctrl: false, shift: false },
        hasInlineSuggestion: false,
        inputValue: ""
      })
    ).toEqual({ type: "cycleBucket", step: -1 });

    expect(
      resolveTagFilterPanelHotkeyAction({
        key: { name: "down", sequence: "", ctrl: false, shift: false },
        hasInlineSuggestion: false,
        inputValue: ""
      })
    ).toEqual({ type: "cycleBucket", step: 1 });

    expect(
      resolveTagFilterPanelHotkeyAction({
        key: { name: "right", sequence: "", ctrl: false, shift: false },
        hasInlineSuggestion: false,
        inputValue: ""
      })
    ).toEqual({ type: "cycleBucket", step: 1 });
  });

  it("does not intercept arrows when input is non-empty unless right has suggestion", () => {
    expect(
      resolveTagFilterPanelHotkeyAction({
        key: { name: "left", sequence: "", ctrl: false, shift: false },
        hasInlineSuggestion: false,
        inputValue: "abc"
      })
    ).toBeNull();

    expect(
      resolveTagFilterPanelHotkeyAction({
        key: { name: "up", sequence: "", ctrl: false, shift: false },
        hasInlineSuggestion: false,
        inputValue: "abc"
      })
    ).toBeNull();

    expect(
      resolveTagFilterPanelHotkeyAction({
        key: { name: "down", sequence: "", ctrl: false, shift: false },
        hasInlineSuggestion: false,
        inputValue: "abc"
      })
    ).toBeNull();

    expect(
      resolveTagFilterPanelHotkeyAction({
        key: { name: "right", sequence: "", ctrl: false, shift: false },
        hasInlineSuggestion: false,
        inputValue: "abc"
      })
    ).toBeNull();

    expect(
      resolveTagFilterPanelHotkeyAction({
        key: { name: "right", sequence: "", ctrl: false, shift: false },
        hasInlineSuggestion: true,
        inputValue: "abc"
      })
    ).toEqual({ type: "acceptInlineSuggestion" });
  });

  it("prioritizes right-arrow inline suggestion accept over empty-input arrow cycling", () => {
    expect(
      resolveTagFilterPanelHotkeyAction({
        key: { name: "right", sequence: "", ctrl: false, shift: false },
        hasInlineSuggestion: true,
        inputValue: ""
      })
    ).toEqual({ type: "acceptInlineSuggestion" });
  });
});
