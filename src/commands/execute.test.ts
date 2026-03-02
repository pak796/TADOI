import { describe, expect, it } from "bun:test";
import { createDefaultEngagementState } from "../domain/engagement";
import type { AppState, Task } from "../domain/models";
import { executeCommand } from "./execute";

function createState(tasks: Task[], selectedId?: string): AppState {
  return {
    tasks,
    tagIndex: {},
    tagAliases: {},
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
    expect(created.workflowStage).toBe("todo");
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

  it("spawns next task when done transitions open recurring task", () => {
    const now = new Date(2026, 1, 20, 12, 30).getTime();
    const task: Task = {
      id: "task-recurring-1",
      title: "Weekly sync",
      status: "open",
      createdAt: now - 1000,
      updatedAt: now - 1000,
      dueAt: new Date(2026, 2, 2, 9, 0).getTime(),
      hasExplicitTime: true,
      recurrence: {
        freq: "weekly",
        interval: 1,
        byDay: ["mon", "wed"],
        anchorLocal: { hour: 9, minute: 0 },
        dtstart: "2026-03-02T09:00:00",
        rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE",
        series_id: "series:task-recurring-1"
      },
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

    expect(result.output).toEqual({ kind: "ok", text: "Done: Weekly sync" });
    expect(result.actions.map((action) => action.type)).toEqual([
      "setTasks",
      "setSelected",
      "recordCompletion",
      "evaluateEngagement"
    ]);
    const setTasks = result.actions[0];
    if (setTasks.type !== "setTasks") return;
    expect(setTasks.tasks).toHaveLength(2);
    const doneTask = setTasks.tasks.find((candidate) => candidate.id === task.id);
    const spawned = setTasks.tasks.find((candidate) => candidate.id !== task.id);
    expect(doneTask?.status).toBe("done");
    expect(spawned?.status).toBe("open");
    expect(spawned?.dueAt).toBe(new Date(2026, 2, 4, 9, 0).getTime());
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

  it("executes due clear for id target", () => {
    const now = new Date(2026, 1, 21, 8, 0).getTime();
    const task: Task = {
      id: "task-id-clear",
      title: "Clear by id",
      status: "open",
      createdAt: now - 2000,
      updatedAt: now - 1000,
      dueAt: new Date(2026, 2, 5, 9, 0).getTime(),
      hasExplicitTime: true,
      tags: []
    };

    const result = executeCommand(
      {
        type: "due",
        target: { type: "id", id: task.id },
        clear: true
      },
      {
        now,
        state: createState([task], task.id),
        visibleTasks: [task],
        selectedTaskId: undefined
      }
    );

    expect(result.output).toEqual({
      kind: "ok",
      text: "Due cleared: Clear by id"
    });
    expect(result.actions.map((action) => action.type)).toEqual(["setTasks", "setSelected"]);
    const setTasksAction = result.actions[0];
    if (setTasksAction.type !== "setTasks") return;
    expect(setTasksAction.tasks[0].dueAt).toBeUndefined();
    expect(setTasksAction.tasks[0].hasExplicitTime).toBe(false);
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
      text: 'add <title> [due:<date|mini>] [at:<time>] [#tag ...] [notes:"..."]'
    });
  });

  it("executes note help without mutations", () => {
    const result = executeCommand(
      {
        type: "note",
        operation: "help"
      },
      {
        now: Date.now(),
        state: createState([]),
        visibleTasks: []
      }
    );
    expect(result.actions).toEqual([]);
    expect(result.output.kind).toBe("ok");
    expect(result.output.text).toContain("TOME COMMANDS");
    expect(result.output.text).toContain('note new "Title"');
  });

  it("returns context error for mutating note commands", () => {
    const result = executeCommand(
      {
        type: "note",
        operation: "reindex"
      },
      {
        now: Date.now(),
        state: createState([]),
        visibleTasks: []
      }
    );
    expect(result.actions).toEqual([]);
    expect(result.output).toEqual({
      kind: "error",
      text: "Error: note commands require NotesService context"
    });
  });

  it("returns context error for tag lifecycle commands", () => {
    const result = executeCommand(
      {
        type: "tag",
        operation: "cleanup",
        dryRun: false
      },
      {
        now: Date.now(),
        state: createState([]),
        visibleTasks: []
      }
    );
    expect(result.actions).toEqual([]);
    expect(result.output).toEqual({
      kind: "error",
      text: "Error: tag commands require App orchestration context"
    });
  });

  it("executes recur set and clear", () => {
    const now = new Date(2026, 1, 21, 8, 0).getTime();
    const dueAt = new Date(2026, 2, 5, 9, 0).getTime();
    const task: Task = {
      id: "task-recur-1",
      title: "Plan sprint",
      status: "open",
      createdAt: now - 2000,
      updatedAt: now - 1000,
      dueAt,
      hasExplicitTime: true,
      tags: []
    };

    const setResult = executeCommand(
      {
        type: "recur",
        target: { type: "id", id: task.id },
        clear: false,
        every: "week",
        interval: 2,
        onDays: ["mon"]
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
      text: "Recurrence set: Plan sprint -> every week"
    });
    expect(setResult.actions.map((action) => action.type)).toEqual([
      "setTasks",
      "setSelected",
      "triggerEngagementMilestone"
    ]);
    const setTasksAction = setResult.actions[0];
    if (setTasksAction.type !== "setTasks") return;
    expect(setTasksAction.tasks[0]?.recurrence?.freq).toBe("weekly");
    expect(setTasksAction.tasks[0]?.recurrence?.interval).toBe(2);
    expect(setTasksAction.tasks[0]?.recurrence?.byDay).toEqual(["mon"]);
    const recurringCreatedAction = setResult.actions[2];
    if (recurringCreatedAction.type !== "triggerEngagementMilestone") return;
    expect(recurringCreatedAction.achievementKey).toBe("FIRST_RECURRING_TASK_CREATED");
    expect(recurringCreatedAction.meta).toEqual({ seriesId: "series:task-recur-1" });

    const updateResult = executeCommand(
      {
        type: "recur",
        target: { type: "id", id: task.id },
        clear: false,
        every: "week",
        interval: 3,
        onDays: ["mon"]
      },
      {
        now,
        state: createState(setTasksAction.tasks, task.id),
        visibleTasks: setTasksAction.tasks,
        selectedTaskId: task.id
      }
    );
    expect(updateResult.output).toEqual({
      kind: "ok",
      text: "Recurrence set: Plan sprint -> every week"
    });
    expect(updateResult.actions.map((action) => action.type)).toEqual([
      "setTasks",
      "setSelected"
    ]);
    const updateTasksAction = updateResult.actions[0];
    if (updateTasksAction.type !== "setTasks") return;
    expect(updateTasksAction.tasks[0]?.recurrence?.interval).toBe(3);

    const clearResult = executeCommand(
      {
        type: "recur",
        target: { type: "id", id: task.id },
        clear: true
      },
      {
        now,
        state: createState(updateTasksAction.tasks, task.id),
        visibleTasks: updateTasksAction.tasks,
        selectedTaskId: task.id
      }
    );
    expect(clearResult.output).toEqual({
      kind: "ok",
      text: "Recurrence cleared: Plan sprint"
    });
    const clearTasksAction = clearResult.actions[0];
    if (clearTasksAction.type !== "setTasks") return;
    expect(clearTasksAction.tasks[0]?.recurrence).toBeUndefined();
  });

  it("executes check add/toggle/edit/del/clear", () => {
    const now = new Date(2026, 1, 21, 8, 0).getTime();
    const task: Task = {
      id: "task-check-1",
      title: "Checklist task",
      status: "open",
      createdAt: now - 2000,
      updatedAt: now - 1000,
      tags: [],
      checklist: []
    };

    const addResult = executeCommand(
      {
        type: "check",
        operation: "add",
        target: { type: "id", id: task.id },
        text: "First item"
      },
      {
        now,
        state: createState([task], task.id),
        visibleTasks: [task],
        selectedTaskId: task.id
      }
    );
    expect(addResult.output.kind).toBe("ok");
    const addedTasksAction = addResult.actions[0];
    if (addedTasksAction.type !== "setTasks") return;
    expect(addedTasksAction.tasks[0]?.checklist).toHaveLength(1);
    expect(addedTasksAction.tasks[0]?.checklist?.[0]?.text).toBe("First item");

    const toggled = executeCommand(
      {
        type: "check",
        operation: "toggle",
        target: { type: "id", id: task.id },
        index: 1
      },
      {
        now,
        state: createState(addedTasksAction.tasks, task.id),
        visibleTasks: addedTasksAction.tasks,
        selectedTaskId: task.id
      }
    );
    const toggledTasksAction = toggled.actions[0];
    if (toggledTasksAction.type !== "setTasks") return;
    expect(toggledTasksAction.tasks[0]?.checklist?.[0]?.isDone).toBe(true);

    const edited = executeCommand(
      {
        type: "check",
        operation: "edit",
        target: { type: "id", id: task.id },
        index: 1,
        text: "Renamed item"
      },
      {
        now,
        state: createState(toggledTasksAction.tasks, task.id),
        visibleTasks: toggledTasksAction.tasks,
        selectedTaskId: task.id
      }
    );
    const editedTasksAction = edited.actions[0];
    if (editedTasksAction.type !== "setTasks") return;
    expect(editedTasksAction.tasks[0]?.checklist?.[0]?.text).toBe("Renamed item");

    const deleted = executeCommand(
      {
        type: "check",
        operation: "del",
        target: { type: "id", id: task.id },
        index: 1
      },
      {
        now,
        state: createState(editedTasksAction.tasks, task.id),
        visibleTasks: editedTasksAction.tasks,
        selectedTaskId: task.id
      }
    );
    const deletedTasksAction = deleted.actions[0];
    if (deletedTasksAction.type !== "setTasks") return;
    expect(deletedTasksAction.tasks[0]?.checklist).toEqual([]);

    const cleared = executeCommand(
      {
        type: "check",
        operation: "clear",
        target: { type: "id", id: task.id }
      },
      {
        now,
        state: createState(editedTasksAction.tasks, task.id),
        visibleTasks: editedTasksAction.tasks,
        selectedTaskId: task.id
      }
    );
    const clearedTasksAction = cleared.actions[0];
    if (clearedTasksAction.type !== "setTasks") return;
    expect(clearedTasksAction.tasks[0]?.checklist).toEqual([]);
  });

  it("fails bulk marked commands when no tasks are marked", () => {
    const now = new Date(2026, 1, 21, 8, 0).getTime();
    const task: Task = {
      id: "bulk-empty-1",
      title: "Bulk empty",
      status: "open",
      createdAt: now - 10,
      updatedAt: now - 10,
      tags: []
    };
    const result = executeCommand(
      {
        type: "bulk",
        operation: "done",
        target: { type: "marked" }
      },
      {
        now,
        state: createState([task], task.id),
        visibleTasks: [task],
        selectedTaskId: task.id,
        bulkMarkedTaskIds: []
      }
    );
    expect(result.output).toEqual({
      kind: "error",
      text: "No tasks marked. Press 'm' to mark tasks first."
    });
    expect(result.actions).toEqual([]);
  });

  it("executes bulk done in deterministic id order and commits once", () => {
    const now = new Date(2026, 1, 21, 8, 0).getTime();
    const taskB: Task = {
      id: "b-task",
      title: "Task B",
      status: "open",
      createdAt: now - 20,
      updatedAt: now - 20,
      tags: []
    };
    const taskA: Task = {
      id: "a-task",
      title: "Task A",
      status: "open",
      createdAt: now - 10,
      updatedAt: now - 10,
      tags: []
    };
    const result = executeCommand(
      {
        type: "bulk",
        operation: "done",
        target: { type: "ids", ids: ["b-task", "a-task"] }
      },
      {
        now,
        state: createState([taskB, taskA], taskB.id),
        visibleTasks: [taskB, taskA]
      }
    );

    expect(result.output.kind).toBe("ok");
    expect(result.actions[0]?.type).toBe("setTasks");
    const setTasksAction = result.actions[0];
    if (setTasksAction.type !== "setTasks") return;
    const doneStates = new Map(setTasksAction.tasks.map((task) => [task.id, task.status]));
    expect(doneStates.get("a-task")).toBe("done");
    expect(doneStates.get("b-task")).toBe("done");
  });

  it("fails whole bulk operation on invalid priority with no writes", () => {
    const now = new Date(2026, 1, 21, 8, 0).getTime();
    const task: Task = {
      id: "bulk-priority-1",
      title: "Priority",
      status: "open",
      createdAt: now - 10,
      updatedAt: now - 10,
      tags: []
    };
    const result = executeCommand(
      {
        type: "bulk",
        operation: "priority",
        target: { type: "ids", ids: [task.id] },
        clear: false,
        value: "not-priority"
      },
      {
        now,
        state: createState([task], task.id),
        visibleTasks: [task]
      }
    );

    expect(result.output.kind).toBe("error");
    expect(result.actions).toEqual([]);
  });

  it("blocks bulk delete for recurring occurrence instances", () => {
    const now = new Date(2026, 1, 21, 8, 0).getTime();
    const instanceTask: Task = {
      id: "inst-1",
      title: "Occurrence override",
      status: "open",
      createdAt: now - 20,
      updatedAt: now - 20,
      tags: [],
      instance_of: {
        series_id: "series:1",
        occurrence: "2026-02-21T09:00:00"
      }
    };

    const result = executeCommand(
      {
        type: "bulk",
        operation: "delete",
        target: { type: "ids", ids: [instanceTask.id] }
      },
      {
        now,
        state: createState([instanceTask], instanceTask.id),
        visibleTasks: [instanceTask]
      }
    );

    expect(result.output).toEqual({
      kind: "error",
      text:
        "Bulk delete cannot delete recurring occurrences. Unmark occurrences or delete individually (d)."
    });
    expect(result.actions).toEqual([]);
  });
});
