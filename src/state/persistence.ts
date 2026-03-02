import os from "os";
import { randomUUID } from "node:crypto";
import { promises as fs } from "fs";
import path from "path";
import { EngagementState, SavedView, TagIndexEntry, Task } from "../domain/models";
import { createDefaultEngagementState } from "../domain/engagement";
import { normalizePriorityTags } from "../domain/priorityTags";
import { normalizeTagAliases } from "../domain/tagAliases";
import { migratePersistedStateToCurrent } from "./migrations";
import { recomputeTagIndex } from "./portability";
import { validatePersistedState } from "./validation";
import { BRAND_SLUG, DATA_FILE_NAME, ENV_VARS } from "../brand/brand";

export type LoadedData = {
  schemaVersion: number;
  stateRevision?: number;
  tasks: Task[];
  tagIndex: Record<string, TagIndexEntry>;
  tagAliases?: Record<string, string>;
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
  | "unlink"
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
      stateRevision: number;
    }
  | {
      ok: false;
      filePath: string;
      error: Error;
      lastSuccessfulSaveAt?: number;
      expectedStateRevision?: number;
      actualStateRevision?: number;
      isRevisionConflict?: boolean;
    };

export type SaveStateResultCallback = (result: SaveStateResult) => void;
export type StrictLoadOptions = {
  filePath?: string;
  fsOps?: PersistenceFsOps;
  allowTagNormalizationRepair?: boolean;
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

export type SaveStateAtomicOptions = {
  expectedStateRevision?: number;
};

export type SaveStateDebouncedOptions = SaveStateAtomicOptions;

export class StateRevisionConflictError extends Error {
  readonly filePath: string;
  readonly expectedRevision: number;
  readonly actualRevision: number;

  constructor(filePath: string, expectedRevision: number, actualRevision: number) {
    super(
      `State revision conflict at ${filePath}: expected ${String(expectedRevision)} but found ${String(actualRevision)}`
    );
    this.name = "StateRevisionConflictError";
    this.filePath = filePath;
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

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

const DEFAULT_FS_OPS: PersistenceFsOps = fs;
export const CURRENT_SCHEMA_VERSION = 8;
const PRIVATE_DIR_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;
const TAG_NORMALIZATION_VALIDATION_FRAGMENT = "task.tags must be normalized/deduped";
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSuccessfulSaveAt: number | undefined;
const corruptionRecoveryByPath = new Map<string, string | undefined>();
const atomicWriteQueueByPath = new Map<string, Promise<void>>();

function emptyData(): LoadedData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    stateRevision: 0,
    tasks: [],
    tagIndex: {},
    tagAliases: {},
    savedViews: [],
    engagement: createDefaultEngagementState()
  };
}

function resolveDefaultDataFilePath(): string {
  return resolveDataPath();
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

function isTagNormalizationOnlyValidationErrors(errors: string[]): boolean {
  return (
    errors.length > 0 &&
    errors.every((error) => error.includes(TAG_NORMALIZATION_VALIDATION_FRAGMENT))
  );
}

function repairTaskTagNormalization(data: LoadedData): LoadedData {
  const tasks = data.tasks.map((task) => ({
    ...task,
    tags: normalizePriorityTags(Array.isArray(task.tags) ? task.tags : [])
  }));
  return {
    ...data,
    tasks,
    tagIndex: recomputeTagIndex(tasks),
    tagAliases: normalizeTagAliases(data.tagAliases)
  };
}

function validateStrictWithOptionalTagRepair(
  data: LoadedData,
  allowTagNormalizationRepair: boolean
):
  | { ok: true; data: LoadedData; repairedIssueCount: number }
  | { ok: false; errors: string[] } {
  const strictValidation = validatePersistedState(data, "strict");
  if (strictValidation.ok) {
    return {
      ok: true,
      data: strictValidation.data,
      repairedIssueCount: 0
    };
  }

  if (
    !allowTagNormalizationRepair ||
    !isTagNormalizationOnlyValidationErrors(strictValidation.errors)
  ) {
    return { ok: false, errors: strictValidation.errors };
  }

  const repaired = repairTaskTagNormalization(data);
  const repairedValidation = validatePersistedState(repaired, "strict");
  if (!repairedValidation.ok) {
    return { ok: false, errors: strictValidation.errors };
  }
  return {
    ok: true,
    data: repairedValidation.data,
    repairedIssueCount: strictValidation.errors.length
  };
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

async function nextPidTempFilePath(
  filePath: string,
  fsOps: PersistenceFsOps
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

  throw new Error(`Failed to allocate pid temp file for atomic save: ${filePath}`);
}

function atomicWriteQueueKey(filePath: string): string {
  const resolved = path.resolve(filePath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

async function runWithAtomicWriteLock(filePath: string, task: () => Promise<void>): Promise<void> {
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
  const filePath = options.filePath ?? resolveDefaultDataFilePath();
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
    const strictValidation = validateStrictWithOptionalTagRepair(migrated, true);
    if (!strictValidation.ok) {
      return recoverFromCorruption(filePath, now, fsOps);
    }
    const repairedTagIssues = strictValidation.repairedIssueCount;
    return {
      data: strictValidation.data,
      resolvedPath: filePath,
      ...(repairedTagIssues > 0
        ? {
            bannerMessage: `Recovered ${String(repairedTagIssues)} legacy task tag normalization issue(s).`
          }
        : {}),
      shouldPersistRecoveredState: false,
      didMigrate:
        preValidation.data.schemaVersion !== strictValidation.data.schemaVersion ||
        repairedTagIssues > 0
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
  const filePath = options.filePath ?? resolveDefaultDataFilePath();
  const fsOps = options.fsOps ?? DEFAULT_FS_OPS;
  const allowTagNormalizationRepair = options.allowTagNormalizationRepair !== false;
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

  const strictValidation = validateStrictWithOptionalTagRepair(
    migrated,
    allowTagNormalizationRepair
  );
  if (!strictValidation.ok) {
    throw new Error(
      `Strict validation failed for ${filePath}: ${strictValidation.errors.join("; ")}`
    );
  }

  return {
    data: strictValidation.data,
    resolvedPath: filePath,
    didMigrate:
      preValidation.data.schemaVersion !== strictValidation.data.schemaVersion ||
      strictValidation.repairedIssueCount > 0
  };
}

export async function writeJsonAtomic(
  payload: unknown,
  options: WriteJsonAtomicOptions = {}
): Promise<void> {
  const filePath = options.filePath ?? resolveDefaultDataFilePath();
  const fsOps = options.fsOps ?? DEFAULT_FS_OPS;
  const pretty = options.pretty !== false;
  const fsyncBeforeRename = options.fsyncBeforeRename === true;
  await runWithAtomicWriteLock(filePath, async () => {
    await fsOps.mkdir(path.dirname(filePath), { recursive: true, mode: PRIVATE_DIR_MODE });
    const tmpFile = await nextAtomicTempFilePath(filePath, fsOps);
    const content = pretty
      ? JSON.stringify(payload, null, 2)
      : JSON.stringify(payload);
    await fsOps.writeFile(tmpFile, content, {
      encoding: "utf8",
      mode: PRIVATE_FILE_MODE
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
  filePath = resolveDefaultDataFilePath(),
  fsOps: PersistenceFsOps = DEFAULT_FS_OPS,
  options: SaveStateAtomicOptions = {}
): Promise<number> {
  let nextStateRevision = 0;
  await runWithAtomicWriteLock(filePath, async () => {
    const currentState = await loadStateStrict({ filePath, fsOps });
    const actualRevision = normalizeStateRevision(currentState.data.stateRevision);
    if (
      typeof options.expectedStateRevision === "number" &&
      options.expectedStateRevision !== actualRevision
    ) {
      throw new StateRevisionConflictError(
        filePath,
        options.expectedStateRevision,
        actualRevision
      );
    }
    nextStateRevision = actualRevision + 1;
    const dirPath = path.dirname(filePath);
    await fsOps.mkdir(dirPath, { recursive: true, mode: PRIVATE_DIR_MODE });
    const tmpFile = await nextPidTempFilePath(filePath, fsOps);
    const payload = {
      ...data,
      schemaVersion: data.schemaVersion ?? CURRENT_SCHEMA_VERSION,
      stateRevision: nextStateRevision
    };
    const content = JSON.stringify(payload, null, 2);
    let renamed = false;

    try {
      await fsOps.writeFile(tmpFile, content, {
        encoding: "utf8",
        mode: PRIVATE_FILE_MODE
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
  return nextStateRevision;
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
  filePath = resolveDefaultDataFilePath(),
  fsOps: PersistenceFsOps = DEFAULT_FS_OPS,
  options: SaveStateAtomicOptions = {}
): Promise<number> {
  return saveStateAtomic(
    { ...data, schemaVersion: data.schemaVersion ?? CURRENT_SCHEMA_VERSION },
    filePath,
    fsOps,
    options
  );
}

export function saveStateDebounced(
  data: LoadedData,
  delay = 350,
  filePath = resolveDefaultDataFilePath(),
  fsOps: PersistenceFsOps = DEFAULT_FS_OPS,
  onResult?: SaveStateResultCallback,
  options: SaveStateDebouncedOptions = {}
): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    void (async () => {
      try {
        const stateRevision = await writeState(data, filePath, fsOps, {
          expectedStateRevision: options.expectedStateRevision
        });
        const savedAt = Date.now();
        lastSuccessfulSaveAt = savedAt;
        onResult?.({
          ok: true,
          filePath,
          savedAt,
          lastSuccessfulSaveAt: savedAt,
          stateRevision
        });
      } catch (error: unknown) {
        const normalizedError =
          error instanceof Error ? error : new Error(String(error));
        const conflictFields =
          error instanceof StateRevisionConflictError
            ? {
                expectedStateRevision: error.expectedRevision,
                actualStateRevision: error.actualRevision,
                isRevisionConflict: true
              }
            : {};
        onResult?.({
          ok: false,
          filePath,
          error: normalizedError,
          lastSuccessfulSaveAt,
          ...conflictFields
        });
      } finally {
        saveTimer = null;
      }
    })();
  }, delay);
}

export function getDataFilePath(): string {
  return resolveDefaultDataFilePath();
}
