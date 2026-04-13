import { describe, expect, it } from "bun:test";
import { createDefaultEngagementState } from "../domain/engagement";
import type { LoadedData } from "./persistence";
import {
  importState,
  mergeTasksByIdNewestUpdatedAt,
  recomputeTagIndex,
  redactStateForExport,
} from "./portability";
import type { PortableExportPayload } from "./portability";
import type { Task } from "../domain/models";

const DEFAULT_NOTIFICATIONS = {
  enabled: true,
  inAppOverdueBanner: true,
  terminalBellOnOverdue: false,
  bannerDurationMs: 5000,
  bellCooldownMs: 2000,
};

const BASE_LOCAL_TASK: Task = {
  id: "task-1",
  title: "Local",
  status: "open",
  createdAt: 100,
  updatedAt: 200,
  tags: ["alpha"],
};

const BASE_INCOMING_TASK: Task = {
  id: "task-1",
  title: "Incoming",
  status: "open",
  createdAt: 100,
  updatedAt: 300,
  tags: ["alpha"],
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
        updatedAt: undefined,
      } as unknown as Task,
    ];
    const incoming = [{ ...BASE_INCOMING_TASK, updatedAt: 10 }];

    const result = mergeTasksByIdNewestUpdatedAt(local, incoming);

    expect(result.merged[0]?.title).toBe("Incoming");
    expect(result.stats.conflictsResolvedByUpdatedAt).toBe(1);
  });

  it("uses createdAt tie-break and then incoming tie-break deterministically", () => {
    const localWins = mergeTasksByIdNewestUpdatedAt(
      [
        {
          ...BASE_LOCAL_TASK,
          updatedAt: 100,
          createdAt: 900,
          title: "Local wins",
        },
      ],
      [
        {
          ...BASE_INCOMING_TASK,
          updatedAt: 100,
          createdAt: 100,
          title: "Incoming loses",
        },
      ],
    );
    expect(localWins.merged[0]?.title).toBe("Local wins");

    const incomingWinsOnFinalTie = mergeTasksByIdNewestUpdatedAt(
      [
        {
          ...BASE_LOCAL_TASK,
          updatedAt: 100,
          createdAt: 500,
          title: "Local tie",
        },
      ],
      [
        {
          ...BASE_INCOMING_TASK,
          updatedAt: 100,
          createdAt: 500,
          title: "Incoming tie",
        },
      ],
    );
    expect(incomingWinsOnFinalTie.merged[0]?.title).toBe("Incoming tie");
  });

  it("preserves canonical priority tags when normalizing merged tasks", () => {
    const local = [{ ...BASE_LOCAL_TASK, tags: ["work"] }];
    const incoming = [
      {
        ...BASE_INCOMING_TASK,
        updatedAt: 999,
        tags: ["work", "P3", "#p1", "home"],
      },
    ];

    const result = mergeTasksByIdNewestUpdatedAt(local, incoming);

    expect(result.merged[0]?.tags).toEqual(["#p1", "work", "home"]);
  });

  it("treats checklist differences as task updates", () => {
    const checklistIso = new Date(2026, 1, 10, 9, 0, 0, 0).toISOString();
    const local = [
      {
        ...BASE_LOCAL_TASK,
        updatedAt: 100,
        checklist: [
          {
            id: "cl-1",
            text: "Item",
            isDone: false,
            createdAt: checklistIso,
            updatedAt: checklistIso,
            sort: 0,
          },
        ],
      },
    ];
    const incoming = [
      {
        ...BASE_INCOMING_TASK,
        updatedAt: 100,
        checklist: [
          {
            id: "cl-1",
            text: "Item",
            isDone: true,
            createdAt: checklistIso,
            updatedAt: checklistIso,
            completedAt: checklistIso,
            sort: 0,
          },
        ],
      },
    ];

    const result = mergeTasksByIdNewestUpdatedAt(local, incoming);
    expect(result.merged[0]?.checklist?.[0]?.isDone).toBe(true);
    expect(result.stats.updated).toBe(1);
    expect(result.stats.unchanged).toBe(0);
  });

  it("treats reminder differences as task updates", () => {
    const local = [
      {
        ...BASE_LOCAL_TASK,
        updatedAt: 100,
        reminder: {
          kind: "before_due" as const,
          offsetMs: 10 * 60_000,
        },
      },
    ];
    const incoming = [
      {
        ...BASE_INCOMING_TASK,
        updatedAt: 100,
        reminder: {
          kind: "before_due" as const,
          offsetMs: 5 * 60_000,
        },
      },
    ];

    const result = mergeTasksByIdNewestUpdatedAt(local, incoming);
    expect(result.merged[0]?.reminder?.offsetMs).toBe(5 * 60_000);
    expect(result.stats.updated).toBe(1);
    expect(result.stats.unchanged).toBe(0);
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
        tags: ["#Work", "alpha", "work"],
      } as unknown as Task,
      {
        id: "b",
        title: "b",
        status: "open",
        createdAt: 11,
        updatedAt: 25,
        tags: ["work", "beta"],
      },
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
    savedViews: [],
    engagement: createDefaultEngagementState(),
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
        tags: ["new"],
      },
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
        title: "remove",
      },
    ]);
    const incoming = baseState([
      { ...BASE_INCOMING_TASK, id: "keep", title: "updated" },
    ]);

    const result = importState(current, incoming, { mode: "replace" });

    expect(result.stats.tasks.removed).toBe(1);
    expect(result.nextState.tasks).toHaveLength(1);
  });

  it("merges tagAliases in merge mode with incoming source-key precedence", () => {
    const current = baseState([{ ...BASE_LOCAL_TASK }]);
    current.tagAliases = { legacy: "work", shared: "alpha" };
    const incoming = baseState([{ ...BASE_INCOMING_TASK }]);
    incoming.tagAliases = { shared: "beta", incoming: "work" };

    const result = importState(current, incoming, { mode: "merge", now: 1 });

    expect(result.nextState.tagAliases).toEqual({
      incoming: "work",
      legacy: "work",
      shared: "beta",
    });
  });

  it("replaces tagAliases in replace mode", () => {
    const current = baseState([{ ...BASE_LOCAL_TASK }]);
    current.tagAliases = { legacy: "work" };
    const incoming = baseState([{ ...BASE_INCOMING_TASK }]);
    incoming.tagAliases = { fresh: "project" };

    const result = importState(current, incoming, { mode: "replace", now: 1 });

    expect(result.nextState.tagAliases).toEqual({ fresh: "project" });
  });

  it("treats saved-view tagFilter differences as updates", () => {
    const current = baseState([{ ...BASE_LOCAL_TASK }]);
    current.savedViews = [
      {
        id: "view-1",
        name: "Today",
        createdAt: 1,
        updatedAt: 10,
        filters: {
          status: "open",
          due: "today",
          tagFilter: { all: ["work"] },
        },
      },
    ];
    const incoming = baseState([{ ...BASE_LOCAL_TASK }]);
    incoming.savedViews = [
      {
        id: "view-1",
        name: "Today",
        createdAt: 1,
        updatedAt: 10,
        filters: {
          status: "open",
          due: "today",
          tagFilter: { all: ["home"] },
        },
      },
    ];

    const result = importState(current, incoming, { mode: "merge", now: 1 });
    expect(result.stats.savedViews.updated).toBe(1);
    expect(result.nextState.savedViews[0]?.filters.tagFilter?.all).toEqual([
      "home",
    ]);
  });

  it("treats equivalent saved-view tagFilter values as unchanged", () => {
    const current = baseState([{ ...BASE_LOCAL_TASK }]);
    current.savedViews = [
      {
        id: "view-1",
        name: "Today",
        createdAt: 1,
        updatedAt: 10,
        filters: {
          status: "open",
          due: "today",
          tagFilter: { all: ["work"] },
        },
      },
    ];
    const incoming = baseState([{ ...BASE_LOCAL_TASK }]);
    incoming.savedViews = [
      {
        id: "view-1",
        name: "Today",
        createdAt: 1,
        updatedAt: 10,
        filters: {
          status: "open",
          due: "today",
          tagFilter: { all: ["work"] },
        },
      },
    ];

    const result = importState(current, incoming, { mode: "merge", now: 1 });
    expect(result.stats.savedViews.updated).toBe(0);
    expect(result.stats.savedViews.unchanged).toBe(1);
  });

  it("treats legacy priority tokens inside saved-view tagFilter as equivalent", () => {
    const current = baseState([{ ...BASE_LOCAL_TASK }]);
    current.savedViews = [
      {
        id: "view-legacy-priority-tagfilter",
        name: "Today",
        createdAt: 1,
        updatedAt: 10,
        filters: {
          status: "open",
          due: "today",
          tagFilter: { all: ["work", "#p2"] },
        },
      },
    ];
    const incoming = baseState([{ ...BASE_LOCAL_TASK }]);
    incoming.savedViews = [
      {
        id: "view-legacy-priority-tagfilter",
        name: "Today",
        createdAt: 1,
        updatedAt: 10,
        filters: {
          status: "open",
          due: "today",
          tagFilter: { all: ["work"] },
        },
      },
    ];

    const result = importState(current, incoming, { mode: "merge", now: 1 });
    expect(result.stats.savedViews.updated).toBe(0);
    expect(result.stats.savedViews.unchanged).toBe(1);
  });

  it("treats saved-view priority differences as updates", () => {
    const current = baseState([{ ...BASE_LOCAL_TASK }]);
    current.savedViews = [
      {
        id: "view-priority",
        name: "Priority",
        createdAt: 1,
        updatedAt: 10,
        filters: {
          status: "open",
          due: "today",
          priority: "#p1",
        },
      },
    ];
    const incoming = baseState([{ ...BASE_LOCAL_TASK }]);
    incoming.savedViews = [
      {
        id: "view-priority",
        name: "Priority",
        createdAt: 1,
        updatedAt: 10,
        filters: {
          status: "open",
          due: "today",
          priority: "#p2",
        },
      },
    ];

    const result = importState(current, incoming, { mode: "merge", now: 1 });
    expect(result.stats.savedViews.updated).toBe(1);
    expect(result.nextState.savedViews[0]?.filters.priority).toBe("#p2");
  });

  it("treats equivalent canonicalized saved-view priority values as unchanged", () => {
    const current = baseState([{ ...BASE_LOCAL_TASK }]);
    current.savedViews = [
      {
        id: "view-priority-eq",
        name: "Priority Eq",
        createdAt: 1,
        updatedAt: 10,
        filters: {
          status: "open",
          due: "today",
          priority: "#p2",
        },
      },
    ];
    const incoming = baseState([{ ...BASE_LOCAL_TASK }]);
    incoming.savedViews = [
      {
        id: "view-priority-eq",
        name: "Priority Eq",
        createdAt: 1,
        updatedAt: 10,
        filters: {
          status: "open",
          due: "today",
          priority: "P2",
        },
      },
    ];

    const result = importState(current, incoming, { mode: "merge", now: 1 });
    expect(result.stats.savedViews.updated).toBe(0);
    expect(result.stats.savedViews.unchanged).toBe(1);
  });

  it("merges engagement achievements by newest unlock timestamp", () => {
    const current = baseState([{ ...BASE_LOCAL_TASK }]);
    current.engagement = {
      ...createDefaultEngagementState(),
      achievements: {
        FIRST_TASK_DONE: {
          id: "FIRST_TASK_DONE",
          unlockedAt: 100,
        },
      },
    };
    const incoming = baseState([{ ...BASE_LOCAL_TASK }]);
    incoming.engagement = {
      ...createDefaultEngagementState(),
      achievements: {
        FIRST_TASK_DONE: {
          id: "FIRST_TASK_DONE",
          unlockedAt: 200,
        },
      },
    };

    const result = importState(current, incoming, { mode: "merge", now: 1 });
    expect(
      result.nextState.engagement?.achievements.FIRST_TASK_DONE?.unlockedAt,
    ).toBe(200);
  });

  it("uses incoming engagement in replace mode", () => {
    const current = baseState([{ ...BASE_LOCAL_TASK }]);
    current.engagement = createDefaultEngagementState();
    const incoming = baseState([{ ...BASE_INCOMING_TASK }]);
    incoming.engagement = {
      ...createDefaultEngagementState(),
      completionLog: [{ taskId: "incoming", at: 1234, tags: ["work"] }],
    };

    const result = importState(current, incoming, { mode: "replace", now: 1 });
    expect(result.nextState.engagement?.completionLog).toHaveLength(1);
    expect(result.nextState.engagement?.completionLog[0]?.taskId).toBe(
      "incoming",
    );
  });

  it("rebuilds streak from merged completion logs in merge mode", () => {
    const oneDayMs = 24 * 60 * 60 * 1000;
    const day1 = Date.UTC(2026, 1, 10);
    const day2 = day1 + oneDayMs;
    const current = baseState([{ ...BASE_LOCAL_TASK }]);
    current.engagement = {
      completionLog: [{ taskId: "current", at: day1, tags: ["work"] }],
      achievements: {},
      streak: {
        currentDays: 9,
        bestDays: 9,
        lastCompletionDayKey: "2026-02-10",
      },
    };
    const incoming = baseState([{ ...BASE_INCOMING_TASK }]);
    incoming.engagement = {
      completionLog: [{ taskId: "incoming", at: day2, tags: ["work"] }],
      achievements: {},
      streak: {
        currentDays: 1,
        bestDays: 1,
        lastCompletionDayKey: "2026-02-11",
      },
    };

    const result = importState(current, incoming, {
      mode: "merge",
      now: day2 + oneDayMs,
    });
    expect(result.nextState.engagement?.streak.currentDays).toBe(2);
    expect(result.nextState.engagement?.streak.bestDays).toBe(2);
    expect(result.nextState.engagement?.streak.lastCompletionDayKey).toBe(
      "2026-02-11",
    );
  });

  it("normalizes incoming engagement in replace mode (retention + tag normalization)", () => {
    const oneDayMs = 24 * 60 * 60 * 1000;
    const now = Date.UTC(2026, 1, 20);
    const oldEvent = now - 91 * oneDayMs;
    const recentEvent = now - oneDayMs;
    const current = baseState([{ ...BASE_LOCAL_TASK }]);
    const incoming = baseState([{ ...BASE_INCOMING_TASK }]);
    incoming.engagement = {
      ...createDefaultEngagementState(),
      streak: {
        currentDays: "stale-current-days" as unknown as number,
        bestDays: "stale-best-days" as unknown as number,
        lastCompletionDayKey: "not-a-day",
      },
      completionLog: [
        {
          taskId: "old",
          at: oldEvent,
          tags: [" old", "work", "work"],
        },
        {
          taskId: "recent",
          at: recentEvent,
          tags: ["work", "work", ""],
        },
      ],
    };

    const result = importState(current, incoming, { mode: "replace", now });
    const completionLog = result.nextState.engagement?.completionLog ?? [];

    expect(result.nextState.engagement?.completionLog).toHaveLength(1);
    expect(completionLog[0]?.taskId).toBe("recent");
    expect(completionLog[0]?.tags).toEqual(["work"]);
    expect(result.nextState.engagement?.streak.currentDays).toBe(1);
    expect(result.nextState.engagement?.streak.bestDays).toBe(1);
    expect(result.nextState.engagement?.streak.lastCompletionDayKey).toBe(
      "2026-02-19",
    );
  });
});

describe("redactStateForExport", () => {
  it("blanks title and notes in basic mode while preserving structure", () => {
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
          tags: ["work"],
        },
      ],
      tagIndex: {},
      savedViews: [],
      settings: {
        themeId: "default",
        logoMode: "default",
        flashMode: "slow",
        notifications: DEFAULT_NOTIFICATIONS,
        security: {
          nonHttpLinkPolicy: "prompt",
        },
      },
    };

    const redacted = redactStateForExport(payload, "basic");

    expect(redacted.tasks[0]?.title).toBe("");
    expect(redacted.tasks[0]?.notes).toBe("");
    expect(redacted.tasks[0]?.id).toBe("a");
    expect(redacted.settings?.themeId).toBe("default");
    expect(redacted.settings?.flashMode).toBe("slow");
    expect(redacted.settings?.notifications).toEqual(DEFAULT_NOTIFICATIONS);
  });

  it("strips metadata in strict mode", () => {
    const payload: PortableExportPayload = {
      schemaVersion: 4,
      tasks: [
        {
          id: "a",
          title: "secret",
          status: "open",
          createdAt: 1,
          updatedAt: 1,
          dueAt: 1700000000000,
          hasExplicitTime: true,
          notes: "private",
          tags: ["work"],
          reminder: {
            kind: "absolute",
            at: 1700000000000,
            lastFiredAt: 1699999900000,
          },
          links: [
            { id: "link-1", target: "https://example.com", source: "manual" },
          ],
          external: {
            calendar: {
              uid: "uid-1",
              lastImportedAt: "2026-02-12T00:00:00.000Z",
            },
          },
        },
      ],
      tagIndex: {},
      savedViews: [],
      settings: {
        themeId: "default",
        logoMode: "default",
        flashMode: "slow",
        notifications: DEFAULT_NOTIFICATIONS,
        security: {
          nonHttpLinkPolicy: "block",
        },
      },
    };

    const redacted = redactStateForExport(payload, "strict");
    const task = redacted.tasks[0];
    expect(task?.title).toBe("");
    expect(task?.notes).toBe("");
    expect(task?.tags).toEqual([]);
    expect(task?.links).toBeUndefined();
    expect(task?.dueAt).toBeUndefined();
    expect(task?.reminder).toBeUndefined();
    expect(task?.external).toBeUndefined();
    expect(redacted.engagement?.completionLog).toEqual([]);
    expect(redacted.settings?.notifications).toEqual(DEFAULT_NOTIFICATIONS);
    expect(redacted.settings?.security?.nonHttpLinkPolicy).toBe("prompt");
  });

  it("strips export metadata aggressively in strict-v2 mode", () => {
    const payload: PortableExportPayload = {
      schemaVersion: 4,
      tasks: [
        {
          id: "a",
          title: "secret",
          status: "open",
          createdAt: 1,
          updatedAt: 1,
          dueAt: 1700000000000,
          notes: "private",
          tags: ["work"],
          links: [
            { id: "link-1", target: "https://example.com", source: "manual" },
          ],
        },
      ],
      tagIndex: {
        work: { tagName: "work", usageCount: 1, lastUsedAt: 1 },
      },
      tagAliases: {
        wrk: "work",
      },
      savedViews: [
        {
          id: "view-1",
          name: "Work",
          createdAt: 1,
          updatedAt: 1,
          filters: { status: "open", due: "any", tag: "work" },
        },
      ],
      engagement: {
        ...createDefaultEngagementState(),
        completionLog: [{ taskId: "a", at: 1, tags: ["work"] }],
      },
      settings: {
        themeId: "default",
        logoMode: "default",
        flashMode: "slow",
        notifications: DEFAULT_NOTIFICATIONS,
        security: {
          nonHttpLinkPolicy: "block",
        },
      },
    };

    const redacted = redactStateForExport(payload, "strict-v2");
    expect(redacted.tasks[0]?.title).toBe("");
    expect(redacted.tasks[0]?.notes).toBe("");
    expect(redacted.tasks[0]?.tags).toEqual([]);
    expect(redacted.tasks[0]?.links).toBeUndefined();
    expect(redacted.tasks[0]?.dueAt).toBeUndefined();
    expect(redacted.tagIndex).toEqual({});
    expect(redacted.tagAliases).toEqual({});
    expect(redacted.savedViews).toEqual([]);
    expect(redacted.engagement?.completionLog).toEqual([]);
    expect(redacted.settings).toBeUndefined();
  });

  it("treats recurrence field changes as task updates", () => {
    const local = [
      {
        ...BASE_LOCAL_TASK,
        recurrence: {
          dtstart: "2026-02-10T09:00:00",
          rrule: "FREQ=DAILY;INTERVAL=1",
          series_id: "series:task-1",
        },
      },
    ];
    const incoming = [
      {
        ...BASE_INCOMING_TASK,
        recurrence: {
          dtstart: "2026-02-10T09:00:00",
          rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
          series_id: "series:task-1",
        },
      },
    ];

    const result = mergeTasksByIdNewestUpdatedAt(local, incoming);
    expect(result.stats.updated).toBe(1);
    expect(result.merged[0]?.recurrence?.rrule).toContain("FREQ=WEEKLY");
  });

  it("treats link field changes as task updates", () => {
    const local = [
      {
        ...BASE_LOCAL_TASK,
        links: [{ id: "link-1", target: "https://example.com" }],
      },
    ];
    const incoming = [
      {
        ...BASE_INCOMING_TASK,
        links: [{ id: "link-1", target: "https://example.com/new" }],
      },
    ];

    const result = mergeTasksByIdNewestUpdatedAt(local, incoming);
    expect(result.stats.updated).toBe(1);
    expect(result.merged[0]?.links?.[0]?.target).toBe(
      "https://example.com/new",
    );
  });
});
