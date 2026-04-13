import type { Task } from "./models";

type TitleHistoryEntry = {
  title: string;
  usageCount: number;
  lastUsedAt: number;
};

function normalizeTitleForMatch(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function getTitleQuery(titleText: string): string | null {
  if (/\s$/.test(titleText)) return null;
  const trimmedLeading = titleText.trimStart();
  return trimmedLeading.length > 0 ? trimmedLeading : null;
}

export function rankTaskTitles(
  tasks: Array<Pick<Task, "title" | "createdAt" | "updatedAt">>,
  query: string,
): string[] {
  const normalizedQuery = normalizeTitleForMatch(query);
  if (!normalizedQuery) return [];

  const entries = new Map<string, TitleHistoryEntry>();
  for (const task of tasks) {
    const normalizedTitle = normalizeTitleForMatch(task.title);
    if (!normalizedTitle || !normalizedTitle.startsWith(normalizedQuery))
      continue;

    const title = task.title.trim();
    const lastUsedAt = Math.max(task.updatedAt, task.createdAt);
    const existing = entries.get(normalizedTitle);
    if (!existing) {
      entries.set(normalizedTitle, {
        title,
        usageCount: 1,
        lastUsedAt,
      });
      continue;
    }
    if (lastUsedAt >= existing.lastUsedAt) {
      existing.title = title;
    }
    existing.usageCount += 1;
    existing.lastUsedAt = Math.max(existing.lastUsedAt, lastUsedAt);
  }

  return Array.from(entries.values())
    .sort((left, right) => {
      if (left.usageCount !== right.usageCount) {
        return right.usageCount - left.usageCount;
      }
      if (left.lastUsedAt !== right.lastUsedAt) {
        return right.lastUsedAt - left.lastUsedAt;
      }
      return left.title.localeCompare(right.title);
    })
    .map((entry) => entry.title);
}

export function getTitleCompletion(
  query: string,
  titles: string[],
): { full: string; remainder: string } | null {
  const normalizedQuery = normalizeTitleForMatch(query);
  if (!normalizedQuery) return null;

  const trimmedQuery = query.trim();
  const match = titles.find((title) =>
    title.trim().toLocaleLowerCase().startsWith(normalizedQuery),
  );
  if (!match) return null;

  const trimmedMatch = match.trim();
  const remainder = trimmedMatch.slice(trimmedQuery.length);
  if (!remainder) return null;

  return { full: trimmedMatch, remainder };
}
