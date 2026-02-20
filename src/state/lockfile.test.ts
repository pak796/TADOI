import { describe, expect, it } from "bun:test";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import {
  createDefaultLockPayload,
  getTadoiLockPath,
  isTadoiLockPresent,
  removeTadoiLock,
  removeTadoiLockSync,
  writeTadoiLock
} from "./lockfile";

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "tadoi-lock-test-"));
}

describe("lockfile helpers", () => {
  it("derives lock path next to data file", () => {
    const dataPath = "/tmp/test-app/tadoi_data.json";
    expect(getTadoiLockPath(dataPath)).toBe("/tmp/test-app/tadoi.lock");
  });

  it("writes lock file and reports presence", async () => {
    const dir = await makeTempDir();
    const lockPath = path.join(dir, "tadoi.lock");
    const payload = createDefaultLockPayload(path.join(dir, "tadoi_data.json"));
    await writeTadoiLock(lockPath, payload);

    expect(await isTadoiLockPresent(lockPath)).toBe(true);
    const raw = await fs.readFile(lockPath, "utf8");
    const parsed = JSON.parse(raw) as {
      pid: number;
      startedAt: string;
      version?: string;
      dataFile?: string;
    };
    expect(parsed.pid).toBe(payload.pid);
    expect(parsed.startedAt).toBe(payload.startedAt);
    expect(parsed.version).toBe(payload.version);
    expect(parsed.dataFile).toBe(payload.dataFile);
  });

  it("removes lock file asynchronously and synchronously", async () => {
    const dir = await makeTempDir();
    const asyncLock = path.join(dir, "async.lock");
    const syncLock = path.join(dir, "sync.lock");

    await writeTadoiLock(asyncLock, createDefaultLockPayload());
    await writeTadoiLock(syncLock, createDefaultLockPayload());

    await removeTadoiLock(asyncLock);
    removeTadoiLockSync(syncLock);

    expect(await isTadoiLockPresent(asyncLock)).toBe(false);
    expect(await isTadoiLockPresent(syncLock)).toBe(false);
  });

  it("ignores missing lock removals", async () => {
    const dir = await makeTempDir();
    const missingLock = path.join(dir, "missing.lock");
    await removeTadoiLock(missingLock);
    removeTadoiLockSync(missingLock);
    expect(await isTadoiLockPresent(missingLock)).toBe(false);
  });
});
