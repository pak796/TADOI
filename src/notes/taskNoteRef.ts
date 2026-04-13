import type { Task, TaskNoteRef } from "../domain/models";
import type { Note, NoteGraphIndex, NotePath } from "./types";

export type TaskNoteRefResolution =
  | {
      status: "resolved";
      notePath: NotePath;
      note: Note;
    }
  | {
      status: "missing";
      message: string;
    }
  | {
      status: "ambiguous";
      message: string;
      candidates: NotePath[];
    };

function sortedCandidates(paths: Iterable<NotePath>): NotePath[] {
  return Array.from(paths).sort((left, right) => left.localeCompare(right));
}

export function resolveTaskNoteRef(
  noteRef: Task["noteRef"] | undefined,
  snapshot: NoteGraphIndex,
): TaskNoteRefResolution {
  if (!noteRef) {
    return {
      status: "missing",
      message: "No note linked",
    };
  }

  if (noteRef.type === "id") {
    const notePath = snapshot.notesById.get(noteRef.value);
    if (!notePath) {
      return {
        status: "missing",
        message: `Linked note id not found: ${noteRef.value}`,
      };
    }
    const note = snapshot.notesByPath.get(notePath);
    if (!note) {
      return {
        status: "missing",
        message: `Linked note path not found: ${notePath}`,
      };
    }
    return {
      status: "resolved",
      notePath,
      note,
    };
  }

  const filename = noteRef.value.trim();
  if (!filename) {
    return {
      status: "missing",
      message: "Linked note filename is empty",
    };
  }

  const candidates = sortedCandidates(
    Array.from(snapshot.notesByPath.entries())
      .filter(([, note]) => note.filename === filename)
      .map(([pathValue]) => pathValue),
  );

  if (candidates.length === 0) {
    return {
      status: "missing",
      message: `Linked note filename not found: ${filename}`,
    };
  }
  if (candidates.length > 1) {
    return {
      status: "ambiguous",
      message: `Linked note filename is ambiguous: ${filename}`,
      candidates,
    };
  }

  const notePath = candidates[0];
  const note = snapshot.notesByPath.get(notePath);
  if (!note) {
    return {
      status: "missing",
      message: `Linked note path not found: ${notePath}`,
    };
  }
  return {
    status: "resolved",
    notePath,
    note,
  };
}

export function createTaskNoteRefFromNote(
  note: Pick<Note, "id" | "filename">,
): TaskNoteRef {
  if (note.id) {
    return {
      type: "id",
      value: note.id,
    };
  }
  return {
    type: "filename",
    value: note.filename,
  };
}
