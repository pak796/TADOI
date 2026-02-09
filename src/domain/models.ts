export type TaskStatus = "open" | "done" | "archived";

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
};

export type TagIndexEntry = {
  tagName: string;
  usageCount: number;
  lastUsedAt: number;
};

export type Filters = {
  status: "all" | "open" | "done" | "archived";
  due: "any" | "overdue" | "today" | "next7";
  tag?: string;
  searchText?: string;
};

export type EditorDraft = {
  id?: string;
  title: string;
  dueText: string;
  timeText: string;
  tagsText: string;
  notes: string;
};

export type EditorFocus = "title" | "due" | "time" | "tags" | "notes" | "save" | "cancel";

export type Mode = "list" | "add" | "edit" | "search" | "help" | "modal_confirm";

export type FocusTarget =
  | "task_list"
  | "search_input"
  | "modal"
  | "editor_title"
  | "editor_due_date"
  | "editor_due_time"
  | "editor_tags"
  | "editor_notes"
  | "editor_save"
  | "editor_cancel";

export type ConfirmModal =
  | {
      type: "delete";
      taskId: string;
      taskTitle: string;
      previousMode: Exclude<Mode, "modal_confirm">;
      previousFocus: FocusTarget;
    };

export type AppState = {
  tasks: Task[];
  tagIndex: Record<string, TagIndexEntry>;
  filters: Filters;
  selectedId?: string;
  mode: Mode;
  focus: FocusTarget;
  modal: ConfirmModal | null;
  editor: EditorDraft | null;
};
