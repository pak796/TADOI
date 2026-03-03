import { promises as fs } from "fs";
import type { PersistenceFsOps } from "../state/persistence";
import { writeJsonAtomic } from "../state/persistence";
import {
  REMINDER_HELPER_STATE_TTL_MS,
  REMINDER_HELPER_STATE_VERSION,
  type ReminderHelperState
} from "./types";
import { getReminderStatePath } from "./paths";

const DEFAULT_FS_OPS: PersistenceFsOps = fs;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeIso(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return undefined;
  return new Date(parsed).toISOString();
}

function defaultState(nowMs = Date.now()): ReminderHelperState {
  return {
    version: REMINDER_HELPER_STATE_VERSION,
    updatedAt: new Date(nowMs).toISOString(),
    fired: {}
  };
}

function normalizeState(input: unknown, nowMs = Date.now()): ReminderHelperState {
  if (!isRecord(input)) {
    return defaultState(nowMs);
  }

  const firedRecord = isRecord(input.fired) ? input.fired : {};
  const fired: Record<string, string> = {};
  for (const [eventId, firedAt] of Object.entries(firedRecord)) {
    const normalized = normalizeIso(firedAt);
    if (!normalized) continue;
    if (eventId.trim().length === 0) continue;
    fired[eventId] = normalized;
  }

  return {
    version: REMINDER_HELPER_STATE_VERSION,
    updatedAt: normalizeIso(input.updatedAt) ?? new Date(nowMs).toISOString(),
    fired
  };
}

export async function loadReminderHelperState(options: {
  dataFilePath: string;
  fsOps?: PersistenceFsOps;
  nowMs?: number;
}): Promise<ReminderHelperState> {
  const fsOps = options.fsOps ?? DEFAULT_FS_OPS;
  const statePath = getReminderStatePath(options.dataFilePath);
  const nowMs = options.nowMs ?? Date.now();

  let raw = "";
  try {
    raw = await fsOps.readFile(statePath, "utf8");
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return defaultState(nowMs);
    }
    throw error;
  }

  try {
    return normalizeState(JSON.parse(raw), nowMs);
  } catch {
    return defaultState(nowMs);
  }
}

export function pruneReminderHelperState(
  state: ReminderHelperState,
  nowMs = Date.now(),
  ttlMs = REMINDER_HELPER_STATE_TTL_MS
): ReminderHelperState {
  const cutoffMs = nowMs - Math.max(0, Math.floor(ttlMs));
  const nextFired: Record<string, string> = {};
  for (const [eventId, firedAtIso] of Object.entries(state.fired)) {
    const firedAtMs = Date.parse(firedAtIso);
    if (!Number.isFinite(firedAtMs)) continue;
    if (firedAtMs < cutoffMs) continue;
    nextFired[eventId] = new Date(firedAtMs).toISOString();
  }

  return {
    version: REMINDER_HELPER_STATE_VERSION,
    updatedAt: new Date(nowMs).toISOString(),
    fired: nextFired
  };
}

export function markReminderEventFired(
  state: ReminderHelperState,
  eventId: string,
  firedAtIso: string,
  nowMs = Date.now()
): ReminderHelperState {
  if (eventId.trim().length === 0) {
    return pruneReminderHelperState(state, nowMs);
  }

  const normalizedFiredAt = normalizeIso(firedAtIso) ?? new Date(nowMs).toISOString();
  const nextState: ReminderHelperState = {
    version: REMINDER_HELPER_STATE_VERSION,
    updatedAt: new Date(nowMs).toISOString(),
    fired: {
      ...state.fired,
      [eventId]: normalizedFiredAt
    }
  };
  return pruneReminderHelperState(nextState, nowMs);
}

export function isReminderEventAlreadyFired(
  state: ReminderHelperState,
  eventId: string
): boolean {
  return typeof state.fired[eventId] === "string";
}

export function clearReminderEventFired(
  state: ReminderHelperState,
  eventId: string,
  nowMs = Date.now()
): ReminderHelperState {
  if (!(eventId in state.fired)) {
    return pruneReminderHelperState(state, nowMs);
  }
  const nextFired = { ...state.fired };
  delete nextFired[eventId];
  return pruneReminderHelperState(
    {
      version: REMINDER_HELPER_STATE_VERSION,
      updatedAt: new Date(nowMs).toISOString(),
      fired: nextFired
    },
    nowMs
  );
}

export async function saveReminderHelperState(options: {
  dataFilePath: string;
  state: ReminderHelperState;
  fsOps?: PersistenceFsOps;
  nowMs?: number;
}): Promise<void> {
  const nowMs = options.nowMs ?? Date.now();
  const normalized = pruneReminderHelperState(options.state, nowMs);
  await writeJsonAtomic(normalized, {
    filePath: getReminderStatePath(options.dataFilePath),
    fsOps: options.fsOps,
    pretty: true,
    fsyncBeforeRename: true
  });
}
