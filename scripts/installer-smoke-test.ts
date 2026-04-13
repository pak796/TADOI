import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

type Target = "macos" | "windows" | "linux";
type SmokeScope = "binary" | "installer" | "all";

type SmokePaths = {
  binaryPath: string;
  installerDir: string;
  packageVersion: string;
  macPkgPath: string;
  macDmgPath: string;
  windowsInstallerPath: string;
  linuxDebPath: string;
  linuxAppImagePath: string;
};

function fail(message: string): never {
  console.error(`[installer:smoke] ${message}`);
  process.exit(1);
}

function hostTarget(): Target {
  if (process.platform === "darwin") return "macos";
  if (process.platform === "win32") return "windows";
  return "linux";
}

function parseArg(argv: string[], name: string): string | null {
  const prefix = `${name}=`;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === name) return argv[i + 1] ?? null;
    if (arg.startsWith(prefix)) return arg.slice(prefix.length);
  }
  return null;
}

export function parseTargetArg(
  argv: string[] = process.argv.slice(2),
  defaultTarget: Target = hostTarget(),
): Target {
  const requested = parseArg(argv, "--target");
  if (requested === null || requested.trim() === "") return defaultTarget;
  if (
    requested === "macos" ||
    requested === "windows" ||
    requested === "linux"
  ) {
    return requested;
  }
  fail(`invalid --target. expected macos|windows|linux, got: ${requested}`);
}

export function parseScopeArg(
  argv: string[] = process.argv.slice(2),
  defaultScope: SmokeScope = "all",
): SmokeScope {
  const requested = parseArg(argv, "--scope");
  if (requested === null || requested.trim() === "") return defaultScope;
  if (
    requested === "binary" ||
    requested === "installer" ||
    requested === "all"
  ) {
    return requested;
  }
  fail(`invalid --scope. expected binary|installer|all, got: ${requested}`);
}

function readPackageVersion(rootDir: string): string {
  const packageJsonPath = path.join(rootDir, "package.json");
  const raw = readFileSync(packageJsonPath, "utf8");
  const parsed = JSON.parse(raw) as { version?: string };
  const version = parsed.version?.trim();
  if (!version) fail("package.json is missing a version");
  return version;
}

export function resolveSmokePaths(rootDir: string, target: Target): SmokePaths {
  const packageVersion = readPackageVersion(rootDir);
  const binaryName = target === "windows" ? "tadoi.exe" : "tadoi";
  const installerDir = path.join(rootDir, "dist", "installers");
  return {
    binaryPath: path.join(rootDir, "dist", "bin", target, binaryName),
    installerDir,
    packageVersion,
    macPkgPath: path.join(installerDir, `TADOI-${packageVersion}.pkg`),
    macDmgPath: path.join(installerDir, `TADOI-macOS-${packageVersion}.dmg`),
    windowsInstallerPath: path.join(
      installerDir,
      `TADOI-Setup-x64-${packageVersion}.exe`,
    ),
    linuxDebPath: path.join(installerDir, `tadoi_${packageVersion}_amd64.deb`),
    linuxAppImagePath: path.join(
      installerDir,
      `tadoi-${packageVersion}-x86_64.AppImage`,
    ),
  };
}

function runOrFail(command: string, args: string[], cwd?: string): string {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: process.env,
  });
  if (result.error) {
    fail(`failed to execute ${command}: ${String(result.error)}`);
  }
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    fail(`command failed (${command} ${args.join(" ")}):\n${output}`);
  }
  return result.stdout;
}

function commandExists(command: string): boolean {
  const result = spawnSync(command, ["--help"], {
    stdio: "ignore",
    env: process.env,
  });
  return !result.error;
}

function ensureFile(pathname: string, label: string): void {
  if (!existsSync(pathname)) {
    fail(`${label} not found: ${pathname}`);
  }
}

function ensureExecutable(pathname: string, label: string): void {
  ensureFile(pathname, label);
  const mode = statSync(pathname).mode;
  if ((mode & 0o111) === 0) {
    fail(`${label} is not executable: ${pathname}`);
  }
}

function smokeBinary(binaryPath: string, expectedVersion: string): void {
  ensureFile(binaryPath, "binary");
  const versionOutput = runOrFail(binaryPath, ["--version"]).trim();
  if (!versionOutput.includes(expectedVersion)) {
    fail(
      `--version output did not include package version ${expectedVersion}. Output: ${versionOutput}`,
    );
  }

  const helpOutput = runOrFail(binaryPath, ["--help"]);
  if (!helpOutput.includes("Usage: tadoi")) {
    fail("--help output did not include expected usage text");
  }

  runOrFail(binaryPath, ["--smoke-tui"]);
}

function smokeMacInstaller(paths: SmokePaths): void {
  ensureFile(paths.macPkgPath, "macOS PKG");
  ensureFile(paths.macDmgPath, "macOS DMG");

  if (!commandExists("hdiutil")) {
    fail("hdiutil is required for macOS installer smoke checks");
  }

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), "tadoi-dmg-smoke-"));
  const mountPoint = path.join(tempRoot, "mount");
  mkdirSync(mountPoint, { recursive: true });
  try {
    runOrFail("hdiutil", [
      "attach",
      paths.macDmgPath,
      "-readonly",
      "-nobrowse",
      "-mountpoint",
      mountPoint,
    ]);

    const expectedPkgName = `TADOI-${paths.packageVersion}.pkg`;
    const pkgFromDmg = path.join(mountPoint, expectedPkgName);
    ensureFile(pkgFromDmg, "PKG payload inside DMG");
    const readmeFromDmg = path.join(mountPoint, "README.txt");
    ensureFile(readmeFromDmg, "README payload inside DMG");
  } finally {
    spawnSync("hdiutil", ["detach", mountPoint], {
      stdio: "ignore",
      env: process.env,
    });
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function smokeWindowsInstaller(paths: SmokePaths): void {
  ensureFile(paths.windowsInstallerPath, "Windows installer EXE");
  const bytes = readFileSync(paths.windowsInstallerPath);
  if (bytes.length < 2 || bytes[0] !== 0x4d || bytes[1] !== 0x5a) {
    fail(
      "Windows installer does not look like a valid PE executable (missing MZ header)",
    );
  }
}

function smokeLinuxInstallers(paths: SmokePaths): void {
  if (!commandExists("appimagetool")) {
    fail(
      "appimagetool is required for Linux AppImage smoke checks (strict installer mode).",
    );
  }

  ensureFile(paths.linuxDebPath, "Linux DEB");
  ensureFile(paths.linuxAppImagePath, "Linux AppImage");
  ensureExecutable(paths.linuxAppImagePath, "Linux AppImage");

  if (!commandExists("dpkg-deb")) {
    fail("dpkg-deb is required for Linux DEB smoke checks");
  }
  const debListing = runOrFail("dpkg-deb", ["-c", paths.linuxDebPath]);
  if (!/\/usr\/bin\/tadoi(?:\s|$)/m.test(debListing)) {
    fail("Linux DEB listing did not include /usr/bin/tadoi payload");
  }
}

export function runInstallerSmoke(
  rootDir: string,
  target: Target,
  scope: SmokeScope = "all",
): void {
  const paths = resolveSmokePaths(rootDir, target);
  if (scope === "binary" || scope === "all") {
    smokeBinary(paths.binaryPath, paths.packageVersion);
  }

  if (scope === "installer" || scope === "all") {
    if (target === "macos") {
      smokeMacInstaller(paths);
    } else if (target === "windows") {
      smokeWindowsInstaller(paths);
    } else {
      smokeLinuxInstallers(paths);
    }
  }

  const scopeLabel =
    scope === "all"
      ? "binary runtime and installer artifact checks"
      : scope === "binary"
        ? "binary runtime checks"
        : "installer artifact checks";
  console.log(`[installer:smoke] OK (${target}): ${scopeLabel} passed.`);
}

function main(): void {
  const argv = process.argv.slice(2);
  const target = parseTargetArg(argv, hostTarget());
  const scope = parseScopeArg(argv, "all");
  runInstallerSmoke(process.cwd(), target, scope);
}

if (import.meta.main) {
  main();
}
