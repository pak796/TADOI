import { promises as fs } from "fs";
import {
  LOGO_VARIANTS,
  ROTATING_LOGO_ORDER,
  type LogoVariantId,
} from "../brand/brand";
import {
  type ThemeTokens,
  type ThemeId,
  type RotatingThemeId,
} from "../theme/themes";
import { THEME_TEXT_TOKEN_KEYS } from "../theme/custom1ColorUtils";
import type { KeymapAliases } from "../app/keymapAliases";

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
  "notifications",
];

export type CustomThemeConfig = {
  global: ThemeTokens;
  objects?: Partial<Record<ThemeObjectId, Partial<ThemeTokens>>>;
};

export type ThemeTextTokenKey = (typeof THEME_TEXT_TOKEN_KEYS)[number];
export type ThemeTextTokenOverrides = Partial<
  Pick<ThemeTokens, ThemeTextTokenKey>
>;

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

export type NotificationSettings = {
  enabled: boolean;
  inAppOverdueBanner: boolean;
  terminalBellOnOverdue: boolean;
  outOfAppRemindersEnabled?: boolean;
  bannerDurationMs: number;
  bellCooldownMs: number;
};

export type NotesSettings = {
  enabled: boolean;
  rootPath: string | null;
};

export type NonHttpLinkPolicy = "prompt" | "block";

export type SecuritySettings = {
  nonHttpLinkPolicy: NonHttpLinkPolicy;
};

export type GitHubAutoPushPolicy = "off" | "onExit" | "interval15m";

export type GitHubBackupLastPushed = {
  stateRevision?: number;
  settingsHash?: string;
  timestamp?: string;
  remoteCommitSha?: string;
};

export type GitHubBackupSettings = {
  enabled: boolean;
  ownerRepo: string | null;
  branch: string;
  deviceId: string;
  pathPrefix: string;
  autoPushPolicy: GitHubAutoPushPolicy;
  lastPushed?: GitHubBackupLastPushed;
};

export type TadoiSettings = {
  themeId: ThemeId;
  logoMode: LogoMode;
  flashMode: FlashMode;
  hintDisplayMode?: HintDisplayMode;
  showPrefixHintPopup?: boolean;
  crtFxLite?: boolean;
  crtFxColor?: CrtFxLiteColor;
  crtFxPreset?: CrtFxLitePreset;
  retroFxMode?: RetroFxMode;
  notifications: NotificationSettings;
  security: SecuritySettings;
  customThemes?: CustomThemes;
  keymapAliases?: KeymapAliases;
  githubBackup?: GitHubBackupSettings;
  notes?: NotesSettings;
};

export type FlashMode = "slow" | "static";
export type LogoMode = LogoVariantId | "rotate";
export type HintDisplayMode = "bottom" | "left_rail" | "both" | "none";
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
export const DEFAULT_HINT_DISPLAY_MODE: HintDisplayMode = "bottom";
export const DEFAULT_SHOW_PREFIX_HINT_POPUP = true;
export const CRT_FX_LITE_COLOR_ORDER: CrtFxLiteColor[] = ["green", "amber"];
export const CRT_FX_LITE_PRESET_ORDER: CrtFxLitePreset[] = [
  "subtle",
  "normal",
  "strong",
];
export const RETRO_FX_MODE_ORDER: RetroFxMode[] = [
  "off",
  "classic",
  "broadcast",
];
export const HINT_DISPLAY_MODE_ORDER: HintDisplayMode[] = [
  "bottom",
  "left_rail",
  "both",
  "none",
];
export const CRT_FX_LITE_PROFILE_ORDER: CrtFxLiteProfile[] = [
  { color: "green", preset: "subtle" },
  { color: "green", preset: "normal" },
  { color: "green", preset: "strong" },
  { color: "amber", preset: "subtle" },
  { color: "amber", preset: "normal" },
  { color: "amber", preset: "strong" },
];
export const LOGO_MODE_ORDER: LogoMode[] = [...ROTATING_LOGO_ORDER, "rotate"];

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

export function isCrtFxLitePreset(value: unknown): value is CrtFxLitePreset {
  return value === "subtle" || value === "normal" || value === "strong";
}

export function isCrtFxLiteColor(value: unknown): value is CrtFxLiteColor {
  return value === "green" || value === "amber";
}

export function isRetroFxMode(value: unknown): value is RetroFxMode {
  return value === "off" || value === "classic" || value === "broadcast";
}

export function cycleCrtFxLiteColor(
  current: CrtFxLiteColor,
  direction: 1 | -1 = 1,
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
  direction: 1 | -1 = 1,
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
  direction: 1 | -1 = 1,
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
  preset: CrtFxLitePreset,
): string {
  return `${formatCrtFxLiteColorLabel(color)} ${formatCrtFxLitePresetLabel(preset)}`;
}

export function cycleCrtFxLiteProfile(
  current: CrtFxLiteProfile,
  direction: 1 | -1 = 1,
): CrtFxLiteProfile {
  const index = CRT_FX_LITE_PROFILE_ORDER.findIndex(
    (profile) =>
      profile.color === current.color && profile.preset === current.preset,
  );
  const defaultIndex = CRT_FX_LITE_PROFILE_ORDER.findIndex(
    (profile) =>
      profile.color === DEFAULT_CRT_FX_LITE_COLOR &&
      profile.preset === DEFAULT_CRT_FX_LITE_PRESET,
  );
  const safeIndex = index >= 0 ? index : Math.max(0, defaultIndex);
  const nextIndex =
    (safeIndex + direction + CRT_FX_LITE_PROFILE_ORDER.length) %
    CRT_FX_LITE_PROFILE_ORDER.length;
  const nextProfile = CRT_FX_LITE_PROFILE_ORDER[nextIndex];
  return {
    color: nextProfile.color,
    preset: nextProfile.preset,
  };
}

export function isFlashMode(value: unknown): value is FlashMode {
  return value === "slow" || value === "static";
}

export function isHintDisplayMode(value: unknown): value is HintDisplayMode {
  return (
    value === "bottom" ||
    value === "left_rail" ||
    value === "both" ||
    value === "none"
  );
}

export function isLogoMode(value: unknown): value is LogoMode {
  if (value === "rotate") return true;
  if (typeof value !== "string") return false;
  return Object.prototype.hasOwnProperty.call(LOGO_VARIANTS, value);
}

export function cycleLogoMode(
  current: LogoMode,
  direction: 1 | -1 = 1,
): LogoMode {
  const index = LOGO_MODE_ORDER.indexOf(current);
  const safeIndex = index >= 0 ? index : 0;
  const nextIndex =
    (safeIndex + direction + LOGO_MODE_ORDER.length) % LOGO_MODE_ORDER.length;
  return LOGO_MODE_ORDER[nextIndex];
}
