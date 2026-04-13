import { describe, expect, it } from "bun:test";
import {
  computeContrastRatio,
  validateBuiltInTextContrast,
  validateCustomThemeContrast,
  validateThemeTokensContrast,
} from "./contrastValidation";
import { THEMES } from "./themes";

describe("theme contrast validation", () => {
  it("computes expected contrast ratios", () => {
    expect(computeContrastRatio("#FFFFFF", "#000000")).toBeGreaterThan(20.9);
    expect(computeContrastRatio("#777777", "#777777")).toBe(1);
  });

  it("passes unchanged baseline tokens (regression-aware gate)", () => {
    const result = validateThemeTokensContrast(
      THEMES.default,
      "default",
      THEMES.default,
    );
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("blocks regressions relative to baseline contrast", () => {
    const result = validateThemeTokensContrast(
      {
        ...THEMES.default,
        selectionText: "#333333",
      },
      "default",
      THEMES.default,
    );
    expect(result.ok).toBe(false);
    expect(
      result.issues.some((issue) => issue.label.includes("selection text")),
    ).toBe(true);
  });

  it("fails clearly for unreadable custom token sets", () => {
    const result = validateThemeTokensContrast(
      {
        ...THEMES.default,
        text: "#777777",
        mutedText: "#777777",
        bg: "#777777",
        panel: "#777777",
        selectionBg: "#777777",
        selectionText: "#777777",
      },
      "global",
    );
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("validates custom theme global and per-object overrides", () => {
    const result = validateCustomThemeContrast({
      global: THEMES.default,
      baselineGlobal: THEMES.default,
      objects: {
        taskRow: {
          text: "#777777",
          bg: "#777777",
        },
      },
    });
    expect(result.ok).toBe(false);
    expect(
      result.issues.some((issue) => issue.scope === "object:taskRow"),
    ).toBe(true);
  });

  it("validates built-in text tuning against base theme tokens", () => {
    const result = validateBuiltInTextContrast({
      themeId: "retro",
      baselineGlobal: {},
      global: {
        text: "#777777",
        mutedText: "#777777",
        selectionText: "#777777",
      },
    });
    expect(result.ok).toBe(false);
    expect(
      result.issues.some((issue) => issue.scope.startsWith("theme:retro")),
    ).toBe(true);
  });
});
