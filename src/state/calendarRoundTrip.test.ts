import { describe, expect, it } from "bun:test";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { exportCalendarIcs } from "./calendarExportService";
import { importCalendarIcs } from "./calendarImportService";
import { validatePersistedState } from "./validation";

type PersistedStateFixture = {
  schemaVersion: number;
  tasks: unknown[];
  tagIndex: Record<string, unknown>;
  savedViews: unknown[];
};

async function loadFixtureRaw(name: string): Promise<string> {
  const fixturePath = fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url).href);
  return fs.readFile(fixturePath, "utf8");
}

async function withRoundTripEnv<T>(
  run: (context: { tempDir: string; dataPath: string }) => Promise<T>
): Promise<T> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-calendar-roundtrip-"));
  const dataPath = path.join(tempDir, "tadoi_data.json");
  const fixture = JSON.parse(
    await loadFixtureRaw("calendar-roundtrip.source.json")
  ) as PersistedStateFixture;
  await fs.writeFile(dataPath, JSON.stringify(fixture, null, 2), "utf8");

  const previousDataPath = process.env.TADOI_DATA_PATH;
  const previousHome = process.env.HOME;
  process.env.TADOI_DATA_PATH = dataPath;
  process.env.HOME = tempDir;
  try {
    return await run({ tempDir, dataPath });
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

describe("calendar export/import round-trip", () => {
  it("round-trips exported ICS updates idempotently without duplicates", async () => {
    await withRoundTripEnv(async ({ tempDir, dataPath }) => {
      const exportPath = path.join(tempDir, "roundtrip-export.ics");
      const modifiedPath = path.join(tempDir, "roundtrip-modified.ics");
      const reportPath = path.join(tempDir, "roundtrip-report.json");

      const exported = await exportCalendarIcs({
        outputPath: exportPath,
        range: "all",
        privacy: "full",
        timeZone: "UTC",
        now: new Date(Date.UTC(2026, 1, 12, 12, 30, 0))
      });
      expect(exported.eventsWritten).toBeGreaterThan(0);

      let modified = await fs.readFile(exported.outputPath, "utf8");
      modified = modified.replace("SUMMARY:Timed source", "SUMMARY:Timed source (updated)");
      const overrideSnippet = await loadFixtureRaw("calendar-roundtrip.override.vevent.ics");
      modified = modified.replace("END:VCALENDAR", `${overrideSnippet}\nEND:VCALENDAR`);
      await fs.writeFile(modifiedPath, modified, "utf8");

      const firstImport = await importCalendarIcs({
        inputPath: modifiedPath,
        range: "all",
        mode: "merge",
        dryRun: false,
        reportPath
      });
      expect(firstImport.hasErrors).toBe(false);
      expect(firstImport.summary.errors).toBe(0);

      const firstState = JSON.parse(await fs.readFile(dataPath, "utf8")) as unknown;
      const firstValidation = validatePersistedState(firstState, "strict");
      expect(firstValidation.ok).toBe(true);
      if (!firstValidation.ok) return;

      const timedTask = firstValidation.data.tasks.find((task) => task.id === "timed-1");
      expect(timedTask?.title).toBe("Timed source (updated)");
      const firstOverrides = firstValidation.data.tasks.filter(
        (task) => task.instance_of?.series_id === "series:root"
      );
      expect(firstOverrides).toHaveLength(1);
      const firstOccurrence = firstOverrides[0]?.instance_of?.occurrence;

      const secondImport = await importCalendarIcs({
        inputPath: modifiedPath,
        range: "all",
        mode: "merge",
        dryRun: false
      });
      expect(secondImport.hasErrors).toBe(false);
      expect(secondImport.summary.errors).toBe(0);

      const secondState = JSON.parse(await fs.readFile(dataPath, "utf8")) as unknown;
      const secondValidation = validatePersistedState(secondState, "strict");
      expect(secondValidation.ok).toBe(true);
      if (!secondValidation.ok) return;

      const secondOverrides = secondValidation.data.tasks.filter(
        (task) => task.instance_of?.series_id === "series:root"
      );
      expect(secondOverrides).toHaveLength(1);
      expect(secondOverrides[0]?.instance_of?.occurrence).toBe(firstOccurrence);
    });
  });
});
