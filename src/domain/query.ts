import { diffLocalDays, getLocalDayNumber, startOfLocalDayMs } from "./dates";
import { Filters, SortMode, Task } from "./models";
import { matchesTagFilter } from "./tagFilter";

export const SORT_MODE_ORDER: SortMode[] = ["due", "updated", "created", "title"];

export function getSortModeLabel(sortMode: SortMode): string {
  switch (sortMode) {
    case "updated":
      return "UPDATED";
    case "created":
      return "CREATED";
    case "title":
      return "TITLE";
    default:
      return "DUE";
  }
}

function compareStableFallback(a: Task, b: Task): number {
  const updatedDiff = b.updatedAt - a.updatedAt;
  if (updatedDiff !== 0) return updatedDiff;
  const createdDiff = b.createdAt - a.createdAt;
  if (createdDiff !== 0) return createdDiff;
  return a.id.localeCompare(b.id);
}

function getDueSortPriority(task: Task): number {
  const statusPriority =
    task.status === "open" ? 0 : task.status === "done" ? 2 : 4;
  const duePriority = task.dueAt !== undefined ? 0 : 1;
  return statusPriority + duePriority;
}

function compareByDue(a: Task, b: Task): number {
  const priorityDiff = getDueSortPriority(a) - getDueSortPriority(b);
  if (priorityDiff !== 0) {
    return priorityDiff;
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

  return compareStableFallback(a, b);
}

function compareByUpdated(a: Task, b: Task): number {
  const updatedDiff = b.updatedAt - a.updatedAt;
  if (updatedDiff !== 0) return updatedDiff;
  return compareStableFallback(a, b);
}

function compareByCreated(a: Task, b: Task): number {
  const createdDiff = b.createdAt - a.createdAt;
  if (createdDiff !== 0) return createdDiff;
  return compareStableFallback(a, b);
}

function compareByTitle(a: Task, b: Task): number {
  const titleDiff = a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  if (titleDiff !== 0) return titleDiff;
  return compareStableFallback(a, b);
}

export function filterTasks(tasks: Task[], filters: Filters, now: number): Task[] {
  const start = startOfLocalDayMs(now);
  const search = (filters.searchText ?? "").trim().toLowerCase();

  return tasks.filter((task) => {
    if (filters.status === "all") {
      if (task.status === "archived") return false;
    } else if (task.status !== filters.status) {
      return false;
    }

    if (!matchesTagFilter(task.tags, filters)) {
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
        // "THIS WEEK" = rolling 7-day window (today..+6), based on local days.
        return dayDiff >= 0 && dayDiff <= 6;
      }
    }

    return true;
  });
}

export function sortTasks(tasks: Task[], _now: number, sortMode: SortMode = "due"): Task[] {
  const comparator =
    sortMode === "updated"
      ? compareByUpdated
      : sortMode === "created"
        ? compareByCreated
        : sortMode === "title"
          ? compareByTitle
          : compareByDue;
  return [...tasks].sort(comparator);
}
