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
import {
  AppState,
  ConfirmModal,
  EditorDraft,
  FocusTarget,
  Filters,
  Mode,
  TagIndexEntry,
  Task
} from "../domain/models";
import type { LoadedData } from "./persistence";

export type Action =
  | { type: "load"; data: LoadedData }
  | { type: "setSelected"; id?: string }
  | { type: "setMode"; mode: Mode }
  | { type: "setFocus"; focus: FocusTarget }
  | { type: "setModal"; modal: ConfirmModal | null }
  | { type: "setFilters"; filters: Partial<Filters> }
  | { type: "setEditor"; editor: EditorDraft | null; focus?: FocusTarget }
  | { type: "updateEditor"; patch: Partial<EditorDraft> }
  | { type: "setTasks"; tasks: Task[] }
  | { type: "setTagIndex"; tagIndex: Record<string, TagIndexEntry> };

export const initialState: AppState = {
  tasks: [],
  tagIndex: {},
  filters: {
    status: "all",
    due: "any"
  },
  selectedId: undefined,
  mode: "list",
  focus: "task_list",
  modal: null,
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
  return applyArchiveAging({ schemaVersion: 1, tasks, tagIndex: {} }, now).data.tasks;
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "load":
      return {
        ...state,
        tasks: action.data.tasks,
        tagIndex: action.data.tagIndex
      };
    case "setSelected":
      return { ...state, selectedId: action.id };
    case "setMode":
      return { ...state, mode: action.mode };
    case "setFocus":
      return { ...state, focus: action.focus };
    case "setModal":
      return { ...state, modal: action.modal };
    case "setFilters":
      return { ...state, filters: { ...state.filters, ...action.filters } };
    case "setEditor":
      return {
        ...state,
        editor: action.editor,
        focus: action.focus ?? state.focus
      };
    case "updateEditor":
      return state.editor
        ? { ...state, editor: { ...state.editor, ...action.patch } }
        : state;
    case "setTasks":
      return { ...state, tasks: action.tasks };
    case "setTagIndex":
      return { ...state, tagIndex: action.tagIndex };
    default:
      return state;
  }
}

export function getVisibleTasks(state: AppState, now: number): Task[] {
  const filtered = filterTasks(state.tasks, state.filters, now);
  return sortTasks(filtered, now);
}

export function createEmptyDraft(): EditorDraft {
  return {
    title: "",
    dueText: "",
    timeText: "",
    tagsText: "",
    notes: ""
  };
}

export function createDraftFromTask(task: Task): EditorDraft {
  return {
    id: task.id,
    title: task.title,
    dueText: task.dueAt ? formatDate(task.dueAt) : "",
    timeText: task.hasExplicitTime && task.dueAt ? formatLocalTimeHHmm(task.dueAt) : "",
    tagsText: task.tags.map((tag) => formatTagForDisplay(tag)).join(" "),
    notes: task.notes ?? ""
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
