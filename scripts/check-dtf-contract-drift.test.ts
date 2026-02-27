import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  computeMissingDtfIds,
  extractCurrentSpecPathFromReadme,
  extractDtfIdsFromSpec,
  extractDtfIdsFromTestCaseNames,
  runDtfContractDriftCheck
} from "./check-dtf-contract-drift";

function createTempDir(prefix: string): string {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

function write(root: string, relativePath: string, contents: string): void {
  const fullPath = path.join(root, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, contents, "utf8");
}

describe("check-dtf-contract-drift helpers", () => {
  it("extracts DTF rows from markdown contract tables", () => {
    const markdown = `
| ID | Contract |
| --- | --- |
| DTF-002 | two |
| DTF-001 | one |
| NOT-DTF-001 | ignored |
`;
    expect(extractDtfIdsFromSpec(markdown)).toEqual(["DTF-001", "DTF-002"]);
  });

  it("extracts DTF IDs from test case names", () => {
    const source = `
describe("x", () => {
  it("DTF-001: a contract case", () => {});
  test('DTF-002: another case', () => {});
  it("not a contract case", () => {});
});
`;
    expect(extractDtfIdsFromTestCaseNames(source)).toEqual(["DTF-001", "DTF-002"]);
  });

  it("resolves current spec path from README inline code link", () => {
    const readme = "Current behavior is documented in `TADOI_SPEC_v0.3.9.md`.";
    expect(extractCurrentSpecPathFromReadme(readme)).toBe("TADOI_SPEC_v0.3.9.md");
  });

  it("computes missing IDs from contract vs coverage", () => {
    expect(
      computeMissingDtfIds(["DTF-001", "DTF-002", "DTF-003"], ["DTF-001", "DTF-003"])
    ).toEqual(["DTF-002"]);
  });
});

describe("check-dtf-contract-drift end-to-end", () => {
  it("reports missing DTF IDs when tests do not include matching case names", async () => {
    const tempDir = createTempDir("tadoi-dtf-drift-missing-");
    try {
      write(
        tempDir,
        "README.md",
        "Canonical contract in `TADOI_SPEC_v0.9.9.md` and dashboard in docs."
      );
      write(
        tempDir,
        "TADOI_SPEC_v0.9.9.md",
        `
| ID | Contract |
| --- | --- |
| DTF-001 | First |
| DTF-002 | Second |
`
      );
      write(
        tempDir,
        "DASHBOARD_SPEC_MVP.md",
        `
| ID | Contract |
| --- | --- |
| DTF-001 | First |
`
      );
      write(
        tempDir,
        "src/app/contract.test.ts",
        `
import { it } from "bun:test";
it("DTF-001: First", () => {});
`
      );

      const result = await runDtfContractDriftCheck(tempDir);
      expect(result.specIds).toEqual(["DTF-001", "DTF-002"]);
      expect(result.coveredIds).toEqual(["DTF-001"]);
      expect(result.missingIds).toEqual(["DTF-002"]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("passes when every spec DTF ID exists in a test case name", async () => {
    const tempDir = createTempDir("tadoi-dtf-drift-ok-");
    try {
      write(
        tempDir,
        "README.md",
        "Canonical contract in `TADOI_SPEC_v0.9.9.md` and dashboard in docs."
      );
      write(
        tempDir,
        "TADOI_SPEC_v0.9.9.md",
        `
| ID | Contract |
| --- | --- |
| DTF-001 | First |
| DTF-002 | Second |
`
      );
      write(
        tempDir,
        "DASHBOARD_SPEC_MVP.md",
        `
| ID | Contract |
| --- | --- |
| DTF-001 | First |
| DTF-002 | Second |
`
      );
      write(
        tempDir,
        "src/app/contract.test.ts",
        `
import { describe, it } from "bun:test";
describe("contract", () => {
  it("DTF-001: First", () => {});
  it("DTF-002: Second", () => {});
});
`
      );

      const result = await runDtfContractDriftCheck(tempDir);
      expect(result.specIds).toEqual(["DTF-001", "DTF-002"]);
      expect(result.coveredIds).toEqual(["DTF-001", "DTF-002"]);
      expect(result.missingIds).toEqual([]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("falls back to highest versioned spec when README spec link is absent", async () => {
    const tempDir = createTempDir("tadoi-dtf-drift-fallback-");
    try {
      write(tempDir, "README.md", "No explicit product spec link here.");
      write(
        tempDir,
        "TADOI_SPEC_v0.9.8.md",
        `
| ID | Contract |
| --- | --- |
| DTF-098 | Older |
`
      );
      write(
        tempDir,
        "TADOI_SPEC_v0.9.9.md",
        `
| ID | Contract |
| --- | --- |
| DTF-099 | Newer |
`
      );
      write(
        tempDir,
        "DASHBOARD_SPEC_MVP.md",
        `
| ID | Contract |
| --- | --- |
| DTF-001 | Dashboard |
`
      );
      write(
        tempDir,
        "src/app/contract.test.ts",
        `
import { describe, it } from "bun:test";
describe("contract", () => {
  it("DTF-001: Dashboard", () => {});
  it("DTF-099: Newer", () => {});
});
`
      );

      const result = await runDtfContractDriftCheck(tempDir);
      expect(result.specFiles).toEqual(["DASHBOARD_SPEC_MVP.md", "TADOI_SPEC_v0.9.9.md"]);
      expect(result.specIds).toEqual(["DTF-001", "DTF-099"]);
      expect(result.missingIds).toEqual([]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("prefers TADOI_SPEC_PATH override over README link", async () => {
    const tempDir = createTempDir("tadoi-dtf-drift-env-");
    try {
      write(
        tempDir,
        "README.md",
        "Canonical contract in `TADOI_SPEC_v0.9.9.md` and dashboard in docs."
      );
      write(
        tempDir,
        "TADOI_SPEC_v0.9.8.md",
        `
| ID | Contract |
| --- | --- |
| DTF-888 | Env |
`
      );
      write(
        tempDir,
        "TADOI_SPEC_v0.9.9.md",
        `
| ID | Contract |
| --- | --- |
| DTF-999 | Readme |
`
      );
      write(
        tempDir,
        "DASHBOARD_SPEC_MVP.md",
        `
| ID | Contract |
| --- | --- |
| DTF-001 | Dashboard |
`
      );
      write(
        tempDir,
        "src/app/contract.test.ts",
        `
import { describe, it } from "bun:test";
describe("contract", () => {
  it("DTF-001: Dashboard", () => {});
  it("DTF-888: Env", () => {});
});
`
      );

      const result = await runDtfContractDriftCheck(tempDir, {
        TADOI_SPEC_PATH: "TADOI_SPEC_v0.9.8.md"
      });
      expect(result.specFiles).toEqual(["DASHBOARD_SPEC_MVP.md", "TADOI_SPEC_v0.9.8.md"]);
      expect(result.specIds).toEqual(["DTF-001", "DTF-888"]);
      expect(result.missingIds).toEqual([]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
