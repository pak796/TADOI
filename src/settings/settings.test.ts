import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import {
  loadSettings,
  resetSettingsStateForTests,
  resolveSettingsPaths,
  saveSettingsDebounced,
  type SettingsFsOps
} from "./settings";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "todui-settings-test-"));
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
    expect(result.resolvedPath).toBe(
      path.posix.join(homeDir, ".config", "todui", "settings.json")
    );
  });

  it("reads primary settings file first when valid", async () => {
    const homeDir = await makeTempDir();
    const { primary, fallback } = resolveSettingsPaths({ homeDir, platform: "linux" });
    await fs.mkdir(path.dirname(primary), { recursive: true });
    await fs.mkdir(path.dirname(fallback), { recursive: true });
    await fs.writeFile(primary, JSON.stringify({ themeId: "retro" }), "utf8");
    await fs.writeFile(fallback, JSON.stringify({ themeId: "neonHacker" }), "utf8");

    const result = await loadSettings({ homeDir, platform: "linux" });
    expect(result.settings.themeId).toBe("retro");
    expect(result.resolvedPath).toBe(primary);
  });

  it("uses fallback file when primary is missing", async () => {
    const homeDir = await makeTempDir();
    const { fallback } = resolveSettingsPaths({ homeDir, platform: "linux" });
    await fs.mkdir(path.dirname(fallback), { recursive: true });
    await fs.writeFile(fallback, JSON.stringify({ themeId: "highContrast" }), "utf8");

    const result = await loadSettings({ homeDir, platform: "linux" });
    expect(result.settings.themeId).toBe("highContrast");
    expect(result.resolvedPath).toBe(fallback);
  });

  it("normalizes invalid theme ids to default", async () => {
    const homeDir = await makeTempDir();
    const { primary } = resolveSettingsPaths({ homeDir, platform: "linux" });
    await fs.mkdir(path.dirname(primary), { recursive: true });
    await fs.writeFile(primary, JSON.stringify({ themeId: "bad-theme" }), "utf8");

    const result = await loadSettings({ homeDir, platform: "linux" });
    expect(result.settings.themeId).toBe("default");
  });
});

describe("saveSettingsDebounced", () => {
  it("creates parent directories and writes settings", async () => {
    const homeDir = await makeTempDir();
    const { primary } = resolveSettingsPaths({ homeDir, platform: "linux" });
    saveSettingsDebounced(
      { themeId: "highContrast" },
      20,
      { filePath: primary, homeDir, platform: "linux" }
    );

    await sleep(100);
    const raw = await fs.readFile(primary, "utf8");
    expect(JSON.parse(raw)).toEqual({ themeId: "highContrast" });
  });

  it("coalesces rapid updates and persists only the latest value", async () => {
    const homeDir = await makeTempDir();
    const { primary } = resolveSettingsPaths({ homeDir, platform: "linux" });
    saveSettingsDebounced(
      { themeId: "retro" },
      20,
      { filePath: primary, homeDir, platform: "linux" }
    );
    saveSettingsDebounced(
      { themeId: "neonHacker" },
      20,
      { filePath: primary, homeDir, platform: "linux" }
    );

    await sleep(100);
    const raw = await fs.readFile(primary, "utf8");
    expect(JSON.parse(raw)).toEqual({ themeId: "neonHacker" });
  });

  it("falls back to ~/.todui/settings.json when primary write fails", async () => {
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
      { themeId: "retro" },
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
    expect(JSON.parse(fallbackRaw)).toEqual({ themeId: "retro" });
  });
});
