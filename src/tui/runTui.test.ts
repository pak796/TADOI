import { describe, expect, it } from "bun:test";
import { startOfLocalDayMs } from "../domain/dates";
import type { LoadedData } from "../state/persistence";
import {
  normalizeLoadedDataForStartup,
  redactStartupPath,
  shouldPersistInitialRuntimeState
} from "./runTui";

describe("redactStartupPath", () => {
  it("redacts home-directory absolute paths by default", () => {
    expect(
      redactStartupPath("/Users/patrick/Library/Application Support/tadoi/tadoi_data.json", {
        homeDir: "/Users/patrick"
      })
    ).toBe("~/Library/Application Support/tadoi/tadoi_data.json");
  });

  it("redacts non-home absolute paths by default", () => {
    expect(
      redactStartupPath("/Volumes/External/data/tadoi_data.json", {
        homeDir: "/Users/patrick"
      })
    ).toBe("~/.../tadoi_data.json");
  });

  it("keeps full paths when verbose logging is enabled", () => {
    const targetPath = "/Volumes/External/data/tadoi_data.json";
    expect(
      redactStartupPath(targetPath, {
        homeDir: "/Users/patrick",
        env: { TADOI_VERBOSE_PATH_LOGS: "1" }
      })
    ).toBe(targetPath);
  });

  it("preserves relative paths", () => {
    expect(redactStartupPath("./data/tadoi_data.json", { homeDir: "/Users/patrick" })).toBe(
      "./data/tadoi_data.json"
    );
  });
});

describe("normalizeLoadedDataForStartup", () => {
  it("normalizes tags, due dates, and missing hasExplicitTime fields", () => {
    const dueAt = new Date(2026, 1, 10, 14, 45, 0).getTime();
    const loaded: LoadedData = {
      schemaVersion: 2,
      tasks: [
        {
          id: "task-1",
          title: "Task",
          status: "open",
          createdAt: dueAt,
          updatedAt: dueAt,
          dueAt,
          tags: [" Work ", "#home", "home"]
        }
      ],
      tagIndex: {
        Work: { tagName: " Work ", usageCount: 1, lastUsedAt: dueAt },
        home: { tagName: "home", usageCount: 2, lastUsedAt: dueAt + 1 }
      },
      savedViews: []
    };

    const result = normalizeLoadedDataForStartup(loaded);
    expect(result.tasksChanged).toBe(true);
    expect(result.tagIndexChanged).toBe(true);
    expect(result.normalizedLoaded.tasks[0]?.tags).toEqual(["home", "work"]);
    expect(result.normalizedLoaded.tasks[0]?.hasExplicitTime).toBe(false);
    expect(result.normalizedLoaded.tasks[0]?.dueAt).toBe(startOfLocalDayMs(dueAt));
    expect(Object.keys(result.normalizedLoaded.tagIndex).sort()).toEqual(["home", "work"]);
  });
});

describe("shouldPersistInitialRuntimeState", () => {
  it("returns false when no startup-change flags are set", () => {
    expect(
      shouldPersistInitialRuntimeState({
        tasksChanged: false,
        tagIndexChanged: false,
        archiveChanged: false,
        didMigrate: false,
        shouldPersistRecoveredState: false
      })
    ).toBe(false);
  });

  it("returns true when any startup-change flag is set", () => {
    expect(
      shouldPersistInitialRuntimeState({
        tasksChanged: false,
        tagIndexChanged: false,
        archiveChanged: true,
        didMigrate: false,
        shouldPersistRecoveredState: false
      })
    ).toBe(true);
  });
});
