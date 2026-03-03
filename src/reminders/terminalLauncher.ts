import { spawn, type ChildProcess, type SpawnOptionsWithoutStdio } from "node:child_process";
import {
  buildShellCommandLine,
  type TadoiInvocation
} from "./invocation";

export type TerminalLaunchResult = {
  ok: boolean;
  launcher: string;
  attempted: string[];
  error?: string;
};

export type TerminalLauncherDeps = {
  spawnImpl?: (
    command: string,
    args: string[],
    options: SpawnOptionsWithoutStdio
  ) => Pick<ChildProcess, "once" | "unref">;
};

class LaunchAttemptError extends Error {
  public readonly attempted: string[];

  constructor(message: string, attempted: string[]) {
    super(message);
    this.attempted = attempted;
  }
}

function baseSpawnOptions(): SpawnOptionsWithoutStdio {
  return {
    stdio: "ignore",
    detached: true,
    windowsHide: true
  };
}

async function spawnDetached(
  command: string,
  args: string[],
  spawnImpl: TerminalLauncherDeps["spawnImpl"]
): Promise<void> {
  const runner = spawnImpl ?? spawn;
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const child = runner(command, args, baseSpawnOptions());

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

function escapeAppleScriptString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function launchMacTerminal(
  commandLine: string,
  spawnImpl: TerminalLauncherDeps["spawnImpl"]
): Promise<{ launcher: string; attempted: string[] }> {
  const escaped = escapeAppleScriptString(commandLine);
  const doScript = `tell application \"Terminal\" to do script \"${escaped}\"`;
  const fallbackScript = [
    "tell application \"Terminal\"",
    `  do script \"${escaped}\"`,
    "  activate",
    "end tell"
  ].join("\n");
  const primary = `osascript primary`;
  const fallback = `osascript fallback`;
  const attempted = [primary];
  try {
    await spawnDetached(
      "osascript",
      ["-e", doScript],
      spawnImpl
    );
    return { launcher: primary, attempted };
  } catch {
    attempted.push(fallback);
    try {
      await spawnDetached(
        "osascript",
        ["-e", fallbackScript],
        spawnImpl
      );
      return { launcher: fallback, attempted };
    } catch (error: unknown) {
      throw new LaunchAttemptError(
        error instanceof Error ? error.message : String(error),
        attempted
      );
    }
  }
}

async function launchWindowsTerminal(
  commandLine: string,
  spawnImpl: TerminalLauncherDeps["spawnImpl"]
): Promise<{ launcher: string; attempted: string[] }> {
  const attempted = ["wt.exe", "powershell"];
  try {
    await spawnDetached("wt.exe", ["new-tab", "cmd", "/k", commandLine], spawnImpl);
    return { launcher: "wt.exe", attempted };
  } catch {
    const ps =
      "Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', " +
      `'${commandLine.replace(/'/g, "''")}'`;
    try {
      await spawnDetached("powershell", ["-NoProfile", "-Command", ps], spawnImpl);
      return { launcher: "powershell:Start-Process", attempted };
    } catch (error: unknown) {
      throw new LaunchAttemptError(
        error instanceof Error ? error.message : String(error),
        attempted
      );
    }
  }
}

function linuxTerminalCandidates(env: NodeJS.ProcessEnv): Array<{ command: string; args: string[] }> {
  const candidates: Array<{ command: string; args: string[] }> = [];

  const fromEnv = env.TERMINAL?.trim();
  if (fromEnv) {
    candidates.push({ command: fromEnv, args: ["-e"] });
  }

  candidates.push({ command: "x-terminal-emulator", args: ["-e"] });
  candidates.push({ command: "gnome-terminal", args: ["--"] });
  candidates.push({ command: "konsole", args: ["-e"] });
  candidates.push({ command: "xfce4-terminal", args: ["-e"] });
  candidates.push({ command: "alacritty", args: ["-e"] });
  candidates.push({ command: "kitty", args: ["-e"] });
  candidates.push({ command: "xterm", args: ["-e"] });

  return candidates;
}

async function launchLinuxTerminal(
  commandLine: string,
  spawnImpl: TerminalLauncherDeps["spawnImpl"],
  env: NodeJS.ProcessEnv
): Promise<{ launcher: string; attempted: string[] }> {
  const attempted: string[] = [];
  for (const candidate of linuxTerminalCandidates(env)) {
    attempted.push(candidate.command);
    try {
      await spawnDetached(
        candidate.command,
        [...candidate.args, "sh", "-lc", commandLine],
        spawnImpl
      );
      return {
        launcher: candidate.command,
        attempted
      };
    } catch {
      // keep trying
    }
  }

  throw new LaunchAttemptError(
    `No supported GUI terminal found (${attempted.join(", ")})`,
    attempted
  );
}

export async function launchReminderTerminal(options: {
  eventId: string;
  invocation: TadoiInvocation;
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  spawnImpl?: TerminalLauncherDeps["spawnImpl"];
}): Promise<TerminalLaunchResult> {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const commandLine = buildShellCommandLine(
    [
      options.invocation.command,
      ...options.invocation.baseArgs,
      "remind",
      "--event",
      options.eventId
    ],
    platform
  );

  try {
    if (platform === "darwin") {
      const result = await launchMacTerminal(commandLine, options.spawnImpl);
      return {
        ok: true,
        launcher: result.launcher,
        attempted: result.attempted
      };
    }

    if (platform === "win32") {
      const launcher = await launchWindowsTerminal(commandLine, options.spawnImpl);
      return {
        ok: true,
        launcher: launcher.launcher,
        attempted: launcher.attempted
      };
    }

    if (platform === "linux") {
      const result = await launchLinuxTerminal(commandLine, options.spawnImpl, env);
      return {
        ok: true,
        launcher: result.launcher,
        attempted: result.attempted
      };
    }

    return {
      ok: false,
      launcher: "unsupported",
      attempted: [],
      error: `Unsupported platform: ${platform}`
    };
  } catch (error: unknown) {
    return {
      ok: false,
      launcher: "none",
      attempted:
        error instanceof LaunchAttemptError
          ? error.attempted
          : platform === "linux"
            ? linuxTerminalCandidates(env).map((item) => item.command)
            : [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
