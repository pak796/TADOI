import { promises as fs, unlinkSync } from "fs";
import path from "path";
import { APP_VERSION } from "../app/version";
import { getDataFilePath } from "./persistence";

export type TadoiLockPayload = {
  pid: number;
  startedAt: string;
  version?: string;
  dataFile?: string;
};

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
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
  await fs.mkdir(path.dirname(lockPath), { recursive: true });
  await fs.writeFile(lockPath, JSON.stringify(payload, null, 2), "utf8");
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
