import { describe, expect, it } from "bun:test";
import { THEME_ORDER, THEMES, cycleTheme } from "./themes";

describe("theme registry", () => {
  it("cycles through all themes in declared order", () => {
    expect(cycleTheme("default")).toBe("retro");
    expect(cycleTheme("retro")).toBe("highContrast");
    expect(cycleTheme("highContrast")).toBe("neonHacker");
    expect(cycleTheme("neonHacker")).toBe("default");
  });

  it("keeps theme order stable", () => {
    expect(THEME_ORDER).toEqual([
      "default",
      "retro",
      "highContrast",
      "neonHacker"
    ]);
  });

  it("preserves existing default palette values", () => {
    expect(THEMES.default).toMatchObject({
      bg: "#0b0f14",
      panel: "#1a202c",
      text: "#f2f2f2",
      mutedText: "#b0b6bf",
      border: "#3b4049",
      accent: "#f4a259",
      accent2: "#5dade2",
      ok: "#2ecc71",
      warn: "#f1c40f",
      danger: "#e74c3c",
      selectionBg: "#9b59b6",
      selectionText: "#0b0f14"
    });
  });
});
