import { ThemeId, cycleTheme } from "../theme/themes";
import { FlashMode } from "../settings/settings";

export type SettingsState = {
  themeId: ThemeId;
  flashMode: FlashMode;
};

export type SettingsAction =
  | { type: "setTheme"; themeId: ThemeId }
  | { type: "cycleTheme" }
  | { type: "setFlashMode"; flashMode: FlashMode }
  | { type: "toggleFlashMode" };

export const initialSettingsState: SettingsState = {
  themeId: "default",
  flashMode: "slow"
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
    default:
      return state;
  }
}
