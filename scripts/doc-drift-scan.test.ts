import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const SCRIPT_PATH = path.resolve("scripts/doc-drift-scan.py");

function createTempDir(prefix: string): string {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

function write(root: string, relativePath: string, contents: string): void {
  const fullPath = path.join(root, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, contents, "utf8");
}

type DriftFinding = {
  id: string;
  claim: string;
  status: string;
  evidence_paths: string[];
};

function runScan(tempDir: string): DriftFinding[] {
  const outJson = path.join(tempDir, "doc-drift.json");
  const outMd = path.join(tempDir, "doc-drift.md");
  const result = spawnSync(
    "python3",
    [
      SCRIPT_PATH,
      "--repo-root",
      tempDir,
      "--doc-glob",
      "**/*.md",
      "--code-glob",
      "src/**/*",
      "--code-glob",
      "docs/**/*",
      "--code-glob",
      "*.md",
      "--out-json",
      outJson,
      "--out-md",
      outMd,
    ],
    { encoding: "utf8" },
  );

  expect(result.status).toBe(0);
  return JSON.parse(readFileSync(outJson, "utf8")) as DriftFinding[];
}

function findingByClaim(findings: DriftFinding[], claim: string): DriftFinding {
  const finding = findings.find((row) => row.claim === claim);
  expect(finding).toBeDefined();
  return finding as DriftFinding;
}

describe("doc-drift-scan matcher upgrades", () => {
  it("verifies repo-relative test path claims and comma-delimited path-list entries", () => {
    const tempDir = createTempDir("tadoi-doc-drift-paths-");
    try {
      write(
        tempDir,
        "README.md",
        [
          "- Evidence file: `src/app/keyRouter.test.ts`",
          "- Backup coverage: `src/state/backupCenterFlow.test.ts`, `src/state/backupCenterCalendarController.test.ts`",
        ].join("\n"),
      );
      write(tempDir, "src/app/keyRouter.test.ts", "describe('router', () => {});");
      write(tempDir, "src/state/backupCenterFlow.test.ts", "describe('flow', () => {});");
      write(
        tempDir,
        "src/state/backupCenterCalendarController.test.ts",
        "describe('calendar', () => {});",
      );

      const findings = runScan(tempDir);

      const keyRouter = findingByClaim(findings, "src/app/keyRouter.test.ts");
      expect(keyRouter.status).toBe("verified");
      expect(keyRouter.evidence_paths).toContain("src/app/keyRouter.test.ts");

      const backupFlow = findingByClaim(findings, "src/state/backupCenterFlow.test.ts");
      expect(backupFlow.status).toBe("verified");
      expect(backupFlow.evidence_paths).toContain("src/state/backupCenterFlow.test.ts");

      const backupCalendar = findingByClaim(
        findings,
        "src/state/backupCenterCalendarController.test.ts",
      );
      expect(backupCalendar.status).toBe("verified");
      expect(backupCalendar.evidence_paths).toContain(
        "src/state/backupCenterCalendarController.test.ts",
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("verifies Shift+Tab, 1..6 range, and dotted semantic tokens", () => {
    const tempDir = createTempDir("tadoi-doc-drift-semantics-");
    try {
      write(
        tempDir,
        "README.md",
        [
          "- Dashboard group nav: Shift+Tab",
          "- Exact due range token: `1..6`",
          "- Calendar metadata field: `external.calendar`",
          "- Security setting token: `security.nonHttpLinkPolicy`",
        ].join("\n"),
      );
      write(
        tempDir,
        "src/app/keyRouter.ts",
        `
export function handleKey(key: { name: string; shift: boolean }) {
  if (key.name === "tab" && key.shift) return [];
  return [];
}
`,
      );
      write(
        tempDir,
        "src/domain/models.ts",
        `
type DueDayOffset = 1 | 2 | 3 | 4 | 5 | 6;
const external = { calendar: { uid: "x" } };
const warning = "settings.security.nonHttpLinkPolicy is invalid";
void DueDayOffset;
void external;
void warning;
`,
      );

      const findings = runScan(tempDir);

      const shiftTab = findingByClaim(findings, "Shift+Tab");
      expect(shiftTab.status).toBe("verified");
      expect(shiftTab.evidence_paths.length).toBeGreaterThan(0);

      const range = findingByClaim(findings, "1..6");
      expect(range.status).toBe("verified");
      expect(range.evidence_paths.length).toBeGreaterThan(0);

      const externalCalendar = findingByClaim(findings, "external.calendar");
      expect(externalCalendar.status).toBe("verified");
      expect(externalCalendar.evidence_paths.length).toBeGreaterThan(0);

      const securityPolicy = findingByClaim(findings, "security.nonHttpLinkPolicy");
      expect(securityPolicy.status).toBe("verified");
      expect(securityPolicy.evidence_paths.length).toBeGreaterThan(0);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("resolves doc-relative markdown references as evidence when scanned", () => {
    const tempDir = createTempDir("tadoi-doc-drift-docref-");
    try {
      write(tempDir, "README.md", "# Root");
      write(tempDir, "docs/guide/child.md", "- Parent doc: `../../README.md`");

      const findings = runScan(tempDir);
      const readmeRef = findingByClaim(findings, "../../README.md");
      expect(readmeRef.status).toBe("verified");
      expect(readmeRef.evidence_paths).toContain("README.md");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
