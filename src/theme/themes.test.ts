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
    expect(cycleTheme("midnightBlack")).toBe("jester");
    expect(cycleTheme("jester")).toBe("sonora");
    expect(cycleTheme("sonora")).toBe("tigers");
    expect(cycleTheme("tigers")).toBe("tech");
    expect(cycleTheme("tech")).toBe("deuteranopia");
    expect(cycleTheme("deuteranopia")).toBe("protanopia");
    expect(cycleTheme("protanopia")).toBe("tritanopia");
    expect(cycleTheme("tritanopia")).toBe("blueAngels");
    expect(cycleTheme("blueAngels")).toBe("southwest");
    expect(cycleTheme("southwest")).toBe("rams");
    expect(cycleTheme("rams")).toBe("custom1");
    expect(cycleTheme("custom1")).toBe("rotating");
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
      "jester",
      "sonora",
      "tigers",
      "tech",
      "deuteranopia",
      "protanopia",
      "tritanopia",
      "blueAngels",
      "southwest",
      "rams",
      "custom1",
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
      "midnightBlack",
      "jester",
      "sonora",
      "tigers",
      "tech",
      "deuteranopia",
      "protanopia",
      "tritanopia",
      "blueAngels",
      "southwest",
      "rams"
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

  it("defines mardi gras jester palette tokens", () => {
    expect(THEMES.jester).toMatchObject({
      bg: "#12081e",
      panel: "#241138",
      text: "#f4f0ff",
      mutedText: "#c7b8de",
      border: "#5d3f8c",
      accent: "#d8b24a",
      accent2: "#2ea66a",
      ok: "#42c978",
      warn: "#f2c14e",
      danger: "#c94c9b",
      selectionBg: "#6a4bc2",
      selectionText: "#12081e"
    });
  });

  it("defines soft desert sonora palette tokens", () => {
    expect(THEMES.sonora).toMatchObject({
      bg: "#f3e8d7",
      panel: "#eadcc8",
      text: "#3c3228",
      mutedText: "#7b6a58",
      border: "#c7b39b",
      accent: "#c97d5d",
      accent2: "#8ca67b",
      ok: "#6f9b74",
      warn: "#d8a25a",
      danger: "#b75b4f",
      selectionBg: "#d6bfa5",
      selectionText: "#3c3228"
    });
  });

  it("defines lsu tigers purple/gold/white palette tokens", () => {
    expect(THEMES.tigers).toMatchObject({
      bg: "#2f0d57",
      panel: "#4a1f78",
      text: "#ffffff",
      mutedText: "#e9defb",
      border: "#fdd023",
      accent: "#fdd023",
      accent2: "#ffffff",
      ok: "#f6cb3b",
      warn: "#ffde59",
      danger: "#6a32a8",
      selectionBg: "#fdd023",
      selectionText: "#2f0d57"
    });
  });

  it("defines georgia tech inspired palette tokens", () => {
    expect(THEMES.tech).toMatchObject({
      bg: "#002c5f",
      panel: "#003b7a",
      text: "#f7f8fa",
      mutedText: "#c9d3e2",
      border: "#b3a369",
      accent: "#b3a369",
      accent2: "#eaaa00",
      ok: "#c7b479",
      warn: "#eaaa00",
      danger: "#9d822f",
      selectionBg: "#e0cf99",
      selectionText: "#002c5f"
    });
  });

  it("defines deuteranopia palette tokens", () => {
    expect(THEMES.deuteranopia).toMatchObject({
      bg: "#11161d",
      panel: "#1c2430",
      text: "#f1f5f9",
      mutedText: "#9fb0c3",
      border: "#4f6278",
      accent: "#ffb347",
      accent2: "#5bb6ff",
      ok: "#7bc4d6",
      warn: "#ffd166",
      danger: "#b084f5",
      selectionBg: "#2d4761",
      selectionText: "#f1f5f9"
    });
  });

  it("defines protanopia palette tokens", () => {
    expect(THEMES.protanopia).toMatchObject({
      bg: "#101821",
      panel: "#1a2836",
      text: "#f6f8fb",
      mutedText: "#a9bbcd",
      border: "#58708a",
      accent: "#4ecdc4",
      accent2: "#f4c95d",
      ok: "#5ec2b7",
      warn: "#ffd166",
      danger: "#7d6cf0",
      selectionBg: "#2c4f6e",
      selectionText: "#f6f8fb"
    });
  });

  it("defines tritanopia palette tokens", () => {
    expect(THEMES.tritanopia).toMatchObject({
      bg: "#1a1416",
      panel: "#2a1f24",
      text: "#f7f2f4",
      mutedText: "#c6b3bb",
      border: "#8a6c78",
      accent: "#e76f51",
      accent2: "#2a9d8f",
      ok: "#6bcf8c",
      warn: "#f4a261",
      danger: "#d45087",
      selectionBg: "#5a3245",
      selectionText: "#f7f2f4"
    });
  });

  it("keeps new color-blindness themes readable", () => {
    for (const themeId of ["deuteranopia", "protanopia", "tritanopia"] as const) {
      const tokens = THEMES[themeId];
      expect(tokens.text).not.toBe(tokens.bg);
      expect(tokens.mutedText).not.toBe(tokens.bg);
      expect(tokens.selectionText).not.toBe(tokens.selectionBg);
    }
  });

  it("defines blue angels palette tokens", () => {
    expect(THEMES.blueAngels).toMatchObject({
      bg: "#081a35",
      panel: "#102a52",
      text: "#f8fbff",
      mutedText: "#b9c9e6",
      border: "#f2c24f",
      accent: "#f2c24f",
      accent2: "#2f6fd8",
      ok: "#5ca6ff",
      warn: "#ffd56a",
      danger: "#d67a3c",
      selectionBg: "#f2c24f",
      selectionText: "#081a35"
    });
  });

  it("defines southwest palette tokens", () => {
    expect(THEMES.southwest).toMatchObject({
      bg: "#1f2f5a",
      panel: "#2b3f75",
      text: "#f9fbff",
      mutedText: "#c6d2eb",
      border: "#f9b233",
      accent: "#f0523f",
      accent2: "#2e4ea2",
      ok: "#58b0c4",
      warn: "#f9b233",
      danger: "#d63b2e",
      selectionBg: "#f0523f",
      selectionText: "#ffffff"
    });
  });

  it("defines rams palette tokens", () => {
    expect(THEMES.rams).toMatchObject({
      bg: "#003594",
      panel: "#0b4db8",
      text: "#ffffff",
      mutedText: "#d7e3ff",
      border: "#ffd100",
      accent: "#ffd100",
      accent2: "#1e6fd9",
      ok: "#8fd3ff",
      warn: "#ffd54a",
      danger: "#1f4fa3",
      selectionBg: "#ffd100",
      selectionText: "#003594"
    });
  });
});
