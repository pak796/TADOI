import { noteTagMatchesFilter } from "../notes/tags";
import type { NotePath } from "../notes/types";
import { layout } from "./theme";

type NoteListItem = {
  path: NotePath;
  title: string;
  mtimeMs: number;
  tags: string[];
};

export type NotesPaneLayout = {
  notesPaneAvailableWidth: number;
  notesListPaneMinWidth: number;
  notesContextPaneMinWidth: number;
  notesEstimatedListPaneWidth: number;
  notesEstimatedContextPaneWidth: number;
  notesListTagPillMaxWidth: number;
  notesContextTagPillMaxWidth: number;
};

export function clampIndex(index: number, itemCount: number): number {
  if (itemCount <= 0) return 0;
  return Math.max(0, Math.min(index, itemCount - 1));
}

export function filterNotesList(
  notesList: NoteListItem[],
  notesSearchQuery: string,
  notesTagFilterQuery: string
): NoteListItem[] {
  const notesSearchTerm = notesSearchQuery.trim().toLowerCase();
  const notesTagFilterTerm = notesTagFilterQuery.trim();

  return notesList.filter((note) => {
    const matchesSearch =
      notesSearchTerm.length === 0 ||
      note.title.toLowerCase().includes(notesSearchTerm) ||
      note.path.toLowerCase().includes(notesSearchTerm);
    const matchesTag =
      notesTagFilterTerm.length === 0 ||
      note.tags.some((tag) => noteTagMatchesFilter(tag, notesTagFilterTerm));
    return matchesSearch && matchesTag;
  });
}

export function resolveActiveNoteTitle(params: {
  notesOpenPath: NotePath | null;
  notesList: NoteListItem[];
  selectedNotesListItem?: NoteListItem;
}): string {
  const activeTitle =
    (params.notesOpenPath
      ? params.notesList.find((note) => note.path === params.notesOpenPath)?.title
      : params.selectedNotesListItem?.title) ?? "TOME";
  return activeTitle;
}

export function resolveSelectedNoteTags(params: {
  notesOpenPath: NotePath | null;
  notesList: NoteListItem[];
  selectedNotesListItem?: NoteListItem;
}): string[] {
  return (
    params.notesList.find((note) => note.path === params.notesOpenPath)?.tags ??
    params.selectedNotesListItem?.tags ??
    []
  );
}

export function buildDetailsNotesSelectablePaths(
  selectedTaskLinkedNotePath: NotePath | undefined,
  selectedTaskLinkedNotes: NotePath[]
): NotePath[] {
  const next: NotePath[] = [];
  if (selectedTaskLinkedNotePath) {
    next.push(selectedTaskLinkedNotePath);
  }
  for (const notePath of selectedTaskLinkedNotes) {
    if (!next.includes(notePath)) {
      next.push(notePath);
    }
  }
  return next;
}

export function windowLines(
  lines: string[],
  windowSize: number,
  offset: number
): string[] {
  if (lines.length <= windowSize) {
    return lines;
  }
  const maxStart = Math.max(0, lines.length - windowSize);
  const start = Math.max(0, Math.min(offset, maxStart));
  return lines.slice(start, start + windowSize);
}

export function computeNotesPaneLayout(terminalWidth: number): NotesPaneLayout {
  const notesPaneAvailableWidth = Math.max(0, terminalWidth - layout.railWidth - 4);
  const notesListPaneMinWidth = Math.max(
    28,
    Math.min(36, Math.floor(notesPaneAvailableWidth * 0.4))
  );
  const notesContextPaneMinWidth = Math.max(
    34,
    Math.min(52, notesPaneAvailableWidth - notesListPaneMinWidth)
  );
  const notesEstimatedListPaneWidth = Math.max(
    notesListPaneMinWidth,
    Math.floor(notesPaneAvailableWidth * 0.4)
  );
  const notesEstimatedContextPaneWidth = Math.max(
    notesContextPaneMinWidth,
    notesPaneAvailableWidth - notesEstimatedListPaneWidth
  );

  return {
    notesPaneAvailableWidth,
    notesListPaneMinWidth,
    notesContextPaneMinWidth,
    notesEstimatedListPaneWidth,
    notesEstimatedContextPaneWidth,
    notesListTagPillMaxWidth: Math.max(10, notesEstimatedListPaneWidth - 6),
    notesContextTagPillMaxWidth: Math.max(12, notesEstimatedContextPaneWidth - 8)
  };
}
