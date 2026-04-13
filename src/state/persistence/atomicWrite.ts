import { randomUUID } from "node:crypto";
import path from "path";
import { loadStateStrict } from "./load";
import { resolveDataPath } from "./paths";
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_FS_OPS,
  type LoadedData,
  type PersistenceFsOps,
  type SaveStateAtomicOptions,
  type SaveStateDebouncedOptions,
  type SaveStateResultCallback,
  type StateRevisionConflictError,
  type WriteJsonAtomicOptions,
} from "./types";
import { StateRevisionConflictError as StateRevisionConflictErrorCtor } from "./types";

const PRIVATE_DIR_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSuccessfulSaveAt: number | undefined;
const atomicWriteQueueByPath = new Map<string, Promise<void>>();

function normalizeStateRevision(value: unknown): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  ) {
    return value;
  }
  return 0;
}

async function pathExists(
  filePath: string,
  fsOps: PersistenceFsOps,
): Promise<boolean> {
  try {
    await fsOps.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function nextAtomicTempFilePath(
  filePath: string,
  fsOps: PersistenceFsOps,
): Promise<string> {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const suffix = `${Date.now().toString(36)}-${process.pid}-${randomUUID().slice(0, 8)}-${attempt}`;
    const candidate = path.join(dir, `.${base}.tmp-${suffix}`);
    if (!(await pathExists(candidate, fsOps))) {
      return candidate;
    }
  }

  throw new Error(
    `Failed to allocate unique temporary file for atomic write: ${filePath}`,
  );
}

async function nextPidTempFilePath(
  filePath: string,
  fsOps: PersistenceFsOps,
): Promise<string> {
  const base = `${filePath}.tmp.${process.pid}`;
  if (!(await pathExists(base, fsOps))) {
    return base;
  }

  for (let attempt = 1; attempt < 64; attempt += 1) {
    const candidate = `${base}.${attempt}`;
    if (!(await pathExists(candidate, fsOps))) {
      return candidate;
    }
  }

  throw new Error(
    `Failed to allocate pid temp file for atomic save: ${filePath}`,
  );
}

function atomicWriteQueueKey(filePath: string): string {
  const resolved = path.resolve(filePath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

async function runWithAtomicWriteLock(
  filePath: string,
  task: () => Promise<void>,
): Promise<void> {
  const queueKey = atomicWriteQueueKey(filePath);
  const previous = atomicWriteQueueByPath.get(queueKey) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(task);
  atomicWriteQueueByPath.set(queueKey, current);
  try {
    await current;
  } finally {
    if (atomicWriteQueueByPath.get(queueKey) === current) {
      atomicWriteQueueByPath.delete(queueKey);
    }
  }
}

export async function writeJsonAtomic(
  payload: unknown,
  options: WriteJsonAtomicOptions = {},
): Promise<void> {
  const filePath = options.filePath ?? resolveDataPath();
  const fsOps = options.fsOps ?? DEFAULT_FS_OPS;
  const pretty = options.pretty !== false;
  const fsyncBeforeRename = options.fsyncBeforeRename === true;
  await runWithAtomicWriteLock(filePath, async () => {
    await fsOps.mkdir(path.dirname(filePath), {
      recursive: true,
      mode: PRIVATE_DIR_MODE,
    });
    const tmpFile = await nextAtomicTempFilePath(filePath, fsOps);
    const content = pretty
      ? JSON.stringify(payload, null, 2)
      : JSON.stringify(payload);
    await fsOps.writeFile(tmpFile, content, {
      encoding: "utf8",
      mode: PRIVATE_FILE_MODE,
    });
    if (fsyncBeforeRename) {
      const handle = await fsOps.open(tmpFile, "r");
      try {
        await handle.sync();
      } finally {
        await handle.close();
      }
    }
    await fsOps.rename(tmpFile, filePath);
  });
}

export async function saveStateAtomic(
  data: LoadedData,
  filePath = resolveDataPath(),
  fsOps: PersistenceFsOps = DEFAULT_FS_OPS,
  options: SaveStateAtomicOptions = {},
): Promise<number> {
  let nextStateRevision = 0;
  await runWithAtomicWriteLock(filePath, async () => {
    const currentState = await loadStateStrict({ filePath, fsOps });
    const actualRevision = normalizeStateRevision(
      currentState.data.stateRevision,
    );
    if (
      typeof options.expectedStateRevision === "number" &&
      options.expectedStateRevision !== actualRevision
    ) {
      throw new StateRevisionConflictErrorCtor(
        filePath,
        options.expectedStateRevision,
        actualRevision,
      );
    }
    nextStateRevision = actualRevision + 1;
    const dirPath = path.dirname(filePath);
    await fsOps.mkdir(dirPath, { recursive: true, mode: PRIVATE_DIR_MODE });
    const tmpFile = await nextPidTempFilePath(filePath, fsOps);
    const payload = {
      ...data,
      schemaVersion: data.schemaVersion ?? CURRENT_SCHEMA_VERSION,
      stateRevision: nextStateRevision,
    };
    const content = JSON.stringify(payload, null, 2);
    let renamed = false;

    try {
      await fsOps.writeFile(tmpFile, content, {
        encoding: "utf8",
        mode: PRIVATE_FILE_MODE,
      });
      const tmpHandle = await fsOps.open(tmpFile, "r");
      try {
        await tmpHandle.sync();
      } finally {
        await tmpHandle.close();
      }

      await fsOps.rename(tmpFile, filePath);
      renamed = true;

      if (process.platform !== "win32") {
        try {
          const dirHandle = await fsOps.open(dirPath, "r");
          try {
            await dirHandle.sync();
          } finally {
            await dirHandle.close();
          }
        } catch {
          // best-effort directory sync; file is already atomically replaced
        }
      }
    } catch (error: unknown) {
      if (!renamed) {
        try {
          await fsOps.unlink(tmpFile);
        } catch {
          // best-effort temp cleanup
        }
      }
      throw error;
    }
  });
  try {
    const reminders = await import("../../reminders/indexer");
    await reminders.writeReminderIndexForDataFile({
      dataFilePath: filePath,
      tasks: data.tasks,
      fsOps,
    });
  } catch {
    // Reminder index writes are best-effort; state persistence should still succeed.
  }
  return nextStateRevision;
}

async function writeState(
  data: LoadedData,
  filePath = resolveDataPath(),
  fsOps: PersistenceFsOps = DEFAULT_FS_OPS,
  options: SaveStateAtomicOptions = {},
): Promise<number> {
  return saveStateAtomic(
    { ...data, schemaVersion: data.schemaVersion ?? CURRENT_SCHEMA_VERSION },
    filePath,
    fsOps,
    options,
  );
}

export function saveStateDebounced(
  data: LoadedData,
  delay = 350,
  filePath = resolveDataPath(),
  fsOps: PersistenceFsOps = DEFAULT_FS_OPS,
  onResult?: SaveStateResultCallback,
  options: SaveStateDebouncedOptions = {},
): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    void (async () => {
      try {
        const stateRevision = await writeState(data, filePath, fsOps, {
          expectedStateRevision: options.expectedStateRevision,
        });
        const savedAt = Date.now();
        lastSuccessfulSaveAt = savedAt;
        onResult?.({
          ok: true,
          filePath,
          savedAt,
          lastSuccessfulSaveAt: savedAt,
          stateRevision,
        });
      } catch (error: unknown) {
        const normalizedError =
          error instanceof Error ? error : new Error(String(error));
        const conflictFields =
          error instanceof StateRevisionConflictErrorCtor
            ? {
                expectedStateRevision: error.expectedRevision,
                actualStateRevision: error.actualRevision,
                isRevisionConflict: true,
              }
            : {};
        onResult?.({
          ok: false,
          filePath,
          error: normalizedError,
          lastSuccessfulSaveAt,
          ...conflictFields,
        });
      } finally {
        saveTimer = null;
      }
    })();
  }, delay);
}
