import { describe, expect, it } from "bun:test";
import { resolveThemeTokens, THEMES, type ThemeTokens } from "./themes";
import type { TadoiSettings } from "../settings/settings";

const CUSTOM_GLOBAL: ThemeTokens = {
  bg: "#101010",
  panel: "#202020",
  text: "#EFEFEF",
  mutedText: "#AAAAAA",
  border: "#333333",
  accent: "#FF7700",
  accent2: "#0099FF",
  ok: "#22CC66",
  warn: "#DDAA00",
  danger: "#DD3344",
  selectionBg: "#8844CC",
  selectionText: "#111111"
};

function makeSettings(): TadoiSettings {
  return {
    themeId: "custom1",
    flashMode: "slow",
    notifications: {
      enabled: true,
      inAppOverdueBanner: true,
      terminalBellOnOverdue: false,
      bannerDurationMs: 5000,
      bellCooldownMs: 2000
    },
    customThemes: {
      custom1: {
        global: { ...CUSTOM_GLOBAL },
        objects: {
          taskRow: {
            text: "#00FF00"
          }
        }
      }
    }
  };
}

describe("resolveThemeTokens", () => {
  it("returns built-in palette for non-custom themes", () => {
    const resolved = resolveThemeTokens("retro", makeSettings(), { objectId: "taskRow" });
    expect(resolved).toEqual(THEMES.retro);
  });

  it("resolves custom1 global palette", () => {
    const resolved = resolveThemeTokens("custom1", makeSettings());
    expect(resolved).toEqual(CUSTOM_GLOBAL);
  });

  it("layers object override on top of custom1 global", () => {
    const resolved = resolveThemeTokens("custom1", makeSettings(), { objectId: "taskRow" });
    expect(resolved.text).toBe("#00FF00");
    expect(resolved.bg).toBe(CUSTOM_GLOBAL.bg);
  });

  it("uses draft global and object override before persisted values", () => {
    const settings = makeSettings();
    const resolved = resolveThemeTokens("custom1", settings, {
      objectId: "taskRow",
      draft: {
        global: {
          ...CUSTOM_GLOBAL,
          panel: "#ABCDEF"
        },
        objects: {
          taskRow: {
            text: "#123456"
          }
        }
      }
    });
    expect(resolved.panel).toBe("#ABCDEF");
    expect(resolved.text).toBe("#123456");
  });
});
