import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

type Target = "macos" | "windows" | "linux";
type Format = "raw" | "installer";
type Mode = "plan" | "build";

type ReleaseTargetConfig = {
  id: string;
  status?: string;
  outputDir?: string;
  installerOutputDir?: string;
};

type ReleaseTargetsFile = {
  version: number;
  targets: ReleaseTargetConfig[];
};

type OutputDirs = {
  rawDir: string;
  installerDir: string;
};

function requiredSigningEnvVars(target: Target): string[] {
  if (target === "macos") {
    return ["TADOI_MAC_SIGN_IDENTITY_INSTALLER", "TADOI_MAC_NOTARY_PROFILE"];
  }
  if (target === "windows") {
    return ["TADOI_WIN_SIGN_CERT_PATH", "TADOI_WIN_SIGN_CERT_PASSWORD"];
  }
  return [];
}

function assertStrictSigningPrerequisites(target: Target, format: Format, mode: Mode): void {
  if (mode !== "build" || format !== "installer") return;
  if (process.env.TADOI_REQUIRE_SIGNING !== "1") return;

  const requiredEnvVars = requiredSigningEnvVars(target);
  const missing = requiredEnvVars.filter((name) => {
    const value = process.env[name];
    return value === undefined || value.trim() === "";
  });

  if (missing.length > 0) {
    console.error(
      `[build-binary] strict signing enabled (TADOI_REQUIRE_SIGNING=1); missing required env vars for ${target}: ${missing.join(
        ", "
      )}`
    );
    process.exit(1);
  }
}

function parseArg(name: string): string | null {
  const prefix = `${name}=`;
  for (let i = 0; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (arg === name) {
      return process.argv[i + 1] ?? null;
    }
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length);
    }
  }
  return null;
}

function asTarget(value: string | null): Target {
  if (value === "macos" || value === "windows" || value === "linux") return value;
  console.error(
    `[build-binary] invalid --target. expected macos|windows|linux, got: ${
      value ?? "<missing>"
    }`
  );
  process.exit(1);
}

function asFormat(value: string | null): Format {
  if (value === "raw" || value === "installer") return value;
  console.error(
    `[build-binary] invalid --format. expected raw|installer, got: ${
      value ?? "<missing>"
    }`
  );
  process.exit(1);
}

function asMode(value: string | null): Mode {
  if (value === null) return "plan";
  if (value === "plan" || value === "build") return value;
  console.error(`[build-binary] invalid --mode. expected plan|build, got: ${value}`);
  process.exit(1);
}

function writePlanFile(filePath: string, contents: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents, "utf8");
}

function readPackageVersion(): string {
  const packageJsonPath = path.resolve("package.json");
  const raw = readFileSync(packageJsonPath, "utf8");
  const parsed = JSON.parse(raw) as { version?: string };
  return parsed.version ?? "0.0.0";
}

function readReleaseTargets(): ReleaseTargetsFile | null {
  const metadataPath = path.resolve("packaging", "release-targets.json");
  try {
    const raw = readFileSync(metadataPath, "utf8");
    const parsed = JSON.parse(raw) as ReleaseTargetsFile;
    if (!Array.isArray(parsed.targets)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function releaseTargetIdFor(target: Target): string {
  if (target === "macos") return "binary-macos";
  if (target === "windows") return "binary-windows";
  return "binary-linux";
}

function resolveOutputDirs(target: Target): OutputDirs {
  const defaults: OutputDirs = {
    rawDir: path.resolve("dist", "bin", target),
    installerDir: path.resolve("dist", "installers")
  };

  const releaseTargets = readReleaseTargets();
  if (!releaseTargets) return defaults;

  const targetId = releaseTargetIdFor(target);
  const metadata = releaseTargets.targets.find((entry) => entry.id === targetId);
  if (!metadata) return defaults;

  return {
    rawDir: metadata.outputDir ? path.resolve(metadata.outputDir) : defaults.rawDir,
    installerDir: metadata.installerOutputDir
      ? path.resolve(metadata.installerOutputDir)
      : defaults.installerDir
  };
}

function binaryNameFor(target: Target): string {
  return target === "windows" ? "tadoi.exe" : "tadoi";
}

function binaryPathFor(target: Target, outputDirs: OutputDirs): string {
  return path.resolve(outputDirs.rawDir, binaryNameFor(target));
}

function hostTarget(): Target {
  if (process.platform === "darwin") return "macos";
  if (process.platform === "win32") return "windows";
  return "linux";
}

function runOrThrow(command: string, args: string[]): void {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env
  });

  if (result.status !== 0) {
    throw new Error(
      `[build-binary] command failed (${result.status ?? "unknown"}): ${command} ${args.join(
        " "
      )}`
    );
  }
}

function buildRawBinary(target: Target, outputDirs: OutputDirs): string {
  const outPath = binaryPathFor(target, outputDirs);
  mkdirSync(path.dirname(outPath), { recursive: true });

  const entry = path.resolve("src", "cli.ts");
  console.log(`[build-binary] compiling ${target} binary: ${outPath}`);
  runOrThrow("bun", ["build", entry, "--compile", "--outfile", outPath]);
  return outPath;
}

function ensureRawBinary(target: Target, outputDirs: OutputDirs): string {
  const outPath = binaryPathFor(target, outputDirs);
  if (!existsSync(outPath)) {
    return buildRawBinary(target, outputDirs);
  }
  return outPath;
}

function buildMacInstaller(binaryPath: string, version: string, outputDirs: OutputDirs): void {
  const pkgScript = path.resolve("packaging", "macos", "build-pkg.sh");
  const signScript = path.resolve("packaging", "macos", "sign-notarize.sh");
  const dmgScript = path.resolve("packaging", "macos", "build-dmg.sh");
  const identifier = "com.tadoi.cli";

  runOrThrow("bash", [
    pkgScript,
    "--binary",
    binaryPath,
    "--version",
    version,
    "--identifier",
    identifier,
    "--out-dir",
    outputDirs.installerDir
  ]);

  const pkgPath = path.resolve(outputDirs.installerDir, `TADOI-${version}.pkg`);
  runOrThrow("bash", [signScript, "--pkg", pkgPath]);

  runOrThrow("bash", [
    dmgScript,
    "--pkg",
    pkgPath,
    "--version",
    version,
    "--out-dir",
    outputDirs.installerDir
  ]);
}

function buildWindowsInstaller(binaryPath: string, version: string, outputDirs: OutputDirs): void {
  const buildScript = path.resolve("packaging", "windows", "build-installer.ps1");
  const signScript = path.resolve("packaging", "windows", "sign.ps1");
  const installerPath = path.resolve(
    outputDirs.installerDir,
    `TADOI-Setup-x64-${version}.exe`
  );

  runOrThrow("powershell", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    buildScript,
    "-BinaryPath",
    binaryPath,
    "-Version",
    version,
    "-InstallerDir",
    outputDirs.installerDir
  ]);

  runOrThrow("powershell", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    signScript,
    "-FilePath",
    installerPath
  ]);
}

function buildLinuxInstallers(binaryPath: string, version: string, outputDirs: OutputDirs): void {
  const debScript = path.resolve("packaging", "linux", "build-deb.sh");
  const appImageScript = path.resolve("packaging", "linux", "build-appimage.sh");

  runOrThrow("bash", [
    debScript,
    "--binary",
    binaryPath,
    "--version",
    version,
    "--out-dir",
    outputDirs.installerDir
  ]);

  runOrThrow("bash", [
    appImageScript,
    "--binary",
    binaryPath,
    "--version",
    version,
    "--out-dir",
    outputDirs.installerDir
  ]);
}

function writeRawPlan(target: Target, timestamp: string, outputDirs: OutputDirs): void {
  const filePath = path.resolve(outputDirs.rawDir, "BUILD_PLAN.txt");
  writePlanFile(
    filePath,
    [
      "TADOI binary build plan",
      `Target: ${target}`,
      "Format: raw",
      `Generated: ${timestamp}`,
      "",
      "This is a plan-mode output only.",
      "No native binary is produced in plan mode.",
      "Run with --mode build to emit a real binary."
    ].join("\n")
  );
  console.log(`[build-binary] scaffold written: ${filePath}`);
}

function writeInstallerPlan(target: Target, timestamp: string, outputDirs: OutputDirs): void {
  const filePath = path.resolve(
    outputDirs.installerDir,
    `${target.toUpperCase()}_INSTALLER_PLAN.txt`
  );
  const plannedOutput =
    target === "macos"
      ? "- .dmg"
      : target === "windows"
        ? "- .exe/.msi"
        : "- .AppImage/.deb";

  writePlanFile(
    filePath,
    [
      "TADOI installer build plan",
      `Target: ${target}`,
      "Format: installer",
      `Generated: ${timestamp}`,
      "",
      "This is a plan-mode output only.",
      "No installer is produced in plan mode.",
      "Planned outputs:",
      plannedOutput,
      "",
      "Run with --mode build to generate installer artifacts.",
      "See packaging docs for signing/notarization prerequisites."
    ].join("\n")
  );
  console.log(`[build-binary] installer scaffold written: ${filePath}`);
}

function main(): void {
  const target = asTarget(parseArg("--target"));
  const format = asFormat(parseArg("--format"));
  const mode = asMode(parseArg("--mode"));
  const timestamp = new Date().toISOString();
  const outputDirs = resolveOutputDirs(target);

  if (mode === "plan") {
    if (format === "raw") {
      writeRawPlan(target, timestamp, outputDirs);
      return;
    }

    writeInstallerPlan(target, timestamp, outputDirs);
    return;
  }

  assertStrictSigningPrerequisites(target, format, mode);

  const version = readPackageVersion();
  const currentHostTarget = hostTarget();
  if (currentHostTarget !== target) {
    console.error(
      `[build-binary] --mode build requires native host. target=${target}, host=${currentHostTarget}`
    );
    process.exit(1);
  }

  if (format === "raw") {
    const binaryPath = buildRawBinary(target, outputDirs);
    console.log(`[build-binary] built: ${binaryPath}`);
    return;
  }

  const binaryPath = ensureRawBinary(target, outputDirs);
  mkdirSync(outputDirs.installerDir, { recursive: true });

  if (target === "macos") {
    buildMacInstaller(binaryPath, version, outputDirs);
  } else if (target === "windows") {
    buildWindowsInstaller(binaryPath, version, outputDirs);
  } else {
    buildLinuxInstallers(binaryPath, version, outputDirs);
  }

  console.log(`[build-binary] installer build complete: ${outputDirs.installerDir}`);
}

main();
