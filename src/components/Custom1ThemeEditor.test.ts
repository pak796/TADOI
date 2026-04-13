import { describe, expect, it } from "bun:test";
import {
  resolveCustom1EditorHexCommitFocus,
  resolveCustom1EditorLeftFocus,
  resolveCustom1EditorRightFocus,
  resolveCustom1EditorTabFocus,
  shouldExitHexToTokenListOnLeft,
  tokenListEditorEntryFocusTarget,
} from "./Custom1ThemeEditor";

describe("custom1 theme editor focus routing", () => {
  it("routes tab from token list into the token editor entry control", () => {
    expect(resolveCustom1EditorTabFocus("tokenList", false)).toBe(
      tokenListEditorEntryFocusTarget(),
    );
  });

  it("routes right-arrow from token list to the same editor entry control as tab", () => {
    expect(resolveCustom1EditorRightFocus("tokenList")).toBe(
      resolveCustom1EditorTabFocus("tokenList", false),
    );
  });

  it("keeps existing tab cycle behavior outside token list", () => {
    expect(resolveCustom1EditorTabFocus("tokenList", true)).toBe("scope");
    expect(resolveCustom1EditorTabFocus("hex", false)).toBe("rgbR");
  });

  it("does not hijack right-arrow focus for non-token-list targets", () => {
    expect(resolveCustom1EditorRightFocus("hex")).toBeNull();
  });

  it("routes left-arrow on hex back to token list", () => {
    expect(resolveCustom1EditorLeftFocus("hex")).toBe("tokenList");
    expect(resolveCustom1EditorLeftFocus("rgbR")).toBeNull();
  });

  it("returns to token list after successful hex commit", () => {
    expect(resolveCustom1EditorHexCommitFocus(true)).toBe("tokenList");
    expect(resolveCustom1EditorHexCommitFocus(false)).toBeNull();
  });

  it("exits hex to token list only at the left boundary with no selection", () => {
    expect(
      shouldExitHexToTokenListOnLeft({
        cursorOffset: 3,
        hasSelection: false,
        leftBoundary: 0,
      }),
    ).toBe(false);
    expect(
      shouldExitHexToTokenListOnLeft({
        cursorOffset: 0,
        hasSelection: true,
        leftBoundary: 0,
      }),
    ).toBe(false);
    expect(
      shouldExitHexToTokenListOnLeft({
        cursorOffset: 0,
        hasSelection: false,
        leftBoundary: 0,
      }),
    ).toBe(true);
  });
});
