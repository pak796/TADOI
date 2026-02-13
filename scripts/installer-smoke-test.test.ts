import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseTargetArg, resolveSmokePaths } from "./installer-smoke-test";

function createTempDir(prefix: string): string {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe("installer-smoke-test target parsing", () => {
  it("uses provided default target when no --target arg is present", () => {
    expect(parseTargetArg([], "linux")).toBe("linux");
  });

  it("parses --target in both split and equals forms", () => {
    expect(parseTargetArg(["--target", "macos"], "linux")).toBe("macos");
    expect(parseTargetArg(["--target=windows"], "linux")).toBe("windows");
  });
});

describe("installer-smoke-test path resolution", () => {
  it("resolves expected artifact paths from package version", () => {
    const tempDir = createTempDir("tadoi-installer-smoke-paths-");
    try {
      writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ version: "1.2.3" }, null, 2),
        "utf8"
      );
      mkdirSync(path.join(tempDir, "dist", "installers"), { recursive: true });

      const linuxPaths = resolveSmokePaths(tempDir, "linux");
      expect(linuxPaths.binaryPath).toBe(path.join(tempDir, "dist", "bin", "linux", "tadoi"));
      expect(linuxPaths.linuxDebPath).toBe(
        path.join(tempDir, "dist", "installers", "tadoi_1.2.3_amd64.deb")
      );
      expect(linuxPaths.linuxAppImagePath).toBe(
        path.join(tempDir, "dist", "installers", "tadoi-1.2.3-x86_64.AppImage")
      );

      const windowsPaths = resolveSmokePaths(tempDir, "windows");
      expect(windowsPaths.binaryPath).toBe(
        path.join(tempDir, "dist", "bin", "windows", "tadoi.exe")
      );
      expect(windowsPaths.windowsInstallerPath).toBe(
        path.join(tempDir, "dist", "installers", "TADOI-Setup-x64-1.2.3.exe")
      );

      const macPaths = resolveSmokePaths(tempDir, "macos");
      expect(macPaths.macPkgPath).toBe(
        path.join(tempDir, "dist", "installers", "TADOI-1.2.3.pkg")
      );
      expect(macPaths.macDmgPath).toBe(
        path.join(tempDir, "dist", "installers", "TADOI-macOS-1.2.3.dmg")
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
