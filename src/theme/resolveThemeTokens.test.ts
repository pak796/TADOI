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
    logoMode: "default",
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
      },
      textByTheme: {
        retro: {
          global: {
            text: "#0A0A0A"
          },
          objects: {
            taskRow: {
              mutedText: "#ABCDEF"
            }
          }
        }
      }
    }
  };
}

describe("resolveThemeTokens", () => {
  it("returns built-in palette for non-custom themes", () => {
    const resolved = resolveThemeTokens("retro", makeSettings(), { objectId: "taskRow" });
    expect(resolved.text).toBe("#0A0A0A");
    expect(resolved.mutedText).toBe("#ABCDEF");
    expect(resolved.bg).toBe(THEMES.retro.bg);
  });

  it("falls back to built-in palette when no built-in text overrides exist", () => {
    const settings = makeSettings();
    settings.customThemes = {
      custom1: settings.customThemes?.custom1
    };
    const resolved = resolveThemeTokens("retro", settings, { objectId: "taskRow" });
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

  it("uses built-in text draft over persisted values", () => {
    const settings = makeSettings();
    const resolved = resolveThemeTokens("retro", settings, {
      objectId: "taskRow",
      builtInTextDraft: {
        retro: {
          global: {
            text: "#112233"
          },
          objects: {
            taskRow: {
              mutedText: "#445566"
            }
          }
        }
      }
    });
    expect(resolved.text).toBe("#112233");
    expect(resolved.mutedText).toBe("#445566");
    expect(resolved.bg).toBe(THEMES.retro.bg);
  });
});
