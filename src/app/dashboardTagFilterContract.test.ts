import { describe, expect, it } from "bun:test";
import { addLocalDaysMs, startOfLocalDayMs } from "../domain/dates";
import { computeTopTagsOpen } from "../domain/dashboard";
import { computeDashboardKpis } from "../domain/dashboardKpis";
import { type Filters, FocusTarget, Mode, type Task } from "../domain/models";
import { filterTasks } from "../domain/query";
import { buildVisibleTaskRows } from "../domain/taskRows";
import { initialUIState } from "../ui/state";
import { handleKey, type KeyInput, type KeyRouterContext } from "./keyRouter";

function makeTask(partial: Partial<Task> & Pick<Task, "id" | "title">): Task {
  return {
    id: partial.id,
    title: partial.title,
    status: partial.status ?? "open",
    createdAt: partial.createdAt ?? 1,
    updatedAt: partial.updatedAt ?? 1,
    dueAt: partial.dueAt,
    hasExplicitTime: partial.hasExplicitTime,
    closedAt: partial.closedAt,
    notes: partial.notes,
    tags: partial.tags ?? [],
    recurrence: partial.recurrence,
    instance_of: partial.instance_of
  };
}

function run(
  key: Partial<KeyInput>,
  contextOverrides: Partial<KeyRouterContext> = {}
) {
  const input: KeyInput = {
    name: "",
    sequence: "",
    ctrl: false,
    shift: false,
    ...key
  };
  const context: KeyRouterContext = {
    uiState: initialUIState,
    hasTagInlineSuggestion: false,
    hasDueSuggestion: false,
    timeAutocompleteStep: "none",
    hasPendingGPrefix: false,
    viewsOverlayOpen: false,
    saveViewPromptOpen: false,
    backupScreen: null,
    ...contextOverrides
  };
  return handleKey(input, context);
}

describe("dashboard/tag-filter canonical invariant contract", () => {
  it("DTF-001: non-empty boolean tagFilter overrides legacy tag", () => {
    const now = new Date(2026, 1, 13, 12, 0, 0, 0).getTime();
    const tasks: Task[] = [
      makeTask({ id: "work", title: "work", tags: ["work"] }),
      makeTask({ id: "home", title: "home", tags: ["home"] })
    ];
    const filters: Filters = {
      status: "all",
      due: "any",
      tag: "work",
      tagFilter: { any: ["home"] }
    };
    expect(filterTasks(tasks, filters, now).map((task) => task.id)).toEqual(["home"]);
  });

  it("DTF-002: empty boolean buckets are a no-op and fall back to legacy tag", () => {
    const now = new Date(2026, 1, 13, 12, 0, 0, 0).getTime();
    const tasks: Task[] = [
      makeTask({ id: "work", title: "work", tags: ["work"] }),
      makeTask({ id: "home", title: "home", tags: ["home"] })
    ];
    const filters: Filters = {
      status: "all",
      due: "any",
      tag: "work",
      tagFilter: { all: [], any: [], none: [] }
    };
    expect(filterTasks(tasks, filters, now).map((task) => task.id)).toEqual(["work"]);
  });

  it("DTF-003: next7 window uses local-day [today..+6] boundaries", () => {
    const now = new Date(2026, 1, 13, 12, 0, 0, 0).getTime();
    const start = startOfLocalDayMs(now);
    const tasks: Task[] = [
      makeTask({ id: "t0", title: "today", dueAt: start }),
      makeTask({ id: "t6", title: "plus6", dueAt: addLocalDaysMs(start, 6) }),
      makeTask({ id: "t7", title: "plus7", dueAt: addLocalDaysMs(start, 7) })
    ];
    const result = filterTasks(tasks, { status: "all", due: "next7" }, now).map(
      (task) => task.id
    );
    expect(result).toEqual(["t0", "t6"]);
  });

  it("DTF-004: overdue includes past day and passed explicit-time tasks", () => {
    const now = new Date(2026, 1, 13, 12, 0, 0, 0).getTime();
    const start = startOfLocalDayMs(now);
    const tasks: Task[] = [
      makeTask({ id: "yesterday", title: "yesterday", dueAt: addLocalDaysMs(start, -1) }),
      makeTask({
        id: "today-past-time",
        title: "today-past-time",
        dueAt: new Date(2026, 1, 13, 9, 0, 0, 0).getTime(),
        hasExplicitTime: true
      }),
      makeTask({
        id: "today-future-time",
        title: "today-future-time",
        dueAt: new Date(2026, 1, 13, 13, 0, 0, 0).getTime(),
        hasExplicitTime: true
      })
    ];
    const result = filterTasks(tasks, { status: "all", due: "overdue" }, now).map(
      (task) => task.id
    );
    expect(result).toEqual(["yesterday", "today-past-time"]);
  });

  it("DTF-005: dashboard mode routes top-tag keys and blocks list movement leakage", () => {
    const dashboardState = {
      ...initialUIState,
      mode: Mode.DASHBOARD,
      focus: FocusTarget.DASHBOARD
    };
    expect(run({ name: "j", sequence: "j" }, { uiState: dashboardState })).toEqual([]);
    expect(run({ name: "up" }, { uiState: dashboardState })).toEqual([
      { scope: "ui", type: "MOVE_DASHBOARD_TAG_SELECTION", delta: -1 }
    ]);
    expect(run({ name: "down" }, { uiState: dashboardState })).toEqual([
      { scope: "ui", type: "MOVE_DASHBOARD_TAG_SELECTION", delta: 1 }
    ]);
    expect(run({ name: "enter" }, { uiState: dashboardState })).toEqual([
      { scope: "domain", type: "APPLY_DASHBOARD_SELECTED_TAG" }
    ]);
  });

  it("DTF-006: tag-filter modal blocks list/dashboard routing until unwound", () => {
    const panelState = {
      ...initialUIState,
      mode: Mode.TAG_FILTER,
      focus: FocusTarget.TAG_FILTER_INPUT
    };
    expect(run({ name: "down" }, { uiState: panelState })).toEqual([]);
    expect(run({ name: "enter" }, { uiState: panelState })).toEqual([]);
    expect(run({ name: "j", sequence: "j" }, { uiState: panelState })).toEqual([]);
    expect(run({ name: "escape" }, { uiState: panelState })).toEqual([
      { scope: "ui", type: "UNWIND" }
    ]);
  });

  it("DTF-007: dashboard analytics include recurrence via visible-row selector parity", () => {
    const now = new Date(2026, 1, 13, 12, 0, 0, 0).getTime();
    const tasks: Task[] = [
      makeTask({
        id: "series-1",
        title: "daily standup",
        status: "open",
        hasExplicitTime: true,
        tags: ["work"],
        recurrence: {
          dtstart: "2026-02-13T09:00:00",
          rrule: "FREQ=DAILY;INTERVAL=1;COUNT=3",
          series_id: "series:standup"
        }
      })
    ];
    const filters: Filters = { status: "all", due: "today" };
    const visibleRows = buildVisibleTaskRows(tasks, filters, "due", now);

    expect(visibleRows).toHaveLength(1);
    expect(visibleRows[0]?.rowKind).toBe("series_occurrence_virtual");
    expect(visibleRows[0]?.sourceTaskId).toBe("series-1");

    const kpis = computeDashboardKpis(visibleRows, now);
    expect(kpis.today).toBe(1);
    expect(kpis.open).toBe(1);

    const topTags = computeTopTagsOpen(visibleRows, 5);
    expect(topTags).toEqual([{ tag: "work", count: 1 }]);
  });
});
