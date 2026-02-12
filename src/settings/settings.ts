import os from "os";
import { promises as fs } from "fs";
import path from "path";
import { ThemeId, ThemeTokens, THEMES, isThemeId } from "../theme/themes";
import {
  SETTINGS_DIR_NAME,
  SETTINGS_FALLBACK_DIR_NAME,
  SETTINGS_FILE_NAME
} from "../brand/brand";
import { THEME_TOKEN_KEYS, normalizeHexColor } from "../theme/custom1ColorUtils";

export type ThemeObjectId =
  | "appChrome"
  | "taskList"
  | "taskRow"
  | "modal"
  | "help"
  | "inputs"
  | "dashboard"
  | "notifications";

export const THEME_OBJECT_IDS: ThemeObjectId[] = [
  "appChrome",
  "taskList",
  "taskRow",
  "modal",
  "help",
  "inputs",
  "dashboard",
  "notifications"
];

export type CustomThemeConfig = {
  global: ThemeTokens;
  objects?: Partial<Record<ThemeObjectId, Partial<ThemeTokens>>>;
};

export type CustomThemes = {
  custom1?: CustomThemeConfig;
};

export type TadoiSettings = {
  themeId: ThemeId;
  logoMode: LogoMode;
  flashMode: FlashMode;
  notifications: NotificationSettings;
  customThemes?: CustomThemes;
};

export type FlashMode = "slow" | "static";
export type LogoMode =
  | "default"
  | "alternate32"
  | "alternate_slash32"
  | "alternate_blocks32"
  | "rotate";

export const LOGO_MODE_ORDER: LogoMode[] = [
  "default",
  "alternate32",
  "alternate_slash32",
  "alternate_blocks32",
  "rotate"
];

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
  logoMode: "default",
  flashMode: "slow",
  notifications: DEFAULT_NOTIFICATION_SETTINGS,
  customThemes: {
    custom1: {
      global: { ...THEMES.default }
    }
  }
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

export function isLogoMode(value: unknown): value is LogoMode {
  return (
    value === "default" ||
    value === "alternate32" ||
    value === "alternate_slash32" ||
    value === "alternate_blocks32" ||
    value === "rotate"
  );
}

export function cycleLogoMode(current: LogoMode, direction: 1 | -1 = 1): LogoMode {
  const index = LOGO_MODE_ORDER.indexOf(current);
  const safeIndex = index >= 0 ? index : 0;
  const nextIndex =
    (safeIndex + direction + LOGO_MODE_ORDER.length) % LOGO_MODE_ORDER.length;
  return LOGO_MODE_ORDER[nextIndex];
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function cloneThemeTokens(tokens: ThemeTokens): ThemeTokens {
  return { ...tokens };
}

function normalizeThemeTokens(input: unknown, fallback: ThemeTokens): ThemeTokens {
  const normalized = {} as ThemeTokens;
  const inputRecord = isRecord(input) ? input : {};
  for (const token of THEME_TOKEN_KEYS) {
    const parsed = normalizeHexColor(inputRecord[token]);
    const fallbackParsed = normalizeHexColor(fallback[token]);
    normalized[token] =
      parsed ??
      fallbackParsed ??
      String(fallback[token]).trim().toUpperCase();
  }
  return normalized;
}

function normalizeThemeTokenOverrides(input: unknown): Partial<ThemeTokens> | undefined {
  if (!isRecord(input)) return undefined;
  const normalized: Partial<ThemeTokens> = {};
  for (const token of THEME_TOKEN_KEYS) {
    const parsed = normalizeHexColor(input[token]);
    if (parsed) {
      normalized[token] = parsed;
    }
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeThemeObjectOverrides(
  input: unknown
): Partial<Record<ThemeObjectId, Partial<ThemeTokens>>> | undefined {
  if (!isRecord(input)) return undefined;
  const normalized: Partial<Record<ThemeObjectId, Partial<ThemeTokens>>> = {};
  for (const objectId of THEME_OBJECT_IDS) {
    const objectOverride = normalizeThemeTokenOverrides(input[objectId]);
    if (objectOverride) {
      normalized[objectId] = objectOverride;
    }
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function resolveCustom1SeedTheme(themeId: ThemeId): ThemeTokens {
  if (themeId === "rotating") {
    return cloneThemeTokens(THEMES.default);
  }
  return cloneThemeTokens(THEMES[themeId] ?? THEMES.default);
}

function normalizeCustomThemes(input: unknown, themeId: ThemeId): CustomThemes {
  const customThemesInput = isRecord(input) ? input : {};
  const custom1Input = isRecord(customThemesInput.custom1)
    ? customThemesInput.custom1
    : {};
  const seedGlobal = resolveCustom1SeedTheme(themeId);
  const global = normalizeThemeTokens(custom1Input.global, seedGlobal);
  const objects = normalizeThemeObjectOverrides(custom1Input.objects);
  return {
    custom1: objects ? { global, objects } : { global }
  };
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
  if (!isRecord(input)) {
    return getDefaultSettings();
  }
  const maybeThemeId = input.themeId;
  const maybeLogoMode = input.logoMode;
  const maybeFlashMode = input.flashMode;
  const maybeNotifications = input.notifications;
  const themeId = isThemeId(maybeThemeId) ? maybeThemeId : DEFAULT_SETTINGS.themeId;
  return {
    themeId,
    logoMode: isLogoMode(maybeLogoMode) ? maybeLogoMode : DEFAULT_SETTINGS.logoMode,
    flashMode: isFlashMode(maybeFlashMode) ? maybeFlashMode : DEFAULT_SETTINGS.flashMode,
    notifications: normalizeNotifications(maybeNotifications),
    customThemes: normalizeCustomThemes(input.customThemes, themeId)
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
  return { settings: getDefaultSettings(), resolvedPath: primary };
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
  const customThemes = normalizeCustomThemes(DEFAULT_SETTINGS.customThemes, "default");
  return {
    ...DEFAULT_SETTINGS,
    notifications: { ...DEFAULT_NOTIFICATION_SETTINGS },
    customThemes
  };
}

export function resetSettingsStateForTests(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  lastResolvedPath = null;
}
