import { diffLocalDays, startOfLocalDayMs } from "./dates";
import { Task } from "./models";
import { classifyTaskDueTiming } from "./dashboard";
import { resolveAnalyticsWindowDays } from "./query";

export type DashboardKpis = {
  overdue: number;
  today: number;
  next7: number;
  open: number;
  done7d: number;
};

export function computeDashboardKpisWindowed(
  tasks: Task[],
  nowMs: number,
  analyticsWindow: "7d" | "14d" | "30d" = "7d",
): DashboardKpis {
  const startOfToday = startOfLocalDayMs(nowMs);
  const windowDays = resolveAnalyticsWindowDays(analyticsWindow);
  const result: DashboardKpis = {
    overdue: 0,
    today: 0,
    next7: 0,
    open: 0,
    done7d: 0,
  };

  for (const task of tasks) {
    if (task.status === "open") {
      result.open += 1;
      const dueTiming = classifyTaskDueTiming(task, nowMs, startOfToday);
      if (dueTiming) {
        if (dueTiming.isOverdue) {
          result.overdue += 1;
        }
        if (dueTiming.dayDiff === 0) {
          result.today += 1;
        }
        if (dueTiming.dayDiff >= 0 && dueTiming.dayDiff <= windowDays - 1) {
          result.next7 += 1;
        }
      }
      continue;
    }

    const closedAt = task.closedAt ?? task.updatedAt;
    const closedDiff = diffLocalDays(closedAt, startOfToday);
    if (closedDiff <= 0 && closedDiff >= -(windowDays - 1)) {
      result.done7d += 1;
    }
  }

  return result;
}

export function computeDashboardKpis(
  tasks: Task[],
  nowMs: number,
): DashboardKpis {
  return computeDashboardKpisWindowed(tasks, nowMs, "7d");
}
