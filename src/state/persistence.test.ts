import { describe, expect, it } from "bun:test";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import {
  createDataBackup,
  LoadedData,
  loadStateStrict,
  PersistenceFsOps,
  nextTimestampedSiblingPath,
  resolveDataPath,
  safeLoadState,
  saveStateDebounced,
  writeJsonAtomic
} from "./persistence";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "tadoi-persist-test-"));
}

async function loadFixture(name: string): Promise<string> {
  const fixturePath = fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url).href);
  return fs.readFile(fixturePath, "utf8");
}

describe("resolveDataPath", () => {
  it("uses TADOI_DATA_PATH override when set", () => {
    const resolved = resolveDataPath({
      platform: "linux",
      env: { TADOI_DATA_PATH: "data/custom.json" },
      cwd: "/repo",
      homeDir: "/home/patrick"
    });
    expect(resolved).toBe("/repo/data/custom.json");
  });

  it("uses linux XDG path when set", () => {
    const resolved = resolveDataPath({
      platform: "linux",
      env: { XDG_DATA_HOME: "/xdg/data" },
      homeDir: "/home/patrick"
    });
    expect(resolved).toBe("/xdg/data/tadoi/tadoi_data.json");
  });

  it("uses linux fallback path when XDG_DATA_HOME is unset", () => {
    const resolved = resolveDataPath({
      platform: "linux",
      env: {},
      homeDir: "/home/patrick"
    });
    expect(resolved).toBe("/home/patrick/.local/share/tadoi/tadoi_data.json");
  });

  it("uses macOS app support path", () => {
    const resolved = resolveDataPath({
      platform: "darwin",
      env: {},
      homeDir: "/Users/patrick"
    });
    expect(resolved).toBe("/Users/patrick/Library/Application Support/tadoi/tadoi_data.json");
  });

  it("uses windows APPDATA or fallback", () => {
    const withAppData = resolveDataPath({
      platform: "win32",
      env: { APPDATA: "C:\\\\Users\\\\Patrick\\\\AppData\\\\Roaming" },
      homeDir: "C:\\\\Users\\\\Patrick",
      cwd: "C:\\\\repo"
    });
    expect(withAppData).toBe("C:\\Users\\Patrick\\AppData\\Roaming\\tadoi\\tadoi_data.json");

    const fallback = resolveDataPath({
      platform: "win32",
      env: {},
      homeDir: "C:\\\\Users\\\\Patrick",
      cwd: "C:\\\\repo"
    });
    expect(fallback).toBe("C:\\Users\\Patrick\\AppData\\Roaming\\tadoi\\tadoi_data.json");
  });
});

describe("safeLoadState", () => {
  it("returns empty state when file is missing", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "missing.json");
    const result = await safeLoadState({ filePath });
    expect(result.data.tasks).toHaveLength(0);
    expect(result.bannerMessage).toBeUndefined();
    expect(result.shouldPersistRecoveredState).toBe(false);
  });

  it("does not treat non-ENOENT read failures as corruption recovery", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "tadoi_data.json");
    await fs.writeFile(filePath, await loadFixture("persisted.v5.json"), "utf8");

    const fsOps: PersistenceFsOps = {
      ...fs,
      readFile: (async () => {
        throw Object.assign(new Error("permission denied"), { code: "EACCES" });
      }) as PersistenceFsOps["readFile"]
    };

    const result = await safeLoadState({ filePath, fsOps });
    expect(result.data.tasks).toHaveLength(0);
    expect(result.shouldPersistRecoveredState).toBe(false);
    expect(result.corruptBackupPath).toBeUndefined();
    expect(result.bannerMessage).toContain("Unable to read data file");

    const files = await fs.readdir(dir);
    expect(files.some((name) => name.includes(".corrupt."))).toBe(false);
    expect(files).toContain("tadoi_data.json");
  });

  it("backs up malformed JSON and returns recovery state with banner", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "tadoi_data.json");
    await fs.writeFile(filePath, "{broken json", "utf8");

    const result = await safeLoadState({ filePath, now: new Date("2026-02-09T10:00:00") });
    expect(result.shouldPersistRecoveredState).toBe(true);
    expect(result.bannerMessage).toContain("Data file was corrupt and was backed up to");

    const files = await fs.readdir(dir);
    expect(files.some((name) => name.startsWith("tadoi_data.json.corrupt."))).toBe(true);
  });

  it("routes invalid shape to corruption recovery path", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "tadoi_data.json");
    await fs.writeFile(filePath, await loadFixture("persisted.invalid.json"), "utf8");

    const result = await safeLoadState({ filePath, now: new Date("2026-02-09T11:00:00") });
    expect(result.shouldPersistRecoveredState).toBe(true);
    expect(result.data.tasks).toHaveLength(0);
    expect(result.bannerMessage).toContain("Data file was corrupt and was backed up to");
  });

  it("routes migration failures to corruption recovery path", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "tadoi_data.json");
    await fs.writeFile(
      filePath,
      JSON.stringify({ schemaVersion: 99, tasks: [], tagIndex: {}, savedViews: [] }),
      "utf8"
    );

    const result = await safeLoadState({ filePath, now: new Date("2026-02-09T12:00:00") });
    expect(result.shouldPersistRecoveredState).toBe(true);
    expect(result.data.tasks).toHaveLength(0);
  });

  it("falls back to copy when rename backup fails", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "tadoi_data.json");
    await fs.writeFile(filePath, "{broken json", "utf8");

    const fsOps: PersistenceFsOps = {
      ...fs,
      rename: async () => {
        throw Object.assign(new Error("rename failed"), { code: "EXDEV" });
      }
    };

    const result = await safeLoadState({
      filePath,
      now: new Date("2026-02-09T13:00:00"),
      fsOps
    });
    expect(result.shouldPersistRecoveredState).toBe(true);
    expect(result.corruptBackupPath).toBeDefined();
    if (result.corruptBackupPath) {
      const backupExists = await fs
        .stat(result.corruptBackupPath)
        .then(() => true)
        .catch(() => false);
      expect(backupExists).toBe(true);
    }
  });

  it("creates at most one backup per session for the same corrupt path", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "tadoi_data.json");
    await fs.writeFile(filePath, "{broken json", "utf8");

    const fsOps: PersistenceFsOps = {
      ...fs,
      rename: async () => {
        throw Object.assign(new Error("rename failed"), { code: "EXDEV" });
      }
    };

    await safeLoadState({
      filePath,
      now: new Date("2026-02-09T14:00:00"),
      fsOps
    });
    await safeLoadState({
      filePath,
      now: new Date("2026-02-09T14:10:00"),
      fsOps
    });

    const files = await fs.readdir(dir);
    const backups = files.filter((name) =>
      name.startsWith("tadoi_data.json.corrupt.")
    );
    expect(backups).toHaveLength(1);
  });

  it("allows separate backups for different corrupt paths in the same session", async () => {
    const dir = await makeTempDir();
    const firstPath = path.join(dir, "tadoi_data_a.json");
    const secondPath = path.join(dir, "tadoi_data_b.json");
    await fs.writeFile(firstPath, "{broken", "utf8");
    await fs.writeFile(secondPath, "{broken", "utf8");

    await safeLoadState({
      filePath: firstPath,
      now: new Date("2026-02-09T15:00:00")
    });
    await safeLoadState({
      filePath: secondPath,
      now: new Date("2026-02-09T15:01:00")
    });

    const files = await fs.readdir(dir);
    const backups = files.filter((name) => name.includes(".corrupt."));
    expect(backups).toHaveLength(2);
  });
});

describe("loadStateStrict", () => {
  it("returns empty state when file is missing", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "missing.json");
    const result = await loadStateStrict({ filePath });
    expect(result.data.tasks).toHaveLength(0);
    expect(result.didMigrate).toBe(false);
  });

  it("accepts priority-aware canonical task tags", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "tadoi_data.json");
    const payload: LoadedData = {
      schemaVersion: 4,
      tasks: [
        {
          id: "priority-task",
          title: "Priority task",
          status: "open",
          createdAt: 1,
          updatedAt: 1,
          tags: ["#p2", "work", "home"]
        }
      ],
      tagIndex: {},
      savedViews: []
    };
    await fs.writeFile(filePath, JSON.stringify(payload), "utf8");

    const result = await loadStateStrict({ filePath });
    expect(result.data.tasks[0]?.tags).toEqual(["#p2", "work", "home"]);
  });

  it("throws on malformed json without mutating files", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "tadoi_data.json");
    await fs.writeFile(filePath, "{broken", "utf8");

    await expect(loadStateStrict({ filePath })).rejects.toThrow("Failed to parse JSON");
    const files = await fs.readdir(dir);
    expect(files.some((name) => name.includes(".corrupt."))).toBe(false);
  });
});

describe("backup helpers", () => {
  it("creates timestamped backup copies with deterministic suffixing", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "tadoi_data.json");
    await fs.writeFile(filePath, "{\"ok\":true}", "utf8");

    const now = new Date("2026-02-10T12:34:56");
    const firstBackup = await createDataBackup(filePath, { now });
    const secondBackup = await createDataBackup(filePath, { now });

    expect(firstBackup).toBeDefined();
    expect(secondBackup).toBeDefined();
    expect(path.basename(firstBackup as string)).toMatch(
      /^tadoi_data\.json\.backup\.20260210-123456$/
    );
    expect(path.basename(secondBackup as string)).toMatch(
      /^tadoi_data\.json\.backup\.20260210-123456\.1$/
    );

    const copiedRaw = await fs.readFile(firstBackup as string, "utf8");
    expect(copiedRaw).toBe("{\"ok\":true}");
  });

  it("returns undefined when source backup file is missing", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "missing.json");
    const backup = await createDataBackup(filePath, { now: new Date("2026-02-10T00:00:00") });
    expect(backup).toBeUndefined();
  });

  it("builds next timestamped sibling path for backup and corrupt labels", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "tadoi_data.json");
    await fs.writeFile(path.join(dir, "tadoi_data.json.backup.20260210-120000"), "", "utf8");
    await fs.writeFile(path.join(dir, "tadoi_data.json.corrupt.20260210-120000"), "", "utf8");

    const backupPath = await nextTimestampedSiblingPath(filePath, "backup", {
      now: new Date("2026-02-10T12:00:00")
    });
    const corruptPath = await nextTimestampedSiblingPath(filePath, "corrupt", {
      now: new Date("2026-02-10T12:00:00")
    });

    expect(path.basename(backupPath)).toBe("tadoi_data.json.backup.20260210-120000.1");
    expect(path.basename(corruptPath)).toBe("tadoi_data.json.corrupt.20260210-120000.1");
  });
});

describe("writeJsonAtomic", () => {
  it("uses unique sibling temp paths for concurrent writes", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "tadoi_data.json");
    const tempWrites: string[] = [];

    const fsOps: PersistenceFsOps = {
      ...fs,
      writeFile: (async (targetPath, data, options) => {
        const asString = String(targetPath);
        if (asString.includes(".tmp-")) {
          tempWrites.push(asString);
          expect(asString.endsWith(".tmp")).toBe(false);
        }
        return fs.writeFile(
          targetPath,
          data as Parameters<typeof fs.writeFile>[1],
          options as Parameters<typeof fs.writeFile>[2]
        );
      }) as PersistenceFsOps["writeFile"]
    };

    await Promise.all([
      writeJsonAtomic({ marker: "one" }, { filePath, fsOps }),
      writeJsonAtomic({ marker: "two" }, { filePath, fsOps })
    ]);

    expect(tempWrites.length).toBeGreaterThanOrEqual(2);
    expect(new Set(tempWrites).size).toBe(tempWrites.length);
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8")) as { marker: string };
    expect(["one", "two"]).toContain(parsed.marker);
  });

  it("fsyncs before rename when requested", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "tadoi_data.json");
    let syncCalled = false;

    const fsOps: PersistenceFsOps = {
      ...fs,
      open: (async () =>
        ({
          sync: async () => {
            syncCalled = true;
          },
          close: async () => {}
        }) as Awaited<ReturnType<typeof fs.open>>) as PersistenceFsOps["open"]
    };

    await writeJsonAtomic(
      { ok: true },
      { filePath, fsOps, fsyncBeforeRename: true, pretty: false }
    );
    expect(syncCalled).toBe(true);
  });
});

describe("saveStateDebounced", () => {
  it("coalesces rapid writes and persists latest payload", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "tadoi_data.json");
    const first: LoadedData = {
      schemaVersion: 4,
      tasks: [{ id: "a", title: "a", status: "open", createdAt: 1, updatedAt: 1, tags: [] }],
      tagIndex: {},
      savedViews: []
    };
    const second: LoadedData = {
      schemaVersion: 4,
      tasks: [{ id: "b", title: "b", status: "open", createdAt: 1, updatedAt: 1, tags: [] }],
      tagIndex: {},
      savedViews: []
    };

    saveStateDebounced(first, 25, filePath);
    saveStateDebounced(second, 25, filePath);

    await sleep(100);
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as { tasks: Array<{ id: string }> };
    expect(parsed.tasks[0].id).toBe("b");
  });

  it("creates parent directories for nested save paths", async () => {
    const dir = await makeTempDir();
    const nestedFilePath = path.join(dir, "nested", "deep", "tadoi_data.json");
    const mkdirCalls: string[] = [];
    const fsOps: PersistenceFsOps = {
      ...fs,
      mkdir: (async (targetPath, options) => {
        mkdirCalls.push(String(targetPath));
        return fs.mkdir(targetPath, options as Parameters<typeof fs.mkdir>[1]);
      }) as PersistenceFsOps["mkdir"]
    };

    saveStateDebounced(
      {
        schemaVersion: 4,
        tasks: [
          { id: "nested", title: "nested", status: "open", createdAt: 1, updatedAt: 1, tags: [] }
        ],
        tagIndex: {},
        savedViews: []
      } satisfies LoadedData,
      25,
      nestedFilePath,
      fsOps
    );

    await sleep(100);
    expect(mkdirCalls.some((call) => call.endsWith(path.join("nested", "deep")))).toBe(true);
    const exists = await fs
      .stat(nestedFilePath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });

  it("emits save result callback on success", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "tadoi_data.json");
    const events: Array<{ ok: boolean; filePath: string; savedAt?: number }> = [];

    saveStateDebounced(
      {
        schemaVersion: 4,
        tasks: [{ id: "ok", title: "ok", status: "open", createdAt: 1, updatedAt: 1, tags: [] }],
        tagIndex: {},
        savedViews: []
      } satisfies LoadedData,
      25,
      filePath,
      fs,
      (result) => {
        events.push({
          ok: result.ok,
          filePath: result.filePath,
          savedAt: result.ok ? result.savedAt : undefined
        });
      }
    );

    await sleep(100);
    expect(events).toHaveLength(1);
    expect(events[0].ok).toBe(true);
    expect(events[0].filePath).toBe(filePath);
    expect(typeof events[0].savedAt).toBe("number");
  });

  it("emits save result callback on failure", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "tadoi_data.json");
    const errors: Error[] = [];
    const fsOps: PersistenceFsOps = {
      ...fs,
      writeFile: async () => {
        throw new Error("disk full");
      }
    };

    saveStateDebounced(
      {
        schemaVersion: 4,
        tasks: [
          { id: "fail", title: "fail", status: "open", createdAt: 1, updatedAt: 1, tags: [] }
        ],
        tagIndex: {},
        savedViews: []
      } satisfies LoadedData,
      25,
      filePath,
      fsOps,
      (result) => {
        if (!result.ok) {
          errors.push(result.error);
          expect(result.filePath).toBe(filePath);
        }
      }
    );

    await sleep(100);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("disk full");
  });
});
