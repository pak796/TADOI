import { getHelpLine } from "./help";
import type {
  AddCommand,
  Command,
  CommandResult,
  CommandTarget,
  DueCommand,
  ExecContext
} from "./types";
import { buildLocalTimestamp, parseStrictLocalDate, parseStrictTime } from "./validate";
import type { Task } from "../domain/models";
import { normalizeTag, updateTagIndex } from "../domain/tagIndex";

const ALLOWED_ACTION_TYPES = new Set([
  "load",
  "recordCompletion",
  "evaluateEngagement",
  "triggerEngagementMilestone",
  "pushEngagementToast",
  "tickEngagementToast",
  "popEngagementToast",
  "setSelected",
  "setFilters",
  "setEditor",
  "updateEditor",
  "setTasks",
  "setSavedViews",
  "setSortMode",
  "setTagIndex"
] as const);

function error(text: string): CommandResult {
  return {
    actions: [],
    output: { kind: "error", text }
  };
}

function ok(actions: CommandResult["actions"], text: string): CommandResult {
  for (const action of actions) {
    if (!ALLOWED_ACTION_TYPES.has(action.type)) {
      throw new Error(`Disallowed action type: ${action.type}`);
    }
  }
  return {
    actions,
    output: { kind: "ok", text }
  };
}

function resolveTargetTask(target: CommandTarget, ctx: ExecContext): Task | null {
  if (target.type === "id") {
    return ctx.state.tasks.find((task) => task.id === target.id) ?? null;
  }
  const selectedId = ctx.selectedTaskId;
  if (!selectedId) return null;
  return ctx.state.tasks.find((task) => task.id === selectedId) ?? null;
}

function buildDueParts(
  dueDate: string,
  atTime?: string
): { dueAt: number; hasExplicitTime: boolean } | null {
  const date = parseStrictLocalDate(dueDate);
  if (!date) return null;

  const time = atTime ? parseStrictTime(atTime) : { hours: 0, minutes: 0 };
  if (!time) return null;

  const dueAt = buildLocalTimestamp(
    date.year,
    date.month,
    date.day,
    time.hours,
    time.minutes
  );
  if (dueAt === null) return null;
  return { dueAt, hasExplicitTime: Boolean(atTime) };
}

function executeAdd(command: AddCommand, ctx: ExecContext): CommandResult {
  const title = command.title.trim();
  if (!title) {
    return error("Error: add requires a title");
  }

  let dueAt: number | undefined;
  let hasExplicitTime = false;
  if (command.dueDate) {
    const dueParts = buildDueParts(command.dueDate, command.atTime);
    if (!dueParts) {
      return error("Error: invalid due date/time");
    }
    dueAt = dueParts.dueAt;
    hasExplicitTime = dueParts.hasExplicitTime;
  }

  const tags = Array.from(
    new Set(
      command.tags
        .map((tag) => normalizeTag(tag))
        .filter((tag): tag is string => Boolean(tag))
    )
  ).sort((left, right) => left.localeCompare(right));

  const notes = command.notes?.trim();
  const newTask: Task = {
    id: crypto.randomUUID(),
    title,
    status: "open",
    createdAt: ctx.now,
    updatedAt: ctx.now,
    tags,
    ...(dueAt !== undefined ? { dueAt, hasExplicitTime } : {}),
    ...(notes ? { notes } : {})
  };

  const actions: CommandResult["actions"] = [
    {
      type: "setTasks",
      tasks: [...ctx.state.tasks, newTask]
    },
    {
      type: "setTagIndex",
      tagIndex: updateTagIndex(ctx.state.tagIndex, tags, ctx.now)
    },
    {
      type: "setSelected",
      id: newTask.id
    }
  ];

  return ok(actions, `Added task: ${title} (id:${newTask.id})`);
}

function executeDone(target: CommandTarget, ctx: ExecContext): CommandResult {
  const task = resolveTargetTask(target, ctx);
  if (!task) {
    return error("Error: done requires an existing selected task or id");
  }

  const nextTask: Task = {
    ...task,
    status: "done",
    updatedAt: ctx.now,
    closedAt: task.closedAt ?? ctx.now
  };
  const tasks = ctx.state.tasks.map((candidate) =>
    candidate.id === task.id ? nextTask : candidate
  );

  const actions: CommandResult["actions"] = [
    { type: "setTasks", tasks },
    { type: "setSelected", id: task.id }
  ];
  if (task.status === "open") {
    actions.push({
      type: "recordCompletion",
      taskId: task.id,
      at: ctx.now,
      tags: nextTask.tags
    });
    actions.push({
      type: "evaluateEngagement",
      at: ctx.now
    });
  }

  return ok(actions, `Done: ${task.title}`);
}

function executeDue(command: DueCommand, ctx: ExecContext): CommandResult {
  const task = resolveTargetTask(command.target, ctx);
  if (!task) {
    return error("Error: due requires an existing selected task or id");
  }

  let nextTask: Task;
  let output: string;
  if (command.clear) {
    nextTask = {
      ...task,
      dueAt: undefined,
      hasExplicitTime: false,
      updatedAt: ctx.now
    };
    output = `Due cleared: ${task.title}`;
  } else {
    const dueParts = buildDueParts(command.dueDate, command.atTime);
    if (!dueParts) {
      return error("Error: invalid due date/time");
    }

    nextTask = {
      ...task,
      dueAt: dueParts.dueAt,
      hasExplicitTime: dueParts.hasExplicitTime,
      updatedAt: ctx.now
    };
    const dueLabel = command.atTime
      ? `${command.dueDate} ${command.atTime}`
      : command.dueDate;
    output = `Due set: ${task.title} -> ${dueLabel}`;
  }

  const actions: CommandResult["actions"] = [
    {
      type: "setTasks",
      tasks: ctx.state.tasks.map((candidate) =>
        candidate.id === task.id ? nextTask : candidate
      )
    },
    {
      type: "setSelected",
      id: task.id
    }
  ];
  return ok(actions, output);
}

export function executeCommand(command: Command, ctx: ExecContext): CommandResult {
  if (command.type === "add") {
    return executeAdd(command, ctx);
  }
  if (command.type === "done") {
    return executeDone(command.target, ctx);
  }
  if (command.type === "due") {
    return executeDue(command, ctx);
  }
  return ok([], getHelpLine(command.topic));
}
