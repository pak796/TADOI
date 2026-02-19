import { describe, expect, it } from "bun:test";
import { createDefaultEngagementState } from "../domain/engagement";
import type { AppState, Task } from "../domain/models";
import { executeCommand } from "./execute";

function createState(tasks: Task[], selectedId?: string): AppState {
  return {
    tasks,
    tagIndex: {},
    savedViews: [],
    engagement: createDefaultEngagementState(),
    engagementToastQueue: [],
    engagementToastActive: null,
    filters: {
      status: "all",
      due: "any"
    },
    sortMode: "due",
    selectedId,
    editor: null
  };
}

describe("executeCommand", () => {
  it("executes add with due/time, normalized tags, and selection", () => {
    const now = new Date(2026, 1, 20, 12, 0).getTime();
    const result = executeCommand(
      {
        type: "add",
        title: "Buy milk",
        dueDate: "2026-02-28",
        atTime: "17:30",
        tags: ["#Errands", "#errands", "# invalid "],
        notes: "2% milk"
      },
      {
        now,
        state: createState([]),
        visibleTasks: []
      }
    );

    expect(result.output.kind).toBe("ok");
    expect(result.output.text).toStartWith("Added task: Buy milk (id:");
    expect(result.actions.map((action) => action.type)).toEqual([
      "setTasks",
      "setTagIndex",
      "setSelected"
    ]);

    const setTasksAction = result.actions[0];
    if (setTasksAction.type !== "setTasks") return;
    expect(setTasksAction.tasks).toHaveLength(1);
    const created = setTasksAction.tasks[0];
    expect(created.status).toBe("open");
    expect(created.tags).toEqual(["errands", "invalid"]);
    expect(created.notes).toBe("2% milk");
    expect(created.dueAt).toBe(new Date(2026, 1, 28, 17, 30).getTime());
    expect(created.hasExplicitTime).toBe(true);

    const setTagIndexAction = result.actions[1];
    if (setTagIndexAction.type !== "setTagIndex") return;
    expect(Object.keys(setTagIndexAction.tagIndex).sort((a, b) => a.localeCompare(b))).toEqual([
      "errands",
      "invalid"
    ]);

    const setSelectedAction = result.actions[2];
    if (setSelectedAction.type !== "setSelected") return;
    expect(setSelectedAction.id).toBe(created.id);
  });

  it("executes done on selected task and emits engagement actions for open->done", () => {
    const now = new Date(2026, 1, 20, 12, 30).getTime();
    const task: Task = {
      id: "task-1",
      title: "Finish spec",
      status: "open",
      createdAt: now - 1000,
      updatedAt: now - 1000,
      tags: ["work"]
    };
    const result = executeCommand(
      {
        type: "done",
        target: { type: "selected" }
      },
      {
        now,
        state: createState([task], task.id),
        visibleTasks: [task],
        selectedTaskId: task.id
      }
    );

    expect(result.output).toEqual({ kind: "ok", text: "Done: Finish spec" });
    expect(result.actions.map((action) => action.type)).toEqual([
      "setTasks",
      "setSelected",
      "recordCompletion",
      "evaluateEngagement"
    ]);

    const setTasksAction = result.actions[0];
    if (setTasksAction.type !== "setTasks") return;
    expect(setTasksAction.tasks[0].status).toBe("done");
    expect(setTasksAction.tasks[0].closedAt).toBe(now);
  });

  it("executes done on already-done task without engagement events", () => {
    const now = new Date(2026, 1, 20, 13, 0).getTime();
    const task: Task = {
      id: "task-2",
      title: "Already done",
      status: "done",
      createdAt: now - 2000,
      updatedAt: now - 1000,
      closedAt: now - 500,
      tags: ["home"]
    };
    const result = executeCommand(
      {
        type: "done",
        target: { type: "id", id: task.id }
      },
      {
        now,
        state: createState([task], task.id),
        visibleTasks: [task],
        selectedTaskId: task.id
      }
    );

    expect(result.actions.map((action) => action.type)).toEqual(["setTasks", "setSelected"]);
  });

  it("returns error when done has no resolvable selected target", () => {
    const result = executeCommand(
      {
        type: "done",
        target: { type: "selected" }
      },
      {
        now: Date.now(),
        state: createState([]),
        visibleTasks: [],
        selectedTaskId: undefined
      }
    );
    expect(result.actions).toEqual([]);
    expect(result.output.kind).toBe("error");
  });

  it("executes due set and clear", () => {
    const now = new Date(2026, 1, 21, 8, 0).getTime();
    const task: Task = {
      id: "task-3",
      title: "Pay rent",
      status: "open",
      createdAt: now - 2000,
      updatedAt: now - 1000,
      tags: []
    };

    const setResult = executeCommand(
      {
        type: "due",
        target: { type: "selected" },
        clear: false,
        dueDate: "2026-03-05",
        atTime: "09:00"
      },
      {
        now,
        state: createState([task], task.id),
        visibleTasks: [task],
        selectedTaskId: task.id
      }
    );
    expect(setResult.output).toEqual({
      kind: "ok",
      text: "Due set: Pay rent -> 2026-03-05 09:00"
    });
    expect(setResult.actions.map((action) => action.type)).toEqual(["setTasks", "setSelected"]);
    const setTasksAction = setResult.actions[0];
    if (setTasksAction.type !== "setTasks") return;
    expect(setTasksAction.tasks[0].dueAt).toBe(new Date(2026, 2, 5, 9, 0).getTime());
    expect(setTasksAction.tasks[0].hasExplicitTime).toBe(true);

    const clearResult = executeCommand(
      {
        type: "due",
        target: { type: "selected" },
        clear: true
      },
      {
        now,
        state: createState([setTasksAction.tasks[0]], task.id),
        visibleTasks: [setTasksAction.tasks[0]],
        selectedTaskId: task.id
      }
    );
    expect(clearResult.output).toEqual({
      kind: "ok",
      text: "Due cleared: Pay rent"
    });
    const clearedAction = clearResult.actions[0];
    if (clearedAction.type !== "setTasks") return;
    expect(clearedAction.tasks[0].dueAt).toBeUndefined();
    expect(clearedAction.tasks[0].hasExplicitTime).toBe(false);
  });

  it("executes help without mutations", () => {
    const result = executeCommand(
      {
        type: "help",
        topic: "add"
      },
      {
        now: Date.now(),
        state: createState([]),
        visibleTasks: []
      }
    );
    expect(result.actions).toEqual([]);
    expect(result.output).toEqual({
      kind: "ok",
      text: 'add <title> [due:YYYY-MM-DD] [at:HH:MM] [#tag ...] [notes:"..."]'
    });
  });
});
