import type { UIConfirmModal } from "../ui/state";
export { FocusTarget, Mode } from "../ui/modeFocus";

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

export type ConfirmModal = UIConfirmModal;

export type AppState = {
  tasks: Task[];
  tagIndex: Record<string, TagIndexEntry>;
  filters: Filters;
  selectedId?: string;
  editor: EditorDraft | null;
};
