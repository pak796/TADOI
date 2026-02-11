import os from "os";
import { promises as fs } from "fs";
import path from "path";
import { ThemeId, isThemeId } from "../theme/themes";
import {
  SETTINGS_DIR_NAME,
  SETTINGS_FALLBACK_DIR_NAME,
  SETTINGS_FILE_NAME
} from "../brand/brand";

export type TadoiSettings = {
  themeId: ThemeId;
  flashMode: FlashMode;
  notifications: NotificationSettings;
};

export type FlashMode = "slow" | "static";

export type NotificationSettings = {
  enabled: boolean;
  inAppOverdueBanner: boolean;
  terminalBellOnOverdue: boolean;
  bannerDurationMs: number;
  bellCooldownMs: number;
};

export type SettingsFsOps = Pick<typeof fs, "mkdir" | "readFile" | "writeFile">;

export type ResolveSettingsPathOptions = {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
};

export type LoadSettingsOptions = ResolveSettingsPathOptions & {
  fsOps?: SettingsFsOps;
};

export type SaveSettingsOptions = ResolveSettingsPathOptions & {
  fsOps?: SettingsFsOps;
  filePath?: string;
};

export type LoadSettingsResult = {
  settings: TadoiSettings;
  resolvedPath: string;
};

export type SaveSettingsStrictResult = {
  resolvedPath: string;
  usedFallback: boolean;
};

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  inAppOverdueBanner: true,
  terminalBellOnOverdue: false,
  bannerDurationMs: 5000,
  bellCooldownMs: 2000
};

const DEFAULT_SETTINGS: TadoiSettings = {
  themeId: "default",
  flashMode: "slow",
  notifications: DEFAULT_NOTIFICATION_SETTINGS
};

const DEFAULT_DEBOUNCE_MS = 150;
const DEFAULT_FS_OPS: SettingsFsOps = fs;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastResolvedPath: string | null = null;

function pathApiForPlatform(platform: NodeJS.Platform): typeof path.posix | typeof path.win32 {
  return platform === "win32" ? path.win32 : path.posix;
}

export function resolveSettingsPaths(
  options: ResolveSettingsPathOptions = {}
): { primary: string; fallback: string } {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const homeDir = options.homeDir ?? env.HOME ?? env.USERPROFILE ?? os.homedir();
  const pathApi = pathApiForPlatform(platform);

  return {
    primary: pathApi.join(homeDir, ".config", SETTINGS_DIR_NAME, SETTINGS_FILE_NAME),
    fallback: pathApi.join(homeDir, SETTINGS_FALLBACK_DIR_NAME, SETTINGS_FILE_NAME)
  };
}

export function isFlashMode(value: unknown): value is FlashMode {
  return value === "slow" || value === "static";
}

function normalizePositiveMs(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  if (value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

function normalizeNotifications(input: unknown): NotificationSettings {
  if (typeof input !== "object" || input === null) {
    return { ...DEFAULT_NOTIFICATION_SETTINGS };
  }

  const maybeEnabled = (input as { enabled?: unknown }).enabled;
  const maybeInAppOverdueBanner = (input as { inAppOverdueBanner?: unknown }).inAppOverdueBanner;
  const maybeTerminalBellOnOverdue =
    (input as { terminalBellOnOverdue?: unknown }).terminalBellOnOverdue;
  const maybeBannerDurationMs =
    (input as { bannerDurationMs?: unknown }).bannerDurationMs;
  const maybeBellCooldownMs =
    (input as { bellCooldownMs?: unknown }).bellCooldownMs;

  return {
    enabled:
      typeof maybeEnabled === "boolean"
        ? maybeEnabled
        : DEFAULT_NOTIFICATION_SETTINGS.enabled,
    inAppOverdueBanner:
      typeof maybeInAppOverdueBanner === "boolean"
        ? maybeInAppOverdueBanner
        : DEFAULT_NOTIFICATION_SETTINGS.inAppOverdueBanner,
    terminalBellOnOverdue:
      typeof maybeTerminalBellOnOverdue === "boolean"
        ? maybeTerminalBellOnOverdue
        : DEFAULT_NOTIFICATION_SETTINGS.terminalBellOnOverdue,
    bannerDurationMs: normalizePositiveMs(
      maybeBannerDurationMs,
      DEFAULT_NOTIFICATION_SETTINGS.bannerDurationMs
    ),
    bellCooldownMs: normalizePositiveMs(
      maybeBellCooldownMs,
      DEFAULT_NOTIFICATION_SETTINGS.bellCooldownMs
    )
  };
}

function normalizeSettings(input: unknown): TadoiSettings {
  if (typeof input !== "object" || input === null) {
    return {
      ...DEFAULT_SETTINGS,
      notifications: { ...DEFAULT_NOTIFICATION_SETTINGS }
    };
  }
  const maybeThemeId = (input as { themeId?: unknown }).themeId;
  const maybeFlashMode = (input as { flashMode?: unknown }).flashMode;
  const maybeNotifications = (input as { notifications?: unknown }).notifications;
  return {
    themeId: isThemeId(maybeThemeId) ? maybeThemeId : DEFAULT_SETTINGS.themeId,
    flashMode: isFlashMode(maybeFlashMode) ? maybeFlashMode : DEFAULT_SETTINGS.flashMode,
    notifications: normalizeNotifications(maybeNotifications)
  };
}

async function readSettingsFile(
  filePath: string,
  fsOps: SettingsFsOps
): Promise<TadoiSettings | null> {
  try {
    const raw = await fsOps.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return normalizeSettings(parsed);
  } catch {
    return null;
  }
}

async function writeSettings(
  settings: TadoiSettings,
  filePath: string,
  fsOps: SettingsFsOps
): Promise<void> {
  await fsOps.mkdir(path.dirname(filePath), { recursive: true });
  await fsOps.writeFile(filePath, JSON.stringify(settings, null, 2), "utf8");
}

export async function loadSettings(
  options: LoadSettingsOptions = {}
): Promise<LoadSettingsResult> {
  const fsOps = options.fsOps ?? DEFAULT_FS_OPS;
  const { primary, fallback } = resolveSettingsPaths(options);

  const primarySettings = await readSettingsFile(primary, fsOps);
  if (primarySettings) {
    lastResolvedPath = primary;
    return { settings: primarySettings, resolvedPath: primary };
  }

  const fallbackSettings = await readSettingsFile(fallback, fsOps);
  if (fallbackSettings) {
    lastResolvedPath = fallback;
    return { settings: fallbackSettings, resolvedPath: fallback };
  }

  lastResolvedPath = primary;
  return { settings: DEFAULT_SETTINGS, resolvedPath: primary };
}

export function saveSettingsDebounced(
  settings: TadoiSettings,
  delayMs = DEFAULT_DEBOUNCE_MS,
  options: SaveSettingsOptions = {}
): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  const fsOps = options.fsOps ?? DEFAULT_FS_OPS;
  const { primary, fallback } = resolveSettingsPaths(options);
  const preferredPath = options.filePath ?? lastResolvedPath ?? primary;
  const normalized = normalizeSettings(settings);

  saveTimer = setTimeout(() => {
    void (async () => {
      try {
        await writeSettings(normalized, preferredPath, fsOps);
        lastResolvedPath = preferredPath;
      } catch {
        // Fallback behavior for when writing to primary path fails.
        if (preferredPath === primary) {
          try {
            await writeSettings(normalized, fallback, fsOps);
            lastResolvedPath = fallback;
          } catch {
            // Intentionally swallow; settings persistence should not break runtime.
          }
        }
      } finally {
        saveTimer = null;
      }
    })();
  }, delayMs);
}

export async function saveSettingsStrict(
  settings: TadoiSettings,
  options: SaveSettingsOptions = {}
): Promise<SaveSettingsStrictResult> {
  const fsOps = options.fsOps ?? DEFAULT_FS_OPS;
  const { primary, fallback } = resolveSettingsPaths(options);
  const preferredPath = options.filePath ?? lastResolvedPath ?? primary;
  const normalized = normalizeSettings(settings);

  try {
    await writeSettings(normalized, preferredPath, fsOps);
    lastResolvedPath = preferredPath;
    return { resolvedPath: preferredPath, usedFallback: false };
  } catch (primaryError: unknown) {
    if (preferredPath === primary) {
      try {
        await writeSettings(normalized, fallback, fsOps);
        lastResolvedPath = fallback;
        return { resolvedPath: fallback, usedFallback: true };
      } catch (fallbackError: unknown) {
        const primaryMessage =
          primaryError instanceof Error ? primaryError.message : String(primaryError);
        const fallbackMessage =
          fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        throw new Error(
          `Failed to write settings to ${primary} (${primaryMessage}) and fallback ${fallback} (${fallbackMessage})`
        );
      }
    }

    const preferredMessage =
      primaryError instanceof Error ? primaryError.message : String(primaryError);
    throw new Error(`Failed to write settings to ${preferredPath}: ${preferredMessage}`);
  }
}

export function getDefaultSettings(): TadoiSettings {
  return {
    ...DEFAULT_SETTINGS,
    notifications: { ...DEFAULT_NOTIFICATION_SETTINGS }
  };
}

export function resetSettingsStateForTests(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  lastResolvedPath = null;
}
