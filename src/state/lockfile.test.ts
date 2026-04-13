import { describe, expect, it } from "bun:test";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import {
  acquireTadoiLockOrThrow,
  createDefaultLockPayload,
  getTadoiLockPath,
  isTadoiLockOwnedByProcess,
  isTadoiLockPayloadStale,
  isTadoiLockPresent,
  readTadoiLockPayload,
  refreshTadoiLockHeartbeat,
  removeTadoiLock,
  removeTadoiLockSync,
  TadoiLockBusyError,
  tryAcquireTadoiLock,
  writeTadoiLock,
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
      heartbeatAt?: string;
      lockId?: string;
      version?: string;
      dataFile?: string;
    };
    expect(parsed.pid).toBe(payload.pid);
    expect(parsed.startedAt).toBe(payload.startedAt);
    expect(parsed.heartbeatAt).toBe(payload.heartbeatAt);
    expect(parsed.lockId).toBe(payload.lockId);
    expect(parsed.version).toBe(payload.version);
    expect(parsed.dataFile).toBe(payload.dataFile);

    if (process.platform !== "win32") {
      const stat = await fs.stat(lockPath);
      expect(stat.mode & 0o077).toBe(0);
    }
  });

  it("reads lock payload and verifies ownership by pid and data file", async () => {
    const dir = await makeTempDir();
    const dataPath = path.join(dir, "tadoi_data.json");
    const lockPath = path.join(dir, "owner.lock");
    const payload = createDefaultLockPayload(dataPath);
    await writeTadoiLock(lockPath, payload);

    const parsed = await readTadoiLockPayload(lockPath);
    expect(parsed?.pid).toBe(process.pid);
    expect(parsed?.dataFile).toBe(dataPath);

    await expect(
      isTadoiLockOwnedByProcess(lockPath, process.pid, dataPath),
    ).resolves.toBe(true);
    await expect(
      isTadoiLockOwnedByProcess(lockPath, process.pid + 1, dataPath),
    ).resolves.toBe(false);
    await expect(
      isTadoiLockOwnedByProcess(
        lockPath,
        process.pid,
        path.join(dir, "other.json"),
      ),
    ).resolves.toBe(false);
  });

  it("acquires lock atomically in exclusive mode", async () => {
    const dir = await makeTempDir();
    const lockPath = path.join(dir, "exclusive.lock");

    const acquired = await tryAcquireTadoiLock(
      lockPath,
      createDefaultLockPayload(),
    );
    expect(acquired).toBe(true);

    const secondAcquire = await tryAcquireTadoiLock(
      lockPath,
      createDefaultLockPayload(),
    );
    expect(secondAcquire).toBe(false);
  });

  it("refreshes heartbeat only for matching lock ownership", async () => {
    const dir = await makeTempDir();
    const lockPath = path.join(dir, "heartbeat.lock");
    const payload = createDefaultLockPayload(path.join(dir, "tadoi_data.json"));
    await writeTadoiLock(lockPath, payload);

    const refreshed = await refreshTadoiLockHeartbeat(lockPath, {
      pid: payload.pid,
      lockId: payload.lockId,
      now: new Date("2026-02-28T10:00:00.000Z"),
    });
    expect(refreshed).toBe(true);
    const updated = await readTadoiLockPayload(lockPath);
    expect(updated?.heartbeatAt).toBe("2026-02-28T10:00:00.000Z");

    const rejected = await refreshTadoiLockHeartbeat(lockPath, {
      pid: payload.pid,
      lockId: "wrong-lock-id",
    });
    expect(rejected).toBe(false);
    const afterRejected = await readTadoiLockPayload(lockPath);
    expect(afterRejected?.heartbeatAt).toBe("2026-02-28T10:00:00.000Z");
  });

  it("treats old heartbeat payload as stale and takes over lock", async () => {
    const dir = await makeTempDir();
    const lockPath = path.join(dir, "stale.lock");
    await writeTadoiLock(lockPath, {
      pid: 424242,
      startedAt: "2026-02-28T09:50:00.000Z",
      heartbeatAt: "2026-02-28T09:50:00.000Z",
      lockId: "old-lock-id",
      dataFile: path.join(dir, "tadoi_data.json"),
    });
    const nextPayload = createDefaultLockPayload(
      path.join(dir, "tadoi_data.json"),
    );
    const recoveredEvents: Array<{ lockPath: string; archivedPath?: string }> =
      [];

    const stalePayload = await readTadoiLockPayload(lockPath);
    expect(
      isTadoiLockPayloadStale(
        stalePayload as NonNullable<typeof stalePayload>,
        {
          nowMs: Date.parse("2026-02-28T10:00:00.000Z"),
          staleAfterMs: 120_000,
        },
      ),
    ).toBe(true);

    const acquired = await tryAcquireTadoiLock(lockPath, nextPayload, {
      nowMs: Date.parse("2026-02-28T10:00:00.000Z"),
      staleAfterMs: 120_000,
      onStaleLockRecovered: (event) => {
        recoveredEvents.push(event);
      },
    });
    expect(acquired).toBe(true);
    const current = await readTadoiLockPayload(lockPath);
    expect(current?.lockId).toBe(nextPayload.lockId);
    expect(current?.pid).toBe(nextPayload.pid);

    const archivePrefix = `${path.basename(lockPath)}.stale.`;
    const archived = (await fs.readdir(dir)).filter((entry) =>
      entry.startsWith(archivePrefix),
    );
    expect(archived.length).toBe(1);
    const archivedPayloadRaw = await fs.readFile(
      path.join(dir, archived[0] as string),
      "utf8",
    );
    const archivedPayload = JSON.parse(archivedPayloadRaw) as {
      pid: number;
      lockId?: string;
    };
    expect(archivedPayload.pid).toBe(424242);
    expect(archivedPayload.lockId).toBe("old-lock-id");
    expect(recoveredEvents).toHaveLength(1);
    expect(recoveredEvents[0]?.lockPath).toBe(lockPath);
    expect(recoveredEvents[0]?.archivedPath).toContain(".stale.");
  });

  it("throws lock-busy error when acquire helper cannot acquire lock", async () => {
    const dir = await makeTempDir();
    const lockPath = path.join(dir, "busy.lock");
    await writeTadoiLock(lockPath, createDefaultLockPayload());
    await expect(
      acquireTadoiLockOrThrow(lockPath, createDefaultLockPayload()),
    ).rejects.toBeInstanceOf(TadoiLockBusyError);
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
