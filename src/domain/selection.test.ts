import { describe, expect, it } from "bun:test";
import { Task } from "./models";
import { reconcileSelectionById } from "./selection";

function makeTask(id: string): Task {
  return {
    id,
    title: id,
    status: "open",
    createdAt: 1,
    updatedAt: 1,
    tags: [],
  };
}

describe("reconcileSelectionById", () => {
  it("retains selected task when id is still visible", () => {
    const visible = [makeTask("a"), makeTask("b"), makeTask("c")];
    const result = reconcileSelectionById(visible, "b", 0);
    expect(result).toEqual({ selectedId: "b", selectedIndex: 1 });
  });

  it("clamps to nearest valid index when selected task disappears", () => {
    const visible = [makeTask("a"), makeTask("c")];
    const result = reconcileSelectionById(visible, "b", 1);
    expect(result).toEqual({ selectedId: "c", selectedIndex: 1 });
  });

  it("returns empty selection when no visible tasks remain", () => {
    const result = reconcileSelectionById([], "b", 2);
    expect(result).toEqual({ selectedId: undefined, selectedIndex: 0 });
  });
});
