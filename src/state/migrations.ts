import { normalizeTagIndex, normalizeTags } from "../domain/tagIndex";
import type { LoadedData } from "./persistence";

type MigrationFn = (state: LoadedData) => LoadedData;

const migrations: Record<number, MigrationFn> = {
  1: migrateV1ToV2
};

function migrateV1ToV2(state: LoadedData): LoadedData {
  const tasks = state.tasks.map((task) => {
    if (typeof task !== "object" || task === null) {
      throw new Error("Invalid task entry during migration 1->2");
    }
    return {
      ...task,
      hasExplicitTime:
        typeof task.hasExplicitTime === "boolean" ? task.hasExplicitTime : false,
      tags: normalizeTags(Array.isArray(task.tags) ? task.tags : [])
    };
  });

  return {
    schemaVersion: 2,
    tasks,
    tagIndex: normalizeTagIndex(state.tagIndex ?? {})
  };
}

export function migratePersistedStateToCurrent(
  input: LoadedData,
  currentVersion: number
): LoadedData {
  if (input.schemaVersion > currentVersion) {
    throw new Error(
      `Unsupported schemaVersion ${input.schemaVersion}; current is ${currentVersion}`
    );
  }

  let next = {
    ...input,
    tasks: Array.isArray(input.tasks) ? input.tasks : [],
    tagIndex: input.tagIndex ?? {}
  };

  while (next.schemaVersion < currentVersion) {
    const migration = migrations[next.schemaVersion];
    if (!migration) {
      throw new Error(`Missing migration step ${next.schemaVersion} -> ${next.schemaVersion + 1}`);
    }
    next = migration(next);
  }

  return next;
}
