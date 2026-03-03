import { describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import {
  getOpenTargetCommandForPlatform,
  openTarget,
  type OpenTargetSpawn
} from "./openTarget";

class MockChildProcess extends EventEmitter {
  unrefCalled = false;

  unref() {
    this.unrefCalled = true;
  }
}

describe("getOpenTargetCommandForPlatform", () => {
  it("returns macOS command args", () => {
    expect(getOpenTargetCommandForPlatform("https://example.com", "darwin")).toEqual({
      command: "open",
      args: ["https://example.com"]
    });
  });

  it("returns Linux command args", () => {
    expect(getOpenTargetCommandForPlatform("https://example.com", "linux")).toEqual({
      command: "xdg-open",
      args: ["https://example.com"]
    });
  });

  it("returns Windows command args", () => {
    expect(getOpenTargetCommandForPlatform("https://example.com", "win32")).toEqual({
      command: "explorer",
      args: ["https://example.com"]
    });
  });
});

describe("openTarget", () => {
  it("uses injected spawn implementation and resolves on spawn", async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const child = new MockChildProcess();

    const spawnImpl: OpenTargetSpawn = (command, args) => {
      calls.push({ command, args });
      queueMicrotask(() => {
        child.emit("spawn");
      });
      return child;
    };

    await openTarget("https://example.com", {
      platform: "darwin",
      spawnImpl
    });

    expect(calls).toEqual([{ command: "open", args: ["https://example.com"] }]);
    expect(child.unrefCalled).toBe(true);
  });

  it("rejects when platform is unsupported", async () => {
    await expect(
      openTarget("https://example.com", { platform: "aix" as NodeJS.Platform })
    ).rejects.toThrow("Unsupported platform");
  });

  it("rejects when spawn emits error", async () => {
    const child = new MockChildProcess();
    const spawnImpl: OpenTargetSpawn = () => {
      queueMicrotask(() => {
        child.emit("error", new Error("spawn failed"));
      });
      return child;
    };

    await expect(
      openTarget("https://example.com", { platform: "linux", spawnImpl })
    ).rejects.toThrow("spawn failed");
  });

  it("rejects targets containing control characters", async () => {
    await expect(
      openTarget("https://example.com/\nmalformed", { platform: "linux" })
    ).rejects.toThrow("Target contains control characters");
  });

  it("trims surrounding whitespace before dispatching open command", async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const child = new MockChildProcess();
    const spawnImpl: OpenTargetSpawn = (command, args) => {
      calls.push({ command, args });
      queueMicrotask(() => {
        child.emit("spawn");
      });
      return child;
    };

    await openTarget("   https://example.com/path  ", {
      platform: "linux",
      spawnImpl
    });
    expect(calls).toEqual([{ command: "xdg-open", args: ["https://example.com/path"] }]);
  });

  it("preserves spaces inside a file path target across platforms", () => {
    expect(
      getOpenTargetCommandForPlatform("/tmp/Quarterly Report.pdf", "darwin")
    ).toEqual({
      command: "open",
      args: ["/tmp/Quarterly Report.pdf"]
    });
    expect(
      getOpenTargetCommandForPlatform("C:\\Users\\me\\Project Notes.txt", "win32")
    ).toEqual({
      command: "explorer",
      args: ["C:\\Users\\me\\Project Notes.txt"]
    });
  });

  it("rejects empty targets after trimming whitespace", async () => {
    await expect(openTarget("   ", { platform: "darwin" })).rejects.toThrow(
      "Target is required"
    );
  });
});
