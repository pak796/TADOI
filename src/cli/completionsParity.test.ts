import { describe, expect, it } from "bun:test";
import { promises as fs } from "fs";
import path from "path";

const COMPLETION_FILES = [
  path.resolve(import.meta.dir, "../../docs/completions/tadoi.bash"),
  path.resolve(import.meta.dir, "../../docs/completions/_tadoi"),
  path.resolve(import.meta.dir, "../../docs/completions/tadoi.fish")
];

const REQUIRED_COMMAND_TOKENS = [
  "list",
  "check:add",
  "check:toggle",
  "check:edit",
  "check:del",
  "check:clear",
  "bulk:done",
  "bulk:tag:add",
  "bulk:tag:rm",
  "bulk:due",
  "bulk:due:clear",
  "bulk:priority",
  "bulk:assignee",
  "bulk:project",
  "bulk:stage",
  "bulk:delete"
];

describe("CLI completion parity", () => {
  it("contains list/check/bulk command families in all shell completion files", async () => {
    for (const filePath of COMPLETION_FILES) {
      const content = await fs.readFile(filePath, "utf8");
      for (const token of REQUIRED_COMMAND_TOKENS) {
        expect(content).toContain(token);
      }
    }
  });
});

