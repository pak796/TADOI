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
