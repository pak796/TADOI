import type { ChecklistItem, Task } from "../models";
import { normalizeTaskReminder, stripReminderRuntimeState } from "../reminders";
import { parseLocalIsoToDate } from "./rruleAdapter";

export type ChecklistOccurrenceContext = {
  seriesTask: Task;
  seriesId: string;
  occurrenceIso: string;
  instanceTask?: Task;
};

export function materializeChecklistOccurrenceOverride(params: {
  tasks: Task[];
  context: ChecklistOccurrenceContext;
  checklist: ChecklistItem[];
  nowMs: number;
}): { ok: true; tasks: Task[]; instance: Task } | { ok: false; error: string } {
  const { tasks, context, checklist, nowMs } = params;
  const occurrenceDate = parseLocalIsoToDate(context.occurrenceIso);
  if (!occurrenceDate) {
    return { ok: false, error: "Invalid occurrence timestamp." };
  }

  const source = context.instanceTask ?? context.seriesTask;
  const instanceId = context.instanceTask?.id ?? crypto.randomUUID();
  const instanceStatus = context.instanceTask?.status ?? "open";
  const reminder = context.instanceTask
    ? normalizeTaskReminder(context.instanceTask.reminder)
    : stripReminderRuntimeState(source.reminder);
  const instance: Task = {
    id: instanceId,
    title: source.title,
    status: instanceStatus,
    createdAt: context.instanceTask?.createdAt ?? nowMs,
    updatedAt: nowMs,
    dueAt: occurrenceDate.getTime(),
    hasExplicitTime: context.seriesTask.hasExplicitTime,
    closedAt:
      instanceStatus === "done"
        ? (context.instanceTask?.closedAt ?? nowMs)
        : undefined,
    notes: source.notes,
    tags: source.tags,
    links: source.links,
    checklist,
    assignee: source.assignee,
    project: source.project,
    workflowStage: source.workflowStage,
    ...(reminder ? { reminder } : {}),
    instance_of: {
      series_id: context.seriesId,
      occurrence: context.occurrenceIso,
    },
  };

  const withoutPreviousInstance = tasks.filter(
    (task) =>
      !(
        task.instance_of?.series_id === context.seriesId &&
        task.instance_of?.occurrence === context.occurrenceIso
      ),
  );
  return {
    ok: true,
    tasks: [...withoutPreviousInstance, instance],
    instance,
  };
}
