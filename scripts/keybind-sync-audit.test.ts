import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const SCRIPT_PATH = path.resolve("scripts/keybind-sync-audit.py");

function createTempDir(prefix: string): string {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

function write(root: string, relativePath: string, contents: string): void {
  const fullPath = path.join(root, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, contents, "utf8");
}

describe("keybind-sync-audit canonical extraction", () => {
  it("does not promote no-op key literals from keyRouter.test.ts into canonical keybinds", () => {
    const tempDir = createTempDir("tadoi-keybind-audit-");
    try {
      write(
        tempDir,
        "src/app/keyRouter.ts",
        `
export function handleKey(input: { name: string; sequence: string }) {
  if (input.name === "t" || input.sequence === "t") {
    return [{ scope: "domain", type: "TOGGLE_TAG_FILTER" }];
  }
  return [];
}
`
      );
      write(
        tempDir,
        "src/app/keyRouter.test.ts",
        `
function run(input: Record<string, unknown>) {
  return input;
}

expect(run({ name: "t", sequence: "t", ctrl: false, shift: false })).toEqual([
  { scope: "domain", type: "TOGGLE_TAG_FILTER" }
]);
expect(run({ name: "T", sequence: "T", ctrl: false, shift: false })).toEqual([]);
`
      );
      write(tempDir, "README.md", "- legacy tag cycle: \`t\`");

      const outJson = path.join(tempDir, "keybind-audit.json");
      const outMd = path.join(tempDir, "keybind-audit.md");
      const result = spawnSync(
        "python3",
        [
          SCRIPT_PATH,
          "--repo-root",
          tempDir,
          "--router-path",
          "src/app/keyRouter.ts",
          "--docs-glob",
          "README.md",
          "--out-json",
          outJson,
          "--out-md",
          outMd
        ],
        { encoding: "utf8" }
      );

      expect(result.status).toBe(0);

      const payload = JSON.parse(readFileSync(outJson, "utf8")) as {
        canonical_keybinds: string[];
        evidence: { code: Record<string, string[]> };
      };
      expect(payload.canonical_keybinds).toContain("t");
      expect(payload.canonical_keybinds).not.toContain("T");
      expect(Object.keys(payload.evidence.code)).not.toContain("T");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
