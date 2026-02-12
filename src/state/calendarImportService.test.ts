import { describe, expect, it } from "bun:test";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { importCalendarIcs } from "./calendarImportService";

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

const SERIES_WITH_OVERRIDE_ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//TADOI//EN",
  "BEGIN:VEVENT",
  "UID:tadoi-series-series-root@local",
  "SUMMARY:Daily standup",
  "DTSTART;TZID=America/Chicago:20260210T090000",
  "RRULE:FREQ=DAILY;INTERVAL=1",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:override-1",
  "RELATED-TO:tadoi-series-series-root@local",
  "RECURRENCE-ID;TZID=America/Chicago:20260211T090000",
  "DTSTART;TZID=America/Chicago:20260211T110000",
  "SUMMARY:Daily standup (moved)",
  "END:VEVENT",
  "END:VCALENDAR"
].join("\n");

async function withTempImportEnv<T>(
  setup: { statePayload: unknown; inputIcs: string },
  run: (context: { tempDir: string; dataPath: string; inputPath: string }) => Promise<T>
): Promise<T> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-calendar-import-test-"));
  const dataPath = path.join(tempDir, "tadoi_data.json");
  const inputPath = path.join(tempDir, "incoming.ics");
  await fs.writeFile(dataPath, JSON.stringify(setup.statePayload, null, 2), "utf8");
  await fs.writeFile(inputPath, setup.inputIcs, "utf8");

  const previousDataPath = process.env.TADOI_DATA_PATH;
  const previousHome = process.env.HOME;
  process.env.TADOI_DATA_PATH = dataPath;
  process.env.HOME = tempDir;
  try {
    return await run({ tempDir, dataPath, inputPath });
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
}

describe("calendarImportService import size limits", () => {
  it("enforces ICS import size limits at boundary values", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-calendar-import-size-"));
    const dataPath = path.join(tempDir, "tadoi_data.json");
    const inputPath = path.join(tempDir, "incoming.ics");

    await fs.writeFile(
      dataPath,
      JSON.stringify({ schemaVersion: 4, tasks: [], tagIndex: {}, savedViews: [] }, null, 2),
      "utf8"
    );
    await fs.writeFile(inputPath, SIMPLE_ICS, "utf8");

    const fileSize = (await fs.stat(inputPath)).size;
    const previousDataPath = process.env.TADOI_DATA_PATH;
    const previousHome = process.env.HOME;
    process.env.TADOI_DATA_PATH = dataPath;
    process.env.HOME = tempDir;

    try {
      await expect(
        importCalendarIcs({
          inputPath,
          range: "all",
          mode: "merge",
          dryRun: true,
          maxImportBytes: fileSize - 1
        })
      ).rejects.toThrow("Input ICS exceeds maximum size");

      const atLimit = await importCalendarIcs({
        inputPath,
        range: "all",
        mode: "merge",
        dryRun: true,
        maxImportBytes: fileSize
      });
      expect(atLimit.summary.eventsParsed).toBe(1);

      const underLimit = await importCalendarIcs({
        inputPath,
        range: "all",
        mode: "merge",
        dryRun: true,
        maxImportBytes: fileSize + 1
      });
      expect(underLimit.summary.eventsParsed).toBe(1);
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
});

describe("calendarImportService import flow", () => {
  it("does not persist state during dry-run but still writes report output", async () => {
    await withTempImportEnv(
      {
        statePayload: { schemaVersion: 4, tasks: [], tagIndex: {}, savedViews: [] },
        inputIcs: SIMPLE_ICS
      },
      async ({ tempDir, dataPath, inputPath }) => {
        const before = await fs.readFile(dataPath, "utf8");
        const reportPath = path.join(tempDir, "dryrun-report.json");
        const result = await importCalendarIcs({
          inputPath,
          range: "all",
          mode: "merge",
          dryRun: true,
          reportPath
        });

        expect(result.report.persisted).toBe(false);
        expect(result.summary.created).toBe(1);
        const after = await fs.readFile(dataPath, "utf8");
        expect(after).toBe(before);
        const reportRaw = await fs.readFile(reportPath, "utf8");
        const report = JSON.parse(reportRaw) as { dryRun: boolean; persisted: boolean };
        expect(report.dryRun).toBe(true);
        expect(report.persisted).toBe(false);
      }
    );
  });

  it("keeps recurrence override imports idempotent across repeated commits", async () => {
    await withTempImportEnv(
      {
        statePayload: { schemaVersion: 4, tasks: [], tagIndex: {}, savedViews: [] },
        inputIcs: SERIES_WITH_OVERRIDE_ICS
      },
      async ({ dataPath, inputPath }) => {
        const first = await importCalendarIcs({
          inputPath,
          range: "all",
          mode: "merge",
          dryRun: false
        });
        expect(first.hasErrors).toBe(false);
        expect(first.summary.recurringSeriesImported).toBe(1);
        expect(first.summary.overridesCreated).toBe(1);

        const firstPersisted = JSON.parse(await fs.readFile(dataPath, "utf8")) as {
          tasks: Array<{ recurrence?: unknown; instance_of?: unknown }>;
        };
        expect(firstPersisted.tasks.length).toBe(2);
        expect(
          firstPersisted.tasks.filter((task) => Boolean(task.recurrence)).length
        ).toBe(1);
        expect(
          firstPersisted.tasks.filter((task) => Boolean(task.instance_of)).length
        ).toBe(1);

        const second = await importCalendarIcs({
          inputPath,
          range: "all",
          mode: "merge",
          dryRun: false
        });
        expect(second.hasErrors).toBe(false);

        const secondPersisted = JSON.parse(await fs.readFile(dataPath, "utf8")) as {
          tasks: Array<{ recurrence?: unknown; instance_of?: unknown }>;
        };
        expect(secondPersisted.tasks.length).toBe(2);
        expect(
          secondPersisted.tasks.filter((task) => Boolean(task.instance_of)).length
        ).toBe(1);
      }
    );
  });
});
