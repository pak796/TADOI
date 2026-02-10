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
});
