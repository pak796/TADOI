import { describe, expect, it } from "bun:test";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";
import { migratePersistedStateToCurrent } from "./migrations";
import { LoadedData } from "./persistence";
import { validatePersistedState } from "./validation";

async function loadFixture(name: string): Promise<LoadedData> {
  const fixturePath = fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url).href);
  const raw = await fs.readFile(fixturePath, "utf8");
  return JSON.parse(raw) as LoadedData;
}

describe("migratePersistedStateToCurrent", () => {
  it("migrates v6 fixture to v7 with workflow-stage backfill", async () => {
    const input = await loadFixture("persisted.v6.json");

    const migrated = migratePersistedStateToCurrent(input, 7);
    expect(migrated.schemaVersion).toBe(7);
    expect(migrated.tasks.find((task) => task.id === "current-1")?.workflowStage).toBe("todo");
    expect(migrated.tasks.find((task) => task.id === "inst-1")?.workflowStage).toBe("done");
    const validated = validatePersistedState(migrated, "strict");
    expect(validated.ok).toBe(true);
  });

  it("migrates legacy v1 fixture to v7 and validates", async () => {
    const input = await loadFixture("persisted.v1.json");

    const migrated = migratePersistedStateToCurrent(input, 7);
    expect(migrated.schemaVersion).toBe(7);
    expect(migrated.stateRevision).toBe(0);
    expect(migrated.tasks[0]?.hasExplicitTime).toBe(false);
    expect(migrated.tasks[0]?.workflowStage).toBe("todo");
    expect(migrated.tasks[0]?.tags).toEqual(["alpha", "work"]);
    expect(migrated.savedViews).toEqual([]);
    expect(migrated.engagement).toBeDefined();
    const validated = validatePersistedState(migrated, "strict");
    expect(validated.ok).toBe(true);
  });

  it("migrates legacy schema-0 payload to v7 and validates", async () => {
    const fixturePath = fileURLToPath(
      new URL("./__fixtures__/persisted.legacy.no-schema.json", import.meta.url).href
    );
    const raw = await fs.readFile(fixturePath, "utf8");
    const parsed = JSON.parse(raw) as Omit<LoadedData, "schemaVersion">;
    const input: LoadedData = {
      ...parsed,
      schemaVersion: 0
    };

    const migrated = migratePersistedStateToCurrent(input, 7);
    expect(migrated.schemaVersion).toBe(7);
    expect(migrated.stateRevision).toBe(0);
    expect(migrated.tasks[0]?.tags).toEqual(["alpha", "work"]);
    expect(migrated.engagement?.completionLog).toEqual([]);
    const validated = validatePersistedState(migrated, "strict");
    expect(validated.ok).toBe(true);
  });

  it("migrates v3 recurrence payloads to v7 with normalized recurrence fields", async () => {
    const input = await loadFixture("persisted.v3.json");
    const recurringV3 = {
      ...input,
      tasks: [
        ...input.tasks,
        {
          id: "legacy-series",
          title: "legacy recurring",
          status: "open",
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
          dueAt: 1700000000000,
          hasExplicitTime: false,
          tags: ["work"],
          recurrence: {
            dtstart: "2026-02-09T09:00:00",
            rrule: "FREQ=DAILY;INTERVAL=1",
            exdates: ["2026-02-10T09:00:00", "2026-02-10T09:00:00"]
          }
        }
      ]
    } as LoadedData;

    const migrated = migratePersistedStateToCurrent(recurringV3, 7);
    const migratedSeries = migrated.tasks.find((task) => task.id === "legacy-series");
    expect(migrated.schemaVersion).toBe(7);
    expect(migrated.stateRevision).toBe(0);
    expect(migratedSeries?.recurrence?.series_id).toBe("series:legacy-series");
    expect(migratedSeries?.recurrence?.dtstart).toBe("2026-02-09T09:00:00");
    expect(migratedSeries?.recurrence?.exdates).toEqual(["2026-02-10T09:00:00"]);
    expect(migrated.engagement).toBeDefined();
    const validated = validatePersistedState(migrated, "strict");
    expect(validated.ok).toBe(true);
  });

  it("migrates v5 payloads to v7, initializes stateRevision, and backfills workflow stage", async () => {
    const input = await loadFixture("persisted.v5.json");

    const migrated = migratePersistedStateToCurrent(input, 7);
    expect(migrated.schemaVersion).toBe(7);
    expect(migrated.stateRevision).toBe(0);
    expect(migrated.tasks.every((task) => task.workflowStage === "todo" || task.workflowStage === "done")).toBe(
      true
    );
    const validated = validatePersistedState(migrated, "strict");
    expect(validated.ok).toBe(true);
  });

  it("throws on unsupported future schema", () => {
    const input: LoadedData = {
      schemaVersion: 99,
      tasks: [],
      tagIndex: {},
      savedViews: []
    };

    expect(() => migratePersistedStateToCurrent(input, 7)).toThrow(
      "Unsupported schemaVersion"
    );
  });
});
