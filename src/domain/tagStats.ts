import { diffLocalDays, startOfLocalDayMs } from "./dates";
import { Task } from "./models";
import {
  formatPriorityForDisplay,
  isPriorityToken,
  resolveTaskPriorityTag,
} from "./priorityTags";
import { resolveTag, type TagAliases } from "./tagAliases";

export type TagStat = {
  tag: string;
  total: number;
  dueThisWeek: number;
};

export type OpenPriorityStat = {
  priorityTag: string;
  displayPriority: string;
  total: number;
};

function comparePriorityDigits(left: string, right: string): number {
  const normalizedLeft = left.replace(/^0+(?=\d)/, "");
  const normalizedRight = right.replace(/^0+(?=\d)/, "");
  if (normalizedLeft.length !== normalizedRight.length) {
    return normalizedLeft.length - normalizedRight.length;
  }
  const magnitudeCompare = normalizedLeft.localeCompare(normalizedRight);
  if (magnitudeCompare !== 0) {
    return magnitudeCompare;
  }
  if (left.length !== right.length) {
    return left.length - right.length;
  }
  return left.localeCompare(right);
}

export function computeTopTagStats(
  tasks: Task[],
  now: number,
  limit = 5,
  aliases: TagAliases = {},
): TagStat[] {
  const startOfToday = startOfLocalDayMs(now);
  const counts = new Map<string, TagStat>();

  for (const task of tasks) {
    if (task.status === "archived") continue;
    const dayDiff =
      task.dueAt !== undefined ? diffLocalDays(task.dueAt, startOfToday) : null;
    const dueThisWeek = dayDiff !== null && dayDiff >= 0 && dayDiff <= 7;

    const perTask = new Set<string>();
    for (const rawTag of task.tags) {
      if (isPriorityToken(rawTag)) continue;
      const canonical = resolveTag(rawTag, aliases);
      if (!canonical) continue;
      perTask.add(canonical);
    }

    for (const tag of perTask) {
      const existing = counts.get(tag);
      if (existing) {
        existing.total += 1;
        if (dueThisWeek) {
          existing.dueThisWeek += 1;
        }
      } else {
        counts.set(tag, {
          tag,
          total: 1,
          dueThisWeek: dueThisWeek ? 1 : 0,
        });
      }
    }
  }

  return Array.from(counts.values())
    .sort((a, b) => {
      if (a.total !== b.total) return b.total - a.total;
      if (a.dueThisWeek !== b.dueThisWeek) return b.dueThisWeek - a.dueThisWeek;
      return a.tag.localeCompare(b.tag);
    })
    .slice(0, limit);
}

export function computeOpenPriorityStats(tasks: Task[]): OpenPriorityStat[] {
  const counts = new Map<string, number>();

  for (const task of tasks) {
    if (task.status !== "open") continue;
    const priorityTag = resolveTaskPriorityTag(task.tags);
    if (!priorityTag) continue;
    counts.set(priorityTag, (counts.get(priorityTag) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([priorityTag, total]) => ({
      priorityTag,
      displayPriority: formatPriorityForDisplay(priorityTag) ?? priorityTag,
      total,
    }))
    .sort((left, right) => {
      const leftDigits = isPriorityToken(left.priorityTag)?.digits;
      const rightDigits = isPriorityToken(right.priorityTag)?.digits;
      if (leftDigits && rightDigits) {
        const digitCompare = comparePriorityDigits(leftDigits, rightDigits);
        if (digitCompare !== 0) {
          return digitCompare;
        }
      }
      return left.priorityTag.localeCompare(right.priorityTag);
    });
}
