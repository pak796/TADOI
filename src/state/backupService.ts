import { promises as fs } from "fs";
import path from "path";
import {
  CURRENT_SCHEMA_VERSION,
  createDataBackup,
  loadStateStrict,
  resolveDataPath,
  saveStateAtomic,
  writeJsonAtomic,
  type LoadedData
} from "./persistence";
import {
  createDefaultLockPayload,
  getTadoiLockPath,
  isTadoiLockOwnedByProcess,
  removeTadoiLock,
  tryAcquireTadoiLock,
  TadoiLockBusyError
} from "./lockfile";
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
  warnings?: string[];
};

export type BackupFileInfo = {
  path: string;
  filename: string;
  mtimeMs: number;
  sizeBytes: number;
};

export class BackupImportPartialError extends Error {
  readonly summary: BackupImportSummary;

  constructor(message: string, summary: BackupImportSummary) {
    super(message);
    this.name = "BackupImportPartialError";
    this.summary = summary;
  }
}

export class BackupExportFilesystemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupExportFilesystemError";
  }
}

export class BackupImportUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupImportUsageError";
  }
}

export class BackupImportFilesystemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupImportFilesystemError";
  }
}

export const DEFAULT_MAX_IMPORT_BYTES_JSON = 25 * 1024 * 1024;
const BACKUP_FILE_NAME_PATTERN = /^tadoi-backup-\d{8}-\d{6}(?:\.\d+)?\.json$/i;

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

function buildStaleLockRecoveredWarning(event: {
  lockPath: string;
  archivedPath?: string;
}): string {
  const archivedSuffix = event.archivedPath
    ? ` (archived to ${event.archivedPath})`
    : "";
  return `Recovered stale lock from previous run at ${event.lockPath}${archivedSuffix}`;
}

async function withDataFileLock<T>(
  dataPath: string,
  task: () => Promise<T>,
  options: { warnings?: string[] } = {}
): Promise<T> {
  const lockPath = getTadoiLockPath(dataPath);
  const lockOwnedByCurrentProcess = await isTadoiLockOwnedByProcess(
    lockPath,
    process.pid,
    dataPath
  );
  if (lockOwnedByCurrentProcess) {
    return task();
  }

  const lockAcquired = await tryAcquireTadoiLock(lockPath, createDefaultLockPayload(dataPath), {
    onStaleLockRecovered: (event) => {
      const warning = buildStaleLockRecoveredWarning(event);
      options.warnings?.push(warning);
    }
  });
  if (!lockAcquired) {
    throw new TadoiLockBusyError(lockPath);
  }
  try {
    return await task();
  } finally {
    if (lockAcquired) {
      await removeTadoiLock(lockPath);
    }
  }
}

function isRecognizedBackupFilename(filename: string): boolean {
  return BACKUP_FILE_NAME_PATTERN.test(filename);
}

export function getDefaultBackupDir(dataPath = resolveDataPath()): string {
  return path.join(path.dirname(dataPath), "backups");
}

export async function ensureDefaultBackupDirExists(
  dataPath = resolveDataPath()
): Promise<string> {
  const backupDir = getDefaultBackupDir(dataPath);
  await fs.mkdir(backupDir, { recursive: true });
  return backupDir;
}

export async function listBackupFiles(options: {
  dataPath?: string;
  dirPath?: string;
  cwd?: string;
} = {}): Promise<BackupFileInfo[]> {
  const cwd = options.cwd ?? process.cwd();
  const dirPathRaw = options.dirPath?.trim();
  const backupDir = dirPathRaw
    ? resolvePathFromCwd(dirPathRaw, cwd)
    : getDefaultBackupDir(options.dataPath);

  await fs.mkdir(backupDir, { recursive: true });
  const entries = await fs.readdir(backupDir, { withFileTypes: true });
  const fileInfos = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && isRecognizedBackupFilename(entry.name))
      .map(async (entry): Promise<BackupFileInfo | undefined> => {
        const fullPath = path.normalize(path.join(backupDir, entry.name));
        try {
          const stat = await fs.stat(fullPath);
          return {
            path: fullPath,
            filename: entry.name,
            mtimeMs: stat.mtimeMs,
            sizeBytes: stat.size
          };
        } catch {
          return undefined;
        }
      })
  );

  return fileInfos
    .filter((entry): entry is BackupFileInfo => entry !== undefined)
    .sort(
      (left, right) =>
        right.mtimeMs - left.mtimeMs || left.filename.localeCompare(right.filename)
    );
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

function parseOptionalTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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

  const githubBackupRaw = settings.githubBackup;
  if (githubBackupRaw !== undefined && !isRecord(githubBackupRaw)) {
    return { ok: false, error: "settings.githubBackup must be an object when present" };
  }
  const githubBackupRecord = githubBackupRaw as Record<string, unknown> | undefined;
  const githubDefaults = defaultSettings.githubBackup;

  const githubEnabledRaw = githubBackupRecord?.enabled;
  if (githubEnabledRaw !== undefined && typeof githubEnabledRaw !== "boolean") {
    return { ok: false, error: "settings.githubBackup.enabled is invalid" };
  }
  const ownerRepoRaw = githubBackupRecord?.ownerRepo;
  if (
    ownerRepoRaw !== undefined &&
    ownerRepoRaw !== null &&
    typeof ownerRepoRaw !== "string"
  ) {
    return { ok: false, error: "settings.githubBackup.ownerRepo is invalid" };
  }
  const branchRaw = githubBackupRecord?.branch;
  if (branchRaw !== undefined && typeof branchRaw !== "string") {
    return { ok: false, error: "settings.githubBackup.branch is invalid" };
  }
  const deviceIdRaw = githubBackupRecord?.deviceId;
  if (deviceIdRaw !== undefined && typeof deviceIdRaw !== "string") {
    return { ok: false, error: "settings.githubBackup.deviceId is invalid" };
  }
  const pathPrefixRaw = githubBackupRecord?.pathPrefix;
  if (pathPrefixRaw !== undefined && typeof pathPrefixRaw !== "string") {
    return { ok: false, error: "settings.githubBackup.pathPrefix is invalid" };
  }
  const autoPushPolicyRaw = githubBackupRecord?.autoPushPolicy;
  if (
    autoPushPolicyRaw !== undefined &&
    autoPushPolicyRaw !== "off" &&
    autoPushPolicyRaw !== "onExit" &&
    autoPushPolicyRaw !== "interval15m"
  ) {
    return { ok: false, error: "settings.githubBackup.autoPushPolicy is invalid" };
  }
  const lastPushedRaw = githubBackupRecord?.lastPushed;
  if (lastPushedRaw !== undefined && !isRecord(lastPushedRaw)) {
    return { ok: false, error: "settings.githubBackup.lastPushed must be an object when present" };
  }
  const stateRevisionRaw = (lastPushedRaw as Record<string, unknown> | undefined)?.stateRevision;
  if (
    stateRevisionRaw !== undefined &&
    (typeof stateRevisionRaw !== "number" ||
      !Number.isFinite(stateRevisionRaw) ||
      !Number.isInteger(stateRevisionRaw) ||
      stateRevisionRaw < 0)
  ) {
    return { ok: false, error: "settings.githubBackup.lastPushed.stateRevision is invalid" };
  }
  const settingsHashRaw = (lastPushedRaw as Record<string, unknown> | undefined)?.settingsHash;
  if (settingsHashRaw !== undefined && typeof settingsHashRaw !== "string") {
    return { ok: false, error: "settings.githubBackup.lastPushed.settingsHash is invalid" };
  }
  const timestampRaw = (lastPushedRaw as Record<string, unknown> | undefined)?.timestamp;
  if (timestampRaw !== undefined && typeof timestampRaw !== "string") {
    return { ok: false, error: "settings.githubBackup.lastPushed.timestamp is invalid" };
  }
  const remoteCommitShaRaw =
    (lastPushedRaw as Record<string, unknown> | undefined)?.remoteCommitSha;
  if (remoteCommitShaRaw !== undefined && typeof remoteCommitShaRaw !== "string") {
    return {
      ok: false,
      error: "settings.githubBackup.lastPushed.remoteCommitSha is invalid"
    };
  }

  const githubBackup =
    githubBackupRecord && githubDefaults
      ? (() => {
          const ownerRepo =
            ownerRepoRaw === null ? null : parseOptionalTrimmedString(ownerRepoRaw) ?? null;
          const branch = parseOptionalTrimmedString(branchRaw) ?? githubDefaults.branch;
          const deviceId = parseOptionalTrimmedString(deviceIdRaw) ?? githubDefaults.deviceId;
          const pathPrefix =
            parseOptionalTrimmedString(pathPrefixRaw) ??
            `tadoi/devices/${deviceId}`;
          const normalized = {
            enabled: githubEnabledRaw === true,
            ownerRepo,
            branch,
            deviceId,
            pathPrefix,
            autoPushPolicy:
              autoPushPolicyRaw === "onExit" || autoPushPolicyRaw === "interval15m"
                ? autoPushPolicyRaw
                : "off"
          } as NonNullable<TadoiSettings["githubBackup"]>;

          const nextLastPushed: NonNullable<TadoiSettings["githubBackup"]>["lastPushed"] = {};
          if (typeof stateRevisionRaw === "number") {
            nextLastPushed.stateRevision = Math.floor(stateRevisionRaw);
          }
          const settingsHash = parseOptionalTrimmedString(settingsHashRaw);
          if (settingsHash) {
            nextLastPushed.settingsHash = settingsHash;
          }
          const timestamp = parseOptionalTrimmedString(timestampRaw);
          if (timestamp) {
            nextLastPushed.timestamp = timestamp;
          }
          const remoteCommitSha = parseOptionalTrimmedString(remoteCommitShaRaw);
          if (remoteCommitSha) {
            nextLastPushed.remoteCommitSha = remoteCommitSha;
          }
          if (Object.keys(nextLastPushed).length > 0) {
            normalized.lastPushed = nextLastPushed;
          }
          return normalized;
        })()
      : githubDefaults;

  const notesRaw = settings.notes;
  if (notesRaw !== undefined && !isRecord(notesRaw)) {
    return { ok: false, error: "settings.notes must be an object when present" };
  }
  const notesRecord = notesRaw as Record<string, unknown> | undefined;
  const notesEnabledRaw = notesRecord?.enabled;
  if (notesEnabledRaw !== undefined && typeof notesEnabledRaw !== "boolean") {
    return { ok: false, error: "settings.notes.enabled is invalid" };
  }
  const notesRootPathRaw = notesRecord?.rootPath;
  if (
    notesRootPathRaw !== undefined &&
    notesRootPathRaw !== null &&
    typeof notesRootPathRaw !== "string"
  ) {
    return { ok: false, error: "settings.notes.rootPath is invalid" };
  }
  const defaultNotes = defaultSettings.notes ?? { enabled: true, rootPath: null };
  const notesRootPath =
    typeof notesRootPathRaw === "string"
      ? (() => {
          const trimmed = notesRootPathRaw.trim();
          return trimmed.length > 0 ? trimmed : null;
        })()
      : notesRootPathRaw === null
        ? null
        : defaultNotes.rootPath;

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
          : (customThemesRaw as TadoiSettings["customThemes"]),
      githubBackup,
      notes: {
        enabled:
          typeof notesEnabledRaw === "boolean" ? notesEnabledRaw : defaultNotes.enabled,
        rootPath: notesRootPath
      }
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
  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stat = await fs.stat(inPath);
  } catch (error: unknown) {
    throw new BackupImportFilesystemError(
      `Failed to access import file at ${inPath}: ${toSingleLineDetail(error)}`
    );
  }
  if (stat.size > maxImportBytes) {
    throw new BackupImportUsageError(
      `Import file exceeds maximum size (${String(stat.size)} bytes > ${String(maxImportBytes)} bytes): ${inPath}`
    );
  }

  let raw = "";
  try {
    raw = await fs.readFile(inPath, "utf8");
  } catch (error: unknown) {
    throw new BackupImportFilesystemError(
      `Failed to read import file at ${inPath}: ${toSingleLineDetail(error)}`
    );
  }
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error: unknown) {
    throw new BackupImportUsageError(
      `Failed to parse import JSON at ${inPath}: ${toSingleLineDetail(error)}`
    );
  }

  const incomingSettingsResult = extractIncomingSettings(parsed);
  if (!incomingSettingsResult.ok) {
    throw new BackupImportUsageError(
      `Invalid import settings payload: ${incomingSettingsResult.error}`
    );
  }

  const normalizedStateInput = withSchemaVersionZeroIfMissing(parsed);
  const preValidation = validatePersistedState(normalizedStateInput, "minimal");
  if (!preValidation.ok) {
    throw new BackupImportUsageError(
      `Import minimal validation failed: ${preValidation.errors.join("; ")}`
    );
  }

  let migrated: LoadedData;
  try {
    migrated = migratePersistedStateToCurrent(preValidation.data, CURRENT_SCHEMA_VERSION);
  } catch (error: unknown) {
    throw new BackupImportUsageError(`Import migration failed: ${toSingleLineDetail(error)}`);
  }

  const postValidation = validatePersistedState(migrated, "strict");
  if (!postValidation.ok) {
    throw new BackupImportUsageError(
      `Import strict validation failed: ${postValidation.errors.join("; ")}`
    );
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
    : getDefaultBackupDir(dataPath);
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
  try {
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
      engagement: stateResult.data.engagement,
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
  } catch (error: unknown) {
    if (error instanceof BackupExportFilesystemError) {
      throw error;
    }
    throw new BackupExportFilesystemError(toSingleLineDetail(error));
  }
}

export async function importBackup(
  opts: BackupImportOptions
): Promise<BackupImportSummary> {
  const cwd = opts.cwd ?? process.cwd();
  const inPath = resolvePathFromCwd(opts.inputPath, cwd);
  const resolvedDataPath = resolveDataPath();
  const backup = opts.backup !== false;
  const maxImportBytes =
    typeof opts.maxImportBytesJson === "number" &&
    Number.isFinite(opts.maxImportBytesJson) &&
    opts.maxImportBytesJson > 0
      ? Math.floor(opts.maxImportBytesJson)
      : DEFAULT_MAX_IMPORT_BYTES_JSON;

  const incoming = await parseIncomingStateFromFile(inPath, maxImportBytes);
  const lockWarnings: string[] = [];
  const executeImport = async (): Promise<BackupImportSummary> => {
    let currentState: Awaited<ReturnType<typeof loadStateStrict>>;
    let currentSettings: Awaited<ReturnType<typeof loadSettings>>;
    try {
      currentState = await loadStateStrict({ filePath: resolvedDataPath });
      currentSettings = await loadSettings();
    } catch (error: unknown) {
      throw new BackupImportFilesystemError(toSingleLineDetail(error));
    }

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
      },
      ...(lockWarnings.length > 0 ? { warnings: [...lockWarnings] } : {})
    };

    if (opts.dryRun) {
      return summary;
    }

    if (backup) {
      let backupPath: string | undefined;
      try {
        backupPath = await createDataBackup(resolvedDataPath, {
          now: new Date()
        });
      } catch (error: unknown) {
        throw new BackupImportFilesystemError(toSingleLineDetail(error));
      }
      if (backupPath) {
        summary.backupPath = backupPath;
      }
    }

    try {
      await saveStateAtomic(
        {
          ...importResult.nextState,
          stateRevision: currentState.data.stateRevision
        },
        resolvedDataPath,
        undefined,
        {
          expectedStateRevision: currentState.data.stateRevision
        }
      );
    } catch (error: unknown) {
      throw new BackupImportFilesystemError(toSingleLineDetail(error));
    }

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
  };

  if (opts.dryRun) {
    try {
      return await executeImport();
    } catch (error: unknown) {
      if (
        error instanceof TadoiLockBusyError ||
        error instanceof BackupImportUsageError ||
        error instanceof BackupImportFilesystemError ||
        error instanceof BackupImportPartialError
      ) {
        throw error;
      }
      throw new BackupImportFilesystemError(toSingleLineDetail(error));
    }
  }
  try {
    return await withDataFileLock(resolvedDataPath, executeImport, {
      warnings: lockWarnings
    });
  } catch (error: unknown) {
    if (
      error instanceof TadoiLockBusyError ||
      error instanceof BackupImportUsageError ||
      error instanceof BackupImportFilesystemError ||
      error instanceof BackupImportPartialError
    ) {
      throw error;
    }
    throw new BackupImportFilesystemError(toSingleLineDetail(error));
  }
}
