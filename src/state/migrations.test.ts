import { describe, expect, it } from "bun:test";
import { migratePersistedStateToCurrent } from "./migrations";
import { LoadedData } from "./persistence";

describe("migratePersistedStateToCurrent", () => {
  it("keeps current schema input unchanged", () => {
    const input: LoadedData = {
      schemaVersion: 2,
      tasks: [
        {
          id: "a",
          title: "task a",
          status: "open",
          createdAt: 1,
          updatedAt: 1,
          hasExplicitTime: false,
          tags: ["work"]
        }
      ],
      tagIndex: {}
    };

    const migrated = migratePersistedStateToCurrent(input, 2);
    expect(migrated).toEqual(input);
  });

  it("migrates legacy v1 to v2", () => {
    const input: LoadedData = {
      schemaVersion: 1,
      tasks: [
        {
          id: "a",
          title: "task a",
          status: "open",
          createdAt: 1,
          updatedAt: 1,
          tags: ["#Work", "work"]
        }
      ],
      tagIndex: {}
    };

    const migrated = migratePersistedStateToCurrent(input, 2);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.tasks[0].hasExplicitTime).toBe(false);
    expect(migrated.tasks[0].tags).toEqual(["work"]);
  });

  it("throws on unsupported future schema", () => {
    const input: LoadedData = {
      schemaVersion: 99,
      tasks: [],
      tagIndex: {}
    };

    expect(() => migratePersistedStateToCurrent(input, 2)).toThrow(
      "Unsupported schemaVersion"
    );
  });
});
