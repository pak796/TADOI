import { diffLocalDays, startOfLocalDayMs } from "./dates";
import { Task } from "./models";

export type TagStat = {
  tag: string;
  total: number;
  dueThisWeek: number;
};

export function computeTopTagStats(tasks: Task[], now: number, limit = 5): TagStat[] {
  const startOfToday = startOfLocalDayMs(now);
  const counts = new Map<string, TagStat>();

  for (const task of tasks) {
    if (task.status === "archived") continue;
    const dayDiff =
      task.dueAt !== undefined ? diffLocalDays(task.dueAt, startOfToday) : null;
    const dueThisWeek = dayDiff !== null && dayDiff >= 0 && dayDiff <= 7;

    for (const tag of task.tags) {
      const existing = counts.get(tag);
      if (existing) {
        existing.total += 1;
        if (dueThisWeek) {
          existing.dueThisWeek += 1;
        }
      } else {
        counts.set(tag, {
          tag,
          total: 1,
          dueThisWeek: dueThisWeek ? 1 : 0
        });
      }
    }
  }

  return Array.from(counts.values())
    .sort((a, b) => {
      if (a.total !== b.total) return b.total - a.total;
      if (a.dueThisWeek !== b.dueThisWeek) return b.dueThisWeek - a.dueThisWeek;
      return a.tag.localeCompare(b.tag);
    })
    .slice(0, limit);
}
