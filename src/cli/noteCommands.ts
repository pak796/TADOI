import type { NoteCommand } from "../commands/types";
import type { Task } from "../domain/models";
import {
  executeNoteCommand,
  type ExecuteNoteCommandResult,
} from "../notes/commands";
import { createNotesService } from "../notes/service";
import { resolveTaskNoteRef } from "../notes/taskNoteRef";
import { loadSettings, saveSettingsStrict } from "../settings/settings";
import { createDataBackup } from "../state/persistence";

export type RunNoteCommandCliOptions = {
  tasks?: Task[];
  selectedTaskId?: string;
};

export async function runNoteCommandCli(
  command: NoteCommand,
  dataFilePath: string,
  options: RunNoteCommandCliOptions = {},
): Promise<ExecuteNoteCommandResult> {
  const settingsResult = await loadSettings();
  const settings = settingsResult.settings;
  const notesSettings = settings.notes ?? { enabled: true, rootPath: null };
  const tasksById = new Map(
    (options.tasks ?? []).map((task) => [task.id, task]),
  );

  const service = createNotesService({
    dataFilePath,
    rootPath: notesSettings.rootPath,
    enabled: notesSettings.enabled,
  });
  await service.initialize();

  const result = await executeNoteCommand(command, {
    service,
    dataFilePath,
    notesSettings,
    selectedTaskId: options.selectedTaskId,
    captureSource: "cli",
    resolveTaskContext: (taskId: string) => {
      const task = tasksById.get(taskId);
      if (!task) {
        return null;
      }
      const snapshot = service.getIndexSnapshot();
      const resolvedNoteRef = resolveTaskNoteRef(task.noteRef, snapshot);
      const primaryNotePath =
        resolvedNoteRef.status === "resolved"
          ? resolvedNoteRef.notePath
          : undefined;
      const inlineNotes = task.notes?.trim();
      return {
        ...(primaryNotePath ? { primaryNotePath } : {}),
        ...(inlineNotes ? { inlineNotes } : {}),
      };
    },
    createBackup: createDataBackup,
    persistNotesSettings: async (nextNotes) => {
      await saveSettingsStrict(
        {
          ...settings,
          notes: nextNotes,
        },
        { filePath: settingsResult.resolvedPath },
      );
    },
  });

  return result;
}
