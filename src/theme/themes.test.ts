import { describe, expect, it } from "bun:test";
import { ROTATING_THEME_ORDER, THEME_ORDER, THEMES, cycleTheme } from "./themes";

describe("theme registry", () => {
  it("cycles through all themes in declared order", () => {
    expect(cycleTheme("default")).toBe("retro");
    expect(cycleTheme("retro")).toBe("highContrast");
    expect(cycleTheme("highContrast")).toBe("neonHacker");
    expect(cycleTheme("neonHacker")).toBe("lightSlate");
    expect(cycleTheme("lightSlate")).toBe("paperWhite");
    expect(cycleTheme("paperWhite")).toBe("midnightBlack");
    expect(cycleTheme("midnightBlack")).toBe("rotating");
    expect(cycleTheme("rotating")).toBe("default");
  });

  it("keeps theme order stable", () => {
    expect(THEME_ORDER).toEqual([
      "default",
      "retro",
      "highContrast",
      "neonHacker",
      "lightSlate",
      "paperWhite",
      "midnightBlack",
      "rotating"
    ]);
  });

  it("keeps rotating theme order limited to concrete palettes", () => {
    expect(ROTATING_THEME_ORDER).toEqual([
      "default",
      "retro",
      "highContrast",
      "neonHacker",
      "lightSlate",
      "paperWhite",
      "midnightBlack"
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

  it("avoids pure white text tokens in high contrast theme", () => {
    expect(THEMES.highContrast.text).not.toBe("#ffffff");
    expect(THEMES.highContrast.mutedText).not.toBe("#ffffff");
  });

  it("defines muted/sophisticated lightSlate palette tokens", () => {
    expect(THEMES.lightSlate).toMatchObject({
      bg: "#e7ecef",
      panel: "#d8e0e4",
      text: "#1f2933",
      mutedText: "#52606d",
      border: "#9aa5b1",
      accent: "#5c6f7b",
      accent2: "#3e5c76",
      ok: "#4d8b72",
      warn: "#b08968",
      danger: "#a44a3f",
      selectionBg: "#b8c7cf",
      selectionText: "#1f2933"
    });
  });

  it("defines muted/sophisticated paperWhite palette tokens", () => {
    expect(THEMES.paperWhite).toMatchObject({
      bg: "#f8f7f3",
      panel: "#efede7",
      text: "#1d2430",
      mutedText: "#5f6873",
      border: "#c6c0b3",
      accent: "#8a735b",
      accent2: "#4f6d8a",
      ok: "#4f7d63",
      warn: "#b58b4c",
      danger: "#9f4d42",
      selectionBg: "#d9d4c8",
      selectionText: "#1d2430"
    });
  });

  it("defines muted/sophisticated midnightBlack palette tokens", () => {
    expect(THEMES.midnightBlack).toMatchObject({
      bg: "#040507",
      panel: "#0c1118",
      text: "#d7dde7",
      mutedText: "#8a93a3",
      border: "#273142",
      accent: "#5d6b84",
      accent2: "#4f7b99",
      ok: "#3f7f68",
      warn: "#a88245",
      danger: "#8f3f45",
      selectionBg: "#1a2431",
      selectionText: "#d7dde7"
    });
  });
});
