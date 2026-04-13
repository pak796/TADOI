import { describe, expect, it } from "bun:test";
import {
  isReminderEventAlreadyFired,
  markReminderEventFired,
  pruneReminderHelperState,
} from "./helperState";

describe("reminder helper state", () => {
  it("marks events fired and checks dedupe", () => {
    const base = {
      version: 1,
      updatedAt: "2026-03-03T00:00:00.000Z",
      fired: {},
    };

    const next = markReminderEventFired(
      base,
      "evt-1",
      "2026-03-03T00:10:00.000Z",
      Date.parse("2026-03-03T00:10:00.000Z"),
    );

    expect(isReminderEventAlreadyFired(next, "evt-1")).toBe(true);
    expect(isReminderEventAlreadyFired(next, "evt-2")).toBe(false);
  });

  it("prunes fired ids older than ttl window", () => {
    const nowMs = Date.parse("2026-03-10T00:00:00.000Z");
    const state = {
      version: 1,
      updatedAt: "2026-03-10T00:00:00.000Z",
      fired: {
        old: "2026-03-01T00:00:00.000Z",
        fresh: "2026-03-09T00:00:00.000Z",
      },
    };

    const pruned = pruneReminderHelperState(
      state,
      nowMs,
      7 * 24 * 60 * 60 * 1000,
    );
    expect(pruned.fired.old).toBeUndefined();
    expect(pruned.fired.fresh).toBe("2026-03-09T00:00:00.000Z");
  });
});
