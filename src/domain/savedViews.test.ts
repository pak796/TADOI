import { describe, expect, it } from "bun:test";
import { Filters, SavedView } from "./models";
import {
  DEFAULT_VIEW_FILTERS,
  MAX_SAVED_VIEWS,
  applySavedView,
  deleteViewAtIndex,
  isSavedViewActive,
  snapshotFilters,
  saveViewByName
} from "./savedViews";

const BASE_FILTERS: Filters = {
  status: "open",
  due: "today",
  priority: "#p2",
  tag: "work",
  searchText: " important "
};

function makeView(name: string, filters: Filters, id = crypto.randomUUID()): SavedView {
  return {
    id,
    name,
    filters,
    createdAt: 1,
    updatedAt: 1
  };
}

describe("saved views", () => {
  it("applies a saved view into active filters", () => {
    const view = makeView("Today", BASE_FILTERS);
    const applied = applySavedView(view);
    expect(applied).toEqual({
      status: "open",
      due: "today",
      analyticsWindow: "7d",
      priority: "#p2",
      tag: "work",
      searchText: "important"
    });
  });

  it("normalizes tagFilter snapshots and clears legacy tag when boolean mode is active", () => {
    const snapped = snapshotFilters({
      status: "open",
      due: "today",
      priority: "P3",
      tag: "work",
      tagFilter: {
        all: ["#Work", "home"],
        any: ["work", "work"]
      },
      searchText: "  focus  "
    });

    expect(snapped).toEqual({
      status: "open",
      due: "today",
      analyticsWindow: "7d",
      priority: "#p3",
      tagFilter: {
        all: ["home", "work"],
        any: ["work"]
      },
      searchText: "focus"
    });
  });

  it("restores boolean tagFilter precedence from saved views", () => {
    const view = makeView("Boolean", {
      status: "open",
      due: "today",
      tag: "work",
      tagFilter: { any: ["home"] }
    });

    expect(applySavedView(view)).toEqual({
      status: "open",
      due: "today",
      analyticsWindow: "7d",
      tagFilter: { any: ["home"] }
    });
  });

  it("converts legacy priority-like tag into priority filter", () => {
    const converted = snapshotFilters({
      status: "open",
      due: "today",
      tag: "#p10"
    });
    expect(converted).toEqual({
      status: "open",
      due: "today",
      analyticsWindow: "7d",
      priority: "#p10"
    });

    const explicitPriorityWins = snapshotFilters({
      status: "open",
      due: "today",
      priority: "#p2",
      tag: "#p10"
    });
    expect(explicitPriorityWins).toEqual({
      status: "open",
      due: "today",
      analyticsWindow: "7d",
      priority: "#p2"
    });
  });

  it("strips priority tokens from boolean tagFilter buckets on snapshot", () => {
    const snapped = snapshotFilters({
      status: "open",
      due: "today",
      tagFilter: {
        all: ["work", "p2"],
        any: ["#p1", "home"],
        none: ["#p10"]
      }
    });
    expect(snapped).toEqual({
      status: "open",
      due: "today",
      analyticsWindow: "7d",
      tagFilter: {
        all: ["work"],
        any: ["home"]
      }
    });
  });

  it("round-trips analyticsWindow and exact due-day offsets", () => {
    const view = makeView("Windowed", {
      status: "open",
      due: "any",
      analyticsWindow: "30d",
      dueDayOffset: 4
    });

    expect(applySavedView(view)).toEqual({
      status: "open",
      due: "any",
      analyticsWindow: "30d",
      dueDayOffset: 4
    });
  });

  it("creates and deduplicates by name (case-insensitive)", () => {
    const created = saveViewByName([], "Today", BASE_FILTERS, 10);
    expect(created.kind).toBe("created");
    if (created.kind !== "created") return;
    expect(created.savedViews).toHaveLength(1);

    const updated = saveViewByName(
      created.savedViews,
      "today",
      { status: "done", due: "any" },
      20
    );
    expect(updated.kind).toBe("updated");
    if (updated.kind !== "updated") return;
    expect(updated.savedViews).toHaveLength(1);
    expect(updated.savedViews[0].name).toBe("today");
    expect(updated.savedViews[0].filters.status).toBe("done");
    expect(updated.savedViews[0].updatedAt).toBe(20);
  });

  it("enforces max view limit and rejects empty names", () => {
    let views: SavedView[] = [];
    for (let i = 0; i < MAX_SAVED_VIEWS; i += 1) {
      const result = saveViewByName(views, `View ${i}`, BASE_FILTERS, i);
      if (result.kind === "created" || result.kind === "updated") {
        views = result.savedViews;
      }
    }
    const full = saveViewByName(views, "Extra", BASE_FILTERS, 99);
    expect(full.kind).toBe("full");

    const invalid = saveViewByName(views, "   ", BASE_FILTERS, 99);
    expect(invalid.kind).toBe("invalid_name");
  });

  it("deletes a view by index", () => {
    const views = [
      makeView("One", BASE_FILTERS),
      makeView("Two", { status: "done", due: "any" }),
      makeView("Three", { status: "all", due: "next7" })
    ];
    const after = deleteViewAtIndex(views, 1);
    expect(after).toHaveLength(2);
    expect(after.map((view) => view.name)).toEqual(["One", "Three"]);
    expect(deleteViewAtIndex(views, -1)).toEqual(views);
    expect(deleteViewAtIndex(views, 99)).toEqual(views);
  });

  it("detects when a saved view is currently active", () => {
    const view = makeView("Today", BASE_FILTERS);
    expect(
      isSavedViewActive(
        {
          status: "open",
          due: "today",
          analyticsWindow: "7d",
          priority: "#p2",
          tag: "work",
          searchText: "important"
        },
        view
      )
    ).toBe(true);
    expect(
      isSavedViewActive(
        {
          status: "open",
          due: "today",
          analyticsWindow: "7d",
          priority: "#p2",
          tag: "work",
          searchText: "different"
        },
        view
      )
    ).toBe(false);
    expect(
      isSavedViewActive(
        {
          status: "open",
          due: "today",
          analyticsWindow: "7d",
          priority: "#p3",
          tag: "work",
          searchText: "important"
        },
        view
      )
    ).toBe(false);
  });

  it("exposes default view filters", () => {
    expect(DEFAULT_VIEW_FILTERS).toEqual({ status: "all", due: "any" });
  });
});
