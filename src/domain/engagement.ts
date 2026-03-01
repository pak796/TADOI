import type {
  AchievementUnlock,
  CompletionEvent,
  EngagementState,
  EngagementToast
} from "./models";

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_DAYS = 90;
const RETENTION_MAX_EVENTS = 500;
const TAG_WINDOW_DAYS = 7;

export const ENGAGEMENT_TOAST_QUEUE_MAX = 3;

export const ENGAGEMENT_TOAST_DURATIONS_MS = {
  FIRST_TASK_DONE: 12_000,
  STREAK_3_DAYS: 10_000,
  TAG_5_LAST_7_DAYS: 8_000,
  DONE_3_TODAY: 8_000
} as const;

export const ONBOARDING_ENGAGEMENT_ACHIEVEMENTS = {
  FIRST_TOME_CREATED: "FIRST_TOME_CREATED",
  FIRST_CHECKLIST_CREATED: "FIRST_CHECKLIST_CREATED",
  FIRST_CHECKLIST_FULLY_COMPLETED: "FIRST_CHECKLIST_FULLY_COMPLETED"
} as const;

export function createDefaultEngagementState(): EngagementState {
  return {
    completionLog: [],
    achievements: {},
    streak: {
      currentDays: 0,
      bestDays: 0,
      lastCompletionDayKey: null
    }
  };
}

export function computeDayKey(at: number): string {
  const date = new Date(at);
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const unique = new Set<string>();
  for (const value of tags) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    unique.add(trimmed);
  }
  return Array.from(unique).sort((left, right) => left.localeCompare(right));
}

function normalizeCompletionLog(events: unknown): CompletionEvent[] {
  if (!Array.isArray(events)) return [];
  const normalized = events
    .map((event): CompletionEvent | null => {
      if (typeof event !== "object" || event === null) return null;
      const record = event as Record<string, unknown>;
      if (typeof record.taskId !== "string" || record.taskId.trim().length === 0) {
        return null;
      }
      if (typeof record.at !== "number" || !Number.isFinite(record.at)) {
        return null;
      }
      return {
        taskId: record.taskId,
        at: Math.floor(record.at),
        tags: normalizeTags(record.tags)
      };
    })
    .filter((event): event is CompletionEvent => event !== null);

  normalized.sort((left, right) => {
    if (left.at !== right.at) return left.at - right.at;
    if (left.taskId !== right.taskId) return left.taskId.localeCompare(right.taskId);
    return left.tags.join(",").localeCompare(right.tags.join(","));
  });
  return normalized;
}

function normalizeAchievements(input: unknown): Record<string, AchievementUnlock> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {};
  }

  const normalized: Record<string, AchievementUnlock> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) continue;
    const record = value as Record<string, unknown>;
    if (typeof record.id !== "string" || record.id.trim().length === 0) continue;
    if (typeof record.unlockedAt !== "number" || !Number.isFinite(record.unlockedAt)) {
      continue;
    }

    let meta: Record<string, string | number> | undefined;
    if (typeof record.meta === "object" && record.meta !== null && !Array.isArray(record.meta)) {
      const nextMeta: Record<string, string | number> = {};
      for (const [metaKey, metaValue] of Object.entries(record.meta as Record<string, unknown>)) {
        if (typeof metaValue === "string" || typeof metaValue === "number") {
          nextMeta[metaKey] = metaValue;
        }
      }
      if (Object.keys(nextMeta).length > 0) {
        meta = nextMeta;
      }
    }

    normalized[key] = {
      id: record.id,
      unlockedAt: Math.floor(record.unlockedAt),
      ...(meta ? { meta } : {})
    };
  }
  return normalized;
}

function parseDayKey(dayKey: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function diffDayKeys(nextDayKey: string, previousDayKey: string): number {
  const nextDate = parseDayKey(nextDayKey);
  const previousDate = parseDayKey(previousDayKey);
  if (!nextDate || !previousDate) return Number.NaN;
  const nextMidnight = new Date(
    nextDate.getFullYear(),
    nextDate.getMonth(),
    nextDate.getDate()
  ).getTime();
  const previousMidnight = new Date(
    previousDate.getFullYear(),
    previousDate.getMonth(),
    previousDate.getDate()
  ).getTime();
  return Math.round((nextMidnight - previousMidnight) / DAY_MS);
}

function defaultStreak(): EngagementState["streak"] {
  return {
    currentDays: 0,
    bestDays: 0,
    lastCompletionDayKey: null
  };
}

export function updateStreak(
  previous: EngagementState["streak"],
  at: number
): EngagementState["streak"] {
  const dayKey = computeDayKey(at);
  const lastCompletionDayKey = previous.lastCompletionDayKey;
  if (lastCompletionDayKey === dayKey) {
    return previous;
  }

  const dayDiff =
    typeof lastCompletionDayKey === "string"
      ? diffDayKeys(dayKey, lastCompletionDayKey)
      : Number.NaN;

  const currentDays = dayDiff === 1 ? previous.currentDays + 1 : 1;
  const bestDays = Math.max(previous.bestDays, currentDays);
  return {
    currentDays,
    bestDays,
    lastCompletionDayKey: dayKey
  };
}

export function enforceCompletionRetention(
  completionLog: CompletionEvent[],
  now: number
): CompletionEvent[] {
  const cutoff = now - RETENTION_DAYS * DAY_MS;
  const retained = completionLog.filter((event) => event.at >= cutoff);
  if (retained.length <= RETENTION_MAX_EVENTS) {
    return retained;
  }
  return retained.slice(retained.length - RETENTION_MAX_EVENTS);
}

export function rebuildStreakFromCompletionLog(
  completionLog: CompletionEvent[]
): EngagementState["streak"] {
  let next = defaultStreak();
  for (const event of completionLog) {
    next = updateStreak(next, event.at);
  }
  return next;
}

export function normalizeEngagementState(
  input: unknown,
  now = Date.now()
): EngagementState {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return createDefaultEngagementState();
  }
  const record = input as Record<string, unknown>;

  const completionLog = enforceCompletionRetention(
    normalizeCompletionLog(record.completionLog),
    now
  );
  const achievements = normalizeAchievements(record.achievements);
  const inferredStreak = rebuildStreakFromCompletionLog(completionLog);

  const rawStreak =
    typeof record.streak === "object" && record.streak !== null && !Array.isArray(record.streak)
      ? (record.streak as Record<string, unknown>)
      : null;

  const streak = rawStreak
    ? {
        currentDays:
          typeof rawStreak.currentDays === "number" && Number.isFinite(rawStreak.currentDays)
            ? Math.max(0, Math.floor(rawStreak.currentDays))
            : inferredStreak.currentDays,
        bestDays:
          typeof rawStreak.bestDays === "number" && Number.isFinite(rawStreak.bestDays)
            ? Math.max(0, Math.floor(rawStreak.bestDays))
            : inferredStreak.bestDays,
        lastCompletionDayKey:
          typeof rawStreak.lastCompletionDayKey === "string" &&
          parseDayKey(rawStreak.lastCompletionDayKey)
            ? rawStreak.lastCompletionDayKey
            : inferredStreak.lastCompletionDayKey
      }
    : inferredStreak;

  return {
    completionLog,
    achievements,
    streak: {
      ...streak,
      bestDays: Math.max(streak.bestDays, streak.currentDays)
    }
  };
}

function createToast(
  input: Pick<EngagementToast, "id" | "message" | "priority" | "durationMs">,
  at: number
): EngagementToast {
  return {
    ...input,
    createdAt: at
  };
}

type MilestoneOutcome = {
  engagement: EngagementState;
  toasts: EngagementToast[];
};

function evaluateTagMilestone(engagement: EngagementState, at: number): {
  engagement: EngagementState;
  toast?: EngagementToast;
} {
  const latestCompletion = engagement.completionLog[engagement.completionLog.length - 1];
  if (!latestCompletion) {
    return { engagement };
  }

  const currentTags = latestCompletion.tags;
  if (currentTags.length === 0) {
    return { engagement };
  }

  const windowStart = at - TAG_WINDOW_DAYS * DAY_MS;
  const counts = new Map<string, number>();
  for (const event of engagement.completionLog) {
    if (event.at < windowStart || event.at > at) continue;
    for (const tag of event.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  let selectedTag: string | null = null;
  let selectedCount = 0;
  for (const tag of currentTags) {
    const countNow = counts.get(tag) ?? 0;
    const countBefore = Math.max(0, countNow - 1);
    if (countNow < 5 || countBefore >= 5) continue;

    const achievementKey = `TAG_5_LAST_7_DAYS:${tag}`;
    const unlocked = engagement.achievements[achievementKey];
    const cooldownElapsed =
      !unlocked || at - unlocked.unlockedAt >= TAG_WINDOW_DAYS * DAY_MS;
    if (!cooldownElapsed) continue;

    if (countNow > selectedCount) {
      selectedTag = tag;
      selectedCount = countNow;
      continue;
    }
    if (countNow === selectedCount && selectedTag && tag.localeCompare(selectedTag) < 0) {
      selectedTag = tag;
      selectedCount = countNow;
    }
  }

  if (!selectedTag) {
    return { engagement };
  }

  const achievementKey = `TAG_5_LAST_7_DAYS:${selectedTag}`;
  const nextEngagement: EngagementState = {
    ...engagement,
    achievements: {
      ...engagement.achievements,
      [achievementKey]: {
        id: achievementKey,
        unlockedAt: at,
        meta: {
          tag: selectedTag,
          count: selectedCount
        }
      }
    }
  };

  return {
    engagement: nextEngagement,
    toast: createToast(
      {
        id: achievementKey,
        message: `5 #${selectedTag} tasks completed this week.`,
        priority: 3,
        durationMs: ENGAGEMENT_TOAST_DURATIONS_MS.TAG_5_LAST_7_DAYS
      },
      at
    )
  };
}

export function evaluateMilestones(
  engagement: EngagementState,
  at: number
): MilestoneOutcome {
  let nextEngagement = engagement;
  const toasts: EngagementToast[] = [];
  const todayDayKey = computeDayKey(at);

  if (
    nextEngagement.completionLog.length === 1 &&
    !nextEngagement.achievements.FIRST_TASK_DONE
  ) {
    nextEngagement = {
      ...nextEngagement,
      achievements: {
        ...nextEngagement.achievements,
        FIRST_TASK_DONE: {
          id: "FIRST_TASK_DONE",
          unlockedAt: at
        }
      }
    };
    toasts.push(
      createToast(
        {
          id: "FIRST_TASK_DONE",
          message: "First task completed.",
          priority: 1,
          durationMs: ENGAGEMENT_TOAST_DURATIONS_MS.FIRST_TASK_DONE
        },
        at
      )
    );
  }

  if (
    nextEngagement.streak.currentDays === 3 &&
    !nextEngagement.achievements.STREAK_3_DAYS
  ) {
    nextEngagement = {
      ...nextEngagement,
      achievements: {
        ...nextEngagement.achievements,
        STREAK_3_DAYS: {
          id: "STREAK_3_DAYS",
          unlockedAt: at
        }
      }
    };
    toasts.push(
      createToast(
        {
          id: "STREAK_3_DAYS",
          message: "3-day streak completed tasks 3 days in a row.",
          priority: 2,
          durationMs: ENGAGEMENT_TOAST_DURATIONS_MS.STREAK_3_DAYS
        },
        at
      )
    );
  }

  const tagOutcome = evaluateTagMilestone(nextEngagement, at);
  nextEngagement = tagOutcome.engagement;
  if (tagOutcome.toast) {
    toasts.push(tagOutcome.toast);
  }

  const todayCount = nextEngagement.completionLog.reduce((count, event) => {
    return computeDayKey(event.at) === todayDayKey ? count + 1 : count;
  }, 0);
  const dailyAchievementKey = `DONE_3_TODAY:${todayDayKey}`;
  if (todayCount === 3 && !nextEngagement.achievements[dailyAchievementKey]) {
    nextEngagement = {
      ...nextEngagement,
      achievements: {
        ...nextEngagement.achievements,
        [dailyAchievementKey]: {
          id: "DONE_3_TODAY",
          unlockedAt: at,
          meta: {
            dayKey: todayDayKey
          }
        }
      }
    };
    toasts.push(
      createToast(
        {
          id: dailyAchievementKey,
          message: "3 tasks completed today.",
          priority: 4,
          durationMs: ENGAGEMENT_TOAST_DURATIONS_MS.DONE_3_TODAY
        },
        at
      )
    );
  }

  return {
    engagement: nextEngagement,
    toasts
  };
}

function dropLowestPriorityToast(queue: EngagementToast[]): EngagementToast[] {
  if (queue.length === 0) return queue;
  const lowestPriority = queue.reduce<number>(
    (current, toast) => Math.max(current, toast.priority),
    queue[0].priority
  );
  const dropIndex = queue.findIndex((toast) => toast.priority === lowestPriority);
  if (dropIndex < 0) return queue;
  return queue.filter((_, index) => index !== dropIndex);
}

export function enqueueToastsWithCap(
  queue: EngagementToast[],
  additions: EngagementToast[],
  maxQueued = ENGAGEMENT_TOAST_QUEUE_MAX
): EngagementToast[] {
  let nextQueue = [...queue, ...additions];
  while (nextQueue.length > maxQueued) {
    nextQueue = dropLowestPriorityToast(nextQueue);
  }
  return nextQueue;
}

export function suppressActiveToastWithCap(
  activeToast: EngagementToast,
  queue: EngagementToast[],
  maxQueued = ENGAGEMENT_TOAST_QUEUE_MAX
): EngagementToast[] {
  let nextQueue = [...queue];
  while (nextQueue.length >= maxQueued) {
    nextQueue = dropLowestPriorityToast(nextQueue);
  }
  return [{ ...activeToast }, ...nextQueue];
}

export function mergeEngagementStates(
  left: EngagementState,
  right: EngagementState,
  now = Date.now()
): EngagementState {
  const mergedLog = enforceCompletionRetention(
    normalizeCompletionLog([...left.completionLog, ...right.completionLog]),
    now
  );

  const achievements: Record<string, AchievementUnlock> = {};
  for (const [key, value] of Object.entries(left.achievements)) {
    achievements[key] = { ...value };
  }
  for (const [key, value] of Object.entries(right.achievements)) {
    const existing = achievements[key];
    if (!existing || value.unlockedAt >= existing.unlockedAt) {
      achievements[key] = { ...value };
    }
  }

  return {
    completionLog: mergedLog,
    achievements,
    streak: rebuildStreakFromCompletionLog(mergedLog)
  };
}
