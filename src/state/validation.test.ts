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
      tags: ["work"]
    }
  ],
  tagIndex: {},
  savedViews: []
};

describe("validatePersistedState", () => {
  it("accepts valid current schema", () => {
    const result = validatePersistedState(BASE_STATE, "strict");
    expect(result.ok).toBe(true);
  });

  it("rejects missing schemaVersion", () => {
    const result = validatePersistedState(
      { ...BASE_STATE, schemaVersion: undefined },
      "minimal"
    );
    expect(result.ok).toBe(false);
  });

  it("rejects duplicate task ids", () => {
    const result = validatePersistedState(
      {
        ...BASE_STATE,
        tasks: [...BASE_STATE.tasks, { ...BASE_STATE.tasks[0] }]
      },
      "strict"
    );
    expect(result.ok).toBe(false);
  });

  it("rejects invalid status", () => {
    const result = validatePersistedState(
      {
        ...BASE_STATE,
        tasks: [{ ...BASE_STATE.tasks[0], status: "invalid" }]
      },
      "strict"
    );
    expect(result.ok).toBe(false);
  });

  it("rejects non-numeric timestamps", () => {
    const result = validatePersistedState(
      {
        ...BASE_STATE,
        tasks: [{ ...BASE_STATE.tasks[0], createdAt: "now" }]
      },
      "strict"
    );
    expect(result.ok).toBe(false);
  });

  it("rejects non-boolean hasExplicitTime", () => {
    const result = validatePersistedState(
      {
        ...BASE_STATE,
        tasks: [{ ...BASE_STATE.tasks[0], hasExplicitTime: "yes" }]
      },
      "strict"
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
                source: "manual"
              }
            ]
          }
        ]
      },
      "strict"
    );
    expect(result.ok).toBe(true);
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
                source: "calendar_import"
              }
            ]
          }
        ]
      },
      "strict"
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
                kind: "ftp"
              }
            ]
          }
        ]
      },
      "strict"
    );
    expect(invalidKind.ok).toBe(false);

    const missingTarget = validatePersistedState(
      {
        ...BASE_STATE,
        tasks: [
          {
            ...BASE_STATE.tasks[0],
            links: [{ id: "link-2", target: "" }]
          }
        ]
      },
      "strict"
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
                source: "imported"
              }
            ]
          }
        ]
      },
      "strict"
    );
    expect(invalidSource.ok).toBe(false);
  });

  it("tolerates unknown extra fields", () => {
    const result = validatePersistedState(
      {
        ...BASE_STATE,
        extra: "ignored",
        tasks: [{ ...BASE_STATE.tasks[0], unknown: "value" }]
      },
      "strict"
    );
    expect(result.ok).toBe(true);
  });

  it("rejects invalid fixture shape", async () => {
    const fixturePath = fileURLToPath(
      new URL("./__fixtures__/persisted.invalid.json", import.meta.url).href
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
              exdates: ["2026-02-17T09:00:00"]
            }
          },
          {
            ...BASE_STATE.tasks[0],
            id: "instance",
            status: "done",
            instance_of: {
              series_id: "series:series",
              occurrence: "2026-02-17T09:00:00"
            }
          }
        ]
      },
      "strict"
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
              exdates: ["2026-02-17T09:00:00", "2026-02-17T09:00:00"]
            },
            instance_of: {
              series_id: "series:a",
              occurrence: "2026-02-17T09:00:00"
            }
          }
        ]
      },
      "strict"
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
              exdates: ["2026-02-12T09:00:00", "2026-02-11T09:00:00"]
            }
          }
        ]
      },
      "strict"
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
                none: ["blocked"]
              }
            }
          }
        ]
      },
      "strict"
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
                all: "work"
              }
            }
          }
        ]
      },
      "strict"
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
                all: ["work", "work"]
              }
            }
          }
        ]
      },
      "strict"
    );
    expect(nonNormalized.ok).toBe(false);
  });
});
