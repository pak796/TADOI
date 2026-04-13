import { describe, expect, it } from "bun:test";
import { parseTaskRefs } from "./taskRefs";

describe("parseTaskRefs", () => {
  it("extracts task references", () => {
    const refs = parseTaskRefs("a.md", "Link @task:abc-123 and @task:task_2");
    expect(refs).toEqual([
      { from: "a.md", taskId: "abc-123", kind: "mention" },
      { from: "a.md", taskId: "task_2", kind: "mention" },
    ]);
  });

  it("trims trailing sentence punctuation", () => {
    const refs = parseTaskRefs(
      "a.md",
      "Use @task:abc-123. Then (@task:task_2).",
    );
    expect(refs).toEqual([
      { from: "a.md", taskId: "abc-123", kind: "mention" },
      { from: "a.md", taskId: "task_2", kind: "mention" },
    ]);
  });

  it("parses wikilink and url task references", () => {
    const refs = parseTaskRefs(
      "a.md",
      "[[task:abc-123]] and [ref](tadoi://task/task_2) and [[task:abc-123|dup]]",
    );
    expect(refs).toEqual([
      { from: "a.md", taskId: "abc-123", kind: "wikilink" },
      { from: "a.md", taskId: "task_2", kind: "url" },
    ]);
  });
});
