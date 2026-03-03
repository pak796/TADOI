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
  PERF_DEBUG: "TADOI_PERF_DEBUG",
  VERBOSE_PATH_LOGS: "TADOI_VERBOSE_PATH_LOGS",
  GITHUB_SNAPSHOT_PASSPHRASE: "TADOI_GITHUB_SNAPSHOT_PASSPHRASE"
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
  | "alternate_blocks32"
  | "taag_slant32"
  | "taag_rectangles32"
  | "taag_lcd32"
  | "taag_puffy32"
  | "taag_bulbhead32"
  | "taag_braced32"
  | "taag_double32"
  | "taag_small32";

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

const TAAG_SLANT_LOGO_32 = [
  "  _________    ____  ____  ____",
  " /_  __/   |  / __ \\/ __ \\/  _/",
  "  / / / /| | / / / / / / // /",
  " / / / ___ |/ /_/ / /_/ // /",
  "/_/ /_/  |_/_____/\\____/___/"
].join("\n");

const TAAG_RECTANGLES_LOGO_32 = [
  "",
  " _____ _____ ____  _____ _____",
  "|_   _|  _  |    \\|     |     |",
  "  | | |     |  |  |  |  |-   -|",
  "  |_| |__|__|____/|_____|_____|"
].join("\n");

const TAAG_LCD_LOGO_32 = [
  " ___   ___   ___   ___   ___",
  "  |   |   |   | | |   |   |",
  "  +   |-+-|   + | |   |   +",
  "  |   |   |   | | |   |   |",
  "             ---   ---   ---"
].join("\n");

const TAAG_PUFFY_LOGO_32 = [
  " _____  _____  ___    _____  _",
  "(_   _)(  _  )(  _`\\ (  _  )(_)",
  "  | |  | (_) || | ) || ( ) || |",
  "  | |  |  _  || | | )| | | || |",
  "  | |  | | | || |_) || (_) || |",
  "  (_)  (_) (_)(____/'(_____)(_)"
].join("\n");

const TAAG_BULBHEAD_LOGO_32 = [
  " ____   __    ____  _____  ____",
  "(_  _) /__\\  (  _ \\(  _  )(_  _)",
  "  )(  /(__)\\  )(_) ))(_)(  _)(_",
  " (__)(__)(__)(____/(_____)(____)"
].join("\n");

const TAAG_BRACED_LOGO_32 = [
  ".-----. .--.  .----.  .---. .-.",
  "`-' '-'/ {} \\ } {-. \\/ {-. \\{ |",
  "  } { /  /\\  \\} '-} /\\ '-} /| }",
  "  `-' `-'  `-'`----'  `---' `-'"
].join("\n");

const TAAG_DOUBLE_LOGO_32 = [
  " ______  ___  ____     ___   __",
  " | || | // \\\\ || \\\\   // \\\\  ||",
  "   ||   ||=|| ||  )) ((   )) ||",
  "   ||   || || ||_//   \\\\_//  ||"
].join("\n");

const TAAG_SMALL_LOGO_32 = [
  "  _____ _   ___   ___ ___",
  " |_   _/_\\ |   \\ / _ \\_ _|",
  "   | |/ _ \\| |) | (_) | |",
  "   |_/_/ \\_\\___/ \\___/___|"
].join("\n");

export const LOGO_VARIANTS: Record<LogoVariantId, string[]> = {
  default: ASCII_LOGO.FULL.split("\n"),
  alternate32: ALTERNATE_LOGO_32.split("\n"),
  alternate_slash32: ALTERNATE_SLASH_LOGO_32.split("\n"),
  alternate_blocks32: ALTERNATE_BLOCKS_LOGO_32.split("\n"),
  taag_slant32: TAAG_SLANT_LOGO_32.split("\n"),
  taag_rectangles32: TAAG_RECTANGLES_LOGO_32.split("\n"),
  taag_lcd32: TAAG_LCD_LOGO_32.split("\n"),
  taag_puffy32: TAAG_PUFFY_LOGO_32.split("\n"),
  taag_bulbhead32: TAAG_BULBHEAD_LOGO_32.split("\n"),
  taag_braced32: TAAG_BRACED_LOGO_32.split("\n"),
  taag_double32: TAAG_DOUBLE_LOGO_32.split("\n"),
  taag_small32: TAAG_SMALL_LOGO_32.split("\n")
};

export const LOGO_VARIANT_LABELS: Record<LogoVariantId, string> = {
  default: "Default",
  alternate32: "Doom",
  alternate_slash32: "Slash",
  alternate_blocks32: "Blocks",
  taag_slant32: "Slant",
  taag_rectangles32: "Rectangles",
  taag_lcd32: "LCD",
  taag_puffy32: "Puffy",
  taag_bulbhead32: "Bulbhead",
  taag_braced32: "Braced",
  taag_double32: "Double",
  taag_small32: "Small"
};

export const ROTATING_LOGO_ORDER: LogoVariantId[] = [
  "default",
  "alternate32",
  "alternate_slash32",
  "alternate_blocks32",
  "taag_slant32",
  "taag_rectangles32",
  "taag_lcd32",
  "taag_puffy32",
  "taag_bulbhead32",
  "taag_braced32",
  "taag_double32",
  "taag_small32"
];

export function formatLogoModeLabel(mode: LogoVariantId | "rotate"): string {
  if (mode === "rotate") return "Rotate";
  return LOGO_VARIANT_LABELS[mode];
}

export function getAsciiLogoLines(variant: AsciiLogoVariant): string[] {
  return ASCII_LOGO[variant].split("\n");
}

export function getHeaderLogoVariant(terminalWidth: number): AsciiLogoVariant {
  if (terminalWidth >= 120) return "FULL";
  if (terminalWidth >= 90) return "COMPACT";
  return "MICRO";
}
