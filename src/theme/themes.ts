export type ThemeId =
  | "default"
  | "retro"
  | "highContrast"
  | "neonHacker"
  | "rotating";

export type ConcreteThemeId = Exclude<ThemeId, "rotating">;

export type ThemeTokens = {
  bg: string;
  panel: string;
  text: string;
  mutedText: string;
  border: string;
  accent: string;
  accent2: string;
  ok: string;
  warn: string;
  danger: string;
  selectionBg: string;
  selectionText: string;
};

export const THEMES: Record<ThemeId, ThemeTokens> = {
  default: {
    bg: "#0b0f14",
    panel: "#1a202c",
    text: "#f2f2f2",
    mutedText: "#b0b6bf",
    border: "#3b4049",
    accent: "#f4a259",
    accent2: "#5dade2",
    ok: "#2ecc71",
    warn: "#f1c40f",
    danger: "#e74c3c",
    selectionBg: "#9b59b6",
    selectionText: "#0b0f14"
  },
  retro: {
    bg: "#121316",
    panel: "#1f2126",
    text: "#e4e6eb",
    mutedText: "#a6abb8",
    border: "#666c7a",
    accent: "#7f84a5",
    accent2: "#9aa0b3",
    ok: "#a8c18d",
    warn: "#c9c38d",
    danger: "#b78484",
    selectionBg: "#5f6480",
    selectionText: "#f0f2f7"
  },
  highContrast: {
    bg: "#000000",
    panel: "#111111",
    text: "#f2f2f2",
    mutedText: "#cccccc",
    border: "#ffffff",
    accent: "#00aaff",
    accent2: "#ff00c8",
    ok: "#00ff66",
    warn: "#ffff00",
    danger: "#ff0033",
    selectionBg: "#00aacc",
    selectionText: "#000000"
  },
  neonHacker: {
    bg: "#05090b",
    panel: "#102019",
    text: "#d6ffe4",
    mutedText: "#7ed3a8",
    border: "#2d5b4b",
    accent: "#00ffa3",
    accent2: "#00d9ff",
    ok: "#39ff14",
    warn: "#ffea00",
    danger: "#ff29c3",
    selectionBg: "#1a4a36",
    selectionText: "#05090b"
  },
  // "rotating" is a virtual mode; this fallback prevents invalid lookups before
  // runtime rotation applies a concrete palette.
  rotating: {
    bg: "#0b0f14",
    panel: "#1a202c",
    text: "#f2f2f2",
    mutedText: "#b0b6bf",
    border: "#3b4049",
    accent: "#f4a259",
    accent2: "#5dade2",
    ok: "#2ecc71",
    warn: "#f1c40f",
    danger: "#e74c3c",
    selectionBg: "#9b59b6",
    selectionText: "#0b0f14"
  }
};

export const THEME_ORDER: ThemeId[] = [
  "default",
  "retro",
  "highContrast",
  "neonHacker",
  "rotating"
];

export const ROTATING_THEME_ORDER: ConcreteThemeId[] = [
  "default",
  "retro",
  "highContrast",
  "neonHacker"
];

export function cycleTheme(current: ThemeId): ThemeId {
  const index = THEME_ORDER.indexOf(current);
  const safeIndex = index === -1 ? 0 : index;
  return THEME_ORDER[(safeIndex + 1) % THEME_ORDER.length];
}

export function isThemeId(value: unknown): value is ThemeId {
  return (
    typeof value === "string" &&
    (value === "default" ||
      value === "retro" ||
      value === "highContrast" ||
      value === "neonHacker" ||
      value === "rotating")
  );
}
