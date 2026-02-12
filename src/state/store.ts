import { filterTasks, sortTasks } from "../domain/query";
import {
  combineLocalDateAndTime,
  diffLocalDays,
  formatLocalTimeHHmm,
  parseDateToLocalMidnight,
  parseTimeToMinutes,
  startOfLocalDayMs
} from "../domain/dates";
import { formatTagForDisplay } from "../domain/tagIndex";
import { parseRRule } from "../domain/recurrence/rruleAdapter";
import {
  AppState,
  EditorDraft,
  Filters,
  SavedView,
  SortMode,
  TagIndexEntry,
  Task
} from "../domain/models";
import { normalizePriorityTags } from "../domain/priorityTags";
import type { LoadedData } from "./persistence";

export type Action =
  | { type: "load"; data: LoadedData }
  | { type: "setSelected"; id?: string }
  | { type: "setFilters"; filters: Partial<Filters> }
  | { type: "setEditor"; editor: EditorDraft | null }
  | { type: "updateEditor"; patch: Partial<EditorDraft> }
  | { type: "setTasks"; tasks: Task[] }
  | { type: "setSavedViews"; savedViews: SavedView[] }
  | { type: "setSortMode"; sortMode: SortMode }
  | { type: "setTagIndex"; tagIndex: Record<string, TagIndexEntry> };

export const initialState: AppState = {
  tasks: [],
  tagIndex: {},
  savedViews: [],
  filters: {
    status: "all",
    due: "any"
  },
  sortMode: "due",
  selectedId: undefined,
  editor: null,
};

export function applyArchiveAging(
  data: LoadedData,
  now: number
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
    { schemaVersion: 4, tasks, tagIndex: {}, savedViews: [] },
    now
  ).data.tasks;
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "load":
      return {
        ...state,
        tasks: action.data.tasks,
        tagIndex: action.data.tagIndex,
        savedViews: action.data.savedViews
      };
    case "setSelected":
      return { ...state, selectedId: action.id };
    case "setFilters":
      return { ...state, filters: { ...state.filters, ...action.filters } };
    case "setEditor":
      return {
        ...state,
        editor: action.editor
      };
    case "updateEditor":
      return state.editor
        ? { ...state, editor: { ...state.editor, ...action.patch } }
        : state;
    case "setTasks":
      return { ...state, tasks: action.tasks };
    case "setSavedViews":
      return { ...state, savedViews: action.savedViews };
    case "setSortMode":
      return { ...state, sortMode: action.sortMode };
    case "setTagIndex":
      return { ...state, tagIndex: action.tagIndex };
    default:
      return state;
  }
}

export function getVisibleTasks(state: AppState, now: number): Task[] {
  const filtered = filterTasks(state.tasks, state.filters, now);
  return sortTasks(filtered, now, state.sortMode);
}

export function createEmptyDraft(): EditorDraft {
  return {
    title: "",
    dueText: "",
    timeText: "",
    tagsText: "",
    notes: "",
    links: [],
    repeatMode: "off",
    repeatIntervalText: "1",
    repeatWeekdays: [],
    repeatMonthdayText: "",
    repeatEndMode: "never",
    repeatUntilText: "",
    repeatCountText: "",
    repeatCustomRRuleText: ""
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
  return {
    id: task.id,
    title: task.title,
    dueText: task.dueAt ? formatDate(task.dueAt) : "",
    timeText: task.hasExplicitTime && task.dueAt ? formatLocalTimeHHmm(task.dueAt) : "",
    tagsText: normalizePriorityTags(task.tags)
      .map((tag) => formatTagForDisplay(tag))
      .join(" "),
    notes: task.notes ?? "",
    links: (task.links ?? []).map((link) => ({ ...link })),
    repeatMode,
    repeatIntervalText: String(parsedRule?.interval ?? 1),
    repeatWeekdays: parsedRule?.byday ?? [],
    repeatMonthdayText: String(
      parsedRule?.bymonthday?.[0] ??
        (task.dueAt ? new Date(task.dueAt).getDate() : "")
    ),
    repeatEndMode,
    repeatUntilText: parsedRule?.untilIso?.slice(0, 10) ?? "",
    repeatCountText: parsedRule?.count ? String(parsedRule.count) : "",
    repeatCustomRRuleText: task.recurrence?.rrule ?? "",
    editKind: "regular"
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

export function combineDueDateTime(
  dateText: string,
  timeText: string
): { dueAt?: number; hasExplicitTime: boolean } {
  const date = parseDateToLocalMidnight(dateText);
  if (!date) return { dueAt: undefined, hasExplicitTime: false };
  const minutes = parseTimeToMinutes(timeText);
  if (minutes === undefined) {
    return { dueAt: date.getTime(), hasExplicitTime: false };
  }
  const combined = combineLocalDateAndTime(date, timeText);
  return { dueAt: combined ? combined.getTime() : date.getTime(), hasExplicitTime: true };
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
