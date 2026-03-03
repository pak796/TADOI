import { describe, expect, it } from "bun:test";
import { mergeReminderIndexWithHelperEvents } from "./remindersCommands";
import {
  REMINDER_HELPER_STATE_TTL_MS,
  REMINDER_INDEX_VERSION,
  type ReminderIndex,
  type ReminderIndexEvent
} from "../reminders/types";

function createEvent(overrides: Partial<ReminderIndexEvent> = {}): ReminderIndexEvent {
  return {
    eventId: "event-1",
    taskId: "task-1",
    occurrenceKey: "task:task-1",
    remindAt: "2026-03-03T01:00:00.000Z",
    dueAt: "2026-03-03T01:10:00.000Z",
    title: "Reminder",
    priority: "",
    tags: [],
    ...overrides
  };
}

function createIndex(events: ReminderIndexEvent[]): ReminderIndex {
  return {
    version: REMINDER_INDEX_VERSION,
    generatedAt: "2026-03-03T00:00:00.000Z",
    events
  };
}

describe("mergeReminderIndexWithHelperEvents", () => {
  it("preserves helper-owned synthetic test events across tick rebuilds", () => {
    const rebuilt = createIndex([
      createEvent({
        eventId: "core-1",
        remindAt: "2026-03-03T02:00:00.000Z"
      })
    ]);
    const existing = createIndex([
      createEvent({
        eventId: "test-1",
        taskId: "__test__",
        occurrenceKey: "test:2026-03-03T01:30:00.000Z",
        remindAt: "2026-03-03T01:30:00.000Z",
        title: "TADOI test reminder"
      })
    ]);

    const merged = mergeReminderIndexWithHelperEvents({
      rebuiltIndex: rebuilt,
      existingIndex: existing,
      nowMs: Date.parse("2026-03-03T01:00:00.000Z")
    });

    expect(merged.events.map((event) => event.eventId)).toEqual(["test-1", "core-1"]);
  });

  it("drops stale helper-owned synthetic events beyond ttl window", () => {
    const nowMs = Date.parse("2026-03-10T00:00:00.000Z");
    const staleRemindAt = new Date(nowMs - REMINDER_HELPER_STATE_TTL_MS - 60_000).toISOString();
    const rebuilt = createIndex([]);
    const existing = createIndex([
      createEvent({
        eventId: "test-stale",
        taskId: "__test__",
        occurrenceKey: `test:${staleRemindAt}`,
        remindAt: staleRemindAt
      })
    ]);

    const merged = mergeReminderIndexWithHelperEvents({
      rebuiltIndex: rebuilt,
      existingIndex: existing,
      nowMs
    });

    expect(merged.events).toHaveLength(0);
  });
});
