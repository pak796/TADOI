import { createHash } from "node:crypto";
import { getDataFilePath, loadStateStrict } from "../state/persistence";
import {
  buildReminderIndex,
  loadReminderIndexForDataFile,
  saveReminderIndexForDataFile,
  writeReminderIndexForDataFile,
} from "../reminders/indexer";
import {
  clearReminderEventFired,
  isReminderEventAlreadyFired,
  loadReminderHelperState,
  markReminderEventFired,
  pruneReminderHelperState,
  saveReminderHelperState,
} from "../reminders/helperState";
import { resolveCurrentTadoiInvocation } from "../reminders/invocation";
import {
  getReminderInstallCommandsForPlatform,
  getReminderSchedulerStatus,
  installReminderScheduler,
  uninstallReminderScheduler,
} from "../reminders/scheduler";
import { launchReminderTerminal } from "../reminders/terminalLauncher";
import { probeTadoiRunningState } from "../reminders/isRunning";
import {
  REMINDER_HELPER_STATE_TTL_MS,
  type ReminderIndex,
  type ReminderIndexEvent,
} from "../reminders/types";
import { CLI_EXIT_CODE } from "./exitCodes";
import { loadSettings } from "../settings/settings";
import { redactedLogger } from "../logging/redactedLogger";

export type RemindersCommandRuntime = {
  nowMs: () => number;
  getDataFilePath: () => string;
  loadStateStrict: typeof loadStateStrict;
  writeReminderIndexForDataFile: typeof writeReminderIndexForDataFile;
  loadReminderIndexForDataFile: typeof loadReminderIndexForDataFile;
  saveReminderIndexForDataFile: typeof saveReminderIndexForDataFile;
  clearReminderEventFired: typeof clearReminderEventFired;
  isReminderEventAlreadyFired: typeof isReminderEventAlreadyFired;
  loadReminderHelperState: typeof loadReminderHelperState;
  markReminderEventFired: typeof markReminderEventFired;
  pruneReminderHelperState: typeof pruneReminderHelperState;
  saveReminderHelperState: typeof saveReminderHelperState;
  resolveCurrentTadoiInvocation: typeof resolveCurrentTadoiInvocation;
  getReminderSchedulerStatus: typeof getReminderSchedulerStatus;
  installReminderScheduler: typeof installReminderScheduler;
  uninstallReminderScheduler: typeof uninstallReminderScheduler;
  launchReminderTerminal: typeof launchReminderTerminal;
  probeTadoiRunningState: typeof probeTadoiRunningState;
  buildReminderIndex: typeof buildReminderIndex;
  loadSettings: typeof loadSettings;
  log: (line: string) => void;
  error: (line: string) => void;
};

const DEFAULT_RUNTIME: RemindersCommandRuntime = {
  nowMs: () => Date.now(),
  getDataFilePath,
  loadStateStrict,
  writeReminderIndexForDataFile,
  loadReminderIndexForDataFile,
  saveReminderIndexForDataFile,
  clearReminderEventFired,
  isReminderEventAlreadyFired,
  loadReminderHelperState,
  markReminderEventFired,
  pruneReminderHelperState,
  saveReminderHelperState,
  resolveCurrentTadoiInvocation,
  getReminderSchedulerStatus,
  installReminderScheduler,
  uninstallReminderScheduler,
  launchReminderTerminal,
  probeTadoiRunningState,
  buildReminderIndex,
  loadSettings,
  log: (line) => redactedLogger.log(line),
  error: (line) => redactedLogger.error(line),
};

function usage(): string {
  return [
    "Usage:",
    "  tadoi reminders install",
    "  tadoi reminders uninstall",
    "  tadoi reminders status",
    "  tadoi reminders test",
    "  tadoi reminders tick",
  ].join("\n");
}

function hashEventId(
  taskId: string,
  occurrenceKey: string,
  remindAtIso: string,
): string {
  return createHash("sha256")
    .update(taskId)
    .update("|")
    .update(occurrenceKey)
    .update("|")
    .update(remindAtIso)
    .digest("hex");
}

function formatReminderEventLine(event: ReminderIndexEvent): string {
  return `${event.eventId} | ${event.title} | remindAt=${event.remindAt}`;
}

function renderSchedulerStatusLines(status: {
  installed: boolean;
  enabled?: boolean;
  details: string[];
}): string[] {
  const lines = [`installed: ${status.installed ? "yes" : "no"}`];
  if (typeof status.enabled === "boolean") {
    lines.push(`enabled: ${status.enabled ? "yes" : "no"}`);
  }
  for (const detail of status.details) {
    lines.push(`- ${detail}`);
  }
  return lines;
}

async function refreshReminderIndex(
  dataFilePath: string,
  runtime: RemindersCommandRuntime,
): Promise<void> {
  const loaded = await runtime.loadStateStrict({ filePath: dataFilePath });
  await runtime.writeReminderIndexForDataFile({
    dataFilePath,
    tasks: loaded.data.tasks,
  });
}

function isHelperOwnedSyntheticEvent(event: ReminderIndexEvent): boolean {
  return event.taskId === "__test__" || event.occurrenceKey.startsWith("test:");
}

export function mergeReminderIndexWithHelperEvents(options: {
  rebuiltIndex: ReminderIndex;
  existingIndex: ReminderIndex;
  nowMs: number;
}): ReminderIndex {
  const eventById = new Map<string, ReminderIndexEvent>();
  for (const event of options.rebuiltIndex.events) {
    eventById.set(event.eventId, event);
  }

  const cutoffMs = options.nowMs - REMINDER_HELPER_STATE_TTL_MS;
  for (const event of options.existingIndex.events) {
    if (!isHelperOwnedSyntheticEvent(event)) {
      continue;
    }
    const remindAtMs = Date.parse(event.remindAt);
    if (!Number.isFinite(remindAtMs) || remindAtMs < cutoffMs) {
      continue;
    }
    if (!eventById.has(event.eventId)) {
      eventById.set(event.eventId, event);
    }
  }

  const events = Array.from(eventById.values()).sort((left, right) => {
    if (left.remindAt !== right.remindAt) {
      return left.remindAt.localeCompare(right.remindAt);
    }
    return left.eventId.localeCompare(right.eventId);
  });

  return {
    version: options.rebuiltIndex.version,
    generatedAt: options.rebuiltIndex.generatedAt,
    events,
  };
}

async function runInstallCommand(
  dataFilePath: string,
  runtime: RemindersCommandRuntime,
): Promise<number> {
  const invocation = runtime.resolveCurrentTadoiInvocation();
  const status = await runtime.installReminderScheduler({ invocation });
  const lines = renderSchedulerStatusLines(status);
  for (const line of lines) {
    runtime.log(line);
  }
  if (!status.installed) {
    return CLI_EXIT_CODE.IO_ERROR;
  }

  await refreshReminderIndex(dataFilePath, runtime).catch(() => undefined);
  return CLI_EXIT_CODE.SUCCESS;
}

async function runUninstallCommand(
  runtime: RemindersCommandRuntime,
): Promise<number> {
  const status = await runtime.uninstallReminderScheduler({});
  const lines = renderSchedulerStatusLines(status);
  for (const line of lines) {
    runtime.log(line);
  }
  return CLI_EXIT_CODE.SUCCESS;
}

async function runStatusCommand(
  dataFilePath: string,
  runtime: RemindersCommandRuntime,
): Promise<number> {
  const invocation = runtime.resolveCurrentTadoiInvocation();
  const schedulerStatus = await runtime.getReminderSchedulerStatus({
    invocation,
  });

  const settings = await runtime.loadSettings().catch(() => undefined);
  const enabledSetting =
    settings?.settings.notifications.outOfAppRemindersEnabled === true;
  const index = await runtime.loadReminderIndexForDataFile({ dataFilePath });

  runtime.log(`out_of_app_setting: ${enabledSetting ? "on" : "off"}`);
  for (const line of renderSchedulerStatusLines(schedulerStatus)) {
    runtime.log(line);
  }
  runtime.log(`events_indexed: ${String(index.events.length)}`);
  const nextEvent = index.events[0];
  if (nextEvent) {
    runtime.log(`next_event: ${formatReminderEventLine(nextEvent)}`);
  } else {
    runtime.log("next_event: none");
  }

  return CLI_EXIT_CODE.SUCCESS;
}

async function runTestCommand(
  dataFilePath: string,
  runtime: RemindersCommandRuntime,
): Promise<number> {
  const nowMs = runtime.nowMs();
  const remindAtMs = nowMs + 60_000;
  const dueAtMs = remindAtMs + 10 * 60_000;
  const remindAt = new Date(remindAtMs).toISOString();
  const dueAt = new Date(dueAtMs).toISOString();
  const occurrenceKey = `test:${remindAt}`;
  const taskId = "__test__";

  await refreshReminderIndex(dataFilePath, runtime);
  const index = await runtime.loadReminderIndexForDataFile({ dataFilePath });

  const testEvent: ReminderIndexEvent = {
    eventId: hashEventId(taskId, occurrenceKey, remindAt),
    taskId,
    occurrenceKey,
    remindAt,
    dueAt,
    title: "TADOI test reminder",
    priority: "",
    tags: ["test"],
  };

  const filtered = index.events.filter(
    (event) => !event.occurrenceKey.startsWith("test:"),
  );
  const nextIndex = {
    version: index.version,
    generatedAt: new Date(nowMs).toISOString(),
    events: [...filtered, testEvent].sort((left, right) =>
      left.remindAt.localeCompare(right.remindAt),
    ),
  };

  await runtime.saveReminderIndexForDataFile({
    dataFilePath,
    index: nextIndex,
  });

  const state = await runtime.loadReminderHelperState({ dataFilePath, nowMs });
  const nextState = runtime.clearReminderEventFired(
    state,
    testEvent.eventId,
    nowMs,
  );
  await runtime.saveReminderHelperState({
    dataFilePath,
    state: nextState,
    nowMs,
  });

  runtime.log(`scheduled_test_event: ${testEvent.eventId}`);
  runtime.log(`remind_at: ${testEvent.remindAt}`);
  return CLI_EXIT_CODE.SUCCESS;
}

async function runTickCommand(
  dataFilePath: string,
  runtime: RemindersCommandRuntime,
): Promise<number> {
  const settings = await runtime.loadSettings();
  const outOfAppEnabled =
    settings.settings.notifications.outOfAppRemindersEnabled === true;

  if (!outOfAppEnabled) {
    runtime.log("out-of-app reminders disabled in settings; tick skipped");
    return CLI_EXIT_CODE.SUCCESS;
  }

  const nowMs = runtime.nowMs();
  const previousIndex = await runtime.loadReminderIndexForDataFile({
    dataFilePath,
    nowMs,
  });
  const loaded = await runtime.loadStateStrict({ filePath: dataFilePath });
  const rebuiltIndex = runtime.buildReminderIndex(loaded.data.tasks, nowMs);
  const index = mergeReminderIndexWithHelperEvents({
    rebuiltIndex,
    existingIndex: previousIndex,
    nowMs,
  });
  await runtime.saveReminderIndexForDataFile({ dataFilePath, index });

  const runningProbe = await runtime.probeTadoiRunningState({
    dataFilePath,
    nowMs,
  });
  if (runningProbe.running) {
    runtime.log(
      `tadoi is running (pid ${String(runningProbe.pid ?? "unknown")}); reminder popups skipped`,
    );
    return CLI_EXIT_CODE.SUCCESS;
  }

  let helperState = runtime.pruneReminderHelperState(
    await runtime.loadReminderHelperState({ dataFilePath, nowMs }),
    nowMs,
  );

  const dueEvents = index.events.filter(
    (event) =>
      Date.parse(event.remindAt) <= nowMs &&
      !runtime.isReminderEventAlreadyFired(helperState, event.eventId),
  );

  if (dueEvents.length === 0) {
    await runtime.saveReminderHelperState({
      dataFilePath,
      state: helperState,
      nowMs,
    });
    runtime.log("no due reminder events");
    return CLI_EXIT_CODE.SUCCESS;
  }

  const invocation = runtime.resolveCurrentTadoiInvocation();
  const launchFailures: string[] = [];

  for (const event of dueEvents) {
    const launch = await runtime.launchReminderTerminal({
      eventId: event.eventId,
      invocation,
    });

    if (launch.ok) {
      helperState = runtime.markReminderEventFired(
        helperState,
        event.eventId,
        new Date(nowMs).toISOString(),
        nowMs,
      );
      runtime.log(`launched reminder: ${formatReminderEventLine(event)}`);
      continue;
    }

    launchFailures.push(
      `${event.eventId}: ${launch.error ?? "unknown launch error"}`,
    );
  }

  await runtime.saveReminderHelperState({
    dataFilePath,
    state: helperState,
    nowMs,
  });

  if (launchFailures.length > 0) {
    for (const line of launchFailures) {
      runtime.error(`launch_failed: ${line}`);
    }
    return CLI_EXIT_CODE.IO_ERROR;
  }

  return CLI_EXIT_CODE.SUCCESS;
}

export async function runRemindersCommandWithRuntime(
  args: string[],
  runtimeOverrides: Partial<RemindersCommandRuntime> = {},
): Promise<number> {
  const runtime: RemindersCommandRuntime = {
    ...DEFAULT_RUNTIME,
    ...runtimeOverrides,
  };
  const subcommand = args[0];
  const dataFilePath = runtime.getDataFilePath();

  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    runtime.log(usage());
    return CLI_EXIT_CODE.SUCCESS;
  }

  try {
    if (subcommand === "install") {
      return await runInstallCommand(dataFilePath, runtime);
    }
    if (subcommand === "uninstall") {
      return await runUninstallCommand(runtime);
    }
    if (subcommand === "status") {
      return await runStatusCommand(dataFilePath, runtime);
    }
    if (subcommand === "test") {
      return await runTestCommand(dataFilePath, runtime);
    }
    if (subcommand === "tick") {
      return await runTickCommand(dataFilePath, runtime);
    }

    runtime.error(`Error: unknown reminders command '${subcommand}'.`);
    runtime.error(usage());
    return CLI_EXIT_CODE.PARSE_OR_VALIDATION;
  } catch (error: unknown) {
    runtime.error(
      `Error: reminders command failed (${error instanceof Error ? error.message : String(error)})`,
    );
    return CLI_EXIT_CODE.IO_ERROR;
  }
}

export async function runRemindersCommand(args: string[]): Promise<number> {
  return runRemindersCommandWithRuntime(args);
}

export function getReminderSettingsHelpLines(
  platform = process.platform,
): string[] {
  const [install, statusCheck] = getReminderInstallCommandsForPlatform({
    platform,
  });
  return [
    `Install helper: ${install}`,
    `Check helper: ${statusCheck}`,
    "Test reminder: tadoi reminders test",
    "Uninstall helper: tadoi reminders uninstall",
  ];
}
