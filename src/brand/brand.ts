export const APP_NAME = "TADOI";
export const APP_TAGLINE = "Terminal Accessible Digital Organization Interface";
export const CLI_NAME = "tadoi";
export const BRAND_SLUG = "tadoi";

export const ENV_VARS = {
  DATA_PATH: "TADOI_DATA_PATH",
  PERF_DEBUG: "TADOI_PERF_DEBUG"
} as const;

export const DATA_FILE_NAME = `${BRAND_SLUG}_data.json`;
export const SETTINGS_FILE_NAME = "settings.json";
export const SETTINGS_DIR_NAME = BRAND_SLUG;
export const SETTINGS_FALLBACK_DIR_NAME = `.${BRAND_SLUG}`;

export const ASCII_LOGO = {
  FULL: ` _____   _    ____   ___ ___
|_   _| / \\  |  _ \\ / _ \\_ _|
  | |  / _ \\ | | | | | | | |
  | | / ___ \\| |_| | |_| | |
  |_|/_/   \\_\\____/ \\___/___|`,
  COMPACT: `TTTT  A  DD   OO  III
  T  AAA D D O  O  I`,
  MICRO: `[TADOI]`
} as const;

export type AsciiLogoVariant = keyof typeof ASCII_LOGO;

export function getAsciiLogoLines(variant: AsciiLogoVariant): string[] {
  return ASCII_LOGO[variant].split("\n");
}

export function getHeaderLogoVariant(terminalWidth: number): AsciiLogoVariant {
  if (terminalWidth >= 120) return "FULL";
  if (terminalWidth >= 90) return "COMPACT";
  return "MICRO";
}
