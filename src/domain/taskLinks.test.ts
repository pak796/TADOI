import { describe, expect, it } from "bun:test";
import type { Task } from "./models";
import {
  addTaskLink,
  deleteTaskLink,
  inferTaskLinkKind,
  requiresExternalSchemeConfirm,
  updateTaskLink
} from "./taskLinks";

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
    links: partial.links,
    recurrence: partial.recurrence,
    instance_of: partial.instance_of
  };
}

describe("inferTaskLinkKind", () => {
  it("classifies URLs with schemes as url", () => {
    expect(inferTaskLinkKind("https://x")).toBe("url");
    expect(inferTaskLinkKind("mailto:test@x.com")).toBe("url");
  });

  it("classifies filesystem paths as path", () => {
    expect(inferTaskLinkKind("/Users/a b/file.txt")).toBe("path");
    expect(inferTaskLinkKind("C:\\A B\\file.txt")).toBe("path");
  });
});

describe("requiresExternalSchemeConfirm", () => {
  it("requires confirmation for non-allowlisted schemes", () => {
    expect(
      requiresExternalSchemeConfirm({ target: "vscode://file/path", kind: "url" })
    ).toBe(true);
  });

  it("does not require confirmation for allowlisted schemes", () => {
    expect(
      requiresExternalSchemeConfirm({ target: "https://example.com", kind: "url" })
    ).toBe(false);
  });
});

describe("task link mutations", () => {
  it("add/edit/delete preserve unrelated task fields", () => {
    const base = makeTask({
      id: "task-1",
      title: "Task",
      tags: ["work"],
      notes: "keep",
      dueAt: 1234
    });

    const withLink = addTaskLink(base, {
      id: "link-1",
      target: "https://example.com"
    });

    expect(withLink.links?.length).toBe(1);
    expect(withLink.tags).toEqual(["work"]);
    expect(withLink.notes).toBe("keep");

    const updated = updateTaskLink(withLink, "link-1", {
      label: "Docs"
    });
    expect(updated.links?.[0]?.label).toBe("Docs");
    expect(updated.dueAt).toBe(1234);

    const deleted = deleteTaskLink(updated, "link-1");
    expect(deleted.links).toEqual([]);
    expect(deleted.title).toBe("Task");
  });
});
