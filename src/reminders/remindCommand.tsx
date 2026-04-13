import React from "react";
import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard } from "@opentui/react";
import { spawn } from "node:child_process";
import { parseSeriesOccurrenceRowId } from "../domain/taskRows";
import { completeTaskWithRecurrence } from "../domain/recurrence";
import { applyReminderSnooze } from "../domain/reminders";
import {
  completeRecurringOccurrenceInTasks,
  snoozeRecurringOccurrenceInTasks,
} from "../domain/recurrence/occurrenceMutations";
import {
  getDataFilePath,
  loadStateStrict,
  saveStateAtomic,
} from "../state/persistence";
import { recomputeTagIndex } from "../state/portability";
import {
  createDefaultLockPayload,
  getTadoiLockPath,
  removeTadoiLock,
  tryAcquireTadoiLock,
} from "../state/lockfile";
import { loadReminderIndexForDataFile } from "./indexer";
import type { ReminderIndexEvent } from "./types";
import {
  OutOfAppReminderModal,
  type OutOfAppReminderActionId,
} from "../components/OutOfAppReminderModal";
import { resolveCurrentTadoiInvocation } from "./invocation";
import { CLI_EXIT_CODE } from "../cli/exitCodes";
import type { Task } from "../domain/models";
import { redactedLogger } from "../logging/redactedLogger";

type ParsedArgs = {
  eventId?: string;
};

export function parseRemindArgs(args: string[]): ParsedArgs {
  let eventId: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--event") {
      const next = args[index + 1];
      if (next && next.trim().length > 0) {
        eventId = next.trim();
      }
      index += 1;
      continue;
    }

    if (token.startsWith("--event=")) {
      const value = token.slice("--event=".length).trim();
      if (value.length > 0) {
        eventId = value;
      }
    }
  }

  return { eventId };
}

function notesSnippetFromTask(task: Task | undefined): string | undefined {
  const notes = task?.notes?.trim();
  if (!notes) return undefined;
  const compact = notes.replace(/\s+/g, " ").trim();
  if (compact.length <= 96) return compact;
  return `${compact.slice(0, 93)}...`;
}

function findTaskForReminderEvent(
  tasks: Task[],
  event: ReminderIndexEvent,
): Task | undefined {
  const series = parseSeriesOccurrenceRowId(event.occurrenceKey);
  if (series) {
    const instance = tasks.find(
      (task) =>
        task.instance_of?.series_id === series.seriesId &&
        task.instance_of?.occurrence === series.occurrenceIso,
    );
    if (instance) return instance;
    return tasks.find((task) => task.recurrence?.series_id === series.seriesId);
  }

  if (event.occurrenceKey.startsWith("task:")) {
    const taskId = event.occurrenceKey.slice("task:".length);
    return tasks.find((task) => task.id === taskId);
  }

  return tasks.find((task) => task.id === event.taskId);
}

function applyActionToTasks(
  tasks: Task[],
  event: ReminderIndexEvent,
  action: OutOfAppReminderActionId,
  nowMs: number,
): Task[] {
  const series = parseSeriesOccurrenceRowId(event.occurrenceKey);
  if (series) {
    if (action === "complete") {
      return completeRecurringOccurrenceInTasks(tasks, {
        seriesId: series.seriesId,
        occurrenceIso: series.occurrenceIso,
        nowMs,
      });
    }
    if (
      action === "snooze10m" ||
      action === "snooze1h" ||
      action === "snooze1d"
    ) {
      return snoozeRecurringOccurrenceInTasks(tasks, {
        seriesId: series.seriesId,
        occurrenceIso: series.occurrenceIso,
        nowMs,
      });
    }
    return tasks;
  }

  const taskId = event.occurrenceKey.startsWith("task:")
    ? event.occurrenceKey.slice("task:".length)
    : event.taskId;

  if (!taskId) {
    return tasks;
  }

  if (action === "complete") {
    return completeTaskWithRecurrence(tasks, taskId, nowMs).tasks;
  }

  if (action === "snooze10m") {
    return applyReminderSnooze(tasks, taskId, 10 * 60_000, nowMs);
  }
  if (action === "snooze1h") {
    return applyReminderSnooze(tasks, taskId, 60 * 60_000, nowMs);
  }
  if (action === "snooze1d") {
    return applyReminderSnooze(tasks, taskId, 24 * 60 * 60_000, nowMs);
  }

  return tasks;
}

export async function mutateReminderAction(
  event: ReminderIndexEvent,
  action: OutOfAppReminderActionId,
  dataFilePath: string,
): Promise<void> {
  const lockPath = getTadoiLockPath(dataFilePath);
  const lockPayload = createDefaultLockPayload(dataFilePath);

  const acquired = await tryAcquireTadoiLock(lockPath, lockPayload);
  if (!acquired) {
    throw new Error(
      "TADOI is running (lock present). Close TADOI before handling this reminder.",
    );
  }

  try {
    const nowMs = Date.now();
    const loaded = await loadStateStrict({ filePath: dataFilePath });
    const nextTasks = applyActionToTasks(
      loaded.data.tasks,
      event,
      action,
      nowMs,
    );

    if (nextTasks === loaded.data.tasks) {
      return;
    }

    await saveStateAtomic(
      {
        ...loaded.data,
        tasks: nextTasks,
        tagIndex: recomputeTagIndex(nextTasks, nowMs),
      },
      dataFilePath,
      undefined,
      {
        expectedStateRevision: loaded.data.stateRevision,
      },
    );
  } finally {
    await removeTadoiLock(lockPath).catch(() => undefined);
  }
}

export async function openMainTadoiApp(
  invocation: { command: string; baseArgs: string[] },
  spawnImpl: (
    command: string,
    args: readonly string[] | undefined,
    options?: Parameters<typeof spawn>[2],
  ) => ReturnType<typeof spawn> = spawn,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawnImpl(invocation.command, invocation.baseArgs, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });

    let settled = false;
    child.once("error", (error) => {
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

const ACTION_ORDER: OutOfAppReminderActionId[] = [
  "complete",
  "snooze10m",
  "snooze1h",
  "snooze1d",
  "open",
  "close",
];

export function cycleReminderAction(
  current: OutOfAppReminderActionId,
  direction: 1 | -1,
): OutOfAppReminderActionId {
  const index = ACTION_ORDER.indexOf(current);
  const safeIndex = index >= 0 ? index : 0;
  const nextIndex =
    (safeIndex + direction + ACTION_ORDER.length) % ACTION_ORDER.length;
  return ACTION_ORDER[nextIndex];
}

function ReminderModalApp(props: {
  event: ReminderIndexEvent;
  notesSnippet?: string;
  onAction: (action: OutOfAppReminderActionId) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [selectedAction, setSelectedAction] =
    React.useState<OutOfAppReminderActionId>("complete");
  const [busy, setBusy] = React.useState(false);

  const confirmAction = React.useCallback(
    async (action: OutOfAppReminderActionId) => {
      if (busy) return;
      setBusy(true);
      try {
        await props.onAction(action);
      } catch (error: unknown) {
        props.onError(error instanceof Error ? error.message : String(error));
        setBusy(false);
      }
    },
    [busy, props],
  );

  useKeyboard((key) => {
    if (key.eventType === "release") {
      return;
    }

    const keyName = (key.name ?? "").toLowerCase();
    const sequence = (key.sequence ?? "").toLowerCase();

    if (keyName === "escape") {
      void confirmAction("close");
      return;
    }

    if (
      keyName === "tab" ||
      keyName === "right" ||
      keyName === "down" ||
      sequence === "j"
    ) {
      setSelectedAction((current) => cycleReminderAction(current, 1));
      return;
    }

    if (keyName === "left" || keyName === "up" || sequence === "k") {
      setSelectedAction((current) => cycleReminderAction(current, -1));
      return;
    }

    if (keyName === "return" || keyName === "enter") {
      void confirmAction(selectedAction);
      return;
    }

    if (sequence === "1") setSelectedAction("complete");
    if (sequence === "2") setSelectedAction("snooze10m");
    if (sequence === "3") setSelectedAction("snooze1h");
    if (sequence === "4") setSelectedAction("snooze1d");
    if (sequence === "5") setSelectedAction("open");
    if (sequence === "6") setSelectedAction("close");
    if (sequence === "c") void confirmAction("complete");
    if (sequence === "o") void confirmAction("open");
  });

  return (
    <box
      style={{
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <box style={{ flexDirection: "column", gap: 1 }}>
        <OutOfAppReminderModal
          event={props.event}
          notesSnippet={props.notesSnippet}
          selectedAction={selectedAction}
          onChooseAction={(action) => {
            setSelectedAction(action);
            void confirmAction(action);
          }}
        />
        {busy ? <text>Processing action...</text> : null}
      </box>
    </box>
  );
}

export type RunRemindCommandDeps = {
  getDataFilePath: typeof getDataFilePath;
  loadReminderIndexForDataFile: typeof loadReminderIndexForDataFile;
  loadStateStrict: typeof loadStateStrict;
  resolveCurrentTadoiInvocation: typeof resolveCurrentTadoiInvocation;
  createCliRenderer: typeof createCliRenderer;
  createRoot: (renderer: Awaited<ReturnType<typeof createCliRenderer>>) => {
    render: (node: React.ReactElement) => void;
  };
  openMainTadoiApp: typeof openMainTadoiApp;
  mutateReminderAction: typeof mutateReminderAction;
  log: (line: string) => void;
  error: (line: string) => void;
};

const DEFAULT_DEPS: RunRemindCommandDeps = {
  getDataFilePath,
  loadReminderIndexForDataFile,
  loadStateStrict,
  resolveCurrentTadoiInvocation,
  createCliRenderer,
  createRoot: (renderer) => createRoot(renderer),
  openMainTadoiApp,
  mutateReminderAction,
  log: (line) => redactedLogger.log(line),
  error: (line) => redactedLogger.error(line),
};

export async function runRemindCommandWithDeps(
  args: string[],
  depsOverrides: Partial<RunRemindCommandDeps> = {},
): Promise<number> {
  const deps: RunRemindCommandDeps = {
    ...DEFAULT_DEPS,
    ...depsOverrides,
  };

  if (args.includes("--help") || args.includes("-h")) {
    deps.log("Usage:");
    deps.log("  tadoi remind --event <eventId>");
    return CLI_EXIT_CODE.SUCCESS;
  }

  const parsed = parseRemindArgs(args);
  if (!parsed.eventId) {
    deps.error("Error: remind requires --event <eventId>");
    return CLI_EXIT_CODE.PARSE_OR_VALIDATION;
  }

  const dataFilePath = deps.getDataFilePath();
  const index = await deps.loadReminderIndexForDataFile({ dataFilePath });
  const event = index.events.find((item) => item.eventId === parsed.eventId);
  if (!event) {
    deps.error(`Error: reminder event '${parsed.eventId}' not found in index`);
    return CLI_EXIT_CODE.TARGET_RESOLUTION;
  }

  const loaded = await deps.loadStateStrict({ filePath: dataFilePath });
  const task = findTaskForReminderEvent(loaded.data.tasks, event);
  const notesSnippet = notesSnippetFromTask(task);
  const invocation = deps.resolveCurrentTadoiInvocation(
    process.argv,
    process.execPath,
  );

  const renderer = await deps.createCliRenderer({
    exitOnCtrlC: true,
    useAlternateScreen: true,
    useMouse: true,
  });

  let exitCode = CLI_EXIT_CODE.SUCCESS;

  try {
    await new Promise<void>((resolve) => {
      const close = async (code = CLI_EXIT_CODE.SUCCESS) => {
        exitCode = code;
        await renderer.destroy().catch(() => undefined);
        resolve();
      };

      const reportError = (message: string) => {
        deps.error(`Reminder action failed: ${message}`);
      };

      const onAction = async (action: OutOfAppReminderActionId) => {
        if (action === "close") {
          await close(CLI_EXIT_CODE.SUCCESS);
          return;
        }
        if (action === "open") {
          await deps.openMainTadoiApp(invocation);
          await close(CLI_EXIT_CODE.SUCCESS);
          return;
        }

        await deps.mutateReminderAction(event, action, dataFilePath);
        await close(CLI_EXIT_CODE.SUCCESS);
      };

      deps
        .createRoot(renderer)
        .render(
          <ReminderModalApp
            event={event}
            notesSnippet={notesSnippet}
            onAction={onAction}
            onError={reportError}
          />,
        );
    });

    return exitCode;
  } catch (error: unknown) {
    deps.error(
      `Error: failed to run reminder modal (${error instanceof Error ? error.message : String(error)})`,
    );
    return CLI_EXIT_CODE.IO_ERROR;
  } finally {
    await renderer.destroy().catch(() => undefined);
  }
}

export async function runRemindCommand(args: string[]): Promise<number> {
  return runRemindCommandWithDeps(args);
}
