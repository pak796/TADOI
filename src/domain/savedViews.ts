import { Filters, SavedView } from "./models";
import { normalizeTagFilter, normalizeTagToken } from "./tagFilter";

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
  const normalizedTagFilter = normalizeTagFilter(filters.tagFilter);
  const normalizedTag = filters.tag ? normalizeTagToken(filters.tag) : undefined;

  if (normalizedTagFilter) {
    return {
      status: filters.status,
      due: filters.due,
      tagFilter: normalizedTagFilter,
      searchText: normalizeSearchText(filters.searchText)
    };
  }

  return {
    status: filters.status,
    due: filters.due,
    tag: normalizedTag,
    searchText: normalizeSearchText(filters.searchText)
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
    current.tag === target.tag &&
    areTagFiltersEqual(current.tagFilter, target.tagFilter) &&
    current.searchText === target.searchText
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
