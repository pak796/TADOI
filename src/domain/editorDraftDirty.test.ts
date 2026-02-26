import { describe, expect, it } from "bun:test";
import type { EditorDraft } from "./models";
import { areEditorDraftsEqual, cloneEditorDraft, isEditorDraftDirty } from "./editorDraftDirty";

function makeDraft(overrides: Partial<EditorDraft> = {}): EditorDraft {
  return {
    id: "task-a",
    title: "Task A",
    dueText: "2026-02-20",
    timeText: "09:15",
    tagsText: "work #p1",
    notes: "note",
    links: [
      {
        id: "link-1",
        target: "https://example.com",
        label: "Example",
        kind: "url",
        source: "manual"
      }
    ],
    repeatMode: "weekly",
    repeatIntervalText: "2",
    repeatWeekdays: ["MO", "WE"],
    repeatMonthdayText: "20",
    repeatEndMode: "count",
    repeatUntilText: "",
    repeatCountText: "5",
    repeatCustomRRuleText: "",
    assigneeText: "",
    projectText: "",
    workflowStage: undefined,
    editKind: "regular",
    sourceTaskId: "task-a",
    sourceSeriesId: "series:task-a",
    occurrenceIso: "2026-02-20T09:15:00",
    ...overrides
  };
}

describe("editor draft dirty helpers", () => {
  it("clones draft deeply for mutable arrays", () => {
    const original = makeDraft();
    const snapshot = cloneEditorDraft(original);

    expect(areEditorDraftsEqual(original, snapshot)).toBe(true);

    original.repeatWeekdays.push("FR");
    original.links[0]!.target = "https://changed.example.com";

    expect(snapshot.repeatWeekdays).toEqual(["MO", "WE"]);
    expect(snapshot.links[0]?.target).toBe("https://example.com");
  });

  it("returns equal for identical drafts", () => {
    const left = makeDraft();
    const right = cloneEditorDraft(left);
    expect(areEditorDraftsEqual(left, right)).toBe(true);
    expect(isEditorDraftDirty(left, right)).toBe(false);
  });

  it("detects recurrence and links differences deterministically", () => {
    const baseline = makeDraft();
    const withDifferentRRule = makeDraft({ repeatIntervalText: "3" });
    expect(areEditorDraftsEqual(withDifferentRRule, baseline)).toBe(false);

    const withDifferentLink = makeDraft({
      links: [
        {
          id: "link-1",
          target: "https://different.example.com",
          label: "Example",
          kind: "url",
          source: "manual"
        }
      ]
    });
    expect(areEditorDraftsEqual(withDifferentLink, baseline)).toBe(false);
  });

  it("treats missing baseline as dirty", () => {
    expect(isEditorDraftDirty(makeDraft(), null)).toBe(true);
    expect(isEditorDraftDirty(null, makeDraft())).toBe(true);
    expect(isEditorDraftDirty(null, null)).toBe(false);
  });
});
