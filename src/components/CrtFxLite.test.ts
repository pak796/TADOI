import { describe, expect, it } from "bun:test";
import { CrtFxLite, resolveCrtFxColor } from "./CrtFxLite";

describe("CrtFxLite", () => {
  it("returns null (non-overwriting compatibility component)", () => {
    const result = CrtFxLite({
      enabled: true,
      height: 20,
      baseColor: "#0B130F",
      tick: 0,
      color: "green",
      preset: "normal"
    });
    expect(result).toBeNull();
  });
});

describe("resolveCrtFxColor", () => {
  it("returns base color when disabled", () => {
    const color = resolveCrtFxColor({
      baseColor: "#202020",
      enabled: false,
      preset: "normal",
      color: "green",
      tick: 0,
      role: "panel"
    });
    expect(color).toBe("#202020");
  });

  it("applies stronger tint as preset intensity increases", () => {
    const subtle = resolveCrtFxColor({
      baseColor: "#202020",
      enabled: true,
      preset: "subtle",
      color: "green",
      tick: 1,
      role: "panel"
    });
    const normal = resolveCrtFxColor({
      baseColor: "#202020",
      enabled: true,
      preset: "normal",
      color: "green",
      tick: 1,
      role: "panel"
    });
    const strong = resolveCrtFxColor({
      baseColor: "#202020",
      enabled: true,
      preset: "strong",
      color: "green",
      tick: 1,
      role: "panel"
    });

    expect(subtle).not.toBe("#202020");
    expect(normal).not.toBe(subtle);
    expect(strong).not.toBe(normal);
  });

  it("supports green and amber color modes", () => {
    const green = resolveCrtFxColor({
      enabled: true,
      baseColor: "#202020",
      preset: "normal",
      color: "green",
      tick: 1,
      role: "panel"
    });
    const amber = resolveCrtFxColor({
      enabled: true,
      baseColor: "#202020",
      preset: "normal",
      color: "amber",
      tick: 1,
      role: "panel"
    });

    expect(green).not.toBe(amber);
  });

  it("applies flicker on configured cadence", () => {
    const steady = resolveCrtFxColor({
      enabled: true,
      baseColor: "#202020",
      preset: "normal",
      color: "green",
      tick: 1,
      role: "panel"
    });
    const flicker = resolveCrtFxColor({
      enabled: true,
      baseColor: "#202020",
      preset: "normal",
      color: "green",
      tick: 12,
      role: "panel"
    });
    expect(flicker).not.toBe(steady);
  });
});
