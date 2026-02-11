import { ThemeId, cycleTheme } from "../theme/themes";
import {
  cycleLogoMode,
  CustomThemes,
  FlashMode,
  LogoMode,
  NotificationSettings,
  getDefaultSettings
} from "../settings/settings";

export type SettingsState = {
  themeId: ThemeId;
  logoMode: LogoMode;
  flashMode: FlashMode;
  notifications: NotificationSettings;
  customThemes?: CustomThemes;
};

export type SettingsAction =
  | { type: "setTheme"; themeId: ThemeId }
  | { type: "cycleTheme" }
  | { type: "setLogoMode"; logoMode: LogoMode }
  | { type: "cycleLogoMode"; direction?: 1 | -1 }
  | { type: "setFlashMode"; flashMode: FlashMode }
  | { type: "toggleFlashMode" }
  | { type: "setNotifications"; notifications: NotificationSettings }
  | { type: "setCustomThemes"; customThemes?: CustomThemes }
  | { type: "toggleNotificationsEnabled" }
  | { type: "toggleInAppOverdueBanner" }
  | { type: "toggleTerminalBellOnOverdue" };

export const initialSettingsState: SettingsState = {
  themeId: "default",
  logoMode: getDefaultSettings().logoMode,
  flashMode: "slow",
  notifications: {
    enabled: true,
    inAppOverdueBanner: true,
    terminalBellOnOverdue: false,
    bannerDurationMs: 5000,
    bellCooldownMs: 2000
  },
  customThemes: getDefaultSettings().customThemes
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
    case "setNotifications":
      return { ...state, notifications: action.notifications };
    case "setCustomThemes":
      return { ...state, customThemes: action.customThemes };
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
