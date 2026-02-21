import { describe, expect, it } from "bun:test";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import {
  CalendarExportUsageError,
  exportCalendarIcs
} from "./calendarExportService";

type PersistedTask = {
  id: string;
  title: string;
  status: "open" | "done" | "archived";
  createdAt: number;
  updatedAt: number;
  dueAt?: number;
  hasExplicitTime?: boolean;
  notes?: string;
  tags: string[];
  links?: Array<{
    id: string;
    target: string;
    label?: string;
    kind?: "url" | "path";
  }>;
  recurrence?: {
    dtstart: string;
    rrule: string;
    exdates?: string[];
    series_id: string;
  };
  instance_of?: {
    series_id: string;
    occurrence: string;
  };
};

async function withTempDataFile<T>(
  payload: { schemaVersion: 4; tasks: PersistedTask[]; tagIndex: Record<string, never>; savedViews: unknown[] },
  run: (context: { tempDir: string; dataPath: string }) => Promise<T>
): Promise<T> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-calendar-export-"));
  const dataPath = path.join(tempDir, "tadoi_data.json");
  await fs.writeFile(dataPath, JSON.stringify(payload, null, 2), "utf8");

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

async function writeInvalidSettings(tempDir: string): Promise<void> {
  const settingsPath = path.join(tempDir, ".config", "tadoi", "settings.json");
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, "{invalid-json", "utf8");
}

async function expectUnixPrivateFileMode(filePath: string): Promise<void> {
  if (process.platform === "win32") return;
  const stat = await fs.stat(filePath);
  expect(stat.mode & 0o077).toBe(0);
}

describe("calendarExportService", () => {
  it("writes deterministic ICS output for a mixed fixture dataset", async () => {
    const payload: {
      schemaVersion: 4;
      tasks: PersistedTask[];
      tagIndex: Record<string, never>;
      savedViews: unknown[];
    } = {
      schemaVersion: 4 as const,
      tasks: [
        {
          id: "all-day-1",
          title: "All day task",
          status: "open" as const,
          createdAt: 1,
          updatedAt: 1,
          dueAt: Date.UTC(2026, 1, 15, 0, 0, 0),
          hasExplicitTime: false,
          notes: "Note line",
          tags: ["work"]
        },
        {
          id: "timed-1",
          title: "Timed task",
          status: "open" as const,
          createdAt: 2,
          updatedAt: 2,
          dueAt: Date.UTC(2026, 1, 16, 14, 0, 0),
          hasExplicitTime: true,
          tags: ["ops"],
          links: [
            {
              id: "link-1",
              target: "https://example.com/task",
              label: "ref",
              kind: "url"
            }
          ]
        },
        {
          id: "series-1",
          title: "Daily standup",
          status: "open" as const,
          createdAt: 3,
          updatedAt: 3,
          dueAt: Date.UTC(2026, 1, 10, 9, 0, 0),
          hasExplicitTime: true,
          tags: ["team"],
          recurrence: {
            dtstart: "2026-02-10T09:00:00",
            rrule: "FREQ=DAILY;INTERVAL=1",
            exdates: ["2026-02-11T09:00:00"],
            series_id: "series:standup"
          }
        },
        {
          id: "inst-1",
          title: "Daily standup (moved)",
          status: "open" as const,
          createdAt: 4,
          updatedAt: 4,
          dueAt: Date.UTC(2026, 1, 12, 11, 0, 0),
          hasExplicitTime: true,
          tags: ["team"],
          instance_of: {
            series_id: "series:standup",
            occurrence: "2026-02-12T09:00:00"
          }
        }
      ],
      tagIndex: {},
      savedViews: []
    };

    await withTempDataFile(payload, async ({ tempDir }) => {
      const outputBasePath = path.join(tempDir, "golden-output");
      const result = await exportCalendarIcs({
        outputPath: outputBasePath,
        range: "all",
        now: new Date(Date.UTC(2026, 1, 12, 12, 30, 0)),
        timeZone: "UTC",
        privacy: "full"
      });

      expect(result.outputPath).toBe(`${outputBasePath}.ics`);
      expect(result.tasksScanned).toBe(4);
      expect(result.eventsWritten).toBe(4);
      expect(result.seriesRruleExported).toBe(1);
      expect(result.instanceOverridesExported).toBe(1);
      expect(result.exdateCount).toBe(1);
      expect(result.privacyApplied).toBe("full");

      const fixturePath = fileURLToPath(
        new URL("./__fixtures__/calendar-export.golden.ics", import.meta.url).href
      );
      const expected = await fs.readFile(fixturePath, "utf8");
      const actual = await fs.readFile(result.outputPath, "utf8");
      expect(actual).toBe(expected);
      await expectUnixPrivateFileMode(result.outputPath);
    });
  });

  it("fails --range all when a recurring task has invalid RRULE", async () => {
    const payload: {
      schemaVersion: 4;
      tasks: PersistedTask[];
      tagIndex: Record<string, never>;
      savedViews: unknown[];
    } = {
      schemaVersion: 4 as const,
      tasks: [
        {
          id: "invalid-series",
          title: "Invalid",
          status: "open" as const,
          createdAt: 1,
          updatedAt: 1,
          dueAt: Date.UTC(2026, 1, 10, 9, 0, 0),
          hasExplicitTime: true,
          tags: [],
          recurrence: {
            dtstart: "2026-02-10T09:00:00",
            rrule: "FREQ=NOPE",
            series_id: "series:invalid"
          }
        }
      ],
      tagIndex: {},
      savedViews: []
    };

    await withTempDataFile(payload, async ({ tempDir }) => {
      let thrown: unknown;
      try {
        await exportCalendarIcs({
          outputPath: path.join(tempDir, "invalid.ics"),
          range: "all",
          now: new Date(Date.UTC(2026, 1, 12, 12, 30, 0)),
          timeZone: "UTC",
          privacy: "minimal"
        });
      } catch (error: unknown) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(CalendarExportUsageError);
    });
  });

  it("uses minimal privacy mode by default", async () => {
    const payload: {
      schemaVersion: 4;
      tasks: PersistedTask[];
      tagIndex: Record<string, never>;
      savedViews: unknown[];
    } = {
      schemaVersion: 4 as const,
      tasks: [
        {
          id: "task-1",
          title: "Task",
          status: "open",
          createdAt: 1,
          updatedAt: 1,
          dueAt: Date.UTC(2026, 1, 15, 10, 0, 0),
          hasExplicitTime: true,
          notes: "Sensitive notes",
          tags: ["private"],
          links: [{ id: "link-1", target: "https://example.com", kind: "url" }]
        }
      ],
      tagIndex: {},
      savedViews: []
    };

    await withTempDataFile(payload, async ({ tempDir }) => {
      const result = await exportCalendarIcs({
        outputPath: path.join(tempDir, "minimal.ics"),
        range: "all",
        now: new Date(Date.UTC(2026, 1, 12, 12, 30, 0)),
        timeZone: "UTC"
      });

      expect(result.privacyApplied).toBe("minimal");
      const actual = await fs.readFile(result.outputPath, "utf8");
      expect(actual).not.toContain("DESCRIPTION:");
      expect(actual).not.toContain("CATEGORIES:");
      expect(actual).not.toContain("\nURL:");
    });
  });

  it("falls back to system timezone when settings file is invalid", async () => {
    const payload: {
      schemaVersion: 4;
      tasks: PersistedTask[];
      tagIndex: Record<string, never>;
      savedViews: unknown[];
    } = {
      schemaVersion: 4 as const,
      tasks: [
        {
          id: "task-1",
          title: "Task",
          status: "open",
          createdAt: 1,
          updatedAt: 1,
          dueAt: Date.UTC(2026, 1, 15, 10, 0, 0),
          hasExplicitTime: true,
          tags: []
        }
      ],
      tagIndex: {},
      savedViews: []
    };

    await withTempDataFile(payload, async ({ tempDir }) => {
      await writeInvalidSettings(tempDir);

      const result = await exportCalendarIcs({
        outputPath: path.join(tempDir, "settings-fallback.ics"),
        range: "all",
        now: new Date(Date.UTC(2026, 1, 12, 12, 30, 0))
      });

      expect(result.eventsWritten).toBe(1);
      expect(
        result.warnings?.some((warning) =>
          warning.includes("settings file is not valid JSON")
        )
      ).toBe(true);
    });
  });
});
