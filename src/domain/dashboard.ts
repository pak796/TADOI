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

export type OverdueAgingBucket = {
  label: string;
  count: number;
};

export type CreatedCompleted7d = {
  labels: string[];
  created: number[];
  completed: number[];
  totals: {
    created: number;
    completed: number;
    net: number;
  };
};

const OVERDUE_AGING_BUCKET_LABELS = ["1d", "2–3d", "4–7d", "8–14d", "15–30d", "30d+"] as const;
const LAST_7_DAY_OFFSETS = [-6, -5, -4, -3, -2, -1, 0] as const;

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

export function computeOverdueAgingBuckets(
  tasks: Task[],
  now: Date
): OverdueAgingBucket[] {
  const startOfToday = startOfLocalDayMs(now.getTime());
  const counts = new Array<number>(OVERDUE_AGING_BUCKET_LABELS.length).fill(0);

  for (const task of tasks) {
    if (task.status !== "open" || task.dueAt === undefined) continue;
    const dayDiff = diffLocalDays(task.dueAt, startOfToday);
    if (dayDiff >= 0) continue;

    const daysOverdue = Math.abs(dayDiff);

    if (daysOverdue === 1) {
      counts[0] += 1;
      continue;
    }
    if (daysOverdue <= 3) {
      counts[1] += 1;
      continue;
    }
    if (daysOverdue <= 7) {
      counts[2] += 1;
      continue;
    }
    if (daysOverdue <= 14) {
      counts[3] += 1;
      continue;
    }
    if (daysOverdue <= 30) {
      counts[4] += 1;
      continue;
    }
    counts[5] += 1;
  }

  return OVERDUE_AGING_BUCKET_LABELS.map((label, index) => ({
    label,
    count: counts[index]
  }));
}

export function computeCreatedCompleted7d(tasks: Task[], now: Date): CreatedCompleted7d {
  const startOfToday = startOfLocalDayMs(now.getTime());
  const created = new Array<number>(LAST_7_DAY_OFFSETS.length).fill(0);
  const completed = new Array<number>(LAST_7_DAY_OFFSETS.length).fill(0);

  for (const task of tasks) {
    const createdDiff = diffLocalDays(task.createdAt, startOfToday);
    if (createdDiff >= -6 && createdDiff <= 0) {
      created[createdDiff + 6] += 1;
    }

    if (typeof task.closedAt === "number") {
      const completedDiff = diffLocalDays(task.closedAt, startOfToday);
      if (completedDiff >= -6 && completedDiff <= 0) {
        completed[completedDiff + 6] += 1;
      }
    }
  }

  const createdTotal = created.reduce((sum, value) => sum + value, 0);
  const completedTotal = completed.reduce((sum, value) => sum + value, 0);

  return {
    labels: LAST_7_DAY_OFFSETS.map((offset) => String(offset)),
    created,
    completed,
    totals: {
      created: createdTotal,
      completed: completedTotal,
      net: createdTotal - completedTotal
    }
  };
}
