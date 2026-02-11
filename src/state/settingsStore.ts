import { ThemeId, cycleTheme } from "../theme/themes";
import { FlashMode, NotificationSettings } from "../settings/settings";

export type SettingsState = {
  themeId: ThemeId;
  flashMode: FlashMode;
  notifications: NotificationSettings;
};

export type SettingsAction =
  | { type: "setTheme"; themeId: ThemeId }
  | { type: "cycleTheme" }
  | { type: "setFlashMode"; flashMode: FlashMode }
  | { type: "toggleFlashMode" }
  | { type: "setNotifications"; notifications: NotificationSettings }
  | { type: "toggleNotificationsEnabled" }
  | { type: "toggleInAppOverdueBanner" }
  | { type: "toggleTerminalBellOnOverdue" };

export const initialSettingsState: SettingsState = {
  themeId: "default",
  flashMode: "slow",
  notifications: {
    enabled: true,
    inAppOverdueBanner: true,
    terminalBellOnOverdue: false,
    bannerDurationMs: 5000,
    bellCooldownMs: 2000
  }
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
    case "setFlashMode":
      return { ...state, flashMode: action.flashMode };
    case "toggleFlashMode":
      return { ...state, flashMode: state.flashMode === "slow" ? "static" : "slow" };
    case "setNotifications":
      return { ...state, notifications: action.notifications };
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
