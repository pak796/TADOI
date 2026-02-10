import { addLocalDaysMs, diffLocalDays, startOfLocalDayMs } from "./dates";
import { Task } from "./models";

export type DueBuckets8 = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number
];

export type BacklogTrend7 = [
  number,
  number,
  number,
  number,
  number,
  number,
  number
];

export type TopTagCount = {
  tag: string;
  count: number;
};

function emptyDueBuckets8(): DueBuckets8 {
  return [0, 0, 0, 0, 0, 0, 0, 0];
}

function emptyBacklogTrend7(): BacklogTrend7 {
  return [0, 0, 0, 0, 0, 0, 0];
}

export function computeDueBuckets8(tasks: Task[], now: number): DueBuckets8 {
  const startOfToday = startOfLocalDayMs(now);
  const buckets = emptyDueBuckets8();

  for (const task of tasks) {
    if (task.dueAt === undefined) continue;
    const dayDiff = diffLocalDays(task.dueAt, startOfToday);

    if (dayDiff < 0) {
      buckets[0] += 1;
      continue;
    }

    if (dayDiff >= 0 && dayDiff <= 6) {
      buckets[dayDiff + 1] += 1;
    }
  }

  return buckets;
}

function resolveClosedAt(task: Task): number | undefined {
  if (typeof task.closedAt === "number") {
    return task.closedAt;
  }
  if (task.status !== "open") {
    return task.updatedAt;
  }
  return undefined;
}

export function computeBacklogTrend7(tasks: Task[], now: number): BacklogTrend7 {
  const startOfToday = startOfLocalDayMs(now);
  const trend = emptyBacklogTrend7();

  for (let index = 0; index < 7; index += 1) {
    const dayStart = addLocalDaysMs(startOfToday, index - 6);
    const dayEnd = addLocalDaysMs(dayStart, 1) - 1;
    let openCount = 0;

    for (const task of tasks) {
      if (task.createdAt > dayEnd) continue;
      const closedAt = resolveClosedAt(task);
      if (closedAt !== undefined && closedAt <= dayEnd) continue;
      openCount += 1;
    }

    trend[index] = openCount;
  }

  return trend;
}

export function computeTopTagsOpen(tasks: Task[], limit: number): TopTagCount[] {
  if (limit <= 0) return [];

  const counts = new Map<string, number>();

  for (const task of tasks) {
    if (task.status !== "open") continue;
    for (const tag of task.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => {
      if (left.count !== right.count) {
        return right.count - left.count;
      }
      return left.tag.localeCompare(right.tag);
    })
    .slice(0, limit);
}
