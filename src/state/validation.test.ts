import { describe, expect, it } from "bun:test";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";
import { validatePersistedState } from "./validation";

const BASE_STATE = {
  schemaVersion: 4,
  tasks: [
    {
      id: "a",
      title: "task a",
      status: "open",
      createdAt: 1,
      updatedAt: 1,
      tags: ["work"],
    },
  ],
  tagIndex: {},
  savedViews: [],
};

describe("validatePersistedState", () => {
  it("accepts valid current schema", () => {
    const result = validatePersistedState(BASE_STATE, "strict");
    expect(result.ok).toBe(true);
  });

  it("validates optional task.noteRef shape", () => {
    const valid = validatePersistedState(
      {
        ...BASE_STATE,
        tasks: [
          {
            ...BASE_STATE.tasks[0],
            noteRef: {
              type: "filename",
              value: "Task One.md",
            },
          },
        ],
      },
      "strict",
    );
    expect(valid.ok).toBe(true);

    const invalidType = validatePersistedState(
      {
        ...BASE_STATE,
        tasks: [
          {
            ...BASE_STATE.tasks[0],
            noteRef: {
              type: "bad",
              value: "x",
            },
          },
        ],
      },
      "strict",
    );
    expect(invalidType.ok).toBe(false);

    const invalidValue = validatePersistedState(
      {
        ...BASE_STATE,
        tasks: [
          {
            ...BASE_STATE.tasks[0],
            noteRef: {
              type: "id",
              value: " ",
            },
          },
        ],
      },
      "strict",
    );
    expect(invalidValue.ok).toBe(false);
  });

  it("validates tagAliases normalization in strict mode", () => {
    const good = validatePersistedState(
      {
        ...BASE_STATE,
        tagAliases: {
          legacy: "work",
        },
      },
      "strict",
    );
    expect(good.ok).toBe(true);

    const bad = validatePersistedState(
      {
        ...BASE_STATE,
        tagAliases: {
          " Legacy Tag ": "work",
        },
      },
      "strict",
    );
    expect(bad.ok).toBe(false);
  });

  it("requires engagement for schema v5 payloads", () => {
    const result = validatePersistedState(
      {
        ...BASE_STATE,
        schemaVersion: 5,
      },
      "strict",
    );
    expect(result.ok).toBe(false);
  });

  it("accepts valid engagement payload in schema v5", () => {
    const result = validatePersistedState(
      {
        ...BASE_STATE,
        schemaVersion: 5,
        engagement: {
          completionLog: [],
          achievements: {},
          streak: {
            currentDays: 0,
            bestDays: 0,
            lastCompletionDayKey: null,
          },
        },
      },
      "strict",
    );
    expect(result.ok).toBe(true);
  });

  it("requires non-negative integer stateRevision for schema v6", () => {
    const missingRevision = validatePersistedState(
      {
        ...BASE_STATE,
        schemaVersion: 6,
        engagement: {
          completionLog: [],
          achievements: {},
          streak: {
            currentDays: 0,
            bestDays: 0,
            lastCompletionDayKey: null,
          },
        },
      },
      "strict",
    );
    expect(missingRevision.ok).toBe(false);

    const fractionalRevision = validatePersistedState(
      {
        ...BASE_STATE,
        schemaVersion: 6,
        stateRevision: 1.5,
        engagement: {
          completionLog: [],
          achievements: {},
          streak: {
            currentDays: 0,
            bestDays: 0,
            lastCompletionDayKey: null,
          },
        },
      },
      "strict",
    );
    expect(fractionalRevision.ok).toBe(false);

    const negativeRevision = validatePersistedState(
      {
        ...BASE_STATE,
        schemaVersion: 6,
        stateRevision: -1,
        engagement: {
          completionLog: [],
          achievements: {},
          streak: {
            currentDays: 0,
            bestDays: 0,
            lastCompletionDayKey: null,
          },
        },
      },
      "strict",
    );
    expect(negativeRevision.ok).toBe(false);
  });

  it("accepts schema v6 with valid stateRevision and engagement", () => {
    const result = validatePersistedState(
      {
        ...BASE_STATE,
        schemaVersion: 6,
        stateRevision: 3,
        engagement: {
          completionLog: [],
          achievements: {},
          streak: {
            currentDays: 0,
            bestDays: 0,
            lastCompletionDayKey: null,
          },
        },
      },
      "strict",
    );
    expect(result.ok).toBe(true);
  });

  it("requires workflowStage for schema v7 tasks", () => {
    const missingWorkflowStage = validatePersistedState(
      {
        ...BASE_STATE,
        schemaVersion: 7,
        stateRevision: 1,
        engagement: {
          completionLog: [],
          achievements: {},
          streak: {
            currentDays: 0,
            bestDays: 0,
            lastCompletionDayKey: null,
          },
        },
      },
      "strict",
    );
    expect(missingWorkflowStage.ok).toBe(false);
  });

  it("accepts schema v7 when workflowStage and new filter fields are valid", () => {
    const result = validatePersistedState(
      {
        ...BASE_STATE,
        schemaVersion: 7,
        stateRevision: 2,
        tasks: [
          {
            ...BASE_STATE.tasks[0],
            workflowStage: "todo",
            assignee: "alice",
            project: "alpha",
          },
        ],
        savedViews: [
          {
            id: "view-analytics",
            name: "Window 14d",
            createdAt: 1,
            updatedAt: 2,
            filters: {
              status: "open",
              due: "any",
              analyticsWindow: "14d",
              dueDayOffset: 3,
              assignee: "alice",
              project: "alpha",
              workflowStage: "todo",
            },
          },
        ],
        engagement: {
          completionLog: [],
          achievements: {},
          streak: {
            currentDays: 0,
            bestDays: 0,
            lastCompletionDayKey: null,
          },
        },
      },
      "strict",
    );
    expect(result.ok).toBe(true);
  });

  it("rejects malformed checklist payloads for schema v8 tasks", () => {
    const malformedChecklist = validatePersistedState(
      {
        ...BASE_STATE,
        schemaVersion: 8,
        stateRevision: 3,
        tasks: [
          {
            ...BASE_STATE.tasks[0],
            workflowStage: "todo",
            checklist: [
              {
                id: "cl-1",
                text: "  ",
                isDone: "yes",
                createdAt: "bad",
                updatedAt: "bad",
                sort: -1,
              },
            ],
          },
        ],
        engagement: {
          completionLog: [],
          achievements: {},
          streak: {
            currentDays: 0,
            bestDays: 0,
            lastCompletionDayKey: null,
          },
        },
      },
      "strict",
    );
    expect(malformedChecklist.ok).toBe(false);
  });

  it("accepts schema v8 with normalized checklist items", () => {
    const result = validatePersistedState(
      {
        ...BASE_STATE,
        schemaVersion: 8,
        stateRevision: 3,
        tasks: [
          {
            ...BASE_STATE.tasks[0],
            workflowStage: "todo",
            checklist: [
              {
                id: "cl-1",
                text: "Draft outline",
                isDone: false,
                createdAt: "2026-02-26T12:00:00.000Z",
                updatedAt: "2026-02-26T12:00:00.000Z",
                sort: 0,
              },
            ],
          },
        ],
        engagement: {
          completionLog: [],
          achievements: {},
          streak: {
            currentDays: 0,
            bestDays: 0,
            lastCompletionDayKey: null,
          },
        },
      },
      "strict",
    );
    expect(result.ok).toBe(true);
  });

  it("rejects missing schemaVersion", () => {
    const result = validatePersistedState(
      { ...BASE_STATE, schemaVersion: undefined },
      "minimal",
    );
    expect(result.ok).toBe(false);
  });

  it("rejects duplicate task ids", () => {
    const result = validatePersistedState(
      {
        ...BASE_STATE,
        tasks: [...BASE_STATE.tasks, { ...BASE_STATE.tasks[0] }],
      },
      "strict",
    );
    expect(result.ok).toBe(false);
  });

  it("rejects invalid status", () => {
    const result = validatePersistedState(
      {
        ...BASE_STATE,
        tasks: [{ ...BASE_STATE.tasks[0], status: "invalid" }],
      },
      "strict",
    );
    expect(result.ok).toBe(false);
  });

  it("rejects non-numeric timestamps", () => {
    const result = validatePersistedState(
      {
        ...BASE_STATE,
        tasks: [{ ...BASE_STATE.tasks[0], createdAt: "now" }],
      },
      "strict",
    );
    expect(result.ok).toBe(false);
  });

  it("rejects non-boolean hasExplicitTime", () => {
    const result = validatePersistedState(
      {
        ...BASE_STATE,
        tasks: [{ ...BASE_STATE.tasks[0], hasExplicitTime: "yes" }],
      },
      "strict",
    );
    expect(result.ok).toBe(false);
  });

  it("accepts optional task links when shape is valid", () => {
    const result = validatePersistedState(
      {
        ...BASE_STATE,
        tasks: [
          {
            ...BASE_STATE.tasks[0],
            links: [
              {
                id: "link-1",
                target: "https://example.com",
                label: "Spec",
                kind: "url",
                source: "manual",
              },
            ],
          },
        ],
      },
      "strict",
    );
    expect(result.ok).toBe(true);
  });

  it("accepts priority-aware normalized task tags", () => {
    const result = validatePersistedState(
      {
        ...BASE_STATE,
        tasks: [{ ...BASE_STATE.tasks[0], tags: ["#p2", "work", "home"] }],
      },
      "strict",
    );
    expect(result.ok).toBe(true);
  });

  it("rejects non-normalized priority-aware task tags", () => {
    const result = validatePersistedState(
      {
        ...BASE_STATE,
        tasks: [{ ...BASE_STATE.tasks[0], tags: ["work", "#p2", "#p1"] }],
      },
      "strict",
    );
    expect(result.ok).toBe(false);
  });

  it("accepts calendar_import source and path link kind", () => {
    const result = validatePersistedState(
      {
        ...BASE_STATE,
        tasks: [
          {
            ...BASE_STATE.tasks[0],
            links: [
              {
                id: "link-1",
                target: "/tmp/report.txt",
                kind: "path",
                source: "calendar_import",
              },
            ],
          },
        ],
      },
      "strict",
    );
    expect(result.ok).toBe(true);
  });

  it("rejects malformed task links", () => {
    const invalidKind = validatePersistedState(
      {
        ...BASE_STATE,
        tasks: [
          {
            ...BASE_STATE.tasks[0],
            links: [
              {
                id: "link-1",
                target: "https://example.com",
                kind: "ftp",
              },
            ],
          },
        ],
      },
      "strict",
    );
    expect(invalidKind.ok).toBe(false);

    const missingTarget = validatePersistedState(
      {
        ...BASE_STATE,
        tasks: [
          {
            ...BASE_STATE.tasks[0],
            links: [{ id: "link-2", target: "" }],
          },
        ],
      },
      "strict",
    );
    expect(missingTarget.ok).toBe(false);

    const invalidSource = validatePersistedState(
      {
        ...BASE_STATE,
        tasks: [
          {
            ...BASE_STATE.tasks[0],
            links: [
              {
                id: "link-3",
                target: "https://example.com",
                source: "imported",
              },
            ],
          },
        ],
      },
      "strict",
    );
    expect(invalidSource.ok).toBe(false);

    const controlCharsInV4 = validatePersistedState(
      {
        ...BASE_STATE,
        tasks: [
          {
            ...BASE_STATE.tasks[0],
            links: [
              {
                id: "link-4",
                target:
                  "https://example.com/path\nATTENDEE:mailto:test@example.com",
              },
            ],
          },
        ],
      },
      "strict",
    );
    expect(controlCharsInV4.ok).toBe(false);

    const controlCharsInV5 = validatePersistedState(
      {
        ...BASE_STATE,
        schemaVersion: 5,
        engagement: {
          completionLog: [],
          achievements: {},
          streak: {
            currentDays: 0,
            bestDays: 0,
            lastCompletionDayKey: null,
          },
        },
        tasks: [
          {
            ...BASE_STATE.tasks[0],
            links: [
              {
                id: "link-5",
                target:
                  "https://example.com/path\nATTENDEE:mailto:test@example.com",
              },
            ],
          },
        ],
      },
      "strict",
    );
    expect(controlCharsInV5.ok).toBe(false);
  });

  it("tolerates unknown extra fields", () => {
    const result = validatePersistedState(
      {
        ...BASE_STATE,
        extra: "ignored",
        tasks: [{ ...BASE_STATE.tasks[0], unknown: "value" }],
      },
      "strict",
    );
    expect(result.ok).toBe(true);
  });

  it("rejects invalid fixture shape", async () => {
    const fixturePath = fileURLToPath(
      new URL("./__fixtures__/persisted.invalid.json", import.meta.url).href,
    );
    const raw = await fs.readFile(fixturePath, "utf8");
    const fixture = JSON.parse(raw) as unknown;
    const result = validatePersistedState(fixture, "strict");
    expect(result.ok).toBe(false);
  });

  it("accepts valid recurrence + instance_of fields", () => {
    const result = validatePersistedState(
      {
        ...BASE_STATE,
        tasks: [
          {
            ...BASE_STATE.tasks[0],
            id: "series",
            recurrence: {
              dtstart: "2026-02-10T09:00:00",
              rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU",
              series_id: "series:series",
              exdates: ["2026-02-17T09:00:00"],
            },
          },
          {
            ...BASE_STATE.tasks[0],
            id: "instance",
            status: "done",
            instance_of: {
              series_id: "series:series",
              occurrence: "2026-02-17T09:00:00",
            },
          },
        ],
      },
      "strict",
    );
    expect(result.ok).toBe(true);
  });

  it("rejects recurrence/instance normalization and mutual exclusivity violations", () => {
    const result = validatePersistedState(
      {
        ...BASE_STATE,
        tasks: [
          {
            ...BASE_STATE.tasks[0],
            recurrence: {
              dtstart: "2026-02-10T9:00:00",
              rrule: "",
              series_id: "",
              exdates: ["2026-02-17T09:00:00", "2026-02-17T09:00:00"],
            },
            instance_of: {
              series_id: "series:a",
              occurrence: "2026-02-17T09:00:00",
            },
          },
        ],
      },
      "strict",
    );
    expect(result.ok).toBe(false);
  });

  it("rejects non-normalized recurrence exdates ordering", () => {
    const result = validatePersistedState(
      {
        ...BASE_STATE,
        tasks: [
          {
            ...BASE_STATE.tasks[0],
            id: "series",
            recurrence: {
              dtstart: "2026-02-10T09:00:00",
              rrule: "FREQ=DAILY;INTERVAL=1",
              series_id: "series:test",
              exdates: ["2026-02-12T09:00:00", "2026-02-11T09:00:00"],
            },
          },
        ],
      },
      "strict",
    );
    expect(result.ok).toBe(false);
  });

  it("accepts savedView.filters.tagFilter when normalized", () => {
    const result = validatePersistedState(
      {
        ...BASE_STATE,
        savedViews: [
          {
            id: "view-1",
            name: "Boolean Tags",
            createdAt: 1,
            updatedAt: 2,
            filters: {
              status: "open",
              due: "today",
              tagFilter: {
                all: ["home", "work"],
                any: ["urgent"],
                none: ["blocked"],
              },
            },
          },
        ],
      },
      "strict",
    );
    expect(result.ok).toBe(true);
  });

  it("rejects invalid or non-normalized savedView.filters.tagFilter", () => {
    const invalidShape = validatePersistedState(
      {
        ...BASE_STATE,
        savedViews: [
          {
            id: "view-1",
            name: "Boolean Tags",
            createdAt: 1,
            updatedAt: 2,
            filters: {
              status: "open",
              due: "today",
              tagFilter: {
                all: "work",
              },
            },
          },
        ],
      },
      "strict",
    );
    expect(invalidShape.ok).toBe(false);

    const nonNormalized = validatePersistedState(
      {
        ...BASE_STATE,
        savedViews: [
          {
            id: "view-2",
            name: "Boolean Tags 2",
            createdAt: 1,
            updatedAt: 2,
            filters: {
              status: "open",
              due: "today",
              tagFilter: {
                all: ["work", "work"],
              },
            },
          },
        ],
      },
      "strict",
    );
    expect(nonNormalized.ok).toBe(false);
  });

  it("accepts canonical savedView.filters.priority", () => {
    const result = validatePersistedState(
      {
        ...BASE_STATE,
        savedViews: [
          {
            id: "view-priority",
            name: "Priority View",
            createdAt: 1,
            updatedAt: 2,
            filters: {
              status: "open",
              due: "today",
              priority: "#p2",
            },
          },
        ],
      },
      "strict",
    );
    expect(result.ok).toBe(true);
  });

  it("rejects non-canonical savedView.filters.priority", () => {
    const result = validatePersistedState(
      {
        ...BASE_STATE,
        savedViews: [
          {
            id: "view-priority-bad",
            name: "Priority View Bad",
            createdAt: 1,
            updatedAt: 2,
            filters: {
              status: "open",
              due: "today",
              priority: "p2",
            },
          },
        ],
      },
      "strict",
    );
    expect(result.ok).toBe(false);
  });

  it("accepts valid task reminder payloads", () => {
    const result = validatePersistedState(
      {
        ...BASE_STATE,
        tasks: [
          {
            ...BASE_STATE.tasks[0],
            reminder: {
              kind: "before_due",
              offsetMs: 600000,
              lastFiredAt: 100,
              snoozedUntilAt: 200,
            },
          },
        ],
      },
      "strict",
    );
    expect(result.ok).toBe(true);
  });

  it("rejects malformed task reminder payloads", () => {
    const result = validatePersistedState(
      {
        ...BASE_STATE,
        tasks: [
          {
            ...BASE_STATE.tasks[0],
            reminder: {
              kind: "before_due",
              offsetMs: 0,
            },
          },
        ],
      },
      "strict",
    );
    expect(result.ok).toBe(false);
  });

  it("rejects non-normalized completionLog tags in strict mode", () => {
    const result = validatePersistedState(
      {
        ...BASE_STATE,
        schemaVersion: 5,
        engagement: {
          completionLog: [
            {
              taskId: "task-a",
              at: 1,
              tags: ["work", "Work", "work", ""],
            },
          ],
          achievements: {},
          streak: {
            currentDays: 0,
            bestDays: 0,
            lastCompletionDayKey: null,
          },
        },
      },
      "strict",
    );
    expect(result.ok).toBe(false);
  });

  it("rejects achievement meta values with disallowed types in strict mode", () => {
    const result = validatePersistedState(
      {
        ...BASE_STATE,
        schemaVersion: 5,
        engagement: {
          completionLog: [],
          achievements: {
            BAD: {
              id: "BAD",
              unlockedAt: 1,
              meta: {
                count: 1,
                seen: true,
              },
            },
          },
          streak: {
            currentDays: 0,
            bestDays: 0,
            lastCompletionDayKey: null,
          },
        },
      },
      "strict",
    );
    expect(result.ok).toBe(false);
  });

  it("rejects invalid streak metadata in strict mode", () => {
    const negative = validatePersistedState(
      {
        ...BASE_STATE,
        schemaVersion: 5,
        engagement: {
          completionLog: [],
          achievements: {},
          streak: {
            currentDays: -1,
            bestDays: 1,
            lastCompletionDayKey: null,
          },
        },
      },
      "strict",
    );
    expect(negative.ok).toBe(false);

    const malformedDate = validatePersistedState(
      {
        ...BASE_STATE,
        schemaVersion: 5,
        engagement: {
          completionLog: [],
          achievements: {},
          streak: {
            currentDays: 1,
            bestDays: 1,
            lastCompletionDayKey: "2026-13-99",
          },
        },
      },
      "strict",
    );
    expect(malformedDate.ok).toBe(false);
  });
});
