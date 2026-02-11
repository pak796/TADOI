import { describe, expect, it } from "bun:test";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import {
  buildTimestampedBackupPath,
  exportBackup,
  importBackup
} from "./backupService";
import { resolveSettingsPaths } from "../settings/settings";
import { THEMES, type ThemeId, type ThemeTokens } from "../theme/themes";

const FIXED_DATE = new Date(2026, 1, 10, 0, 0, 0);

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

function expectedCustomThemesFor(themeId: ThemeId) {
  const seed = themeId === "rotating" ? THEMES.default : THEMES[themeId];
  return {
    custom1: {
      global: normalizeTokens(seed)
    }
  };
}

describe("buildTimestampedBackupPath", () => {
  it("uses default backups folder and increments suffix on collisions", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-backup-path-"));
    const dataPath = path.join(tempDir, "tadoi_data.json");

    const first = await buildTimestampedBackupPath({
      dataPath,
      now: FIXED_DATE
    });
    expect(first).toBe(path.join(tempDir, "backups", "tadoi-backup-20260210-000000.json"));

    await fs.mkdir(path.dirname(first), { recursive: true });
    await fs.writeFile(first, "{}", "utf8");

    const second = await buildTimestampedBackupPath({
      dataPath,
      now: FIXED_DATE
    });
    expect(second).toBe(
      path.join(tempDir, "backups", "tadoi-backup-20260210-000000.1.json")
    );
  });
});

describe("backupService import/export", () => {
  it("exports to timestamped path and reports metadata", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-export-"));
    const dataPath = path.join(tempDir, "tadoi_data.json");
    const outputDir = path.join(tempDir, "exports");
    const payload = {
      schemaVersion: 4,
      tasks: [
        {
          id: "task-1",
          title: "TASK",
          status: "open",
          createdAt: 1,
          updatedAt: 1,
          tags: ["a"]
        }
      ],
      tagIndex: {},
      savedViews: []
    };
    await fs.writeFile(dataPath, JSON.stringify(payload, null, 2), "utf8");

    const originalDataPath = process.env.TADOI_DATA_PATH;
    process.env.TADOI_DATA_PATH = dataPath;
    try {
      const result = await exportBackup({
        outputDir,
        now: FIXED_DATE,
        pretty: true
      });

      expect(result.outputPath).toBe(
        path.join(outputDir, "tadoi-backup-20260210-000000.json")
      );
      expect(result.taskCount).toBe(1);
      expect(result.schemaVersion).toBe(4);
      expect(result.bytesWritten).toBeGreaterThan(0);
    } finally {
      if (originalDataPath === undefined) {
        delete process.env.TADOI_DATA_PATH;
      } else {
        process.env.TADOI_DATA_PATH = originalDataPath;
      }
    }
  });

  it("returns dry-run counts without writing data", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-import-dryrun-"));
    const dataPath = path.join(tempDir, "tadoi_data.json");
    const importPath = path.join(tempDir, "incoming.json");
    await fs.writeFile(
      dataPath,
      JSON.stringify({ schemaVersion: 4, tasks: [], tagIndex: {}, savedViews: [] }, null, 2),
      "utf8"
    );
    await fs.writeFile(
      importPath,
      JSON.stringify(
        {
          schemaVersion: 4,
          tasks: [
            {
              id: "incoming-1",
              title: "INCOMING",
              status: "open",
              createdAt: 1,
              updatedAt: 1,
              tags: ["incoming"]
            }
          ],
          tagIndex: {},
          savedViews: []
        },
        null,
        2
      ),
      "utf8"
    );

    const originalDataPath = process.env.TADOI_DATA_PATH;
    process.env.TADOI_DATA_PATH = dataPath;
    try {
      const summary = await importBackup({
        inputPath: importPath,
        mode: "merge",
        dryRun: true
      });

      expect(summary.tasks.added).toBe(1);
      expect(summary.tasks.updated).toBe(0);
      expect(summary.tasks.removed).toBe(0);
      expect(summary.dryRun).toBe(true);

      const postRaw = await fs.readFile(dataPath, "utf8");
      const postJson = JSON.parse(postRaw) as { tasks: unknown[] };
      expect(postJson.tasks).toHaveLength(0);
    } finally {
      if (originalDataPath === undefined) {
        delete process.env.TADOI_DATA_PATH;
      } else {
        process.env.TADOI_DATA_PATH = originalDataPath;
      }
    }
  });

  it("commits replace import and creates backup by default", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-import-commit-"));
    const dataPath = path.join(tempDir, "tadoi_data.json");
    const importPath = path.join(tempDir, "incoming.json");
    await fs.writeFile(
      dataPath,
      JSON.stringify(
        {
          schemaVersion: 4,
          tasks: [
            {
              id: "local-1",
              title: "LOCAL",
              status: "open",
              createdAt: 1,
              updatedAt: 1,
              tags: ["local"]
            }
          ],
          tagIndex: {},
          savedViews: []
        },
        null,
        2
      ),
      "utf8"
    );
    await fs.writeFile(
      importPath,
      JSON.stringify(
        {
          schemaVersion: 4,
          tasks: [
            {
              id: "incoming-1",
              title: "INCOMING",
              status: "open",
              createdAt: 2,
              updatedAt: 2,
              tags: ["incoming"]
            }
          ],
          tagIndex: {},
          savedViews: []
        },
        null,
        2
      ),
      "utf8"
    );

    const originalDataPath = process.env.TADOI_DATA_PATH;
    process.env.TADOI_DATA_PATH = dataPath;
    try {
      const summary = await importBackup({
        inputPath: importPath,
        mode: "replace",
        dryRun: false
      });

      expect(summary.dryRun).toBe(false);
      expect(summary.tasks.removed).toBe(1);
      expect(summary.backupPath).toBeDefined();
      expect(summary.backupPath?.includes(".backup.")).toBe(true);

      const backupRaw = await fs.readFile(summary.backupPath as string, "utf8");
      const backupJson = JSON.parse(backupRaw) as { tasks: Array<{ title: string }> };
      expect(backupJson.tasks[0]?.title).toBe("LOCAL");

      const nextRaw = await fs.readFile(dataPath, "utf8");
      const nextJson = JSON.parse(nextRaw) as { tasks: Array<{ title: string }> };
      expect(nextJson.tasks[0]?.title).toBe("INCOMING");
    } finally {
      if (originalDataPath === undefined) {
        delete process.env.TADOI_DATA_PATH;
      } else {
        process.env.TADOI_DATA_PATH = originalDataPath;
      }
    }
  });

  it("imports nested notification settings and writes them to settings.json", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-import-settings-"));
    const dataPath = path.join(tempDir, "tadoi_data.json");
    const importPath = path.join(tempDir, "incoming.json");
    await fs.writeFile(
      dataPath,
      JSON.stringify({ schemaVersion: 4, tasks: [], tagIndex: {}, savedViews: [] }, null, 2),
      "utf8"
    );
    await fs.writeFile(
      importPath,
      JSON.stringify(
        {
          schemaVersion: 4,
          tasks: [],
          tagIndex: {},
          savedViews: [],
          settings: {
            themeId: "retro",
            flashMode: "static",
            notifications: {
              enabled: true,
              inAppOverdueBanner: false,
              terminalBellOnOverdue: true,
              bannerDurationMs: 6000,
              bellCooldownMs: 3000
            }
          }
        },
        null,
        2
      ),
      "utf8"
    );

    const originalDataPath = process.env.TADOI_DATA_PATH;
    const originalHome = process.env.HOME;
    process.env.TADOI_DATA_PATH = dataPath;
    process.env.HOME = tempDir;
    try {
      const summary = await importBackup({
        inputPath: importPath,
        mode: "merge",
        dryRun: false
      });

      expect(summary.settings.includedInImport).toBe(true);
      expect(summary.settings.applied).toBe(true);

      const { primary, fallback } = resolveSettingsPaths({
        homeDir: tempDir,
        platform: process.platform
      });
      const resolvedSettingsPath =
        summary.settings.path === fallback ? fallback : primary;
      const rawSettings = await fs.readFile(resolvedSettingsPath, "utf8");
      expect(JSON.parse(rawSettings)).toEqual({
        themeId: "retro",
        flashMode: "static",
        notifications: {
          enabled: true,
          inAppOverdueBanner: false,
          terminalBellOnOverdue: true,
          bannerDurationMs: 6000,
          bellCooldownMs: 3000
        },
        customThemes: expectedCustomThemesFor("retro")
      });
    } finally {
      if (originalDataPath === undefined) {
        delete process.env.TADOI_DATA_PATH;
      } else {
        process.env.TADOI_DATA_PATH = originalDataPath;
      }
      if (originalHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = originalHome;
      }
    }
  });

  it("preserves imported custom1 theme payload", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-import-custom-theme-"));
    const dataPath = path.join(tempDir, "tadoi_data.json");
    const importPath = path.join(tempDir, "incoming.json");
    await fs.writeFile(
      dataPath,
      JSON.stringify({ schemaVersion: 4, tasks: [], tagIndex: {}, savedViews: [] }, null, 2),
      "utf8"
    );
    await fs.writeFile(
      importPath,
      JSON.stringify(
        {
          schemaVersion: 4,
          tasks: [],
          tagIndex: {},
          savedViews: [],
          settings: {
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
                global: {
                  bg: "#111111",
                  panel: "#222222",
                  text: "#EEEEEE",
                  mutedText: "#AAAAAA",
                  border: "#333333",
                  accent: "#FF7700",
                  accent2: "#00AAFF",
                  ok: "#22CC66",
                  warn: "#DDAA00",
                  danger: "#CC3355",
                  selectionBg: "#8844CC",
                  selectionText: "#111111"
                },
                objects: {
                  taskList: {
                    panel: "#123456"
                  }
                }
              }
            }
          }
        },
        null,
        2
      ),
      "utf8"
    );

    const originalDataPath = process.env.TADOI_DATA_PATH;
    const originalHome = process.env.HOME;
    process.env.TADOI_DATA_PATH = dataPath;
    process.env.HOME = tempDir;
    try {
      await importBackup({
        inputPath: importPath,
        mode: "merge",
        dryRun: false
      });

      const { primary, fallback } = resolveSettingsPaths({
        homeDir: tempDir,
        platform: process.platform
      });
      const resolvedSettingsPath = (await fs.stat(primary).then(() => primary).catch(() => fallback));
      const rawSettings = await fs.readFile(resolvedSettingsPath, "utf8");
      const parsed = JSON.parse(rawSettings) as {
        customThemes?: { custom1?: { objects?: { taskList?: { panel?: string } } } };
        themeId?: string;
      };
      expect(parsed.themeId).toBe("custom1");
      expect(parsed.customThemes?.custom1?.objects?.taskList?.panel).toBe("#123456");
    } finally {
      if (originalDataPath === undefined) {
        delete process.env.TADOI_DATA_PATH;
      } else {
        process.env.TADOI_DATA_PATH = originalDataPath;
      }
      if (originalHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = originalHome;
      }
    }
  });
});
