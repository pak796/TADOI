import { ThemeId, cycleTheme } from "../theme/themes";
import {
  CRT_FX_LITE_COLOR_ORDER,
  CRT_FX_LITE_PRESET_ORDER,
  type CrtFxLiteColor,
  type CrtFxLitePreset,
  type HintDisplayMode,
  HINT_DISPLAY_MODE_ORDER,
  RETRO_FX_MODE_ORDER,
  type RetroFxMode,
  cycleLogoMode,
  CustomThemes,
  DEFAULT_CRT_FX_LITE_COLOR,
  DEFAULT_CRT_FX_LITE_PRESET,
  DEFAULT_RETRO_FX_MODE,
  type GitHubBackupSettings,
  FlashMode,
  LogoMode,
  SecuritySettings,
  NotificationSettings,
  getDefaultSettings
} from "../settings/settings";
import type { KeymapAliases } from "../app/keymapAliases";

export type SettingsState = {
  themeId: ThemeId;
  logoMode: LogoMode;
  flashMode: FlashMode;
  hintDisplayMode: HintDisplayMode;
  showPrefixHintPopup: boolean;
  crtFxLite: boolean;
  crtFxColor: CrtFxLiteColor;
  crtFxPreset: CrtFxLitePreset;
  retroFxMode: RetroFxMode;
  notifications: NotificationSettings;
  security: SecuritySettings;
  customThemes?: CustomThemes;
  keymapAliases?: KeymapAliases;
  githubBackup?: GitHubBackupSettings;
};

export type SettingsAction =
  | { type: "setTheme"; themeId: ThemeId }
  | { type: "cycleTheme" }
  | { type: "setLogoMode"; logoMode: LogoMode }
  | { type: "cycleLogoMode"; direction?: 1 | -1 }
  | { type: "setFlashMode"; flashMode: FlashMode }
  | { type: "toggleFlashMode" }
  | { type: "setHintDisplayMode"; hintDisplayMode: HintDisplayMode }
  | { type: "cycleHintDisplayMode"; direction?: 1 | -1 }
  | { type: "setShowPrefixHintPopup"; showPrefixHintPopup: boolean }
  | { type: "toggleShowPrefixHintPopup" }
  | { type: "setCrtFxLite"; crtFxLite: boolean }
  | { type: "toggleCrtFxLite" }
  | { type: "setCrtFxColor"; crtFxColor: CrtFxLiteColor }
  | { type: "cycleCrtFxColor"; direction?: 1 | -1 }
  | { type: "setCrtFxPreset"; crtFxPreset: CrtFxLitePreset }
  | { type: "cycleCrtFxPreset"; direction?: 1 | -1 }
  | { type: "setRetroFxMode"; retroFxMode: RetroFxMode }
  | { type: "cycleRetroFxMode"; direction?: 1 | -1 }
  | { type: "setNotifications"; notifications: NotificationSettings }
  | { type: "setSecurity"; security: SecuritySettings }
  | { type: "setCustomThemes"; customThemes?: CustomThemes }
  | { type: "setKeymapAliases"; keymapAliases?: KeymapAliases }
  | { type: "setGitHubBackup"; githubBackup?: GitHubBackupSettings }
  | { type: "toggleNotificationsEnabled" }
  | { type: "toggleInAppOverdueBanner" }
  | { type: "toggleTerminalBellOnOverdue" };

export const initialSettingsState: SettingsState = {
  themeId: "default",
  logoMode: getDefaultSettings().logoMode,
  flashMode: "slow",
  hintDisplayMode: getDefaultSettings().hintDisplayMode ?? "bottom",
  showPrefixHintPopup: getDefaultSettings().showPrefixHintPopup ?? true,
  crtFxLite: getDefaultSettings().crtFxLite === true,
  crtFxColor: getDefaultSettings().crtFxColor ?? DEFAULT_CRT_FX_LITE_COLOR,
  crtFxPreset: getDefaultSettings().crtFxPreset ?? DEFAULT_CRT_FX_LITE_PRESET,
  retroFxMode: getDefaultSettings().retroFxMode ?? DEFAULT_RETRO_FX_MODE,
  notifications: {
    enabled: true,
    inAppOverdueBanner: true,
    terminalBellOnOverdue: false,
    bannerDurationMs: 5000,
    bellCooldownMs: 2000
  },
  security: {
    nonHttpLinkPolicy: "prompt"
  },
  customThemes: getDefaultSettings().customThemes,
  keymapAliases: getDefaultSettings().keymapAliases,
  githubBackup: getDefaultSettings().githubBackup
};

export function settingsReducer(
  state: SettingsState,
  action: SettingsAction
): SettingsState {
  switch (action.type) {
    case "setTheme":
      return { ...state, themeId: action.themeId };
    case "cycleTheme":
      return { ...state, themeId: cycleTheme(state.themeId) };
    case "setLogoMode":
      return { ...state, logoMode: action.logoMode };
    case "cycleLogoMode":
      return { ...state, logoMode: cycleLogoMode(state.logoMode, action.direction ?? 1) };
    case "setFlashMode":
      return { ...state, flashMode: action.flashMode };
    case "toggleFlashMode":
      return { ...state, flashMode: state.flashMode === "slow" ? "static" : "slow" };
    case "setHintDisplayMode":
      return { ...state, hintDisplayMode: action.hintDisplayMode };
    case "cycleHintDisplayMode": {
      const index = HINT_DISPLAY_MODE_ORDER.indexOf(state.hintDisplayMode);
      const safeIndex = index >= 0 ? index : 0;
      const direction = action.direction ?? 1;
      const nextIndex =
        (safeIndex + direction + HINT_DISPLAY_MODE_ORDER.length) %
        HINT_DISPLAY_MODE_ORDER.length;
      return { ...state, hintDisplayMode: HINT_DISPLAY_MODE_ORDER[nextIndex] };
    }
    case "setShowPrefixHintPopup":
      return { ...state, showPrefixHintPopup: action.showPrefixHintPopup };
    case "toggleShowPrefixHintPopup":
      return { ...state, showPrefixHintPopup: !state.showPrefixHintPopup };
    case "setCrtFxLite":
      return { ...state, crtFxLite: action.crtFxLite };
    case "toggleCrtFxLite":
      return { ...state, crtFxLite: !state.crtFxLite };
    case "setCrtFxColor":
      return { ...state, crtFxColor: action.crtFxColor };
    case "cycleCrtFxColor": {
      const index = CRT_FX_LITE_COLOR_ORDER.indexOf(state.crtFxColor);
      const safeIndex = index >= 0 ? index : 0;
      const direction = action.direction ?? 1;
      const nextIndex =
        (safeIndex + direction + CRT_FX_LITE_COLOR_ORDER.length) %
        CRT_FX_LITE_COLOR_ORDER.length;
      return { ...state, crtFxColor: CRT_FX_LITE_COLOR_ORDER[nextIndex] };
    }
    case "setCrtFxPreset":
      return { ...state, crtFxPreset: action.crtFxPreset };
    case "cycleCrtFxPreset": {
      const index = CRT_FX_LITE_PRESET_ORDER.indexOf(state.crtFxPreset);
      const safeIndex = index >= 0 ? index : 0;
      const direction = action.direction ?? 1;
      const nextIndex =
        (safeIndex + direction + CRT_FX_LITE_PRESET_ORDER.length) %
        CRT_FX_LITE_PRESET_ORDER.length;
      return { ...state, crtFxPreset: CRT_FX_LITE_PRESET_ORDER[nextIndex] };
    }
    case "setRetroFxMode":
      return { ...state, retroFxMode: action.retroFxMode };
    case "cycleRetroFxMode": {
      const index = RETRO_FX_MODE_ORDER.indexOf(state.retroFxMode);
      const safeIndex = index >= 0 ? index : 0;
      const direction = action.direction ?? 1;
      const nextIndex =
        (safeIndex + direction + RETRO_FX_MODE_ORDER.length) %
        RETRO_FX_MODE_ORDER.length;
      return { ...state, retroFxMode: RETRO_FX_MODE_ORDER[nextIndex] };
    }
    case "setNotifications":
      return { ...state, notifications: action.notifications };
    case "setSecurity":
      return { ...state, security: action.security };
    case "setCustomThemes":
      return { ...state, customThemes: action.customThemes };
    case "setKeymapAliases":
      return { ...state, keymapAliases: action.keymapAliases };
    case "setGitHubBackup":
      return { ...state, githubBackup: action.githubBackup };
    case "toggleNotificationsEnabled":
      return {
        ...state,
        notifications: {
          ...state.notifications,
          enabled: !state.notifications.enabled
        }
      };
    case "toggleInAppOverdueBanner":
      return {
        ...state,
        notifications: {
          ...state.notifications,
          inAppOverdueBanner: !state.notifications.inAppOverdueBanner
        }
      };
    case "toggleTerminalBellOnOverdue":
      return {
        ...state,
        notifications: {
          ...state.notifications,
          terminalBellOnOverdue: !state.notifications.terminalBellOnOverdue
        }
      };
    default:
      return state;
  }
}
