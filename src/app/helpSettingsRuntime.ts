import React, { useMemo, useRef, useState } from "react";
import path from "path";
import { FocusTarget, Mode } from "../domain/models";
import { getDataFilePath, createDataBackup } from "../state/persistence";
import type { SettingsState } from "../state/settingsStore";
import { createNotesService, isPathWithin } from "../notes/service";
import { resolveNotesRootPath } from "../notes/storage";
import type { NotePath } from "../notes/types";
import {
  DEFAULT_CRT_FX_LITE_COLOR,
  DEFAULT_CRT_FX_LITE_PRESET,
  DEFAULT_GITHUB_AUTO_PUSH_POLICY,
  DEFAULT_GITHUB_BACKUP_BRANCH,
  DEFAULT_RETRO_FX_MODE,
  cycleCrtFxLiteProfile,
  cycleLogoMode,
  cycleRetroFxMode,
  formatCrtFxLiteProfileLabel,
  formatRetroFxModeLabel,
  getDefaultSettings,
  type BuiltInThemeTextOverrideConfig,
  type BuiltInThemeTextOverrides,
  type CustomThemeConfig,
  type CustomThemes,
  type FlashMode,
  type GitHubAutoPushPolicy,
  type GitHubBackupSettings,
  type HintDisplayMode,
  type LogoMode,
  type ThemeObjectId,
  type ThemeTextTokenOverrides,
  type ThemeTokens,
} from "../settings/settings";
import {
  formatThemeDisplayName,
  ROTATING_THEME_ORDER,
  THEMES,
  type RotatingThemeId,
  type ThemeId,
} from "../theme/themes";
import {
  formatContrastIssueForBanner,
  validateBuiltInTextContrast,
  validateCustomThemeContrast,
} from "../theme/contrastValidation";
import { redactPathForDisplay } from "./pathRedaction";
import type {
  UIHelpThemeUnsavedContinuation,
  UITaskEditorUnsavedContinuation,
  UIState,
  UIUnsavedChangesModal,
} from "../ui/state";
import type { KeymapAliasConfig, KeymapAliases } from "./keymapAliases";

type HelpPage =
  | "help"
  | "settings"
  | "settingsAppearance"
  | "settingsNavigation"
  | "settingsNotifications"
  | "settingsSecurity"
  | "settingsNotes"
  | "settingsCloud"
  | "settingsInput"
  | "keymapAliases"
  | "theme"
  | "custom1"
  | "custom1Edit"
  | "textTuning"
  | "textTuningTheme"
  | "textTuningEdit";

type HelpNavSelectionByPage = {
  settings: number;
  settingsAppearance: number;
  settingsNavigation: number;
  settingsNotifications: number;
  settingsSecurity: number;
  settingsNotes: number;
  settingsCloud: number;
  keymapAliases: number;
  theme: number;
  custom1: number;
  textTuning: number;
  textTuningTheme: number;
};

type HelpThemeEditorSource = "help_custom1_editor" | "help_text_tuning_editor";
type HelpSettingsInputField =
  | "notificationsBannerDurationMs"
  | "notificationsBellCooldownMs"
  | "notesRootPath"
  | "cloudOwnerRepo"
  | "cloudBranch"
  | "cloudDeviceId"
  | "cloudPathPrefix";

type KeymapAliasPresetContext = "list" | "dashboard" | "backup" | "help";
type KeymapAliasPresetState = "off" | "preset" | "custom";

const HELP_TEXT_TUNING_THEMES: RotatingThemeId[] = [...ROTATING_THEME_ORDER];
const HELP_SETTINGS_NAV_ITEMS = [
  "Appearance",
  "Navigation & Keymaps",
  "Notifications",
  "Security",
  "TOME Notes",
  "Cloud Backup",
] as const;
const HELP_SETTINGS_APPEARANCE_NAV_ITEMS = [
  "Theme",
  "Logo",
  "Flash Mode",
  "CRT FX Lite",
  "CRT FX Profile",
  "Retro FX Mode",
] as const;
const HELP_SETTINGS_NAVIGATION_NAV_ITEMS = [
  "Keymap Aliases",
  "Navigation Hints",
  "Prefix Popup",
] as const;
const HELP_SETTINGS_NOTIFICATIONS_NAV_ITEMS = [
  "Notifications",
  "Overdue Popup",
  "Terminal Bell",
  "Out-of-App Reminders",
  "Reminder Helper Install",
  "Reminder Helper Status",
  "Reminder Helper Test",
  "Reminder Helper Uninstall",
  "Reminder Helper Installed",
  "Reminder Helper Next Event",
  "Banner Duration",
  "Bell Cooldown",
] as const;
const HELP_SETTINGS_SECURITY_NAV_ITEMS = ["Non-HTTP Link Policy"] as const;
const HELP_SETTINGS_NOTES_NAV_ITEMS = [
  "TOME Enabled",
  "TOME Root Path",
  "Restore TOME Guides",
] as const;
const HELP_SETTINGS_CLOUD_NAV_ITEMS = [
  "Cloud Backup Enabled",
  "Owner/Repo",
  "Branch",
  "Auto Push Policy",
  "Device ID",
  "Path Prefix",
  "Open Cloud Operations",
] as const;
const HELP_THEME_NAV_ITEMS = [
  "Current Theme",
  "Custom1",
  "Text Tuning",
] as const;
const HELP_CUSTOM1_NAV_ITEMS = ["Edit Colors"] as const;
const HELP_TEXT_TUNING_THEME_NAV_ITEMS = ["Edit Text Colors"] as const;
const HELP_KEYMAP_ALIAS_NAV_ITEMS = [
  "List aliases",
  "Dashboard aliases",
  "Backup aliases",
  "Help aliases",
  "Reset all aliases",
] as const;
const KEYMAP_ALIAS_PRESET_CONTEXT_ORDER: KeymapAliasPresetContext[] = [
  "list",
  "dashboard",
  "backup",
  "help",
];
const KEYMAP_ALIAS_PRESETS_BY_CONTEXT: Record<
  KeymapAliasPresetContext,
  KeymapAliasConfig
> = {
  list: {
    list_open_search: ["Ctrl+F"],
    list_open_add: ["n"],
  },
  dashboard: {
    dashboard_move_up: ["k"],
    dashboard_move_down: ["j"],
    dashboard_open_help: ["h"],
  },
  backup: {
    backup_back: ["q"],
    backup_move_up: ["k"],
    backup_move_down: ["j"],
  },
  help: {
    help_move_up: ["k"],
    help_move_down: ["j"],
    help_nav_back: ["h"],
    help_nav_forward: ["l"],
    help_close: ["q"],
  },
};

const HELP_SETTINGS_APPEARANCE_NAV_INDEX = HELP_SETTINGS_NAV_ITEMS.indexOf(
  "Appearance",
);
const HELP_SETTINGS_NAVIGATION_NAV_INDEX = HELP_SETTINGS_NAV_ITEMS.indexOf(
  "Navigation & Keymaps",
);
const HELP_SETTINGS_NOTIFICATIONS_NAV_INDEX = HELP_SETTINGS_NAV_ITEMS.indexOf(
  "Notifications",
);
const HELP_SETTINGS_SECURITY_NAV_INDEX = HELP_SETTINGS_NAV_ITEMS.indexOf(
  "Security",
);
const HELP_SETTINGS_NOTES_NAV_INDEX = HELP_SETTINGS_NAV_ITEMS.indexOf(
  "TOME Notes",
);
const HELP_SETTINGS_CLOUD_NAV_INDEX = HELP_SETTINGS_NAV_ITEMS.indexOf(
  "Cloud Backup",
);
const HELP_SETTINGS_APPEARANCE_THEME_NAV_INDEX =
  HELP_SETTINGS_APPEARANCE_NAV_ITEMS.indexOf("Theme");
const HELP_SETTINGS_APPEARANCE_LOGO_NAV_INDEX =
  HELP_SETTINGS_APPEARANCE_NAV_ITEMS.indexOf("Logo");
const HELP_SETTINGS_APPEARANCE_FLASH_NAV_INDEX =
  HELP_SETTINGS_APPEARANCE_NAV_ITEMS.indexOf("Flash Mode");
const HELP_SETTINGS_APPEARANCE_CRT_FX_NAV_INDEX =
  HELP_SETTINGS_APPEARANCE_NAV_ITEMS.indexOf("CRT FX Lite");
const HELP_SETTINGS_APPEARANCE_CRT_FX_PROFILE_NAV_INDEX =
  HELP_SETTINGS_APPEARANCE_NAV_ITEMS.indexOf("CRT FX Profile");
const HELP_SETTINGS_APPEARANCE_RETRO_FX_MODE_NAV_INDEX =
  HELP_SETTINGS_APPEARANCE_NAV_ITEMS.indexOf("Retro FX Mode");
const HELP_SETTINGS_NAVIGATION_KEYMAP_ALIASES_NAV_INDEX =
  HELP_SETTINGS_NAVIGATION_NAV_ITEMS.indexOf("Keymap Aliases");
const HELP_SETTINGS_NAVIGATION_HINTS_NAV_INDEX =
  HELP_SETTINGS_NAVIGATION_NAV_ITEMS.indexOf("Navigation Hints");
const HELP_SETTINGS_NAVIGATION_PREFIX_POPUP_NAV_INDEX =
  HELP_SETTINGS_NAVIGATION_NAV_ITEMS.indexOf("Prefix Popup");
const HELP_SETTINGS_NOTIFICATIONS_ENABLED_NAV_INDEX =
  HELP_SETTINGS_NOTIFICATIONS_NAV_ITEMS.indexOf("Notifications");
const HELP_SETTINGS_NOTIFICATIONS_OVERDUE_POPUP_NAV_INDEX =
  HELP_SETTINGS_NOTIFICATIONS_NAV_ITEMS.indexOf("Overdue Popup");
const HELP_SETTINGS_NOTIFICATIONS_TERMINAL_BELL_NAV_INDEX =
  HELP_SETTINGS_NOTIFICATIONS_NAV_ITEMS.indexOf("Terminal Bell");
const HELP_SETTINGS_NOTIFICATIONS_OUT_OF_APP_REMINDERS_NAV_INDEX =
  HELP_SETTINGS_NOTIFICATIONS_NAV_ITEMS.indexOf("Out-of-App Reminders");
const HELP_SETTINGS_NOTIFICATIONS_HELPER_INSTALL_NAV_INDEX =
  HELP_SETTINGS_NOTIFICATIONS_NAV_ITEMS.indexOf("Reminder Helper Install");
const HELP_SETTINGS_NOTIFICATIONS_HELPER_STATUS_NAV_INDEX =
  HELP_SETTINGS_NOTIFICATIONS_NAV_ITEMS.indexOf("Reminder Helper Status");
const HELP_SETTINGS_NOTIFICATIONS_HELPER_TEST_NAV_INDEX =
  HELP_SETTINGS_NOTIFICATIONS_NAV_ITEMS.indexOf("Reminder Helper Test");
const HELP_SETTINGS_NOTIFICATIONS_HELPER_UNINSTALL_NAV_INDEX =
  HELP_SETTINGS_NOTIFICATIONS_NAV_ITEMS.indexOf("Reminder Helper Uninstall");
const HELP_SETTINGS_NOTIFICATIONS_BANNER_DURATION_NAV_INDEX =
  HELP_SETTINGS_NOTIFICATIONS_NAV_ITEMS.indexOf("Banner Duration");
const HELP_SETTINGS_NOTIFICATIONS_BELL_COOLDOWN_NAV_INDEX =
  HELP_SETTINGS_NOTIFICATIONS_NAV_ITEMS.indexOf("Bell Cooldown");
const HELP_SETTINGS_SECURITY_NON_HTTP_POLICY_NAV_INDEX =
  HELP_SETTINGS_SECURITY_NAV_ITEMS.indexOf("Non-HTTP Link Policy");
const HELP_SETTINGS_NOTES_ENABLED_NAV_INDEX =
  HELP_SETTINGS_NOTES_NAV_ITEMS.indexOf("TOME Enabled");
const HELP_SETTINGS_NOTES_ROOT_NAV_INDEX =
  HELP_SETTINGS_NOTES_NAV_ITEMS.indexOf("TOME Root Path");
const HELP_SETTINGS_NOTES_RESTORE_GUIDES_NAV_INDEX =
  HELP_SETTINGS_NOTES_NAV_ITEMS.indexOf("Restore TOME Guides");
const HELP_SETTINGS_CLOUD_ENABLED_NAV_INDEX =
  HELP_SETTINGS_CLOUD_NAV_ITEMS.indexOf("Cloud Backup Enabled");
const HELP_SETTINGS_CLOUD_OWNER_REPO_NAV_INDEX =
  HELP_SETTINGS_CLOUD_NAV_ITEMS.indexOf("Owner/Repo");
const HELP_SETTINGS_CLOUD_BRANCH_NAV_INDEX =
  HELP_SETTINGS_CLOUD_NAV_ITEMS.indexOf("Branch");
const HELP_SETTINGS_CLOUD_AUTO_PUSH_POLICY_NAV_INDEX =
  HELP_SETTINGS_CLOUD_NAV_ITEMS.indexOf("Auto Push Policy");
const HELP_SETTINGS_CLOUD_DEVICE_ID_NAV_INDEX =
  HELP_SETTINGS_CLOUD_NAV_ITEMS.indexOf("Device ID");
const HELP_SETTINGS_CLOUD_PATH_PREFIX_NAV_INDEX =
  HELP_SETTINGS_CLOUD_NAV_ITEMS.indexOf("Path Prefix");
const HELP_SETTINGS_CLOUD_OPEN_OPERATIONS_NAV_INDEX =
  HELP_SETTINGS_CLOUD_NAV_ITEMS.indexOf("Open Cloud Operations");
const HELP_KEYMAP_ALIAS_RESET_NAV_INDEX =
  HELP_KEYMAP_ALIAS_NAV_ITEMS.indexOf("Reset all aliases");

type HelpSettingsRuntimeDeps = {
  uiState: UIState;
  uiDispatch: (action: unknown) => void;
  settingsState: SettingsState;
  settingsDispatch: (action: unknown) => void;
  clearPendingGPrefix: () => void;
  closeViewsOverlay: () => void;
  showShortNavigationBanner: (message: string) => void;
  normalizeErrorDetail: (error: unknown) => string;
  requestTaskEditorUnsavedGuard: (
    continuation: UITaskEditorUnsavedContinuation,
  ) => boolean;
  openUnsavedChangesModal: (modal: UIUnsavedChangesModal) => void;
  openBackupCenter: () => void;
  openGitHubCloudStatus: () => void;
  resolveNotesService: () => ReturnType<typeof createNotesService> | null;
  notesRuntime: {
    ready: boolean;
    enabled: boolean;
    notesRoot: string;
    error?: string;
  };
  notesOpenPath: NotePath | null;
  hydrateOpenNote: (path: NotePath) => Promise<void>;
  setNotesList: (value: unknown) => void;
  setNotesRuntime: (value: unknown) => void;
  clampNotesSelectionToAvailable: () => void;
  getReminderHelperCommands: () => string[];
  createDefaultHelpExpandedState: () => boolean[];
  helpFocusedSectionRef: React.MutableRefObject<number>;
  helpScrollTopRef: React.MutableRefObject<number>;
  normalizeHelpReturnContext: (
    mode: Mode,
    focus: FocusTarget,
  ) => { mode: Mode; focus: FocusTarget };
};

function createDefaultHelpNavSelection(): HelpNavSelectionByPage {
  return {
    settings: 0,
    settingsAppearance: 0,
    settingsNavigation: 0,
    settingsNotifications: 0,
    settingsSecurity: 0,
    settingsNotes: 0,
    settingsCloud: 0,
    keymapAliases: 0,
    theme: 0,
    custom1: 0,
    textTuning: 0,
    textTuningTheme: 0,
  };
}

function cloneThemeTokens(tokens: ThemeTokens): ThemeTokens {
  return { ...tokens };
}

function cloneThemeObjectOverrides(
  objects: Partial<Record<ThemeObjectId, Partial<ThemeTokens>>> | undefined,
): Partial<Record<ThemeObjectId, Partial<ThemeTokens>>> {
  if (!objects) return {};
  const next: Partial<Record<ThemeObjectId, Partial<ThemeTokens>>> = {};
  for (const [objectId, overrides] of Object.entries(objects) as Array<
    [ThemeObjectId, Partial<ThemeTokens>]
  >) {
    next[objectId] = { ...overrides };
  }
  return next;
}

function resolveCustom1Config(
  customThemes: CustomThemes | undefined,
): CustomThemeConfig {
  const fallback = getDefaultSettings().customThemes?.custom1?.global;
  if (!fallback) {
    throw new Error("Default custom1 theme is unavailable.");
  }
  const global = customThemes?.custom1?.global ?? fallback;
  return {
    global: cloneThemeTokens(global),
    objects: cloneThemeObjectOverrides(customThemes?.custom1?.objects),
  };
}

function cloneThemeTextTokenOverrides(
  overrides: ThemeTextTokenOverrides | undefined,
): ThemeTextTokenOverrides {
  if (!overrides) return {};
  return { ...overrides };
}

function cloneThemeTextObjectOverrides(
  objects: Partial<Record<ThemeObjectId, ThemeTextTokenOverrides>> | undefined,
): Partial<Record<ThemeObjectId, ThemeTextTokenOverrides>> {
  if (!objects) return {};
  const next: Partial<Record<ThemeObjectId, ThemeTextTokenOverrides>> = {};
  for (const [objectId, overrides] of Object.entries(objects) as Array<
    [ThemeObjectId, ThemeTextTokenOverrides]
  >) {
    next[objectId] = { ...overrides };
  }
  return next;
}

function sanitizeDraftObjects(
  objects: Partial<Record<ThemeObjectId, Partial<ThemeTokens>>>,
): Partial<Record<ThemeObjectId, Partial<ThemeTokens>>> | undefined {
  const next: Partial<Record<ThemeObjectId, Partial<ThemeTokens>>> = {};
  for (const [objectId, tokens] of Object.entries(objects) as Array<
    [ThemeObjectId, Partial<ThemeTokens>]
  >) {
    if (Object.keys(tokens).length > 0) {
      next[objectId] = { ...tokens };
    }
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function sanitizeThemeTextTokenOverrides(
  overrides: ThemeTextTokenOverrides,
): ThemeTextTokenOverrides | undefined {
  const next: ThemeTextTokenOverrides = {};
  if (overrides.text) next.text = overrides.text;
  if (overrides.mutedText) next.mutedText = overrides.mutedText;
  if (overrides.selectionText) next.selectionText = overrides.selectionText;
  return Object.keys(next).length > 0 ? next : undefined;
}

function sanitizeThemeTextObjectOverrides(
  objects: Partial<Record<ThemeObjectId, ThemeTextTokenOverrides>>,
): Partial<Record<ThemeObjectId, ThemeTextTokenOverrides>> | undefined {
  const next: Partial<Record<ThemeObjectId, ThemeTextTokenOverrides>> = {};
  for (const [objectId, overrides] of Object.entries(objects) as Array<
    [ThemeObjectId, ThemeTextTokenOverrides]
  >) {
    const sanitized = sanitizeThemeTextTokenOverrides(overrides);
    if (sanitized) {
      next[objectId] = sanitized;
    }
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function resolveBuiltInThemeTextConfig(
  customThemes: CustomThemes | undefined,
  themeId: RotatingThemeId,
): BuiltInThemeTextOverrideConfig {
  const source = customThemes?.textByTheme?.[themeId];
  return {
    global: cloneThemeTextTokenOverrides(source?.global),
    objects: cloneThemeTextObjectOverrides(source?.objects),
  };
}

function formatHintDisplayModeLabel(mode: HintDisplayMode): string {
  if (mode === "left_rail") return "Left rail only";
  if (mode === "both") return "Both";
  if (mode === "none") return "None";
  return "Bottom only";
}

function formatHintDisplayModeStatusLabel(mode: HintDisplayMode): string {
  if (mode === "left_rail") return "left rail only";
  if (mode === "both") return "both";
  if (mode === "none") return "none";
  return "bottom only";
}

function formatGitHubAutoPushPolicyLabel(policy: GitHubAutoPushPolicy): string {
  if (policy === "onExit") return "On exit";
  if (policy === "interval15m") return "Every 15m";
  return "Off";
}

function cycleGitHubAutoPushPolicy(
  policy: GitHubAutoPushPolicy,
): GitHubAutoPushPolicy {
  const order = ["off", "onExit", "interval15m"] as const;
  const index = order.indexOf(policy);
  const safeIndex = index >= 0 ? index : 0;
  return order[(safeIndex + 1) % order.length];
}

function formatNonHttpLinkPolicyLabel(policy: "prompt" | "block"): string {
  return policy === "block" ? "Block" : "Prompt";
}

function cloneKeymapAliasConfig(config: KeymapAliasConfig): KeymapAliasConfig {
  const next: KeymapAliasConfig = {};
  for (const [actionId, tokens] of Object.entries(config)) {
    next[actionId as keyof KeymapAliasConfig] = [...tokens];
  }
  return next;
}

function cloneKeymapAliases(
  aliases: KeymapAliases | undefined,
): KeymapAliases | undefined {
  if (!aliases) return undefined;
  const next: KeymapAliases = {};
  for (const context of KEYMAP_ALIAS_PRESET_CONTEXT_ORDER) {
    const config = aliases[context];
    if (!config) continue;
    next[context] = cloneKeymapAliasConfig(config);
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function areKeymapAliasConfigsEqual(
  left: KeymapAliasConfig | undefined,
  right: KeymapAliasConfig,
): boolean {
  const leftKeys = Object.keys(left ?? {}).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  for (let index = 0; index < rightKeys.length; index += 1) {
    if (leftKeys[index] !== rightKeys[index]) return false;
    const key = rightKeys[index] as keyof KeymapAliasConfig;
    const leftTokens = left?.[key] ?? [];
    const rightTokens = right[key] ?? [];
    if (leftTokens.length !== rightTokens.length) return false;
    for (let tokenIndex = 0; tokenIndex < rightTokens.length; tokenIndex += 1) {
      if (leftTokens[tokenIndex] !== rightTokens[tokenIndex]) return false;
    }
  }
  return true;
}

function resolveKeymapAliasPresetState(
  context: KeymapAliasPresetContext,
  aliases: KeymapAliases | undefined,
): KeymapAliasPresetState {
  const config = aliases?.[context];
  if (!config) return "off";
  return areKeymapAliasConfigsEqual(
    config,
    KEYMAP_ALIAS_PRESETS_BY_CONTEXT[context],
  )
    ? "preset"
    : "custom";
}

function resolveNavLengthForPage(page: HelpPage): number {
  if (page === "settings") return HELP_SETTINGS_NAV_ITEMS.length;
  if (page === "settingsAppearance") return HELP_SETTINGS_APPEARANCE_NAV_ITEMS.length;
  if (page === "settingsNavigation") return HELP_SETTINGS_NAVIGATION_NAV_ITEMS.length;
  if (page === "settingsNotifications")
    return HELP_SETTINGS_NOTIFICATIONS_NAV_ITEMS.length;
  if (page === "settingsSecurity") return HELP_SETTINGS_SECURITY_NAV_ITEMS.length;
  if (page === "settingsNotes") return HELP_SETTINGS_NOTES_NAV_ITEMS.length;
  if (page === "settingsCloud") return HELP_SETTINGS_CLOUD_NAV_ITEMS.length;
  if (page === "keymapAliases") return HELP_KEYMAP_ALIAS_NAV_ITEMS.length;
  if (page === "theme") return HELP_THEME_NAV_ITEMS.length;
  if (page === "custom1") return HELP_CUSTOM1_NAV_ITEMS.length;
  if (page === "textTuning") return HELP_TEXT_TUNING_THEMES.length;
  if (page === "textTuningTheme") return HELP_TEXT_TUNING_THEME_NAV_ITEMS.length;
  return 0;
}

function getHelpNavSelectionIndexForPage(
  page: HelpPage,
  selection: HelpNavSelectionByPage,
): number {
  if (page === "settings") return selection.settings;
  if (page === "settingsAppearance") return selection.settingsAppearance;
  if (page === "settingsNavigation") return selection.settingsNavigation;
  if (page === "settingsNotifications") return selection.settingsNotifications;
  if (page === "settingsSecurity") return selection.settingsSecurity;
  if (page === "settingsNotes") return selection.settingsNotes;
  if (page === "settingsCloud") return selection.settingsCloud;
  if (page === "keymapAliases") return selection.keymapAliases;
  if (page === "theme") return selection.theme;
  if (page === "custom1") return selection.custom1;
  if (page === "textTuning") return selection.textTuning;
  if (page === "textTuningTheme") return selection.textTuningTheme;
  return 0;
}

export function useHelpSettingsRuntime(deps: HelpSettingsRuntimeDeps) {
  const [helpExpandedBySection, setHelpExpandedBySection] = useState<boolean[]>(
    deps.createDefaultHelpExpandedState,
  );
  const [helpFocusedSectionIndex, setHelpFocusedSectionIndex] = useState(0);
  const [helpScrollOffset, setHelpScrollOffset] = useState(0);
  const [helpNavScrollOffset, setHelpNavScrollOffset] = useState(0);
  const [helpNavStack, setHelpNavStack] = useState<HelpPage[]>(["help"]);
  const [helpNavSelection, setHelpNavSelection] =
    useState<HelpNavSelectionByPage>(createDefaultHelpNavSelection);
  const [helpSettingsInputField, setHelpSettingsInputField] =
    useState<HelpSettingsInputField | null>(null);
  const [helpSettingsInputValue, setHelpSettingsInputValue] = useState("");
  const [helpSettingsInputApplying, setHelpSettingsInputApplying] =
    useState(false);
  const [helpSettingsInputError, setHelpSettingsInputError] = useState<
    string | null
  >(null);
  const [helpPreviewThemeMode, setHelpPreviewThemeMode] =
    useState<ThemeId | null>(null);
  const [helpDraftLogoMode, setHelpDraftLogoMode] = useState<LogoMode | null>(
    null,
  );
  const [helpTextTuningThemeId, setHelpTextTuningThemeId] =
    useState<RotatingThemeId>(HELP_TEXT_TUNING_THEMES[0] ?? "default");
  const [custom1DraftGlobal, setCustom1DraftGlobal] = useState<ThemeTokens>(
    () => resolveCustom1Config(deps.settingsState.customThemes).global,
  );
  const [custom1DraftObjects, setCustom1DraftObjects] = useState<
    Partial<Record<ThemeObjectId, Partial<ThemeTokens>>>
  >(() => resolveCustom1Config(deps.settingsState.customThemes).objects ?? {});
  const [builtInTextDraftGlobal, setBuiltInTextDraftGlobal] =
    useState<ThemeTextTokenOverrides>({});
  const [builtInTextDraftObjects, setBuiltInTextDraftObjects] = useState<
    Partial<Record<ThemeObjectId, ThemeTextTokenOverrides>>
  >({});
  const helpReturnContextRef = useRef({
    mode: Mode.LIST,
    focus: FocusTarget.TASK_LIST,
  });
  const helpPreviewRestoreThemeRef = useRef<ThemeId | null>(null);

  const activeHelpPage = helpNavStack[helpNavStack.length - 1] ?? "help";
  const persistedCustom1 = useMemo(
    () => resolveCustom1Config(deps.settingsState.customThemes),
    [deps.settingsState.customThemes],
  );
  const persistedBuiltInTextConfig = useMemo(
    () =>
      resolveBuiltInThemeTextConfig(
        deps.settingsState.customThemes,
        helpTextTuningThemeId,
      ),
    [deps.settingsState.customThemes, helpTextTuningThemeId],
  );
  const builtInTextBaseTokens = useMemo(
    () => ({
      text: THEMES[helpTextTuningThemeId].text,
      mutedText: THEMES[helpTextTuningThemeId].mutedText,
      selectionText: THEMES[helpTextTuningThemeId].selectionText,
    }),
    [helpTextTuningThemeId],
  );
  const custom1Draft: CustomThemeConfig = useMemo(
    () => ({
      global: custom1DraftGlobal,
      objects:
        Object.keys(custom1DraftObjects).length > 0
          ? custom1DraftObjects
          : undefined,
    }),
    [custom1DraftGlobal, custom1DraftObjects],
  );
  const builtInTextDraft: BuiltInThemeTextOverrides = useMemo(() => {
    const global = sanitizeThemeTextTokenOverrides(builtInTextDraftGlobal);
    const objects = sanitizeThemeTextObjectOverrides(builtInTextDraftObjects);
    if (!global && !objects) {
      return {};
    }
    const config: BuiltInThemeTextOverrideConfig = {};
    if (global) {
      config.global = global;
    }
    if (objects) {
      config.objects = objects;
    }
    return {
      [helpTextTuningThemeId]: config,
    };
  }, [builtInTextDraftGlobal, builtInTextDraftObjects, helpTextTuningThemeId]);
  const helpCloudSettings = useMemo(
    () => resolveGitHubSettings(deps.settingsState),
    [deps.settingsState],
  );
  const helpSettingsInputTitle = helpSettingsInputField
    ? resolveHelpSettingsInputTitle(helpSettingsInputField)
    : "Settings Value";
  const helpSettingsInputPlaceholder = helpSettingsInputField
    ? resolveHelpSettingsInputPlaceholder(helpSettingsInputField)
    : "Type value";
  const helpKeymapAliasPresetStates = useMemo(
    () =>
      ({
        list: resolveKeymapAliasPresetState(
          "list",
          deps.settingsState.keymapAliases,
        ),
        dashboard: resolveKeymapAliasPresetState(
          "dashboard",
          deps.settingsState.keymapAliases,
        ),
        backup: resolveKeymapAliasPresetState(
          "backup",
          deps.settingsState.keymapAliases,
        ),
        help: resolveKeymapAliasPresetState(
          "help",
          deps.settingsState.keymapAliases,
        ),
      }) as const,
    [deps.settingsState.keymapAliases],
  );

  function pushHelpPage(page: HelpPage) {
    setHelpNavStack((prev) => {
      if (prev[prev.length - 1] === page) return prev;
      return [...prev, page];
    });
    deps.helpScrollTopRef.current = 0;
    setHelpScrollOffset(0);
    setHelpNavScrollOffset(0);
  }

  function popHelpPage() {
    setHelpNavStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
    deps.helpScrollTopRef.current = 0;
    setHelpScrollOffset(0);
    setHelpNavScrollOffset(0);
  }

  function isCustom1EditorDirty(): boolean {
    const persistedObjects =
      sanitizeDraftObjects(persistedCustom1.objects ?? {}) ?? {};
    const draftObjects = sanitizeDraftObjects(custom1DraftObjects) ?? {};
    return (
      stableSerialize(persistedCustom1.global) !==
        stableSerialize(custom1DraftGlobal) ||
      stableSerialize(persistedObjects) !== stableSerialize(draftObjects)
    );
  }

  function isBuiltInTextEditorDirty(): boolean {
    const persistedGlobal = sanitizeThemeTextTokenOverrides(
      persistedBuiltInTextConfig.global,
    );
    const persistedObjects = sanitizeThemeTextObjectOverrides(
      persistedBuiltInTextConfig.objects,
    );
    const draftGlobal = sanitizeThemeTextTokenOverrides(builtInTextDraftGlobal);
    const draftObjects = sanitizeThemeTextObjectOverrides(
      builtInTextDraftObjects,
    );
    return (
      stableSerialize(persistedGlobal ?? {}) !==
        stableSerialize(draftGlobal ?? {}) ||
      stableSerialize(persistedObjects ?? {}) !==
        stableSerialize(draftObjects ?? {})
    );
  }

  function requestHelpThemeEditorUnsavedGuard(
    source: HelpThemeEditorSource,
    continuation: UIHelpThemeUnsavedContinuation,
  ): boolean {
    if (deps.uiState.mode !== Mode.HELP) return false;
    const matchesSource =
      (source === "help_custom1_editor" && activeHelpPage === "custom1Edit") ||
      (source === "help_text_tuning_editor" &&
        activeHelpPage === "textTuningEdit");
    if (!matchesSource) return false;
    const dirty =
      source === "help_custom1_editor"
        ? isCustom1EditorDirty()
        : isBuiltInTextEditorDirty();
    if (!dirty) return false;
    deps.openUnsavedChangesModal({
      type: "unsaved_changes",
      source,
      continuation,
      previousMode: Mode.HELP,
      previousFocus: deps.uiState.focus,
    });
    return true;
  }

  function openHelp(options: { bypassUnsavedGuard?: boolean } = {}) {
    if (
      !options.bypassUnsavedGuard &&
      deps.requestTaskEditorUnsavedGuard("open_help")
    ) {
      return;
    }
    deps.clearPendingGPrefix();
    setHelpExpandedBySection(deps.createDefaultHelpExpandedState());
    deps.helpFocusedSectionRef.current = 0;
    setHelpFocusedSectionIndex(0);
    deps.helpScrollTopRef.current = 0;
    setHelpScrollOffset(0);
    setHelpNavScrollOffset(0);
    setHelpNavStack(["help"]);
    setHelpNavSelection(createDefaultHelpNavSelection());
    setHelpTextTuningThemeId(HELP_TEXT_TUNING_THEMES[0] ?? "default");
    setHelpPreviewThemeMode(null);
    setHelpDraftLogoMode(null);
    setHelpSettingsInputField(null);
    setHelpSettingsInputValue("");
    setHelpSettingsInputApplying(false);
    setHelpSettingsInputError(null);
    setBuiltInTextDraftGlobal({});
    setBuiltInTextDraftObjects({});
    helpPreviewRestoreThemeRef.current = null;
    helpReturnContextRef.current = {
      mode: deps.uiState.mode,
      focus: deps.uiState.focus,
    };
    deps.uiDispatch({
      type: "captureReturnContext",
      mode: deps.uiState.mode,
      focus: deps.uiState.focus,
    });
    deps.uiDispatch({ type: "setMode", mode: Mode.HELP });
  }

  function openCustom1Editor() {
    const persisted = resolveCustom1Config(deps.settingsState.customThemes);
    setCustom1DraftGlobal(cloneThemeTokens(persisted.global));
    setCustom1DraftObjects(cloneThemeObjectOverrides(persisted.objects));
    helpPreviewRestoreThemeRef.current = deps.settingsState.themeId;
    setHelpPreviewThemeMode("custom1");
    pushHelpPage("custom1Edit");
  }

  function closeCustom1EditorCancel() {
    const persisted = resolveCustom1Config(deps.settingsState.customThemes);
    const restoreTheme = helpPreviewRestoreThemeRef.current;
    setCustom1DraftGlobal(cloneThemeTokens(persisted.global));
    setCustom1DraftObjects(cloneThemeObjectOverrides(persisted.objects));
    setHelpPreviewThemeMode(null);
    if (restoreTheme && deps.settingsState.themeId !== restoreTheme) {
      deps.settingsDispatch({ type: "setTheme", themeId: restoreTheme });
    }
    helpPreviewRestoreThemeRef.current = null;
    setHelpNavStack((prev) =>
      prev[prev.length - 1] === "custom1Edit" ? prev.slice(0, -1) : prev,
    );
  }

  function saveCustom1Editor(): boolean {
    const objects = sanitizeDraftObjects(custom1DraftObjects);
    const contrastResult = validateCustomThemeContrast({
      global: custom1DraftGlobal,
      objects,
      baselineGlobal: persistedCustom1.global,
      baselineObjects: persistedCustom1.objects,
    });
    if (!contrastResult.ok) {
      const firstIssue = contrastResult.issues[0];
      deps.showShortNavigationBanner(
        firstIssue
          ? `Theme save blocked: ${formatContrastIssueForBanner(firstIssue)}`
          : "Theme save blocked by contrast gate",
      );
      return false;
    }
    deps.settingsDispatch({
      type: "setCustomThemes",
      customThemes: {
        ...(deps.settingsState.customThemes ?? {}),
        custom1: objects
          ? { global: cloneThemeTokens(custom1DraftGlobal), objects }
          : { global: cloneThemeTokens(custom1DraftGlobal) },
      },
    });
    deps.settingsDispatch({ type: "setTheme", themeId: "custom1" });
    setHelpPreviewThemeMode(null);
    helpPreviewRestoreThemeRef.current = null;
    setHelpNavStack((prev) =>
      prev[prev.length - 1] === "custom1Edit" ? prev.slice(0, -1) : prev,
    );
    deps.showShortNavigationBanner("Custom1 theme saved");
    return true;
  }

  function openBuiltInTextEditor() {
    setBuiltInTextDraftGlobal(
      cloneThemeTextTokenOverrides(persistedBuiltInTextConfig.global),
    );
    setBuiltInTextDraftObjects(
      cloneThemeTextObjectOverrides(persistedBuiltInTextConfig.objects),
    );
    helpPreviewRestoreThemeRef.current = deps.settingsState.themeId;
    setHelpPreviewThemeMode(helpTextTuningThemeId);
    pushHelpPage("textTuningEdit");
  }

  function closeBuiltInTextEditorCancel() {
    const restoreTheme = helpPreviewRestoreThemeRef.current;
    setBuiltInTextDraftGlobal(
      cloneThemeTextTokenOverrides(persistedBuiltInTextConfig.global),
    );
    setBuiltInTextDraftObjects(
      cloneThemeTextObjectOverrides(persistedBuiltInTextConfig.objects),
    );
    setHelpPreviewThemeMode(null);
    if (restoreTheme && deps.settingsState.themeId !== restoreTheme) {
      deps.settingsDispatch({ type: "setTheme", themeId: restoreTheme });
    }
    helpPreviewRestoreThemeRef.current = null;
    setHelpNavStack((prev) =>
      prev[prev.length - 1] === "textTuningEdit" ? prev.slice(0, -1) : prev,
    );
  }

  function saveBuiltInTextEditor(): boolean {
    const sanitizedGlobal = sanitizeThemeTextTokenOverrides(
      builtInTextDraftGlobal,
    );
    const sanitizedObjects = sanitizeThemeTextObjectOverrides(
      builtInTextDraftObjects,
    );
    const contrastResult = validateBuiltInTextContrast({
      themeId: helpTextTuningThemeId,
      global: sanitizedGlobal,
      objects: sanitizedObjects,
      baselineGlobal: persistedBuiltInTextConfig.global,
      baselineObjects: persistedBuiltInTextConfig.objects,
    });
    if (!contrastResult.ok) {
      const firstIssue = contrastResult.issues[0];
      deps.showShortNavigationBanner(
        firstIssue
          ? `Text tuning blocked: ${formatContrastIssueForBanner(firstIssue)}`
          : "Text tuning blocked by contrast gate",
      );
      return false;
    }

    const existingTextByTheme = {
      ...(deps.settingsState.customThemes?.textByTheme ?? {}),
    };
    if (!sanitizedGlobal && !sanitizedObjects) {
      delete existingTextByTheme[helpTextTuningThemeId];
    } else {
      const nextConfig: BuiltInThemeTextOverrideConfig = {};
      if (sanitizedGlobal) {
        nextConfig.global = sanitizedGlobal;
      }
      if (sanitizedObjects) {
        nextConfig.objects = sanitizedObjects;
      }
      existingTextByTheme[helpTextTuningThemeId] = nextConfig;
    }

    const nextCustomThemes: CustomThemes = {
      ...(deps.settingsState.customThemes ?? {}),
    };
    if (Object.keys(existingTextByTheme).length > 0) {
      nextCustomThemes.textByTheme = existingTextByTheme;
    } else {
      delete nextCustomThemes.textByTheme;
    }
    deps.settingsDispatch({
      type: "setCustomThemes",
      customThemes: nextCustomThemes,
    });

    const restoreTheme = helpPreviewRestoreThemeRef.current;
    setHelpPreviewThemeMode(null);
    if (restoreTheme && deps.settingsState.themeId !== restoreTheme) {
      deps.settingsDispatch({ type: "setTheme", themeId: restoreTheme });
    }
    helpPreviewRestoreThemeRef.current = null;
    setHelpNavStack((prev) =>
      prev[prev.length - 1] === "textTuningEdit" ? prev.slice(0, -1) : prev,
    );
    deps.showShortNavigationBanner(
      `${formatThemeDisplayName(helpTextTuningThemeId)} text colors saved`,
    );
    return true;
  }

  function cycleLogoModeSetting(direction: 1 | -1, commit: boolean) {
    const baseMode = helpDraftLogoMode ?? deps.settingsState.logoMode;
    const nextMode = cycleLogoMode(baseMode, direction);
    if (!commit) {
      setHelpDraftLogoMode(nextMode);
      return;
    }
    setHelpDraftLogoMode(null);
    if (nextMode === deps.settingsState.logoMode) {
      return;
    }
    deps.settingsDispatch({ type: "setLogoMode", logoMode: nextMode });
    deps.showShortNavigationBanner(`Logo: ${formatLogoModeLabel(nextMode)}`);
  }

  function commitLogoModeSetting() {
    const nextMode = helpDraftLogoMode ?? deps.settingsState.logoMode;
    setHelpDraftLogoMode(null);
    if (nextMode === deps.settingsState.logoMode) {
      return;
    }
    deps.settingsDispatch({ type: "setLogoMode", logoMode: nextMode });
    deps.showShortNavigationBanner(`Logo: ${formatLogoModeLabel(nextMode)}`);
  }

  function cancelLogoModeSetting() {
    setHelpDraftLogoMode(null);
  }

  function cycleThemeModeSetting() {
    deps.settingsDispatch({ type: "cycleTheme" });
  }

  function cycleHintDisplayModeSetting() {
    const nextMode: HintDisplayMode =
      deps.settingsState.hintDisplayMode === "bottom"
        ? "left_rail"
        : deps.settingsState.hintDisplayMode === "left_rail"
          ? "both"
          : deps.settingsState.hintDisplayMode === "both"
            ? "none"
            : "bottom";
    deps.settingsDispatch({ type: "setHintDisplayMode", hintDisplayMode: nextMode });
    deps.showShortNavigationBanner(
      `Navigation hints: ${formatHintDisplayModeStatusLabel(nextMode)}`,
    );
  }

  function switchPrefixPopupSetting() {
    const nextEnabled = !deps.settingsState.showPrefixHintPopup;
    deps.settingsDispatch({
      type: "setShowPrefixHintPopup",
      showPrefixHintPopup: nextEnabled,
    });
    deps.showShortNavigationBanner(`Prefix popup: ${nextEnabled ? "on" : "off"}`);
  }

  function switchFlashModeSetting() {
    const nextMode: FlashMode =
      deps.settingsState.flashMode === "slow" ? "static" : "slow";
    deps.settingsDispatch({ type: "toggleFlashMode" });
    deps.showShortNavigationBanner(
      nextMode === "static"
        ? "Flash mode: static (overdue = red)"
        : "Flash mode: slow",
    );
  }

  function switchCrtFxLiteSetting() {
    const nextEnabled = !deps.settingsState.crtFxLite;
    deps.settingsDispatch({ type: "toggleCrtFxLite" });
    deps.showShortNavigationBanner(`CRT FX Lite: ${nextEnabled ? "on" : "off"}`);
  }

  function cycleCrtFxProfileSetting() {
    const nextProfile = cycleCrtFxLiteProfile({
      color: deps.settingsState.crtFxColor,
      preset: deps.settingsState.crtFxPreset,
    });
    deps.settingsDispatch({ type: "setCrtFxColor", crtFxColor: nextProfile.color });
    deps.settingsDispatch({
      type: "setCrtFxPreset",
      crtFxPreset: nextProfile.preset,
    });
    deps.showShortNavigationBanner(
      `CRT FX Profile: ${formatCrtFxLiteProfileLabel(nextProfile.color, nextProfile.preset)}`,
    );
  }

  function cycleRetroFxModeSetting() {
    const nextMode = cycleRetroFxMode(deps.settingsState.retroFxMode);
    deps.settingsDispatch({ type: "setRetroFxMode", retroFxMode: nextMode });
    deps.showShortNavigationBanner(
      `Retro FX Mode: ${formatRetroFxModeLabel(nextMode)}`,
    );
  }

  function switchNotificationsEnabledSetting() {
    const nextEnabled = !deps.settingsState.notifications.enabled;
    deps.settingsDispatch({ type: "toggleNotificationsEnabled" });
    deps.showShortNavigationBanner(`Notifications: ${nextEnabled ? "on" : "off"}`);
  }

  function switchInAppOverduePopupSetting() {
    const nextEnabled = !deps.settingsState.notifications.inAppOverdueBanner;
    deps.settingsDispatch({ type: "toggleInAppOverdueBanner" });
    deps.showShortNavigationBanner(`Overdue popup: ${nextEnabled ? "on" : "off"}`);
  }

  function switchTerminalBellSetting() {
    const nextEnabled = !deps.settingsState.notifications.terminalBellOnOverdue;
    deps.settingsDispatch({ type: "toggleTerminalBellOnOverdue" });
    deps.showShortNavigationBanner(`Terminal bell: ${nextEnabled ? "on" : "off"}`);
  }

  function switchOutOfAppRemindersSetting() {
    const nextEnabled = !deps.settingsState.notifications.outOfAppRemindersEnabled;
    deps.settingsDispatch({ type: "toggleOutOfAppRemindersEnabled" });
    deps.showShortNavigationBanner(
      `Out-of-app reminders: ${nextEnabled ? "on" : "off"}`,
    );
  }

  function showReminderHelperCommand(command: string) {
    deps.showShortNavigationBanner(command);
  }

  function cycleSecurityNonHttpLinkPolicySetting() {
    const nextPolicy =
      deps.settingsState.security.nonHttpLinkPolicy === "prompt"
        ? "block"
        : "prompt";
    deps.settingsDispatch({
      type: "setSecurity",
      security: {
        ...deps.settingsState.security,
        nonHttpLinkPolicy: nextPolicy,
      },
    });
    deps.showShortNavigationBanner(
      `Non-http links: ${nextPolicy === "block" ? "block" : "prompt"}`,
    );
  }

  function switchNotesEnabledSetting() {
    const nextEnabled = !deps.settingsState.notes.enabled;
    deps.settingsDispatch({
      type: "setNotes",
      notes: {
        ...deps.settingsState.notes,
        enabled: nextEnabled,
      },
    });
    deps.showShortNavigationBanner(`TOME: ${nextEnabled ? "enabled" : "disabled"}`);
  }

  function resolveHelpSettingsInputSeedValue(
    field: HelpSettingsInputField,
  ): string {
    const github = resolveGitHubSettings(deps.settingsState);
    if (field === "notificationsBannerDurationMs") {
      return String(deps.settingsState.notifications.bannerDurationMs);
    }
    if (field === "notificationsBellCooldownMs") {
      return String(deps.settingsState.notifications.bellCooldownMs);
    }
    if (field === "notesRootPath") {
      return deps.settingsState.notes.rootPath ?? deps.notesRuntime.notesRoot;
    }
    if (field === "cloudOwnerRepo") {
      return github?.ownerRepo ?? "";
    }
    if (field === "cloudBranch") {
      return github?.branch ?? DEFAULT_GITHUB_BACKUP_BRANCH;
    }
    if (field === "cloudDeviceId") {
      return github?.deviceId ?? getDefaultSettings().githubBackup?.deviceId ?? "";
    }
    return github?.pathPrefix ?? "";
  }

  function openHelpSettingsInput(field: HelpSettingsInputField) {
    setHelpSettingsInputField(field);
    setHelpSettingsInputValue(resolveHelpSettingsInputSeedValue(field));
    setHelpSettingsInputApplying(false);
    setHelpSettingsInputError(null);
    pushHelpPage("settingsInput");
  }

  function closeHelpSettingsInput() {
    if (helpSettingsInputApplying) return;
    setHelpSettingsInputField(null);
    setHelpSettingsInputValue("");
    setHelpSettingsInputError(null);
    popHelpPage();
  }

  function updateGitHubBackupSettings(patch: Partial<GitHubBackupSettings>) {
    const defaults = getDefaultSettings().githubBackup ?? getDefaultSettings().githubBackup;
    const current = resolveGitHubSettings(deps.settingsState) ?? defaults;
    if (!current || !defaults) return;

    const deviceId = (
      patch.deviceId ??
      current.deviceId ??
      defaults.deviceId
    ).trim();
    const safeDeviceId = deviceId.length > 0 ? deviceId : defaults.deviceId;
    const inferredPathPrefix = `tadoi/devices/${safeDeviceId}`;
    const nextPathPrefixCandidate =
      patch.pathPrefix ?? current.pathPrefix ?? inferredPathPrefix;
    const nextPathPrefix =
      nextPathPrefixCandidate.trim().length > 0
        ? nextPathPrefixCandidate.trim()
        : inferredPathPrefix;
    const hasOwnerRepoPatch = Object.prototype.hasOwnProperty.call(
      patch,
      "ownerRepo",
    );
    const nextOwnerRepoRaw = hasOwnerRepoPatch
      ? patch.ownerRepo
      : current.ownerRepo;
    const nextOwnerRepo =
      typeof nextOwnerRepoRaw === "string" && nextOwnerRepoRaw.trim().length > 0
        ? nextOwnerRepoRaw.trim()
        : null;
    const nextBranchRaw =
      patch.branch ?? current.branch ?? DEFAULT_GITHUB_BACKUP_BRANCH;
    const nextBranch =
      typeof nextBranchRaw === "string" && nextBranchRaw.trim().length > 0
        ? nextBranchRaw.trim()
        : DEFAULT_GITHUB_BACKUP_BRANCH;

    deps.settingsDispatch({
      type: "setGitHubBackup",
      githubBackup: {
        ...current,
        enabled: patch.enabled ?? current.enabled,
        ownerRepo: nextOwnerRepo,
        branch: nextBranch,
        deviceId: safeDeviceId,
        pathPrefix: nextPathPrefix,
        autoPushPolicy:
          patch.autoPushPolicy ??
          current.autoPushPolicy ??
          DEFAULT_GITHUB_AUTO_PUSH_POLICY,
      },
    });
  }

  function switchCloudBackupEnabledSetting() {
    const current = resolveGitHubSettings(deps.settingsState);
    const nextEnabled = !(current?.enabled === true);
    updateGitHubBackupSettings({ enabled: nextEnabled });
    deps.showShortNavigationBanner(`Cloud backup: ${nextEnabled ? "on" : "off"}`);
  }

  function cycleCloudAutoPushPolicySetting() {
    const currentPolicy =
      resolveGitHubSettings(deps.settingsState)?.autoPushPolicy ??
      DEFAULT_GITHUB_AUTO_PUSH_POLICY;
    const nextPolicy = cycleGitHubAutoPushPolicy(currentPolicy);
    updateGitHubBackupSettings({ autoPushPolicy: nextPolicy });
    deps.showShortNavigationBanner(
      `Cloud auto-push: ${formatGitHubAutoPushPolicyLabel(nextPolicy)}`,
    );
  }

  function openCloudBackupOperationsFromSettings() {
    deps.openBackupCenter();
    deps.openGitHubCloudStatus();
  }

  async function submitHelpSettingsInput(
    submittedValue?: string,
  ): Promise<void> {
    const field = helpSettingsInputField;
    if (!field || helpSettingsInputApplying) return;
    const rawValue = (submittedValue ?? helpSettingsInputValue).trim();
    setHelpSettingsInputError(null);

    if (
      field === "notificationsBannerDurationMs" ||
      field === "notificationsBellCooldownMs"
    ) {
      const parsed = Number.parseInt(rawValue, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setHelpSettingsInputError(
          "Value must be a positive integer (milliseconds).",
        );
        return;
      }
      if (field === "notificationsBannerDurationMs") {
        deps.settingsDispatch({
          type: "setNotifications",
          notifications: {
            ...deps.settingsState.notifications,
            bannerDurationMs: Math.floor(parsed),
          },
        });
        deps.showShortNavigationBanner(
          `Banner duration: ${String(Math.floor(parsed))}ms`,
        );
      } else {
        deps.settingsDispatch({
          type: "setNotifications",
          notifications: {
            ...deps.settingsState.notifications,
            bellCooldownMs: Math.floor(parsed),
          },
        });
        deps.showShortNavigationBanner(
          `Bell cooldown: ${String(Math.floor(parsed))}ms`,
        );
      }
      setHelpSettingsInputField(null);
      setHelpSettingsInputError(null);
      setHelpSettingsInputValue("");
      popHelpPage();
      return;
    }

    if (field === "notesRootPath") {
      const service = deps.resolveNotesService();
      if (!service) {
        setHelpSettingsInputError("Notes service unavailable.");
        return;
      }
      const nextRoot =
        rawValue.length > 0
          ? path.resolve(rawValue)
          : resolveNotesRootPath(getDataFilePath(), null);
      if (!isPathWithin(path.dirname(nextRoot), nextRoot)) {
        setHelpSettingsInputError("Invalid absolute root path.");
        return;
      }

      setHelpSettingsInputApplying(true);
      try {
        await createDataBackup(getDataFilePath());
        await service.migrateNotesRootCopyFirst(nextRoot);
        deps.settingsDispatch({
          type: "setNotes",
          notes: {
            enabled: true,
            rootPath: nextRoot,
          },
        });
        deps.setNotesList(service.listNotes());
        deps.setNotesRuntime({
          ready: true,
          enabled: true,
          notesRoot: nextRoot,
        });
        if (deps.notesOpenPath) {
          await deps.hydrateOpenNote(deps.notesOpenPath);
        }
        deps.showShortNavigationBanner(
          `TOME root migrated to ${redactPathForDisplay(nextRoot)}`,
        );
        setHelpSettingsInputField(null);
        setHelpSettingsInputValue("");
        setHelpSettingsInputError(null);
        popHelpPage();
      } catch (error: unknown) {
        setHelpSettingsInputError(deps.normalizeErrorDetail(error));
      } finally {
        setHelpSettingsInputApplying(false);
      }
      return;
    }

    if (field === "cloudOwnerRepo") {
      updateGitHubBackupSettings({
        ownerRepo: rawValue.length > 0 ? rawValue : null,
      });
      deps.showShortNavigationBanner(
        rawValue.length > 0 ? `Cloud repo: ${rawValue}` : "Cloud repo cleared",
      );
    } else if (field === "cloudBranch") {
      const nextBranch =
        rawValue.length > 0 ? rawValue : DEFAULT_GITHUB_BACKUP_BRANCH;
      updateGitHubBackupSettings({ branch: nextBranch });
      deps.showShortNavigationBanner(`Cloud branch: ${nextBranch}`);
    } else if (field === "cloudDeviceId") {
      if (rawValue.length === 0) {
        setHelpSettingsInputError("Device ID cannot be blank.");
        return;
      }
      updateGitHubBackupSettings({ deviceId: rawValue });
      deps.showShortNavigationBanner(`Cloud device ID: ${rawValue}`);
    } else if (field === "cloudPathPrefix") {
      if (rawValue.length === 0) {
        setHelpSettingsInputError("Path prefix cannot be blank.");
        return;
      }
      updateGitHubBackupSettings({ pathPrefix: rawValue });
      deps.showShortNavigationBanner(`Cloud path prefix: ${rawValue}`);
    }

    setHelpSettingsInputField(null);
    setHelpSettingsInputValue("");
    setHelpSettingsInputError(null);
    popHelpPage();
  }

  async function restoreTomeGuidesFromHelpSettings(): Promise<void> {
    const service = deps.resolveNotesService();
    if (!service) return;
    try {
      const restored = await service.restoreDefaultGuideDocs("restore_missing");
      if (restored.skippedReason === "disabled") {
        deps.showShortNavigationBanner("TOME is disabled in settings.");
        return;
      }
      deps.setNotesList(service.listNotes());
      deps.clampNotesSelectionToAvailable();
      if (restored.createdPaths.length === 0) {
        deps.showShortNavigationBanner(
          "All default guide notes are already present.",
        );
        return;
      }
      const count = restored.createdPaths.length;
      deps.showShortNavigationBanner(
        count === 1
          ? "Recovered 1 default guide note (existing notes unchanged)."
          : `Recovered ${String(count)} default guide notes (existing notes unchanged).`,
      );
    } catch (error: unknown) {
      deps.showShortNavigationBanner(
        `Failed to restore TOME guides: ${deps.normalizeErrorDetail(error)}`,
      );
    }
  }

  function setContextKeymapAliasPreset(
    context: KeymapAliasPresetContext,
    enabled: boolean,
  ) {
    const nextAliases = cloneKeymapAliases(deps.settingsState.keymapAliases) ?? {};
    if (enabled) {
      nextAliases[context] = cloneKeymapAliasConfig(
        KEYMAP_ALIAS_PRESETS_BY_CONTEXT[context],
      );
    } else {
      delete nextAliases[context];
    }
    deps.settingsDispatch({
      type: "setKeymapAliases",
      keymapAliases:
        Object.keys(nextAliases).length > 0 ? nextAliases : undefined,
    });
  }

  function toggleContextKeymapAliasPreset(context: KeymapAliasPresetContext) {
    const currentState = resolveKeymapAliasPresetState(
      context,
      deps.settingsState.keymapAliases,
    );
    const nextEnabled = currentState !== "preset";
    setContextKeymapAliasPreset(context, nextEnabled);
    deps.showShortNavigationBanner(
      `${context} aliases: ${nextEnabled ? "on (preset)" : "off"}`,
    );
  }

  function clearAllKeymapAliases() {
    deps.settingsDispatch({ type: "setKeymapAliases", keymapAliases: undefined });
    deps.showShortNavigationBanner("Keymap aliases reset to defaults");
  }

  function closeHelp(options: { bypassUnsavedGuard?: boolean } = {}) {
    if (
      !options.bypassUnsavedGuard &&
      helpNavStack[helpNavStack.length - 1] === "custom1Edit" &&
      requestHelpThemeEditorUnsavedGuard("help_custom1_editor", "close_help")
    ) {
      return;
    }
    if (
      !options.bypassUnsavedGuard &&
      helpNavStack[helpNavStack.length - 1] === "textTuningEdit" &&
      requestHelpThemeEditorUnsavedGuard(
        "help_text_tuning_editor",
        "close_help",
      )
    ) {
      return;
    }
    if (helpNavStack[helpNavStack.length - 1] === "custom1Edit") {
      closeCustom1EditorCancel();
    }
    if (helpNavStack[helpNavStack.length - 1] === "textTuningEdit") {
      closeBuiltInTextEditorCancel();
    }
    setHelpSettingsInputField(null);
    setHelpSettingsInputValue("");
    setHelpSettingsInputApplying(false);
    setHelpSettingsInputError(null);
    cancelLogoModeSetting();
    const { mode: returnMode, focus: returnFocus } =
      deps.normalizeHelpReturnContext(
        helpReturnContextRef.current.mode,
        helpReturnContextRef.current.focus,
      );
    deps.uiDispatch({ type: "setMode", mode: returnMode });
    deps.uiDispatch({ type: "setFocus", focus: returnFocus });
  }

  function setHelpNavSelectionForActivePage(index: number) {
    if (activeHelpPage === "settings") {
      setHelpNavSelection((prev) => ({ ...prev, settings: index }));
      return;
    }
    if (activeHelpPage === "settingsAppearance") {
      setHelpNavSelection((prev) => ({ ...prev, settingsAppearance: index }));
      return;
    }
    if (activeHelpPage === "settingsNavigation") {
      setHelpNavSelection((prev) => ({ ...prev, settingsNavigation: index }));
      return;
    }
    if (activeHelpPage === "settingsNotifications") {
      setHelpNavSelection((prev) => ({ ...prev, settingsNotifications: index }));
      return;
    }
    if (activeHelpPage === "settingsSecurity") {
      setHelpNavSelection((prev) => ({ ...prev, settingsSecurity: index }));
      return;
    }
    if (activeHelpPage === "settingsNotes") {
      setHelpNavSelection((prev) => ({ ...prev, settingsNotes: index }));
      return;
    }
    if (activeHelpPage === "settingsCloud") {
      setHelpNavSelection((prev) => ({ ...prev, settingsCloud: index }));
      return;
    }
    if (activeHelpPage === "keymapAliases") {
      setHelpNavSelection((prev) => ({ ...prev, keymapAliases: index }));
      return;
    }
    if (activeHelpPage === "theme") {
      setHelpNavSelection((prev) => ({ ...prev, theme: index }));
      return;
    }
    if (activeHelpPage === "custom1") {
      setHelpNavSelection((prev) => ({ ...prev, custom1: index }));
      return;
    }
    if (activeHelpPage === "textTuning") {
      setHelpNavSelection((prev) => ({ ...prev, textTuning: index }));
      return;
    }
    if (activeHelpPage === "textTuningTheme") {
      setHelpNavSelection((prev) => ({ ...prev, textTuningTheme: index }));
    }
  }

  function handleHelpNavForward(
    targetIndex = Math.max(
      0,
      Math.min(
        getHelpNavSelectionIndexForPage(activeHelpPage, helpNavSelection),
        Math.max(0, resolveNavLengthForPage(activeHelpPage) - 1),
      ),
    ),
  ) {
    if (activeHelpPage === "settings") {
      if (targetIndex === HELP_SETTINGS_APPEARANCE_NAV_INDEX) {
        cancelLogoModeSetting();
        pushHelpPage("settingsAppearance");
      }
      if (targetIndex === HELP_SETTINGS_NAVIGATION_NAV_INDEX) {
        pushHelpPage("settingsNavigation");
      }
      if (targetIndex === HELP_SETTINGS_NOTIFICATIONS_NAV_INDEX) {
        pushHelpPage("settingsNotifications");
      }
      if (targetIndex === HELP_SETTINGS_SECURITY_NAV_INDEX) {
        pushHelpPage("settingsSecurity");
      }
      if (targetIndex === HELP_SETTINGS_NOTES_NAV_INDEX) {
        pushHelpPage("settingsNotes");
      }
      if (targetIndex === HELP_SETTINGS_CLOUD_NAV_INDEX) {
        pushHelpPage("settingsCloud");
      }
      return;
    }
    if (activeHelpPage === "settingsAppearance") {
      if (targetIndex === HELP_SETTINGS_APPEARANCE_THEME_NAV_INDEX) {
        cancelLogoModeSetting();
        pushHelpPage("theme");
      }
      if (targetIndex === HELP_SETTINGS_APPEARANCE_LOGO_NAV_INDEX) {
        cycleLogoModeSetting(1, true);
      }
      if (targetIndex === HELP_SETTINGS_APPEARANCE_FLASH_NAV_INDEX) {
        switchFlashModeSetting();
      }
      if (targetIndex === HELP_SETTINGS_APPEARANCE_CRT_FX_NAV_INDEX) {
        switchCrtFxLiteSetting();
      }
      if (targetIndex === HELP_SETTINGS_APPEARANCE_CRT_FX_PROFILE_NAV_INDEX) {
        cycleCrtFxProfileSetting();
      }
      if (targetIndex === HELP_SETTINGS_APPEARANCE_RETRO_FX_MODE_NAV_INDEX) {
        cycleRetroFxModeSetting();
      }
      return;
    }
    if (activeHelpPage === "settingsNavigation") {
      if (targetIndex === HELP_SETTINGS_NAVIGATION_KEYMAP_ALIASES_NAV_INDEX) {
        pushHelpPage("keymapAliases");
      }
      if (targetIndex === HELP_SETTINGS_NAVIGATION_HINTS_NAV_INDEX) {
        cycleHintDisplayModeSetting();
      }
      if (targetIndex === HELP_SETTINGS_NAVIGATION_PREFIX_POPUP_NAV_INDEX) {
        switchPrefixPopupSetting();
      }
      return;
    }
    if (activeHelpPage === "settingsNotifications") {
      if (targetIndex === HELP_SETTINGS_NOTIFICATIONS_ENABLED_NAV_INDEX) {
        switchNotificationsEnabledSetting();
      }
      if (targetIndex === HELP_SETTINGS_NOTIFICATIONS_OVERDUE_POPUP_NAV_INDEX) {
        switchInAppOverduePopupSetting();
      }
      if (targetIndex === HELP_SETTINGS_NOTIFICATIONS_TERMINAL_BELL_NAV_INDEX) {
        switchTerminalBellSetting();
      }
      if (
        targetIndex === HELP_SETTINGS_NOTIFICATIONS_OUT_OF_APP_REMINDERS_NAV_INDEX
      ) {
        switchOutOfAppRemindersSetting();
      }
      if (targetIndex === HELP_SETTINGS_NOTIFICATIONS_HELPER_INSTALL_NAV_INDEX) {
        showReminderHelperCommand(
          deps.getReminderHelperCommands()[0] ?? "tadoi reminders install",
        );
      }
      if (targetIndex === HELP_SETTINGS_NOTIFICATIONS_HELPER_STATUS_NAV_INDEX) {
        showReminderHelperCommand(
          deps.getReminderHelperCommands()[1] ?? "tadoi reminders status",
        );
      }
      if (targetIndex === HELP_SETTINGS_NOTIFICATIONS_HELPER_TEST_NAV_INDEX) {
        showReminderHelperCommand("tadoi reminders test");
      }
      if (
        targetIndex === HELP_SETTINGS_NOTIFICATIONS_HELPER_UNINSTALL_NAV_INDEX
      ) {
        showReminderHelperCommand("tadoi reminders uninstall");
      }
      if (
        targetIndex === HELP_SETTINGS_NOTIFICATIONS_BANNER_DURATION_NAV_INDEX
      ) {
        openHelpSettingsInput("notificationsBannerDurationMs");
      }
      if (
        targetIndex === HELP_SETTINGS_NOTIFICATIONS_BELL_COOLDOWN_NAV_INDEX
      ) {
        openHelpSettingsInput("notificationsBellCooldownMs");
      }
      return;
    }
    if (activeHelpPage === "settingsSecurity") {
      if (targetIndex === HELP_SETTINGS_SECURITY_NON_HTTP_POLICY_NAV_INDEX) {
        cycleSecurityNonHttpLinkPolicySetting();
      }
      return;
    }
    if (activeHelpPage === "settingsNotes") {
      if (targetIndex === HELP_SETTINGS_NOTES_ENABLED_NAV_INDEX) {
        switchNotesEnabledSetting();
      }
      if (targetIndex === HELP_SETTINGS_NOTES_ROOT_NAV_INDEX) {
        openHelpSettingsInput("notesRootPath");
      }
      if (targetIndex === HELP_SETTINGS_NOTES_RESTORE_GUIDES_NAV_INDEX) {
        void restoreTomeGuidesFromHelpSettings();
      }
      return;
    }
    if (activeHelpPage === "settingsCloud") {
      if (targetIndex === HELP_SETTINGS_CLOUD_ENABLED_NAV_INDEX) {
        switchCloudBackupEnabledSetting();
      }
      if (targetIndex === HELP_SETTINGS_CLOUD_OWNER_REPO_NAV_INDEX) {
        openHelpSettingsInput("cloudOwnerRepo");
      }
      if (targetIndex === HELP_SETTINGS_CLOUD_BRANCH_NAV_INDEX) {
        openHelpSettingsInput("cloudBranch");
      }
      if (targetIndex === HELP_SETTINGS_CLOUD_AUTO_PUSH_POLICY_NAV_INDEX) {
        cycleCloudAutoPushPolicySetting();
      }
      if (targetIndex === HELP_SETTINGS_CLOUD_DEVICE_ID_NAV_INDEX) {
        openHelpSettingsInput("cloudDeviceId");
      }
      if (targetIndex === HELP_SETTINGS_CLOUD_PATH_PREFIX_NAV_INDEX) {
        openHelpSettingsInput("cloudPathPrefix");
      }
      if (targetIndex === HELP_SETTINGS_CLOUD_OPEN_OPERATIONS_NAV_INDEX) {
        openCloudBackupOperationsFromSettings();
      }
      return;
    }
    if (activeHelpPage === "settingsInput") {
      void submitHelpSettingsInput();
      return;
    }
    if (activeHelpPage === "keymapAliases") {
      if (targetIndex === HELP_KEYMAP_ALIAS_RESET_NAV_INDEX) {
        clearAllKeymapAliases();
        return;
      }
      const context = KEYMAP_ALIAS_PRESET_CONTEXT_ORDER[targetIndex];
      if (!context) return;
      toggleContextKeymapAliasPreset(context);
      return;
    }
    if (activeHelpPage === "theme") {
      if (targetIndex === 0) cycleThemeModeSetting();
      if (targetIndex === 1) pushHelpPage("custom1");
      if (targetIndex === 2) pushHelpPage("textTuning");
      return;
    }
    if (activeHelpPage === "custom1") {
      if (targetIndex === 0) {
        openCustom1Editor();
      }
      return;
    }
    if (activeHelpPage === "textTuning") {
      const targetThemeId = HELP_TEXT_TUNING_THEMES[targetIndex];
      if (!targetThemeId) return;
      setHelpTextTuningThemeId(targetThemeId);
      setHelpNavSelection((prev) => ({ ...prev, textTuningTheme: 0 }));
      pushHelpPage("textTuningTheme");
      return;
    }
    if (activeHelpPage === "textTuningTheme" && targetIndex === 0) {
      openBuiltInTextEditor();
    }
  }

  function handleHelpNavBack() {
    if (activeHelpPage === "settingsInput") {
      closeHelpSettingsInput();
      return;
    }
    if (activeHelpPage === "custom1Edit") {
      if (
        requestHelpThemeEditorUnsavedGuard(
          "help_custom1_editor",
          "close_editor",
        )
      ) {
        return;
      }
      closeCustom1EditorCancel();
      return;
    }
    if (activeHelpPage === "textTuningEdit") {
      if (
        requestHelpThemeEditorUnsavedGuard(
          "help_text_tuning_editor",
          "close_editor",
        )
      ) {
        return;
      }
      closeBuiltInTextEditorCancel();
      return;
    }
    if (activeHelpPage === "settingsAppearance") {
      cancelLogoModeSetting();
    }
    popHelpPage();
  }

  return {
    helpExpandedBySection,
    setHelpExpandedBySection,
    helpFocusedSectionIndex,
    setHelpFocusedSectionIndex,
    helpScrollOffset,
    setHelpScrollOffset,
    helpNavScrollOffset,
    setHelpNavScrollOffset,
    helpNavStack,
    setHelpNavStack,
    helpNavSelection,
    setHelpNavSelection,
    helpSettingsInputField,
    setHelpSettingsInputField,
    helpSettingsInputValue,
    setHelpSettingsInputValue,
    helpSettingsInputApplying,
    setHelpSettingsInputApplying,
    helpSettingsInputError,
    setHelpSettingsInputError,
    helpPreviewThemeMode,
    setHelpPreviewThemeMode,
    helpDraftLogoMode,
    setHelpDraftLogoMode,
    helpTextTuningThemeId,
    setHelpTextTuningThemeId,
    custom1DraftGlobal,
    setCustom1DraftGlobal,
    custom1DraftObjects,
    setCustom1DraftObjects,
    builtInTextDraftGlobal,
    setBuiltInTextDraftGlobal,
    builtInTextDraftObjects,
    setBuiltInTextDraftObjects,
    activeHelpPage,
    persistedCustom1,
    persistedBuiltInTextConfig,
    builtInTextBaseTokens,
    custom1Draft,
    builtInTextDraft,
    helpCloudSettings,
    helpSettingsInputTitle,
    helpSettingsInputPlaceholder,
    helpKeymapAliasPresetStates,
    requestHelpThemeEditorUnsavedGuard,
    openHelp,
    pushHelpPage,
    popHelpPage,
    openCustom1Editor,
    closeCustom1EditorCancel,
    saveCustom1Editor,
    openBuiltInTextEditor,
    closeBuiltInTextEditorCancel,
    saveBuiltInTextEditor,
    cycleLogoModeSetting,
    commitLogoModeSetting,
    cancelLogoModeSetting,
    openHelpSettingsInput,
    closeHelpSettingsInput,
    submitHelpSettingsInput,
    restoreTomeGuidesFromHelpSettings,
    clearAllKeymapAliases,
    closeHelp,
    setHelpNavSelectionForActivePage,
    handleHelpNavForward,
    handleHelpNavBack,
    resolveNavLengthForPage,
    formatHintDisplayModeLabel,
    formatGitHubAutoPushPolicyLabel,
    formatNonHttpLinkPolicyLabel,
  };
}

function resolveGitHubSettings(
  settingsState: SettingsState,
): GitHubBackupSettings | undefined {
  const defaults = getDefaultSettings().githubBackup;
  return settingsState.githubBackup ?? defaults;
}

function resolveHelpSettingsInputTitle(field: HelpSettingsInputField): string {
  if (field === "notificationsBannerDurationMs") {
    return "Notification Banner Duration (ms)";
  }
  if (field === "notificationsBellCooldownMs") {
    return "Terminal Bell Cooldown (ms)";
  }
  if (field === "notesRootPath") return "TOME Root Path";
  if (field === "cloudOwnerRepo") return "Cloud Owner/Repo";
  if (field === "cloudBranch") return "Cloud Branch";
  if (field === "cloudDeviceId") return "Cloud Device ID";
  return "Cloud Path Prefix";
}

function resolveHelpSettingsInputPlaceholder(
  field: HelpSettingsInputField,
): string {
  if (field === "notificationsBannerDurationMs") return "e.g. 5000";
  if (field === "notificationsBellCooldownMs") return "e.g. 2000";
  if (field === "notesRootPath") {
    return "Absolute path (blank = default under data root)";
  }
  if (field === "cloudOwnerRepo") return "owner/repo";
  if (field === "cloudBranch") return "main";
  if (field === "cloudDeviceId") return "dev_local";
  return "tadoi/devices/<device-id>";
}

function stableSerialize(value: unknown): string {
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) {
      return input.map((item) => normalize(item));
    }
    if (input && typeof input === "object") {
      const sortedEntries = Object.entries(
        input as Record<string, unknown>,
      ).sort(([a], [b]) => a.localeCompare(b));
      const next: Record<string, unknown> = {};
      for (const [key, entryValue] of sortedEntries) {
        next[key] = normalize(entryValue);
      }
      return next;
    }
    return input;
  };
  return JSON.stringify(normalize(value));
}

function formatLogoModeLabel(mode: LogoMode): string {
  if (mode === "right") return "Right";
  if (mode === "off") return "Off";
  return "Left";
}
