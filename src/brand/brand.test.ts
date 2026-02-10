import { describe, expect, it } from "bun:test";
import {
  APP_NAME,
  APP_TAGLINE,
  ASCII_LOGO,
  CLI_NAME,
  getAsciiLogoLines,
  getHeaderLogoVariant
} from "./brand";

describe("brand constants", () => {
  it("exposes renamed product identity", () => {
    expect(APP_NAME).toBe("TADOI");
    expect(APP_TAGLINE).toBe("Terminal Accessible Digital Organization Interface");
    expect(CLI_NAME).toBe("tadoi");
  });

  it("provides non-empty logo variants", () => {
    expect(ASCII_LOGO.FULL.length).toBeGreaterThan(0);
    expect(ASCII_LOGO.COMPACT.length).toBeGreaterThan(0);
    expect(ASCII_LOGO.MICRO.length).toBeGreaterThan(0);
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
});
