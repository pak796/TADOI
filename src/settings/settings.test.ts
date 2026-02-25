import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import {
  cycleCrtFxLiteProfile,
  cycleLogoMode,
  formatCrtFxLiteProfileLabel,
  getDefaultSettings,
  isLogoMode,
  loadSettings,
  LOGO_MODE_ORDER,
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
const DEFAULT_SECURITY = {
  nonHttpLinkPolicy: "prompt"
} as const;
const DEFAULT_LOGO_MODE = getDefaultSettings().logoMode;
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

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

async function readFileEventually(filePath: string, timeoutMs = 2000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    try {
      return await fs.readFile(filePath, "utf8");
    } catch (error: unknown) {
      if (!isMissingFileError(error)) {
        throw error;
      }
      await sleep(25);
    }
  }
  throw new Error(`Timed out waiting for file write: ${filePath}`);
}

async function readJsonEventually(
  filePath: string,
  predicate: (value: unknown) => boolean,
  timeoutMs = 2000
): Promise<unknown> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (predicate(parsed)) {
        return parsed;
      }
    } catch (error: unknown) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }
    await sleep(25);
  }
  throw new Error(`Timed out waiting for matching JSON content: ${filePath}`);
}

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "tadoi-settings-test-"));
}

async function expectUnixPrivateFileMode(filePath: string): Promise<void> {
  if (process.platform === "win32") return;
  const stat = await fs.stat(filePath);
  expect(stat.mode & 0o077).toBe(0);
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
    expect(result.settings.logoMode).toBe(DEFAULT_LOGO_MODE);
    expect(result.settings.notifications).toEqual(DEFAULT_NOTIFICATIONS);
    expect(result.settings.security).toEqual(DEFAULT_SECURITY);
    expect(result.settings.customThemes).toEqual(expectedCustomThemesFor("default"));
    expect(result.settings.customThemes?.textByTheme).toBeUndefined();
    expect(result.settings.crtFxLite).toBeUndefined();
    expect(result.settings.crtFxColor).toBeUndefined();
    expect(result.settings.crtFxPreset).toBeUndefined();
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
    expect(result.settings.logoMode).toBe(DEFAULT_LOGO_MODE);
    expect(result.settings.flashMode).toBe("static");
    expect(result.settings.crtFxLite).toBeUndefined();
    expect(result.settings.crtFxColor).toBeUndefined();
    expect(result.settings.crtFxPreset).toBeUndefined();
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
    expect(result.settings.logoMode).toBe(DEFAULT_LOGO_MODE);
    expect(result.settings.flashMode).toBe("static");
    expect(result.settings.notifications).toEqual(DEFAULT_NOTIFICATIONS);
    expect(result.settings.customThemes).toEqual(expectedCustomThemesFor("highContrast"));
    expect(result.resolvedPath).toBe(fallback);
  });

  it("accepts trooper as a valid theme id and seeds custom1 from trooper", async () => {
    const homeDir = await makeTempDir();
    const { primary } = resolveSettingsPaths({ homeDir, platform: "linux" });
    await fs.mkdir(path.dirname(primary), { recursive: true });
    await fs.writeFile(primary, JSON.stringify({ themeId: "trooper" }), "utf8");

    const result = await loadSettings({ homeDir, platform: "linux" });
    expect(result.settings.themeId).toBe("trooper");
    expect(result.settings.customThemes).toEqual(expectedCustomThemesFor("trooper"));
  });

  it("accepts niners as a valid theme id and seeds custom1 from niners", async () => {
    const homeDir = await makeTempDir();
    const { primary } = resolveSettingsPaths({ homeDir, platform: "linux" });
    await fs.mkdir(path.dirname(primary), { recursive: true });
    await fs.writeFile(primary, JSON.stringify({ themeId: "niners" }), "utf8");

    const result = await loadSettings({ homeDir, platform: "linux" });
    expect(result.settings.themeId).toBe("niners");
    expect(result.settings.customThemes).toEqual(expectedCustomThemesFor("niners"));
  });

  it("normalizes invalid theme ids to default", async () => {
    const homeDir = await makeTempDir();
    const { primary } = resolveSettingsPaths({ homeDir, platform: "linux" });
    await fs.mkdir(path.dirname(primary), { recursive: true });
    await fs.writeFile(primary, JSON.stringify({ themeId: "bad-theme" }), "utf8");

    const result = await loadSettings({ homeDir, platform: "linux" });
    expect(result.settings.themeId).toBe("default");
    expect(result.settings.logoMode).toBe(DEFAULT_LOGO_MODE);
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
      logoMode: DEFAULT_LOGO_MODE,
      flashMode: "slow",
      notifications: DEFAULT_NOTIFICATIONS,
      security: DEFAULT_SECURITY,
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
      logoMode: DEFAULT_LOGO_MODE,
      flashMode: "slow",
      notifications: DEFAULT_NOTIFICATIONS,
      security: DEFAULT_SECURITY,
      customThemes: expectedCustomThemesFor("retro")
    });
  });

  it("normalizes crtFxLite to true only when explicitly true", async () => {
    const homeDir = await makeTempDir();
    const { primary } = resolveSettingsPaths({ homeDir, platform: "linux" });
    await fs.mkdir(path.dirname(primary), { recursive: true });

    await fs.writeFile(
      primary,
      JSON.stringify({ themeId: "retro", flashMode: "slow", crtFxLite: true }),
      "utf8"
    );
    const enabled = await loadSettings({ homeDir, platform: "linux" });
    expect(enabled.settings.crtFxLite).toBe(true);

    await fs.writeFile(
      primary,
      JSON.stringify({ themeId: "retro", flashMode: "slow", crtFxLite: false }),
      "utf8"
    );
    const disabled = await loadSettings({ homeDir, platform: "linux" });
    expect(disabled.settings.crtFxLite).toBeUndefined();

    await fs.writeFile(
      primary,
      JSON.stringify({ themeId: "retro", flashMode: "slow", crtFxLite: "yes" }),
      "utf8"
    );
    const invalid = await loadSettings({ homeDir, platform: "linux" });
    expect(invalid.settings.crtFxLite).toBeUndefined();
  });

  it("normalizes crtFxPreset to supported values and omits default preset", async () => {
    const homeDir = await makeTempDir();
    const { primary } = resolveSettingsPaths({ homeDir, platform: "linux" });
    await fs.mkdir(path.dirname(primary), { recursive: true });

    await fs.writeFile(
      primary,
      JSON.stringify({ themeId: "retro", flashMode: "slow", crtFxPreset: "strong" }),
      "utf8"
    );
    const strong = await loadSettings({ homeDir, platform: "linux" });
    expect(strong.settings.crtFxPreset).toBe("strong");

    await fs.writeFile(
      primary,
      JSON.stringify({ themeId: "retro", flashMode: "slow", crtFxPreset: "normal" }),
      "utf8"
    );
    const normal = await loadSettings({ homeDir, platform: "linux" });
    expect(normal.settings.crtFxPreset).toBeUndefined();

    await fs.writeFile(
      primary,
      JSON.stringify({ themeId: "retro", flashMode: "slow", crtFxPreset: "loud" }),
      "utf8"
    );
    const invalid = await loadSettings({ homeDir, platform: "linux" });
    expect(invalid.settings.crtFxPreset).toBeUndefined();
  });

  it("normalizes crtFxColor to supported values and omits default color", async () => {
    const homeDir = await makeTempDir();
    const { primary } = resolveSettingsPaths({ homeDir, platform: "linux" });
    await fs.mkdir(path.dirname(primary), { recursive: true });

    await fs.writeFile(
      primary,
      JSON.stringify({ themeId: "retro", flashMode: "slow", crtFxColor: "amber" }),
      "utf8"
    );
    const amber = await loadSettings({ homeDir, platform: "linux" });
    expect(amber.settings.crtFxColor).toBe("amber");

    await fs.writeFile(
      primary,
      JSON.stringify({ themeId: "retro", flashMode: "slow", crtFxColor: "green" }),
      "utf8"
    );
    const green = await loadSettings({ homeDir, platform: "linux" });
    expect(green.settings.crtFxColor).toBeUndefined();

    await fs.writeFile(
      primary,
      JSON.stringify({ themeId: "retro", flashMode: "slow", crtFxColor: "blue" }),
      "utf8"
    );
    const invalid = await loadSettings({ homeDir, platform: "linux" });
    expect(invalid.settings.crtFxColor).toBeUndefined();
  });

  it("defaults logo mode when missing or invalid", async () => {
    const homeDir = await makeTempDir();
    const { primary } = resolveSettingsPaths({ homeDir, platform: "linux" });
    await fs.mkdir(path.dirname(primary), { recursive: true });

    await fs.writeFile(
      primary,
      JSON.stringify({ themeId: "retro", flashMode: "slow" }),
      "utf8"
    );
    const missing = await loadSettings({ homeDir, platform: "linux" });
    expect(missing.settings.logoMode).toBe(DEFAULT_LOGO_MODE);

    await fs.writeFile(
      primary,
      JSON.stringify({ themeId: "retro", logoMode: "invalid-mode", flashMode: "slow" }),
      "utf8"
    );
    const invalid = await loadSettings({ homeDir, platform: "linux" });
    expect(invalid.settings.logoMode).toBe(DEFAULT_LOGO_MODE);
  });

  it("accepts all supported logo modes when provided", async () => {
    const homeDir = await makeTempDir();
    const { primary } = resolveSettingsPaths({ homeDir, platform: "linux" });
    await fs.mkdir(path.dirname(primary), { recursive: true });
    for (const logoMode of LOGO_MODE_ORDER) {
      await fs.writeFile(
        primary,
        JSON.stringify({
          themeId: "retro",
          logoMode,
          flashMode: "slow"
        }),
        "utf8"
      );
      const result = await loadSettings({ homeDir, platform: "linux" });
      expect(result.settings.logoMode).toBe(logoMode);
    }
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
      logoMode: DEFAULT_LOGO_MODE,
      flashMode: "static",
      notifications: DEFAULT_NOTIFICATIONS,
      security: DEFAULT_SECURITY,
      customThemes: expectedCustomThemesFor("retro")
    });
  });

  it("normalizes notification durations to positive integers", async () => {
    const homeDir = await makeTempDir();
    const { primary } = resolveSettingsPaths({ homeDir, platform: "linux" });
    await fs.mkdir(path.dirname(primary), { recursive: true });
    await fs.writeFile(
      primary,
      JSON.stringify({
        themeId: "retro",
        notifications: {
          enabled: true,
          inAppOverdueBanner: true,
          terminalBellOnOverdue: false,
          bannerDurationMs: 1234.9,
          bellCooldownMs: 2000.1
        }
      }),
      "utf8"
    );

    const result = await loadSettings({ homeDir, platform: "linux" });
    expect(result.settings.notifications.bannerDurationMs).toBe(1234);
    expect(result.settings.notifications.bellCooldownMs).toBe(2000);
  });

  it("normalizes security policy values to prompt|block", async () => {
    const homeDir = await makeTempDir();
    const { primary } = resolveSettingsPaths({ homeDir, platform: "linux" });
    await fs.mkdir(path.dirname(primary), { recursive: true });

    await fs.writeFile(
      primary,
      JSON.stringify({
        themeId: "retro",
        security: {
          nonHttpLinkPolicy: "block"
        }
      }),
      "utf8"
    );
    const blocked = await loadSettings({ homeDir, platform: "linux" });
    expect(blocked.settings.security.nonHttpLinkPolicy).toBe("block");

    await fs.writeFile(
      primary,
      JSON.stringify({
        themeId: "retro",
        security: {
          nonHttpLinkPolicy: "danger"
        }
      }),
      "utf8"
    );
    const normalized = await loadSettings({ homeDir, platform: "linux" });
    expect(normalized.settings.security.nonHttpLinkPolicy).toBe("prompt");
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

  it("normalizes built-in text overrides and drops invalid/empty entries", async () => {
    const homeDir = await makeTempDir();
    const { primary } = resolveSettingsPaths({ homeDir, platform: "linux" });
    await fs.mkdir(path.dirname(primary), { recursive: true });
    await fs.writeFile(
      primary,
      JSON.stringify({
        themeId: "retro",
        customThemes: {
          textByTheme: {
            retro: {
              global: {
                text: "#abc123",
                panel: "#FFFFFF"
              },
              objects: {
                taskList: {
                  mutedText: "#123abc",
                  selectionText: "#ffff00",
                  border: "#888888"
                },
                modal: {
                  text: "oops"
                }
              }
            },
            rotating: {
              global: {
                text: "#FFFFFF"
              }
            },
            fakeTheme: {
              global: {
                text: "#FFFFFF"
              }
            }
          }
        }
      }),
      "utf8"
    );

    const result = await loadSettings({ homeDir, platform: "linux" });
    expect(result.settings.customThemes?.textByTheme).toEqual({
      retro: {
        global: {
          text: "#ABC123"
        },
        objects: {
          taskList: {
            mutedText: "#123ABC",
            selectionText: "#FFFF00"
          }
        }
      }
    });
  });

  it("reports warning and falls back when primary settings JSON is malformed", async () => {
    const homeDir = await makeTempDir();
    const { primary, fallback } = resolveSettingsPaths({ homeDir, platform: "linux" });
    await fs.mkdir(path.dirname(primary), { recursive: true });
    await fs.mkdir(path.dirname(fallback), { recursive: true });
    await fs.writeFile(primary, "{broken", "utf8");
    await fs.writeFile(
      fallback,
      JSON.stringify({ themeId: "retro", flashMode: "static" }),
      "utf8"
    );

    const result = await loadSettings({ homeDir, platform: "linux" });
    expect(result.settings.themeId).toBe("retro");
    expect(result.resolvedPath).toBe(fallback);
    expect(result.warnings).toContain(
      "primary settings file is not valid JSON; using fallback/default settings"
    );
  });

  it("reports both warnings and returns defaults when primary/fallback are malformed", async () => {
    const homeDir = await makeTempDir();
    const { primary, fallback } = resolveSettingsPaths({ homeDir, platform: "linux" });
    await fs.mkdir(path.dirname(primary), { recursive: true });
    await fs.mkdir(path.dirname(fallback), { recursive: true });
    await fs.writeFile(primary, "{broken", "utf8");
    await fs.writeFile(fallback, "{broken-too", "utf8");

    const result = await loadSettings({ homeDir, platform: "linux" });
    expect(result.resolvedPath).toBe(primary);
    expect(result.settings).toEqual(getDefaultSettings());
    expect(result.warnings).toEqual([
      "primary settings file is not valid JSON; using fallback/default settings",
      "fallback settings file is not valid JSON; using fallback/default settings"
    ]);
  });
});

describe("saveSettingsDebounced", () => {
  it("creates parent directories and writes settings", async () => {
    const homeDir = await makeTempDir();
    const { primary } = resolveSettingsPaths({ homeDir, platform: "linux" });
    saveSettingsDebounced(
      {
        themeId: "highContrast",
        logoMode: "default",
        flashMode: "static",
        notifications: DEFAULT_NOTIFICATIONS,
        security: DEFAULT_SECURITY
      },
      20,
      { filePath: primary, homeDir, platform: "linux" }
    );

    const raw = await readFileEventually(primary);
    expect(JSON.parse(raw)).toEqual({
      themeId: "highContrast",
      logoMode: "default",
      flashMode: "static",
      notifications: DEFAULT_NOTIFICATIONS,
      security: DEFAULT_SECURITY,
      customThemes: expectedCustomThemesFor("highContrast")
    });
  });

  it("coalesces rapid updates and persists only the latest value", async () => {
    const homeDir = await makeTempDir();
    const { primary } = resolveSettingsPaths({ homeDir, platform: "linux" });
    saveSettingsDebounced(
      {
        themeId: "retro",
        logoMode: "default",
        flashMode: "slow",
        notifications: DEFAULT_NOTIFICATIONS,
        security: DEFAULT_SECURITY
      },
      20,
      { filePath: primary, homeDir, platform: "linux" }
    );
    saveSettingsDebounced(
      {
        themeId: "neonHacker",
        logoMode: "default",
        flashMode: "static",
        notifications: DEFAULT_NOTIFICATIONS,
        security: DEFAULT_SECURITY
      },
      20,
      { filePath: primary, homeDir, platform: "linux" }
    );

    const raw = await readFileEventually(primary);
    expect(JSON.parse(raw)).toEqual({
      themeId: "neonHacker",
      logoMode: "default",
      flashMode: "static",
      notifications: DEFAULT_NOTIFICATIONS,
      security: DEFAULT_SECURITY,
      customThemes: expectedCustomThemesFor("neonHacker")
    });
  });

  it("persists crtFxLite only when enabled", async () => {
    const homeDir = await makeTempDir();
    const { primary } = resolveSettingsPaths({ homeDir, platform: "linux" });

    saveSettingsDebounced(
      {
        themeId: "retro",
        logoMode: "default",
        flashMode: "slow",
        crtFxLite: true,
        notifications: DEFAULT_NOTIFICATIONS,
        security: DEFAULT_SECURITY
      },
      20,
      { filePath: primary, homeDir, platform: "linux" }
    );

    const enabledJson = await readJsonEventually(primary, (value) => {
      if (typeof value !== "object" || value === null) {
        return false;
      }
      return (value as { crtFxLite?: unknown }).crtFxLite === true;
    });
    expect(enabledJson).toEqual({
      themeId: "retro",
      logoMode: "default",
      flashMode: "slow",
      crtFxLite: true,
      notifications: DEFAULT_NOTIFICATIONS,
      security: DEFAULT_SECURITY,
      customThemes: expectedCustomThemesFor("retro")
    });

    saveSettingsDebounced(
      {
        themeId: "retro",
        logoMode: "default",
        flashMode: "slow",
        crtFxLite: false,
        notifications: DEFAULT_NOTIFICATIONS,
        security: DEFAULT_SECURITY
      },
      20,
      { filePath: primary, homeDir, platform: "linux" }
    );

    const disabledJson = await readJsonEventually(primary, (value) => {
      if (typeof value !== "object" || value === null) {
        return false;
      }
      return !Object.prototype.hasOwnProperty.call(value, "crtFxLite");
    });
    expect(disabledJson).toEqual({
      themeId: "retro",
      logoMode: "default",
      flashMode: "slow",
      notifications: DEFAULT_NOTIFICATIONS,
      security: DEFAULT_SECURITY,
      customThemes: expectedCustomThemesFor("retro")
    });
  });

  it("persists crtFxPreset only when non-default", async () => {
    const homeDir = await makeTempDir();
    const { primary } = resolveSettingsPaths({ homeDir, platform: "linux" });

    saveSettingsDebounced(
      {
        themeId: "retro",
        logoMode: "default",
        flashMode: "slow",
        crtFxPreset: "strong",
        notifications: DEFAULT_NOTIFICATIONS,
        security: DEFAULT_SECURITY
      },
      20,
      { filePath: primary, homeDir, platform: "linux" }
    );

    const strongJson = await readJsonEventually(primary, (value) => {
      if (typeof value !== "object" || value === null) {
        return false;
      }
      return (value as { crtFxPreset?: unknown }).crtFxPreset === "strong";
    });
    expect(strongJson).toEqual({
      themeId: "retro",
      logoMode: "default",
      flashMode: "slow",
      crtFxPreset: "strong",
      notifications: DEFAULT_NOTIFICATIONS,
      security: DEFAULT_SECURITY,
      customThemes: expectedCustomThemesFor("retro")
    });

    saveSettingsDebounced(
      {
        themeId: "retro",
        logoMode: "default",
        flashMode: "slow",
        crtFxPreset: "normal",
        notifications: DEFAULT_NOTIFICATIONS,
        security: DEFAULT_SECURITY
      },
      20,
      { filePath: primary, homeDir, platform: "linux" }
    );

    const normalJson = await readJsonEventually(primary, (value) => {
      if (typeof value !== "object" || value === null) {
        return false;
      }
      return !Object.prototype.hasOwnProperty.call(value, "crtFxPreset");
    });
    expect(normalJson).toEqual({
      themeId: "retro",
      logoMode: "default",
      flashMode: "slow",
      notifications: DEFAULT_NOTIFICATIONS,
      security: DEFAULT_SECURITY,
      customThemes: expectedCustomThemesFor("retro")
    });
  });

  it("persists crtFxColor only when non-default", async () => {
    const homeDir = await makeTempDir();
    const { primary } = resolveSettingsPaths({ homeDir, platform: "linux" });

    saveSettingsDebounced(
      {
        themeId: "retro",
        logoMode: "default",
        flashMode: "slow",
        crtFxColor: "amber",
        notifications: DEFAULT_NOTIFICATIONS,
        security: DEFAULT_SECURITY
      },
      20,
      { filePath: primary, homeDir, platform: "linux" }
    );

    const amberJson = await readJsonEventually(primary, (value) => {
      if (typeof value !== "object" || value === null) {
        return false;
      }
      return (value as { crtFxColor?: unknown }).crtFxColor === "amber";
    });
    expect(amberJson).toEqual({
      themeId: "retro",
      logoMode: "default",
      flashMode: "slow",
      crtFxColor: "amber",
      notifications: DEFAULT_NOTIFICATIONS,
      security: DEFAULT_SECURITY,
      customThemes: expectedCustomThemesFor("retro")
    });

    saveSettingsDebounced(
      {
        themeId: "retro",
        logoMode: "default",
        flashMode: "slow",
        crtFxColor: "green",
        notifications: DEFAULT_NOTIFICATIONS,
        security: DEFAULT_SECURITY
      },
      20,
      { filePath: primary, homeDir, platform: "linux" }
    );

    const greenJson = await readJsonEventually(primary, (value) => {
      if (typeof value !== "object" || value === null) {
        return false;
      }
      return !Object.prototype.hasOwnProperty.call(value, "crtFxColor");
    });
    expect(greenJson).toEqual({
      themeId: "retro",
      logoMode: "default",
      flashMode: "slow",
      notifications: DEFAULT_NOTIFICATIONS,
      security: DEFAULT_SECURITY,
      customThemes: expectedCustomThemesFor("retro")
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
      {
        themeId: "retro",
        logoMode: "default",
        flashMode: "static",
        notifications: DEFAULT_NOTIFICATIONS,
        security: DEFAULT_SECURITY
      },
      20,
      { homeDir, platform: "linux", fsOps }
    );

    const fallbackRaw = await readFileEventually(fallback);
    expect(JSON.parse(fallbackRaw)).toEqual({
      themeId: "retro",
      logoMode: "default",
      flashMode: "static",
      notifications: DEFAULT_NOTIFICATIONS,
      security: DEFAULT_SECURITY,
      customThemes: expectedCustomThemesFor("retro")
    });
  });
});

describe("saveSettingsStrict", () => {
  it("writes settings immediately to preferred path", async () => {
    const homeDir = await makeTempDir();
    const { primary } = resolveSettingsPaths({ homeDir, platform: "linux" });

    const result = await saveSettingsStrict(
      {
        themeId: "retro",
        logoMode: "default",
        flashMode: "slow",
        notifications: DEFAULT_NOTIFICATIONS,
        security: DEFAULT_SECURITY
      },
      { filePath: primary, homeDir, platform: "linux" }
    );

    expect(result.resolvedPath).toBe(primary);
    expect(result.usedFallback).toBe(false);
    const raw = await fs.readFile(primary, "utf8");
    await expectUnixPrivateFileMode(primary);
    expect(JSON.parse(raw)).toEqual({
      themeId: "retro",
      logoMode: "default",
      flashMode: "slow",
      notifications: DEFAULT_NOTIFICATIONS,
      security: DEFAULT_SECURITY,
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
        logoMode: "default",
        flashMode: "static",
        notifications: DEFAULT_NOTIFICATIONS,
        security: DEFAULT_SECURITY
      },
      { homeDir, platform: "linux", fsOps }
    );

    expect(result.resolvedPath).toBe(fallback);
    expect(result.usedFallback).toBe(true);
    const raw = await fs.readFile(fallback, "utf8");
    await expectUnixPrivateFileMode(fallback);
    expect(JSON.parse(raw)).toEqual({
      themeId: "highContrast",
      logoMode: "default",
      flashMode: "static",
      notifications: DEFAULT_NOTIFICATIONS,
      security: DEFAULT_SECURITY,
      customThemes: expectedCustomThemesFor("highContrast")
    });
  });
});

describe("logo mode helpers", () => {
  it("validates every known logo mode", () => {
    for (const mode of LOGO_MODE_ORDER) {
      expect(isLogoMode(mode)).toBe(true);
    }
    expect(isLogoMode("invalid")).toBe(false);
    expect(isLogoMode(123)).toBe(false);
    expect(isLogoMode(null)).toBe(false);
  });

  it("cycles forward and backward through the full logo mode order", () => {
    let current = LOGO_MODE_ORDER[0];
    for (let i = 1; i < LOGO_MODE_ORDER.length; i += 1) {
      current = cycleLogoMode(current, 1);
      expect(current).toBe(LOGO_MODE_ORDER[i]);
    }

    expect(cycleLogoMode(current, 1)).toBe(LOGO_MODE_ORDER[0]);
    expect(cycleLogoMode(LOGO_MODE_ORDER[0], -1)).toBe(
      LOGO_MODE_ORDER[LOGO_MODE_ORDER.length - 1]
    );
  });
});

describe("CRT FX profile helpers", () => {
  it("formats combined profile labels for settings display", () => {
    expect(formatCrtFxLiteProfileLabel("green", "subtle")).toBe("Green Subtle");
    expect(formatCrtFxLiteProfileLabel("green", "normal")).toBe("Green Regular");
    expect(formatCrtFxLiteProfileLabel("amber", "strong")).toBe("Amber Strong");
  });

  it("cycles through combined color and strength profiles", () => {
    let current = { color: "green", preset: "subtle" } as const;
    current = cycleCrtFxLiteProfile(current, 1);
    expect(current).toEqual({ color: "green", preset: "normal" });
    current = cycleCrtFxLiteProfile(current, 1);
    expect(current).toEqual({ color: "green", preset: "strong" });
    current = cycleCrtFxLiteProfile(current, 1);
    expect(current).toEqual({ color: "amber", preset: "subtle" });
    current = cycleCrtFxLiteProfile(current, -1);
    expect(current).toEqual({ color: "green", preset: "strong" });
  });
});
