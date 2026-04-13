import { describe, expect, it } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import {
  createInstallerManifest,
  writeInstallerManifest,
} from "./build-binary";

const SCRIPT_PATH = path.resolve("scripts/build-binary.ts");

function runBuildBinary(
  args: string[],
  cwd?: string,
  envOverrides?: Record<string, string | undefined>,
) {
  const env = { ...process.env, ...envOverrides };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete env[key];
    }
  }
  return spawnSync("bun", [SCRIPT_PATH, ...args], {
    cwd,
    encoding: "utf8",
    env,
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

function strictSigningVarsForTarget(
  target: "macos" | "windows" | "linux",
): string[] {
  if (target === "macos") {
    return ["TADOI_MAC_SIGN_IDENTITY_INSTALLER", "TADOI_MAC_NOTARY_PROFILE"];
  }
  if (target === "windows") {
    return ["TADOI_WIN_SIGN_CERT_PATH", "TADOI_WIN_SIGN_CERT_PASSWORD"];
  }
  return [];
}

describe("build-binary script argument and mode behavior", () => {
  it("rejects invalid --target with exit code 1", () => {
    const result = runBuildBinary(["--target", "bogus", "--format", "raw"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "[build-binary] invalid --target. expected macos|windows|linux, got: bogus",
    );
  });

  it("rejects invalid --format with exit code 1", () => {
    const result = runBuildBinary(["--target", "macos", "--format", "bogus"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "[build-binary] invalid --format. expected raw|installer, got: bogus",
    );
  });

  it("rejects invalid --mode with exit code 1", () => {
    const result = runBuildBinary([
      "--target",
      "macos",
      "--format",
      "raw",
      "--mode",
      "bogus",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "[build-binary] invalid --mode. expected plan|build, got: bogus",
    );
  });

  it("defaults to plan mode and writes raw plan output", () => {
    const tempDir = createTempDir("tadoi-build-binary-plan-raw-");
    try {
      const result = runBuildBinary(
        ["--target", "linux", "--format", "raw"],
        tempDir,
      );
      expect(result.status).toBe(0);

      const planPath = path.join(
        tempDir,
        "dist",
        "bin",
        "linux",
        "BUILD_PLAN.txt",
      );
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
        tempDir,
      );
      expect(result.status).toBe(0);

      const planPath = path.join(
        tempDir,
        "dist",
        "installers",
        "WINDOWS_INSTALLER_PLAN.txt",
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
        "utf8",
      );
      const target = nonHostTarget();
      const result = runBuildBinary(
        ["--target", target, "--format", "raw", "--mode", "build"],
        tempDir,
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        `[build-binary] --mode build requires native host. target=${target}`,
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("enforces strict signing prerequisites before host/build execution", () => {
    const tempDir = createTempDir("tadoi-build-binary-signing-gate-");
    try {
      writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ version: "0.0.0" }, null, 2),
        "utf8",
      );
      const target = nonHostTarget();
      const vars = strictSigningVarsForTarget(target);
      const envOverrides: Record<string, string | undefined> = {
        TADOI_REQUIRE_SIGNING: "1",
      };
      for (const variableName of vars) {
        envOverrides[variableName] = "";
      }

      const result = runBuildBinary(
        ["--target", target, "--format", "installer", "--mode", "build"],
        tempDir,
        envOverrides,
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        "[build-binary] strict signing enabled (TADOI_REQUIRE_SIGNING=1); missing required env vars",
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("does not enforce strict signing prerequisites in plan mode", () => {
    const tempDir = createTempDir("tadoi-build-binary-signing-plan-");
    try {
      const target = nonHostTarget();
      const result = runBuildBinary(
        ["--target", target, "--format", "installer", "--mode", "plan"],
        tempDir,
        { TADOI_REQUIRE_SIGNING: "1" },
      );
      expect(result.status).toBe(0);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("build-binary installer manifest helpers", () => {
  it("creates manifest entries for linux binary and installers", () => {
    const tempDir = createTempDir("tadoi-build-binary-manifest-linux-");
    try {
      const rawDir = path.join(tempDir, "dist", "bin", "linux");
      const installerDir = path.join(tempDir, "dist", "installers");
      mkdirSync(rawDir, { recursive: true });
      mkdirSync(installerDir, { recursive: true });

      const binaryPath = path.join(rawDir, "tadoi");
      const debPath = path.join(installerDir, "tadoi_1.2.3_amd64.deb");
      const appImagePath = path.join(
        installerDir,
        "tadoi-1.2.3-x86_64.AppImage",
      );
      writeFileSync(binaryPath, "binary-bytes", "utf8");
      writeFileSync(debPath, "deb-bytes", "utf8");
      writeFileSync(appImagePath, "appimage-bytes", "utf8");

      const manifest = createInstallerManifest(
        "linux",
        "1.2.3",
        binaryPath,
        installerDir,
        tempDir,
      );

      expect(manifest.schemaVersion).toBe(1);
      expect(manifest.target).toBe("linux");
      expect(manifest.packageVersion).toBe("1.2.3");
      expect(manifest.outputs.map((entry) => entry.kind).sort()).toEqual([
        "appimage",
        "binary",
        "deb",
      ]);
      for (const output of manifest.outputs) {
        expect(output.path.startsWith("dist/")).toBe(true);
        expect(output.sizeBytes).toBeGreaterThan(0);
        expect(output.sha256).toMatch(/^[a-f0-9]{64}$/);
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("writes manifest file with expected name", () => {
    const tempDir = createTempDir("tadoi-build-binary-manifest-write-");
    try {
      const rawDir = path.join(tempDir, "dist", "bin", "windows");
      const installerDir = path.join(tempDir, "dist", "installers");
      mkdirSync(rawDir, { recursive: true });
      mkdirSync(installerDir, { recursive: true });

      const binaryPath = path.join(rawDir, "tadoi.exe");
      const exePath = path.join(installerDir, "TADOI-Setup-x64-2.0.0.exe");
      writeFileSync(binaryPath, "binary-bytes", "utf8");
      writeFileSync(exePath, "exe-bytes", "utf8");

      const manifestPath = writeInstallerManifest(
        "windows",
        "2.0.0",
        binaryPath,
        installerDir,
        tempDir,
      );
      expect(manifestPath).toBe(
        path.join(installerDir, "TADOI-windows-2.0.0-manifest.json"),
      );

      const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        schemaVersion: number;
        target: string;
      };
      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.target).toBe("windows");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
