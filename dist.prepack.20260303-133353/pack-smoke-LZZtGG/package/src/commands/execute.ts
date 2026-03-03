import { getHelpLine } from "./help";
import type {
  AddCommand,
  BulkCommand,
  BulkTarget,
  Command,
  CommandResult,
  CommandTarget,
  CheckCommand,
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
import {
  addChecklistItem,
  checklistItemAtDisplayIndex,
  clearChecklist,
  deleteChecklistItem,
  editChecklistItem,
  toggleChecklistItem
} from "../domain/checklist";
import {
  normalizePriorityFilterValue,
  normalizePriorityTags,
  isPriorityToken
} from "../domain/priorityTags";
import { recomputeTagIndex } from "../state/portability";

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
    checklist: [],
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

function executeCheck(command: CheckCommand, ctx: ExecContext): CommandResult {
  const task = resolveTargetTask(command.target, ctx);
  if (!task) {
    return error("Error: check requires an existing selected task or id");
  }

  const nowIso = new Date(ctx.now).toISOString();
  let nextChecklistResult:
    | ReturnType<typeof addChecklistItem>
    | ReturnType<typeof editChecklistItem>
    | ReturnType<typeof deleteChecklistItem>
    | ReturnType<typeof toggleChecklistItem>
    | ReturnType<typeof clearChecklist>;
  let output = "";

  if (command.operation === "add") {
    nextChecklistResult = addChecklistItem(task.checklist, command.text, nowIso);
    output = `Checklist added: ${task.title}`;
  } else if (command.operation === "clear") {
    nextChecklistResult = clearChecklist();
    output = `Checklist cleared: ${task.title}`;
  } else {
    const item = checklistItemAtDisplayIndex(task.checklist, command.index);
    if (!item) {
      return error("Error: checklist item not found");
    }
    if (command.operation === "toggle") {
      nextChecklistResult = toggleChecklistItem(task.checklist, item.id, nowIso);
      output = `Checklist toggled: ${task.title} (#${String(command.index)})`;
    } else if (command.operation === "edit") {
      nextChecklistResult = editChecklistItem(task.checklist, item.id, command.text, nowIso);
      output = `Checklist edited: ${task.title} (#${String(command.index)})`;
    } else {
      nextChecklistResult = deleteChecklistItem(task.checklist, item.id);
      output = `Checklist deleted: ${task.title} (#${String(command.index)})`;
    }
  }

  if (!nextChecklistResult.ok) {
    return error(nextChecklistResult.error);
  }

  const updatedTask: Task = {
    ...task,
    checklist: nextChecklistResult.checklist,
    updatedAt: ctx.now
  };

  return ok(
    [
      {
        type: "setTasks",
        tasks: ctx.state.tasks.map((candidate) =>
          candidate.id === task.id ? updatedTask : candidate
        )
      },
      {
        type: "setSelected",
        id: task.id
      }
    ],
    output
  );
}

function resolveBulkTargetIds(target: BulkTarget, ctx: ExecContext): string[] | null {
  if (target.type === "ids") {
    return Array.from(new Set(target.ids)).sort((left, right) =>
      left.localeCompare(right)
    );
  }

  const marked = Array.from(new Set(ctx.bulkMarkedTaskIds ?? []));
  if (marked.length === 0) {
    return null;
  }
  return marked.sort((left, right) => left.localeCompare(right));
}

function resolveBulkTasks(command: BulkCommand, ctx: ExecContext): {
  ids: string[];
  tasks: Task[];
} | null {
  const ids = resolveBulkTargetIds(command.target, ctx);
  if (!ids || ids.length === 0) {
    return null;
  }

  const byId = new Map(ctx.state.tasks.map((task) => [task.id, task]));
  const tasks: Task[] = [];
  for (const id of ids) {
    const task = byId.get(id);
    if (!task) {
      throw new Error(`Error: bulk target id not found (${id})`);
    }
    tasks.push(task);
  }

  return { ids, tasks };
}

function mapBulkStage(stage: "todo" | "doing" | "blocked" | "done"): Task["workflowStage"] {
  if (stage === "doing") return "in_progress";
  return stage;
}

function executeBulk(command: BulkCommand, ctx: ExecContext): CommandResult {
  let resolved: { ids: string[]; tasks: Task[] } | null;
  try {
    resolved = resolveBulkTasks(command, ctx);
  } catch (caught) {
    return error(caught instanceof Error ? caught.message : String(caught));
  }

  if (!resolved) {
    return error("No tasks marked. Press 'm' to mark tasks first.");
  }

  const { ids } = resolved;
  let workingTasks = [...ctx.state.tasks];
  const transitionedToDone: Array<{ taskId: string; tags: string[] }> = [];
  let shouldRecomputeTagIndex = false;

  if (command.operation === "done") {
    for (const id of ids) {
      const current = workingTasks.find((task) => task.id === id);
      if (!current) {
        return error(`Error: bulk target id not found (${id})`);
      }
      if (current.status === "open") {
        const completion = completeTaskWithRecurrence(workingTasks, id, ctx.now);
        workingTasks = completion.tasks;
        const completedTask = workingTasks.find((task) => task.id === id);
        if (completedTask?.status === "done") {
          transitionedToDone.push({ taskId: id, tags: completedTask.tags });
        }
      } else if (current.status !== "done") {
        workingTasks = workingTasks.map((task) =>
          task.id === id
            ? {
                ...task,
                status: "done",
                updatedAt: ctx.now,
                closedAt: task.closedAt ?? ctx.now
              }
            : task
        );
      }
    }

    const actions: CommandResult["actions"] = [
      { type: "setTasks", tasks: workingTasks },
      { type: "setSelected", id: ids[0] }
    ];
    for (const transition of transitionedToDone) {
      actions.push({
        type: "recordCompletion",
        taskId: transition.taskId,
        at: ctx.now,
        tags: transition.tags
      });
    }
    if (transitionedToDone.length > 0) {
      actions.push({
        type: "evaluateEngagement",
        at: ctx.now
      });
    }

    return ok(actions, `Bulk done applied (${String(ids.length)} tasks)`);
  }

  if (command.operation === "tag_add" || command.operation === "tag_rm") {
    const normalizedTags = Array.from(
      new Set(
        command.tags
          .map((tag) => normalizeTag(tag))
          .filter((tag): tag is string => Boolean(tag))
      )
    );
    if (normalizedTags.length === 0) {
      return error("Error: bulk tag requires at least one valid tag");
    }
    const removeSet = new Set(normalizedTags);
    const idSet = new Set(ids);
    workingTasks = workingTasks.map((task) => {
      if (!idSet.has(task.id)) return task;
      shouldRecomputeTagIndex = true;
      const nextTags =
        command.operation === "tag_add"
          ? normalizePriorityTags([...task.tags, ...normalizedTags])
          : normalizePriorityTags(
              task.tags.filter((tag) => {
                const normalized = normalizeTag(tag);
                return normalized ? !removeSet.has(normalized) : true;
              })
            );
      return {
        ...task,
        tags: nextTags,
        updatedAt: ctx.now
      };
    });

    const actions: CommandResult["actions"] = [
      { type: "setTasks", tasks: workingTasks },
      { type: "setSelected", id: ids[0] }
    ];
    if (shouldRecomputeTagIndex) {
      actions.push({
        type: "setTagIndex",
        tagIndex: recomputeTagIndex(workingTasks, ctx.now)
      });
    }
    return ok(
      actions,
      `Bulk tag ${command.operation === "tag_add" ? "add" : "rm"} applied (${String(ids.length)} tasks)`
    );
  }

  if (command.operation === "due") {
    const idSet = new Set(ids);
    let dueParts: { dueAt: number; hasExplicitTime: boolean } | null = null;
    if (!command.clear) {
      dueParts = buildDueParts(command.dueDate, command.atTime);
      if (!dueParts) {
        return error("Error: invalid due date/time");
      }
    }
    workingTasks = workingTasks.map((task) => {
      if (!idSet.has(task.id)) return task;
      return {
        ...task,
        dueAt: command.clear ? undefined : dueParts?.dueAt,
        hasExplicitTime: command.clear ? false : dueParts?.hasExplicitTime ?? false,
        updatedAt: ctx.now
      };
    });
    return ok(
      [
        { type: "setTasks", tasks: workingTasks },
        { type: "setSelected", id: ids[0] }
      ],
      command.clear
        ? `Bulk due cleared (${String(ids.length)} tasks)`
        : `Bulk due set (${String(ids.length)} tasks)`
    );
  }

  if (command.operation === "priority") {
    const normalizedPriority = command.clear
      ? undefined
      : normalizePriorityFilterValue(command.value);
    if (!command.clear && !normalizedPriority) {
      return error(`Error: invalid priority "${command.value ?? ""}"`);
    }
    const idSet = new Set(ids);
    workingTasks = workingTasks.map((task) => {
      if (!idSet.has(task.id)) return task;
      shouldRecomputeTagIndex = true;
      const withoutPriority = task.tags.filter((tag) => !isPriorityToken(tag));
      const nextTags = normalizePriorityTags(
        normalizedPriority ? [normalizedPriority, ...withoutPriority] : withoutPriority
      );
      return {
        ...task,
        tags: nextTags,
        updatedAt: ctx.now
      };
    });

    const actions: CommandResult["actions"] = [
      { type: "setTasks", tasks: workingTasks },
      { type: "setSelected", id: ids[0] }
    ];
    if (shouldRecomputeTagIndex) {
      actions.push({
        type: "setTagIndex",
        tagIndex: recomputeTagIndex(workingTasks, ctx.now)
      });
    }
    return ok(actions, `Bulk priority applied (${String(ids.length)} tasks)`);
  }

  if (command.operation === "assignee" || command.operation === "project") {
    const idSet = new Set(ids);
    workingTasks = workingTasks.map((task) => {
      if (!idSet.has(task.id)) return task;
      const patch =
        command.operation === "assignee"
          ? { assignee: command.clear ? undefined : command.value?.trim() || undefined }
          : { project: command.clear ? undefined : command.value?.trim() || undefined };
      return {
        ...task,
        ...patch,
        updatedAt: ctx.now
      };
    });
    return ok(
      [
        { type: "setTasks", tasks: workingTasks },
        { type: "setSelected", id: ids[0] }
      ],
      `Bulk ${command.operation} applied (${String(ids.length)} tasks)`
    );
  }

  if (command.operation === "stage") {
    const idSet = new Set(ids);
    const mappedStage = mapBulkStage(command.stage);
    workingTasks = workingTasks.map((task) => {
      if (!idSet.has(task.id)) return task;
      return {
        ...task,
        workflowStage: mappedStage,
        updatedAt: ctx.now
      };
    });
    return ok(
      [
        { type: "setTasks", tasks: workingTasks },
        { type: "setSelected", id: ids[0] }
      ],
      `Bulk stage applied (${String(ids.length)} tasks)`
    );
  }

  const idSet = new Set(ids);
  const blockedRecurringInstances = resolved.tasks.filter((task) => task.instance_of);
  if (blockedRecurringInstances.length > 0) {
    return error(
      "Bulk delete cannot delete recurring occurrences. Unmark occurrences or delete individually (d)."
    );
  }
  workingTasks = workingTasks.filter((task) => !idSet.has(task.id));
  shouldRecomputeTagIndex = true;

  const actions: CommandResult["actions"] = [
    { type: "setTasks", tasks: workingTasks },
    { type: "setSelected", id: workingTasks[0]?.id }
  ];
  if (shouldRecomputeTagIndex) {
    actions.push({
      type: "setTagIndex",
      tagIndex: recomputeTagIndex(workingTasks, ctx.now)
    });
  }
  return ok(actions, `Bulk delete applied (${String(ids.length)} tasks)`);
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
  if (command.type === "check") {
    return executeCheck(command, ctx);
  }
  if (command.type === "bulk") {
    return executeBulk(command, ctx);
  }
  return ok([], getHelpLine(command.topic));
}
