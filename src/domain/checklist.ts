import type { ChecklistItem } from "./models";

const ASCII_CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/;

export const CHECKLIST_MAX_ITEMS = 100;

export type ChecklistMutationResult = {
  ok: true;
  checklist: ChecklistItem[];
} | {
  ok: false;
  error: string;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeIsoTimestamp(
  value: unknown,
  fallbackIso: string
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallbackIso;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return fallbackIso;
  }
  return new Date(parsed).toISOString();
}

export function normalizeChecklistText(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (ASCII_CONTROL_CHARS_RE.test(trimmed)) return null;
  return trimmed;
}

export function sortChecklistItems(items: ChecklistItem[]): ChecklistItem[] {
  return [...items].sort((left, right) => {
    if (left.sort !== right.sort) {
      return left.sort - right.sort;
    }
    if (left.createdAt !== right.createdAt) {
      return left.createdAt.localeCompare(right.createdAt);
    }
    return left.id.localeCompare(right.id);
  });
}

export function normalizeChecklist(
  rawChecklist: unknown,
  nowIso = new Date().toISOString()
): ChecklistItem[] {
  if (!Array.isArray(rawChecklist)) return [];

  const normalized: ChecklistItem[] = [];
  for (let index = 0; index < rawChecklist.length; index += 1) {
    const raw = rawChecklist[index];
    if (typeof raw !== "object" || raw === null) continue;
    const record = raw as Record<string, unknown>;
    const text = normalizeChecklistText(String(record.text ?? ""));
    if (!text) continue;

    const createdAt = normalizeIsoTimestamp(record.createdAt, nowIso);
    const updatedAt = normalizeIsoTimestamp(record.updatedAt, createdAt);
    const isDone = record.isDone === true;
    const completedAt = isDone
      ? normalizeIsoTimestamp(record.completedAt, updatedAt)
      : undefined;

    normalized.push({
      id:
        typeof record.id === "string" && record.id.trim().length > 0
          ? record.id.trim()
          : crypto.randomUUID(),
      text,
      isDone,
      createdAt,
      updatedAt,
      ...(completedAt ? { completedAt } : {}),
      sort: isFiniteNumber(record.sort) ? Math.max(0, Math.floor(record.sort)) : index
    });

    if (normalized.length >= CHECKLIST_MAX_ITEMS) {
      break;
    }
  }

  return sortChecklistItems(normalized);
}

export function getChecklistProgress(checklist: ChecklistItem[] | undefined): {
  done: number;
  total: number;
} {
  const total = checklist?.length ?? 0;
  if (total === 0) {
    return { done: 0, total: 0 };
  }
  let done = 0;
  for (const item of checklist ?? []) {
    if (item.isDone) done += 1;
  }
  return { done, total };
}

export function checklistItemAtDisplayIndex(
  checklist: ChecklistItem[] | undefined,
  index: number
): ChecklistItem | null {
  if (!Number.isInteger(index) || index < 1) {
    return null;
  }
  const sorted = sortChecklistItems(checklist ?? []);
  return sorted[index - 1] ?? null;
}

function resequenceChecklistSort(checklist: ChecklistItem[]): ChecklistItem[] {
  return checklist.map((item, index) => ({
    ...item,
    sort: index
  }));
}

export function addChecklistItem(
  checklist: ChecklistItem[] | undefined,
  text: string,
  nowIso = new Date().toISOString()
): ChecklistMutationResult {
  const normalizedText = normalizeChecklistText(text);
  if (!normalizedText) {
    return { ok: false, error: "Error: checklist item text is required" };
  }
  const sorted = sortChecklistItems(checklist ?? []);
  if (sorted.length >= CHECKLIST_MAX_ITEMS) {
    return {
      ok: false,
      error: `Error: checklist supports at most ${String(CHECKLIST_MAX_ITEMS)} items`
    };
  }
  const next = resequenceChecklistSort([
    ...sorted,
    {
      id: crypto.randomUUID(),
      text: normalizedText,
      isDone: false,
      createdAt: nowIso,
      updatedAt: nowIso,
      sort: sorted.length
    }
  ]);
  return { ok: true, checklist: next };
}

export function editChecklistItem(
  checklist: ChecklistItem[] | undefined,
  itemId: string,
  text: string,
  nowIso = new Date().toISOString()
): ChecklistMutationResult {
  const normalizedText = normalizeChecklistText(text);
  if (!normalizedText) {
    return { ok: false, error: "Error: checklist item text is required" };
  }
  const sorted = sortChecklistItems(checklist ?? []);
  let matched = false;
  const next = sorted.map((item) => {
    if (item.id !== itemId) return item;
    matched = true;
    return {
      ...item,
      text: normalizedText,
      updatedAt: nowIso
    };
  });
  if (!matched) {
    return { ok: false, error: "Error: checklist item not found" };
  }
  return { ok: true, checklist: resequenceChecklistSort(next) };
}

export function deleteChecklistItem(
  checklist: ChecklistItem[] | undefined,
  itemId: string
): ChecklistMutationResult {
  const sorted = sortChecklistItems(checklist ?? []);
  const next = sorted.filter((item) => item.id !== itemId);
  if (next.length === sorted.length) {
    return { ok: false, error: "Error: checklist item not found" };
  }
  return { ok: true, checklist: resequenceChecklistSort(next) };
}

export function clearChecklist(): ChecklistMutationResult {
  return { ok: true, checklist: [] };
}

export function toggleChecklistItem(
  checklist: ChecklistItem[] | undefined,
  itemId: string,
  nowIso = new Date().toISOString()
): ChecklistMutationResult {
  const sorted = sortChecklistItems(checklist ?? []);
  let matched = false;
  const next = sorted.map((item) => {
    if (item.id !== itemId) return item;
    matched = true;
    const isDone = !item.isDone;
    return {
      ...item,
      isDone,
      updatedAt: nowIso,
      completedAt: isDone ? nowIso : undefined
    };
  });
  if (!matched) {
    return { ok: false, error: "Error: checklist item not found" };
  }
  return { ok: true, checklist: resequenceChecklistSort(next) };
}

export function reconcileOverrideChecklistWithSeries(
  overrideChecklist: ChecklistItem[] | undefined,
  seriesChecklist: ChecklistItem[] | undefined,
  nowIso = new Date().toISOString()
): ChecklistItem[] {
  const seriesSorted = sortChecklistItems(seriesChecklist ?? []);
  const overrideSorted = sortChecklistItems(overrideChecklist ?? []);
  const overrideById = new Map(overrideSorted.map((item) => [item.id, item]));
  const usedIds = new Set<string>();
  const merged: ChecklistItem[] = [];

  for (const seriesItem of seriesSorted) {
    const override = overrideById.get(seriesItem.id);
    if (override) {
      usedIds.add(seriesItem.id);
      merged.push(override);
      continue;
    }
    merged.push({
      ...seriesItem,
      isDone: false,
      updatedAt: nowIso,
      completedAt: undefined
    });
  }

  for (const item of overrideSorted) {
    if (usedIds.has(item.id)) continue;
    merged.push(item);
  }

  return resequenceChecklistSort(merged);
}
