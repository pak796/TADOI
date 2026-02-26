import { Filters, SavedView } from "./models";
import { normalizePriorityFilterValue } from "./priorityTags";
import { DEFAULT_ANALYTICS_WINDOW } from "./query";
import {
  normalizeTagFilter,
  normalizeTagToken,
  stripPriorityTokensFromTagFilter
} from "./tagFilter";

export const MAX_SAVED_VIEWS = 9;
export const DEFAULT_VIEW_FILTERS: Pick<Filters, "status" | "due"> = {
  status: "all",
  due: "any"
};

function normalizeViewName(name: string): string {
  return name.trim();
}

function normalizeSearchText(searchText: string | undefined): string | undefined {
  if (!searchText) return undefined;
  const trimmed = searchText.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeAnalyticsWindow(value: Filters["analyticsWindow"]): "7d" | "14d" | "30d" {
  return value === "14d" || value === "30d" ? value : DEFAULT_ANALYTICS_WINDOW;
}

function normalizeDueDayOffset(value: Filters["dueDayOffset"]): Filters["dueDayOffset"] {
  if (
    value === 1 ||
    value === 2 ||
    value === 3 ||
    value === 4 ||
    value === 5 ||
    value === 6
  ) {
    return value;
  }
  return undefined;
}

function areStringArraysEqual(left: string[] | undefined, right: string[] | undefined): boolean {
  const leftSafe = left ?? [];
  const rightSafe = right ?? [];
  if (leftSafe.length !== rightSafe.length) return false;
  for (let i = 0; i < leftSafe.length; i += 1) {
    if (leftSafe[i] !== rightSafe[i]) return false;
  }
  return true;
}

function areTagFiltersEqual(left: Filters["tagFilter"], right: Filters["tagFilter"]): boolean {
  const normalizedLeft = normalizeTagFilter(left);
  const normalizedRight = normalizeTagFilter(right);
  return (
    areStringArraysEqual(normalizedLeft?.all, normalizedRight?.all) &&
    areStringArraysEqual(normalizedLeft?.any, normalizedRight?.any) &&
    areStringArraysEqual(normalizedLeft?.none, normalizedRight?.none)
  );
}

export function snapshotFilters(filters: Filters): Filters {
  const normalizedTagFilter = stripPriorityTokensFromTagFilter(filters.tagFilter);
  const normalizedPriority =
    normalizePriorityFilterValue(filters.priority) ??
    normalizePriorityFilterValue(filters.tag);
  const normalizedTag = filters.tag ? normalizeTagToken(filters.tag) : undefined;
  const normalizedAnalyticsWindow = normalizeAnalyticsWindow(filters.analyticsWindow);
  const normalizedDueDayOffset = normalizeDueDayOffset(filters.dueDayOffset);
  const normalizedAssignee = normalizeOptionalText(filters.assignee);
  const normalizedProject = normalizeOptionalText(filters.project);
  const normalizedWorkflowStage = filters.workflowStage;

  if (normalizedTagFilter) {
    return {
      status: filters.status,
      due: filters.due,
      analyticsWindow: normalizedAnalyticsWindow,
      ...(normalizedDueDayOffset ? { dueDayOffset: normalizedDueDayOffset } : {}),
      ...(normalizedPriority ? { priority: normalizedPriority } : {}),
      tagFilter: normalizedTagFilter,
      searchText: normalizeSearchText(filters.searchText),
      ...(normalizedAssignee ? { assignee: normalizedAssignee } : {}),
      ...(normalizedProject ? { project: normalizedProject } : {}),
      ...(normalizedWorkflowStage ? { workflowStage: normalizedWorkflowStage } : {})
    };
  }

  return {
    status: filters.status,
    due: filters.due,
    analyticsWindow: normalizedAnalyticsWindow,
    ...(normalizedDueDayOffset ? { dueDayOffset: normalizedDueDayOffset } : {}),
    ...(normalizedPriority ? { priority: normalizedPriority } : {}),
    tag: normalizedTag,
    searchText: normalizeSearchText(filters.searchText),
    ...(normalizedAssignee ? { assignee: normalizedAssignee } : {}),
    ...(normalizedProject ? { project: normalizedProject } : {}),
    ...(normalizedWorkflowStage ? { workflowStage: normalizedWorkflowStage } : {})
  };
}

export function applySavedView(view: SavedView): Filters {
  return snapshotFilters(view.filters);
}

export function isSavedViewActive(currentFilters: Filters, view: SavedView): boolean {
  const current = snapshotFilters(currentFilters);
  const target = applySavedView(view);
  return (
    current.status === target.status &&
    current.due === target.due &&
    current.analyticsWindow === target.analyticsWindow &&
    current.dueDayOffset === target.dueDayOffset &&
    current.priority === target.priority &&
    current.tag === target.tag &&
    areTagFiltersEqual(current.tagFilter, target.tagFilter) &&
    current.searchText === target.searchText &&
    current.assignee === target.assignee &&
    current.project === target.project &&
    current.workflowStage === target.workflowStage
  );
}

type SaveViewResult =
  | { kind: "invalid_name" }
  | { kind: "full" }
  | { kind: "created"; savedViews: SavedView[]; view: SavedView }
  | { kind: "updated"; savedViews: SavedView[]; view: SavedView };

export function saveViewByName(
  savedViews: SavedView[],
  name: string,
  filters: Filters,
  now: number,
  maxViews = MAX_SAVED_VIEWS
): SaveViewResult {
  const normalizedName = normalizeViewName(name);
  if (normalizedName.length === 0) {
    return { kind: "invalid_name" };
  }

  const existingIndex = savedViews.findIndex(
    (view) => view.name.toLowerCase() === normalizedName.toLowerCase()
  );
  if (existingIndex >= 0) {
    const existing = savedViews[existingIndex];
    const updated: SavedView = {
      ...existing,
      name: normalizedName,
      filters: snapshotFilters(filters),
      updatedAt: now
    };
    const next = [...savedViews];
    next[existingIndex] = updated;
    return { kind: "updated", savedViews: next, view: updated };
  }

  if (savedViews.length >= maxViews) {
    return { kind: "full" };
  }

  const created: SavedView = {
    id: crypto.randomUUID(),
    name: normalizedName,
    filters: snapshotFilters(filters),
    createdAt: now,
    updatedAt: now
  };
  return { kind: "created", savedViews: [...savedViews, created], view: created };
}

export function deleteViewAtIndex(savedViews: SavedView[], index: number): SavedView[] {
  if (index < 0 || index >= savedViews.length) return savedViews;
  return savedViews.filter((_, i) => i !== index);
}
