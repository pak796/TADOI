import os from "os";
import { promises as fs } from "fs";
import path from "path";
import { SavedView, TagIndexEntry, Task } from "../domain/models";
import { migratePersistedStateToCurrent } from "./migrations";
import { validatePersistedState } from "./validation";

export type LoadedData = {
  schemaVersion: number;
  tasks: Task[];
  tagIndex: Record<string, TagIndexEntry>;
  savedViews: SavedView[];
};

export type ResolveDataPathOptions = {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  homeDir?: string;
};

type PathApi = typeof path.posix | typeof path.win32;

export type PersistenceFsOps = Pick<
  typeof fs,
  | "access"
  | "copyFile"
  | "mkdir"
  | "readFile"
  | "readdir"
  | "rename"
  | "stat"
  | "writeFile"
>;

export type SafeLoadOptions = {
  filePath?: string;
  now?: Date;
  fsOps?: PersistenceFsOps;
};

export type SafeLoadResult = {
  data: LoadedData;
  resolvedPath: string;
  bannerMessage?: string;
  corruptBackupPath?: string;
  shouldPersistRecoveredState: boolean;
  didMigrate: boolean;
};

export type SaveStateResult =
  | {
      ok: true;
      filePath: string;
      savedAt: number;
      lastSuccessfulSaveAt: number;
    }
  | {
      ok: false;
      filePath: string;
      error: Error;
      lastSuccessfulSaveAt?: number;
    };

export type SaveStateResultCallback = (result: SaveStateResult) => void;

function pathApiForPlatform(platform: NodeJS.Platform): PathApi {
  return platform === "win32" ? path.win32 : path.posix;
}

export function resolveDataPath(options: ResolveDataPathOptions = {}): string {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const homeDir = options.homeDir ?? env.HOME ?? env.USERPROFILE ?? os.homedir() ?? cwd;
  const pathApi = pathApiForPlatform(platform);
  const override = env.TODUI_DATA_PATH?.trim();

  if (override) {
    return pathApi.isAbsolute(override)
      ? pathApi.normalize(override)
      : pathApi.resolve(cwd, override);
  }

  if (platform === "win32") {
    const appData = env.APPDATA?.trim() || pathApi.join(homeDir, "AppData", "Roaming");
    return pathApi.join(appData, "todui", "todui_data.json");
  }

  if (platform === "darwin") {
    return pathApi.join(
      homeDir,
      "Library",
      "Application Support",
      "todui",
      "todui_data.json"
    );
  }

  const xdgDataHome = env.XDG_DATA_HOME?.trim() || pathApi.join(homeDir, ".local", "share");
  return pathApi.join(xdgDataHome, "todui", "todui_data.json");
}

const DATA_FILE = resolveDataPath();
const DEFAULT_FS_OPS: PersistenceFsOps = fs;
export const CURRENT_SCHEMA_VERSION = 3;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSuccessfulSaveAt: number | undefined;
const corruptionRecoveryByPath = new Map<string, string | undefined>();

function emptyData(): LoadedData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    tasks: [],
    tagIndex: {},
    savedViews: []
  };
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function formatBackupTimestamp(now: Date): string {
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

async function pathExists(filePath: string, fsOps: PersistenceFsOps): Promise<boolean> {
  try {
    await fsOps.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function nextBackupPath(
  filePath: string,
  now: Date,
  fsOps: PersistenceFsOps
): Promise<string> {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const stamp = formatBackupTimestamp(now);
  let candidate = path.join(dir, `${base}.corrupt.${stamp}`);
  let suffix = 1;

  while (await pathExists(candidate, fsOps)) {
    candidate = path.join(dir, `${base}.corrupt.${stamp}.${suffix}`);
    suffix += 1;
  }

  return candidate;
}

async function findExistingBackup(
  filePath: string,
  sourceSize: number,
  fsOps: PersistenceFsOps
): Promise<string | undefined> {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const prefix = `${base}.corrupt.`;

  try {
    const entries = await fsOps.readdir(dir);
    for (const entry of entries) {
      if (!entry.startsWith(prefix)) continue;
      const backupPath = path.join(dir, entry);
      const backupStat = await fsOps.stat(backupPath);
      if (backupStat.size === sourceSize) {
        return backupPath;
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}

async function backupCorruptFile(
  filePath: string,
  now: Date,
  fsOps: PersistenceFsOps
): Promise<string | undefined> {
  try {
    const sourceStat = await fsOps.stat(filePath);
    const existingBackup = await findExistingBackup(filePath, sourceStat.size, fsOps);
    if (existingBackup) {
      return existingBackup;
    }
  } catch {
    return undefined;
  }

  const backupPath = await nextBackupPath(filePath, now, fsOps);
  try {
    await fsOps.rename(filePath, backupPath);
    return backupPath;
  } catch {
    try {
      await fsOps.copyFile(filePath, backupPath);
      return backupPath;
    } catch {
      return undefined;
    }
  }
}

async function recoverFromCorruption(
  filePath: string,
  now: Date,
  fsOps: PersistenceFsOps
): Promise<SafeLoadResult> {
  if (corruptionRecoveryByPath.has(filePath)) {
    const previousBackupPath = corruptionRecoveryByPath.get(filePath);
    const backupName = previousBackupPath
      ? path.basename(previousBackupPath)
      : "backup-unavailable";
    return {
      data: emptyData(),
      resolvedPath: filePath,
      bannerMessage: `Data file was corrupt and was backed up to ${backupName}`,
      corruptBackupPath: previousBackupPath,
      shouldPersistRecoveredState: true,
      didMigrate: false
    };
  }

  const backupPath = await backupCorruptFile(filePath, now, fsOps);
  corruptionRecoveryByPath.set(filePath, backupPath);
  const backupName = backupPath ? path.basename(backupPath) : "backup-unavailable";
  return {
    data: emptyData(),
    resolvedPath: filePath,
    bannerMessage: `Data file was corrupt and was backed up to ${backupName}`,
    corruptBackupPath: backupPath,
    shouldPersistRecoveredState: true,
    didMigrate: false
  };
}

export async function safeLoadState(options: SafeLoadOptions = {}): Promise<SafeLoadResult> {
  const filePath = options.filePath ?? DATA_FILE;
  const fsOps = options.fsOps ?? DEFAULT_FS_OPS;
  const now = options.now ?? new Date();
  let raw = "";

  try {
    raw = await fsOps.readFile(filePath, "utf8");
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return {
        data: emptyData(),
        resolvedPath: filePath,
        shouldPersistRecoveredState: false,
        didMigrate: false
      };
    }
    return recoverFromCorruption(filePath, now, fsOps);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return recoverFromCorruption(filePath, now, fsOps);
  }

  const preValidation = validatePersistedState(parsed, "minimal");
  if (!preValidation.ok) {
    return recoverFromCorruption(filePath, now, fsOps);
  }

  try {
    const migrated = migratePersistedStateToCurrent(
      preValidation.data,
      CURRENT_SCHEMA_VERSION
    );
    const postValidation = validatePersistedState(migrated, "strict");
    if (!postValidation.ok) {
      return recoverFromCorruption(filePath, now, fsOps);
    }
    return {
      data: postValidation.data,
      resolvedPath: filePath,
      shouldPersistRecoveredState: false,
      didMigrate: preValidation.data.schemaVersion !== postValidation.data.schemaVersion
    };
  } catch {
    return recoverFromCorruption(filePath, now, fsOps);
  }
}

export async function loadState(): Promise<LoadedData> {
  const result = await safeLoadState();
  return result.data;
}

async function writeState(
  data: LoadedData,
  filePath = DATA_FILE,
  fsOps: PersistenceFsOps = DEFAULT_FS_OPS
): Promise<void> {
  await fsOps.mkdir(path.dirname(filePath), { recursive: true });
  const tmpFile = `${filePath}.tmp`;
  const payload = JSON.stringify(
    { ...data, schemaVersion: data.schemaVersion ?? CURRENT_SCHEMA_VERSION },
    null,
    2
  );
  await fsOps.writeFile(tmpFile, payload, "utf8");
  await fsOps.rename(tmpFile, filePath);
}

export function saveStateDebounced(
  data: LoadedData,
  delay = 350,
  filePath = DATA_FILE,
  fsOps: PersistenceFsOps = DEFAULT_FS_OPS,
  onResult?: SaveStateResultCallback
): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    void (async () => {
      try {
        await writeState(data, filePath, fsOps);
        const savedAt = Date.now();
        lastSuccessfulSaveAt = savedAt;
        onResult?.({
          ok: true,
          filePath,
          savedAt,
          lastSuccessfulSaveAt: savedAt
        });
      } catch (error: unknown) {
        const normalizedError =
          error instanceof Error ? error : new Error(String(error));
        onResult?.({
          ok: false,
          filePath,
          error: normalizedError,
          lastSuccessfulSaveAt
        });
      } finally {
        saveTimer = null;
      }
    })();
  }, delay);
}

export function getDataFilePath(): string {
  return DATA_FILE;
}
