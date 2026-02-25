import type {
  CrtFxLiteColor,
  CrtFxLitePreset
} from "../settings/settings";

type CrtFxLiteProps = {
  enabled: boolean;
  height: number;
  baseColor: string;
  tick: number;
  preset?: CrtFxLitePreset;
  color?: CrtFxLiteColor;
};

export type CrtFxColorRole = "bg" | "panel" | "accent" | "border";

type CrtFxPresetConfig = {
  tintStrengthByRole: Record<CrtFxColorRole, number>;
  flickerDelta: number;
  flickerEveryTicks: number;
};

const CRT_TINT_COLORS: Record<CrtFxLiteColor, string> = {
  green: "#4EE39B",
  amber: "#F2A64A"
};

const CRT_FX_PRESETS: Record<CrtFxLitePreset, CrtFxPresetConfig> = {
  subtle: {
    tintStrengthByRole: {
      bg: 0.04,
      panel: 0.06,
      accent: 0.05,
      border: 0.05
    },
    flickerDelta: -1,
    flickerEveryTicks: 16
  },
  normal: {
    tintStrengthByRole: {
      bg: 0.06,
      panel: 0.1,
      accent: 0.08,
      border: 0.08
    },
    flickerDelta: -2,
    flickerEveryTicks: 12
  },
  strong: {
    tintStrengthByRole: {
      bg: 0.1,
      panel: 0.15,
      accent: 0.12,
      border: 0.12
    },
    flickerDelta: -3,
    flickerEveryTicks: 8
  }
};

function clampColorChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.trim().match(/^#([0-9a-fA-F]{6})$/);
  if (!match) return null;
  const raw = match[1];
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16)
  };
}

function toHexColor(rgb: { r: number; g: number; b: number }): string {
  const r = clampColorChannel(rgb.r);
  const g = clampColorChannel(rgb.g);
  const b = clampColorChannel(rgb.b);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b
    .toString(16)
    .padStart(2, "0")}`.toUpperCase();
}

function adjustHexColor(hex: string, delta: number): string {
  const parsed = parseHexColor(hex);
  if (!parsed) return "#000000";
  return toHexColor({
    r: parsed.r + delta,
    g: parsed.g + delta,
    b: parsed.b + delta
  });
}

function blendHexColors(baseHex: string, tintHex: string, tintStrength: number): string {
  const base = parseHexColor(baseHex);
  const tint = parseHexColor(tintHex);
  if (!base || !tint) return "#000000";
  const weight = Math.max(0, Math.min(1, tintStrength));
  return toHexColor({
    r: base.r * (1 - weight) + tint.r * weight,
    g: base.g * (1 - weight) + tint.g * weight,
    b: base.b * (1 - weight) + tint.b * weight
  });
}

export function resolveCrtFxColor(params: {
  baseColor: string;
  enabled: boolean;
  preset: CrtFxLitePreset;
  color: CrtFxLiteColor;
  tick: number;
  role?: CrtFxColorRole;
}): string {
  if (!params.enabled) return params.baseColor;
  const role = params.role ?? "panel";
  const config = CRT_FX_PRESETS[params.preset];
  const tintHex = CRT_TINT_COLORS[params.color];
  const tinted = blendHexColors(params.baseColor, tintHex, config.tintStrengthByRole[role]);
  const flickerFrame = params.tick % config.flickerEveryTicks === 0;
  return adjustHexColor(tinted, flickerFrame ? config.flickerDelta : 0);
}

export function CrtFxLite({
  enabled,
  height: _height,
  baseColor,
  tick,
  preset = "normal",
  color = "green"
}: CrtFxLiteProps) {
  void resolveCrtFxColor({
    baseColor,
    enabled,
    preset,
    color,
    tick
  });
  return null;
}
