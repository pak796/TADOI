import { describe, expect, it } from "bun:test";
import type { Task } from "./models";
import {
  planTagCleanup,
  planTagMerge,
  planTagRename,
  reportTagHygiene
} from "./tagLifecycle";

function makeTask(partial: Partial<Task> & Pick<Task, "id" | "title">): Task {
  return {
    id: partial.id,
    title: partial.title,
    status: partial.status ?? "open",
    createdAt: partial.createdAt ?? 1,
    updatedAt: partial.updatedAt ?? 1,
    dueAt: partial.dueAt,
    hasExplicitTime: partial.hasExplicitTime,
    tags: partial.tags ?? []
  };
}

describe("tag lifecycle", () => {
  it("plans rename with hard rewrite + alias updates", () => {
    const tasks: Task[] = [
      makeTask({ id: "1", title: "a", tags: ["work", "home"] }),
      makeTask({ id: "2", title: "b", tags: ["legacy", "work"] })
    ];
    const preview = planTagRename({
      tasks,
      aliases: { legacy: "work" },
      oldTag: "work",
      newTag: "project",
      now: 500
    });

    expect(preview.tasksAffected).toBe(2);
    expect(preview.nextTasks[0]?.tags).toEqual(["project", "home"]);
    expect(preview.nextTasks[1]?.tags).toEqual(["project"]);
    expect(preview.nextAliases).toEqual({
      legacy: "project",
      work: "project"
    });
  });

  it("plans merge with stable dedupe and source aliases", () => {
    const tasks: Task[] = [
      makeTask({ id: "1", title: "a", tags: ["a", "b", "x"] }),
      makeTask({ id: "2", title: "b", tags: ["b"] })
    ];
    const preview = planTagMerge({
      tasks,
      aliases: {},
      sources: ["a", "b"],
      target: "c",
      now: 500
    });

    expect(preview.tasksAffected).toBe(2);
    expect(preview.nextTasks[0]?.tags).toEqual(["c", "x"]);
    expect(preview.nextTasks[1]?.tags).toEqual(["c"]);
    expect(preview.nextAliases).toEqual({ a: "c", b: "c" });
  });

  it("reports hygiene collisions/chains/cycles", () => {
    const tasks: Task[] = [
      makeTask({ id: "1", title: "a", tags: ["Work", "work"] })
    ];
    const report = reportTagHygiene({
      tasks,
      aliases: { a: "b", b: "c", x: "y", y: "x" }
    });

    expect(report.normalizationCollisions.length).toBeGreaterThan(0);
    expect(report.aliasChains.length).toBeGreaterThan(0);
    expect(report.cycles.length).toBeGreaterThan(0);
  });

  it("plans cleanup removing aliases that are neither used nor required targets", () => {
    const tasks: Task[] = [makeTask({ id: "1", title: "a", tags: ["legacy"] })];
    const preview = planTagCleanup({
      tasks,
      aliases: { legacy: "work", dangling: "ghost", ghost: "work" }
    });

    expect(preview.aliasesRemoved).toEqual(["dangling", "ghost"]);
    expect(preview.nextAliases).toEqual({ legacy: "work" });
    expect(preview.nextTasks).toEqual(tasks);
  });
});
