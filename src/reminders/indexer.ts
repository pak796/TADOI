import { createHash } from "node:crypto";
import { promises as fs } from "fs";
import { buildSeriesOccurrenceRowId } from "../domain/taskRows";
import type { Task, TaskReminder } from "../domain/models";
import { getOccurrences } from "../domain/recurrence/engine";
import {
  formatDateToLocalIso,
  parseLocalIsoToDate,
} from "../domain/recurrence/rruleAdapter";
import {
  isReminderPendingForEffectiveAt,
  normalizeTaskReminder,
  resolveEffectiveReminderAt,
} from "../domain/reminders";
import { resolveTaskPriorityTag } from "../domain/priorityTags";
import { writeJsonAtomic, type PersistenceFsOps } from "../state/persistence";
import {
  REMINDER_INDEX_LOOKAHEAD_DAYS,
  REMINDER_INDEX_VERSION,
  type ReminderIndex,
  type ReminderIndexEvent,
} from "./types";
import { getReminderIndexPath } from "./paths";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_FS_OPS: PersistenceFsOps = fs;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeIsoString(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return undefined;
  return new Date(parsed).toISOString();
}

function normalizeReminderIndexEvent(
  input: unknown,
): ReminderIndexEvent | undefined {
  if (!isRecord(input)) return undefined;
  const eventId = typeof input.eventId === "string" ? input.eventId : "";
  const taskId = typeof input.taskId === "string" ? input.taskId : "";
  const occurrenceKey =
    typeof input.occurrenceKey === "string" ? input.occurrenceKey : "";
  const remindAt = normalizeIsoString(input.remindAt);
  const dueAt = normalizeIsoString(input.dueAt);
  const title = typeof input.title === "string" ? input.title : "";
  const priority = typeof input.priority === "string" ? input.priority : "";
  const tags = Array.isArray(input.tags)
    ? input.tags.filter((value): value is string => typeof value === "string")
    : [];

  if (!eventId || !taskId || !occurrenceKey || !remindAt || !dueAt || !title) {
    return undefined;
  }

  return {
    eventId,
    taskId,
    occurrenceKey,
    remindAt,
    dueAt,
    title,
    priority,
    tags,
  };
}

function normalizeReminderIndex(input: unknown, nowMs: number): ReminderIndex {
  if (!isRecord(input)) {
    return {
      version: REMINDER_INDEX_VERSION,
      generatedAt: new Date(nowMs).toISOString(),
      events: [],
    };
  }

  const events = Array.isArray(input.events)
    ? input.events
        .map((event) => normalizeReminderIndexEvent(event))
        .filter((event): event is ReminderIndexEvent => Boolean(event))
    : [];

  return {
    version: REMINDER_INDEX_VERSION,
    generatedAt:
      normalizeIsoString(input.generatedAt) ?? new Date(nowMs).toISOString(),
    events,
  };
}

function normalizeOccurrenceIso(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = parseLocalIsoToDate(value);
  if (!parsed) return undefined;
  return formatDateToLocalIso(parsed);
}

function toIso(valueMs: number): string {
  return new Date(valueMs).toISOString();
}

function hashEventId(
  taskId: string,
  occurrenceKey: string,
  remindAtIso: string,
): string {
  return createHash("sha256")
    .update(taskId)
    .update("|")
    .update(occurrenceKey)
    .update("|")
    .update(remindAtIso)
    .digest("hex");
}

function resolveEventPriority(task: Task): string {
  return resolveTaskPriorityTag(task.tags) ?? "";
}

function buildEvent(params: {
  task: Task;
  occurrenceKey: string;
  remindAtMs: number;
  dueAtMs: number;
}): ReminderIndexEvent {
  const remindAtIso = toIso(params.remindAtMs);
  return {
    eventId: hashEventId(params.task.id, params.occurrenceKey, remindAtIso),
    taskId: params.task.id,
    occurrenceKey: params.occurrenceKey,
    remindAt: remindAtIso,
    dueAt: toIso(params.dueAtMs),
    title: params.task.title,
    priority: resolveEventPriority(params.task),
    tags: [...params.task.tags],
  };
}

function resolveSeriesReminderAtMs(
  reminder: TaskReminder,
  dueAtMs: number,
): number | undefined {
  if (reminder.kind === "absolute") {
    return reminder.at;
  }
  if (reminder.kind === "before_due" && typeof reminder.offsetMs === "number") {
    return dueAtMs - reminder.offsetMs;
  }
  return undefined;
}

function buildMaterializedOccurrenceSet(tasks: Task[]): Set<string> {
  const set = new Set<string>();
  for (const task of tasks) {
    const seriesId = task.instance_of?.series_id;
    const occurrenceIso = normalizeOccurrenceIso(task.instance_of?.occurrence);
    if (!seriesId || !occurrenceIso) continue;
    set.add(buildSeriesOccurrenceRowId(seriesId, occurrenceIso));
  }
  return set;
}

function pushUniqueEvent(
  event: ReminderIndexEvent,
  map: Map<string, ReminderIndexEvent>,
): void {
  if (!map.has(event.eventId)) {
    map.set(event.eventId, event);
  }
}

function buildNonSeriesEvent(task: Task): ReminderIndexEvent | undefined {
  if (task.status !== "open") return undefined;
  const reminder = normalizeTaskReminder(task.reminder);
  if (!reminder) return undefined;

  const reminderAtMs = resolveEffectiveReminderAt(task);
  if (typeof reminderAtMs !== "number" || !Number.isFinite(reminderAtMs)) {
    return undefined;
  }
  if (!isReminderPendingForEffectiveAt(task.reminder, reminderAtMs)) {
    return undefined;
  }

  const dueAtMs =
    typeof task.dueAt === "number" && Number.isFinite(task.dueAt)
      ? task.dueAt
      : reminderAtMs;

  if (task.instance_of) {
    const normalizedIso = normalizeOccurrenceIso(task.instance_of.occurrence);
    const occurrenceKey = normalizedIso
      ? buildSeriesOccurrenceRowId(task.instance_of.series_id, normalizedIso)
      : `task:${task.id}`;
    return buildEvent({
      task,
      occurrenceKey,
      remindAtMs: reminderAtMs,
      dueAtMs,
    });
  }

  return buildEvent({
    task,
    occurrenceKey: `task:${task.id}`,
    remindAtMs: reminderAtMs,
    dueAtMs,
  });
}

function buildSeriesEvents(
  seriesTask: Task,
  nowMs: number,
  materializedOccurrenceKeys: Set<string>,
): ReminderIndexEvent[] {
  if (
    seriesTask.status !== "open" ||
    !seriesTask.recurrence ||
    seriesTask.instance_of
  ) {
    return [];
  }

  const reminder = normalizeTaskReminder(seriesTask.reminder);
  if (!reminder) {
    return [];
  }

  const rangeStartMs = nowMs - DAY_MS;
  const rangeEndMs = nowMs + REMINDER_INDEX_LOOKAHEAD_DAYS * DAY_MS;
  const occurrences = getOccurrences(seriesTask, rangeStartMs, rangeEndMs);
  const events: ReminderIndexEvent[] = [];

  for (const occurrenceIso of occurrences) {
    const normalizedIso = normalizeOccurrenceIso(occurrenceIso);
    if (!normalizedIso) continue;

    const occurrenceKey = buildSeriesOccurrenceRowId(
      seriesTask.recurrence.series_id,
      normalizedIso,
    );
    if (materializedOccurrenceKeys.has(occurrenceKey)) {
      continue;
    }

    const occurrenceDate = parseLocalIsoToDate(normalizedIso);
    if (!occurrenceDate) continue;

    const dueAtMs = occurrenceDate.getTime();
    const remindAtMs = resolveSeriesReminderAtMs(reminder, dueAtMs);
    if (typeof remindAtMs !== "number" || !Number.isFinite(remindAtMs)) {
      continue;
    }

    events.push(
      buildEvent({
        task: seriesTask,
        occurrenceKey,
        remindAtMs,
        dueAtMs,
      }),
    );
  }

  return events;
}

export function buildReminderIndex(
  tasks: Task[],
  nowMs = Date.now(),
): ReminderIndex {
  const materializedOccurrenceKeys = buildMaterializedOccurrenceSet(tasks);
  const eventById = new Map<string, ReminderIndexEvent>();

  for (const task of tasks) {
    if (task.recurrence && !task.instance_of) {
      const seriesEvents = buildSeriesEvents(
        task,
        nowMs,
        materializedOccurrenceKeys,
      );
      for (const event of seriesEvents) {
        pushUniqueEvent(event, eventById);
      }
    }

    const standaloneEvent = buildNonSeriesEvent(task);
    if (standaloneEvent) {
      pushUniqueEvent(standaloneEvent, eventById);
    }
  }

  const events = Array.from(eventById.values()).sort((left, right) => {
    if (left.remindAt !== right.remindAt) {
      return left.remindAt.localeCompare(right.remindAt);
    }
    return left.eventId.localeCompare(right.eventId);
  });

  return {
    version: REMINDER_INDEX_VERSION,
    generatedAt: new Date(nowMs).toISOString(),
    events,
  };
}

export async function writeReminderIndexForDataFile(options: {
  dataFilePath: string;
  tasks: Task[];
  fsOps?: PersistenceFsOps;
  nowMs?: number;
}): Promise<ReminderIndex> {
  const nowMs = options.nowMs ?? Date.now();
  const index = buildReminderIndex(options.tasks, nowMs);
  await writeJsonAtomic(index, {
    filePath: getReminderIndexPath(options.dataFilePath),
    fsOps: options.fsOps,
    pretty: true,
    fsyncBeforeRename: true,
  });
  return index;
}

export async function loadReminderIndexForDataFile(options: {
  dataFilePath: string;
  fsOps?: PersistenceFsOps;
  nowMs?: number;
}): Promise<ReminderIndex> {
  const fsOps = options.fsOps ?? DEFAULT_FS_OPS;
  const nowMs = options.nowMs ?? Date.now();
  const indexPath = getReminderIndexPath(options.dataFilePath);

  let raw = "";
  try {
    raw = await fsOps.readFile(indexPath, "utf8");
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return {
        version: REMINDER_INDEX_VERSION,
        generatedAt: new Date(nowMs).toISOString(),
        events: [],
      };
    }
    throw error;
  }

  try {
    return normalizeReminderIndex(JSON.parse(raw), nowMs);
  } catch {
    return {
      version: REMINDER_INDEX_VERSION,
      generatedAt: new Date(nowMs).toISOString(),
      events: [],
    };
  }
}

export async function saveReminderIndexForDataFile(options: {
  dataFilePath: string;
  index: ReminderIndex;
  fsOps?: PersistenceFsOps;
}): Promise<void> {
  await writeJsonAtomic(options.index, {
    filePath: getReminderIndexPath(options.dataFilePath),
    fsOps: options.fsOps,
    pretty: true,
    fsyncBeforeRename: true,
  });
}
