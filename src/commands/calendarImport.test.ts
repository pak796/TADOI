import { describe, expect, it } from "bun:test";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { runCalendarImportCommand } from "./calendarImport";
import { createDefaultLockPayload, getTadoiLockPath, writeTadoiLock } from "../state/lockfile";

const SIMPLE_ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//TADOI//EN",
  "BEGIN:VEVENT",
  "UID:event-1",
  "SUMMARY:Import me",
  "DTSTART:20260212T090000",
  "DTEND:20260212T093000",
  "END:VEVENT",
  "END:VCALENDAR"
].join("\n");

async function captureConsole<T>(run: () => Promise<T>): Promise<{
  value: T;
  logs: string[];
  errors: string[];
}> {
  const logs: string[] = [];
  const errors: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (value?: unknown) => {
    logs.push(String(value ?? ""));
  };
  console.error = (value?: unknown) => {
    errors.push(String(value ?? ""));
  };
  try {
    const value = await run();
    return { value, logs, errors };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

describe("calendarImport command", () => {
  it("returns usage exit code for invalid options", async () => {
    const { value: code } = await captureConsole(() =>
      runCalendarImportCommand({
        inPath: "",
        range: "next7",
        mode: "merge",
        horizonDays: 365,
        dryRun: true,
        help: false
      })
    );
    expect(code).toBe(1);
  });

  it("returns filesystem exit code when state path cannot be read", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-calendar-import-cmd-fs-"));
    const inputPath = path.join(tempDir, "incoming.ics");
    await fs.writeFile(inputPath, SIMPLE_ICS, "utf8");

    const previousDataPath = process.env.TADOI_DATA_PATH;
    process.env.TADOI_DATA_PATH = tempDir; // directory path triggers filesystem read error
    try {
      const { value: code } = await captureConsole(() =>
        runCalendarImportCommand({
          inPath: inputPath,
          range: "all",
          mode: "merge",
          horizonDays: 365,
          dryRun: true,
          help: false
        })
      );
      expect(code).toBe(2);
    } finally {
      if (previousDataPath === undefined) {
        delete process.env.TADOI_DATA_PATH;
      } else {
        process.env.TADOI_DATA_PATH = previousDataPath;
      }
    }
  });

  it("prints summary output for successful dry-run and commit", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-calendar-import-cmd-ok-"));
    const dataPath = path.join(tempDir, "tadoi_data.json");
    const inputPath = path.join(tempDir, "incoming.ics");
    await fs.writeFile(
      dataPath,
      JSON.stringify({ schemaVersion: 4, tasks: [], tagIndex: {}, savedViews: [] }, null, 2),
      "utf8"
    );
    await fs.writeFile(inputPath, SIMPLE_ICS, "utf8");

    const previousDataPath = process.env.TADOI_DATA_PATH;
    const previousHome = process.env.HOME;
    process.env.TADOI_DATA_PATH = dataPath;
    process.env.HOME = tempDir;

    try {
      const dryRun = await captureConsole(() =>
        runCalendarImportCommand({
          inPath: inputPath,
          range: "all",
          mode: "merge",
          horizonDays: 365,
          dryRun: true,
          help: false
        })
      );
      expect(dryRun.value).toBe(0);
      const dryRunOutput = dryRun.logs.join("\n");
      expect(dryRunOutput).toContain("[calendar:import] events parsed: 1 (dry-run)");
      expect(dryRunOutput).toContain("[calendar:import] created: 1");

      const commit = await captureConsole(() =>
        runCalendarImportCommand({
          inPath: inputPath,
          range: "all",
          mode: "merge",
          horizonDays: 365,
          dryRun: false,
          help: false
        })
      );
      expect(commit.value).toBe(0);
      const commitOutput = commit.logs.join("\n");
      expect(commitOutput).toContain("[calendar:import] events parsed: 1");
      expect(commitOutput).toContain("[calendar:import] created: 1");
      expect(commitOutput).toContain("[calendar:import] errors: 0");
    } finally {
      if (previousDataPath === undefined) {
        delete process.env.TADOI_DATA_PATH;
      } else {
        process.env.TADOI_DATA_PATH = previousDataPath;
      }
      if (previousHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = previousHome;
      }
    }
  });

  it("blocks commit when lock file is present", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-calendar-import-cmd-lock-"));
    const dataPath = path.join(tempDir, "tadoi_data.json");
    const inputPath = path.join(tempDir, "incoming.ics");
    await fs.writeFile(
      dataPath,
      JSON.stringify({ schemaVersion: 4, tasks: [], tagIndex: {}, savedViews: [] }, null, 2),
      "utf8"
    );
    await fs.writeFile(inputPath, SIMPLE_ICS, "utf8");

    const lockPath = getTadoiLockPath(dataPath);
    await writeTadoiLock(lockPath, createDefaultLockPayload(dataPath));

    const previousDataPath = process.env.TADOI_DATA_PATH;
    process.env.TADOI_DATA_PATH = dataPath;
    try {
      const { value: code } = await captureConsole(() =>
        runCalendarImportCommand({
          inPath: inputPath,
          range: "all",
          mode: "merge",
          horizonDays: 365,
          dryRun: false,
          help: false
        })
      );
      expect(code).toBe(1);
    } finally {
      if (previousDataPath === undefined) {
        delete process.env.TADOI_DATA_PATH;
      } else {
        process.env.TADOI_DATA_PATH = previousDataPath;
      }
    }

    const postRaw = await fs.readFile(dataPath, "utf8");
    const post = JSON.parse(postRaw) as { tasks: unknown[] };
    expect(post.tasks).toHaveLength(0);
  });
});
