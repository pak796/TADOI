import { describe, expect, it } from "bun:test";
import { validatePersistedState } from "./validation";

const BASE_STATE = {
  schemaVersion: 2,
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
  tagIndex: {}
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
});
