import {
  StateRevisionConflictError,
  type LoadedData,
  type SaveStateAtomicOptions
} from "../state/persistence";

export type SaveConflictRetrySnapshot = Pick<
  LoadedData,
  "schemaVersion" | "tasks" | "tagIndex" | "savedViews" | "engagement"
>;

export type SaveConflictRetryDeps = {
  loadLatest: (filePath: string) => Promise<{ stateRevision?: number }>;
  saveAtomic: (
    data: LoadedData,
    filePath: string,
    options: SaveStateAtomicOptions
  ) => Promise<number>;
};

export type SaveConflictRetryResult =
  | {
      ok: true;
      filePath: string;
      stateRevision: number;
    }
  | {
      ok: false;
      kind: "conflict";
      filePath: string;
      expectedStateRevision: number;
      actualStateRevision: number;
    }
  | {
      ok: false;
      kind: "error";
      filePath: string;
      error: Error;
    };

export function normalizeStateRevision(value: unknown): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  ) {
    return value;
  }
  return 0;
}

export async function retrySaveAfterConflictReload(params: {
  snapshot: SaveConflictRetrySnapshot;
  filePath: string;
  deps: SaveConflictRetryDeps;
}): Promise<SaveConflictRetryResult> {
  const latest = await params.deps.loadLatest(params.filePath);
  const expectedStateRevision = normalizeStateRevision(latest.stateRevision);

  try {
    const stateRevision = await params.deps.saveAtomic(
      params.snapshot as LoadedData,
      params.filePath,
      { expectedStateRevision }
    );
    return {
      ok: true,
      filePath: params.filePath,
      stateRevision
    };
  } catch (error: unknown) {
    if (error instanceof StateRevisionConflictError) {
      return {
        ok: false,
        kind: "conflict",
        filePath: params.filePath,
        expectedStateRevision: error.expectedRevision,
        actualStateRevision: error.actualRevision
      };
    }
    return {
      ok: false,
      kind: "error",
      filePath: params.filePath,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}
