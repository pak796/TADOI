import type { CustomThemeConfig, TadoiSettings, ThemeObjectId } from "../settings/settings";

export type ThemeId =
  | "default"
  | "retro"
  | "highContrast"
  | "neonHacker"
  | "lightSlate"
  | "paperWhite"
  | "midnightBlack"
  | "jester"
  | "sonora"
  | "tigers"
  | "tech"
  | "deuteranopia"
  | "protanopia"
  | "tritanopia"
  | "blueAngels"
  | "southwest"
  | "rams"
  | "custom1"
  | "rotating";

export type ConcreteThemeId = Exclude<ThemeId, "rotating">;
export type RotatingThemeId = Exclude<ThemeId, "rotating" | "custom1">;

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
  lightSlate: {
    bg: "#e7ecef",
    panel: "#d8e0e4",
    text: "#1f2933",
    mutedText: "#52606d",
    border: "#9aa5b1",
    accent: "#5c6f7b",
    accent2: "#3e5c76",
    ok: "#4d8b72",
    warn: "#b08968",
    danger: "#a44a3f",
    selectionBg: "#b8c7cf",
    selectionText: "#1f2933"
  },
  paperWhite: {
    bg: "#f8f7f3",
    panel: "#efede7",
    text: "#1d2430",
    mutedText: "#5f6873",
    border: "#c6c0b3",
    accent: "#8a735b",
    accent2: "#4f6d8a",
    ok: "#4f7d63",
    warn: "#b58b4c",
    danger: "#9f4d42",
    selectionBg: "#d9d4c8",
    selectionText: "#1d2430"
  },
  midnightBlack: {
    bg: "#040507",
    panel: "#0c1118",
    text: "#d7dde7",
    mutedText: "#8a93a3",
    border: "#273142",
    accent: "#5d6b84",
    accent2: "#4f7b99",
    ok: "#3f7f68",
    warn: "#a88245",
    danger: "#8f3f45",
    selectionBg: "#1a2431",
    selectionText: "#d7dde7"
  },
  jester: {
    bg: "#12081e",
    panel: "#241138",
    text: "#f4f0ff",
    mutedText: "#c7b8de",
    border: "#5d3f8c",
    accent: "#d8b24a",
    accent2: "#2ea66a",
    ok: "#42c978",
    warn: "#f2c14e",
    danger: "#c94c9b",
    selectionBg: "#6a4bc2",
    selectionText: "#12081e"
  },
  sonora: {
    bg: "#f3e8d7",
    panel: "#eadcc8",
    text: "#3c3228",
    mutedText: "#7b6a58",
    border: "#c7b39b",
    accent: "#c97d5d",
    accent2: "#8ca67b",
    ok: "#6f9b74",
    warn: "#d8a25a",
    danger: "#b75b4f",
    selectionBg: "#d6bfa5",
    selectionText: "#3c3228"
  },
  tigers: {
    bg: "#2f0d57",
    panel: "#4a1f78",
    text: "#ffffff",
    mutedText: "#e9defb",
    border: "#fdd023",
    accent: "#fdd023",
    accent2: "#ffffff",
    ok: "#f6cb3b",
    warn: "#ffde59",
    danger: "#6a32a8",
    selectionBg: "#fdd023",
    selectionText: "#2f0d57"
  },
  tech: {
    bg: "#002c5f",
    panel: "#003b7a",
    text: "#f7f8fa",
    mutedText: "#c9d3e2",
    border: "#b3a369",
    accent: "#b3a369",
    accent2: "#eaaa00",
    ok: "#c7b479",
    warn: "#eaaa00",
    danger: "#9d822f",
    selectionBg: "#e0cf99",
    selectionText: "#002c5f"
  },
  deuteranopia: {
    bg: "#11161d",
    panel: "#1c2430",
    text: "#f1f5f9",
    mutedText: "#9fb0c3",
    border: "#4f6278",
    accent: "#ffb347",
    accent2: "#5bb6ff",
    ok: "#7bc4d6",
    warn: "#ffd166",
    danger: "#b084f5",
    selectionBg: "#2d4761",
    selectionText: "#f1f5f9"
  },
  protanopia: {
    bg: "#101821",
    panel: "#1a2836",
    text: "#f6f8fb",
    mutedText: "#a9bbcd",
    border: "#58708a",
    accent: "#4ecdc4",
    accent2: "#f4c95d",
    ok: "#5ec2b7",
    warn: "#ffd166",
    danger: "#7d6cf0",
    selectionBg: "#2c4f6e",
    selectionText: "#f6f8fb"
  },
  tritanopia: {
    bg: "#1a1416",
    panel: "#2a1f24",
    text: "#f7f2f4",
    mutedText: "#c6b3bb",
    border: "#8a6c78",
    accent: "#e76f51",
    accent2: "#2a9d8f",
    ok: "#6bcf8c",
    warn: "#f4a261",
    danger: "#d45087",
    selectionBg: "#5a3245",
    selectionText: "#f7f2f4"
  },
  blueAngels: {
    bg: "#081a35",
    panel: "#102a52",
    text: "#f8fbff",
    mutedText: "#b9c9e6",
    border: "#f2c24f",
    accent: "#f2c24f",
    accent2: "#2f6fd8",
    ok: "#5ca6ff",
    warn: "#ffd56a",
    danger: "#d67a3c",
    selectionBg: "#f2c24f",
    selectionText: "#081a35"
  },
  southwest: {
    bg: "#1f2f5a",
    panel: "#2b3f75",
    text: "#f9fbff",
    mutedText: "#c6d2eb",
    border: "#f9b233",
    accent: "#f0523f",
    accent2: "#2e4ea2",
    ok: "#58b0c4",
    warn: "#f9b233",
    danger: "#d63b2e",
    selectionBg: "#f0523f",
    selectionText: "#ffffff"
  },
  rams: {
    bg: "#003594",
    panel: "#0b4db8",
    text: "#ffffff",
    mutedText: "#d7e3ff",
    border: "#ffd100",
    accent: "#ffd100",
    accent2: "#1e6fd9",
    ok: "#8fd3ff",
    warn: "#ffd54a",
    danger: "#1f4fa3",
    selectionBg: "#ffd100",
    selectionText: "#003594"
  },
  custom1: {
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
  "lightSlate",
  "paperWhite",
  "midnightBlack",
  "jester",
  "sonora",
  "tigers",
  "tech",
  "deuteranopia",
  "protanopia",
  "tritanopia",
  "blueAngels",
  "southwest",
  "rams",
  "custom1",
  "rotating"
];

export const ROTATING_THEME_ORDER: RotatingThemeId[] = [
  "default",
  "retro",
  "highContrast",
  "neonHacker",
  "lightSlate",
  "paperWhite",
  "midnightBlack",
  "jester",
  "sonora",
  "tigers",
  "tech",
  "deuteranopia",
  "protanopia",
  "tritanopia",
  "blueAngels",
  "southwest",
  "rams"
];

export function cycleTheme(current: ThemeId): ThemeId {
  const index = THEME_ORDER.indexOf(current);
  const safeIndex = index === -1 ? 0 : index;
  return THEME_ORDER[(safeIndex + 1) % THEME_ORDER.length];
}

export type ResolveThemeTokensOptions = {
  objectId?: ThemeObjectId;
  draft?: CustomThemeConfig;
};

export function resolveThemeTokens(
  themeId: ThemeId,
  settings: Pick<TadoiSettings, "customThemes"> | undefined,
  options: ResolveThemeTokensOptions = {}
): ThemeTokens {
  if (themeId !== "custom1") {
    return THEMES[themeId];
  }

  const base = options.draft?.global ?? settings?.customThemes?.custom1?.global ?? THEMES.default;
  if (!options.objectId) {
    return { ...base };
  }

  const override =
    options.draft?.objects?.[options.objectId] ??
    settings?.customThemes?.custom1?.objects?.[options.objectId];
  return {
    ...base,
    ...override
  };
}

export function isThemeId(value: unknown): value is ThemeId {
  return (
    typeof value === "string" &&
    (value === "default" ||
      value === "retro" ||
      value === "highContrast" ||
      value === "neonHacker" ||
      value === "lightSlate" ||
      value === "paperWhite" ||
      value === "midnightBlack" ||
      value === "jester" ||
      value === "sonora" ||
      value === "tigers" ||
      value === "tech" ||
      value === "deuteranopia" ||
      value === "protanopia" ||
      value === "tritanopia" ||
      value === "blueAngels" ||
      value === "southwest" ||
      value === "rams" ||
      value === "custom1" ||
      value === "rotating")
  );
}
