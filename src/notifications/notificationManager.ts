import { addLocalDaysMs, startOfLocalDayMs } from "../domain/dates";
import type { Task } from "../domain/models";
import { isTaskOverdue } from "../domain/navigation";
import {
  getOccurrences,
  latestOverdueOccurrence,
} from "../domain/recurrence/engine";
import { parseLocalIsoToDate } from "../domain/recurrence/rruleAdapter";
import type { Notifier } from "./notifier";
import type { NotificationEvent } from "./types";

type OverdueState = {
  isOverdue: boolean;
  lastNotifiedDueAt?: number;
};

function isRecurringSeriesTask(task: Task): boolean {
  return Boolean(task.recurrence) && task.instance_of === undefined;
}

function isOpenDueTask(task: Task): boolean {
  return task.status === "open" && task.dueAt !== undefined;
}

function computeOverdueTransitionAtMs(
  dueAtMs: number,
  hasExplicitTime: boolean,
): number {
  if (hasExplicitTime) {
    return dueAtMs + 1;
  }
  return addLocalDaysMs(startOfLocalDayMs(dueAtMs), 1);
}

function toIso(epochMs: number): string {
  return new Date(epochMs).toISOString();
}

function cloneState(state: OverdueState | undefined): OverdueState {
  return state ? { ...state } : { isOverdue: false };
}

export class NotificationManager {
  private initialized = false;
  private lastEvaluatedAtMs: number | undefined = undefined;
  private readonly overdueByTaskId = new Map<string, OverdueState>();
  private readonly notifiers: Notifier[];

  constructor(notifiers: Notifier[] = []) {
    this.notifiers = notifiers;
  }

  evaluate(tasks: Task[], nowMs = Date.now()): NotificationEvent[] {
    const now = Number.isFinite(nowMs) ? nowMs : Date.now();
    const events: NotificationEvent[] = [];
    const activeTaskIds = new Set<string>();

    if (!this.initialized) {
      for (const task of tasks) {
        activeTaskIds.add(task.id);
        this.overdueByTaskId.set(task.id, this.buildInitialState(task, now));
      }
      this.initialized = true;
      this.lastEvaluatedAtMs = now;
      return events;
    }

    const previousNow = this.lastEvaluatedAtMs ?? now;

    for (const task of tasks) {
      activeTaskIds.add(task.id);
      if (isRecurringSeriesTask(task)) {
        this.evaluateRecurringSeries(task, previousNow, now, events);
      } else {
        this.evaluateRegularTask(task, now, events);
      }
    }

    for (const trackedId of this.overdueByTaskId.keys()) {
      if (!activeTaskIds.has(trackedId)) {
        this.overdueByTaskId.delete(trackedId);
      }
    }

    this.lastEvaluatedAtMs = now;
    return events;
  }

  private buildInitialState(task: Task, nowMs: number): OverdueState {
    if (!isOpenDueTask(task)) {
      return { isOverdue: false };
    }
    if (isRecurringSeriesTask(task)) {
      return {
        isOverdue: latestOverdueOccurrence(task, nowMs) !== null,
      };
    }
    return {
      isOverdue: isTaskOverdue(task, nowMs),
    };
  }

  private evaluateRegularTask(
    task: Task,
    nowMs: number,
    events: NotificationEvent[],
  ): void {
    const existing = cloneState(this.overdueByTaskId.get(task.id));

    if (!isOpenDueTask(task)) {
      this.overdueByTaskId.set(task.id, {
        ...existing,
        isOverdue: false,
        ...(task.dueAt === undefined ? { lastNotifiedDueAt: undefined } : {}),
      });
      return;
    }

    const dueAtMs = task.dueAt;
    if (dueAtMs === undefined) {
      this.overdueByTaskId.set(task.id, {
        ...existing,
        isOverdue: false,
        lastNotifiedDueAt: undefined,
      });
      return;
    }

    const isOverdue = isTaskOverdue(task, nowMs);
    if (
      !existing.isOverdue &&
      isOverdue &&
      existing.lastNotifiedDueAt !== dueAtMs
    ) {
      this.emitOverdueEvent(task.id, task.title, dueAtMs, nowMs, events);
      existing.lastNotifiedDueAt = dueAtMs;
    }

    this.overdueByTaskId.set(task.id, {
      ...existing,
      isOverdue,
    });
  }

  private evaluateRecurringSeries(
    task: Task,
    previousNowMs: number,
    nowMs: number,
    events: NotificationEvent[],
  ): void {
    const existing = cloneState(this.overdueByTaskId.get(task.id));
    if (task.status !== "open" || !task.recurrence) {
      this.overdueByTaskId.set(task.id, {
        ...existing,
        isOverdue: false,
      });
      return;
    }

    const windowStart = Math.min(previousNowMs, nowMs);
    const windowEnd = Math.max(previousNowMs, nowMs);
    const occurrenceRangeStart = addLocalDaysMs(
      startOfLocalDayMs(windowStart),
      -1,
    );
    const occurrenceRangeEnd = windowEnd;
    const occurrenceIsos = getOccurrences(
      task,
      occurrenceRangeStart,
      occurrenceRangeEnd,
    );
    const hasExplicitTime = task.hasExplicitTime === true;

    for (const occurrenceIso of occurrenceIsos) {
      const occurrenceDate = parseLocalIsoToDate(occurrenceIso);
      if (!occurrenceDate) continue;
      const dueAtMs = occurrenceDate.getTime();
      const transitionAtMs = computeOverdueTransitionAtMs(
        dueAtMs,
        hasExplicitTime,
      );
      if (!(windowStart < transitionAtMs && transitionAtMs <= windowEnd)) {
        continue;
      }
      if (existing.lastNotifiedDueAt === dueAtMs) {
        continue;
      }

      this.emitOverdueEvent(task.id, task.title, dueAtMs, nowMs, events);
      existing.lastNotifiedDueAt = dueAtMs;
    }

    this.overdueByTaskId.set(task.id, {
      ...existing,
      isOverdue: latestOverdueOccurrence(task, nowMs) !== null,
    });
  }

  private emitOverdueEvent(
    taskId: string,
    title: string,
    dueAtMs: number,
    firedAtMs: number,
    events: NotificationEvent[],
  ): void {
    const event: NotificationEvent = {
      type: "TASK_OVERDUE",
      taskId,
      title,
      dueAt: toIso(dueAtMs),
      firedAt: toIso(firedAtMs),
    };
    events.push(event);
    for (const notifier of this.notifiers) {
      notifier.notify(event);
    }
  }
}
