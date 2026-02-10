import { diffLocalDays, startOfLocalDayMs } from "./dates";
import { Task } from "./models";

export type DashboardKpis = {
  overdue: number;
  today: number;
  next7: number;
  open: number;
  done7d: number;
};

export function computeDashboardKpis(tasks: Task[], nowMs: number): DashboardKpis {
  const startOfToday = startOfLocalDayMs(nowMs);
  const result: DashboardKpis = {
    overdue: 0,
    today: 0,
    next7: 0,
    open: 0,
    done7d: 0
  };

  for (const task of tasks) {
    if (task.status === "open") {
      result.open += 1;
      if (task.dueAt !== undefined) {
        const dayDiff = diffLocalDays(task.dueAt, startOfToday);
        const isTimeOverdue =
          task.hasExplicitTime === true && dayDiff === 0 && nowMs > task.dueAt;

        if (dayDiff < 0 || isTimeOverdue) {
          result.overdue += 1;
        }
        if (dayDiff === 0) {
          result.today += 1;
        }
        if (dayDiff >= 0 && dayDiff <= 6) {
          result.next7 += 1;
        }
      }
      continue;
    }

    const closedAt = task.closedAt ?? task.updatedAt;
    const closedDiff = diffLocalDays(closedAt, startOfToday);
    if (closedDiff <= 0 && closedDiff >= -6) {
      result.done7d += 1;
    }
  }

  return result;
}
