import { diffLocalDays, startOfLocalDayMs } from "./dates";
import { Task } from "./models";

export function isTaskOverdue(task: Task, now: number): boolean {
  if (task.status !== "open" || task.dueAt === undefined) return false;
  const today = startOfLocalDayMs(now);
  const dayDiff = diffLocalDays(task.dueAt, today);
  const timeOverdue =
    task.hasExplicitTime === true && dayDiff === 0 && now > task.dueAt;
  return dayDiff < 0 || timeOverdue;
}

export function isTaskDueToday(task: Task, now: number): boolean {
  if (task.status !== "open" || task.dueAt === undefined) return false;
  const today = startOfLocalDayMs(now);
  return diffLocalDays(task.dueAt, today) === 0;
}

export function findNextMatchingIndex<T>(
  items: T[],
  currentIndex: number,
  direction: 1 | -1,
  predicate: (item: T, index: number) => boolean,
  wrap = true
): number | null {
  if (items.length === 0) return null;

  for (let step = 1; step <= items.length; step += 1) {
    const raw = currentIndex + step * direction;
    if (!wrap && (raw < 0 || raw >= items.length)) {
      break;
    }
    const candidate = wrap
      ? ((raw % items.length) + items.length) % items.length
      : raw;
    if (predicate(items[candidate], candidate)) {
      return candidate;
    }
  }

  return null;
}
