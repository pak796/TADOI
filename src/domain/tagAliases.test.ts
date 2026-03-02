import { describe, expect, it } from "bun:test";
import type { Task } from "./models";
import {
  computeTagStats,
  normalizeTagAliases,
  resolveTag,
  rewriteTagsOnTask
} from "./tagAliases";

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

describe("tagAliases", () => {
  it("normalizes and compresses aliases while dropping invalid entries", () => {
    const aliases = normalizeTagAliases({
      " Work ": "work",
      legacy: " Work ",
      a: "b",
      b: "c",
      c: "c",
      loop1: "loop2",
      loop2: "loop1"
    });

    expect(aliases).toEqual({
      a: "c",
      b: "c",
      legacy: "work"
    });
  });

  it("resolves aliases with chain support and cycle safety", () => {
    expect(resolveTag("legacy", { legacy: "work", work: "project" })).toBe("project");
    expect(resolveTag("loop1", { loop1: "loop2", loop2: "loop1" })).toBe("loop1");
  });

  it("computes tag stats and rewrite helper results", () => {
    const tasks: Task[] = [
      makeTask({ id: "1", title: "a", tags: ["Work", "project"] }),
      makeTask({ id: "2", title: "b", tags: ["work", "urgent"] }),
      makeTask({ id: "3", title: "c", tags: ["legacy"] })
    ];
    const aliases = normalizeTagAliases({ legacy: "work" });
    const stats = computeTagStats(tasks, aliases, "work");

    expect(stats.selectedCanonical).toBe("work");
    expect(stats.usageCount).toBe(3);
    expect(stats.incomingAliases).toEqual(["legacy"]);
    expect(stats.topCoTags.map((entry) => entry.tag)).toEqual(["project", "urgent"]);

    const rewritten = rewriteTagsOnTask(
      makeTask({
        id: "x",
        title: "rewrite",
        tags: ["work", "legacy", "project", "#p1", "work"]
      }),
      new Map([["work", "career"]]),
      aliases,
      500
    );

    expect(rewritten.tags).toEqual(["#p1", "career", "project"]);
    expect(rewritten.updatedAt).toBe(500);
  });
});
