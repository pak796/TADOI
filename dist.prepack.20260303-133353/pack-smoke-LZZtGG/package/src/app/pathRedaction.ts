import os from "os";
import path from "path";
import { ENV_VARS } from "../brand/brand";

export type PathRedactionOptions = {
  homeDir?: string;
  env?: NodeJS.ProcessEnv;
};

export function redactPathForDisplay(
  pathValue: string,
  options: PathRedactionOptions = {}
): string {
  const env = options.env ?? process.env;
  if (env[ENV_VARS.VERBOSE_PATH_LOGS] === "1") {
    return pathValue;
  }

  const normalizedInput = pathValue.trim();
  if (!normalizedInput) {
    return pathValue;
  }

  const homeDir = options.homeDir ?? os.homedir();
  const normalizedPath = normalizedInput.replaceAll("\\", "/");
  const normalizedHome = homeDir.replaceAll("\\", "/");

  if (normalizedPath === normalizedHome) {
    return "~";
  }
  if (normalizedPath.startsWith(`${normalizedHome}/`)) {
    return `~/${normalizedPath.slice(normalizedHome.length + 1)}`;
  }
  if (path.isAbsolute(normalizedInput)) {
    const basename = path.basename(normalizedInput);
    return basename ? `~/.../${basename}` : "~/...";
  }

  return normalizedInput;
}
