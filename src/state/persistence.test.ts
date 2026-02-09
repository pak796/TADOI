import { describe, expect, it } from "bun:test";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import {
  LoadedData,
  PersistenceFsOps,
  resolveDataPath,
  safeLoadState,
  saveStateDebounced
} from "./persistence";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "todui-persist-test-"));
}

async function loadFixture(name: string): Promise<string> {
  const fixturePath = decodeURIComponent(
    new URL(`./__fixtures__/${name}`, import.meta.url).pathname
  );
  return fs.readFile(fixturePath, "utf8");
}

describe("resolveDataPath", () => {
  it("uses TODUI_DATA_PATH override when set", () => {
    const resolved = resolveDataPath({
      platform: "linux",
      env: { TODUI_DATA_PATH: "data/custom.json" },
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
    expect(resolved).toBe("/xdg/data/todui/todui_data.json");
  });

  it("uses linux fallback path when XDG_DATA_HOME is unset", () => {
    const resolved = resolveDataPath({
      platform: "linux",
      env: {},
      homeDir: "/home/patrick"
    });
    expect(resolved).toBe("/home/patrick/.local/share/todui/todui_data.json");
  });

  it("uses macOS app support path", () => {
    const resolved = resolveDataPath({
      platform: "darwin",
      env: {},
      homeDir: "/Users/patrick"
    });
    expect(resolved).toBe("/Users/patrick/Library/Application Support/todui/todui_data.json");
  });

  it("uses windows APPDATA or fallback", () => {
    const withAppData = resolveDataPath({
      platform: "win32",
      env: { APPDATA: "C:\\\\Users\\\\Patrick\\\\AppData\\\\Roaming" },
      homeDir: "C:\\\\Users\\\\Patrick",
      cwd: "C:\\\\repo"
    });
    expect(withAppData).toBe("C:\\Users\\Patrick\\AppData\\Roaming\\todui\\todui_data.json");

    const fallback = resolveDataPath({
      platform: "win32",
      env: {},
      homeDir: "C:\\\\Users\\\\Patrick",
      cwd: "C:\\\\repo"
    });
    expect(fallback).toBe("C:\\Users\\Patrick\\AppData\\Roaming\\todui\\todui_data.json");
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

  it("backs up malformed JSON and returns recovery state with banner", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "todui_data.json");
    await fs.writeFile(filePath, "{broken json", "utf8");

    const result = await safeLoadState({ filePath, now: new Date("2026-02-09T10:00:00") });
    expect(result.shouldPersistRecoveredState).toBe(true);
    expect(result.bannerMessage).toContain("Data file was corrupt and was backed up to");

    const files = await fs.readdir(dir);
    expect(files.some((name) => name.startsWith("todui_data.json.corrupt."))).toBe(true);
  });

  it("routes invalid shape to corruption recovery path", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "todui_data.json");
    await fs.writeFile(filePath, await loadFixture("persisted.invalid.json"), "utf8");

    const result = await safeLoadState({ filePath, now: new Date("2026-02-09T11:00:00") });
    expect(result.shouldPersistRecoveredState).toBe(true);
    expect(result.data.tasks).toHaveLength(0);
    expect(result.bannerMessage).toContain("Data file was corrupt and was backed up to");
  });

  it("routes migration failures to corruption recovery path", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "todui_data.json");
    await fs.writeFile(
      filePath,
      JSON.stringify({ schemaVersion: 99, tasks: [], tagIndex: {} }),
      "utf8"
    );

    const result = await safeLoadState({ filePath, now: new Date("2026-02-09T12:00:00") });
    expect(result.shouldPersistRecoveredState).toBe(true);
    expect(result.data.tasks).toHaveLength(0);
  });

  it("falls back to copy when rename backup fails", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "todui_data.json");
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
    const filePath = path.join(dir, "todui_data.json");
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
      name.startsWith("todui_data.json.corrupt.")
    );
    expect(backups).toHaveLength(1);
  });

  it("allows separate backups for different corrupt paths in the same session", async () => {
    const dir = await makeTempDir();
    const firstPath = path.join(dir, "todui_data_a.json");
    const secondPath = path.join(dir, "todui_data_b.json");
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

describe("saveStateDebounced", () => {
  it("coalesces rapid writes and persists latest payload", async () => {
    const dir = await makeTempDir();
    const filePath = path.join(dir, "todui_data.json");
    const first: LoadedData = {
      schemaVersion: 2,
      tasks: [{ id: "a", title: "a", status: "open", createdAt: 1, updatedAt: 1, tags: [] }],
      tagIndex: {}
    };
    const second: LoadedData = {
      schemaVersion: 2,
      tasks: [{ id: "b", title: "b", status: "open", createdAt: 1, updatedAt: 1, tags: [] }],
      tagIndex: {}
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
    const nestedFilePath = path.join(dir, "nested", "deep", "todui_data.json");
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
        schemaVersion: 2,
        tasks: [
          { id: "nested", title: "nested", status: "open", createdAt: 1, updatedAt: 1, tags: [] }
        ],
        tagIndex: {}
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
    const filePath = path.join(dir, "todui_data.json");
    const events: Array<{ ok: boolean; filePath: string; savedAt?: number }> = [];

    saveStateDebounced(
      {
        schemaVersion: 2,
        tasks: [{ id: "ok", title: "ok", status: "open", createdAt: 1, updatedAt: 1, tags: [] }],
        tagIndex: {}
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
    const filePath = path.join(dir, "todui_data.json");
    const errors: Error[] = [];
    const fsOps: PersistenceFsOps = {
      ...fs,
      writeFile: async () => {
        throw new Error("disk full");
      }
    };

    saveStateDebounced(
      {
        schemaVersion: 2,
        tasks: [
          { id: "fail", title: "fail", status: "open", createdAt: 1, updatedAt: 1, tags: [] }
        ],
        tagIndex: {}
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
