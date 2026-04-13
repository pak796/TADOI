import { createDefaultEngagementState } from "../../domain/engagement";
import { normalizePriorityTags } from "../../domain/priorityTags";
import { normalizeTagAliases } from "../../domain/tagAliases";
import { migratePersistedStateToCurrent } from "../migrations";
import { recomputeTagIndex } from "../portability";
import { validatePersistedState } from "../validation";
import { backupCorruptFile } from "./backup";
import { resolveDataPath } from "./paths";
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_FS_OPS,
  type LoadedData,
  type SafeLoadOptions,
  type SafeLoadResult,
  type StrictLoadOptions,
  type StrictLoadResult,
} from "./types";

const TAG_NORMALIZATION_VALIDATION_FRAGMENT =
  "task.tags must be normalized/deduped";
const corruptionRecoveryByPath = new Map<string, string | undefined>();

function emptyData(): LoadedData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    stateRevision: 0,
    tasks: [],
    tagIndex: {},
    tagAliases: {},
    savedViews: [],
    engagement: createDefaultEngagementState(),
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

function isTagNormalizationOnlyValidationErrors(errors: string[]): boolean {
  return (
    errors.length > 0 &&
    errors.every((error) =>
      error.includes(TAG_NORMALIZATION_VALIDATION_FRAGMENT),
    )
  );
}

function repairTaskTagNormalization(data: LoadedData): LoadedData {
  const tasks = data.tasks.map((task) => ({
    ...task,
    tags: normalizePriorityTags(Array.isArray(task.tags) ? task.tags : []),
  }));
  return {
    ...data,
    tasks,
    tagIndex: recomputeTagIndex(tasks),
    tagAliases: normalizeTagAliases(data.tagAliases),
  };
}

function validateStrictWithOptionalTagRepair(
  data: LoadedData,
  allowTagNormalizationRepair: boolean,
):
  | { ok: true; data: LoadedData; repairedIssueCount: number }
  | { ok: false; errors: string[] } {
  const strictValidation = validatePersistedState(data, "strict");
  if (strictValidation.ok) {
    return {
      ok: true,
      data: strictValidation.data,
      repairedIssueCount: 0,
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
    repairedIssueCount: strictValidation.errors.length,
  };
}

async function recoverFromCorruption(
  filePath: string,
  now: Date,
  fsOps: SafeLoadOptions["fsOps"] extends infer T
    ? NonNullable<T>
    : never,
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
      didMigrate: false,
    };
  }

  const backupPath = await backupCorruptFile(filePath, now, fsOps);
  corruptionRecoveryByPath.set(filePath, backupPath);
  const backupName = backupPath
    ? path.basename(backupPath)
    : "backup-unavailable";
  return {
    data: emptyData(),
    resolvedPath: filePath,
    bannerMessage: `Data file was corrupt and was backed up to ${backupName}`,
    corruptBackupPath: backupPath,
    shouldPersistRecoveredState: true,
    didMigrate: false,
  };
}

import path from "path";

export async function safeLoadState(
  options: SafeLoadOptions = {},
): Promise<SafeLoadResult> {
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
        didMigrate: false,
      };
    }
    return {
      data: emptyData(),
      resolvedPath: filePath,
      bannerMessage:
        `Unable to read data file (${formatReadErrorForBanner(error)}). ` +
        "Existing file was not modified.",
      shouldPersistRecoveredState: false,
      didMigrate: false,
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
      CURRENT_SCHEMA_VERSION,
    );
    const strictValidation = validateStrictWithOptionalTagRepair(
      migrated,
      true,
    );
    if (!strictValidation.ok) {
      return recoverFromCorruption(filePath, now, fsOps);
    }
    const repairedTagIssues = strictValidation.repairedIssueCount;
    return {
      data: strictValidation.data,
      resolvedPath: filePath,
      ...(repairedTagIssues > 0
        ? {
            bannerMessage: `Recovered ${String(repairedTagIssues)} legacy task tag normalization issue(s).`,
          }
        : {}),
      shouldPersistRecoveredState: false,
      didMigrate:
        preValidation.data.schemaVersion !==
          strictValidation.data.schemaVersion || repairedTagIssues > 0,
    };
  } catch {
    return recoverFromCorruption(filePath, now, fsOps);
  }
}

export async function loadState(): Promise<LoadedData> {
  const result = await safeLoadState();
  return result.data;
}

export async function loadStateStrict(
  options: StrictLoadOptions = {},
): Promise<StrictLoadResult> {
  const filePath = options.filePath ?? resolveDefaultDataFilePath();
  const fsOps = options.fsOps ?? DEFAULT_FS_OPS;
  const allowTagNormalizationRepair =
    options.allowTagNormalizationRepair !== false;
  let raw = "";

  try {
    raw = await fsOps.readFile(filePath, "utf8");
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return {
        data: emptyData(),
        resolvedPath: filePath,
        didMigrate: false,
      };
    }
    throw new Error(
      `Failed to read data file at ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error: unknown) {
    throw new Error(
      `Failed to parse JSON at ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const preValidation = validatePersistedState(parsed, "minimal");
  if (!preValidation.ok) {
    throw new Error(
      `Minimal validation failed for ${filePath}: ${preValidation.errors.join("; ")}`,
    );
  }

  let migrated: LoadedData;
  try {
    migrated = migratePersistedStateToCurrent(
      preValidation.data,
      CURRENT_SCHEMA_VERSION,
    );
  } catch (error: unknown) {
    throw new Error(
      `Migration failed for ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const strictValidation = validateStrictWithOptionalTagRepair(
    migrated,
    allowTagNormalizationRepair,
  );
  if (!strictValidation.ok) {
    throw new Error(
      `Strict validation failed for ${filePath}: ${strictValidation.errors.join("; ")}`,
    );
  }

  return {
    data: strictValidation.data,
    resolvedPath: filePath,
    didMigrate:
      preValidation.data.schemaVersion !==
        strictValidation.data.schemaVersion ||
      strictValidation.repairedIssueCount > 0,
  };
}
