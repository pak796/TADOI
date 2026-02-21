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

const OVERRIDE_ONLY_ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//TADOI//EN",
  "BEGIN:VEVENT",
  "UID:override-only-1",
  "RELATED-TO:tadoi-series-series-root@local",
  "RECURRENCE-ID:20260211T090000",
  "DTSTART:20260211T110000",
  "SUMMARY:Daily standup (moved)",
  "CATEGORIES:team",
  "END:VEVENT",
  "END:VCALENDAR"
].join("\n");

const CANCELLED_OVERRIDE_ONLY_ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//TADOI//EN",
  "BEGIN:VEVENT",
  "UID:override-cancelled-1",
  "RELATED-TO:tadoi-series-series-root@local",
  "RECURRENCE-ID:20260211T090000",
  "STATUS:CANCELLED",
  "SUMMARY:Daily standup (cancelled)",
  "END:VEVENT",
  "END:VCALENDAR"
].join("\n");

async function readPersistedState(dataPath: string): Promise<{
  tasks: Array<{
    id: string;
    status: string;
    title: string;
    recurrence?: { exdates?: string[]; series_id: string };
    instance_of?: { series_id: string; occurrence: string };
    external?: { calendar?: { uid?: string } };
  }>;
}> {
  return JSON.parse(await fs.readFile(dataPath, "utf8")) as {
    tasks: Array<{
      id: string;
      status: string;
      title: string;
      recurrence?: { exdates?: string[]; series_id: string };
      instance_of?: { series_id: string; occurrence: string };
      external?: { calendar?: { uid?: string } };
    }>;
  };
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
        await expectUnixPrivateFileMode(reportPath);
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

  it("skips override mutations when base series is outside the selected saved view", async () => {
    await withTempImportEnv(
      {
        statePayload: {
          schemaVersion: 4,
          tasks: [
            {
              id: "series-root",
              title: "Daily standup",
              status: "open",
              createdAt: 1,
              updatedAt: 1,
              dueAt: Date.UTC(2026, 1, 10, 9, 0, 0),
              hasExplicitTime: true,
              tags: ["team"],
              recurrence: {
                dtstart: "2026-02-10T09:00:00",
                rrule: "FREQ=DAILY;INTERVAL=1",
                series_id: "series:standup"
              }
            }
          ],
          tagIndex: {},
          savedViews: [
            {
              id: "view-1",
              name: "Only Work",
              filters: { status: "open", due: "any", tag: "work" },
              createdAt: 1,
              updatedAt: 1
            }
          ]
        },
        inputIcs: OVERRIDE_ONLY_ICS
      },
      async ({ dataPath, inputPath }) => {
        const result = await importCalendarIcs({
          inputPath,
          range: "all",
          mode: "merge",
          viewName: "Only Work",
          dryRun: false
        });

        expect(result.hasErrors).toBe(false);
        expect(result.summary.skipped).toBe(1);
        expect(result.summary.overridesCreated).toBe(0);

        const persisted = await readPersistedState(dataPath);
        expect(persisted.tasks).toHaveLength(1);
        expect(persisted.tasks[0]?.recurrence?.exdates).toBeUndefined();
      }
    );
  });

  it("skips cancellation overrides outside the saved view without closing tasks or mutating EXDATE", async () => {
    await withTempImportEnv(
      {
        statePayload: {
          schemaVersion: 4,
          tasks: [
            {
              id: "series-root",
              title: "Daily standup",
              status: "open",
              createdAt: 1,
              updatedAt: 1,
              dueAt: Date.UTC(2026, 1, 10, 9, 0, 0),
              hasExplicitTime: true,
              tags: ["team"],
              recurrence: {
                dtstart: "2026-02-10T09:00:00",
                rrule: "FREQ=DAILY;INTERVAL=1",
                series_id: "series:standup"
              }
            },
            {
              id: "inst-root",
              title: "Daily standup (instance)",
              status: "open",
              createdAt: 2,
              updatedAt: 2,
              dueAt: Date.UTC(2026, 1, 11, 9, 0, 0),
              hasExplicitTime: true,
              tags: ["team"],
              instance_of: {
                series_id: "series:standup",
                occurrence: "2026-02-11T09:00:00"
              }
            }
          ],
          tagIndex: {},
          savedViews: [
            {
              id: "view-1",
              name: "Only Work",
              filters: { status: "open", due: "any", tag: "work" },
              createdAt: 1,
              updatedAt: 1
            }
          ]
        },
        inputIcs: CANCELLED_OVERRIDE_ONLY_ICS
      },
      async ({ dataPath, inputPath }) => {
        const result = await importCalendarIcs({
          inputPath,
          range: "all",
          mode: "merge",
          viewName: "Only Work",
          dryRun: false
        });

        expect(result.hasErrors).toBe(false);
        expect(result.summary.skipped).toBe(1);
        expect(result.summary.cancellationsApplied).toBe(0);

        const persisted = await readPersistedState(dataPath);
        const series = persisted.tasks.find((task) => task.id === "series-root");
        const instance = persisted.tasks.find((task) => task.id === "inst-root");
        expect(series?.recurrence?.exdates).toBeUndefined();
        expect(instance?.status).toBe("open");
      }
    );
  });

  it("applies override and cancellation mutations when the series is visible in saved view", async () => {
    await withTempImportEnv(
      {
        statePayload: {
          schemaVersion: 4,
          tasks: [
            {
              id: "series-root",
              title: "Daily standup",
              status: "open",
              createdAt: 1,
              updatedAt: 1,
              dueAt: Date.UTC(2026, 1, 10, 9, 0, 0),
              hasExplicitTime: true,
              tags: ["team"],
              recurrence: {
                dtstart: "2026-02-10T09:00:00",
                rrule: "FREQ=DAILY;INTERVAL=1",
                series_id: "series:standup"
              }
            },
            {
              id: "inst-root",
              title: "Daily standup (instance)",
              status: "open",
              createdAt: 2,
              updatedAt: 2,
              dueAt: Date.UTC(2026, 1, 11, 9, 0, 0),
              hasExplicitTime: true,
              tags: ["team"],
              instance_of: {
                series_id: "series:standup",
                occurrence: "2026-02-11T09:00:00"
              }
            }
          ],
          tagIndex: {},
          savedViews: [
            {
              id: "view-1",
              name: "Team View",
              filters: { status: "open", due: "any", tag: "team" },
              createdAt: 1,
              updatedAt: 1
            }
          ]
        },
        inputIcs: OVERRIDE_ONLY_ICS
      },
      async ({ dataPath, inputPath }) => {
        const moved = await importCalendarIcs({
          inputPath,
          range: "all",
          mode: "merge",
          viewName: "Team View",
          dryRun: false
        });
        expect(moved.summary.overridesUpdated).toBe(1);
        expect(moved.summary.merged + moved.summary.updated).toBeGreaterThan(0);

        const afterMoved = await readPersistedState(dataPath);
        const seriesAfterMove = afterMoved.tasks.find((task) => task.id === "series-root");
        expect(seriesAfterMove?.recurrence?.exdates).toEqual(["2026-02-11T09:00:00"]);

        const cancelledPath = path.join(path.dirname(inputPath), "cancelled.ics");
        await fs.writeFile(cancelledPath, CANCELLED_OVERRIDE_ONLY_ICS, "utf8");
        const cancelled = await importCalendarIcs({
          inputPath: cancelledPath,
          range: "all",
          mode: "merge",
          viewName: "Team View",
          dryRun: false
        });
        expect(cancelled.summary.cancellationsApplied).toBe(1);

        const finalState = await readPersistedState(dataPath);
        const instance = finalState.tasks.find((task) => task.id === "inst-root");
        expect(instance?.status).toBe("done");
      }
    );
  });

  it("treats report write failures as non-fatal warnings for dry-run and commit", async () => {
    await withTempImportEnv(
      {
        statePayload: { schemaVersion: 4, tasks: [], tagIndex: {}, savedViews: [] },
        inputIcs: SIMPLE_ICS
      },
      async ({ tempDir, inputPath }) => {
        const invalidReportPath = path.join(tempDir, "report-as-directory");
        await fs.mkdir(invalidReportPath, { recursive: true });

        const dryRun = await importCalendarIcs({
          inputPath,
          range: "all",
          mode: "merge",
          dryRun: true,
          reportPath: invalidReportPath
        });
        expect(dryRun.report.persisted).toBe(false);
        expect(dryRun.hasErrors).toBe(false);
        expect(dryRun.warnings?.some((warning) => warning.includes("Failed to write import report"))).toBe(
          true
        );

        const committed = await importCalendarIcs({
          inputPath,
          range: "all",
          mode: "merge",
          dryRun: false,
          reportPath: invalidReportPath
        });
        expect(committed.report.persisted).toBe(true);
        expect(committed.hasErrors).toBe(false);
        expect(
          committed.warnings?.some((warning) => warning.includes("Failed to write import report"))
        ).toBe(true);
      }
    );
  });

  it("continues import when settings file is invalid and surfaces warning", async () => {
    await withTempImportEnv(
      {
        statePayload: { schemaVersion: 4, tasks: [], tagIndex: {}, savedViews: [] },
        inputIcs: SIMPLE_ICS
      },
      async ({ tempDir, inputPath }) => {
        await writeInvalidSettings(tempDir);

        const dryRun = await importCalendarIcs({
          inputPath,
          range: "all",
          mode: "merge",
          dryRun: true
        });
        expect(dryRun.hasErrors).toBe(false);
        expect(dryRun.summary.created).toBe(1);
        expect(
          dryRun.warnings?.some((warning) =>
            warning.includes("settings file is not valid JSON")
          )
        ).toBe(true);

        const commit = await importCalendarIcs({
          inputPath,
          range: "all",
          mode: "merge",
          dryRun: false
        });
        expect(commit.hasErrors).toBe(false);
        expect(commit.report.persisted).toBe(true);
      }
    );
  });

  it("matches duplicate external UID events against the first task deterministically", async () => {
    await withTempImportEnv(
      {
        statePayload: {
          schemaVersion: 4,
          tasks: [
            {
              id: "first-task",
              title: "First title",
              status: "open",
              createdAt: 1,
              updatedAt: 1,
              dueAt: Date.UTC(2026, 1, 12, 9, 0, 0),
              hasExplicitTime: true,
              tags: [],
              external: {
                calendar: {
                  uid: "external-dup-uid",
                  lastImportedAt: "2026-02-12T00:00:00.000Z"
                }
              }
            },
            {
              id: "second-task",
              title: "Second title",
              status: "open",
              createdAt: 2,
              updatedAt: 2,
              dueAt: Date.UTC(2026, 1, 12, 10, 0, 0),
              hasExplicitTime: true,
              tags: [],
              external: {
                calendar: {
                  uid: "external-dup-uid",
                  lastImportedAt: "2026-02-12T00:00:00.000Z"
                }
              }
            }
          ],
          tagIndex: {},
          savedViews: []
        },
        inputIcs: [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//TADOI//EN",
          "BEGIN:VEVENT",
          "UID:external-dup-uid",
          "SUMMARY:Updated by duplicate UID",
          "DTSTART:20260212T120000",
          "DTEND:20260212T123000",
          "END:VEVENT",
          "END:VCALENDAR"
        ].join("\n")
      },
      async ({ dataPath, inputPath }) => {
        const result = await importCalendarIcs({
          inputPath,
          range: "all",
          mode: "update",
          dryRun: false
        });
        expect(result.hasErrors).toBe(false);
        expect(result.summary.updated).toBe(1);

        const persisted = await readPersistedState(dataPath);
        const first = persisted.tasks.find((task) => task.id === "first-task");
        const second = persisted.tasks.find((task) => task.id === "second-task");
        expect(first?.title).toBe("Updated by duplicate UID");
        expect(second?.title).toBe("Second title");
      }
    );
  });

  it("keeps mixed base/override counters stable with many unrelated tasks", async () => {
    const noisyTasks = Array.from({ length: 250 }, (_, index) => ({
      id: `noise-${String(index)}`,
      title: `Noise ${String(index)}`,
      status: "open" as const,
      createdAt: index + 1,
      updatedAt: index + 1,
      dueAt: Date.UTC(2026, 1, 20, 9, 0, 0),
      hasExplicitTime: true,
      tags: ["noise"]
    }));

    await withTempImportEnv(
      {
        statePayload: {
          schemaVersion: 4,
          tasks: noisyTasks,
          tagIndex: {},
          savedViews: []
        },
        inputIcs: SERIES_WITH_OVERRIDE_ICS
      },
      async ({ inputPath }) => {
        const result = await importCalendarIcs({
          inputPath,
          range: "all",
          mode: "merge",
          dryRun: true
        });

        expect(result.hasErrors).toBe(false);
        expect(result.summary.eventsParsed).toBe(2);
        expect(result.summary.created).toBe(2);
        expect(result.summary.recurringSeriesImported).toBe(1);
        expect(result.summary.overridesCreated).toBe(1);
        expect(result.summary.errors).toBe(0);
      }
    );
  });
});
