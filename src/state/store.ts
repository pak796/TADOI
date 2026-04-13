import { filterTasks, sortTasks } from "../domain/query";
import {
  createDefaultEngagementState,
  enqueueToastsWithCap,
  enforceCompletionRetention,
  evaluateMilestones,
  normalizeEngagementState,
  suppressActiveToastWithCap,
  updateStreak,
} from "../domain/engagement";
import {
  combineLocalDateAndTime,
  diffLocalDays,
  formatLocalTimeHHmm,
  parseDateToLocalMidnight,
  parseTimeToMinutes,
  startOfLocalDayMs,
} from "../domain/dates";
import { formatTagForDisplay } from "../domain/tagIndex";
import { parseRRule } from "../domain/recurrence/rruleAdapter";
import {
  createDefaultReminderDraftFields,
  normalizeTaskReminder,
  reminderDraftFieldsFromTask,
} from "../domain/reminders";
import { canonicalizeDueAtInput } from "../lib/datetime/due_at_canonicalizer";
import {
  AppState,
  EditorDraft,
  EngagementToast,
  Filters,
  SavedView,
  SortMode,
  TagIndexEntry,
  Task,
} from "../domain/models";
import { normalizePriorityTags } from "../domain/priorityTags";
import { normalizeChecklist } from "../domain/checklist";
import { normalizeTagAliases } from "../domain/tagAliases";
import type { LoadedData } from "./persistence";

export type Action =
  | { type: "load"; data: LoadedData }
  | { type: "recordCompletion"; taskId: string; at: number; tags: string[] }
  | { type: "evaluateEngagement"; at: number }
  | {
      type: "triggerEngagementMilestone";
      achievementKey: string;
      achievementId: string;
      at: number;
      meta?: Record<string, string | number>;
      toast: {
        message: string;
        priority: 1 | 2 | 3 | 4;
        durationMs: number;
      };
    }
  | { type: "pushEngagementToast"; toast: EngagementToast }
  | { type: "tickEngagementToast"; now: number; overlayBlocked: boolean }
  | { type: "popEngagementToast" }
  | { type: "setSelected"; id?: string }
  | { type: "setFilters"; filters: Partial<Filters> }
  | { type: "setEditor"; editor: EditorDraft | null }
  | { type: "updateEditor"; patch: Partial<EditorDraft> }
  | { type: "setTasks"; tasks: Task[] }
  | { type: "setSavedViews"; savedViews: SavedView[] }
  | { type: "setSortMode"; sortMode: SortMode }
  | { type: "setTagIndex"; tagIndex: Record<string, TagIndexEntry> }
  | { type: "setTagAliases"; tagAliases: Record<string, string> };

export const initialState: AppState = {
  tasks: [],
  tagIndex: {},
  tagAliases: {},
  savedViews: [],
  engagement: createDefaultEngagementState(),
  engagementToastQueue: [],
  engagementToastActive: null,
  filters: {
    status: "all",
    due: "any",
    analyticsWindow: "7d",
  },
  sortMode: "due",
  selectedId: undefined,
  editor: null,
};

function normalizeTaskForRuntime(task: Task): Task {
  const reminder = normalizeTaskReminder(task.reminder);
  return {
    ...task,
    checklist: normalizeChecklist(task.checklist),
    reminder,
  };
}

export function applyArchiveAging(
  data: LoadedData,
  now: number,
): { data: LoadedData; changed: boolean } {
  const threshold = 7 * 24 * 60 * 60 * 1000;
  let changed = false;
  const tasks: Task[] = data.tasks.map((task): Task => {
    if (task.status !== "done") return task;
    const closedAt = task.closedAt ?? task.updatedAt;
    if (now - closedAt >= threshold) {
      changed = true;
      return { ...task, status: "archived" };
    }
    return task;
  });
  return changed ? { data: { ...data, tasks }, changed } : { data, changed };
}

export function archiveOldDoneTasks(tasks: Task[], now: number): Task[] {
  return applyArchiveAging(
    {
      schemaVersion: 8,
      stateRevision: 0,
      tasks,
      tagIndex: {},
      savedViews: [],
      engagement: createDefaultEngagementState(),
    },
    now,
  ).data.tasks;
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "load":
      return {
        ...state,
        tasks: action.data.tasks.map(normalizeTaskForRuntime),
        tagIndex: action.data.tagIndex,
        tagAliases: normalizeTagAliases(action.data.tagAliases),
        savedViews: action.data.savedViews,
        engagement: normalizeEngagementState(action.data.engagement),
        engagementToastQueue: [],
        engagementToastActive: null,
      };
    case "recordCompletion": {
      const nextLog = enforceCompletionRetention(
        [
          ...state.engagement.completionLog,
          {
            taskId: action.taskId,
            at: action.at,
            tags: Array.from(new Set(action.tags)).sort((left, right) =>
              left.localeCompare(right),
            ),
          },
        ],
        action.at,
      );
      return {
        ...state,
        engagement: {
          ...state.engagement,
          completionLog: nextLog,
          streak: updateStreak(state.engagement.streak, action.at),
        },
      };
    }
    case "evaluateEngagement": {
      const result = evaluateMilestones(state.engagement, action.at);
      const nextQueue =
        result.toasts.length > 0
          ? enqueueToastsWithCap(state.engagementToastQueue, result.toasts)
          : state.engagementToastQueue;
      return {
        ...state,
        engagement: result.engagement,
        engagementToastQueue: nextQueue,
      };
    }
    case "triggerEngagementMilestone": {
      if (state.engagement.achievements[action.achievementKey]) {
        return state;
      }
      const toast: EngagementToast = {
        id: action.achievementKey,
        message: action.toast.message,
        priority: action.toast.priority,
        createdAt: action.at,
        durationMs: action.toast.durationMs,
      };
      return {
        ...state,
        engagement: {
          ...state.engagement,
          achievements: {
            ...state.engagement.achievements,
            [action.achievementKey]: {
              id: action.achievementId,
              unlockedAt: action.at,
              ...(action.meta ? { meta: action.meta } : {}),
            },
          },
        },
        engagementToastQueue: enqueueToastsWithCap(state.engagementToastQueue, [
          toast,
        ]),
      };
    }
    case "pushEngagementToast":
      return {
        ...state,
        engagementToastQueue: enqueueToastsWithCap(state.engagementToastQueue, [
          action.toast,
        ]),
      };
    case "tickEngagementToast": {
      let active = state.engagementToastActive;
      let queue = state.engagementToastQueue;
      let changed = false;

      if (action.overlayBlocked && active) {
        queue = suppressActiveToastWithCap(active, queue);
        active = null;
        changed = true;
      }

      if (active && action.now - active.createdAt >= active.durationMs) {
        active = null;
        changed = true;
      }

      if (!active && !action.overlayBlocked && queue.length > 0) {
        const [next, ...rest] = queue;
        active = {
          ...next,
          createdAt: action.now,
        };
        queue = rest;
        changed = true;
      }

      if (!changed) return state;
      return {
        ...state,
        engagementToastQueue: queue,
        engagementToastActive: active,
      };
    }
    case "popEngagementToast":
      if (!state.engagementToastActive) return state;
      return {
        ...state,
        engagementToastActive: null,
      };
    case "setSelected":
      return { ...state, selectedId: action.id };
    case "setFilters":
      return { ...state, filters: { ...state.filters, ...action.filters } };
    case "setEditor":
      return {
        ...state,
        editor: action.editor,
      };
    case "updateEditor":
      return state.editor
        ? { ...state, editor: { ...state.editor, ...action.patch } }
        : state;
    case "setTasks":
      return { ...state, tasks: action.tasks.map(normalizeTaskForRuntime) };
    case "setSavedViews":
      return { ...state, savedViews: action.savedViews };
    case "setSortMode":
      return { ...state, sortMode: action.sortMode };
    case "setTagIndex":
      return { ...state, tagIndex: action.tagIndex };
    case "setTagAliases":
      return { ...state, tagAliases: normalizeTagAliases(action.tagAliases) };
    default:
      return state;
  }
}

export function getVisibleTasks(state: AppState, now: number): Task[] {
  const filtered = filterTasks(
    state.tasks,
    state.filters,
    now,
    state.tagAliases,
  );
  return sortTasks(filtered, now, state.sortMode);
}

export function createEmptyDraft(): EditorDraft {
  return {
    title: "",
    dueText: "",
    timeText: "",
    ...createDefaultReminderDraftFields(),
    tagsText: "",
    notes: "",
    links: [],
    checklist: [],
    repeatMode: "off",
    repeatIntervalText: "1",
    repeatWeekdays: [],
    repeatMonthdayText: "",
    repeatEndMode: "never",
    repeatUntilText: "",
    repeatCountText: "",
    repeatCustomRRuleText: "",
    assigneeText: "",
    projectText: "",
    workflowStage: "todo",
  };
}

export function createDraftFromTask(task: Task): EditorDraft {
  const parsedRule = task.recurrence ? parseRRule(task.recurrence.rrule) : null;
  const repeatMode = task.recurrence
    ? parsedRule?.freq === "DAILY"
      ? "daily"
      : parsedRule?.freq === "WEEKLY"
        ? "weekly"
        : parsedRule?.freq === "MONTHLY"
          ? "monthly"
          : "custom"
    : "off";
  const repeatEndMode = parsedRule?.count
    ? "count"
    : parsedRule?.untilIso
      ? "until"
      : "never";
  const reminderDraft = reminderDraftFieldsFromTask(task);
  return {
    id: task.id,
    title: task.title,
    dueText: task.dueAt ? formatDate(task.dueAt) : "",
    timeText:
      task.hasExplicitTime && task.dueAt ? formatLocalTimeHHmm(task.dueAt) : "",
    ...reminderDraft,
    tagsText: normalizePriorityTags(task.tags)
      .map((tag) => formatTagForDisplay(tag))
      .join(" "),
    notes: task.notes ?? "",
    links: (task.links ?? []).map((link) => ({ ...link })),
    checklist: normalizeChecklist(task.checklist),
    repeatMode,
    repeatIntervalText: String(parsedRule?.interval ?? 1),
    repeatWeekdays: parsedRule?.byday ?? [],
    repeatMonthdayText: String(
      parsedRule?.bymonthday?.[0] ??
        (task.dueAt ? new Date(task.dueAt).getDate() : ""),
    ),
    repeatEndMode,
    repeatUntilText: parsedRule?.untilIso?.slice(0, 10) ?? "",
    repeatCountText: parsedRule?.count ? String(parsedRule.count) : "",
    repeatCustomRRuleText: task.recurrence?.rrule ?? "",
    assigneeText: task.assignee ?? "",
    projectText: task.project ?? "",
    workflowStage: task.workflowStage,
    editKind: "regular",
  };
}

export function formatDate(epochMs: number): string {
  const date = new Date(epochMs);
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getDueLabel(task: Task, now: number): string {
  if (!task.dueAt) {
    return "NO DUE DATE";
  }
  const startMs = startOfLocalDayMs(now);
  const dayDiff = diffLocalDays(task.dueAt, startMs);

  if (dayDiff === 0 && task.hasExplicitTime) {
    return getDueTimeLabel(task, now);
  }

  if (dayDiff < 0) {
    const daysOverdue = Math.max(1, Math.abs(dayDiff));
    return `${daysOverdue} DAY${daysOverdue === 1 ? "" : "S"} OVERDUE`;
  }

  if (dayDiff === 0) {
    return "DUE TODAY";
  }

  return `DUE ${formatDate(task.dueAt)}`;
}

export function getDueInLabel(task: Task, now: number): string {
  if (!task.dueAt) {
    return "NO DUE DATE";
  }
  const startMs = startOfLocalDayMs(now);
  const dayDiff = diffLocalDays(task.dueAt, startMs);

  if (dayDiff === 0 && task.hasExplicitTime) {
    return getDueTimeLabel(task, now);
  }

  if (dayDiff < 0) {
    const daysOverdue = Math.max(1, Math.abs(dayDiff));
    return `${daysOverdue} DAY${daysOverdue === 1 ? "" : "S"} OVERDUE`;
  }

  if (dayDiff === 0) {
    return "DUE TODAY";
  }
  return `DUE IN ${dayDiff} DAYS`;
}

export function parseDueDate(input: string): number | undefined {
  const date = parseDateToLocalMidnight(input);
  return date ? date.getTime() : undefined;
}

export function parseDueTime(input: string): number | undefined {
  return parseTimeToMinutes(input);
}

type CombineDueDateTimeOptions = {
  now: number;
  tz?: string;
};

export function combineDueDateTime(
  dateText: string,
  timeText: string,
  options?: CombineDueDateTimeOptions,
): { dueAt?: number; hasExplicitTime: boolean } {
  if (options) {
    const normalizedDate = dateText.trim();
    const canonicalized = canonicalizeDueAtInput(
      normalizedDate,
      timeText.trim() || undefined,
      {
        now: options.now,
        tz: options.tz,
      },
    );

    if (canonicalized.ok) {
      const date = parseDateToLocalMidnight(canonicalized.dueDate);
      if (!date) return { dueAt: undefined, hasExplicitTime: false };
      if (canonicalized.atTime) {
        const combined = combineLocalDateAndTime(date, canonicalized.atTime);
        return {
          dueAt: combined ? combined.getTime() : date.getTime(),
          hasExplicitTime: true,
        };
      }
      return { dueAt: date.getTime(), hasExplicitTime: false };
    }
  }

  const date = parseDateToLocalMidnight(dateText);
  if (!date) {
    return { dueAt: undefined, hasExplicitTime: false };
  }

  const minutes = parseTimeToMinutes(timeText);
  if (minutes === undefined) {
    return { dueAt: date.getTime(), hasExplicitTime: false };
  }
  const combined = combineLocalDateAndTime(date, timeText);
  return {
    dueAt: combined ? combined.getTime() : date.getTime(),
    hasExplicitTime: true,
  };
}

function getDueTimeLabel(task: Task, now: number): string {
  if (!task.dueAt) return "NO DUE DATE";
  const diffMs = task.dueAt - now;
  const diffMinutes = Math.abs(Math.ceil(diffMs / 60000));
  if (diffMinutes < 60) {
    return diffMs >= 0
      ? `DUE IN ${diffMinutes} MIN`
      : `OVERDUE BY ${diffMinutes} MIN`;
  }
  const hours = Math.max(1, Math.ceil(diffMinutes / 60));
  const hourLabel = hours === 1 ? "HOUR" : "HOURS";
  return diffMs >= 0
    ? `DUE IN ${hours} ${hourLabel}`
    : `OVERDUE BY ${hours} ${hourLabel}`;
}
