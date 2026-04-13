import path from "path";
import {
  DEFAULT_DEBOUNCE_MS,
  DEFAULT_FS_OPS,
  PRIVATE_DIR_MODE,
  PRIVATE_FILE_MODE,
} from "./defaults";
import { getDefaultSettings, normalizeSettings } from "./normalize";
import { resolveSettingsPaths } from "./paths";
import type {
  LoadSettingsOptions,
  LoadSettingsResult,
  SaveSettingsOptions,
  SaveSettingsStrictResult,
  SettingsFsOps,
  TadoiSettings,
} from "./types";

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastResolvedPath: string | null = null;

async function readSettingsFile(
  label: "primary" | "fallback",
  filePath: string,
  fsOps: SettingsFsOps,
): Promise<{ settings: TadoiSettings | null; warning?: string }> {
  let raw: string;
  try {
    raw = await fsOps.readFile(filePath, "utf8");
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return { settings: null };
    }
    return {
      settings: null,
      warning: `${label} settings file could not be read; using fallback/default settings`,
    };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return { settings: normalizeSettings(parsed) };
  } catch {
    return {
      settings: null,
      warning: `${label} settings file is not valid JSON; using fallback/default settings`,
    };
  }
}

async function writeSettings(
  settings: TadoiSettings,
  filePath: string,
  fsOps: SettingsFsOps,
): Promise<void> {
  await fsOps.mkdir(path.dirname(filePath), {
    recursive: true,
    mode: PRIVATE_DIR_MODE,
  });
  await fsOps.writeFile(filePath, JSON.stringify(settings, null, 2), {
    encoding: "utf8",
    mode: PRIVATE_FILE_MODE,
  });
}

export async function loadSettings(
  options: LoadSettingsOptions = {},
): Promise<LoadSettingsResult> {
  const fsOps = options.fsOps ?? DEFAULT_FS_OPS;
  const { primary, fallback } = resolveSettingsPaths(options);
  const warnings: string[] = [];

  const primaryResult = await readSettingsFile("primary", primary, fsOps);
  if (primaryResult.warning) {
    warnings.push(primaryResult.warning);
  }
  if (primaryResult.settings) {
    lastResolvedPath = primary;
    return {
      settings: primaryResult.settings,
      resolvedPath: primary,
      warnings,
    };
  }

  const fallbackResult = await readSettingsFile("fallback", fallback, fsOps);
  if (fallbackResult.warning) {
    warnings.push(fallbackResult.warning);
  }
  if (fallbackResult.settings) {
    lastResolvedPath = fallback;
    return {
      settings: fallbackResult.settings,
      resolvedPath: fallback,
      warnings,
    };
  }

  lastResolvedPath = primary;
  return { settings: getDefaultSettings(), resolvedPath: primary, warnings };
}

export function saveSettingsDebounced(
  settings: TadoiSettings,
  delayMs = DEFAULT_DEBOUNCE_MS,
  options: SaveSettingsOptions = {},
): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  const fsOps = options.fsOps ?? DEFAULT_FS_OPS;
  const { primary, fallback } = resolveSettingsPaths(options);
  const preferredPath = options.filePath ?? lastResolvedPath ?? primary;
  const normalized = normalizeSettings(settings);

  saveTimer = setTimeout(() => {
    void (async () => {
      try {
        await writeSettings(normalized, preferredPath, fsOps);
        lastResolvedPath = preferredPath;
      } catch {
        if (preferredPath === primary) {
          try {
            await writeSettings(normalized, fallback, fsOps);
            lastResolvedPath = fallback;
          } catch {
            // Intentionally swallow; settings persistence should not break runtime.
          }
        }
      } finally {
        saveTimer = null;
      }
    })();
  }, delayMs);
}

export async function saveSettingsStrict(
  settings: TadoiSettings,
  options: SaveSettingsOptions = {},
): Promise<SaveSettingsStrictResult> {
  const fsOps = options.fsOps ?? DEFAULT_FS_OPS;
  const { primary, fallback } = resolveSettingsPaths(options);
  const preferredPath = options.filePath ?? lastResolvedPath ?? primary;
  const normalized = normalizeSettings(settings);

  try {
    await writeSettings(normalized, preferredPath, fsOps);
    lastResolvedPath = preferredPath;
    return { resolvedPath: preferredPath, usedFallback: false };
  } catch (primaryError: unknown) {
    if (preferredPath === primary) {
      try {
        await writeSettings(normalized, fallback, fsOps);
        lastResolvedPath = fallback;
        return { resolvedPath: fallback, usedFallback: true };
      } catch (fallbackError: unknown) {
        const primaryMessage =
          primaryError instanceof Error
            ? primaryError.message
            : String(primaryError);
        const fallbackMessage =
          fallbackError instanceof Error
            ? fallbackError.message
            : String(fallbackError);
        throw new Error(
          `Failed to write settings to ${primary} (${primaryMessage}) and fallback ${fallback} (${fallbackMessage})`,
        );
      }
    }

    const preferredMessage =
      primaryError instanceof Error
        ? primaryError.message
        : String(primaryError);
    throw new Error(
      `Failed to write settings to ${preferredPath}: ${preferredMessage}`,
    );
  }
}

export function resetSettingsStateForTests(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  lastResolvedPath = null;
}
