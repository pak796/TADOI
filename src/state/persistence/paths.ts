import os from "os";
import path from "path";
import { BRAND_SLUG, DATA_FILE_NAME, ENV_VARS } from "../../brand/brand";
import type { ResolveDataPathOptions } from "../persistence/types";

type PathApi = typeof path.posix | typeof path.win32;

function pathApiForPlatform(platform: NodeJS.Platform): PathApi {
  return platform === "win32" ? path.win32 : path.posix;
}

export function resolveDataPath(options: ResolveDataPathOptions = {}): string {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const homeDir =
    options.homeDir ?? env.HOME ?? env.USERPROFILE ?? os.homedir() ?? cwd;
  const pathApi = pathApiForPlatform(platform);
  const override = env[ENV_VARS.DATA_PATH]?.trim();

  if (override) {
    return pathApi.isAbsolute(override)
      ? pathApi.normalize(override)
      : pathApi.resolve(cwd, override);
  }

  if (platform === "win32") {
    const appData =
      env.APPDATA?.trim() || pathApi.join(homeDir, "AppData", "Roaming");
    return pathApi.join(appData, BRAND_SLUG, DATA_FILE_NAME);
  }

  if (platform === "darwin") {
    return pathApi.join(
      homeDir,
      "Library",
      "Application Support",
      BRAND_SLUG,
      DATA_FILE_NAME,
    );
  }

  const xdgDataHome =
    env.XDG_DATA_HOME?.trim() || pathApi.join(homeDir, ".local", "share");
  return pathApi.join(xdgDataHome, BRAND_SLUG, DATA_FILE_NAME);
}

export function getDataFilePath(): string {
  return resolveDataPath();
}
