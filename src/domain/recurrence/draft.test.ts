import { describe, expect, it } from "bun:test";
import { EditorDraft } from "../models";
import {
  buildRecurrenceFromDraft,
  buildRecurrencePreviewFromDraft,
  getRecurrenceSummary,
} from "./draft";

function makeDraft(overrides: Partial<EditorDraft> = {}): EditorDraft {
  return {
    title: "Task",
    dueText: "",
    timeText: "",
    reminderKind: "none",
    reminderAtDateText: "",
    reminderAtTimeText: "",
    reminderOffsetText: "10",
    reminderOffsetUnit: "minutes",
    tagsText: "",
    notes: "",
    links: [],
    checklist: [],
    repeatMode: "off",
    repeatIntervalText: "1",
    repeatWeekdays: [],
    repeatMonthdayText: "",
    repeatEndMode: "never",
    repeatUntilText: "",
    repeatCountText: "",
    repeatCustomRRuleText: "",
    assigneeText: "",
    projectText: "",
    workflowStage: undefined,
    ...overrides,
  };
}

describe("buildRecurrenceFromDraft", () => {
  it("requires due date for recurrence", () => {
    const draft = makeDraft({ repeatMode: "daily" });
    const built = buildRecurrenceFromDraft(draft, undefined, "series:test");
    expect(built.error).toContain("due date");
    expect(built.recurrence).toBeUndefined();
  });

  it("builds weekly RRULE from preset controls", () => {
    const draft = makeDraft({
      repeatMode: "weekly",
      repeatIntervalText: "2",
      repeatWeekdays: ["MO", "WE"],
      repeatEndMode: "count",
      repeatCountText: "5",
    });

    const built = buildRecurrenceFromDraft(
      draft,
      new Date(2026, 1, 10, 9, 0, 0, 0).getTime(),
      "series:test",
    );

    expect(built.error).toBeUndefined();
    expect(built.recurrence?.series_id).toBe("series:test");
    expect(built.recurrence?.rrule).toContain("FREQ=WEEKLY");
    expect(built.recurrence?.rrule).toContain("BYDAY=MO,WE");
    expect(built.recurrence?.rrule).toContain("COUNT=5");
  });
});

describe("buildRecurrencePreviewFromDraft", () => {
  it("returns upcoming preview occurrences", () => {
    const draft = makeDraft({
      repeatMode: "daily",
      repeatIntervalText: "1",
    });

    const now = new Date(2026, 1, 10, 12, 0, 0, 0).getTime();
    const preview = buildRecurrencePreviewFromDraft(
      draft,
      new Date(2026, 1, 10, 9, 0, 0, 0).getTime(),
      true,
      now,
      3,
    );

    expect(preview).toEqual([
      "2026-02-11T09:00:00",
      "2026-02-12T09:00:00",
      "2026-02-13T09:00:00",
    ]);
  });

  it("summarizes recurrence for details pane", () => {
    const summary = getRecurrenceSummary({
      dtstart: "2026-02-10T09:00:00",
      rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE",
      series_id: "series:test",
    });
    expect(summary).toContain("Weekly");
    expect(summary).toContain("MO,WE");
  });
});
