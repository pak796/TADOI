import { afterEach, describe, expect, it } from "bun:test";
import { THEME_OBJECT_IDS, type TadoiSettings, type ThemeObjectId } from "../settings/settings";
import { applyTheme, applyThemeWithSettings, themeForObject } from "./theme";

const HEX_COLOR_RE = /^#[0-9A-F]{6}$/;

function makeSettingsWithObjectOverrides(): TadoiSettings {
  const objects = Object.fromEntries(
    THEME_OBJECT_IDS.map((objectId, index) => [
      objectId,
      {
        text: `#${String(index + 1).padStart(6, "0")}`
      }
    ])
  ) as Record<ThemeObjectId, { text: string }>;

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
    security: {
      nonHttpLinkPolicy: "prompt"
    },
    customThemes: {
      custom1: {
        global: {
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
        },
        objects
      },
      textByTheme: {
        retro: {
          global: {
            text: "#101112"
          },
          objects: {
            taskList: {
              mutedText: "#334455"
            }
          }
        }
      }
    }
  };
}

afterEach(() => {
  applyTheme("default");
});

describe("app theme runtime mapping", () => {
  it("keeps theme object registry stable for runtime mapping", () => {
    expect(THEME_OBJECT_IDS).toEqual([
      "appChrome",
      "taskList",
      "taskRow",
      "modal",
      "help",
      "inputs",
      "dashboard",
      "notifications"
    ]);
  });

  it("applies object-level custom1 overrides across all registered theme objects", () => {
    const settings = makeSettingsWithObjectOverrides();
    applyThemeWithSettings("custom1", settings);

    for (const [index, objectId] of THEME_OBJECT_IDS.entries()) {
      expect(themeForObject(objectId).text).toBe(`#${String(index + 1).padStart(6, "0")}`);
    }
  });

  it("prioritizes built-in text draft over persisted text overrides", () => {
    const settings = makeSettingsWithObjectOverrides();
    applyThemeWithSettings("retro", settings, {
      builtInTextDraft: {
        retro: {
          global: {
            text: "#AABBCC"
          },
          objects: {
            taskList: {
              mutedText: "#445566"
            }
          }
        }
      }
    });

    expect(themeForObject("taskList").text).toBe("#AABBCC");
    expect(themeForObject("taskList").mutedText).toBe("#445566");
    expect(themeForObject("dashboard").text).toBe("#AABBCC");
  });

  it("maps warning and danger runtime roles to distinct token channels", () => {
    const settings = makeSettingsWithObjectOverrides();
    applyThemeWithSettings("custom1", settings);

    expect(themeForObject("appChrome").warn).toBe("#DDAA00");
    expect(themeForObject("appChrome").danger).toBe("#DD3344");
    expect(themeForObject("appChrome").dueSoon).toBe("#DDAA00");
  });

  it("keeps all runtime theme fields as non-empty hex colors", () => {
    const settings = makeSettingsWithObjectOverrides();
    applyThemeWithSettings("custom1", settings);

    for (const objectId of THEME_OBJECT_IDS) {
      const runtime = themeForObject(objectId);
      for (const [key, value] of Object.entries(runtime)) {
        expect(typeof value).toBe("string");
        expect(value.trim().length).toBeGreaterThan(0);
        expect(value.toUpperCase()).toMatch(HEX_COLOR_RE);
        expect(`${objectId}:${key}`).not.toBe("");
      }
    }
  });
});
