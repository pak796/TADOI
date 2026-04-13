import { describe, expect, it } from "bun:test";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { runCalendarExportCommand } from "./calendarExport";

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

describe("calendarExport command", () => {
  it("returns parse/validation exit code for invalid options", async () => {
    const { value: code } = await captureConsole(() =>
      runCalendarExportCommand({
        outPath: "",
        range: "next7",
        privacy: "minimal",
        help: false,
      }),
    );
    expect(code).toBe(2);
  });

  it("returns target-resolution exit code for unknown saved view", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "tadoi-calendar-export-cmd-view-"),
    );
    const dataPath = path.join(tempDir, "tadoi_data.json");
    const outPath = path.join(tempDir, "out.ics");
    await fs.writeFile(
      dataPath,
      JSON.stringify(
        { schemaVersion: 4, tasks: [], tagIndex: {}, savedViews: [] },
        null,
        2,
      ),
      "utf8",
    );

    const previousDataPath = process.env.TADOI_DATA_PATH;
    process.env.TADOI_DATA_PATH = dataPath;
    try {
      const { value: code } = await captureConsole(() =>
        runCalendarExportCommand({
          outPath,
          viewName: "Missing",
          range: "next7",
          privacy: "minimal",
          help: false,
        }),
      );
      expect(code).toBe(3);
    } finally {
      if (previousDataPath === undefined) {
        delete process.env.TADOI_DATA_PATH;
      } else {
        process.env.TADOI_DATA_PATH = previousDataPath;
      }
    }
  });

  it("returns filesystem exit code when state path cannot be read", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "tadoi-calendar-export-cmd-fs-"),
    );
    const outPath = path.join(tempDir, "out.ics");

    const previousDataPath = process.env.TADOI_DATA_PATH;
    process.env.TADOI_DATA_PATH = tempDir; // directory path triggers filesystem read error
    try {
      const { value: code } = await captureConsole(() =>
        runCalendarExportCommand({
          outPath,
          range: "next7",
          privacy: "minimal",
          help: false,
        }),
      );
      expect(code).toBe(5);
    } finally {
      if (previousDataPath === undefined) {
        delete process.env.TADOI_DATA_PATH;
      } else {
        process.env.TADOI_DATA_PATH = previousDataPath;
      }
    }
  });
});
