import os from "os";
import { promises as fs } from "fs";
import path from "path";
import {
  ThemeId,
  ThemeTokens,
  THEMES,
  ROTATING_THEME_ORDER,
  type RotatingThemeId,
  isThemeId
} from "../theme/themes";
import {
  LOGO_VARIANTS,
  ROTATING_LOGO_ORDER,
  SETTINGS_DIR_NAME,
  SETTINGS_FALLBACK_DIR_NAME,
  SETTINGS_FILE_NAME,
  type LogoVariantId
} from "../brand/brand";
import {
  THEME_TEXT_TOKEN_KEYS,
  THEME_TOKEN_KEYS,
  normalizeHexColor
} from "../theme/custom1ColorUtils";

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

export type ThemeTextTokenKey = (typeof THEME_TEXT_TOKEN_KEYS)[number];
export type ThemeTextTokenOverrides = Partial<Pick<ThemeTokens, ThemeTextTokenKey>>;

export type BuiltInThemeTextOverrideConfig = {
  global?: ThemeTextTokenOverrides;
  objects?: Partial<Record<ThemeObjectId, ThemeTextTokenOverrides>>;
};

export type BuiltInThemeTextOverrides = Partial<
  Record<RotatingThemeId, BuiltInThemeTextOverrideConfig>
>;

export type CustomThemes = {
  custom1?: CustomThemeConfig;
  textByTheme?: BuiltInThemeTextOverrides;
};

export type TadoiSettings = {
  themeId: ThemeId;
  logoMode: LogoMode;
  flashMode: FlashMode;
  crtFxLite?: boolean;
  crtFxColor?: CrtFxLiteColor;
  crtFxPreset?: CrtFxLitePreset;
  retroFxMode?: RetroFxMode;
  notifications: NotificationSettings;
  security: SecuritySettings;
  customThemes?: CustomThemes;
};

export type FlashMode = "slow" | "static";
export type LogoMode = LogoVariantId | "rotate";
export type CrtFxLiteColor = "green" | "amber";
export type CrtFxLitePreset = "subtle" | "normal" | "strong";
export type RetroFxMode = "off" | "classic" | "broadcast";
export type CrtFxLiteProfile = {
  color: CrtFxLiteColor;
  preset: CrtFxLitePreset;
};

export const DEFAULT_CRT_FX_LITE_COLOR: CrtFxLiteColor = "green";
export const DEFAULT_CRT_FX_LITE_PRESET: CrtFxLitePreset = "normal";
export const DEFAULT_RETRO_FX_MODE: RetroFxMode = "off";
export const CRT_FX_LITE_COLOR_ORDER: CrtFxLiteColor[] = [
  "green",
  "amber"
];
export const CRT_FX_LITE_PRESET_ORDER: CrtFxLitePreset[] = [
  "subtle",
  "normal",
  "strong"
];
export const RETRO_FX_MODE_ORDER: RetroFxMode[] = [
  "off",
  "classic",
  "broadcast"
];
export const CRT_FX_LITE_PROFILE_ORDER: CrtFxLiteProfile[] = [
  { color: "green", preset: "subtle" },
  { color: "green", preset: "normal" },
  { color: "green", preset: "strong" },
  { color: "amber", preset: "subtle" },
  { color: "amber", preset: "normal" },
  { color: "amber", preset: "strong" }
];

export const LOGO_MODE_ORDER: LogoMode[] = [
  ...ROTATING_LOGO_ORDER,
  "rotate"
];

export function isCrtFxLitePreset(value: unknown): value is CrtFxLitePreset {
  return (
    value === "subtle" ||
    value === "normal" ||
    value === "strong"
  );
}

export function isCrtFxLiteColor(value: unknown): value is CrtFxLiteColor {
  return value === "green" || value === "amber";
}

export function isRetroFxMode(value: unknown): value is RetroFxMode {
  return value === "off" || value === "classic" || value === "broadcast";
}

export function cycleCrtFxLiteColor(
  current: CrtFxLiteColor,
  direction: 1 | -1 = 1
): CrtFxLiteColor {
  const index = CRT_FX_LITE_COLOR_ORDER.indexOf(current);
  const safeIndex = index >= 0 ? index : 0;
  const nextIndex =
    (safeIndex + direction + CRT_FX_LITE_COLOR_ORDER.length) %
    CRT_FX_LITE_COLOR_ORDER.length;
  return CRT_FX_LITE_COLOR_ORDER[nextIndex];
}

export function cycleCrtFxLitePreset(
  current: CrtFxLitePreset,
  direction: 1 | -1 = 1
): CrtFxLitePreset {
  const index = CRT_FX_LITE_PRESET_ORDER.indexOf(current);
  const safeIndex = index >= 0 ? index : 0;
  const nextIndex =
    (safeIndex + direction + CRT_FX_LITE_PRESET_ORDER.length) %
    CRT_FX_LITE_PRESET_ORDER.length;
  return CRT_FX_LITE_PRESET_ORDER[nextIndex];
}

export function cycleRetroFxMode(
  current: RetroFxMode,
  direction: 1 | -1 = 1
): RetroFxMode {
  const index = RETRO_FX_MODE_ORDER.indexOf(current);
  const safeIndex = index >= 0 ? index : 0;
  const nextIndex =
    (safeIndex + direction + RETRO_FX_MODE_ORDER.length) %
    RETRO_FX_MODE_ORDER.length;
  return RETRO_FX_MODE_ORDER[nextIndex];
}

export function formatCrtFxLitePresetLabel(preset: CrtFxLitePreset): string {
  if (preset === "normal") {
    return "Regular";
  }
  return `${preset.charAt(0).toUpperCase()}${preset.slice(1)}`;
}

export function formatCrtFxLiteColorLabel(color: CrtFxLiteColor): string {
  return color === "amber" ? "Amber" : "Green";
}

export function formatRetroFxModeLabel(mode: RetroFxMode): string {
  if (mode === "classic") return "Classic";
  if (mode === "broadcast") return "Broadcast";
  return "Off";
}

export function formatCrtFxLiteProfileLabel(
  color: CrtFxLiteColor,
  preset: CrtFxLitePreset
): string {
  return `${formatCrtFxLiteColorLabel(color)} ${formatCrtFxLitePresetLabel(preset)}`;
}

export function cycleCrtFxLiteProfile(
  current: CrtFxLiteProfile,
  direction: 1 | -1 = 1
): CrtFxLiteProfile {
  const index = CRT_FX_LITE_PROFILE_ORDER.findIndex(
    (profile) => profile.color === current.color && profile.preset === current.preset
  );
  const defaultIndex = CRT_FX_LITE_PROFILE_ORDER.findIndex(
    (profile) =>
      profile.color === DEFAULT_CRT_FX_LITE_COLOR &&
      profile.preset === DEFAULT_CRT_FX_LITE_PRESET
  );
  const safeIndex = index >= 0 ? index : Math.max(0, defaultIndex);
  const nextIndex =
    (safeIndex + direction + CRT_FX_LITE_PROFILE_ORDER.length) %
    CRT_FX_LITE_PROFILE_ORDER.length;
  const nextProfile = CRT_FX_LITE_PROFILE_ORDER[nextIndex];
  return {
    color: nextProfile.color,
    preset: nextProfile.preset
  };
}

export type NotificationSettings = {
  enabled: boolean;
  inAppOverdueBanner: boolean;
  terminalBellOnOverdue: boolean;
  bannerDurationMs: number;
  bellCooldownMs: number;
};

export type NonHttpLinkPolicy = "prompt" | "block";

export type SecuritySettings = {
  nonHttpLinkPolicy: NonHttpLinkPolicy;
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
  warnings: string[];
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
  security: {
    nonHttpLinkPolicy: "prompt"
  },
  customThemes: {
    custom1: {
      global: { ...THEMES.default }
    }
  }
};

const DEFAULT_DEBOUNCE_MS = 150;
const DEFAULT_FS_OPS: SettingsFsOps = fs;
const PRIVATE_DIR_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;

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
  if (value === "rotate") return true;
  if (typeof value !== "string") return false;
  return Object.prototype.hasOwnProperty.call(LOGO_VARIANTS, value);
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

function normalizeThemeTextTokenOverrides(
  input: unknown
): ThemeTextTokenOverrides | undefined {
  if (!isRecord(input)) return undefined;
  const normalized: ThemeTextTokenOverrides = {};
  for (const token of THEME_TEXT_TOKEN_KEYS) {
    const parsed = normalizeHexColor(input[token]);
    if (parsed) {
      normalized[token] = parsed;
    }
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeThemeTextObjectOverrides(
  input: unknown
): Partial<Record<ThemeObjectId, ThemeTextTokenOverrides>> | undefined {
  if (!isRecord(input)) return undefined;
  const normalized: Partial<Record<ThemeObjectId, ThemeTextTokenOverrides>> = {};
  for (const objectId of THEME_OBJECT_IDS) {
    const objectOverride = normalizeThemeTextTokenOverrides(input[objectId]);
    if (objectOverride) {
      normalized[objectId] = objectOverride;
    }
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeBuiltInThemeTextOverrides(
  input: unknown
): BuiltInThemeTextOverrides | undefined {
  if (!isRecord(input)) return undefined;
  const normalized: BuiltInThemeTextOverrides = {};
  for (const themeId of ROTATING_THEME_ORDER) {
    const themeInput = input[themeId];
    if (!isRecord(themeInput)) continue;
    const global = normalizeThemeTextTokenOverrides(themeInput.global);
    const objects = normalizeThemeTextObjectOverrides(themeInput.objects);
    if (!global && !objects) continue;
    const config: BuiltInThemeTextOverrideConfig = {};
    if (global) {
      config.global = global;
    }
    if (objects) {
      config.objects = objects;
    }
    normalized[themeId] = config;
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
  const textByTheme = normalizeBuiltInThemeTextOverrides(customThemesInput.textByTheme);
  const seedGlobal = resolveCustom1SeedTheme(themeId);
  const global = normalizeThemeTokens(custom1Input.global, seedGlobal);
  const objects = normalizeThemeObjectOverrides(custom1Input.objects);
  const normalized: CustomThemes = {
    custom1: objects ? { global, objects } : { global }
  };
  if (textByTheme) {
    normalized.textByTheme = textByTheme;
  }
  return normalized;
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

function normalizeSecurity(input: unknown): SecuritySettings {
  if (!isRecord(input)) {
    return { ...DEFAULT_SETTINGS.security };
  }
  const rawPolicy = input.nonHttpLinkPolicy;
  return {
    nonHttpLinkPolicy: rawPolicy === "block" ? "block" : "prompt"
  };
}

function normalizeCrtFxLite(value: unknown): boolean | undefined {
  return value === true ? true : undefined;
}

function normalizeCrtFxColor(value: unknown): CrtFxLiteColor | undefined {
  return isCrtFxLiteColor(value) ? value : undefined;
}

function normalizeCrtFxPreset(value: unknown): CrtFxLitePreset | undefined {
  return isCrtFxLitePreset(value) ? value : undefined;
}

function normalizeRetroFxMode(value: unknown): RetroFxMode | undefined {
  return isRetroFxMode(value) ? value : undefined;
}

function normalizeSettings(input: unknown): TadoiSettings {
  if (!isRecord(input)) {
    return getDefaultSettings();
  }
  const maybeThemeId = input.themeId;
  const maybeLogoMode = input.logoMode;
  const maybeFlashMode = input.flashMode;
  const maybeCrtFxLite = input.crtFxLite;
  const maybeCrtFxColor = input.crtFxColor;
  const maybeCrtFxPreset = input.crtFxPreset;
  const maybeRetroFxMode = input.retroFxMode;
  const maybeNotifications = input.notifications;
  const maybeSecurity = input.security;
  const themeId = isThemeId(maybeThemeId) ? maybeThemeId : DEFAULT_SETTINGS.themeId;
  const crtFxLite = normalizeCrtFxLite(maybeCrtFxLite);
  const crtFxColor = normalizeCrtFxColor(maybeCrtFxColor);
  const crtFxPreset = normalizeCrtFxPreset(maybeCrtFxPreset);
  const retroFxMode = normalizeRetroFxMode(maybeRetroFxMode);
  const normalized: TadoiSettings = {
    themeId,
    logoMode: isLogoMode(maybeLogoMode) ? maybeLogoMode : DEFAULT_SETTINGS.logoMode,
    flashMode: isFlashMode(maybeFlashMode) ? maybeFlashMode : DEFAULT_SETTINGS.flashMode,
    notifications: normalizeNotifications(maybeNotifications),
    security: normalizeSecurity(maybeSecurity),
    customThemes: normalizeCustomThemes(input.customThemes, themeId)
  };
  if (crtFxLite === true) {
    normalized.crtFxLite = true;
  }
  if (crtFxColor && crtFxColor !== DEFAULT_CRT_FX_LITE_COLOR) {
    normalized.crtFxColor = crtFxColor;
  }
  if (crtFxPreset && crtFxPreset !== DEFAULT_CRT_FX_LITE_PRESET) {
    normalized.crtFxPreset = crtFxPreset;
  }
  if (retroFxMode && retroFxMode !== DEFAULT_RETRO_FX_MODE) {
    normalized.retroFxMode = retroFxMode;
  }
  return normalized;
}

async function readSettingsFile(
  label: "primary" | "fallback",
  filePath: string,
  fsOps: SettingsFsOps
): Promise<{ settings: TadoiSettings | null; warning?: string }> {
  let raw: string;
  try {
    raw = await fsOps.readFile(filePath, "utf8");
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return { settings: null };
    }
    return {
      settings: null,
      warning: `${label} settings file could not be read; using fallback/default settings`
    };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return { settings: normalizeSettings(parsed) };
  } catch {
    return {
      settings: null,
      warning: `${label} settings file is not valid JSON; using fallback/default settings`
    };
  }
}

async function writeSettings(
  settings: TadoiSettings,
  filePath: string,
  fsOps: SettingsFsOps
): Promise<void> {
  await fsOps.mkdir(path.dirname(filePath), { recursive: true, mode: PRIVATE_DIR_MODE });
  await fsOps.writeFile(filePath, JSON.stringify(settings, null, 2), {
    encoding: "utf8",
    mode: PRIVATE_FILE_MODE
  });
}

export async function loadSettings(
  options: LoadSettingsOptions = {}
): Promise<LoadSettingsResult> {
  const fsOps = options.fsOps ?? DEFAULT_FS_OPS;
  const { primary, fallback } = resolveSettingsPaths(options);
  const warnings: string[] = [];

  const primaryResult = await readSettingsFile("primary", primary, fsOps);
  if (primaryResult.warning) {
    warnings.push(primaryResult.warning);
  }
  if (primaryResult.settings) {
    lastResolvedPath = primary;
    return { settings: primaryResult.settings, resolvedPath: primary, warnings };
  }

  const fallbackResult = await readSettingsFile("fallback", fallback, fsOps);
  if (fallbackResult.warning) {
    warnings.push(fallbackResult.warning);
  }
  if (fallbackResult.settings) {
    lastResolvedPath = fallback;
    return { settings: fallbackResult.settings, resolvedPath: fallback, warnings };
  }

  lastResolvedPath = primary;
  return { settings: getDefaultSettings(), resolvedPath: primary, warnings };
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
    security: { ...DEFAULT_SETTINGS.security },
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
