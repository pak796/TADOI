import { describe, expect, it } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
`,
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
`,
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
          outMd,
        ],
        { encoding: "utf8" },
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

  it("extracts ctrl combos and lowerName/lowerSequence comparisons from router code", () => {
    const tempDir = createTempDir("tadoi-keybind-audit-router-patterns-");
    try {
      write(
        tempDir,
        "src/app/keyRouter.ts",
        `
export function handleKey(key: { name: string; sequence: string; ctrl: boolean }) {
  const lowerName = key.name.toLowerCase();
  const lowerSequence = key.sequence.toLowerCase();
  if (key.ctrl && key.name === "s") return [{ scope: "ui", type: "OPEN_SAVE_VIEW_PROMPT" }];
  if (key.ctrl && key.name === "l") return [{ scope: "domain", type: "OPEN_ADD_TASK_LINK_MODAL" }];
  if (lowerName === "h" || lowerSequence === "h") return [{ scope: "ui", type: "OPEN_HELP" }];
  if (lowerName === "y" || lowerSequence === "y") return [{ scope: "domain", type: "MODAL_CONFIRM_DELETE" }];
  return [];
}
`,
      );
      write(
        tempDir,
        "README.md",
        "- keys: \\`Ctrl+S\\` \\`Ctrl+L\\` \\`h\\` \\`y\\`",
      );

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
          outMd,
        ],
        { encoding: "utf8" },
      );

      expect(result.status).toBe(0);

      const payload = JSON.parse(readFileSync(outJson, "utf8")) as {
        canonical_keybinds: string[];
        missing_in_code: string[];
      };
      expect(payload.canonical_keybinds).toContain("Ctrl+S");
      expect(payload.canonical_keybinds).toContain("Ctrl+L");
      expect(payload.canonical_keybinds).toContain("h");
      expect(payload.canonical_keybinds).toContain("y");
      expect(payload.missing_in_code).toEqual([]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("extracts ctrl combos when router compares name/sequence via toLowerCase()", () => {
    const tempDir = createTempDir("tadoi-keybind-audit-ctrl-tolower-");
    try {
      write(
        tempDir,
        "src/app/keyRouter.ts",
        `
export function handleKey(key: { name: string; sequence: string; ctrl: boolean; shift: boolean }) {
  if (key.ctrl && !key.shift && (key.name.toLowerCase() === "n" || key.sequence.toLowerCase() === "n")) {
    return [{ scope: "ui", type: "OPEN_QUICK_CAPTURE" }];
  }
  return [];
}
`,
      );
      write(tempDir, "README.md", "- quick capture: \\`Ctrl+N\\`");

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
          outMd,
        ],
        { encoding: "utf8" },
      );

      expect(result.status).toBe(0);

      const payload = JSON.parse(readFileSync(outJson, "utf8")) as {
        canonical_keybinds: string[];
        missing_in_code: string[];
        semantic_mismatch: string[];
      };
      expect(payload.canonical_keybinds).toContain("Ctrl+N");
      expect(payload.missing_in_code).not.toContain("Ctrl+N");
      expect(payload.semantic_mismatch).toEqual([]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("ignores numeric version tokens in docs while keeping non-version keys", () => {
    const tempDir = createTempDir("tadoi-keybind-audit-version-numeric-");
    try {
      write(
        tempDir,
        "src/app/keyRouter.ts",
        `
export function handleKey(input: { name: string; sequence: string }) {
  if (input.name === "u" || input.sequence === "u") {
    return [{ scope: "ui", type: "OPEN_BACKUP_CENTER" }];
  }
  return [];
}
`,
      );
      write(
        tempDir,
        "README.md",
        [
          "- Schema version: `6`",
          "- App release: `v0.4.0`",
          "- Open backup center: `u`",
        ].join("\n"),
      );

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
          outMd,
        ],
        { encoding: "utf8" },
      );

      expect(result.status).toBe(0);

      const payload = JSON.parse(readFileSync(outJson, "utf8")) as {
        missing_in_code: string[];
        evidence: { docs: Record<string, string[]> };
      };
      expect(payload.missing_in_code).not.toContain("6");
      expect(Object.keys(payload.evidence.docs)).not.toContain("6");
      expect(payload.missing_in_code).toEqual([]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps numeric shortcut tokens from key-context docs", () => {
    const tempDir = createTempDir("tadoi-keybind-audit-numeric-keys-");
    try {
      write(
        tempDir,
        "src/app/keyRouter.ts",
        `
export function handleKey(input: { name: string; sequence: string }) {
  if (input.name === "1" || input.sequence === "1") {
    return [{ scope: "ui", type: "BACKUP_SELECT_MENU_OPTION" }];
  }
  return [];
}
`,
      );
      write(tempDir, "README.md", "- backup menu keys: `1/2/3`");

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
          outMd,
        ],
        { encoding: "utf8" },
      );

      expect(result.status).toBe(0);

      const payload = JSON.parse(readFileSync(outJson, "utf8")) as {
        canonical_keybinds: string[];
        missing_in_code: string[];
      };
      expect(payload.canonical_keybinds).toContain("1");
      expect(payload.missing_in_code).toContain("2");
      expect(payload.missing_in_code).toContain("3");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
