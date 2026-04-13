import path from "path";
import type {
  CreateDataBackupOptions,
  PersistenceFsOps,
} from "./types";
import { DEFAULT_FS_OPS } from "./types";

function formatBackupTimestamp(now: Date): string {
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
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

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

export async function nextTimestampedSiblingPath(
  filePath: string,
  label: "corrupt" | "backup",
  options: CreateDataBackupOptions = {},
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

async function findExistingBackup(
  filePath: string,
  sourceSize: number,
  fsOps: PersistenceFsOps,
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

export async function backupCorruptFile(
  filePath: string,
  now: Date,
  fsOps: PersistenceFsOps,
): Promise<string | undefined> {
  try {
    const sourceStat = await fsOps.stat(filePath);
    const existingBackup = await findExistingBackup(
      filePath,
      sourceStat.size,
      fsOps,
    );
    if (existingBackup) {
      return existingBackup;
    }
  } catch {
    return undefined;
  }

  const backupPath = await nextTimestampedSiblingPath(filePath, "corrupt", {
    now,
    fsOps,
  });
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

export async function createDataBackup(
  filePath: string,
  options: CreateDataBackupOptions = {},
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
      `Unable to access source data file for backup at ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const backupPath = await nextTimestampedSiblingPath(filePath, "backup", {
    now,
    fsOps,
  });
  await fsOps.copyFile(filePath, backupPath);
  return backupPath;
}
