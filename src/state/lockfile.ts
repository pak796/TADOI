import { promises as fs, unlinkSync } from "fs";
import path from "path";
import { APP_VERSION } from "../app/version";
import { getDataFilePath } from "./persistence";

const PRIVATE_DIR_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;

export type TadoiLockPayload = {
  pid: number;
  startedAt: string;
  version?: string;
  dataFile?: string;
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
  payload: TadoiLockPayload
): Promise<boolean> {
  await fs.mkdir(path.dirname(lockPath), { recursive: true, mode: PRIVATE_DIR_MODE });

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

export async function acquireTadoiLockOrThrow(
  lockPath: string,
  payload: TadoiLockPayload
): Promise<void> {
  const acquired = await tryAcquireTadoiLock(lockPath, payload);
  if (!acquired) {
    throw new TadoiLockBusyError(lockPath);
  }
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
  return {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    version: APP_VERSION,
    ...(dataFile ? { dataFile } : {})
  };
}
