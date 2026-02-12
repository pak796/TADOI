export const PRODUCT_NAME = "TADOI";
export const PRODUCT_NAME_TM = "TADOI™";
export const TRADEMARK_OWNER = "<OWNER>";
export const TRADEMARK_NOTICE =
  `${PRODUCT_NAME_TM} is a trademark of ${TRADEMARK_OWNER}. ` +
  "Other names may be trademarks of their respective owners.";
export const TRADEMARK_NOTICE_LINES = [
  `${PRODUCT_NAME_TM} is a trademark of ${TRADEMARK_OWNER}.`,
  "Other names may be trademarks of their respective owners."
] as const;

export const APP_NAME = PRODUCT_NAME;
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
export const LOGO_MAX_WIDTH = 32;

export const ASCII_LOGO = {
  FULL: `   _____   _    ____   ___ ___
  |_   _| / \\  |  _ \\ / _ \\_ _|
    | |  / _ \\ | | | | | | | |
    | | / ___ \\| |_| | |_| | |
    |_|/_/   \\_\\____/ \\___/___|`,
  COMPACT: `TTTT  A  DD   OO  III
  T  AAA D D O  O  I`,
  MICRO: `[TADOI]`
} as const;

export type AsciiLogoVariant = keyof typeof ASCII_LOGO;
export type LogoVariantId =
  | "default"
  | "alternate32"
  | "alternate_slash32"
  | "alternate_blocks32";

const ALTERNATE_LOGO_32 = ` _____ ___ ______ _____ _____ 
|_   _/ _ \\|  _  \\  _  |_   _|
  | |/ /_\\ \\ | | | | | | | |  
  | ||  _  | | | | | | | | |  
  | || | | | |/ /\\ \\_/ /_| |_ 
  \\_/\\_| |_/___/  \\___/ \\___/ 
                               `;

const ALTERNATE_SLASH_LOGO_32 = `   _________   ___  ____  ____
  /_  __/ _ | / _ \\/ __ \\/  _/
   / / / __ |/ // / /_/ // /  
  /_/ /_/ |_/____/\\____/___/  
                              `;

const ALTERNATE_BLOCKS_LOGO_32 = `  ▗▄▄▄▖▗▄▖ ▗▄▄▄  ▗▄▖ ▗▄▄▄▖
    █ ▐▌ ▐▌▐▌  █▐▌ ▐▌  █  
    █ ▐▛▀▜▌▐▌  █▐▌ ▐▌  █  
    █ ▐▌ ▐▌▐▙▄▄▀▝▚▄▞▘▗▄█▄▖
                          
                          `;

export const LOGO_VARIANTS: Record<LogoVariantId, string[]> = {
  default: ASCII_LOGO.FULL.split("\n"),
  alternate32: ALTERNATE_LOGO_32.split("\n"),
  alternate_slash32: ALTERNATE_SLASH_LOGO_32.split("\n"),
  alternate_blocks32: ALTERNATE_BLOCKS_LOGO_32.split("\n")
};

export const ROTATING_LOGO_ORDER: LogoVariantId[] = [
  "default",
  "alternate32",
  "alternate_slash32",
  "alternate_blocks32"
];

export function getAsciiLogoLines(variant: AsciiLogoVariant): string[] {
  return ASCII_LOGO[variant].split("\n");
}

export function getHeaderLogoVariant(terminalWidth: number): AsciiLogoVariant {
  if (terminalWidth >= 120) return "FULL";
  if (terminalWidth >= 90) return "COMPACT";
  return "MICRO";
}
