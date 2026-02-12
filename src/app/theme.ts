import { THEMES, ThemeId, ThemeTokens, resolveThemeTokens } from "../theme/themes";
import {
  BuiltInThemeTextOverrides,
  CustomThemeConfig,
  THEME_OBJECT_IDS,
  ThemeObjectId,
  TadoiSettings
} from "../settings/settings";

export type RuntimeTheme = {
  bg: string;
  panel: string;
  accentOrange: string;
  accentPurple: string;
  accentBlue: string;
  accent: string;
  accent2: string;
  ok: string;
  warn: string;
  danger: string;
  dueSoon: string;
  dueLater: string;
  text: string;
  muted: string;
  mutedText: string;
  outline: string;
  border: string;
  selectionBg: string;
  selectionText: string;
};

function runtimeThemeFromTokens(tokens: ThemeTokens): RuntimeTheme {
  return {
    bg: tokens.bg,
    panel: tokens.panel,
    accentOrange: tokens.accent,
    accentPurple: tokens.selectionBg,
    accentBlue: tokens.accent2,
    accent: tokens.accent,
    accent2: tokens.accent2,
    ok: tokens.ok,
    warn: tokens.danger,
    danger: tokens.danger,
    dueSoon: tokens.warn,
    dueLater: tokens.accent2,
    text: tokens.text,
    muted: tokens.mutedText,
    mutedText: tokens.mutedText,
    outline: tokens.border,
    border: tokens.border,
    selectionBg: tokens.selectionBg,
    selectionText: tokens.selectionText
  };
}

function createRuntimeThemeByObject(): Record<ThemeObjectId, RuntimeTheme> {
  const initial = runtimeThemeFromTokens(THEMES.default);
  return THEME_OBJECT_IDS.reduce(
    (acc, objectId) => {
      acc[objectId] = { ...initial };
      return acc;
    },
    {} as Record<ThemeObjectId, RuntimeTheme>
  );
}

const runtimeThemeByObject = createRuntimeThemeByObject();

export function themeForObject(objectId: ThemeObjectId): RuntimeTheme {
  return runtimeThemeByObject[objectId];
}

export const theme: RuntimeTheme = themeForObject("appChrome");

export const layout = {
  railWidth: 36,
  rightWidth: 40
};

export const styles = {
  heading: {
    color: theme.text,
    fontWeight: "bold"
  },
  muted: {
    color: theme.muted
  },
  badge: {
    paddingLeft: 1,
    paddingRight: 1,
    backgroundColor: theme.accentOrange,
    color: theme.bg
  },
  button: {
    paddingLeft: 2,
    paddingRight: 2,
    backgroundColor: theme.accentBlue,
    color: theme.bg
  },
  buttonDanger: {
    paddingLeft: 2,
    paddingRight: 2,
    backgroundColor: theme.warn,
    color: theme.bg
  }
};

function syncStyles(): void {
  styles.heading.color = theme.text;
  styles.muted.color = theme.muted;
  styles.badge.backgroundColor = theme.accentOrange;
  styles.badge.color = theme.bg;
  styles.button.backgroundColor = theme.accentBlue;
  styles.button.color = theme.bg;
  styles.buttonDanger.backgroundColor = theme.warn;
  styles.buttonDanger.color = theme.bg;
}

export function applyTheme(themeId: ThemeId): void {
  for (const objectId of THEME_OBJECT_IDS) {
    const tokens = resolveThemeTokens(themeId, undefined, { objectId });
    Object.assign(runtimeThemeByObject[objectId], runtimeThemeFromTokens(tokens));
  }
  syncStyles();
}

export function applyThemeWithSettings(
  themeId: ThemeId,
  settings: Pick<TadoiSettings, "customThemes">,
  options: {
    draft?: CustomThemeConfig;
    builtInTextDraft?: BuiltInThemeTextOverrides;
  } = {}
): void {
  for (const objectId of THEME_OBJECT_IDS) {
    const tokens = resolveThemeTokens(themeId, settings, {
      objectId,
      draft: options.draft,
      builtInTextDraft: options.builtInTextDraft
    });
    Object.assign(runtimeThemeByObject[objectId], runtimeThemeFromTokens(tokens));
  }
  syncStyles();
}

const tagPalette = [
  "#f4a259",
  "#9b59b6",
  "#5dade2",
  "#2ecc71",
  "#e67e22",
  "#f1c40f",
  "#e84393",
  "#00b894",
  "#e17055",
  "#74b9ff",
  "#55efc4",
  "#fdcb6e",
  "#6c5ce7",
  "#fab1a0",
  "#00cec9",
  "#ffeaa7"
];

export function colorForTag(tag: string): string {
  const normalized = tag.trim().toLowerCase();
  if (!normalized) return tagPalette[0];
  const existing = tagColorMap.get(normalized);
  if (existing) return existing;
  const start = hashTag(normalized) % tagPalette.length;
  for (let i = 0; i < tagPalette.length; i += 1) {
    const color = tagPalette[(start + i) % tagPalette.length];
    if (!usedTagColors.has(color)) {
      usedTagColors.add(color);
      tagColorMap.set(normalized, color);
      return color;
    }
  }
  const fallback = tagPalette[start];
  tagColorMap.set(normalized, fallback);
  return fallback;
}

const tagColorMap = new Map<string, string>();
const usedTagColors = new Set<string>();

function hashTag(tag: string): number {
  let hash = 2166136261;
  for (let i = 0; i < tag.length; i += 1) {
    hash ^= tag.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
