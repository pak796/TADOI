import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import {
  getDefaultSettings,
  loadSettings,
  resetSettingsStateForTests,
  resolveSettingsPaths,
  saveSettingsDebounced,
  saveSettingsStrict,
  type SettingsFsOps
} from "./settings";
import { THEMES, type ThemeId, type ThemeTokens } from "../theme/themes";

const DEFAULT_NOTIFICATIONS = {
  enabled: true,
  inAppOverdueBanner: true,
  terminalBellOnOverdue: false,
  bannerDurationMs: 5000,
  bellCooldownMs: 2000
};
const DEFAULT_CUSTOM_THEMES = getDefaultSettings().customThemes;

function normalizeTokens(tokens: ThemeTokens): ThemeTokens {
  return {
    bg: tokens.bg.toUpperCase(),
    panel: tokens.panel.toUpperCase(),
    text: tokens.text.toUpperCase(),
    mutedText: tokens.mutedText.toUpperCase(),
    border: tokens.border.toUpperCase(),
    accent: tokens.accent.toUpperCase(),
    accent2: tokens.accent2.toUpperCase(),
    ok: tokens.ok.toUpperCase(),
    warn: tokens.warn.toUpperCase(),
    danger: tokens.danger.toUpperCase(),
    selectionBg: tokens.selectionBg.toUpperCase(),
    selectionText: tokens.selectionText.toUpperCase()
  };
}

function expectedCustomThemesFor(themeId: ThemeId): typeof DEFAULT_CUSTOM_THEMES {
  const seed = themeId === "rotating" ? THEMES.default : THEMES[themeId];
  return {
    custom1: {
      global: normalizeTokens(seed)
    }
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "tadoi-settings-test-"));
}

beforeEach(() => {
  resetSettingsStateForTests();
});

afterEach(() => {
  resetSettingsStateForTests();
});

describe("loadSettings", () => {
  it("returns defaults when settings files are missing", async () => {
    const homeDir = await makeTempDir();
    const result = await loadSettings({ homeDir, platform: "linux" });
    expect(result.settings.themeId).toBe("default");
    expect(result.settings.notifications).toEqual(DEFAULT_NOTIFICATIONS);
    expect(result.settings.customThemes).toEqual(expectedCustomThemesFor("default"));
    expect(result.resolvedPath).toBe(
      path.posix.join(homeDir, ".config", "tadoi", "settings.json")
    );
  });

  it("reads primary settings file first when valid", async () => {
    const homeDir = await makeTempDir();
    const { primary, fallback } = resolveSettingsPaths({ homeDir, platform: "linux" });
    await fs.mkdir(path.dirname(primary), { recursive: true });
    await fs.mkdir(path.dirname(fallback), { recursive: true });
    await fs.writeFile(
      primary,
      JSON.stringify({ themeId: "retro", flashMode: "static" }),
      "utf8"
    );
    await fs.writeFile(
      fallback,
      JSON.stringify({ themeId: "neonHacker", flashMode: "slow" }),
      "utf8"
    );

    const result = await loadSettings({ homeDir, platform: "linux" });
    expect(result.settings.themeId).toBe("retro");
    expect(result.settings.flashMode).toBe("static");
    expect(result.settings.notifications).toEqual(DEFAULT_NOTIFICATIONS);
    expect(result.settings.customThemes).toEqual(expectedCustomThemesFor("retro"));
    expect(result.resolvedPath).toBe(primary);
  });

  it("uses fallback file when primary is missing", async () => {
    const homeDir = await makeTempDir();
    const { fallback } = resolveSettingsPaths({ homeDir, platform: "linux" });
    await fs.mkdir(path.dirname(fallback), { recursive: true });
    await fs.writeFile(
      fallback,
      JSON.stringify({ themeId: "highContrast", flashMode: "static" }),
      "utf8"
    );

    const result = await loadSettings({ homeDir, platform: "linux" });
    expect(result.settings.themeId).toBe("highContrast");
    expect(result.settings.flashMode).toBe("static");
    expect(result.settings.notifications).toEqual(DEFAULT_NOTIFICATIONS);
    expect(result.settings.customThemes).toEqual(expectedCustomThemesFor("highContrast"));
    expect(result.resolvedPath).toBe(fallback);
  });

  it("normalizes invalid theme ids to default", async () => {
    const homeDir = await makeTempDir();
    const { primary } = resolveSettingsPaths({ homeDir, platform: "linux" });
    await fs.mkdir(path.dirname(primary), { recursive: true });
    await fs.writeFile(primary, JSON.stringify({ themeId: "bad-theme" }), "utf8");

    const result = await loadSettings({ homeDir, platform: "linux" });
    expect(result.settings.themeId).toBe("default");
    expect(result.settings.flashMode).toBe("slow");
    expect(result.settings.notifications).toEqual(DEFAULT_NOTIFICATIONS);
    expect(result.settings.customThemes).toEqual(expectedCustomThemesFor("default"));
  });

  it("defaults flash mode when missing or invalid", async () => {
    const homeDir = await makeTempDir();
    const { primary } = resolveSettingsPaths({ homeDir, platform: "linux" });
    await fs.mkdir(path.dirname(primary), { recursive: true });
    await fs.writeFile(primary, JSON.stringify({ themeId: "retro" }), "utf8");
    const missing = await loadSettings({ homeDir, platform: "linux" });
    expect(missing.settings).toEqual({
      themeId: "retro",
      flashMode: "slow",
      notifications: DEFAULT_NOTIFICATIONS,
      customThemes: expectedCustomThemesFor("retro")
    });

    await fs.writeFile(
      primary,
      JSON.stringify({ themeId: "retro", flashMode: "fast" }),
      "utf8"
    );
    const invalid = await loadSettings({ homeDir, platform: "linux" });
    expect(invalid.settings).toEqual({
      themeId: "retro",
      flashMode: "slow",
      notifications: DEFAULT_NOTIFICATIONS,
      customThemes: expectedCustomThemesFor("retro")
    });
  });

  it("normalizes invalid notification settings to defaults", async () => {
    const homeDir = await makeTempDir();
    const { primary } = resolveSettingsPaths({ homeDir, platform: "linux" });
    await fs.mkdir(path.dirname(primary), { recursive: true });
    await fs.writeFile(
      primary,
      JSON.stringify({
        themeId: "retro",
        flashMode: "static",
        notifications: {
          enabled: "yes",
          inAppOverdueBanner: true,
          terminalBellOnOverdue: false,
          bannerDurationMs: 0,
          bellCooldownMs: -5
        }
      }),
      "utf8"
    );

    const result = await loadSettings({ homeDir, platform: "linux" });
    expect(result.settings).toEqual({
      themeId: "retro",
      flashMode: "static",
      notifications: DEFAULT_NOTIFICATIONS,
      customThemes: expectedCustomThemesFor("retro")
    });
  });

  it("seeds custom1 global palette from active non-rotating theme when missing", async () => {
    const homeDir = await makeTempDir();
    const { primary } = resolveSettingsPaths({ homeDir, platform: "linux" });
    await fs.mkdir(path.dirname(primary), { recursive: true });
    await fs.writeFile(primary, JSON.stringify({ themeId: "retro", flashMode: "slow" }), "utf8");

    const result = await loadSettings({ homeDir, platform: "linux" });
    expect(result.settings.customThemes?.custom1?.global.bg).toBe("#121316");
    expect(result.settings.customThemes?.custom1?.global.panel).toBe("#1F2126");
  });

  it("seeds custom1 global palette from default when rotating is active", async () => {
    const homeDir = await makeTempDir();
    const { primary } = resolveSettingsPaths({ homeDir, platform: "linux" });
    await fs.mkdir(path.dirname(primary), { recursive: true });
    await fs.writeFile(primary, JSON.stringify({ themeId: "rotating", flashMode: "slow" }), "utf8");

    const result = await loadSettings({ homeDir, platform: "linux" });
    expect(result.settings.customThemes?.custom1?.global.bg).toBe("#0B0F14");
    expect(result.settings.customThemes?.custom1?.global.panel).toBe("#1A202C");
  });
});

describe("saveSettingsDebounced", () => {
  it("creates parent directories and writes settings", async () => {
    const homeDir = await makeTempDir();
    const { primary } = resolveSettingsPaths({ homeDir, platform: "linux" });
    saveSettingsDebounced(
      {
        themeId: "highContrast",
        flashMode: "static",
        notifications: DEFAULT_NOTIFICATIONS
      },
      20,
      { filePath: primary, homeDir, platform: "linux" }
    );

    await sleep(100);
    const raw = await fs.readFile(primary, "utf8");
    expect(JSON.parse(raw)).toEqual({
      themeId: "highContrast",
      flashMode: "static",
      notifications: DEFAULT_NOTIFICATIONS,
      customThemes: expectedCustomThemesFor("highContrast")
    });
  });

  it("coalesces rapid updates and persists only the latest value", async () => {
    const homeDir = await makeTempDir();
    const { primary } = resolveSettingsPaths({ homeDir, platform: "linux" });
    saveSettingsDebounced(
      { themeId: "retro", flashMode: "slow", notifications: DEFAULT_NOTIFICATIONS },
      20,
      { filePath: primary, homeDir, platform: "linux" }
    );
    saveSettingsDebounced(
      {
        themeId: "neonHacker",
        flashMode: "static",
        notifications: DEFAULT_NOTIFICATIONS
      },
      20,
      { filePath: primary, homeDir, platform: "linux" }
    );

    await sleep(100);
    const raw = await fs.readFile(primary, "utf8");
    expect(JSON.parse(raw)).toEqual({
      themeId: "neonHacker",
      flashMode: "static",
      notifications: DEFAULT_NOTIFICATIONS,
      customThemes: expectedCustomThemesFor("neonHacker")
    });
  });

  it("falls back to ~/.tadoi/settings.json when primary write fails", async () => {
    const homeDir = await makeTempDir();
    const { primary, fallback } = resolveSettingsPaths({ homeDir, platform: "linux" });

    const fsOps: SettingsFsOps = {
      ...fs,
      writeFile: (async (targetPath, data, encoding) => {
        if (String(targetPath) === primary) {
          throw new Error("primary write failed");
        }
        return fs.writeFile(
          targetPath,
          data as Parameters<typeof fs.writeFile>[1],
          encoding as Parameters<typeof fs.writeFile>[2]
        );
      }) as SettingsFsOps["writeFile"]
    };

    saveSettingsDebounced(
      { themeId: "retro", flashMode: "static", notifications: DEFAULT_NOTIFICATIONS },
      20,
      { homeDir, platform: "linux", fsOps }
    );

    await sleep(150);
    const fallbackExists = await fs
      .stat(fallback)
      .then(() => true)
      .catch(() => false);
    expect(fallbackExists).toBe(true);
    const fallbackRaw = await fs.readFile(fallback, "utf8");
    expect(JSON.parse(fallbackRaw)).toEqual({
      themeId: "retro",
      flashMode: "static",
      notifications: DEFAULT_NOTIFICATIONS,
      customThemes: expectedCustomThemesFor("retro")
    });
  });
});

describe("saveSettingsStrict", () => {
  it("writes settings immediately to preferred path", async () => {
    const homeDir = await makeTempDir();
    const { primary } = resolveSettingsPaths({ homeDir, platform: "linux" });

    const result = await saveSettingsStrict(
      { themeId: "retro", flashMode: "slow", notifications: DEFAULT_NOTIFICATIONS },
      { filePath: primary, homeDir, platform: "linux" }
    );

    expect(result.resolvedPath).toBe(primary);
    expect(result.usedFallback).toBe(false);
    const raw = await fs.readFile(primary, "utf8");
    expect(JSON.parse(raw)).toEqual({
      themeId: "retro",
      flashMode: "slow",
      notifications: DEFAULT_NOTIFICATIONS,
      customThemes: expectedCustomThemesFor("retro")
    });
  });

  it("falls back from primary to fallback path when primary write fails", async () => {
    const homeDir = await makeTempDir();
    const { primary, fallback } = resolveSettingsPaths({ homeDir, platform: "linux" });

    const fsOps: SettingsFsOps = {
      ...fs,
      writeFile: (async (targetPath, data, encoding) => {
        if (String(targetPath) === primary) {
          throw new Error("primary write failed");
        }
        return fs.writeFile(
          targetPath,
          data as Parameters<typeof fs.writeFile>[1],
          encoding as Parameters<typeof fs.writeFile>[2]
        );
      }) as SettingsFsOps["writeFile"]
    };

    const result = await saveSettingsStrict(
      {
        themeId: "highContrast",
        flashMode: "static",
        notifications: DEFAULT_NOTIFICATIONS
      },
      { homeDir, platform: "linux", fsOps }
    );

    expect(result.resolvedPath).toBe(fallback);
    expect(result.usedFallback).toBe(true);
    const raw = await fs.readFile(fallback, "utf8");
    expect(JSON.parse(raw)).toEqual({
      themeId: "highContrast",
      flashMode: "static",
      notifications: DEFAULT_NOTIFICATIONS,
      customThemes: expectedCustomThemesFor("highContrast")
    });
  });
});
