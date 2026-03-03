import { describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import { launchReminderTerminal, type TerminalLauncherDeps } from "./terminalLauncher";
import type { TadoiInvocation } from "./invocation";

class MockChildProcess extends EventEmitter {
  unrefCalled = false;

  unref(): void {
    this.unrefCalled = true;
  }
}

type SpawnResult = "ok" | "error";

function makeSpawnWithScript(
  outcomes: SpawnResult[],
  onSpawn?: (command: string, args: string[], index: number) => void
): TerminalLauncherDeps["spawnImpl"] {
  let index = 0;
  return (
    command: string,
    args: string[],
    _options: Parameters<NonNullable<TerminalLauncherDeps["spawnImpl"]>>[2]
  ) => {
    const child = new MockChildProcess();
    const outcome = outcomes[index] ?? "ok";
    index += 1;
    onSpawn?.(command, args, index - 1);
    queueMicrotask(() => {
      if (outcome === "error") {
        child.emit("error", new Error(`spawn failed: ${command} #${index}`));
        return;
      }
      child.emit("spawn");
      queueMicrotask(() => {
        child.emit("close", 0);
      });
    });
    return child;
  };
}

function createInvocation(): TadoiInvocation {
  return {
    command: "tadoi",
    baseArgs: []
  };
}

describe("launchReminderTerminal", () => {
  it("falls back to executable tell script when osascript primary fails", async () => {
    const calls: string[] = [];
    const spawnImpl = makeSpawnWithScript(["error", "ok"], (command, args) => {
      calls.push(`${command} ${args.join(" ")}`);
    });

    const result = await launchReminderTerminal({
      eventId: "event-fallback",
      invocation: createInvocation(),
      platform: "darwin",
      spawnImpl
    });

    expect(result.ok).toBe(true);
    expect(result.launcher).toBe("osascript fallback");
    expect(result.attempted).toEqual(["osascript primary", "osascript fallback"]);
    const fallbackScript = calls[1] ?? "";
    expect(fallbackScript).toContain("event-fallback");
  });

  it("returns failed attempt metadata when both primary and fallback mac launch paths fail", async () => {
    const result = await launchReminderTerminal({
      eventId: "event-fail",
      invocation: createInvocation(),
      platform: "darwin",
      spawnImpl: makeSpawnWithScript(["error", "error"])
    });

    expect(result.ok).toBe(false);
    expect(result.launcher).toBe("none");
    expect(result.attempted).toEqual(["osascript primary", "osascript fallback"]);
  });
});
