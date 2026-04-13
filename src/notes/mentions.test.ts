import { describe, expect, it } from "bun:test";
import { findUnlinkedMentions } from "./mentions";
import type { ParsedNote } from "./types";

function makeParsed(path: string, content: string): ParsedNote {
  return {
    note: {
      path,
      filename: path,
      title: path,
      tags: [],
      aliases: [],
      mtimeMs: 0,
    },
    content,
    outgoingNoteRefs: [],
    outgoingTaskRefs: [],
    rawTitle: path,
    titleKey: path,
    hash: "x",
    warnings: [],
  };
}

describe("findUnlinkedMentions", () => {
  it("finds plain mentions and skips code fences", () => {
    const notes = new Map<string, ParsedNote>([
      ["A.md", makeParsed("A.md", "Mentions Note B here")],
      ["C.md", makeParsed("C.md", "```\nNote B\n```")],
      ["B.md", makeParsed("B.md", "target")],
    ]);

    const mentions = findUnlinkedMentions({
      targetPath: "B.md",
      targetTitle: "Note B",
      notes,
      excludeCodeFences: true,
    });

    expect(mentions).toEqual([
      {
        from: "A.md",
        line: 1,
        excerpt: "Mentions Note B here",
      },
    ]);
  });
});
