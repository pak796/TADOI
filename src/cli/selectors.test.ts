import { describe, expect, it } from "bun:test";
import { parseSelectorTokens } from "./selectors";

describe("parseSelectorTokens", () => {
  it("parses valid selector tokens with normalized stage alias", () => {
    const result = parseSelectorTokens(
      [
        "+work",
        "-home",
        "project:Platform",
        "assignee:Alice",
        "status:done",
        "due:today",
        "stage:doing"
      ],
      { status: "open", due: "any" }
    );

    expect(result).toEqual({
      ok: true,
      filters: {
        status: "done",
        due: "today",
        project: "Platform",
        assignee: "Alice",
        workflowStage: "in_progress",
        tagFilter: {
          all: ["work"],
          none: ["home"]
        }
      }
    });
  });

  it("rejects duplicate singleton selectors", () => {
    const result = parseSelectorTokens(
      ["status:open", "status:done"],
      { status: "open", due: "any" }
    );
    expect(result).toEqual({
      ok: false,
      error: 'Error: duplicate selector for "status".'
    });
  });

  it("rejects mixed id and selector mode token", () => {
    const result = parseSelectorTokens(
      ["+work", "id:task-1"],
      { status: "open", due: "any" }
    );
    expect(result).toEqual({
      ok: false,
      error: 'Error: selector mode does not accept "id:<task-id>" tokens.'
    });
  });

  it("rejects unknown selector token", () => {
    const result = parseSelectorTokens(["priority:p2"], {
      status: "open",
      due: "any"
    });
    expect(result).toEqual({
      ok: false,
      error: 'Error: unrecognized selector "priority:p2"'
    });
  });

  it("rejects conflicting include/exclude tag selectors", () => {
    const result = parseSelectorTokens(["+work", "-work"], {
      status: "open",
      due: "any"
    });
    expect(result).toEqual({
      ok: false,
      error: "Error: conflicting selectors for tag(s): work"
    });
  });
});

