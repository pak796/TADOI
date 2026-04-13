import {
  THEME_OBJECT_IDS,
  type ThemeObjectId,
  type ThemeTextTokenOverrides,
} from "../settings/settings";
import { THEMES, type RotatingThemeId, type ThemeTokens } from "./themes";

type ContrastRule = {
  label: string;
  foreground: keyof ThemeTokens;
  background: keyof ThemeTokens;
  minimumRatio: number;
};

export type ThemeContrastIssue = {
  scope: string;
  label: string;
  foreground: keyof ThemeTokens;
  background: keyof ThemeTokens;
  ratio: number;
  minimumRatio: number;
};

export type ThemeContrastValidationResult = {
  ok: boolean;
  issues: ThemeContrastIssue[];
};

const CONTRAST_RULES: ContrastRule[] = [
  {
    label: "text on background",
    foreground: "text",
    background: "bg",
    minimumRatio: 4.5,
  },
  {
    label: "text on panel",
    foreground: "text",
    background: "panel",
    minimumRatio: 4.5,
  },
  {
    label: "muted text on background",
    foreground: "mutedText",
    background: "bg",
    minimumRatio: 3,
  },
  {
    label: "muted text on panel",
    foreground: "mutedText",
    background: "panel",
    minimumRatio: 3,
  },
  {
    label: "selection text on selection background",
    foreground: "selectionText",
    background: "selectionBg",
    minimumRatio: 4.5,
  },
];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.trim().replace(/^#/, "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function srgbToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function computeContrastRatio(
  foreground: string,
  background: string,
): number {
  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);
  const fgLuminance =
    0.2126 * srgbToLinear(fg.r) +
    0.7152 * srgbToLinear(fg.g) +
    0.0722 * srgbToLinear(fg.b);
  const bgLuminance =
    0.2126 * srgbToLinear(bg.r) +
    0.7152 * srgbToLinear(bg.g) +
    0.0722 * srgbToLinear(bg.b);
  const lighter = Math.max(fgLuminance, bgLuminance);
  const darker = Math.min(fgLuminance, bgLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function validateThemeTokensContrast(
  tokens: ThemeTokens,
  scope: string,
  baselineTokens?: ThemeTokens,
): ThemeContrastValidationResult {
  const issues: ThemeContrastIssue[] = [];
  for (const rule of CONTRAST_RULES) {
    const ratio = computeContrastRatio(
      tokens[rule.foreground],
      tokens[rule.background],
    );
    const baselineRatio = baselineTokens
      ? computeContrastRatio(
          baselineTokens[rule.foreground],
          baselineTokens[rule.background],
        )
      : null;
    const baselineWasFailing =
      baselineRatio !== null && baselineRatio < rule.minimumRatio;
    const becameWorse = baselineRatio !== null && ratio < baselineRatio - 0.01;
    const shouldReport =
      ratio < rule.minimumRatio &&
      (baselineRatio === null || !baselineWasFailing || becameWorse);
    if (shouldReport) {
      issues.push({
        scope,
        label: rule.label,
        foreground: rule.foreground,
        background: rule.background,
        ratio,
        minimumRatio: rule.minimumRatio,
      });
    }
  }
  return {
    ok: issues.length === 0,
    issues,
  };
}

export function validateCustomThemeContrast(params: {
  global: ThemeTokens;
  objects?: Partial<Record<ThemeObjectId, Partial<ThemeTokens>>>;
  baselineGlobal?: ThemeTokens;
  baselineObjects?: Partial<Record<ThemeObjectId, Partial<ThemeTokens>>>;
}): ThemeContrastValidationResult {
  const issues: ThemeContrastIssue[] = [];
  const globalValidation = validateThemeTokensContrast(
    params.global,
    "global",
    params.baselineGlobal,
  );
  issues.push(...globalValidation.issues);

  for (const objectId of THEME_OBJECT_IDS) {
    const objectOverrides = params.objects?.[objectId];
    if (!objectOverrides || Object.keys(objectOverrides).length === 0) continue;
    const merged = {
      ...params.global,
      ...objectOverrides,
    };
    const baselineMerged = params.baselineGlobal
      ? {
          ...params.baselineGlobal,
          ...(params.baselineObjects?.[objectId] ?? {}),
        }
      : undefined;
    const objectValidation = validateThemeTokensContrast(
      merged,
      `object:${objectId}`,
      baselineMerged,
    );
    issues.push(...objectValidation.issues);
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function validateBuiltInTextContrast(params: {
  themeId: RotatingThemeId;
  global?: ThemeTextTokenOverrides;
  objects?: Partial<Record<ThemeObjectId, ThemeTextTokenOverrides>>;
  baselineGlobal?: ThemeTextTokenOverrides;
  baselineObjects?: Partial<Record<ThemeObjectId, ThemeTextTokenOverrides>>;
}): ThemeContrastValidationResult {
  const baseTokens = THEMES[params.themeId];
  const globalTokens = {
    ...baseTokens,
    ...(params.global ?? {}),
  };
  const baselineGlobalTokens = {
    ...baseTokens,
    ...(params.baselineGlobal ?? {}),
  };
  const issues: ThemeContrastIssue[] = [];

  const globalValidation = validateThemeTokensContrast(
    globalTokens,
    `theme:${params.themeId}`,
    baselineGlobalTokens,
  );
  issues.push(...globalValidation.issues);

  for (const objectId of THEME_OBJECT_IDS) {
    const objectOverrides = params.objects?.[objectId];
    if (!objectOverrides || Object.keys(objectOverrides).length === 0) continue;
    const objectTokens = {
      ...globalTokens,
      ...objectOverrides,
    };
    const baselineObjectTokens = {
      ...baselineGlobalTokens,
      ...(params.baselineObjects?.[objectId] ?? {}),
    };
    const objectValidation = validateThemeTokensContrast(
      objectTokens,
      `theme:${params.themeId}/object:${objectId}`,
      baselineObjectTokens,
    );
    issues.push(...objectValidation.issues);
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function formatContrastIssueForBanner(
  issue: ThemeContrastIssue,
): string {
  const ratio = issue.ratio.toFixed(2);
  const minimum = issue.minimumRatio.toFixed(1);
  return `${issue.scope} ${issue.label} ${ratio}<${minimum}`;
}
