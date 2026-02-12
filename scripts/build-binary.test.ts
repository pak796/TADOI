import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const SCRIPT_PATH = path.resolve("scripts/build-binary.ts");

function runBuildBinary(args: string[], cwd?: string) {
  return spawnSync("bun", [SCRIPT_PATH, ...args], {
    cwd,
    encoding: "utf8",
    env: process.env
  });
}

function createTempDir(prefix: string): string {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

function nonHostTarget(): "macos" | "windows" | "linux" {
  if (process.platform === "darwin") return "windows";
  if (process.platform === "win32") return "macos";
  return "windows";
}

describe("build-binary script argument and mode behavior", () => {
  it("rejects invalid --target with exit code 1", () => {
    const result = runBuildBinary(["--target", "bogus", "--format", "raw"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "[build-binary] invalid --target. expected macos|windows|linux, got: bogus"
    );
  });

  it("rejects invalid --format with exit code 1", () => {
    const result = runBuildBinary(["--target", "macos", "--format", "bogus"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "[build-binary] invalid --format. expected raw|installer, got: bogus"
    );
  });

  it("rejects invalid --mode with exit code 1", () => {
    const result = runBuildBinary([
      "--target",
      "macos",
      "--format",
      "raw",
      "--mode",
      "bogus"
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "[build-binary] invalid --mode. expected plan|build, got: bogus"
    );
  });

  it("defaults to plan mode and writes raw plan output", () => {
    const tempDir = createTempDir("tadoi-build-binary-plan-raw-");
    try {
      const result = runBuildBinary(["--target", "linux", "--format", "raw"], tempDir);
      expect(result.status).toBe(0);

      const planPath = path.join(tempDir, "dist", "bin", "linux", "BUILD_PLAN.txt");
      const plan = readFileSync(planPath, "utf8");
      expect(plan).toContain("TADOI binary build plan");
      expect(plan).toContain("Target: linux");
      expect(plan).toContain("Format: raw");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("defaults to plan mode and writes installer plan output", () => {
    const tempDir = createTempDir("tadoi-build-binary-plan-installer-");
    try {
      const result = runBuildBinary(
        ["--target", "windows", "--format", "installer"],
        tempDir
      );
      expect(result.status).toBe(0);

      const planPath = path.join(
        tempDir,
        "dist",
        "installers",
        "WINDOWS_INSTALLER_PLAN.txt"
      );
      const plan = readFileSync(planPath, "utf8");
      expect(plan).toContain("TADOI installer build plan");
      expect(plan).toContain("Target: windows");
      expect(plan).toContain("Format: installer");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects build mode on non-native host target", () => {
    const tempDir = createTempDir("tadoi-build-binary-host-gate-");
    try {
      writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ version: "0.0.0" }, null, 2),
        "utf8"
      );
      const target = nonHostTarget();
      const result = runBuildBinary(
        ["--target", target, "--format", "raw", "--mode", "build"],
        tempDir
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        `[build-binary] --mode build requires native host. target=${target}`
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
