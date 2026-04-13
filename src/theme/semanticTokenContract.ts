import type { ThemeTokens } from "./themes";

export type RuntimeThemeAlias =
  | "bg"
  | "panel"
  | "accentOrange"
  | "accentPurple"
  | "accentBlue"
  | "accent"
  | "accent2"
  | "ok"
  | "warn"
  | "danger"
  | "dueSoon"
  | "dueLater"
  | "text"
  | "muted"
  | "mutedText"
  | "outline"
  | "border"
  | "selectionBg"
  | "selectionText";

export const RUNTIME_THEME_ALIAS_TO_TOKEN: Record<
  RuntimeThemeAlias,
  keyof ThemeTokens
> = {
  bg: "bg",
  panel: "panel",
  accentOrange: "accent",
  accentPurple: "selectionBg",
  accentBlue: "accent2",
  accent: "accent",
  accent2: "accent2",
  ok: "ok",
  warn: "warn",
  danger: "danger",
  dueSoon: "warn",
  dueLater: "accent2",
  text: "text",
  muted: "mutedText",
  mutedText: "mutedText",
  outline: "border",
  border: "border",
  selectionBg: "selectionBg",
  selectionText: "selectionText",
};

export type UserThemeRoleId =
  | "surface"
  | "text"
  | "accent"
  | "status"
  | "selection";

export type UserThemeRoleContract = {
  label: string;
  internalTokens: Array<keyof ThemeTokens>;
  runtimeAliases: RuntimeThemeAlias[];
  consumerExamples: string[];
};

export const USER_THEME_ROLE_CONTRACT: Record<
  UserThemeRoleId,
  UserThemeRoleContract
> = {
  surface: {
    label: "Surface",
    internalTokens: ["bg", "panel", "border"],
    runtimeAliases: ["bg", "panel", "outline", "border"],
    consumerExamples: [
      "src/app/App.tsx",
      "src/components/BackupCenterScreen.tsx",
    ],
  },
  text: {
    label: "Text",
    internalTokens: ["text", "mutedText"],
    runtimeAliases: ["text", "muted", "mutedText"],
    consumerExamples: [
      "src/components/TaskList.tsx",
      "src/components/DetailsPane.tsx",
    ],
  },
  accent: {
    label: "Accent",
    internalTokens: ["accent", "accent2"],
    runtimeAliases: [
      "accentOrange",
      "accentBlue",
      "accent",
      "accent2",
      "dueLater",
    ],
    consumerExamples: ["src/app/App.tsx", "src/components/LeftRail.tsx"],
  },
  status: {
    label: "Status",
    internalTokens: ["ok", "warn", "danger"],
    runtimeAliases: ["ok", "warn", "danger", "dueSoon"],
    consumerExamples: [
      "src/components/TaskList.tsx",
      "src/components/BackupCenterScreen.tsx",
    ],
  },
  selection: {
    label: "Selection",
    internalTokens: ["selectionBg", "selectionText"],
    runtimeAliases: ["selectionBg", "selectionText", "accentPurple"],
    consumerExamples: [
      "src/components/TaskList.tsx",
      "src/components/LeftRail.tsx",
    ],
  },
};

export function runtimeThemeFromContract(
  tokens: ThemeTokens,
): Record<RuntimeThemeAlias, string> {
  const next = {} as Record<RuntimeThemeAlias, string>;
  for (const [alias, tokenKey] of Object.entries(
    RUNTIME_THEME_ALIAS_TO_TOKEN,
  ) as Array<[RuntimeThemeAlias, keyof ThemeTokens]>) {
    next[alias] = tokens[tokenKey];
  }
  return next;
}
