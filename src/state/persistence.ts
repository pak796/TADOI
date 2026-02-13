import os from "os";
import { randomUUID } from "node:crypto";
import { promises as fs } from "fs";
import path from "path";
import { EngagementState, SavedView, TagIndexEntry, Task } from "../domain/models";
import { createDefaultEngagementState } from "../domain/engagement";
import { migratePersistedStateToCurrent } from "./migrations";
import { validatePersistedState } from "./validation";
import { BRAND_SLUG, DATA_FILE_NAME, ENV_VARS } from "../brand/brand";

export type LoadedData = {
  schemaVersion: number;
  tasks: Task[];
  tagIndex: Record<string, TagIndexEntry>;
  savedViews: SavedView[];
  engagement?: EngagementState;
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
  | "open"
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
export type StrictLoadOptions = {
  filePath?: string;
  fsOps?: PersistenceFsOps;
};

export type StrictLoadResult = {
  data: LoadedData;
  resolvedPath: string;
  didMigrate: boolean;
};

export type WriteJsonAtomicOptions = {
  filePath?: string;
  fsOps?: PersistenceFsOps;
  pretty?: boolean;
  fsyncBeforeRename?: boolean;
};

export type CreateDataBackupOptions = {
  now?: Date;
  fsOps?: PersistenceFsOps;
};

function pathApiForPlatform(platform: NodeJS.Platform): PathApi {
  return platform === "win32" ? path.win32 : path.posix;
}

export function resolveDataPath(options: ResolveDataPathOptions = {}): string {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const homeDir = options.homeDir ?? env.HOME ?? env.USERPROFILE ?? os.homedir() ?? cwd;
  const pathApi = pathApiForPlatform(platform);
  const override = env[ENV_VARS.DATA_PATH]?.trim();

  if (override) {
    return pathApi.isAbsolute(override)
      ? pathApi.normalize(override)
      : pathApi.resolve(cwd, override);
  }

  if (platform === "win32") {
    const appData = env.APPDATA?.trim() || pathApi.join(homeDir, "AppData", "Roaming");
    return pathApi.join(appData, BRAND_SLUG, DATA_FILE_NAME);
  }

  if (platform === "darwin") {
    return pathApi.join(homeDir, "Library", "Application Support", BRAND_SLUG, DATA_FILE_NAME);
  }

  const xdgDataHome = env.XDG_DATA_HOME?.trim() || pathApi.join(homeDir, ".local", "share");
  return pathApi.join(xdgDataHome, BRAND_SLUG, DATA_FILE_NAME);
}

const DATA_FILE = resolveDataPath();
const DEFAULT_FS_OPS: PersistenceFsOps = fs;
export const CURRENT_SCHEMA_VERSION = 5;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSuccessfulSaveAt: number | undefined;
const corruptionRecoveryByPath = new Map<string, string | undefined>();

function emptyData(): LoadedData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    tasks: [],
    tagIndex: {},
    savedViews: [],
    engagement: createDefaultEngagementState()
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

function formatReadErrorForBanner(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "unknown read error";
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

async function nextAtomicTempFilePath(
  filePath: string,
  fsOps: PersistenceFsOps
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

  throw new Error(`Failed to allocate unique temporary file for atomic write: ${filePath}`);
}

async function nextBackupPath(
  filePath: string,
  now: Date,
  fsOps: PersistenceFsOps
): Promise<string> {
  return nextTimestampedSiblingPath(filePath, "corrupt", { now, fsOps });
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
    return {
      data: emptyData(),
      resolvedPath: filePath,
      bannerMessage:
        `Unable to read data file (${formatReadErrorForBanner(error)}). ` +
        "Existing file was not modified.",
      shouldPersistRecoveredState: false,
      didMigrate: false
    };
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

export async function loadStateStrict(options: StrictLoadOptions = {}): Promise<StrictLoadResult> {
  const filePath = options.filePath ?? DATA_FILE;
  const fsOps = options.fsOps ?? DEFAULT_FS_OPS;
  let raw = "";

  try {
    raw = await fsOps.readFile(filePath, "utf8");
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return {
        data: emptyData(),
        resolvedPath: filePath,
        didMigrate: false
      };
    }
    throw new Error(
      `Failed to read data file at ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error: unknown) {
    throw new Error(
      `Failed to parse JSON at ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const preValidation = validatePersistedState(parsed, "minimal");
  if (!preValidation.ok) {
    throw new Error(
      `Minimal validation failed for ${filePath}: ${preValidation.errors.join("; ")}`
    );
  }

  let migrated: LoadedData;
  try {
    migrated = migratePersistedStateToCurrent(
      preValidation.data,
      CURRENT_SCHEMA_VERSION
    );
  } catch (error: unknown) {
    throw new Error(
      `Migration failed for ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const postValidation = validatePersistedState(migrated, "strict");
  if (!postValidation.ok) {
    throw new Error(
      `Strict validation failed for ${filePath}: ${postValidation.errors.join("; ")}`
    );
  }

  return {
    data: postValidation.data,
    resolvedPath: filePath,
    didMigrate: preValidation.data.schemaVersion !== postValidation.data.schemaVersion
  };
}

export async function writeJsonAtomic(
  payload: unknown,
  options: WriteJsonAtomicOptions = {}
): Promise<void> {
  const filePath = options.filePath ?? DATA_FILE;
  const fsOps = options.fsOps ?? DEFAULT_FS_OPS;
  const pretty = options.pretty !== false;
  const fsyncBeforeRename = options.fsyncBeforeRename === true;
  await fsOps.mkdir(path.dirname(filePath), { recursive: true });
  const tmpFile = await nextAtomicTempFilePath(filePath, fsOps);
  const content = pretty
    ? JSON.stringify(payload, null, 2)
    : JSON.stringify(payload);
  await fsOps.writeFile(tmpFile, content, "utf8");
  if (fsyncBeforeRename) {
    const handle = await fsOps.open(tmpFile, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  }
  await fsOps.rename(tmpFile, filePath);
}

export async function nextTimestampedSiblingPath(
  filePath: string,
  label: "corrupt" | "backup",
  options: CreateDataBackupOptions = {}
): Promise<string> {
  const fsOps = options.fsOps ?? DEFAULT_FS_OPS;
  const now = options.now ?? new Date();
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const stamp = formatBackupTimestamp(now);
  let candidate = path.join(dir, `${base}.${label}.${stamp}`);
  let suffix = 1;

  while (await pathExists(candidate, fsOps)) {
    candidate = path.join(dir, `${base}.${label}.${stamp}.${suffix}`);
    suffix += 1;
  }

  return candidate;
}

export async function createDataBackup(
  filePath: string,
  options: CreateDataBackupOptions = {}
): Promise<string | undefined> {
  const fsOps = options.fsOps ?? DEFAULT_FS_OPS;
  const now = options.now ?? new Date();

  try {
    await fsOps.access(filePath);
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return undefined;
    }
    throw new Error(
      `Unable to access source data file for backup at ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const backupPath = await nextTimestampedSiblingPath(filePath, "backup", {
    now,
    fsOps
  });
  await fsOps.copyFile(filePath, backupPath);
  return backupPath;
}

async function writeState(
  data: LoadedData,
  filePath = DATA_FILE,
  fsOps: PersistenceFsOps = DEFAULT_FS_OPS
): Promise<void> {
  await writeJsonAtomic(
    { ...data, schemaVersion: data.schemaVersion ?? CURRENT_SCHEMA_VERSION },
    { filePath, fsOps, pretty: true }
  );
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
