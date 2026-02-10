import { promises as fs } from "fs";
import path from "path";
import {
  CURRENT_SCHEMA_VERSION,
  createDataBackup,
  loadStateStrict,
  resolveDataPath,
  writeJsonAtomic,
  type LoadedData
} from "./persistence";
import { migratePersistedStateToCurrent } from "./migrations";
import { validatePersistedState } from "./validation";
import {
  importState,
  redactStateForExport,
  type ImportMode,
  type PortableExportPayload
} from "./portability";
import {
  isFlashMode,
  loadSettings,
  saveSettingsStrict,
  type TadoiSettings
} from "../settings/settings";
import { isThemeId } from "../theme/themes";

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export type BackupExportOptions = {
  outputPath?: string;
  outputDir?: string;
  filename?: string;
  pretty?: boolean;
  redact?: boolean;
  cwd?: string;
  now?: Date;
};

export type BackupExportResult = {
  outputPath: string;
  resolvedDataPath: string;
  schemaVersion: number;
  taskCount: number;
  bytesWritten?: number;
};

export type BackupImportOptions = {
  inputPath: string;
  mode: ImportMode;
  dryRun: boolean;
  backup?: boolean;
  cwd?: string;
  now?: number;
};

export type BackupImportSummary = {
  mode: ImportMode;
  dryRun: boolean;
  schemaVersion: number;
  resolvedDataPath: string;
  backupPath?: string;
  tasks: {
    added: number;
    updated: number;
    unchanged: number;
    removed: number;
  };
  conflictsResolvedByUpdatedAt: number;
  savedViews: {
    added: number;
    updated: number;
    unchanged: number;
  };
  settings: {
    includedInImport: boolean;
    applied: boolean;
    path?: string;
    error?: string;
  };
};

export class BackupImportPartialError extends Error {
  readonly summary: BackupImportSummary;

  constructor(message: string, summary: BackupImportSummary) {
    super(message);
    this.name = "BackupImportPartialError";
    this.summary = summary;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function resolvePathFromCwd(filePath: string, cwd = process.cwd()): string {
  if (path.isAbsolute(filePath)) return path.normalize(filePath);
  return path.resolve(cwd, filePath);
}

function toSingleLineDetail(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").trim();
}

function formatTimestamp(now: Date): string {
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function defaultBackupDir(dataPath: string): string {
  return path.join(path.dirname(dataPath), "backups");
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function withSchemaVersionZeroIfMissing(input: unknown): unknown {
  if (!isRecord(input)) return input;
  if (typeof input.schemaVersion === "number") return input;
  return {
    ...input,
    schemaVersion: 0
  };
}

function extractIncomingSettings(input: unknown): ParseResult<TadoiSettings | undefined> {
  if (!isRecord(input) || input.settings === undefined) {
    return { ok: true, value: undefined };
  }

  const settings = input.settings;
  if (!isRecord(settings)) {
    return { ok: false, error: "settings must be an object when present" };
  }

  const themeId = settings.themeId;
  if (!isThemeId(themeId)) {
    return { ok: false, error: "settings.themeId is invalid" };
  }

  const flashModeRaw = settings.flashMode;
  if (flashModeRaw !== undefined && !isFlashMode(flashModeRaw)) {
    return { ok: false, error: "settings.flashMode is invalid" };
  }

  return {
    ok: true,
    value: {
      themeId,
      flashMode: isFlashMode(flashModeRaw) ? flashModeRaw : "slow"
    }
  };
}

async function parseIncomingStateFromFile(inPath: string): Promise<{
  state: LoadedData;
  settings?: TadoiSettings;
}> {
  const raw = await fs.readFile(inPath, "utf8");
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error: unknown) {
    throw new Error(
      `Failed to parse import JSON at ${inPath}: ${toSingleLineDetail(error)}`
    );
  }

  const incomingSettingsResult = extractIncomingSettings(parsed);
  if (!incomingSettingsResult.ok) {
    throw new Error(`Invalid import settings payload: ${incomingSettingsResult.error}`);
  }

  const normalizedStateInput = withSchemaVersionZeroIfMissing(parsed);
  const preValidation = validatePersistedState(normalizedStateInput, "minimal");
  if (!preValidation.ok) {
    throw new Error(`Import minimal validation failed: ${preValidation.errors.join("; ")}`);
  }

  let migrated: LoadedData;
  try {
    migrated = migratePersistedStateToCurrent(preValidation.data, CURRENT_SCHEMA_VERSION);
  } catch (error: unknown) {
    throw new Error(`Import migration failed: ${toSingleLineDetail(error)}`);
  }

  const postValidation = validatePersistedState(migrated, "strict");
  if (!postValidation.ok) {
    throw new Error(`Import strict validation failed: ${postValidation.errors.join("; ")}`);
  }

  return {
    state: postValidation.data,
    settings: incomingSettingsResult.value
  };
}

export function getResolvedDataPath(): string {
  return resolveDataPath();
}

export async function buildTimestampedBackupPath(opts: {
  dataPath?: string;
  outputDir?: string;
  filename?: string;
  cwd?: string;
  now?: Date;
} = {}): Promise<string> {
  const cwd = opts.cwd ?? process.cwd();
  const now = opts.now ?? new Date();
  const dataPath = opts.dataPath ?? resolveDataPath();
  const outputDirRaw = opts.outputDir?.trim();
  const outputDir = outputDirRaw
    ? resolvePathFromCwd(outputDirRaw, cwd)
    : defaultBackupDir(dataPath);
  const filename =
    opts.filename?.trim() || `tadoi-backup-${formatTimestamp(now)}.json`;
  const parsed = path.parse(filename);

  let suffix = 0;
  while (true) {
    const base =
      suffix === 0 ? parsed.base : `${parsed.name}.${suffix}${parsed.ext}`;
    const candidate = path.join(outputDir, base);
    if (!(await pathExists(candidate))) {
      return path.normalize(candidate);
    }
    suffix += 1;
  }
}

export async function exportBackup(
  opts: BackupExportOptions = {}
): Promise<BackupExportResult> {
  const cwd = opts.cwd ?? process.cwd();
  const outputPathRaw = opts.outputPath?.trim();
  const outputPath = outputPathRaw
    ? resolvePathFromCwd(outputPathRaw, cwd)
    : await buildTimestampedBackupPath({
        outputDir: opts.outputDir,
        filename: opts.filename,
        cwd,
        now: opts.now
      });
  const resolvedDataPath = resolveDataPath();
  const stateResult = await loadStateStrict({ filePath: resolvedDataPath });
  const settingsResult = await loadSettings();

  const payload: PortableExportPayload = {
    schemaVersion: stateResult.data.schemaVersion,
    tasks: stateResult.data.tasks,
    tagIndex: stateResult.data.tagIndex,
    savedViews: stateResult.data.savedViews,
    settings: settingsResult.settings
  };

  const exportPayload = opts.redact ? redactStateForExport(payload) : payload;
  await writeJsonAtomic(exportPayload, {
    filePath: outputPath,
    pretty: opts.pretty === true
  });

  let bytesWritten: number | undefined;
  try {
    const stat = await fs.stat(outputPath);
    bytesWritten = stat.size;
  } catch {
    bytesWritten = undefined;
  }

  return {
    outputPath,
    resolvedDataPath,
    schemaVersion: exportPayload.schemaVersion,
    taskCount: exportPayload.tasks.length,
    bytesWritten
  };
}

export async function importBackup(
  opts: BackupImportOptions
): Promise<BackupImportSummary> {
  const cwd = opts.cwd ?? process.cwd();
  const inPath = resolvePathFromCwd(opts.inputPath, cwd);
  const resolvedDataPath = resolveDataPath();
  const backup = opts.backup !== false;

  const currentState = await loadStateStrict({ filePath: resolvedDataPath });
  const currentSettings = await loadSettings();
  const incoming = await parseIncomingStateFromFile(inPath);

  const importResult = importState(currentState.data, incoming.state, {
    mode: opts.mode,
    now: opts.now ?? Date.now()
  });

  const summary: BackupImportSummary = {
    mode: opts.mode,
    dryRun: opts.dryRun,
    schemaVersion: importResult.stats.schemaVersion,
    resolvedDataPath,
    tasks: importResult.stats.tasks,
    conflictsResolvedByUpdatedAt: importResult.stats.conflictsResolvedByUpdatedAt,
    savedViews: importResult.stats.savedViews,
    settings: {
      includedInImport: Boolean(incoming.settings),
      applied: false
    }
  };

  if (opts.dryRun) {
    return summary;
  }

  if (backup) {
    const backupPath = await createDataBackup(resolvedDataPath, {
      now: new Date()
    });
    if (backupPath) {
      summary.backupPath = backupPath;
    }
  }

  await writeJsonAtomic(importResult.nextState, {
    filePath: resolvedDataPath,
    pretty: true
  });

  if (!incoming.settings) {
    return summary;
  }

  try {
    const settingsWriteResult = await saveSettingsStrict(incoming.settings, {
      filePath: currentSettings.resolvedPath
    });
    summary.settings.applied = true;
    summary.settings.path = settingsWriteResult.resolvedPath;
    return summary;
  } catch (error: unknown) {
    summary.settings.error = toSingleLineDetail(error);
    throw new BackupImportPartialError(
      `Data import succeeded but settings apply failed: ${summary.settings.error}`,
      summary
    );
  }
}
