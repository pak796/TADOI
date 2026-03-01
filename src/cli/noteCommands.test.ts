import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { runNoteCommandCli } from "./noteCommands";
import {
  resetSettingsStateForTests,
  resolveSettingsPaths
} from "../settings/settings";

const cleanupDirs: string[] = [];

function setOptionalEnv(key: "HOME" | "USERPROFILE", value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  cleanupDirs.push(dir);
  return dir;
}

beforeEach(() => {
  resetSettingsStateForTests();
});

afterEach(async () => {
  resetSettingsStateForTests();
  await Promise.all(
    cleanupDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))
  );
});

describe("runNoteCommandCli integration", () => {
  it("runs end-to-end root migration flow with backup + copy-first safety", async () => {
    const tempRoot = await makeTempDir("tadoi-note-cli-");
    const homeDir = path.join(tempRoot, "home");
    const dataDir = path.join(tempRoot, "data");
    const dataPath = path.join(dataDir, "tadoi_data.json");
    const defaultNotesRoot = path.join(dataDir, "notes");
    const migratedNotesRoot = path.join(dataDir, "notes-next");
    await fs.mkdir(homeDir, { recursive: true });
    await fs.mkdir(defaultNotesRoot, { recursive: true });
    await fs.writeFile(dataPath, "{}", "utf8");
    await fs.writeFile(path.join(defaultNotesRoot, "A.md"), "# A\n\nlocal note", "utf8");

    const previousHome = process.env.HOME;
    const previousUserProfile = process.env.USERPROFILE;
    process.env.HOME = homeDir;
    process.env.USERPROFILE = homeDir;

    try {
      const openBefore = await runNoteCommandCli(
        {
          type: "note",
          operation: "open",
          query: "A"
        },
        dataPath
      );
      expect(openBefore.kind).toBe("ok");
      expect(openBefore.text).toContain("Path: A.md");

      const migrate = await runNoteCommandCli(
        {
          type: "note",
          operation: "root_set",
          path: "./notes-next"
        },
        dataPath
      );
      expect(migrate.kind).toBe("ok");
      expect(migrate.text).toContain(migratedNotesRoot);

      await fs.access(path.join(defaultNotesRoot, "A.md"));
      await fs.access(path.join(migratedNotesRoot, "A.md"));

      const dataDirEntries = await fs.readdir(dataDir);
      expect(dataDirEntries.some((entry) => entry.startsWith("tadoi_data.json.backup."))).toBe(true);

      const { primary } = resolveSettingsPaths({
        homeDir,
        platform: process.platform
      });
      const settingsRaw = await fs.readFile(primary, "utf8");
      const settings = JSON.parse(settingsRaw) as {
        notes?: { enabled?: boolean; rootPath?: string | null };
      };
      expect(settings.notes?.enabled).toBe(true);
      expect(settings.notes?.rootPath).toBe(migratedNotesRoot);

      const createAfterMigration = await runNoteCommandCli(
        {
          type: "note",
          operation: "new",
          title: "After Migration"
        },
        dataPath
      );
      expect(createAfterMigration.kind).toBe("ok");
      await fs.access(path.join(migratedNotesRoot, "After Migration.md"));
      await expect(fs.access(path.join(defaultNotesRoot, "After Migration.md"))).rejects.toThrow();
    } finally {
      setOptionalEnv("HOME", previousHome);
      setOptionalEnv("USERPROFILE", previousUserProfile);
    }
  });
});
