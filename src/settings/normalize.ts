import { ThemeId, ThemeTokens, THEMES, ROTATING_THEME_ORDER, isThemeId } from "../theme/themes";
import {
  THEME_TEXT_TOKEN_KEYS,
  THEME_TOKEN_KEYS,
  normalizeHexColor,
} from "../theme/custom1ColorUtils";
import {
  normalizeKeymapAliases,
  type KeymapAliases,
} from "../app/keymapAliases";
import {
  DEFAULT_GITHUB_AUTO_PUSH_POLICY,
  DEFAULT_GITHUB_BACKUP_BRANCH,
  DEFAULT_NOTES_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_SETTINGS,
  getDefaultGitHubBackupSettings,
} from "./defaults";
import {
  DEFAULT_CRT_FX_LITE_COLOR,
  DEFAULT_CRT_FX_LITE_PRESET,
  DEFAULT_HINT_DISPLAY_MODE,
  DEFAULT_RETRO_FX_MODE,
  DEFAULT_SHOW_PREFIX_HINT_POPUP,
  THEME_OBJECT_IDS,
  type BuiltInThemeTextOverrideConfig,
  type BuiltInThemeTextOverrides,
  type CrtFxLiteColor,
  type CrtFxLitePreset,
  type CustomThemes,
  type GitHubAutoPushPolicy,
  type GitHubBackupLastPushed,
  type GitHubBackupSettings,
  type HintDisplayMode,
  type NotesSettings,
  type NotificationSettings,
  type RetroFxMode,
  type SecuritySettings,
  type TadoiSettings,
  type ThemeObjectId,
  type ThemeTextTokenOverrides,
  isCrtFxLiteColor,
  isCrtFxLitePreset,
  isFlashMode,
  isHintDisplayMode,
  isLogoMode,
  isRetroFxMode,
} from "./types";

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

function normalizeThemeTokens(
  input: unknown,
  fallback: ThemeTokens,
): ThemeTokens {
  const normalized = {} as ThemeTokens;
  const inputRecord = isRecord(input) ? input : {};
  for (const token of THEME_TOKEN_KEYS) {
    const parsed = normalizeHexColor(inputRecord[token]);
    const fallbackParsed = normalizeHexColor(fallback[token]);
    normalized[token] =
      parsed ?? fallbackParsed ?? String(fallback[token]).trim().toUpperCase();
  }
  return normalized;
}

function normalizeThemeTokenOverrides(
  input: unknown,
): Partial<ThemeTokens> | undefined {
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
  input: unknown,
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
  input: unknown,
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
  input: unknown,
): Partial<Record<ThemeObjectId, ThemeTextTokenOverrides>> | undefined {
  if (!isRecord(input)) return undefined;
  const normalized: Partial<Record<ThemeObjectId, ThemeTextTokenOverrides>> =
    {};
  for (const objectId of THEME_OBJECT_IDS) {
    const objectOverride = normalizeThemeTextTokenOverrides(input[objectId]);
    if (objectOverride) {
      normalized[objectId] = objectOverride;
    }
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeBuiltInThemeTextOverrides(
  input: unknown,
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

export function normalizeCustomThemes(
  input: unknown,
  themeId: ThemeId,
): CustomThemes {
  const customThemesInput = isRecord(input) ? input : {};
  const custom1Input = isRecord(customThemesInput.custom1)
    ? customThemesInput.custom1
    : {};
  const textByTheme = normalizeBuiltInThemeTextOverrides(
    customThemesInput.textByTheme,
  );
  const seedGlobal = resolveCustom1SeedTheme(themeId);
  const global = normalizeThemeTokens(custom1Input.global, seedGlobal);
  const objects = normalizeThemeObjectOverrides(custom1Input.objects);
  const normalized: CustomThemes = {
    custom1: objects ? { global, objects } : { global },
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
  const maybeInAppOverdueBanner = (input as { inAppOverdueBanner?: unknown })
    .inAppOverdueBanner;
  const maybeTerminalBellOnOverdue = (
    input as { terminalBellOnOverdue?: unknown }
  ).terminalBellOnOverdue;
  const maybeOutOfAppRemindersEnabled = (
    input as { outOfAppRemindersEnabled?: unknown }
  ).outOfAppRemindersEnabled;
  const maybeBannerDurationMs = (input as { bannerDurationMs?: unknown })
    .bannerDurationMs;
  const maybeBellCooldownMs = (input as { bellCooldownMs?: unknown })
    .bellCooldownMs;

  const normalized: NotificationSettings = {
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
      DEFAULT_NOTIFICATION_SETTINGS.bannerDurationMs,
    ),
    bellCooldownMs: normalizePositiveMs(
      maybeBellCooldownMs,
      DEFAULT_NOTIFICATION_SETTINGS.bellCooldownMs,
    ),
  };
  if (typeof maybeOutOfAppRemindersEnabled === "boolean") {
    normalized.outOfAppRemindersEnabled = maybeOutOfAppRemindersEnabled;
  }
  return normalized;
}

function normalizeSecurity(input: unknown): SecuritySettings {
  if (!isRecord(input)) {
    return { ...DEFAULT_SETTINGS.security };
  }
  const rawPolicy = input.nonHttpLinkPolicy;
  return {
    nonHttpLinkPolicy: rawPolicy === "block" ? "block" : "prompt",
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

function normalizeHintDisplayMode(value: unknown): HintDisplayMode {
  return isHintDisplayMode(value) ? value : DEFAULT_HINT_DISPLAY_MODE;
}

function normalizeShowPrefixHintPopup(value: unknown): boolean {
  return typeof value === "boolean" ? value : DEFAULT_SHOW_PREFIX_HINT_POPUP;
}

function isGitHubAutoPushPolicy(value: unknown): value is GitHubAutoPushPolicy {
  return value === "off" || value === "onExit" || value === "interval15m";
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeGitHubOwnerRepo(value: unknown): string | null {
  const normalized = normalizeOptionalString(value);
  return normalized ?? null;
}

function normalizeGitHubDeviceId(value: unknown): string {
  const normalized = normalizeOptionalString(value);
  return normalized ?? getDefaultGitHubBackupSettings().deviceId;
}

function normalizeGitHubPathPrefix(value: unknown, deviceId: string): string {
  const normalized = normalizeOptionalString(value);
  return normalized ?? `tadoi/devices/${deviceId}`;
}

function normalizeGitHubLastPushed(
  value: unknown,
): GitHubBackupLastPushed | undefined {
  if (!isRecord(value)) return undefined;
  const normalized: GitHubBackupLastPushed = {};

  const stateRevision = value.stateRevision;
  if (
    typeof stateRevision === "number" &&
    Number.isFinite(stateRevision) &&
    Number.isInteger(stateRevision) &&
    stateRevision >= 0
  ) {
    normalized.stateRevision = stateRevision;
  }

  const settingsHash = normalizeOptionalString(value.settingsHash);
  if (settingsHash) {
    normalized.settingsHash = settingsHash;
  }

  const timestamp = normalizeOptionalString(value.timestamp);
  if (timestamp) {
    normalized.timestamp = timestamp;
  }

  const remoteCommitSha = normalizeOptionalString(value.remoteCommitSha);
  if (remoteCommitSha) {
    normalized.remoteCommitSha = remoteCommitSha;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeGitHubBackup(input: unknown): GitHubBackupSettings {
  const defaults = getDefaultGitHubBackupSettings();
  if (!isRecord(input)) {
    return defaults;
  }

  const deviceId = normalizeGitHubDeviceId(input.deviceId);
  const normalized: GitHubBackupSettings = {
    enabled: input.enabled === true,
    ownerRepo: normalizeGitHubOwnerRepo(input.ownerRepo),
    branch:
      normalizeOptionalString(input.branch) ?? DEFAULT_GITHUB_BACKUP_BRANCH,
    deviceId,
    pathPrefix: normalizeGitHubPathPrefix(input.pathPrefix, deviceId),
    autoPushPolicy: isGitHubAutoPushPolicy(input.autoPushPolicy)
      ? input.autoPushPolicy
      : DEFAULT_GITHUB_AUTO_PUSH_POLICY,
  };

  const lastPushed = normalizeGitHubLastPushed(input.lastPushed);
  if (lastPushed) {
    normalized.lastPushed = lastPushed;
  }

  return normalized;
}

function normalizeNotesSettings(input: unknown): NotesSettings {
  if (!isRecord(input)) {
    return { ...DEFAULT_NOTES_SETTINGS };
  }
  const rootPathValue = input.rootPath;
  const rootPath =
    typeof rootPathValue === "string" && rootPathValue.trim().length > 0
      ? rootPathValue.trim()
      : null;
  return {
    enabled: input.enabled !== false,
    rootPath,
  };
}

export function normalizeSettings(input: unknown): TadoiSettings {
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
  const maybeHintDisplayMode = input.hintDisplayMode;
  const maybeShowPrefixHintPopup = input.showPrefixHintPopup;
  const maybeNotifications = input.notifications;
  const maybeSecurity = input.security;
  const maybeGithubBackup = input.githubBackup;
  const maybeNotes = input.notes;
  const keymapAliases: KeymapAliases | undefined = normalizeKeymapAliases(
    input.keymapAliases,
  );
  const themeId = isThemeId(maybeThemeId)
    ? maybeThemeId
    : DEFAULT_SETTINGS.themeId;
  const crtFxLite = normalizeCrtFxLite(maybeCrtFxLite);
  const crtFxColor = normalizeCrtFxColor(maybeCrtFxColor);
  const crtFxPreset = normalizeCrtFxPreset(maybeCrtFxPreset);
  const retroFxMode = normalizeRetroFxMode(maybeRetroFxMode);
  const hintDisplayMode = normalizeHintDisplayMode(maybeHintDisplayMode);
  const showPrefixHintPopup = normalizeShowPrefixHintPopup(
    maybeShowPrefixHintPopup,
  );
  const normalized: TadoiSettings = {
    themeId,
    logoMode: isLogoMode(maybeLogoMode)
      ? maybeLogoMode
      : DEFAULT_SETTINGS.logoMode,
    flashMode: isFlashMode(maybeFlashMode)
      ? maybeFlashMode
      : DEFAULT_SETTINGS.flashMode,
    hintDisplayMode,
    showPrefixHintPopup,
    notifications: normalizeNotifications(maybeNotifications),
    security: normalizeSecurity(maybeSecurity),
    customThemes: normalizeCustomThemes(input.customThemes, themeId),
    githubBackup: normalizeGitHubBackup(maybeGithubBackup),
    notes: normalizeNotesSettings(maybeNotes),
  };
  if (keymapAliases) {
    normalized.keymapAliases = keymapAliases;
  }
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

export function getDefaultSettings(): TadoiSettings {
  const customThemes = normalizeCustomThemes(
    DEFAULT_SETTINGS.customThemes,
    "default",
  );
  return {
    ...DEFAULT_SETTINGS,
    notifications: { ...DEFAULT_NOTIFICATION_SETTINGS },
    security: { ...DEFAULT_SETTINGS.security },
    customThemes,
    githubBackup: getDefaultGitHubBackupSettings(),
    notes: { ...DEFAULT_NOTES_SETTINGS },
  };
}
