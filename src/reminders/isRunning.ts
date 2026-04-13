import {
  getTadoiLockPath,
  isTadoiLockPayloadStale,
  isTadoiLockPresent,
  readTadoiLockPayload,
  TADOI_LOCK_STALE_AFTER_MS,
} from "../state/lockfile";

export type TadoiRunningProbeResult = {
  running: boolean;
  lockPath: string;
  reason: "no_lock" | "stale_lock" | "active_lock" | "invalid_lock";
  pid?: number;
};

export async function probeTadoiRunningState(options: {
  dataFilePath: string;
  nowMs?: number;
  staleAfterMs?: number;
}): Promise<TadoiRunningProbeResult> {
  const lockPath = getTadoiLockPath(options.dataFilePath);
  const nowMs = options.nowMs ?? Date.now();
  const staleAfterMs = options.staleAfterMs ?? TADOI_LOCK_STALE_AFTER_MS;

  const present = await isTadoiLockPresent(lockPath);
  if (!present) {
    return {
      running: false,
      lockPath,
      reason: "no_lock",
    };
  }

  const payload = await readTadoiLockPayload(lockPath);
  if (!payload) {
    return {
      running: false,
      lockPath,
      reason: "invalid_lock",
    };
  }

  if (
    isTadoiLockPayloadStale(payload, {
      nowMs,
      staleAfterMs,
    })
  ) {
    return {
      running: false,
      lockPath,
      reason: "stale_lock",
      pid: payload.pid,
    };
  }

  return {
    running: true,
    lockPath,
    reason: "active_lock",
    pid: payload.pid,
  };
}
