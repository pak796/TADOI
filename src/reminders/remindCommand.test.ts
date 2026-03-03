import { describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import { openMainTadoiApp } from "./remindCommand";
import type { TadoiInvocation } from "./invocation";

type MockSpawnCall = {
  command: string;
  args: string[];
};

class MockChildProcess extends EventEmitter {
  unrefCalled = false;

  unref(): void {
    this.unrefCalled = true;
  }
}

function makeMockSpawn(outcome: "ok" | "error"): {
  calls: MockSpawnCall[];
  spawn: (command: string, args: string[]) => MockChildProcess;
} {
  const calls: MockSpawnCall[] = [];
  return {
    calls,
    spawn: (
      command: string,
      args: string[]
    ) => {
      const child = new MockChildProcess();
      calls.push({ command, args: [...args] });
      queueMicrotask(() => {
        if (outcome === "error") {
          child.emit("error", new Error("spawn failed"));
          return;
        }
        child.emit("spawn");
        queueMicrotask(() => {
          child.emit("close", 0);
        });
      });
      return child;
    }
  };
}

describe("openMainTadoiApp", () => {
  it("launches the provided invocation command and base args", async () => {
    const invocation: TadoiInvocation = {
      command: "/usr/bin/node",
      baseArgs: ["/tmp/tadoi-cli.js", "--debug"]
    };
    const mock = makeMockSpawn("ok");

    await openMainTadoiApp(invocation, mock.spawn);

    expect(mock.calls).toEqual([
      {
        command: invocation.command,
        args: invocation.baseArgs
      }
    ]);
  });

  it("rejects when spawn fails", async () => {
    const invocation: TadoiInvocation = {
      command: "/usr/bin/node",
      baseArgs: ["/tmp/tadoi-cli.js"]
    };
    const mock = makeMockSpawn("error");

    await expect(openMainTadoiApp(invocation, mock.spawn)).rejects.toThrow("spawn failed");
  });
});
