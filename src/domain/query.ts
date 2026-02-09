import { diffLocalDays, getLocalDayNumber, startOfLocalDayMs } from "./dates";
import { Filters, Task } from "./models";

export function filterTasks(tasks: Task[], filters: Filters, now: number): Task[] {
  const start = startOfLocalDayMs(now);
  const search = (filters.searchText ?? "").trim().toLowerCase();

  return tasks.filter((task) => {
    if (filters.status === "all") {
      if (task.status === "archived") return false;
    } else if (task.status !== filters.status) {
      return false;
    }

    if (filters.tag && !task.tags.includes(filters.tag)) {
      return false;
    }

    const matchesTitle = task.title.toLowerCase().includes(search);
    const matchesTags = task.tags.some((tag) => tag.toLowerCase().includes(search));
    if (search && !(matchesTitle || matchesTags)) {
      return false;
    }

    if (filters.due !== "any") {
      if (task.status === "archived") return false;
      if (!task.dueAt) return false;
      const dayDiff = diffLocalDays(task.dueAt, start);
      const timeOverdue =
        task.hasExplicitTime === true && dayDiff === 0 && now > task.dueAt;
      if (filters.due === "overdue") {
        return dayDiff < 0 || timeOverdue;
      }
      if (filters.due === "today") {
        return dayDiff === 0;
      }
      if (filters.due === "next7") {
        // "THIS WEEK" = rolling next 7 days including today, based on local days.
        return dayDiff >= 0 && dayDiff <= 7;
      }
    }

    return true;
  });
}

export function sortTasks(tasks: Task[], now: number): Task[] {
  const start = startOfLocalDayMs(now);

  return [...tasks].sort((a, b) => {
    const statusRankA = a.status === "open" ? 0 : 1;
    const statusRankB = b.status === "open" ? 0 : 1;
    if (statusRankA !== statusRankB) {
      return statusRankA - statusRankB;
    }

    const dueDayA =
      a.dueAt !== undefined ? getLocalDayNumber(a.dueAt) : Number.MAX_SAFE_INTEGER;
    const dueDayB =
      b.dueAt !== undefined ? getLocalDayNumber(b.dueAt) : Number.MAX_SAFE_INTEGER;
    if (dueDayA !== dueDayB) {
      return dueDayA - dueDayB;
    }

    if (a.dueAt !== undefined && b.dueAt !== undefined) {
      const aHasTime = a.hasExplicitTime === true;
      const bHasTime = b.hasExplicitTime === true;
      if (aHasTime !== bHasTime) {
        return aHasTime ? -1 : 1;
      }
      if (aHasTime && bHasTime && a.dueAt !== b.dueAt) {
        return a.dueAt - b.dueAt;
      }
    }

    if (a.dueAt && a.dueAt < start && b.dueAt && b.dueAt < start) {
      return a.dueAt - b.dueAt;
    }

    const updatedDiff = b.updatedAt - a.updatedAt;
    if (updatedDiff !== 0) return updatedDiff;
    return a.id.localeCompare(b.id);
  });
}
