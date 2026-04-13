import { describe, expect, it } from "bun:test";
import { CLI_EXIT_CODE } from "./exitCodes";
import {
  mergeReminderIndexWithHelperEvents,
  runRemindersCommandWithRuntime,
  type RemindersCommandRuntime,
} from "./remindersCommands";
import {
  REMINDER_HELPER_STATE_TTL_MS,
  REMINDER_HELPER_STATE_VERSION,
  REMINDER_INDEX_VERSION,
  type ReminderHelperState,
  type ReminderIndex,
  type ReminderIndexEvent,
} from "../reminders/types";

function createEvent(
  overrides: Partial<ReminderIndexEvent> = {},
): ReminderIndexEvent {
  return {
    eventId: "event-1",
    taskId: "task-1",
    occurrenceKey: "task:task-1",
    remindAt: "2026-03-03T01:00:00.000Z",
    dueAt: "2026-03-03T01:10:00.000Z",
    title: "Reminder",
    priority: "",
    tags: [],
    ...overrides,
  };
}

function createIndex(events: ReminderIndexEvent[]): ReminderIndex {
  return {
    version: REMINDER_INDEX_VERSION,
    generatedAt: "2026-03-03T00:00:00.000Z",
    events,
  };
}

function createHelperState(
  overrides: Partial<ReminderHelperState> = {},
): ReminderHelperState {
  return {
    version: REMINDER_HELPER_STATE_VERSION,
    updatedAt: "2026-03-03T00:00:00.000Z",
    fired: {},
    ...overrides,
  };
}

function createRuntime(overrides: Partial<RemindersCommandRuntime> = {}) {
  const logs: string[] = [];
  const errors: string[] = [];
  const launchedEvents: string[] = [];
  const savedHelperStates: ReminderHelperState[] = [];
  const savedIndexes: ReminderIndex[] = [];
  const nowMs = Date.parse("2026-03-03T01:00:00.000Z");

  const runtime: RemindersCommandRuntime = {
    nowMs: () => nowMs,
    getDataFilePath: () => "/tmp/tadoi_data.json",
    loadStateStrict: async () =>
      ({
        data: {
          tasks: [],
          stateRevision: 0,
        },
      }) as any,
    writeReminderIndexForDataFile: async () => undefined,
    loadReminderIndexForDataFile: async () => createIndex([]),
    saveReminderIndexForDataFile: async (options) => {
      savedIndexes.push(options.index);
    },
    clearReminderEventFired: (state) => state,
    isReminderEventAlreadyFired: (state, eventId) =>
      typeof state.fired[eventId] === "string",
    loadReminderHelperState: async () => createHelperState(),
    markReminderEventFired: (state, eventId, firedAtIso) => ({
      ...state,
      fired: {
        ...state.fired,
        [eventId]: firedAtIso,
      },
    }),
    pruneReminderHelperState: (state) => state,
    saveReminderHelperState: async (options) => {
      savedHelperStates.push(options.state);
    },
    resolveCurrentTadoiInvocation: () => ({
      command: "tadoi",
      baseArgs: [],
    }),
    getReminderSchedulerStatus: async () => ({
      installed: true,
      enabled: true,
      details: [],
    }),
    installReminderScheduler: async () => ({
      installed: true,
      enabled: true,
      details: [],
    }),
    uninstallReminderScheduler: async () => ({
      installed: false,
      enabled: false,
      details: [],
    }),
    launchReminderTerminal: async (options) => {
      launchedEvents.push(options.eventId);
      return {
        ok: true,
        launcher: "test-launcher",
        attempted: ["test-launcher"],
      };
    },
    probeTadoiRunningState: async () => ({
      running: false,
      lockPath: "/tmp/tadoi.lock",
      reason: "no_lock",
    }),
    buildReminderIndex: () => createIndex([]),
    loadSettings: async () =>
      ({
        settings: {
          notifications: {
            outOfAppRemindersEnabled: true,
          },
        },
      }) as any,
    log: (line) => logs.push(line),
    error: (line) => errors.push(line),
    ...overrides,
  };

  return {
    runtime,
    logs,
    errors,
    launchedEvents,
    savedHelperStates,
    savedIndexes,
    nowMs,
  };
}

describe("mergeReminderIndexWithHelperEvents", () => {
  it("preserves helper-owned synthetic test events across tick rebuilds", () => {
    const rebuilt = createIndex([
      createEvent({
        eventId: "core-1",
        remindAt: "2026-03-03T02:00:00.000Z",
      }),
    ]);
    const existing = createIndex([
      createEvent({
        eventId: "test-1",
        taskId: "__test__",
        occurrenceKey: "test:2026-03-03T01:30:00.000Z",
        remindAt: "2026-03-03T01:30:00.000Z",
        title: "TADOI test reminder",
      }),
    ]);

    const merged = mergeReminderIndexWithHelperEvents({
      rebuiltIndex: rebuilt,
      existingIndex: existing,
      nowMs: Date.parse("2026-03-03T01:00:00.000Z"),
    });

    expect(merged.events.map((event) => event.eventId)).toEqual([
      "test-1",
      "core-1",
    ]);
  });

  it("drops stale helper-owned synthetic events beyond ttl window", () => {
    const nowMs = Date.parse("2026-03-10T00:00:00.000Z");
    const staleRemindAt = new Date(
      nowMs - REMINDER_HELPER_STATE_TTL_MS - 60_000,
    ).toISOString();
    const rebuilt = createIndex([]);
    const existing = createIndex([
      createEvent({
        eventId: "test-stale",
        taskId: "__test__",
        occurrenceKey: `test:${staleRemindAt}`,
        remindAt: staleRemindAt,
      }),
    ]);

    const merged = mergeReminderIndexWithHelperEvents({
      rebuiltIndex: rebuilt,
      existingIndex: existing,
      nowMs,
    });

    expect(merged.events).toHaveLength(0);
  });
});

describe("runRemindersCommandWithRuntime", () => {
  it("returns parse/validation for unknown subcommands", async () => {
    const fixture = createRuntime();

    const exitCode = await runRemindersCommandWithRuntime(
      ["wat"],
      fixture.runtime,
    );

    expect(exitCode).toBe(CLI_EXIT_CODE.PARSE_OR_VALIDATION);
    expect(fixture.errors[0]).toContain("unknown reminders command 'wat'");
  });

  it("prints usage for --help", async () => {
    const fixture = createRuntime();

    const exitCode = await runRemindersCommandWithRuntime(
      ["--help"],
      fixture.runtime,
    );

    expect(exitCode).toBe(CLI_EXIT_CODE.SUCCESS);
    expect(fixture.logs[0]).toContain("tadoi reminders install");
    expect(fixture.errors).toHaveLength(0);
  });

  it("returns io error when install fails", async () => {
    const fixture = createRuntime({
      installReminderScheduler: async () => ({
        installed: false,
        enabled: false,
        details: ["scheduler failed"],
      }),
    });

    const exitCode = await runRemindersCommandWithRuntime(
      ["install"],
      fixture.runtime,
    );

    expect(exitCode).toBe(CLI_EXIT_CODE.IO_ERROR);
    expect(fixture.logs).toContain("- scheduler failed");
  });

  it("returns status lines including next event metadata", async () => {
    const nextEvent = createEvent({
      eventId: "event-status",
      title: "Status reminder",
    });
    const fixture = createRuntime({
      loadReminderIndexForDataFile: async () => createIndex([nextEvent]),
    });

    const exitCode = await runRemindersCommandWithRuntime(
      ["status"],
      fixture.runtime,
    );

    expect(exitCode).toBe(CLI_EXIT_CODE.SUCCESS);
    expect(fixture.logs).toContain("out_of_app_setting: on");
    expect(fixture.logs).toContain("events_indexed: 1");
    expect(
      fixture.logs.some((line) =>
        line.includes(`next_event: ${nextEvent.eventId}`),
      ),
    ).toBe(true);
  });

  it("skips tick when out-of-app reminders are disabled", async () => {
    const fixture = createRuntime({
      loadSettings: async () =>
        ({
          settings: {
            notifications: {
              outOfAppRemindersEnabled: false,
            },
          },
        }) as any,
    });

    const exitCode = await runRemindersCommandWithRuntime(
      ["tick"],
      fixture.runtime,
    );

    expect(exitCode).toBe(CLI_EXIT_CODE.SUCCESS);
    expect(fixture.logs).toContain(
      "out-of-app reminders disabled in settings; tick skipped",
    );
    expect(fixture.launchedEvents).toHaveLength(0);
  });

  it("skips launching reminders while TADOI lock is active", async () => {
    const dueEvent = createEvent({
      eventId: "event-running",
      remindAt: "2026-03-03T00:59:00.000Z",
    });
    const index = createIndex([dueEvent]);
    const fixture = createRuntime({
      loadReminderIndexForDataFile: async () => index,
      buildReminderIndex: () => index,
      probeTadoiRunningState: async () => ({
        running: true,
        pid: 42,
        lockPath: "/tmp/tadoi.lock",
        reason: "active_lock",
      }),
    });

    const exitCode = await runRemindersCommandWithRuntime(
      ["tick"],
      fixture.runtime,
    );

    expect(exitCode).toBe(CLI_EXIT_CODE.SUCCESS);
    expect(fixture.launchedEvents).toHaveLength(0);
    expect(
      fixture.logs.some((line) => line.includes("tadoi is running (pid 42)")),
    ).toBe(true);
  });

  it("marks launched due reminders as fired", async () => {
    const dueEvent = createEvent({
      eventId: "event-due",
      remindAt: "2026-03-03T00:59:00.000Z",
    });
    const index = createIndex([dueEvent]);
    const fixture = createRuntime({
      loadReminderIndexForDataFile: async () => index,
      buildReminderIndex: () => index,
    });

    const exitCode = await runRemindersCommandWithRuntime(
      ["tick"],
      fixture.runtime,
    );

    expect(exitCode).toBe(CLI_EXIT_CODE.SUCCESS);
    expect(fixture.launchedEvents).toEqual(["event-due"]);
    expect(fixture.savedHelperStates).toHaveLength(1);
    expect(fixture.savedHelperStates[0]?.fired["event-due"]).toBe(
      "2026-03-03T01:00:00.000Z",
    );
  });

  it("returns io error when reminder launch fails", async () => {
    const dueEvent = createEvent({
      eventId: "event-fail",
      remindAt: "2026-03-03T00:59:00.000Z",
    });
    const index = createIndex([dueEvent]);
    const fixture = createRuntime({
      loadReminderIndexForDataFile: async () => index,
      buildReminderIndex: () => index,
      launchReminderTerminal: async () => ({
        ok: false,
        launcher: "none",
        attempted: ["test-launcher"],
        error: "spawn failed",
      }),
    });

    const exitCode = await runRemindersCommandWithRuntime(
      ["tick"],
      fixture.runtime,
    );

    expect(exitCode).toBe(CLI_EXIT_CODE.IO_ERROR);
    expect(
      fixture.errors.some((line) =>
        line.includes("launch_failed: event-fail: spawn failed"),
      ),
    ).toBe(true);
  });

  it("returns io error when subcommand throws unexpectedly", async () => {
    const fixture = createRuntime({
      loadSettings: async () => {
        throw new Error("settings read failed");
      },
    });

    const exitCode = await runRemindersCommandWithRuntime(
      ["tick"],
      fixture.runtime,
    );

    expect(exitCode).toBe(CLI_EXIT_CODE.IO_ERROR);
    expect(
      fixture.errors.some((line) =>
        line.includes("reminders command failed (settings read failed)"),
      ),
    ).toBe(true);
  });
});
