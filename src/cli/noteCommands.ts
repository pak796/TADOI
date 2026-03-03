import type { NoteCommand } from "../commands/types";
import {
  executeNoteCommand,
  type ExecuteNoteCommandResult
} from "../notes/commands";
import { createNotesService } from "../notes/service";
import { loadSettings, saveSettingsStrict } from "../settings/settings";
import { createDataBackup } from "../state/persistence";

export async function runNoteCommandCli(
  command: NoteCommand,
  dataFilePath: string
): Promise<ExecuteNoteCommandResult> {
  const settingsResult = await loadSettings();
  const settings = settingsResult.settings;
  const notesSettings = settings.notes ?? { enabled: true, rootPath: null };

  const service = createNotesService({
    dataFilePath,
    rootPath: notesSettings.rootPath,
    enabled: notesSettings.enabled
  });
  await service.initialize();

  const result = await executeNoteCommand(command, {
    service,
    dataFilePath,
    notesSettings,
    captureSource: "cli",
    createBackup: createDataBackup,
    persistNotesSettings: async (nextNotes) => {
      await saveSettingsStrict(
        {
          ...settings,
          notes: nextNotes
        },
        { filePath: settingsResult.resolvedPath }
      );
    }
  });

  return result;
}
