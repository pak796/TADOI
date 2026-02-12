import { describe, expect, it } from "bun:test";
import { Filters, SortMode, Task } from "./models";
import {
  buildSeriesOccurrenceRowId,
  buildVisibleTaskRows,
  parseSeriesOccurrenceRowId
} from "./taskRows";

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

function buildRows(
  tasks: Task[],
  filters: Filters,
  now: number,
  sortMode: SortMode = "due"
) {
  return buildVisibleTaskRows(tasks, filters, sortMode, now);
}

describe("taskRows row-id helpers", () => {
  it("builds and parses virtual row ids", () => {
    const rowId = buildSeriesOccurrenceRowId("series:alpha", "2026-02-10T09:00:00");
    expect(parseSeriesOccurrenceRowId(rowId)).toEqual({
      seriesId: "series:alpha",
      occurrenceIso: "2026-02-10T09:00:00"
    });
  });
});

describe("buildVisibleTaskRows recurring expansion", () => {
  const now = new Date(2026, 1, 10, 12, 0, 0, 0).getTime();

  it("due=any shows one actionable virtual occurrence (latest overdue first)", () => {
    const tasks: Task[] = [
      makeTask({
        id: "series-task",
        title: "standup",
        status: "open",
        hasExplicitTime: true,
        tags: ["work"],
        recurrence: {
          dtstart: "2026-02-08T09:00:00",
          rrule: "FREQ=DAILY;INTERVAL=1",
          series_id: "series:standup"
        }
      })
    ];

    const rows = buildRows(tasks, { status: "all", due: "any" }, now);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.rowKind).toBe("series_occurrence_virtual");
    expect(rows[0]?.seriesId).toBe("series:standup");
    expect(rows[0]?.occurrenceIso).toBe("2026-02-10T09:00:00");
  });

  it("due=overdue shows one overdue virtual occurrence per series", () => {
    const tasks: Task[] = [
      makeTask({
        id: "series-task",
        title: "standup",
        status: "open",
        hasExplicitTime: true,
        tags: ["work"],
        recurrence: {
          dtstart: "2026-02-08T09:00:00",
          rrule: "FREQ=DAILY;INTERVAL=1",
          series_id: "series:standup"
        }
      })
    ];

    const rows = buildRows(tasks, { status: "all", due: "overdue" }, now);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.rowKind).toBe("series_occurrence_virtual");
    expect(rows[0]?.occurrenceIso).toBe("2026-02-10T09:00:00");
  });

  it("due=today and due=next7 expand occurrences by local-day window", () => {
    const tasks: Task[] = [
      makeTask({
        id: "series-task",
        title: "daily",
        status: "open",
        hasExplicitTime: true,
        tags: ["work"],
        recurrence: {
          dtstart: "2026-02-10T09:00:00",
          rrule: "FREQ=DAILY;INTERVAL=1;COUNT=10",
          series_id: "series:daily"
        }
      })
    ];

    const todayRows = buildRows(tasks, { status: "all", due: "today" }, now);
    expect(todayRows).toHaveLength(1);
    expect(todayRows[0]?.occurrenceIso).toBe("2026-02-10T09:00:00");

    const next7Rows = buildRows(tasks, { status: "all", due: "next7" }, now);
    expect(next7Rows).toHaveLength(7);
    expect(next7Rows[0]?.occurrenceIso).toBe("2026-02-10T09:00:00");
    expect(next7Rows[6]?.occurrenceIso).toBe("2026-02-16T09:00:00");
  });

  it("applies tagFilter semantics to recurring virtual rows", () => {
    const tasks: Task[] = [
      makeTask({
        id: "series-task",
        title: "daily",
        status: "open",
        hasExplicitTime: true,
        tags: ["work", "urgent"],
        recurrence: {
          dtstart: "2026-02-10T09:00:00",
          rrule: "FREQ=DAILY;INTERVAL=1;COUNT=2",
          series_id: "series:daily"
        }
      })
    ];

    const allRows = buildRows(
      tasks,
      { status: "all", due: "today", tagFilter: { all: ["work"], none: ["home"] } },
      now
    );
    expect(allRows).toHaveLength(1);

    const excludedRows = buildRows(
      tasks,
      { status: "all", due: "today", tagFilter: { none: ["work"] } },
      now
    );
    expect(excludedRows).toHaveLength(0);
  });

  it("normalizes priority tags for regular rows with last-token precedence", () => {
    const tasks: Task[] = [
      makeTask({
        id: "task-priority",
        title: "priority task",
        status: "open",
        tags: ["work", "P3", "home", "#p1", "home"]
      })
    ];

    const rows = buildRows(tasks, { status: "all", due: "any" }, now);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.tags).toEqual(["#p1", "work", "home"]);
  });

  it("normalizes priority tags for virtual recurring rows", () => {
    const tasks: Task[] = [
      makeTask({
        id: "series-priority",
        title: "priority recurring",
        status: "open",
        hasExplicitTime: true,
        tags: ["work", "#P2", "home", "p10", "work"],
        recurrence: {
          dtstart: "2026-02-10T09:00:00",
          rrule: "FREQ=DAILY;INTERVAL=1;COUNT=2",
          series_id: "series:priority"
        }
      })
    ];

    const rows = buildRows(tasks, { status: "all", due: "today" }, now);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.rowKind).toBe("series_occurrence_virtual");
    expect(rows[0]?.tags).toEqual(["#p10", "work", "home"]);
  });

  it("applies priority filter to regular and virtual recurring rows", () => {
    const tasks: Task[] = [
      makeTask({
        id: "regular-priority",
        title: "regular priority",
        status: "open",
        tags: ["work", "#p2"]
      }),
      makeTask({
        id: "regular-non-priority",
        title: "regular non-priority",
        status: "open",
        tags: ["work", "#p3"]
      }),
      makeTask({
        id: "series-priority-filter",
        title: "series priority filter",
        status: "open",
        hasExplicitTime: true,
        tags: ["work", "p2"],
        recurrence: {
          dtstart: "2026-02-10T09:00:00",
          rrule: "FREQ=DAILY;INTERVAL=1;COUNT=2",
          series_id: "series:priority-filter"
        }
      })
    ];

    const rows = buildRows(tasks, { status: "all", due: "today", priority: "P2" }, now);
    expect(rows.map((row) => row.id)).toEqual([
      "series_occurrence:series%3Apriority-filter:2026-02-10T09%3A00%3A00"
    ]);

    const anyDueRows = buildRows(tasks, { status: "all", due: "any", priority: "#p2" }, now);
    expect(anyDueRows.map((row) => row.id)).toEqual([
      "series_occurrence:series%3Apriority-filter:2026-02-10T09%3A00%3A00",
      "regular-priority"
    ]);
  });

  it("suppresses virtual row when a matching materialized instance exists", () => {
    const tasks: Task[] = [
      makeTask({
        id: "series-task",
        title: "standup",
        status: "open",
        hasExplicitTime: true,
        tags: ["work"],
        recurrence: {
          dtstart: "2026-02-10T09:00:00",
          rrule: "FREQ=DAILY;INTERVAL=1;COUNT=3",
          series_id: "series:standup"
        }
      }),
      makeTask({
        id: "instance-task",
        title: "standup (snoozed)",
        status: "open",
        dueAt: new Date(2026, 1, 10, 15, 0, 0, 0).getTime(),
        hasExplicitTime: true,
        tags: ["work"],
        instance_of: {
          series_id: "series:standup",
          occurrence: "2026-02-10T09:00:00"
        }
      })
    ];

    const rows = buildRows(tasks, { status: "all", due: "today" }, now);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("instance-task");
    expect(rows[0]?.rowKind).toBe("series_occurrence_instance");
  });
});
