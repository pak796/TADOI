import { describe, expect, it } from "bun:test";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { probeTadoiRunningState } from "./isRunning";
import { getTadoiLockPath, writeTadoiLock } from "../state/lockfile";

async function makeTempDataFilePath(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-reminders-running-"));
  return path.join(dir, "tadoi_data.json");
}

describe("probeTadoiRunningState", () => {
  it("returns not running when lock is missing", async () => {
    const dataFilePath = await makeTempDataFilePath();
    const result = await probeTadoiRunningState({ dataFilePath });
    expect(result.running).toBe(false);
    expect(result.reason).toBe("no_lock");
  });

  it("returns running for active lock heartbeat", async () => {
    const dataFilePath = await makeTempDataFilePath();
    const lockPath = getTadoiLockPath(dataFilePath);
    const nowIso = "2026-03-03T10:00:00.000Z";

    await fs.mkdir(path.dirname(lockPath), { recursive: true });
    await writeTadoiLock(lockPath, {
      pid: 1234,
      startedAt: nowIso,
      heartbeatAt: nowIso,
      dataFile: dataFilePath
    });

    const result = await probeTadoiRunningState({
      dataFilePath,
      nowMs: Date.parse("2026-03-03T10:00:10.000Z")
    });
    expect(result.running).toBe(true);
    expect(result.reason).toBe("active_lock");
  });

  it("treats stale heartbeat as not running", async () => {
    const dataFilePath = await makeTempDataFilePath();
    const lockPath = getTadoiLockPath(dataFilePath);

    await fs.mkdir(path.dirname(lockPath), { recursive: true });
    await writeTadoiLock(lockPath, {
      pid: 1234,
      startedAt: "2026-03-03T09:00:00.000Z",
      heartbeatAt: "2026-03-03T09:00:00.000Z",
      dataFile: dataFilePath
    });

    const result = await probeTadoiRunningState({
      dataFilePath,
      nowMs: Date.parse("2026-03-03T10:10:00.000Z")
    });
    expect(result.running).toBe(false);
    expect(result.reason).toBe("stale_lock");
  });
});
