import { describe, expect, it } from "bun:test";
import {
  resolveBuiltInTextEditorHexCommitFocus,
  resolveBuiltInTextEditorLeftFocus,
  resolveBuiltInTextEditorRightFocus,
  resolveBuiltInTextEditorTabFocus,
  shouldExitBuiltInHexToTokenListOnLeft,
  tokenListTextEditorEntryFocusTarget,
} from "./BuiltInThemeTextEditor";

describe("built-in text editor focus routing", () => {
  it("routes tab from token list into the editor entry control", () => {
    expect(resolveBuiltInTextEditorTabFocus("tokenList", false)).toBe(
      tokenListTextEditorEntryFocusTarget(),
    );
  });

  it("routes right-arrow from token list to the same editor entry control as tab", () => {
    expect(resolveBuiltInTextEditorRightFocus("tokenList")).toBe(
      resolveBuiltInTextEditorTabFocus("tokenList", false),
    );
  });

  it("keeps existing tab cycle behavior outside token list", () => {
    expect(resolveBuiltInTextEditorTabFocus("tokenList", true)).toBe("scope");
    expect(resolveBuiltInTextEditorTabFocus("hex", false)).toBe("rgbR");
  });

  it("does not hijack right-arrow focus for non-token-list targets", () => {
    expect(resolveBuiltInTextEditorRightFocus("hex")).toBeNull();
  });

  it("routes left-arrow on hex back to token list", () => {
    expect(resolveBuiltInTextEditorLeftFocus("hex")).toBe("tokenList");
    expect(resolveBuiltInTextEditorLeftFocus("rgbR")).toBeNull();
  });

  it("returns to token list after successful hex commit", () => {
    expect(resolveBuiltInTextEditorHexCommitFocus(true)).toBe("tokenList");
    expect(resolveBuiltInTextEditorHexCommitFocus(false)).toBeNull();
  });

  it("exits hex to token list only at the left boundary with no selection", () => {
    expect(
      shouldExitBuiltInHexToTokenListOnLeft({
        cursorOffset: 3,
        hasSelection: false,
        leftBoundary: 0,
      }),
    ).toBe(false);
    expect(
      shouldExitBuiltInHexToTokenListOnLeft({
        cursorOffset: 0,
        hasSelection: true,
        leftBoundary: 0,
      }),
    ).toBe(false);
    expect(
      shouldExitBuiltInHexToTokenListOnLeft({
        cursorOffset: 0,
        hasSelection: false,
        leftBoundary: 0,
      }),
    ).toBe(true);
  });
});
