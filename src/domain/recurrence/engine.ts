import { diffLocalDays, startOfLocalDayMs } from "../dates";
import { Task } from "../models";
import {
  buildRule,
  formatDateToLocalIso,
  fromFloatingUtcDate,
  parseLocalIsoToDate,
  toFloatingUtcDate
} from "./rruleAdapter";

function normalizeIso(iso: string): string | null {
  const date = parseLocalIsoToDate(iso);
  if (!date) return null;
  return formatDateToLocalIso(date);
}

function exdateSet(exdates: string[] | undefined): Set<string> {
  const set = new Set<string>();
  if (!exdates) return set;
  for (const exdate of exdates) {
    const normalized = normalizeIso(exdate);
    if (normalized) set.add(normalized);
  }
  return set;
}

function isOccurrenceOverdue(occurrenceMs: number, hasExplicitTime: boolean, nowMs: number): boolean {
  const startOfToday = startOfLocalDayMs(nowMs);
  const dayDiff = diffLocalDays(occurrenceMs, startOfToday);
  const timeOverdue = hasExplicitTime && dayDiff === 0 && nowMs > occurrenceMs;
  return dayDiff < 0 || timeOverdue;
}

function mapFloatingDateToLocalIso(date: Date): string {
  return formatDateToLocalIso(fromFloatingUtcDate(date));
}

function hasRecurrence(task: Task): boolean {
  return Boolean(task.recurrence);
}

export function applyExdates(occurrenceIsos: string[], exdates: string[] | undefined): string[] {
  const excluded = exdateSet(exdates);
  return occurrenceIsos.filter((iso) => !excluded.has(iso));
}

export function getOccurrences(seriesTask: Task, rangeStartMs: number, rangeEndMs: number): string[] {
  if (!hasRecurrence(seriesTask) || !seriesTask.recurrence) return [];
  if (rangeEndMs < rangeStartMs) return [];
  const rule = buildRule(seriesTask.recurrence);
  const start = toFloatingUtcDate(new Date(rangeStartMs));
  const end = toFloatingUtcDate(new Date(rangeEndMs));
  const occurrences = rule.between(start, end, true).map(mapFloatingDateToLocalIso);
  return applyExdates(occurrences, seriesTask.recurrence.exdates);
}

export function nextOccurrence(seriesTask: Task, afterMs: number): string | null {
  if (!hasRecurrence(seriesTask) || !seriesTask.recurrence) return null;
  const rule = buildRule(seriesTask.recurrence);
  const excluded = exdateSet(seriesTask.recurrence.exdates);
  let cursor = rule.after(toFloatingUtcDate(new Date(afterMs)), false);
  let safety = 0;
  const safetyLimit = Math.max(256, excluded.size * 4);

  while (cursor && safety < safetyLimit) {
    const iso = mapFloatingDateToLocalIso(cursor);
    if (!excluded.has(iso)) return iso;
    cursor = rule.after(new Date(cursor.getTime() + 1000), false);
    safety += 1;
  }

  return null;
}

export function latestOverdueOccurrence(seriesTask: Task, nowMs: number): string | null {
  if (!hasRecurrence(seriesTask) || !seriesTask.recurrence) return null;
  const rule = buildRule(seriesTask.recurrence);
  const excluded = exdateSet(seriesTask.recurrence.exdates);
  const hasExplicitTime = seriesTask.hasExplicitTime === true;
  let cursor = rule.before(toFloatingUtcDate(new Date(nowMs)), true);
  let safety = 0;
  const safetyLimit = Math.max(512, excluded.size * 8);

  while (cursor && safety < safetyLimit) {
    const iso = mapFloatingDateToLocalIso(cursor);
    if (!excluded.has(iso)) {
      const occurrenceDate = parseLocalIsoToDate(iso);
      if (occurrenceDate) {
        const occurrenceMs = occurrenceDate.getTime();
        if (isOccurrenceOverdue(occurrenceMs, hasExplicitTime, nowMs)) {
          return iso;
        }
      }
    }
    cursor = rule.before(new Date(cursor.getTime() - 1000), true);
    safety += 1;
  }

  return null;
}
