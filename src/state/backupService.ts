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
  type RedactMode,
  type PortableExportPayload
} from "./portability";
import {
  getDefaultSettings,
  isFlashMode,
  isLogoMode,
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
  redactMode?: RedactMode;
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
  maxImportBytesJson?: number;
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

export const DEFAULT_MAX_IMPORT_BYTES_JSON = 25 * 1024 * 1024;

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

function parsePositiveMsSetting(
  value: unknown,
  label: string,
  fallback: number
): ParseResult<number> {
  if (value === undefined) {
    return { ok: true, value: fallback };
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return { ok: false, error: `${label} must be a positive number when present` };
  }
  return { ok: true, value: Math.floor(value) };
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
  const logoModeRaw = settings.logoMode;
  if (logoModeRaw !== undefined && !isLogoMode(logoModeRaw)) {
    return { ok: false, error: "settings.logoMode is invalid" };
  }
  const customThemesRaw = settings.customThemes;
  if (customThemesRaw !== undefined && !isRecord(customThemesRaw)) {
    return { ok: false, error: "settings.customThemes must be an object when present" };
  }

  const defaultSettings = getDefaultSettings();
  const defaultNotifications = defaultSettings.notifications;
  const defaultSecurity = defaultSettings.security;
  const notificationsRaw = settings.notifications;
  if (notificationsRaw !== undefined && !isRecord(notificationsRaw)) {
    return { ok: false, error: "settings.notifications must be an object when present" };
  }
  const notificationsRecord = notificationsRaw as Record<string, unknown> | undefined;

  const enabledRaw = notificationsRecord?.enabled;
  if (enabledRaw !== undefined && typeof enabledRaw !== "boolean") {
    return { ok: false, error: "settings.notifications.enabled is invalid" };
  }
  const inAppRaw = notificationsRecord?.inAppOverdueBanner;
  if (inAppRaw !== undefined && typeof inAppRaw !== "boolean") {
    return { ok: false, error: "settings.notifications.inAppOverdueBanner is invalid" };
  }
  const bellRaw = notificationsRecord?.terminalBellOnOverdue;
  if (bellRaw !== undefined && typeof bellRaw !== "boolean") {
    return {
      ok: false,
      error: "settings.notifications.terminalBellOnOverdue is invalid"
    };
  }

  const bannerDurationResult = parsePositiveMsSetting(
    notificationsRecord?.bannerDurationMs,
    "settings.notifications.bannerDurationMs",
    defaultNotifications.bannerDurationMs
  );
  if (!bannerDurationResult.ok) {
    return bannerDurationResult;
  }

  const bellCooldownResult = parsePositiveMsSetting(
    notificationsRecord?.bellCooldownMs,
    "settings.notifications.bellCooldownMs",
    defaultNotifications.bellCooldownMs
  );
  if (!bellCooldownResult.ok) {
    return bellCooldownResult;
  }

  const securityRaw = settings.security;
  if (securityRaw !== undefined && !isRecord(securityRaw)) {
    return { ok: false, error: "settings.security must be an object when present" };
  }
  const nonHttpLinkPolicyRaw = (securityRaw as Record<string, unknown> | undefined)
    ?.nonHttpLinkPolicy;
  if (
    nonHttpLinkPolicyRaw !== undefined &&
    nonHttpLinkPolicyRaw !== "prompt" &&
    nonHttpLinkPolicyRaw !== "block"
  ) {
    return {
      ok: false,
      error: "settings.security.nonHttpLinkPolicy is invalid"
    };
  }

  return {
    ok: true,
    value: {
      themeId,
      logoMode: isLogoMode(logoModeRaw) ? logoModeRaw : defaultSettings.logoMode,
      flashMode: isFlashMode(flashModeRaw) ? flashModeRaw : "slow",
      notifications: {
        enabled:
          typeof enabledRaw === "boolean" ? enabledRaw : defaultNotifications.enabled,
        inAppOverdueBanner:
          typeof inAppRaw === "boolean"
            ? inAppRaw
            : defaultNotifications.inAppOverdueBanner,
        terminalBellOnOverdue:
          typeof bellRaw === "boolean"
            ? bellRaw
            : defaultNotifications.terminalBellOnOverdue,
        bannerDurationMs: bannerDurationResult.value,
        bellCooldownMs: bellCooldownResult.value
      },
      security: {
        nonHttpLinkPolicy:
          nonHttpLinkPolicyRaw === "block"
            ? "block"
            : defaultSecurity.nonHttpLinkPolicy
      },
      customThemes:
        customThemesRaw === undefined
          ? undefined
          : (customThemesRaw as TadoiSettings["customThemes"])
    }
  };
}

async function parseIncomingStateFromFile(
  inPath: string,
  maxImportBytes = DEFAULT_MAX_IMPORT_BYTES_JSON
): Promise<{
  state: LoadedData;
  settings?: TadoiSettings;
}> {
  const stat = await fs.stat(inPath);
  if (stat.size > maxImportBytes) {
    throw new Error(
      `Import file exceeds maximum size (${String(stat.size)} bytes > ${String(maxImportBytes)} bytes): ${inPath}`
    );
  }

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

  const redactMode = opts.redactMode ?? (opts.redact ? "strict" : undefined);
  const exportPayload = redactMode ? redactStateForExport(payload, redactMode) : payload;
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
  const maxImportBytes =
    typeof opts.maxImportBytesJson === "number" &&
    Number.isFinite(opts.maxImportBytesJson) &&
    opts.maxImportBytesJson > 0
      ? Math.floor(opts.maxImportBytesJson)
      : DEFAULT_MAX_IMPORT_BYTES_JSON;

  const incoming = await parseIncomingStateFromFile(inPath, maxImportBytes);

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
