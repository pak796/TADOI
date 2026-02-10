import { Filters, SavedView } from "./models";

export const MAX_SAVED_VIEWS = 9;

function normalizeViewName(name: string): string {
  return name.trim();
}

function normalizeSearchText(searchText: string | undefined): string | undefined {
  if (!searchText) return undefined;
  const trimmed = searchText.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function snapshotFilters(filters: Filters): Filters {
  return {
    status: filters.status,
    due: filters.due,
    tag: filters.tag,
    searchText: normalizeSearchText(filters.searchText)
  };
}

export function applySavedView(view: SavedView): Filters {
  return snapshotFilters(view.filters);
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
