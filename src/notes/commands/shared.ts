import type { CommandOutput, NoteSearchFilters } from "../../commands/types";
import type { NotesSettings } from "../../settings/settings";
import type { NotesService } from "../service";
import type { NoteGraphIndex, NoteListItem, NotePath } from "../types";

export const TEMPLATE_DIR = "Templates";

export type ParsedNoteSearchQuery = NoteSearchFilters;

export type ExecuteNoteCommandContext = {
  service: NotesService;
  dataFilePath: string;
  notesSettings: NotesSettings;
  selectedTaskId?: string;
  captureSource?: string;
  resolveTaskContext?: (
    taskId: string,
  ) =>
    | { primaryNotePath?: NotePath; inlineNotes?: string }
    | null
    | Promise<{ primaryNotePath?: NotePath; inlineNotes?: string } | null>;
  createBackup?: (dataFilePath: string) => Promise<unknown>;
  persistNotesSettings?: (next: NotesSettings) => Promise<void> | void;
};

export type NoteTaskSideEffects = {
  taskId: string;
  primaryNoteAction: "set" | "keep" | "none";
  primaryNotePath?: NotePath;
  clearInlineNotes?: boolean;
};

export type ExecuteNoteCommandResult = {
  output: CommandOutput;
  notePath?: NotePath;
  noteId?: string;
  path?: NotePath;
  title?: string;
  capturedAt?: string;
  notesRoot?: string;
  matches?: NotePath[];
  taskSideEffects?: NoteTaskSideEffects;
  data?: unknown;
};

export type OpenResolutionResult =
  | { ok: true; path: NotePath; matchKind: "id" | "path" | "title" | "fuzzy" }
  | { ok: false; text: string };

export function ok(
  text: string,
  extras: Omit<ExecuteNoteCommandResult, "output"> = {},
): ExecuteNoteCommandResult {
  return {
    output: {
      kind: "ok",
      text,
    },
    ...extras,
  };
}

export function error(text: string): ExecuteNoteCommandResult {
  return {
    output: {
      kind: "error",
      text,
    },
  };
}

export function indexNotesByPath(
  noteList: NoteListItem[],
): Map<NotePath, NoteListItem> {
  return new Map(noteList.map((note) => [note.path, note]));
}

export type SearchContext = {
  noteLookup: Map<NotePath, NoteListItem>;
  snapshot: NoteGraphIndex;
};
