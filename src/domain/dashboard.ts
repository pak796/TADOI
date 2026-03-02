import { addLocalDaysMs, diffLocalDays, startOfLocalDayMs } from "./dates";
import { Task } from "./models";
import { isPriorityToken, resolveTaskPriorityTag } from "./priorityTags";
import { resolveTag, type TagAliases } from "./tagAliases";

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

export type PriorityBucketCount = {
  priority: "P1" | "P2" | "P3" | "P4" | "P5";
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

const OVERDUE_AGING_BUCKET_LABELS = [
  "0d",
  "1d",
  "2-3d",
  "4-7d",
  "8-14d",
  "15-30d",
  "30d+"
] as const;
const PRIORITY_BUCKET_ORDER = ["P1", "P2", "P3", "P4", "P5"] as const;

export type TaskDueTimingClassification = {
  dayDiff: number;
  isTimeOverdueToday: boolean;
  isOverdue: boolean;
  overdueAgeDays?: number;
};

export function classifyTaskDueTiming(
  task: Pick<Task, "dueAt" | "hasExplicitTime">,
  nowMs: number,
  startOfTodayMs = startOfLocalDayMs(nowMs)
): TaskDueTimingClassification | undefined {
  if (task.dueAt === undefined) return undefined;

  const dayDiff = diffLocalDays(task.dueAt, startOfTodayMs);
  const isTimeOverdueToday =
    task.hasExplicitTime === true && dayDiff === 0 && nowMs > task.dueAt;
  const isOverdue = dayDiff < 0 || isTimeOverdueToday;

  return {
    dayDiff,
    isTimeOverdueToday,
    isOverdue,
    ...(isOverdue
      ? {
          overdueAgeDays: dayDiff < 0 ? Math.abs(dayDiff) : 0
        }
      : {})
  };
}

function emptyDueBuckets8(): DueBuckets8 {
  return [0, 0, 0, 0, 0, 0, 0, 0];
}

function emptyBacklogTrend7(): BacklogTrend7 {
  return [0, 0, 0, 0, 0, 0, 0];
}

function buildTrailingDayOffsets(windowDays: number): number[] {
  const safeWindowDays = Math.max(1, Math.floor(windowDays));
  return Array.from({ length: safeWindowDays }, (_, index) => index - (safeWindowDays - 1));
}

export function computeDueBuckets8(tasks: Task[], now: number): DueBuckets8 {
  const startOfToday = startOfLocalDayMs(now);
  const buckets = emptyDueBuckets8();

  for (const task of tasks) {
    const dueTiming = classifyTaskDueTiming(task, now, startOfToday);
    if (!dueTiming) continue;

    if (dueTiming.isOverdue) {
      buckets[0] += 1;
      continue;
    }

    if (dueTiming.dayDiff >= 0 && dueTiming.dayDiff <= 6) {
      buckets[dueTiming.dayDiff + 1] += 1;
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
  const trend = computeBacklogTrendWindow(tasks, now, 7);
  const tuple = emptyBacklogTrend7();
  for (let index = 0; index < tuple.length; index += 1) {
    tuple[index] = trend[index] ?? 0;
  }
  return tuple;
}

export function computeBacklogTrendWindow(
  tasks: Task[],
  now: number,
  windowDays: number
): number[] {
  const startOfToday = startOfLocalDayMs(now);
  const offsets = buildTrailingDayOffsets(windowDays);
  const trend = new Array<number>(offsets.length).fill(0);

  for (let index = 0; index < offsets.length; index += 1) {
    const dayStart = addLocalDaysMs(startOfToday, offsets[index]);
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

export function computeTopTagsOpen(
  tasks: Task[],
  limit: number,
  aliases: TagAliases = {}
): TopTagCount[] {
  if (limit <= 0) return [];

  const counts = new Map<string, number>();

  for (const task of tasks) {
    if (task.status !== "open") continue;
    const perTask = new Set<string>();
    for (const tag of task.tags) {
      if (isPriorityToken(tag)) continue;
      const canonical = resolveTag(tag, aliases);
      if (!canonical) continue;
      perTask.add(canonical);
    }
    for (const canonical of perTask) {
      counts.set(canonical, (counts.get(canonical) ?? 0) + 1);
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

export function computePriorityBucketBreakdown(tasks: Task[]): PriorityBucketCount[] {
  const counts = new Map<(typeof PRIORITY_BUCKET_ORDER)[number], number>();

  for (const task of tasks) {
    const priorityTag = resolveTaskPriorityTag(task.tags);
    if (!priorityTag) continue;
    const match = /^#?p([1-5])$/i.exec(priorityTag);
    if (!match) continue;
    const bucket = `P${match[1]}` as (typeof PRIORITY_BUCKET_ORDER)[number];
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }

  return PRIORITY_BUCKET_ORDER.filter((priority) => (counts.get(priority) ?? 0) > 0).map(
    (priority) => ({
      priority,
      count: counts.get(priority) ?? 0
    })
  );
}

export function computeOverdueAgingBuckets(
  tasks: Task[],
  now: Date
): OverdueAgingBucket[] {
  const nowMs = now.getTime();
  const startOfToday = startOfLocalDayMs(nowMs);
  const counts = new Array<number>(OVERDUE_AGING_BUCKET_LABELS.length).fill(0);

  for (const task of tasks) {
    if (task.status !== "open") continue;
    const dueTiming = classifyTaskDueTiming(task, nowMs, startOfToday);
    if (!dueTiming || !dueTiming.isOverdue) continue;

    const daysOverdue = dueTiming.overdueAgeDays ?? 0;
    if (daysOverdue === 0) {
      counts[0] += 1;
      continue;
    }
    if (daysOverdue === 1) {
      counts[1] += 1;
      continue;
    }
    if (daysOverdue <= 3) {
      counts[2] += 1;
      continue;
    }
    if (daysOverdue <= 7) {
      counts[3] += 1;
      continue;
    }
    if (daysOverdue <= 14) {
      counts[4] += 1;
      continue;
    }
    if (daysOverdue <= 30) {
      counts[5] += 1;
      continue;
    }
    counts[6] += 1;
  }

  return OVERDUE_AGING_BUCKET_LABELS.map((label, index) => ({
    label,
    count: counts[index]
  }));
}

export function computeCreatedCompleted7d(tasks: Task[], now: Date): CreatedCompleted7d {
  return computeCreatedCompletedWindow(tasks, now, 7);
}

export function computeCreatedCompletedWindow(
  tasks: Task[],
  now: Date,
  windowDays: number
): CreatedCompleted7d {
  const startOfToday = startOfLocalDayMs(now.getTime());
  const offsets = buildTrailingDayOffsets(windowDays);
  const created = new Array<number>(offsets.length).fill(0);
  const completed = new Array<number>(offsets.length).fill(0);
  const minOffset = offsets[0] ?? 0;

  for (const task of tasks) {
    const createdDiff = diffLocalDays(task.createdAt, startOfToday);
    if (createdDiff >= minOffset && createdDiff <= 0) {
      created[createdDiff - minOffset] += 1;
    }

    if (typeof task.closedAt === "number") {
      const completedDiff = diffLocalDays(task.closedAt, startOfToday);
      if (completedDiff >= minOffset && completedDiff <= 0) {
        completed[completedDiff - minOffset] += 1;
      }
    }
  }

  const createdTotal = created.reduce((sum, value) => sum + value, 0);
  const completedTotal = completed.reduce((sum, value) => sum + value, 0);

  return {
    labels: offsets.map((offset) => String(offset)),
    created,
    completed,
    totals: {
      created: createdTotal,
      completed: completedTotal,
      net: createdTotal - completedTotal
    }
  };
}
