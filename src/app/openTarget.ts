import { spawn, type ChildProcess, type SpawnOptionsWithoutStdio } from "node:child_process";

const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/;

export type OpenTargetSpawn = (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio
) => Pick<ChildProcess, "on" | "once" | "unref">;

export type OpenTargetOptions = {
  platform?: NodeJS.Platform;
  spawnImpl?: OpenTargetSpawn;
};

function resolveOpenCommand(target: string, platform: NodeJS.Platform): {
  command: string;
  args: string[];
  options: SpawnOptionsWithoutStdio;
} {
  const baseOptions: SpawnOptionsWithoutStdio = {
    stdio: "ignore",
    detached: true,
    windowsHide: true
  };

  if (platform === "darwin") {
    return {
      command: "open",
      args: [target],
      options: baseOptions
    };
  }

  if (platform === "linux") {
    return {
      command: "xdg-open",
      args: [target],
      options: baseOptions
    };
  }

  if (platform === "win32") {
    return {
      command: "explorer",
      args: [target],
      options: baseOptions
    };
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

export function getOpenTargetCommandForPlatform(
  target: string,
  platform: NodeJS.Platform
): { command: string; args: string[] } {
  const resolved = resolveOpenCommand(target, platform);
  return { command: resolved.command, args: resolved.args };
}

export async function openTarget(
  target: string,
  options: OpenTargetOptions = {}
): Promise<void> {
  const trimmed = target.trim();
  if (!trimmed) {
    throw new Error("Target is required");
  }
  if (CONTROL_CHARS_RE.test(trimmed)) {
    throw new Error("Target contains control characters");
  }

  const platform = options.platform ?? process.platform;
  const spawnImpl = options.spawnImpl ?? spawn;
  const resolved = resolveOpenCommand(trimmed, platform);

  await new Promise<void>((resolve, reject) => {
    let settled = false;

    const child = spawnImpl(resolved.command, resolved.args, resolved.options);

    child.once("error", (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });

    child.once("spawn", () => {
      if (settled) return;
      settled = true;
      child.unref();
      resolve();
    });
  });
}
