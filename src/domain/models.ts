import type { UIConfirmModal } from "../ui/state";
export { FocusTarget, Mode } from "../ui/modeFocus";

export type TaskStatus = "open" | "done" | "archived";

export type TaskLinkKind = "url" | "path";

export type TaskLink = {
  id: string;
  target: string;
  label?: string;
  kind?: TaskLinkKind;
};

export type RecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export type TaskRecurrence = {
  dtstart: string; // local floating ISO: YYYY-MM-DDTHH:mm:ss
  rrule: string; // RRULE fragment, e.g. FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE
  exdates?: string[]; // local floating ISO timestamps
  series_id: string;
};

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
  tag?: string;
  tagFilter?: TagFilter;
  searchText?: string;
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
  repeatMode: "off" | "daily" | "weekly" | "monthly" | "custom";
  repeatIntervalText: string;
  repeatWeekdays: string[]; // MO,TU,WE,TH,FR,SA,SU
  repeatMonthdayText: string;
  repeatEndMode: "never" | "until" | "count";
  repeatUntilText: string;
  repeatCountText: string;
  repeatCustomRRuleText: string;
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
  | "notes"
  | "save"
  | "cancel";

export type ConfirmModal = UIConfirmModal;

export type AppState = {
  tasks: Task[];
  tagIndex: Record<string, TagIndexEntry>;
  savedViews: SavedView[];
  filters: Filters;
  sortMode: SortMode;
  selectedId?: string;
  editor: EditorDraft | null;
};
