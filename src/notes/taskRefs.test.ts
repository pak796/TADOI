import { describe, expect, it } from "bun:test";
import { parseTaskRefs } from "./taskRefs";

describe("parseTaskRefs", () => {
  it("extracts task references", () => {
    const refs = parseTaskRefs("a.md", "Link @task:abc-123 and @task:task_2");
    expect(refs).toEqual([
      { from: "a.md", taskId: "abc-123" },
      { from: "a.md", taskId: "task_2" }
    ]);
  });

  it("trims trailing sentence punctuation", () => {
    const refs = parseTaskRefs("a.md", "Use @task:abc-123. Then (@task:task_2).");
    expect(refs).toEqual([
      { from: "a.md", taskId: "abc-123" },
      { from: "a.md", taskId: "task_2" }
    ]);
  });
});
