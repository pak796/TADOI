import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  parseTargetArg,
  resolveManifestPath,
  validateInstallerManifest
} from "./installer-artifact-gate";

function createTempDir(prefix: string): string {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("installer-artifact-gate target parsing", () => {
  it("parses split and equals arg forms", () => {
    expect(parseTargetArg(["--target", "macos"])).toBe("macos");
    expect(parseTargetArg(["--target=linux"])).toBe("linux");
  });

  it("rejects invalid targets", () => {
    expect(() => parseTargetArg(["--target", "bogus"])).toThrow(
      "invalid --target"
    );
  });
});

describe("installer-artifact-gate validation", () => {
  it("validates a complete linux manifest", () => {
    const tempDir = createTempDir("tadoi-installer-gate-ok-");
    try {
      writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ version: "1.2.3" }, null, 2),
        "utf8"
      );

      const binaryPath = path.join("dist", "bin", "linux", "tadoi");
      const debPath = path.join("dist", "installers", "tadoi_1.2.3_amd64.deb");
      const appImagePath = path.join(
        "dist",
        "installers",
        "tadoi-1.2.3-x86_64.AppImage"
      );
      mkdirSync(path.join(tempDir, "dist", "bin", "linux"), { recursive: true });
      mkdirSync(path.join(tempDir, "dist", "installers"), { recursive: true });
      writeFileSync(path.join(tempDir, binaryPath), "binary", "utf8");
      writeFileSync(path.join(tempDir, debPath), "deb", "utf8");
      writeFileSync(path.join(tempDir, appImagePath), "appimage", "utf8");

      const manifestPath = resolveManifestPath(tempDir, "linux", "1.2.3");
      writeFileSync(
        manifestPath,
        JSON.stringify(
          {
            schemaVersion: 1,
            target: "linux",
            packageVersion: "1.2.3",
            generatedAt: "2026-02-13T00:00:00.000Z",
            outputs: [
              {
                kind: "binary",
                path: binaryPath,
                sizeBytes: Buffer.byteLength("binary"),
                sha256: sha256("binary")
              },
              {
                kind: "deb",
                path: debPath,
                sizeBytes: Buffer.byteLength("deb"),
                sha256: sha256("deb")
              },
              {
                kind: "appimage",
                path: appImagePath,
                sizeBytes: Buffer.byteLength("appimage"),
                sha256: sha256("appimage")
              }
            ]
          },
          null,
          2
        ),
        "utf8"
      );

      expect(() => validateInstallerManifest(tempDir, "linux")).not.toThrow();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("fails on hash mismatches", () => {
    const tempDir = createTempDir("tadoi-installer-gate-hash-");
    try {
      writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ version: "2.0.0" }, null, 2),
        "utf8"
      );

      const binaryPath = path.join("dist", "bin", "windows", "tadoi.exe");
      const exePath = path.join("dist", "installers", "TADOI-Setup-x64-2.0.0.exe");
      mkdirSync(path.join(tempDir, "dist", "bin", "windows"), { recursive: true });
      mkdirSync(path.join(tempDir, "dist", "installers"), { recursive: true });
      writeFileSync(path.join(tempDir, binaryPath), "binary", "utf8");
      writeFileSync(path.join(tempDir, exePath), "exe", "utf8");

      const manifestPath = resolveManifestPath(tempDir, "windows", "2.0.0");
      writeFileSync(
        manifestPath,
        JSON.stringify(
          {
            schemaVersion: 1,
            target: "windows",
            packageVersion: "2.0.0",
            generatedAt: "2026-02-13T00:00:00.000Z",
            outputs: [
              {
                kind: "binary",
                path: binaryPath,
                sizeBytes: Buffer.byteLength("binary"),
                sha256: sha256("binary")
              },
              {
                kind: "exe",
                path: exePath,
                sizeBytes: Buffer.byteLength("exe"),
                sha256: sha256("not-the-right-file")
              }
            ]
          },
          null,
          2
        ),
        "utf8"
      );

      expect(() => validateInstallerManifest(tempDir, "windows")).toThrow(
        "sha256 mismatch"
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
