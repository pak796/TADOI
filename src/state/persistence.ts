import { promises as fs } from "fs";
import path from "path";
import { TagIndexEntry, Task } from "../domain/models";

export type LoadedData = {
  schemaVersion: number;
  tasks: Task[];
  tagIndex: Record<string, TagIndexEntry>;
};

const DATA_FILE = path.join(process.cwd(), "todui_data.json");
export const CURRENT_SCHEMA_VERSION = 2;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export async function loadState(): Promise<LoadedData> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as LoadedData;
    return {
      schemaVersion:
        typeof (parsed as LoadedData).schemaVersion === "number"
          ? (parsed as LoadedData).schemaVersion
          : 1,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      tagIndex: parsed.tagIndex ?? {}
    };
  } catch (error: unknown) {
    return { schemaVersion: CURRENT_SCHEMA_VERSION, tasks: [], tagIndex: {} };
  }
}

async function writeState(data: LoadedData): Promise<void> {
  const tmpFile = `${DATA_FILE}.tmp`;
  const payload = JSON.stringify(
    { ...data, schemaVersion: data.schemaVersion ?? CURRENT_SCHEMA_VERSION },
    null,
    2
  );
  await fs.writeFile(tmpFile, payload, "utf8");
  await fs.rename(tmpFile, DATA_FILE);
}

export function saveStateDebounced(data: LoadedData, delay = 350): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    void writeState(data);
    saveTimer = null;
  }, delay);
}

export function getDataFilePath(): string {
  return DATA_FILE;
}
