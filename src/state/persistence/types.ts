import { promises as fs } from "fs";
import type {
  EngagementState,
  SavedView,
  TagIndexEntry,
  Task,
} from "../../domain/models";

export type LoadedData = {
  schemaVersion: number;
  stateRevision?: number;
  tasks: Task[];
  tagIndex: Record<string, TagIndexEntry>;
  tagAliases?: Record<string, string>;
  savedViews: SavedView[];
  engagement?: EngagementState;
};

export type ResolveDataPathOptions = {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  homeDir?: string;
};

export type PersistenceFsOps = Pick<
  typeof fs,
  | "access"
  | "copyFile"
  | "mkdir"
  | "readFile"
  | "readdir"
  | "rename"
  | "stat"
  | "open"
  | "unlink"
  | "writeFile"
>;

export type SafeLoadOptions = {
  filePath?: string;
  now?: Date;
  fsOps?: PersistenceFsOps;
};

export type SafeLoadResult = {
  data: LoadedData;
  resolvedPath: string;
  bannerMessage?: string;
  corruptBackupPath?: string;
  shouldPersistRecoveredState: boolean;
  didMigrate: boolean;
};

export type SaveStateResult =
  | {
      ok: true;
      filePath: string;
      savedAt: number;
      lastSuccessfulSaveAt: number;
      stateRevision: number;
    }
  | {
      ok: false;
      filePath: string;
      error: Error;
      lastSuccessfulSaveAt?: number;
      expectedStateRevision?: number;
      actualStateRevision?: number;
      isRevisionConflict?: boolean;
    };

export type SaveStateResultCallback = (result: SaveStateResult) => void;

export type StrictLoadOptions = {
  filePath?: string;
  fsOps?: PersistenceFsOps;
  allowTagNormalizationRepair?: boolean;
};

export type StrictLoadResult = {
  data: LoadedData;
  resolvedPath: string;
  didMigrate: boolean;
};

export type WriteJsonAtomicOptions = {
  filePath?: string;
  fsOps?: PersistenceFsOps;
  pretty?: boolean;
  fsyncBeforeRename?: boolean;
};

export type CreateDataBackupOptions = {
  now?: Date;
  fsOps?: PersistenceFsOps;
};

export type SaveStateAtomicOptions = {
  expectedStateRevision?: number;
};

export type SaveStateDebouncedOptions = SaveStateAtomicOptions;

export class StateRevisionConflictError extends Error {
  readonly filePath: string;
  readonly expectedRevision: number;
  readonly actualRevision: number;

  constructor(
    filePath: string,
    expectedRevision: number,
    actualRevision: number,
  ) {
    super(
      `State revision conflict at ${filePath}: expected ${String(expectedRevision)} but found ${String(actualRevision)}`,
    );
    this.name = "StateRevisionConflictError";
    this.filePath = filePath;
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

export const DEFAULT_FS_OPS: PersistenceFsOps = fs;
export const CURRENT_SCHEMA_VERSION = 8;
