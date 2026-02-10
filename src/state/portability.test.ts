import { describe, expect, it } from "bun:test";
import type { LoadedData } from "./persistence";
import {
  importState,
  mergeTasksByIdNewestUpdatedAt,
  recomputeTagIndex,
  redactStateForExport
} from "./portability";
import type { PortableExportPayload } from "./portability";
import type { Task } from "../domain/models";

const BASE_LOCAL_TASK: Task = {
  id: "task-1",
  title: "Local",
  status: "open",
  createdAt: 100,
  updatedAt: 200,
  tags: ["alpha"]
};

const BASE_INCOMING_TASK: Task = {
  id: "task-1",
  title: "Incoming",
  status: "open",
  createdAt: 100,
  updatedAt: 300,
  tags: ["alpha"]
};

describe("mergeTasksByIdNewestUpdatedAt", () => {
  it("keeps local when local.updatedAt is newer", () => {
    const local = [{ ...BASE_LOCAL_TASK, updatedAt: 500 }];
    const incoming = [{ ...BASE_INCOMING_TASK, updatedAt: 300 }];

    const result = mergeTasksByIdNewestUpdatedAt(local, incoming);

    expect(result.merged[0]?.title).toBe("Local");
    expect(result.stats.updated).toBe(0);
    expect(result.stats.unchanged).toBe(1);
    expect(result.stats.conflictsResolvedByUpdatedAt).toBe(1);
  });

  it("takes incoming when incoming.updatedAt is newer", () => {
    const local = [{ ...BASE_LOCAL_TASK, updatedAt: 100 }];
    const incoming = [{ ...BASE_INCOMING_TASK, updatedAt: 900 }];

    const result = mergeTasksByIdNewestUpdatedAt(local, incoming);

    expect(result.merged[0]?.title).toBe("Incoming");
    expect(result.stats.updated).toBe(1);
    expect(result.stats.conflictsResolvedByUpdatedAt).toBe(1);
  });

  it("treats missing updatedAt as 0", () => {
    const local = [
      {
        ...BASE_LOCAL_TASK,
        updatedAt: undefined
      } as unknown as Task
    ];
    const incoming = [{ ...BASE_INCOMING_TASK, updatedAt: 10 }];

    const result = mergeTasksByIdNewestUpdatedAt(local, incoming);

    expect(result.merged[0]?.title).toBe("Incoming");
    expect(result.stats.conflictsResolvedByUpdatedAt).toBe(1);
  });

  it("uses createdAt tie-break and then incoming tie-break deterministically", () => {
    const localWins = mergeTasksByIdNewestUpdatedAt(
      [{ ...BASE_LOCAL_TASK, updatedAt: 100, createdAt: 900, title: "Local wins" }],
      [{ ...BASE_INCOMING_TASK, updatedAt: 100, createdAt: 100, title: "Incoming loses" }]
    );
    expect(localWins.merged[0]?.title).toBe("Local wins");

    const incomingWinsOnFinalTie = mergeTasksByIdNewestUpdatedAt(
      [{ ...BASE_LOCAL_TASK, updatedAt: 100, createdAt: 500, title: "Local tie" }],
      [{ ...BASE_INCOMING_TASK, updatedAt: 100, createdAt: 500, title: "Incoming tie" }]
    );
    expect(incomingWinsOnFinalTie.merged[0]?.title).toBe("Incoming tie");
  });
});

describe("recomputeTagIndex", () => {
  it("recomputes deterministic normalized tag index from tasks", () => {
    const tasks: Task[] = [
      {
        id: "a",
        title: "a",
        status: "open",
        createdAt: 10,
        updatedAt: 20,
        tags: ["#Work", "alpha", "work"]
      } as unknown as Task,
      {
        id: "b",
        title: "b",
        status: "open",
        createdAt: 11,
        updatedAt: 25,
        tags: ["work", "beta"]
      }
    ];

    const tagIndex = recomputeTagIndex(tasks, 999);

    expect(Object.keys(tagIndex)).toEqual(["alpha", "beta", "work"]);
    expect(tagIndex.work?.usageCount).toBe(2);
    expect(tagIndex.work?.lastUsedAt).toBe(25);
    expect(tagIndex.alpha?.usageCount).toBe(1);
  });
});

describe("importState", () => {
  const baseState = (tasks: Task[]): LoadedData => ({
    schemaVersion: 4,
    tasks,
    tagIndex: {},
    savedViews: []
  });

  it("produces merge stats and recomputes tagIndex", () => {
    const current = baseState([{ ...BASE_LOCAL_TASK, tags: ["local"] }]);
    const incoming = baseState([
      { ...BASE_INCOMING_TASK, updatedAt: 999, tags: ["incoming"] },
      {
        id: "task-2",
        title: "new",
        status: "open",
        createdAt: 1,
        updatedAt: 2,
        tags: ["new"]
      }
    ]);

    const result = importState(current, incoming, { mode: "merge", now: 1 });

    expect(result.nextState.tasks).toHaveLength(2);
    expect(result.stats.tasks.added).toBe(1);
    expect(result.stats.tasks.updated).toBe(1);
    expect(result.stats.tasks.removed).toBe(0);
    expect(result.nextState.tagIndex.incoming).toBeDefined();
    expect(result.nextState.tagIndex.new).toBeDefined();
  });

  it("tracks removed tasks in replace mode", () => {
    const current = baseState([
      { ...BASE_LOCAL_TASK, id: "keep" },
      {
        ...BASE_LOCAL_TASK,
        id: "remove",
        title: "remove"
      }
    ]);
    const incoming = baseState([{ ...BASE_INCOMING_TASK, id: "keep", title: "updated" }]);

    const result = importState(current, incoming, { mode: "replace" });

    expect(result.stats.tasks.removed).toBe(1);
    expect(result.nextState.tasks).toHaveLength(1);
  });
});

describe("redactStateForExport", () => {
  it("blanks title and notes while preserving structure", () => {
    const payload: PortableExportPayload = {
      schemaVersion: 4,
      tasks: [
        {
          id: "a",
          title: "secret",
          status: "open",
          createdAt: 1,
          updatedAt: 1,
          notes: "private",
          tags: ["work"]
        }
      ],
      tagIndex: {},
      savedViews: [],
      settings: { themeId: "default", flashMode: "slow" }
    };

    const redacted = redactStateForExport(payload);

    expect(redacted.tasks[0]?.title).toBe("");
    expect(redacted.tasks[0]?.notes).toBe("");
    expect(redacted.tasks[0]?.id).toBe("a");
    expect(redacted.settings?.themeId).toBe("default");
    expect(redacted.settings?.flashMode).toBe("slow");
  });

  it("treats recurrence field changes as task updates", () => {
    const local = [
      {
        ...BASE_LOCAL_TASK,
        recurrence: {
          dtstart: "2026-02-10T09:00:00",
          rrule: "FREQ=DAILY;INTERVAL=1",
          series_id: "series:task-1"
        }
      }
    ];
    const incoming = [
      {
        ...BASE_INCOMING_TASK,
        recurrence: {
          dtstart: "2026-02-10T09:00:00",
          rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
          series_id: "series:task-1"
        }
      }
    ];

    const result = mergeTasksByIdNewestUpdatedAt(local, incoming);
    expect(result.stats.updated).toBe(1);
    expect(result.merged[0]?.recurrence?.rrule).toContain("FREQ=WEEKLY");
  });
});
