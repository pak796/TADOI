import os from "os";
import path from "path";
import {
  SETTINGS_DIR_NAME,
  SETTINGS_FALLBACK_DIR_NAME,
  SETTINGS_FILE_NAME,
} from "../brand/brand";
import type { ResolveSettingsPathOptions } from "./types";

function pathApiForPlatform(
  platform: NodeJS.Platform,
): typeof path.posix | typeof path.win32 {
  return platform === "win32" ? path.win32 : path.posix;
}

export function resolveSettingsPaths(
  options: ResolveSettingsPathOptions = {},
): { primary: string; fallback: string } {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const homeDir =
    options.homeDir ?? env.HOME ?? env.USERPROFILE ?? os.homedir();
  const pathApi = pathApiForPlatform(platform);

  return {
    primary: pathApi.join(
      homeDir,
      ".config",
      SETTINGS_DIR_NAME,
      SETTINGS_FILE_NAME,
    ),
    fallback: pathApi.join(
      homeDir,
      SETTINGS_FALLBACK_DIR_NAME,
      SETTINGS_FILE_NAME,
    ),
  };
}
