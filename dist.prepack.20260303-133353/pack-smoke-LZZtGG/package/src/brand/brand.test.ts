import { describe, expect, it } from "bun:test";
import {
  APP_NAME,
  APP_TAGLINE,
  ASCII_LOGO,
  CLI_NAME,
  LOGO_MAX_WIDTH,
  LOGO_VARIANT_LABELS,
  LOGO_VARIANTS,
  PRODUCT_NAME,
  PRODUCT_NAME_TM,
  ROTATING_LOGO_ORDER,
  TRADEMARK_NOTICE,
  TRADEMARK_OWNER,
  formatLogoModeLabel,
  getAsciiLogoLines,
  getHeaderLogoVariant
} from "./brand";

describe("brand constants", () => {
  it("exposes renamed product identity", () => {
    expect(PRODUCT_NAME).toBe("TADOI");
    expect(PRODUCT_NAME_TM).toBe("TADOI™");
    expect(APP_NAME).toBe("TADOI");
    expect(APP_TAGLINE).toBe("Terminal Accessible Digital Organization Interface");
    expect(CLI_NAME).toBe("tadoi");
    expect(TRADEMARK_OWNER).toBe("<OWNER>");
    expect(TRADEMARK_NOTICE).toBe(
      "TADOI™ is a trademark of <OWNER>. Other names may be trademarks of their respective owners."
    );
  });

  it("provides non-empty logo variants", () => {
    expect(ASCII_LOGO.FULL.length).toBeGreaterThan(0);
    expect(ASCII_LOGO.COMPACT.length).toBeGreaterThan(0);
    expect(ASCII_LOGO.MICRO.length).toBeGreaterThan(0);
    expect(Object.keys(LOGO_VARIANTS)).toHaveLength(12);
    for (const lines of Object.values(LOGO_VARIANTS)) {
      expect(lines.length).toBeGreaterThan(0);
    }
  });
});

describe("brand logo rendering helpers", () => {
  it("selects width-based header logo variants", () => {
    expect(getHeaderLogoVariant(140)).toBe("FULL");
    expect(getHeaderLogoVariant(100)).toBe("COMPACT");
    expect(getHeaderLogoVariant(80)).toBe("MICRO");
  });

  it("returns logo lines for a variant", () => {
    expect(getAsciiLogoLines("MICRO")).toEqual(["[TADOI]"]);
  });

  it("keeps canonical default logo unchanged", () => {
    expect(LOGO_VARIANTS.default).toEqual(getAsciiLogoLines("FULL"));
  });

  it("keeps all logo registry lines within max width", () => {
    for (const variantLines of Object.values(LOGO_VARIANTS)) {
      for (const line of variantLines) {
        expect(line.length).toBeLessThanOrEqual(LOGO_MAX_WIDTH);
      }
    }
  });

  it("keeps all logo registry variants within max height", () => {
    for (const variantLines of Object.values(LOGO_VARIANTS)) {
      expect(variantLines.length).toBeLessThanOrEqual(7);
    }
  });

  it("uses the full curated rotation order", () => {
    expect(ROTATING_LOGO_ORDER).toEqual([
      "default",
      "alternate32",
      "alternate_slash32",
      "alternate_blocks32",
      "taag_slant32",
      "taag_rectangles32",
      "taag_lcd32",
      "taag_puffy32",
      "taag_bulbhead32",
      "taag_braced32",
      "taag_double32",
      "taag_small32"
    ]);
  });

  it("keeps blocks logo top row non-blank", () => {
    expect(LOGO_VARIANTS.alternate_blocks32[0].trim().length).toBeGreaterThan(0);
  });

  it("provides labels for each logo mode including rotate", () => {
    for (const variantId of Object.keys(LOGO_VARIANTS)) {
      const typedVariant = variantId as keyof typeof LOGO_VARIANT_LABELS;
      expect(LOGO_VARIANT_LABELS[typedVariant].trim().length).toBeGreaterThan(0);
      expect(formatLogoModeLabel(typedVariant).trim().length).toBeGreaterThan(0);
    }
    expect(formatLogoModeLabel("rotate")).toBe("Rotate");
  });
});
