import os from "os";
import { promises as fs } from "fs";
import path from "path";
import { ThemeId, isThemeId } from "../theme/themes";

export type ToduiSettings = {
  themeId: ThemeId;
};

export type SettingsFsOps = Pick<typeof fs, "mkdir" | "readFile" | "writeFile">;

export type ResolveSettingsPathOptions = {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
};

export type LoadSettingsOptions = ResolveSettingsPathOptions & {
  fsOps?: SettingsFsOps;
};

export type SaveSettingsOptions = ResolveSettingsPathOptions & {
  fsOps?: SettingsFsOps;
  filePath?: string;
};

export type LoadSettingsResult = {
  settings: ToduiSettings;
  resolvedPath: string;
};

const DEFAULT_SETTINGS: ToduiSettings = {
  themeId: "default"
};

const DEFAULT_DEBOUNCE_MS = 150;
const DEFAULT_FS_OPS: SettingsFsOps = fs;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastResolvedPath: string | null = null;

function pathApiForPlatform(platform: NodeJS.Platform): typeof path.posix | typeof path.win32 {
  return platform === "win32" ? path.win32 : path.posix;
}

export function resolveSettingsPaths(
  options: ResolveSettingsPathOptions = {}
): { primary: string; fallback: string } {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const homeDir = options.homeDir ?? env.HOME ?? env.USERPROFILE ?? os.homedir();
  const pathApi = pathApiForPlatform(platform);

  return {
    primary: pathApi.join(homeDir, ".config", "todui", "settings.json"),
    fallback: pathApi.join(homeDir, ".todui", "settings.json")
  };
}

function normalizeSettings(input: unknown): ToduiSettings {
  if (typeof input !== "object" || input === null) {
    return DEFAULT_SETTINGS;
  }
  const maybeThemeId = (input as { themeId?: unknown }).themeId;
  if (isThemeId(maybeThemeId)) {
    return { themeId: maybeThemeId };
  }
  return DEFAULT_SETTINGS;
}

async function readSettingsFile(
  filePath: string,
  fsOps: SettingsFsOps
): Promise<ToduiSettings | null> {
  try {
    const raw = await fsOps.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return normalizeSettings(parsed);
  } catch {
    return null;
  }
}

async function writeSettings(
  settings: ToduiSettings,
  filePath: string,
  fsOps: SettingsFsOps
): Promise<void> {
  await fsOps.mkdir(path.dirname(filePath), { recursive: true });
  await fsOps.writeFile(filePath, JSON.stringify(settings, null, 2), "utf8");
}

export async function loadSettings(
  options: LoadSettingsOptions = {}
): Promise<LoadSettingsResult> {
  const fsOps = options.fsOps ?? DEFAULT_FS_OPS;
  const { primary, fallback } = resolveSettingsPaths(options);

  const primarySettings = await readSettingsFile(primary, fsOps);
  if (primarySettings) {
    lastResolvedPath = primary;
    return { settings: primarySettings, resolvedPath: primary };
  }

  const fallbackSettings = await readSettingsFile(fallback, fsOps);
  if (fallbackSettings) {
    lastResolvedPath = fallback;
    return { settings: fallbackSettings, resolvedPath: fallback };
  }

  lastResolvedPath = primary;
  return { settings: DEFAULT_SETTINGS, resolvedPath: primary };
}

export function saveSettingsDebounced(
  settings: ToduiSettings,
  delayMs = DEFAULT_DEBOUNCE_MS,
  options: SaveSettingsOptions = {}
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
        // Fallback behavior for when writing to primary path fails.
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

export function getDefaultSettings(): ToduiSettings {
  return DEFAULT_SETTINGS;
}

export function resetSettingsStateForTests(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  lastResolvedPath = null;
}
