import { randomUUID } from "crypto";
import { promises as fs, unlinkSync } from "fs";
import path from "path";
import { APP_VERSION } from "../app/version";
import { getDataFilePath } from "./persistence";

const PRIVATE_DIR_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;
const STALE_ARCHIVE_ATTEMPTS_MAX = 100;

export const TADOI_LOCK_HEARTBEAT_INTERVAL_MS = 10_000;
export const TADOI_LOCK_STALE_AFTER_MS = 120_000;

export type TadoiLockPayload = {
  pid: number;
  startedAt: string;
  heartbeatAt?: string;
  lockId?: string;
  version?: string;
  dataFile?: string;
};

export type TadoiLockAcquireOptions = {
  nowMs?: number;
  staleAfterMs?: number;
  allowStaleTakeover?: boolean;
  archiveStaleLock?: boolean;
  onStaleLockRecovered?: (event: TadoiStaleLockRecoveryEvent) => void | Promise<void>;
};

export type TadoiLockHeartbeatOptions = {
  pid?: number;
  lockId?: string;
  expectedDataFile?: string;
  now?: Date;
};

export type TadoiStaleLockRecoveryEvent = {
  lockPath: string;
  archivedPath?: string;
};

export class TadoiLockBusyError extends Error {
  readonly lockPath: string;

  constructor(lockPath: string) {
    super(`TADOI is running (lock present): ${lockPath}`);
    this.name = "TadoiLockBusyError";
    this.lockPath = lockPath;
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function isAlreadyExistsError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "EEXIST"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidLockPayload(value: unknown): value is TadoiLockPayload {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.pid !== "number" || !Number.isInteger(value.pid)) {
    return false;
  }
  if (typeof value.startedAt !== "string" || value.startedAt.trim().length === 0) {
    return false;
  }
  if (value.heartbeatAt !== undefined && typeof value.heartbeatAt !== "string") {
    return false;
  }
  if (value.lockId !== undefined && typeof value.lockId !== "string") {
    return false;
  }
  if (value.version !== undefined && typeof value.version !== "string") {
    return false;
  }
  if (value.dataFile !== undefined && typeof value.dataFile !== "string") {
    return false;
  }
  return true;
}

function normalizeComparablePath(filePath: string): string {
  return path.normalize(path.resolve(filePath));
}

function parseIsoTimeMs(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
}

function normalizeStaleAfterMs(value: number | undefined): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  return TADOI_LOCK_STALE_AFTER_MS;
}

function formatTimestampForFilename(nowMs: number): string {
  const now = new Date(nowMs);
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return false;
    }
    throw error;
  }
}

async function tryWriteTadoiLockExclusive(
  lockPath: string,
  payload: TadoiLockPayload
): Promise<boolean> {
  let handle: Awaited<ReturnType<typeof fs.open>>;
  try {
    handle = await fs.open(lockPath, "wx", PRIVATE_FILE_MODE);
  } catch (error: unknown) {
    if (isAlreadyExistsError(error)) {
      return false;
    }
    throw error;
  }

  try {
    await handle.writeFile(JSON.stringify(payload, null, 2), "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }

  return true;
}

async function writeExistingTadoiLock(
  lockPath: string,
  payload: TadoiLockPayload
): Promise<boolean> {
  try {
    await fs.writeFile(lockPath, JSON.stringify(payload, null, 2), {
      encoding: "utf8",
      mode: PRIVATE_FILE_MODE,
      flag: "r+"
    });
    return true;
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return false;
    }
    throw error;
  }
}

async function archiveStaleLock(lockPath: string, nowMs: number): Promise<string | undefined> {
  const basePath = `${lockPath}.stale.${formatTimestampForFilename(nowMs)}`;
  for (let index = 0; index < STALE_ARCHIVE_ATTEMPTS_MAX; index += 1) {
    const archivePath = index === 0 ? basePath : `${basePath}.${String(index)}`;
    if (await pathExists(archivePath)) {
      continue;
    }
    try {
      await fs.rename(lockPath, archivePath);
      return archivePath;
    } catch (error: unknown) {
      if (isMissingFileError(error)) {
        return undefined;
      }
      throw error;
    }
  }
  throw new Error(`Unable to archive stale lock after ${String(STALE_ARCHIVE_ATTEMPTS_MAX)} attempts`);
}

async function isLockFileStaleByMtime(
  lockPath: string,
  options: { nowMs: number; staleAfterMs: number }
): Promise<boolean> {
  try {
    const stat = await fs.stat(lockPath);
    return options.nowMs - stat.mtimeMs > options.staleAfterMs;
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return false;
    }
    throw error;
  }
}

export function getTadoiLockPath(dataFilePath = getDataFilePath()): string {
  return path.join(path.dirname(dataFilePath), "tadoi.lock");
}

export async function isTadoiLockPresent(lockPath: string): Promise<boolean> {
  try {
    await fs.access(lockPath);
    return true;
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return false;
    }
    throw error;
  }
}

export async function readTadoiLockPayload(
  lockPath: string
): Promise<TadoiLockPayload | undefined> {
  let raw = "";
  try {
    raw = await fs.readFile(lockPath, "utf8");
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return undefined;
    }
    throw error;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return isValidLockPayload(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export async function isTadoiLockOwnedByProcess(
  lockPath: string,
  pid = process.pid,
  expectedDataFile?: string
): Promise<boolean> {
  const payload = await readTadoiLockPayload(lockPath);
  if (!payload || payload.pid !== pid) {
    return false;
  }
  if (!expectedDataFile || !payload.dataFile) {
    return true;
  }
  return normalizeComparablePath(payload.dataFile) === normalizeComparablePath(expectedDataFile);
}

export function isTadoiLockPayloadStale(
  payload: TadoiLockPayload,
  options: { nowMs?: number; staleAfterMs?: number } = {}
): boolean {
  const nowMs = options.nowMs ?? Date.now();
  const staleAfterMs = normalizeStaleAfterMs(options.staleAfterMs);
  const heartbeatTimeMs = parseIsoTimeMs(payload.heartbeatAt) ?? parseIsoTimeMs(payload.startedAt);
  if (heartbeatTimeMs === undefined) {
    return true;
  }
  return nowMs - heartbeatTimeMs > staleAfterMs;
}

export async function writeTadoiLock(
  lockPath: string,
  payload: TadoiLockPayload
): Promise<void> {
  await fs.mkdir(path.dirname(lockPath), { recursive: true, mode: PRIVATE_DIR_MODE });
  await fs.writeFile(lockPath, JSON.stringify(payload, null, 2), {
    encoding: "utf8",
    mode: PRIVATE_FILE_MODE
  });
}

export async function tryAcquireTadoiLock(
  lockPath: string,
  payload: TadoiLockPayload,
  options: TadoiLockAcquireOptions = {}
): Promise<boolean> {
  await fs.mkdir(path.dirname(lockPath), { recursive: true, mode: PRIVATE_DIR_MODE });

  const acquired = await tryWriteTadoiLockExclusive(lockPath, payload);
  if (acquired) {
    return true;
  }
  if (options.allowStaleTakeover === false) {
    return false;
  }

  const nowMs = options.nowMs ?? Date.now();
  const staleAfterMs = normalizeStaleAfterMs(options.staleAfterMs);
  const existingPayload = await readTadoiLockPayload(lockPath);
  const stale = existingPayload
    ? isTadoiLockPayloadStale(existingPayload, { nowMs, staleAfterMs })
    : await isLockFileStaleByMtime(lockPath, { nowMs, staleAfterMs });
  if (!stale) {
    return false;
  }

  if (options.archiveStaleLock === false) {
    await removeTadoiLock(lockPath);
  } else {
    const archivedPath = await archiveStaleLock(lockPath, nowMs);
    const recovered = await tryWriteTadoiLockExclusive(lockPath, payload);
    if (recovered && options.onStaleLockRecovered) {
      try {
        await options.onStaleLockRecovered({
          lockPath,
          ...(archivedPath ? { archivedPath } : {})
        });
      } catch {
        // Best effort reporting only; do not fail lock acquisition.
      }
    }
    return recovered;
  }
  const recovered = await tryWriteTadoiLockExclusive(lockPath, payload);
  if (recovered && options.onStaleLockRecovered) {
    try {
      await options.onStaleLockRecovered({ lockPath });
    } catch {
      // Best effort reporting only; do not fail lock acquisition.
    }
  }
  return recovered;
}

export async function acquireTadoiLockOrThrow(
  lockPath: string,
  payload: TadoiLockPayload,
  options: TadoiLockAcquireOptions = {}
): Promise<void> {
  const acquired = await tryAcquireTadoiLock(lockPath, payload, options);
  if (!acquired) {
    throw new TadoiLockBusyError(lockPath);
  }
}

export async function refreshTadoiLockHeartbeat(
  lockPath: string,
  options: TadoiLockHeartbeatOptions = {}
): Promise<boolean> {
  const payload = await readTadoiLockPayload(lockPath);
  if (!payload) {
    return false;
  }

  const expectedPid = options.pid ?? process.pid;
  if (payload.pid !== expectedPid) {
    return false;
  }
  if (options.lockId && payload.lockId !== options.lockId) {
    return false;
  }
  if (
    options.expectedDataFile &&
    payload.dataFile &&
    normalizeComparablePath(payload.dataFile) !==
      normalizeComparablePath(options.expectedDataFile)
  ) {
    return false;
  }

  const updatedPayload: TadoiLockPayload = {
    ...payload,
    heartbeatAt: (options.now ?? new Date()).toISOString(),
    ...(payload.lockId ? {} : options.lockId ? { lockId: options.lockId } : {})
  };
  return writeExistingTadoiLock(lockPath, updatedPayload);
}

export async function removeTadoiLock(lockPath: string): Promise<void> {
  try {
    await fs.unlink(lockPath);
  } catch (error: unknown) {
    if (!isMissingFileError(error)) {
      throw error;
    }
  }
}

export function removeTadoiLockSync(lockPath: string): void {
  try {
    unlinkSync(lockPath);
  } catch (error: unknown) {
    if (!isMissingFileError(error)) {
      throw error;
    }
  }
}

export function createDefaultLockPayload(dataFile?: string): TadoiLockPayload {
  const nowIso = new Date().toISOString();
  return {
    pid: process.pid,
    startedAt: nowIso,
    heartbeatAt: nowIso,
    lockId: randomUUID(),
    version: APP_VERSION,
    ...(dataFile ? { dataFile } : {})
  };
}
