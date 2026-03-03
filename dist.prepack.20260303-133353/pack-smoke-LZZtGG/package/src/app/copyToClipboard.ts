import { spawn, type ChildProcess, type SpawnOptionsWithoutStdio } from "node:child_process";

type ClipboardSpawnChild = Pick<ChildProcess, "stdin" | "on" | "once">;

export type ClipboardSpawn = (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio
) => ClipboardSpawnChild;

export type CopyToClipboardOptions = {
  platform?: NodeJS.Platform;
  spawnImpl?: ClipboardSpawn;
};

function runClipboardCommand(
  command: string,
  args: string[],
  value: string,
  spawnImpl: ClipboardSpawn
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const child = spawnImpl(command, args, {
      stdio: ["pipe", "ignore", "ignore"],
      windowsHide: true
    });

    const settleReject = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    child.once("error", settleReject);

    child.once("close", (code: number | null) => {
      if (settled) return;
      settled = true;
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Clipboard command exited with code ${String(code)}`));
    });

    if (!child.stdin) {
      settleReject(new Error("Clipboard command stdin is unavailable"));
      return;
    }

    child.stdin.once("error", settleReject);
    child.stdin.end(value);
  });
}

export async function copyToClipboard(
  value: string,
  options: CopyToClipboardOptions = {}
): Promise<void> {
  const platform = options.platform ?? process.platform;
  const spawnImpl = options.spawnImpl ?? spawn;

  if (platform === "darwin") {
    await runClipboardCommand("pbcopy", [], value, spawnImpl);
    return;
  }

  if (platform === "win32") {
    await runClipboardCommand("clip", [], value, spawnImpl);
    return;
  }

  if (platform === "linux") {
    try {
      await runClipboardCommand("xclip", ["-selection", "clipboard"], value, spawnImpl);
      return;
    } catch {
      await runClipboardCommand("xsel", ["--clipboard", "--input"], value, spawnImpl);
      return;
    }
  }

  throw new Error(`Unsupported platform: ${platform}`);
}
