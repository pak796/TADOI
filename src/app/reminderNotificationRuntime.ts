import React, { useEffect, useRef, useState } from "react";
import {
  applyReminderFired,
  isReminderPendingForEffectiveAt,
  nextPendingReminderAt,
  resolveEffectiveReminderAt
} from "../domain/reminders";
import { FocusTarget, Mode, type Task } from "../domain/models";
import type { SettingsState } from "../state/settingsStore";
import { getDataFilePath } from "../state/persistence";
import { loadReminderIndexForDataFile } from "../reminders/indexer";
import { resolveCurrentTadoiInvocation } from "../reminders/invocation";
import {
  getReminderInstallCommandsForPlatform,
  getReminderSchedulerStatus
} from "../reminders/scheduler";
import { NotificationManager } from "../notifications/notificationManager";
import { InAppModalNotifier } from "../notifications/notifiers/inAppModalNotifier";
import { OSNotifier } from "../notifications/notifiers/osNotifier";
import { TerminalBellNotifier } from "../notifications/notifiers/terminalBellNotifier";
import type { TaskOverdueEvent, TaskReminderEvent } from "../notifications/types";
import {
  getTerminalBellCooldownMs,
  isInAppOverdueEnabled,
  isTerminalBellOverdueEnabled
} from "./notificationRuntime";

const NOTIFICATION_EVALUATION_INTERVAL_MS = 30_000;
const REMINDER_TIMEOUT_MAX_DELAY_MS = 0x7fffffff;
const REMINDER_TIMEOUT_FALLBACK_MS = 60_000;

type RuntimeUiState = {
  modal: {
    type?: string;
  } | null;
  notificationModalQueue: Array<TaskOverdueEvent | TaskReminderEvent>;
  mode: Mode;
  focus: FocusTarget;
};

type ReminderNotificationRuntimeDeps = {
  tasks: Task[];
  settingsState: SettingsState;
  uiState: RuntimeUiState;
  activeHelpPage: string;
  dispatch: (action: any) => void;
  uiDispatch: (action: any) => void;
};

type ReminderNotificationRuntimeState = {
  reminderHelperCommands: string[];
  outOfAppReminderHelperInstalled: boolean | null;
  outOfAppReminderNextEventLabel: string;
};

function evaluateReminderTriggers(
  tasks: Task[],
  nowMs: number
): { tasks: Task[]; events: TaskReminderEvent[] } {
  let nextTasks = tasks;
  const events: TaskReminderEvent[] = [];

  for (const task of tasks) {
    if (task.status !== "open") {
      continue;
    }
    const effectiveReminderAt = resolveEffectiveReminderAt(task);
    if (!isReminderPendingForEffectiveAt(task.reminder, effectiveReminderAt)) {
      continue;
    }
    if (effectiveReminderAt === undefined || effectiveReminderAt > nowMs) {
      continue;
    }

    const updatedTasks = applyReminderFired(nextTasks, task.id, effectiveReminderAt);
    if (updatedTasks === nextTasks) {
      continue;
    }

    nextTasks = updatedTasks;
    events.push({
      type: "TASK_REMINDER",
      taskId: task.id,
      title: task.title,
      effectiveReminderAt,
      dueAt:
        typeof task.dueAt === "number" && Number.isFinite(task.dueAt)
          ? new Date(task.dueAt).toISOString()
          : undefined,
      firedAt: new Date(nowMs).toISOString()
    });
  }

  return { tasks: nextTasks, events };
}

export function useReminderNotificationRuntime(
  deps: ReminderNotificationRuntimeDeps
): ReminderNotificationRuntimeState {
  const [reminderSchedulerTick, setReminderSchedulerTick] = useState(0);
  const [outOfAppReminderHelperInstalled, setOutOfAppReminderHelperInstalled] = useState<
    boolean | null
  >(null);
  const [outOfAppReminderNextEventLabel, setOutOfAppReminderNextEventLabel] =
    useState<string>("none");
  const reminderHelperCommands = React.useMemo(
    () => getReminderInstallCommandsForPlatform({ platform: process.platform }),
    []
  );
  const reminderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsRef = useRef(deps.settingsState);
  const tasksRef = useRef(deps.tasks);
  const notificationManagerRef = useRef<NotificationManager | null>(null);
  const modalBellNotifierRef = useRef<TerminalBellNotifier | null>(null);

  settingsRef.current = deps.settingsState;
  tasksRef.current = deps.tasks;

  if (!notificationManagerRef.current) {
    const inAppModalNotifier = new InAppModalNotifier({
      enqueueEvent: (event: TaskOverdueEvent) => {
        deps.uiDispatch({ type: "enqueueNotificationModal", event });
      },
      isEnabled: () => isInAppOverdueEnabled(settingsRef.current.notifications)
    });
    modalBellNotifierRef.current = new TerminalBellNotifier({
      isEnabled: () => isTerminalBellOverdueEnabled(settingsRef.current.notifications),
      getCooldownMs: () => getTerminalBellCooldownMs(settingsRef.current.notifications)
    });
    const osNotifier = new OSNotifier();
    notificationManagerRef.current = new NotificationManager([
      inAppModalNotifier,
      osNotifier
    ]);
  }

  useEffect(() => {
    const id = setInterval(() => {
      notificationManagerRef.current?.evaluate(tasksRef.current, Date.now());
    }, NOTIFICATION_EVALUATION_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    notificationManagerRef.current?.evaluate(tasksRef.current, Date.now());
  }, [deps.tasks]);

  useEffect(() => {
    if (reminderTimerRef.current) {
      clearTimeout(reminderTimerRef.current);
      reminderTimerRef.current = null;
    }

    const nowMs = Date.now();
    const reminderEvaluation = evaluateReminderTriggers(deps.tasks, nowMs);
    if (reminderEvaluation.tasks !== deps.tasks) {
      deps.dispatch({ type: "setTasks", tasks: reminderEvaluation.tasks });
    }
    for (const event of reminderEvaluation.events) {
      deps.uiDispatch({ type: "enqueueNotificationModal", event });
    }

    const nextReminderAt = nextPendingReminderAt(reminderEvaluation.tasks, nowMs);
    if (nextReminderAt === undefined) {
      return;
    }

    const waitMs = Math.max(0, nextReminderAt - nowMs);
    const nextDelay =
      waitMs > REMINDER_TIMEOUT_MAX_DELAY_MS ? REMINDER_TIMEOUT_FALLBACK_MS : waitMs;
    reminderTimerRef.current = setTimeout(() => {
      setReminderSchedulerTick((previous) => previous + 1);
    }, Math.max(250, nextDelay));

    return () => {
      if (reminderTimerRef.current) {
        clearTimeout(reminderTimerRef.current);
        reminderTimerRef.current = null;
      }
    };
  }, [deps.dispatch, deps.tasks, deps.uiDispatch, reminderSchedulerTick]);

  useEffect(() => {
    if (deps.activeHelpPage !== "settingsNotifications") {
      return;
    }

    let cancelled = false;
    const dataFilePath = getDataFilePath();
    const invocation = resolveCurrentTadoiInvocation();

    void (async () => {
      try {
        const schedulerStatus = await getReminderSchedulerStatus({ invocation });
        if (!cancelled) {
          setOutOfAppReminderHelperInstalled(schedulerStatus.installed);
        }
      } catch {
        if (!cancelled) {
          setOutOfAppReminderHelperInstalled(null);
        }
      }

      try {
        const index = await loadReminderIndexForDataFile({ dataFilePath });
        const nowMs = Date.now();
        const nextEvent =
          index.events.find((event) => Date.parse(event.remindAt) >= nowMs) ?? index.events[0];
        if (!cancelled) {
          if (nextEvent) {
            setOutOfAppReminderNextEventLabel(
              `${nextEvent.title} @ ${nextEvent.remindAt}`
            );
          } else {
            setOutOfAppReminderNextEventLabel("none");
          }
        }
      } catch {
        if (!cancelled) {
          setOutOfAppReminderNextEventLabel("unavailable");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    deps.activeHelpPage,
    deps.tasks.length,
    deps.settingsState.notifications.outOfAppRemindersEnabled,
    reminderSchedulerTick
  ]);

  useEffect(() => {
    if (deps.uiState.modal) return;
    if (deps.uiState.notificationModalQueue.length === 0) return;

    const nextEvent = deps.uiState.notificationModalQueue[0];
    if (
      nextEvent?.type === "TASK_OVERDUE" &&
      (!deps.settingsState.notifications.enabled ||
        !deps.settingsState.notifications.inAppOverdueBanner)
    ) {
      deps.uiDispatch({ type: "dequeueNotificationModal" });
      return;
    }
    const previousMode =
      deps.uiState.mode === Mode.MODAL_CONFIRM ? Mode.LIST : deps.uiState.mode;
    const previousFocus =
      deps.uiState.mode === Mode.MODAL_CONFIRM ? FocusTarget.TASK_LIST : deps.uiState.focus;

    deps.uiDispatch({ type: "dequeueNotificationModal" });
    if (nextEvent?.type === "TASK_OVERDUE") {
      deps.uiDispatch({
        type: "setModal",
        modal: {
          type: "overdue",
          event: nextEvent,
          previousMode,
          previousFocus
        }
      });
      modalBellNotifierRef.current?.notify(nextEvent);
    } else if (nextEvent?.type === "TASK_REMINDER") {
      deps.uiDispatch({
        type: "setModal",
        modal: {
          type: "reminder",
          event: nextEvent,
          previousMode,
          previousFocus
        }
      });
    } else {
      return;
    }
    deps.uiDispatch({ type: "setMode", mode: Mode.MODAL_CONFIRM });
    deps.uiDispatch({ type: "setFocus", focus: FocusTarget.MODAL });
  }, [
    deps.settingsState.notifications.enabled,
    deps.settingsState.notifications.inAppOverdueBanner,
    deps.uiDispatch,
    deps.uiState.focus,
    deps.uiState.modal,
    deps.uiState.mode,
    deps.uiState.notificationModalQueue
  ]);

  useEffect(() => {
    return () => {
      if (reminderTimerRef.current) {
        clearTimeout(reminderTimerRef.current);
      }
    };
  }, []);

  return {
    reminderHelperCommands,
    outOfAppReminderHelperInstalled,
    outOfAppReminderNextEventLabel
  };
}
