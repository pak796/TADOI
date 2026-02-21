import { describe, expect, it } from "bun:test";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import {
  parseExportArgs,
  parseImportArgs,
  runPortabilityCommand
} from "./portabilityCommands";
import { createDefaultLockPayload, getTadoiLockPath, writeTadoiLock } from "../state/lockfile";

describe("parseExportArgs", () => {
  it("requires --out", () => {
    const parsed = parseExportArgs([]);
    expect(parsed.ok).toBe(false);
  });

  it("rejects unknown flags", () => {
    const parsed = parseExportArgs(["--out", "./export.json", "--wat"]);
    expect(parsed.ok).toBe(false);
  });

  it("parses redact mode and legacy --redact alias", () => {
    const strict = parseExportArgs([
      "--out",
      "./export.json",
      "--redact-mode",
      "strict"
    ]);
    expect(strict.ok).toBe(true);
    if (strict.ok) {
      expect(strict.value.redactMode).toBe("strict");
    }

    const legacy = parseExportArgs(["--out", "./export.json", "--redact"]);
    expect(legacy.ok).toBe(true);
    if (legacy.ok) {
      expect(legacy.value.redact).toBe(true);
    }
  });

  it("rejects invalid redact modes", () => {
    const parsed = parseExportArgs([
      "--out",
      "./export.json",
      "--redact-mode",
      "max"
    ]);
    expect(parsed.ok).toBe(false);
  });
});

describe("parseImportArgs", () => {
  it("uses merge and backup defaults", () => {
    const parsed = parseImportArgs(["--in", "./import.json"]);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.mode).toBe("merge");
    expect(parsed.value.backup).toBe(true);
    expect(parsed.value.dryRun).toBe(false);
  });

  it("parses backup=false and --no-backup", () => {
    const fromEquals = parseImportArgs([
      "--in",
      "./import.json",
      "--backup=false"
    ]);
    expect(fromEquals.ok).toBe(true);
    if (fromEquals.ok) {
      expect(fromEquals.value.backup).toBe(false);
    }

    const fromNoBackup = parseImportArgs([
      "--in",
      "./import.json",
      "--no-backup"
    ]);
    expect(fromNoBackup.ok).toBe(true);
    if (fromNoBackup.ok) {
      expect(fromNoBackup.value.backup).toBe(false);
    }
  });

  it("rejects invalid mode", () => {
    const parsed = parseImportArgs(["--in", "./import.json", "--mode", "nope"]);
    expect(parsed.ok).toBe(false);
  });
});

describe("runPortabilityCommand", () => {
  it("requires --yes for replace mode", async () => {
    const code = await runPortabilityCommand("import", [
      "--in",
      "./import.json",
      "--mode",
      "replace"
    ]);
    expect(code).toBe(1);
  });

  it("imports legacy file without schemaVersion in dry-run mode", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-import-dryrun-"));
    const dataPath = path.join(tempDir, "tadoi_data.json");
    const fixturePath = fileURLToPath(
      new URL("../state/__fixtures__/persisted.legacy.no-schema.json", import.meta.url).href
    );

    const originalDataPath = process.env.TADOI_DATA_PATH;
    process.env.TADOI_DATA_PATH = dataPath;
    try {
      const code = await runPortabilityCommand("import", [
        "--in",
        fixturePath,
        "--mode",
        "merge",
        "--dry-run"
      ]);
      expect(code).toBe(0);
    } finally {
      if (originalDataPath === undefined) {
        delete process.env.TADOI_DATA_PATH;
      } else {
        process.env.TADOI_DATA_PATH = originalDataPath;
      }
    }
  });

  it("creates a backup before replace overwrite", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-import-backup-"));
    const dataPath = path.join(tempDir, "tadoi_data.json");
    const importPath = path.join(tempDir, "incoming.json");

    const localPayload = {
      schemaVersion: 4,
      tasks: [
        {
          id: "task-1",
          title: "LOCAL",
          status: "open",
          createdAt: 1,
          updatedAt: 1,
          tags: ["local"]
        }
      ],
      tagIndex: {},
      savedViews: []
    };
    const incomingPayload = {
      schemaVersion: 4,
      tasks: [
        {
          id: "task-2",
          title: "INCOMING",
          status: "open",
          createdAt: 2,
          updatedAt: 2,
          tags: ["incoming"]
        }
      ],
      tagIndex: {},
      savedViews: []
    };

    await fs.writeFile(dataPath, JSON.stringify(localPayload, null, 2), "utf8");
    await fs.writeFile(importPath, JSON.stringify(incomingPayload, null, 2), "utf8");

    const originalDataPath = process.env.TADOI_DATA_PATH;
    process.env.TADOI_DATA_PATH = dataPath;
    try {
      const code = await runPortabilityCommand("import", [
        "--in",
        importPath,
        "--mode",
        "replace",
        "--backup",
        "--yes"
      ]);
      expect(code).toBe(0);
    } finally {
      if (originalDataPath === undefined) {
        delete process.env.TADOI_DATA_PATH;
      } else {
        process.env.TADOI_DATA_PATH = originalDataPath;
      }
    }

    const files = await fs.readdir(tempDir);
    const backupName = files.find((name) =>
      /^tadoi_data\.json\.backup\.\d{8}-\d{6}(\.\d+)?$/.test(name)
    );
    expect(backupName).toBeDefined();

    const backupRaw = await fs.readFile(path.join(tempDir, backupName as string), "utf8");
    const backupJson = JSON.parse(backupRaw) as { tasks: Array<{ title: string }> };
    expect(backupJson.tasks[0]?.title).toBe("LOCAL");

    const nextRaw = await fs.readFile(dataPath, "utf8");
    const nextJson = JSON.parse(nextRaw) as { tasks: Array<{ title: string }> };
    expect(nextJson.tasks[0]?.title).toBe("INCOMING");
  });

  it("blocks import commit when lock file is present", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-import-locked-"));
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

    const lockPath = getTadoiLockPath(dataPath);
    await writeTadoiLock(lockPath, createDefaultLockPayload(dataPath));

    const originalDataPath = process.env.TADOI_DATA_PATH;
    process.env.TADOI_DATA_PATH = dataPath;
    try {
      const code = await runPortabilityCommand("import", [
        "--in",
        importPath,
        "--mode",
        "replace",
        "--yes"
      ]);
      expect(code).toBe(1);
    } finally {
      if (originalDataPath === undefined) {
        delete process.env.TADOI_DATA_PATH;
      } else {
        process.env.TADOI_DATA_PATH = originalDataPath;
      }
    }

    const postRaw = await fs.readFile(dataPath, "utf8");
    const post = JSON.parse(postRaw) as { tasks: unknown[] };
    expect(post.tasks).toHaveLength(0);
  });
});
