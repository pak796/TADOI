import type { ThemeTokens } from "./themes";

export const THEME_TOKEN_KEYS: Array<keyof ThemeTokens> = [
  "bg",
  "panel",
  "text",
  "mutedText",
  "border",
  "accent",
  "accent2",
  "ok",
  "warn",
  "danger",
  "selectionBg",
  "selectionText",
];

export const THEME_TEXT_TOKEN_KEYS: Array<
  keyof Pick<ThemeTokens, "text" | "mutedText" | "selectionText">
> = ["text", "mutedText", "selectionText"];

export type RgbColor = {
  r: number;
  g: number;
  b: number;
};

export type RgbChannelLabel = "R" | "G" | "B";

const HEX_COLOR = /^#[0-9A-F]{6}$/;

export function clampRgbChannel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR.test(value.toUpperCase());
}

export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toUpperCase();
  if (!trimmed.startsWith("#")) return null;
  if (!HEX_COLOR.test(trimmed)) return null;
  return trimmed;
}

export function rgbToHex(rgb: RgbColor): string {
  const r = clampRgbChannel(rgb.r).toString(16).padStart(2, "0");
  const g = clampRgbChannel(rgb.g).toString(16).padStart(2, "0");
  const b = clampRgbChannel(rgb.b).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`.toUpperCase();
}

export function hexToRgb(value: string): RgbColor | null {
  const normalized = normalizeHexColor(value);
  if (!normalized) return null;
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

export function stepRgbChannel(current: number, step: number): number {
  return clampRgbChannel(current + step);
}

export function formatRgbRow(label: RgbChannelLabel, value: number): string {
  const clamped = clampRgbChannel(value);
  const leftIndicator = clamped === 0 ? " " : "<";
  const rightIndicator = clamped === 255 ? " " : ">";
  const padded = String(clamped).padStart(3, "0");
  return `${label}: ${leftIndicator} ${padded} ${rightIndicator}`;
}
