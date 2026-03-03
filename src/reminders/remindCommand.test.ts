import { afterEach, describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import os from "node:os";
import path from "node:path";
import { CLI_EXIT_CODE } from "../cli/exitCodes";
import {
  cycleReminderAction,
  openMainTadoiApp,
  parseRemindArgs,
  runRemindCommand
} from "./remindCommand";
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

const previousDataPath = process.env.TADOI_DATA_PATH;

afterEach(() => {
  if (previousDataPath === undefined) {
    delete process.env.TADOI_DATA_PATH;
    return;
  }
  process.env.TADOI_DATA_PATH = previousDataPath;
});

describe("parseRemindArgs", () => {
  it("parses --event and --event=<id> forms", () => {
    expect(parseRemindArgs(["--event", "event-a"])).toEqual({
      eventId: "event-a"
    });
    expect(parseRemindArgs(["--event=event-b"])).toEqual({
      eventId: "event-b"
    });
  });

  it("returns undefined when event id is missing", () => {
    expect(parseRemindArgs(["--event"])).toEqual({
      eventId: undefined
    });
    expect(parseRemindArgs(["--event="])).toEqual({
      eventId: undefined
    });
  });
});

describe("cycleReminderAction", () => {
  it("cycles forward and wraps around action list", () => {
    expect(cycleReminderAction("complete", 1)).toBe("snooze10m");
    expect(cycleReminderAction("close", 1)).toBe("complete");
  });

  it("cycles backward and wraps around action list", () => {
    expect(cycleReminderAction("complete", -1)).toBe("close");
    expect(cycleReminderAction("snooze1h", -1)).toBe("snooze10m");
  });
});

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

describe("runRemindCommand", () => {
  it("returns usage success for --help", async () => {
    const exitCode = await runRemindCommand(["--help"]);
    expect(exitCode).toBe(CLI_EXIT_CODE.SUCCESS);
  });

  it("returns parse/validation when event id is omitted", async () => {
    const exitCode = await runRemindCommand([]);
    expect(exitCode).toBe(CLI_EXIT_CODE.PARSE_OR_VALIDATION);
  });

  it("returns target-resolution when event is not present in reminder index", async () => {
    process.env.TADOI_DATA_PATH = path.join(
      os.tmpdir(),
      `tadoi-remind-missing-${Date.now()}.json`
    );
    const exitCode = await runRemindCommand(["--event", "missing-event"]);
    expect(exitCode).toBe(CLI_EXIT_CODE.TARGET_RESOLUTION);
  });
});
