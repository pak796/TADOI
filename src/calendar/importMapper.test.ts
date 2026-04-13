import { describe, expect, it } from "bun:test";
import type { ParsedIcsEvent } from "./icsParser";
import {
  createTaskFromDraft,
  mapEventToTaskDraft,
  mergeTaskFromDraft,
} from "./importMapper";
import type { Task } from "../domain/models";

function buildTimedValue(localIso: string) {
  return {
    kind: "date-time" as const,
    raw: localIso,
    isUtc: false,
    epochMs: Date.parse(localIso),
    localIso,
  };
}

describe("importMapper link provenance", () => {
  it("marks imported links with source=calendar_import", () => {
    const event: ParsedIcsEvent = {
      uid: "event-1",
      summary: "Imported event",
      description: "Doc: https://example.com/doc\nFile: file:///tmp/report.txt",
      categories: [],
      url: "https://calendar.example/event/1",
      dtstart: buildTimedValue("2026-02-12T09:00:00"),
      exdates: [],
      rdates: [],
    };

    const draft = mapEventToTaskDraft(event);
    expect(draft.links.length).toBe(3);
    expect(draft.links.every((link) => link.source === "calendar_import")).toBe(
      true,
    );
  });

  it("preserves imported source metadata when merging links", () => {
    const event: ParsedIcsEvent = {
      uid: "event-2",
      summary: "Imported event",
      description: "Doc: https://example.com/new-doc",
      categories: [],
      dtstart: buildTimedValue("2026-02-12T10:00:00"),
      exdates: [],
      rdates: [],
    };
    const draft = mapEventToTaskDraft(event);

    const existing: Task = {
      id: "task-1",
      title: "Existing",
      status: "open",
      createdAt: 1,
      updatedAt: 1,
      tags: [],
      links: [
        {
          id: "link-1",
          target: "https://example.com/manual",
          kind: "url",
          source: "manual",
        },
      ],
    };

    const merged = mergeTaskFromDraft(existing, draft, {
      nowMs: 2,
      importedAtIso: "2026-02-12T10:00:00.000Z",
      mode: "merge",
      allowOverwrite: true,
    });
    const importedLink = merged.task.links?.find(
      (link) => link.target === "https://example.com/new-doc",
    );
    expect(importedLink?.source).toBe("calendar_import");
  });
});

describe("importMapper merge/update behavior", () => {
  it("keeps local title/due when overwrite is not allowed in merge mode", () => {
    const draft = {
      uid: "event-1",
      summary: "Incoming title",
      dueAt: Date.parse("2026-02-12T11:00:00"),
      hasExplicitTime: true,
      notes: "Incoming notes",
      tags: ["imported"],
      links: [],
      timeZone: "America/Chicago",
    };
    const existing: Task = {
      id: "task-1",
      title: "Local title",
      status: "open",
      createdAt: 1,
      updatedAt: 100,
      dueAt: Date.parse("2026-02-12T09:00:00"),
      hasExplicitTime: true,
      notes: "Local notes",
      tags: ["local"],
    };

    const merged = mergeTaskFromDraft(existing, draft, {
      nowMs: 200,
      importedAtIso: "2026-02-12T12:00:00.000Z",
      mode: "merge",
      allowOverwrite: false,
    });

    expect(merged.action).toBe("merged");
    expect(merged.conflicts).toEqual(["title", "dueAt"]);
    expect(merged.task.title).toBe("Local title");
    expect(merged.task.dueAt).toBe(Date.parse("2026-02-12T09:00:00"));
    expect(merged.task.tags).toEqual(["imported", "local"]);
    expect(merged.task.notes).toContain("Imported from Calendar");
  });

  it("overwrites mapped fields in update mode", () => {
    const draft = {
      uid: "event-2",
      summary: "Updated title",
      dueAt: Date.parse("2026-02-13T10:30:00"),
      hasExplicitTime: true,
      tags: ["ops"],
      notes: "updated notes",
      links: [],
    };
    const existing: Task = {
      id: "task-2",
      title: "Before",
      status: "open",
      createdAt: 1,
      updatedAt: 10,
      dueAt: Date.parse("2026-02-12T10:00:00"),
      hasExplicitTime: true,
      tags: ["local"],
      notes: "old notes",
    };
    const updated = mergeTaskFromDraft(existing, draft, {
      nowMs: 20,
      importedAtIso: "2026-02-13T00:00:00.000Z",
      mode: "update",
      allowOverwrite: false,
    });

    expect(updated.action).toBe("updated");
    expect(updated.task.title).toBe("Updated title");
    expect(updated.task.dueAt).toBe(Date.parse("2026-02-13T10:30:00"));
    expect(updated.task.tags).toEqual(["ops"]);
    expect(updated.task.notes).toBe("updated notes");
  });

  it("returns skipped for idempotent re-merge with same imported hash", () => {
    const event: ParsedIcsEvent = {
      uid: "event-idempotent",
      summary: "Same event",
      description: "Doc: https://example.com/same",
      categories: ["ops"],
      dtstart: buildTimedValue("2026-02-14T09:00:00"),
      exdates: [],
      rdates: [],
    };
    const draft = mapEventToTaskDraft(event);
    const created = createTaskFromDraft(draft, 1, "2026-02-14T09:00:00.000Z");
    const remerged = mergeTaskFromDraft(created, draft, {
      nowMs: 2,
      importedAtIso: "2026-02-14T09:01:00.000Z",
      mode: "merge",
      allowOverwrite: true,
    });

    expect(remerged.action).toBe("skipped");
    expect(remerged.task.id).toBe(created.id);
    expect(remerged.task.updatedAt).toBe(created.updatedAt);
  });

  it("maps date-only events as non-explicit-time drafts", () => {
    const event: ParsedIcsEvent = {
      uid: "date-only",
      summary: "Date only",
      categories: [],
      dtstart: {
        kind: "date",
        raw: "20260215",
        isUtc: false,
        epochMs: Date.parse("2026-02-15T00:00:00"),
        localIso: "2026-02-15T00:00:00",
      },
      exdates: [],
      rdates: [],
    };
    const draft = mapEventToTaskDraft(event);
    expect(draft.hasExplicitTime).toBe(false);
    expect(draft.dueAt).toBeDefined();
  });
});
