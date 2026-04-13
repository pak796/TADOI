import { describe, expect, it } from "bun:test";
import type { Task } from "./models";
import {
  addTaskLink,
  deleteTaskLink,
  inferTaskLinkKind,
  resolveTaskLinkOpenPolicy,
  requiresExternalSchemeConfirm,
  updateTaskLink,
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
    instance_of: partial.instance_of,
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

  it("classifies host-like targets deterministically", () => {
    expect(inferTaskLinkKind("example.com")).toBe("path");
    expect(inferTaskLinkKind("localhost:3000/dashboard")).toBe("url");
  });
});

describe("requiresExternalSchemeConfirm", () => {
  it("requires confirmation for non-allowlisted schemes", () => {
    expect(
      requiresExternalSchemeConfirm({
        target: "vscode://file/path",
        kind: "url",
      }),
    ).toBe(true);
  });

  it("does not require confirmation for allowlisted schemes", () => {
    expect(
      requiresExternalSchemeConfirm({
        target: "https://example.com",
        kind: "url",
      }),
    ).toBe(false);
  });

  it("requires confirmation for file URLs and filesystem paths", () => {
    expect(
      requiresExternalSchemeConfirm({
        target: "file:///tmp/notes.txt",
        kind: "url",
      }),
    ).toBe(true);
    expect(
      requiresExternalSchemeConfirm({
        target: "/Users/a/file.txt",
        kind: "path",
      }),
    ).toBe(true);
  });

  it("requires confirmation for calendar-imported links by default", () => {
    expect(
      requiresExternalSchemeConfirm({
        target: "https://example.com",
        kind: "url",
        source: "calendar_import",
      }),
    ).toBe(true);
  });
});

describe("resolveTaskLinkOpenPolicy", () => {
  it("blocks non-http links when policy is block", () => {
    expect(
      resolveTaskLinkOpenPolicy(
        { target: "file:///tmp/a.txt", kind: "url" },
        { nonHttpLinkPolicy: "block" },
      ),
    ).toBe("block");
    expect(
      resolveTaskLinkOpenPolicy(
        { target: "/tmp/a.txt", kind: "path" },
        { nonHttpLinkPolicy: "block" },
      ),
    ).toBe("block");
  });

  it("keeps manual https links allowlisted", () => {
    expect(
      resolveTaskLinkOpenPolicy({ target: "https://example.com", kind: "url" }),
    ).toBe("allow");
  });

  it("treats file URLs and windows/UNC-style paths as risky", () => {
    expect(
      resolveTaskLinkOpenPolicy({
        target: "file:///C:/Docs/report.txt",
        kind: "url",
      }),
    ).toBe("confirm");
    expect(
      resolveTaskLinkOpenPolicy({
        target: "C:\\Users\\me\\notes.txt",
        kind: "path",
      }),
    ).toBe("confirm");
    expect(
      resolveTaskLinkOpenPolicy({
        target: "\\\\server\\share\\report.docx",
        kind: "path",
      }),
    ).toBe("confirm");
  });

  it("blocks calendar-imported risky links when policy is block", () => {
    expect(
      resolveTaskLinkOpenPolicy(
        {
          target: "vscode://repo/file",
          kind: "url",
          source: "calendar_import",
        },
        { nonHttpLinkPolicy: "block" },
      ),
    ).toBe("block");
  });

  it("keeps calendar-imported safe schemes on confirm", () => {
    expect(
      resolveTaskLinkOpenPolicy({
        target: "https://example.com",
        kind: "url",
        source: "calendar_import",
      }),
    ).toBe("confirm");
  });
});

describe("task link mutations", () => {
  it("add/edit/delete preserve unrelated task fields", () => {
    const base = makeTask({
      id: "task-1",
      title: "Task",
      tags: ["work"],
      notes: "keep",
      dueAt: 1234,
    });

    const withLink = addTaskLink(base, {
      id: "link-1",
      target: "https://example.com",
    });

    expect(withLink.links?.length).toBe(1);
    expect(withLink.tags).toEqual(["work"]);
    expect(withLink.notes).toBe("keep");

    const updated = updateTaskLink(withLink, "link-1", {
      label: "Docs",
    });
    expect(updated.links?.[0]?.label).toBe("Docs");
    expect(updated.dueAt).toBe(1234);

    const deleted = deleteTaskLink(updated, "link-1");
    expect(deleted.links).toEqual([]);
    expect(deleted.title).toBe("Task");
  });
});
