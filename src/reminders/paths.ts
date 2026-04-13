import path from "path";

const REMINDER_DIR_NAME = ".tadoi";
const REMINDER_INDEX_FILE_NAME = "reminders.index.json";
const REMINDER_STATE_FILE_NAME = "reminders.state.json";

export function getReminderSupportDir(dataFilePath: string): string {
  return path.join(path.dirname(dataFilePath), REMINDER_DIR_NAME);
}

export function getReminderIndexPath(dataFilePath: string): string {
  return path.join(
    getReminderSupportDir(dataFilePath),
    REMINDER_INDEX_FILE_NAME,
  );
}

export function getReminderStatePath(dataFilePath: string): string {
  return path.join(
    getReminderSupportDir(dataFilePath),
    REMINDER_STATE_FILE_NAME,
  );
}
