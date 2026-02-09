import { ThemeId, cycleTheme } from "../theme/themes";

export type SettingsState = {
  themeId: ThemeId;
};

export type SettingsAction =
  | { type: "setTheme"; themeId: ThemeId }
  | { type: "cycleTheme" };

export const initialSettingsState: SettingsState = {
  themeId: "default"
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
    default:
      return state;
  }
}
