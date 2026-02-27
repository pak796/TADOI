import { getHelpLine } from "./help";
import type {
  AddCommand,
  Command,
  CommandResult,
  CommandTarget,
  DueCommand,
  ExecContext,
  RecurCommand
} from "./types";
import { buildLocalTimestamp, parseStrictLocalDate, parseStrictTime } from "./validate";
import type { Task } from "../domain/models";
import { normalizeTag, updateTagIndex } from "../domain/tagIndex";
import { completeTaskWithRecurrence } from "../domain/recurrence";
import { formatDateToLocalIso } from "../domain/recurrence/rruleAdapter";
import { filterTasks } from "../domain/query";

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

function weekdayFromDate(date: Date): "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun" {
  const weekdays: Array<"sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat"> = [
    "sun",
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
    "sat"
  ];
  return weekdays[date.getDay()] ?? "mon";
}

function toRRuleLine(command: Exclude<RecurCommand, { clear: true }>): string {
  const freq =
    command.every === "day"
      ? "DAILY"
      : command.every === "week"
        ? "WEEKLY"
        : "MONTHLY";
  const parts = [`FREQ=${freq}`, `INTERVAL=${Math.max(1, Math.floor(command.interval))}`];
  if (command.every === "week" && command.onDays && command.onDays.length > 0) {
    const byDay = command.onDays.map((day) => day.slice(0, 2).toUpperCase()).join(",");
    parts.push(`BYDAY=${byDay}`);
  }
  if (command.every === "month" && command.onMonthDays && command.onMonthDays.length > 0) {
    parts.push(`BYMONTHDAY=${command.onMonthDays.join(",")}`);
  }
  return parts.join(";");
}

function isTaskVisible(task: Task, ctx: ExecContext): boolean {
  return filterTasks([task], ctx.state.filters, ctx.now).length > 0;
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
    workflowStage: "todo",
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

  const transitionFromOpen = task.status === "open";
  let tasks: Task[];
  let spawnedId: string | undefined;

  if (transitionFromOpen) {
    const completion = completeTaskWithRecurrence(ctx.state.tasks, task.id, ctx.now);
    tasks = completion.tasks;
    spawnedId = completion.spawnedId;
  } else {
    const nextTask: Task = {
      ...task,
      status: "done",
      updatedAt: ctx.now,
      closedAt: task.closedAt ?? ctx.now
    };
    tasks = ctx.state.tasks.map((candidate) =>
      candidate.id === task.id ? nextTask : candidate
    );
  }

  const spawnedTask = spawnedId
    ? tasks.find((candidate) => candidate.id === spawnedId)
    : undefined;
  const selectedId = spawnedTask && isTaskVisible(spawnedTask, ctx) ? spawnedTask.id : task.id;
  const actions: CommandResult["actions"] = [
    { type: "setTasks", tasks },
    { type: "setSelected", id: selectedId }
  ];
  if (transitionFromOpen) {
    const completedTask = tasks.find((candidate) => candidate.id === task.id) ?? task;
    actions.push({
      type: "recordCompletion",
      taskId: task.id,
      at: ctx.now,
      tags: completedTask.tags
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

function executeRecur(command: RecurCommand, ctx: ExecContext): CommandResult {
  const task = resolveTargetTask(command.target, ctx);
  if (!task) {
    return error("Error: recur requires an existing selected task or id");
  }
  if (typeof task.dueAt !== "number") {
    return error("Error: recurrence requires a due date (set due:YYYY-MM-DD [at:HH:MM] first).");
  }

  let nextTask: Task;
  let output: string;
  if (command.clear) {
    nextTask = {
      ...task,
      recurrence: undefined,
      updatedAt: ctx.now
    };
    output = `Recurrence cleared: ${task.title}`;
  } else {
    const dueDate = new Date(task.dueAt);
    const weekday = weekdayFromDate(dueDate);
    const fallbackMonthDay = dueDate.getDate();
    const interval = Math.max(1, Math.floor(command.interval));
    const freq =
      command.every === "day"
        ? "daily"
        : command.every === "week"
          ? "weekly"
          : "monthly";

    const recurrence: NonNullable<Task["recurrence"]> = {
      freq,
      interval,
      ...(command.every === "week"
        ? { byDay: command.onDays && command.onDays.length > 0 ? command.onDays : [weekday] }
        : {}),
      ...(command.every === "month"
        ? {
            byMonthDay:
              command.onMonthDays && command.onMonthDays.length > 0
                ? command.onMonthDays
                : [fallbackMonthDay]
          }
        : {}),
      anchorLocal: {
        hour: dueDate.getHours(),
        minute: dueDate.getMinutes()
      },
      dtstart: formatDateToLocalIso(dueDate),
      rrule: toRRuleLine(command),
      series_id: task.recurrence?.series_id ?? `series:${task.id}`
    };

    nextTask = {
      ...task,
      recurrence,
      updatedAt: ctx.now
    };
    output = `Recurrence set: ${task.title} -> every ${command.every}`;
  }

  return ok(
    [
      {
        type: "setTasks",
        tasks: ctx.state.tasks.map((candidate) =>
          candidate.id === task.id ? nextTask : candidate
        )
      },
      { type: "setSelected", id: task.id }
    ],
    output
  );
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
  if (command.type === "recur") {
    return executeRecur(command, ctx);
  }
  return ok([], getHelpLine(command.topic));
}
