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
  it("keeps current schema fixture unchanged", async () => {
    const input = await loadFixture("persisted.v3.json");

    const migrated = migratePersistedStateToCurrent(input, 3);
    expect(migrated).toEqual(input);
    const validated = validatePersistedState(migrated, "strict");
    expect(validated.ok).toBe(true);
  });

  it("migrates legacy v1 fixture to v3 and validates", async () => {
    const input = await loadFixture("persisted.v1.json");

    const migrated = migratePersistedStateToCurrent(input, 3);
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.tasks[0]?.hasExplicitTime).toBe(false);
    expect(migrated.tasks[0]?.tags).toEqual(["alpha", "work"]);
    expect(migrated.savedViews).toEqual([]);
    const validated = validatePersistedState(migrated, "strict");
    expect(validated.ok).toBe(true);
  });

  it("migrates legacy schema-0 payload to v3 and validates", async () => {
    const fixturePath = fileURLToPath(
      new URL("./__fixtures__/persisted.legacy.no-schema.json", import.meta.url).href
    );
    const raw = await fs.readFile(fixturePath, "utf8");
    const parsed = JSON.parse(raw) as Omit<LoadedData, "schemaVersion">;
    const input: LoadedData = {
      ...parsed,
      schemaVersion: 0
    };

    const migrated = migratePersistedStateToCurrent(input, 3);
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.tasks[0]?.tags).toEqual(["alpha", "work"]);
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

    expect(() => migratePersistedStateToCurrent(input, 3)).toThrow(
      "Unsupported schemaVersion"
    );
  });
});
