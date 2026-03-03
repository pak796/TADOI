import { afterEach, describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import os from "node:os";
import path from "node:path";
import { CLI_EXIT_CODE } from "../cli/exitCodes";
import {
  cycleReminderAction,
  openMainTadoiApp,
  parseRemindArgs,
  runRemindCommand,
  runRemindCommandWithDeps,
  type RunRemindCommandDeps
} from "./remindCommand";
import type { TadoiInvocation } from "./invocation";
import type { ReminderIndexEvent } from "./types";

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

function createReminderEvent(overrides: Partial<ReminderIndexEvent> = {}): ReminderIndexEvent {
  return {
    eventId: "event-1",
    taskId: "task-1",
    occurrenceKey: "task:task-1",
    remindAt: "2026-03-03T01:00:00.000Z",
    dueAt: "2026-03-03T01:10:00.000Z",
    title: "Reminder",
    priority: "",
    tags: [],
    ...overrides
  };
}

function createRunRemindHarness(options: {
  actions: Array<"complete" | "open" | "close">;
  mutateError?: Error;
}) {
  const logs: string[] = [];
  const errors: string[] = [];
  const openInvocations: Array<{ command: string; baseArgs: string[] }> = [];
  const mutateCalls: Array<{ eventId: string; action: string; dataFilePath: string }> = [];
  const event = createReminderEvent();
  let rootRenderCount = 0;
  let rendererDestroyCount = 0;

  const deps: Partial<RunRemindCommandDeps> = {
    getDataFilePath: () => "/tmp/tadoi_data.json",
    loadReminderIndexForDataFile: async () => ({
      version: 1,
      generatedAt: "2026-03-03T00:00:00.000Z",
      events: [event]
    }),
    loadStateStrict: async () =>
      ({
        data: {
          tasks: [
            {
              id: "task-1",
              title: "Reminder task",
              notes: "",
              status: "open",
              tags: []
            }
          ],
          stateRevision: 0
        }
      }) as any,
    resolveCurrentTadoiInvocation: () => ({
      command: "tadoi",
      baseArgs: ["--dev"]
    }),
    createCliRenderer: async () =>
      ({
        destroy: async () => {
          rendererDestroyCount += 1;
        }
      }) as any,
    createRoot: () => ({
      render: (node: any) => {
        rootRenderCount += 1;
        void (async () => {
          for (const action of options.actions) {
            try {
              await node.props.onAction(action);
            } catch (error: unknown) {
              node.props.onError(error instanceof Error ? error.message : String(error));
            }
          }
        })();
      }
    }),
    openMainTadoiApp: async (invocation) => {
      openInvocations.push(invocation);
    },
    mutateReminderAction: async (currentEvent, action, dataFilePath) => {
      mutateCalls.push({
        eventId: currentEvent.eventId,
        action,
        dataFilePath
      });
      if (options.mutateError) {
        throw options.mutateError;
      }
    },
    log: (line) => logs.push(line),
    error: (line) => errors.push(line)
  };

  return {
    deps,
    logs,
    errors,
    openInvocations,
    mutateCalls,
    getRootRenderCount: () => rootRenderCount,
    getRendererDestroyCount: () => rendererDestroyCount
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

  it("drives complete action through injected renderer/root harness", async () => {
    const harness = createRunRemindHarness({
      actions: ["complete"]
    });

    const exitCode = await runRemindCommandWithDeps(["--event", "event-1"], harness.deps);

    expect(exitCode).toBe(CLI_EXIT_CODE.SUCCESS);
    expect(harness.getRootRenderCount()).toBe(1);
    expect(harness.mutateCalls).toEqual([
      {
        eventId: "event-1",
        action: "complete",
        dataFilePath: "/tmp/tadoi_data.json"
      }
    ]);
    expect(harness.openInvocations).toHaveLength(0);
    expect(harness.getRendererDestroyCount()).toBeGreaterThan(0);
  });

  it("drives open action through injected renderer/root harness", async () => {
    const harness = createRunRemindHarness({
      actions: ["open"]
    });

    const exitCode = await runRemindCommandWithDeps(["--event", "event-1"], harness.deps);

    expect(exitCode).toBe(CLI_EXIT_CODE.SUCCESS);
    expect(harness.getRootRenderCount()).toBe(1);
    expect(harness.mutateCalls).toHaveLength(0);
    expect(harness.openInvocations).toEqual([
      {
        command: "tadoi",
        baseArgs: ["--dev"]
      }
    ]);
  });

  it("drives close action through injected renderer/root harness", async () => {
    const harness = createRunRemindHarness({
      actions: ["close"]
    });

    const exitCode = await runRemindCommandWithDeps(["--event", "event-1"], harness.deps);

    expect(exitCode).toBe(CLI_EXIT_CODE.SUCCESS);
    expect(harness.getRootRenderCount()).toBe(1);
    expect(harness.mutateCalls).toHaveLength(0);
    expect(harness.openInvocations).toHaveLength(0);
  });

  it("reports action error and exits when subsequent close action succeeds", async () => {
    const harness = createRunRemindHarness({
      actions: ["complete", "close"],
      mutateError: new Error("write failed")
    });

    const exitCode = await runRemindCommandWithDeps(["--event", "event-1"], harness.deps);

    expect(exitCode).toBe(CLI_EXIT_CODE.SUCCESS);
    expect(harness.mutateCalls).toHaveLength(1);
    expect(
      harness.errors.some((line) => line.includes("Reminder action failed: write failed"))
    ).toBe(true);
  });
});
