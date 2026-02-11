import { describe, expect, it } from "bun:test";
import {
  clampRgbChannel,
  hexToRgb,
  normalizeHexColor,
  rgbToHex,
  stepRgbChannel
} from "./custom1ColorUtils";

describe("custom1ColorUtils", () => {
  it("normalizes valid hex values and rejects invalid inputs", () => {
    expect(normalizeHexColor("#a1b2c3")).toBe("#A1B2C3");
    expect(normalizeHexColor("A1B2C3")).toBeNull();
    expect(normalizeHexColor("#ABC")).toBeNull();
    expect(normalizeHexColor("#GG1122")).toBeNull();
  });

  it("converts hex to rgb and back", () => {
    const rgb = hexToRgb("#A1B2C3");
    expect(rgb).toEqual({ r: 161, g: 178, b: 195 });
    expect(rgbToHex(rgb as { r: number; g: number; b: number })).toBe("#A1B2C3");
  });

  it("clamps and steps rgb channels", () => {
    expect(clampRgbChannel(-5)).toBe(0);
    expect(clampRgbChannel(300)).toBe(255);
    expect(stepRgbChannel(10, 1)).toBe(11);
    expect(stepRgbChannel(10, -20)).toBe(0);
    expect(stepRgbChannel(250, 10)).toBe(255);
  });
});
