import type {
  BuiltInThemeTextOverrides,
  CustomThemeConfig,
  TadoiSettings,
  ThemeObjectId
} from "../settings/settings";

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
  | "trooper"
  | "twilight"
  | "msdos"
  | "niners"
  | "mcrn"
  | "zeke"
  | "gundam"
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
  trooper: {
    bg: "#ffffff",
    panel: "#f3f3f3",
    text: "#000000",
    mutedText: "#4a4a4a",
    border: "#000000",
    accent: "#000000",
    accent2: "#2b2b2b",
    ok: "#1f1f1f",
    warn: "#5c5c5c",
    danger: "#8c8c8c",
    selectionBg: "#000000",
    selectionText: "#ffffff"
  },
  twilight: {
    bg: "#000000",
    panel: "#121212",
    text: "#ffffff",
    mutedText: "#bfbfbf",
    border: "#ffffff",
    accent: "#ffffff",
    accent2: "#d9d9d9",
    ok: "#e6e6e6",
    warn: "#a6a6a6",
    danger: "#737373",
    selectionBg: "#ffffff",
    selectionText: "#000000"
  },
  msdos: {
    bg: "#0000aa",
    panel: "#000088",
    text: "#aaaaaa",
    mutedText: "#808080",
    border: "#55ffff",
    accent: "#55ffff",
    accent2: "#ffff55",
    ok: "#55ff55",
    warn: "#ffff55",
    danger: "#ff5555",
    selectionBg: "#aaaaaa",
    selectionText: "#0000aa"
  },
  niners: {
    bg: "#1f0a0a",
    panel: "#3a1111",
    text: "#fff4d6",
    mutedText: "#d6c39a",
    border: "#b3995d",
    accent: "#b3995d",
    accent2: "#d62839",
    ok: "#c6b17a",
    warn: "#e3be63",
    danger: "#d95a4e",
    selectionBg: "#b3995d",
    selectionText: "#1f0a0a"
  },
  mcrn: {
    bg: "#0a0d12",
    panel: "#141a23",
    text: "#e6edf7",
    mutedText: "#9aa8be",
    border: "#ff6a00",
    accent: "#ff6a00",
    accent2: "#c43e2f",
    ok: "#6ed3a5",
    warn: "#ffc857",
    danger: "#ff4d4d",
    selectionBg: "#ff6a00",
    selectionText: "#0a0d12"
  },
  zeke: {
    bg: "#0e1a14",
    panel: "#163025",
    text: "#d7f5e3",
    mutedText: "#8fb7a0",
    border: "#3e7d62",
    accent: "#7bcb9a",
    accent2: "#c85c8e",
    ok: "#5fd08c",
    warn: "#e3c265",
    danger: "#d96b6b",
    selectionBg: "#2f6b53",
    selectionText: "#dff7ea"
  },
  gundam: {
    bg: "#0b1e3a",
    panel: "#123261",
    text: "#f5f8ff",
    mutedText: "#c7d5ee",
    border: "#f9d648",
    accent: "#e53935",
    accent2: "#4da3ff",
    ok: "#5bc0eb",
    warn: "#f9d648",
    danger: "#ff5a5a",
    selectionBg: "#f9d648",
    selectionText: "#0b1e3a"
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
  "trooper",
  "twilight",
  "msdos",
  "niners",
  "mcrn",
  "zeke",
  "gundam",
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
  "rams",
  "trooper",
  "twilight",
  "msdos",
  "niners",
  "mcrn",
  "zeke",
  "gundam"
];

export function cycleTheme(current: ThemeId): ThemeId {
  const index = THEME_ORDER.indexOf(current);
  const safeIndex = index === -1 ? 0 : index;
  return THEME_ORDER[(safeIndex + 1) % THEME_ORDER.length];
}

export function formatThemeDisplayName(themeId: ThemeId | RotatingThemeId): string {
  if (themeId === "msdos") return "MS-DOS";
  if (themeId === "mcrn") return "MCRN";
  if (themeId === "gundam") return "GUNDAM";
  const spaced = themeId
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export type ResolveThemeTokensOptions = {
  objectId?: ThemeObjectId;
  draft?: CustomThemeConfig;
  builtInTextDraft?: BuiltInThemeTextOverrides;
};

export function resolveThemeTokens(
  themeId: ThemeId,
  settings: Pick<TadoiSettings, "customThemes"> | undefined,
  options: ResolveThemeTokensOptions = {}
): ThemeTokens {
  if (themeId === "custom1") {
    const base =
      options.draft?.global ?? settings?.customThemes?.custom1?.global ?? THEMES.default;
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

  const base = THEMES[themeId];
  const isRotatingTheme = ROTATING_THEME_ORDER.includes(themeId as RotatingThemeId);
  if (!isRotatingTheme) {
    return base;
  }

  const rotatingThemeId = themeId as RotatingThemeId;
  const persistedTextOverrides = settings?.customThemes?.textByTheme?.[rotatingThemeId];
  const draftTextOverrides = options.builtInTextDraft?.[rotatingThemeId];
  const globalTextOverride = draftTextOverrides?.global ?? persistedTextOverrides?.global;
  const objectTextOverride = options.objectId
    ? draftTextOverrides?.objects?.[options.objectId] ??
      persistedTextOverrides?.objects?.[options.objectId]
    : undefined;

  return {
    ...base,
    ...globalTextOverride,
    ...objectTextOverride
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
      value === "trooper" ||
      value === "twilight" ||
      value === "msdos" ||
      value === "niners" ||
      value === "mcrn" ||
      value === "zeke" ||
      value === "gundam" ||
      value === "custom1" ||
      value === "rotating")
  );
}
