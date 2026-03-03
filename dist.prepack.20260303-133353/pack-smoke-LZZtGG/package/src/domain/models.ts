import type { UIConfirmModal } from "../ui/state";
export { FocusTarget, Mode } from "../ui/modeFocus";

export type TaskStatus = "open" | "done" | "archived";
export type WorkflowStage =
  | "backlog"
  | "todo"
  | "in_progress"
  | "blocked"
  | "review"
  | "done";

export type TaskLinkKind = "url" | "path";
export type TaskLinkSource = "manual" | "calendar_import";

export type TaskLink = {
  id: string;
  target: string;
  label?: string;
  kind?: TaskLinkKind;
  source?: TaskLinkSource;
};

export type RecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export type RecurrenceWeekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type RecurrenceRule = {
  freq: "daily" | "weekly" | "monthly";
  interval: number;
  byDay?: RecurrenceWeekday[];
  byMonthDay?: number[];
  anchorLocal?: {
    hour: number;
    minute: number;
  };
};

export type TaskRecurrence = {
  dtstart: string; // local floating ISO: YYYY-MM-DDTHH:mm:ss
  rrule: string; // RRULE fragment, e.g. FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE
  exdates?: string[]; // local floating ISO timestamps
  series_id: string;
} & Partial<RecurrenceRule>;

export type TaskInstanceOf = {
  series_id: string;
  occurrence: string; // original scheduled local floating ISO timestamp
};

export type TaskExternalCalendarMetadata = {
  uid: string;
  source?: string;
  tzid?: string;
  lastImportedAt: string;
  lastImportedHash?: string;
  recurrenceId?: string;
  seriesUid?: string;
};

export type TaskExternalMetadata = {
  calendar?: TaskExternalCalendarMetadata;
};

export type ChecklistItem = {
  id: string;
  text: string;
  isDone: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  sort: number;
};

export type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
  dueAt?: number; // epoch ms at local midnight or explicit local time
  hasExplicitTime?: boolean;
  closedAt?: number;
  notes?: string;
  tags: string[];
  links?: TaskLink[];
  recurrence?: TaskRecurrence;
  instance_of?: TaskInstanceOf;
  external?: TaskExternalMetadata;
  checklist?: ChecklistItem[];
  assignee?: string;
  project?: string;
  workflowStage?: WorkflowStage;
};

export type CompletionEvent = {
  taskId: string;
  at: number;
  tags: string[];
};

export type AchievementUnlock = {
  id: string;
  unlockedAt: number;
  meta?: Record<string, string | number>;
};

export type EngagementState = {
  completionLog: CompletionEvent[];
  achievements: Record<string, AchievementUnlock>;
  streak: {
    currentDays: number;
    bestDays: number;
    lastCompletionDayKey: string | null;
  };
};

export type EngagementToast = {
  id: string;
  message: string;
  priority: 1 | 2 | 3 | 4;
  createdAt: number;
  durationMs: number;
};

export type TagIndexEntry = {
  tagName: string;
  usageCount: number;
  lastUsedAt: number;
};

export type TagFilter = {
  all?: string[];
  any?: string[];
  none?: string[];
};

export type Filters = {
  status: "all" | "open" | "done" | "archived";
  due: "any" | "overdue" | "today" | "next7";
  analyticsWindow?: "7d" | "14d" | "30d";
  dueDayOffset?: 1 | 2 | 3 | 4 | 5 | 6;
  priority?: string;
  tag?: string;
  tagFilter?: TagFilter;
  searchText?: string;
  assignee?: string;
  project?: string;
  workflowStage?: Task["workflowStage"];
};

export type SortMode = "due" | "updated" | "created" | "title";

export type SavedView = {
  id: string;
  name: string;
  filters: Filters;
  createdAt: number;
  updatedAt: number;
};

export type EditorDraft = {
  id?: string;
  title: string;
  dueText: string;
  timeText: string;
  tagsText: string;
  notes: string;
  links: TaskLink[];
  checklist: ChecklistItem[];
  repeatMode: "off" | "daily" | "weekly" | "monthly" | "custom";
  repeatIntervalText: string;
  repeatWeekdays: string[]; // MO,TU,WE,TH,FR,SA,SU
  repeatMonthdayText: string;
  repeatEndMode: "never" | "until" | "count";
  repeatUntilText: string;
  repeatCountText: string;
  repeatCustomRRuleText: string;
  assigneeText: string;
  projectText: string;
  workflowStage: Task["workflowStage"];
  editKind?: "regular" | "occurrence" | "series";
  sourceTaskId?: string;
  sourceSeriesId?: string;
  occurrenceIso?: string;
};

export type EditorFocus =
  | "title"
  | "due"
  | "time"
  | "repeat_mode"
  | "repeat_interval"
  | "repeat_weekdays"
  | "repeat_monthday"
  | "repeat_end_mode"
  | "repeat_until"
  | "repeat_count"
  | "repeat_custom"
  | "tags"
  | "checklist"
  | "notes"
  | "save"
  | "cancel";

export type ConfirmModal = UIConfirmModal;

export type AppState = {
  tasks: Task[];
  tagIndex: Record<string, TagIndexEntry>;
  savedViews: SavedView[];
  engagement: EngagementState;
  engagementToastQueue: EngagementToast[];
  engagementToastActive: EngagementToast | null;
  filters: Filters;
  sortMode: SortMode;
  selectedId?: string;
  editor: EditorDraft | null;
};
