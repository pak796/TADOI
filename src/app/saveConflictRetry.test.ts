import { describe, expect, it } from "bun:test";
import { createDefaultEngagementState } from "../domain/engagement";
import { StateRevisionConflictError } from "../state/persistence";
import {
  normalizeStateRevision,
  retrySaveAfterConflictReload,
  type SaveConflictRetrySnapshot
} from "./saveConflictRetry";

function createSnapshot(): SaveConflictRetrySnapshot {
  return {
    schemaVersion: 7,
    tasks: [],
    tagIndex: {},
    savedViews: [],
    engagement: createDefaultEngagementState()
  };
}

describe("save conflict retry helper", () => {
  it("normalizes state revision values deterministically", () => {
    expect(normalizeStateRevision(0)).toBe(0);
    expect(normalizeStateRevision(5)).toBe(5);
    expect(normalizeStateRevision(1.2)).toBe(0);
    expect(normalizeStateRevision(-1)).toBe(0);
    expect(normalizeStateRevision(undefined)).toBe(0);
    expect(normalizeStateRevision("4")).toBe(0);
  });

  it("reloads latest revision and retries save with expected revision", async () => {
    const calls: Array<{ filePath: string; expected: number }> = [];
    const result = await retrySaveAfterConflictReload({
      snapshot: createSnapshot(),
      filePath: "/tmp/tadoi_data.json",
      deps: {
        loadLatest: async (filePath: string) => {
          expect(filePath).toBe("/tmp/tadoi_data.json");
          return { stateRevision: 7 };
        },
        saveAtomic: async (_data, filePath, options) => {
          calls.push({
            filePath,
            expected: options.expectedStateRevision ?? -1
          });
          return 8;
        }
      }
    });

    expect(result).toEqual({
      ok: true,
      filePath: "/tmp/tadoi_data.json",
      stateRevision: 8
    });
    expect(calls).toEqual([{ filePath: "/tmp/tadoi_data.json", expected: 7 }]);
  });

  it("returns structured conflict details on optimistic-concurrency mismatch", async () => {
    const result = await retrySaveAfterConflictReload({
      snapshot: createSnapshot(),
      filePath: "/tmp/tadoi_data.json",
      deps: {
        loadLatest: async () => ({ stateRevision: 1 }),
        saveAtomic: async () => {
          throw new StateRevisionConflictError("/tmp/tadoi_data.json", 1, 2);
        }
      }
    });

    expect(result).toEqual({
      ok: false,
      kind: "conflict",
      filePath: "/tmp/tadoi_data.json",
      expectedStateRevision: 1,
      actualStateRevision: 2
    });
  });

  it("returns normalized error for non-conflict failures", async () => {
    const result = await retrySaveAfterConflictReload({
      snapshot: createSnapshot(),
      filePath: "/tmp/tadoi_data.json",
      deps: {
        loadLatest: async () => ({ stateRevision: 3 }),
        saveAtomic: async () => {
          throw new Error("disk full");
        }
      }
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected non-ok result");
    }
    expect(result.kind).toBe("error");
    expect(result.error.message).toContain("disk full");
  });
});
