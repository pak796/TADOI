import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, copyFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import crypto from "node:crypto";

type Target = "macos" | "windows" | "linux";

type ArtifactRecord = {
  target: Target;
  path: string;
  sizeBytes: number;
  sha256: string;
};

type BuildNote = {
  target: Target;
  mode: "build" | "plan";
  note: string;
};

function hostTarget(): Target {
  if (process.platform === "darwin") return "macos";
  if (process.platform === "win32") return "windows";
  return "linux";
}

function readPackageVersion(): string {
  const raw = readFileSync(path.resolve("package.json"), "utf8");
  const parsed = JSON.parse(raw) as { version?: string };
  return parsed.version ?? "0.0.0";
}

function formatLocalDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(date);
}

type RunResult = { ok: boolean; error?: string };

function runSafe(command: string, args: string[]): RunResult {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    return {
      ok: false,
      error: `[build-daily] command failed (${result.status ?? "unknown"}): ${command} ${args.join(" ")}`
    };
  }
  return { ok: true };
}

function sha256(filePath: string): string {
  const hash = crypto.createHash("sha256");
  const data = readFileSync(filePath);
  hash.update(data);
  return hash.digest("hex");
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function copyIfExists(source: string, destDir: string): ArtifactRecord | null {
  if (!existsSync(source)) return null;
  ensureDir(destDir);
  const base = path.basename(source);
  const dest = path.join(destDir, base);
  copyFileSync(source, dest);
  const stats = statSync(dest);
  return {
    target: hostTarget(),
    path: dest,
    sizeBytes: stats.size,
    sha256: sha256(dest)
  };
}

function gatherHostArtifacts(version: string, target: Target, artifactDir: string): ArtifactRecord[] {
  const artifacts: ArtifactRecord[] = [];
  const rawBinary = target === "windows"
    ? path.resolve("dist", "bin", "windows", "tadoi.exe")
    : path.resolve("dist", "bin", target, "tadoi");

  const rawRecord = copyIfExists(rawBinary, artifactDir);
  if (rawRecord) {
    rawRecord.target = target;
    artifacts.push(rawRecord);
  }

  const installers: string[] = [];
  if (target === "macos") {
    installers.push(path.resolve("dist", "installers", `TADOI-${version}.pkg`));
    installers.push(path.resolve("dist", "installers", `TADOI-macOS-${version}.dmg`));
  } else if (target === "windows") {
    installers.push(path.resolve("dist", "installers", `TADOI-Setup-x64-${version}.exe`));
  } else {
    installers.push(path.resolve("dist", "installers", `tadoi_${version}_amd64.deb`));
    installers.push(path.resolve("dist", "installers", `tadoi-${version}-x86_64.AppImage`));
  }

  for (const file of installers) {
    const record = copyIfExists(file, artifactDir);
    if (record) {
      record.target = target;
      artifacts.push(record);
    }
  }

  return artifacts;
}

function gatherPlanArtifacts(target: Target, artifactDir: string): ArtifactRecord[] {
  const artifacts: ArtifactRecord[] = [];
  const planFiles = [
    path.resolve("dist", "bin", target, "BUILD_PLAN.txt"),
    path.resolve("dist", "installers", `${target.toUpperCase()}_INSTALLER_PLAN.txt`)
  ];
  for (const file of planFiles) {
    if (!existsSync(file)) continue;
    ensureDir(artifactDir);
    const dest = path.join(artifactDir, path.basename(file));
    copyFileSync(file, dest);
    const stats = statSync(dest);
    artifacts.push({
      target,
      path: dest,
      sizeBytes: stats.size,
      sha256: sha256(dest)
    });
  }
  return artifacts;
}

function readGitSha(): string {
  const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" });
  if (result.status !== 0) return "unknown";
  return (result.stdout || "").trim() || "unknown";
}

function writeReport(
  reportPath: string,
  version: string,
  sha: string,
  dateStamp: string,
  host: Target,
  artifacts: ArtifactRecord[],
  notes: BuildNote[]
): void {
  const lines: string[] = [];
  lines.push("# TADOI Daily Build Report");
  lines.push("");
  lines.push(`Date: ${dateStamp}`);
  lines.push(`Version: ${version}`);
  lines.push(`Git SHA: ${sha}`);
  lines.push(`Host: ${host}`);
  lines.push("");
  lines.push("## Artifacts");
  if (artifacts.length === 0) {
    lines.push("- None captured.");
  } else {
    for (const artifact of artifacts) {
      lines.push(`- ${artifact.target}: ${artifact.path}`);
      lines.push(`  size=${artifact.sizeBytes} sha256=${artifact.sha256}`);
    }
  }
  lines.push("");
  lines.push("## Notes");
  if (notes.length === 0) {
    lines.push("- None.");
  } else {
    for (const note of notes) {
      lines.push(`- ${note.target}: ${note.mode} (${note.note})`);
    }
  }

  writeFileSync(reportPath, lines.join("\n"), "utf8");
}

function main(): void {
  const version = readPackageVersion();
  const now = new Date();
  const dateStamp = formatLocalDate(now);
  const sha = readGitSha();
  const host = hostTarget();
  const artifactRoot = path.resolve("dist", "artifacts", dateStamp);

  ensureDir(artifactRoot);

  const targets: Target[] = ["macos", "windows", "linux"];
  const notes: BuildNote[] = [];
  let artifacts: ArtifactRecord[] = [];
  let failed = false;

  for (const target of targets) {
    if (target === host) {
      const rawResult = runSafe("bun", ["scripts/build-binary.ts", "--target", target, "--format", "raw", "--mode", "build"]);
      if (!rawResult.ok) {
        failed = true;
        notes.push({ target, mode: "build", note: rawResult.error ?? "raw build failed" });
        continue;
      }

      const installerResult = runSafe("bun", ["scripts/build-binary.ts", "--target", target, "--format", "installer", "--mode", "build"]);
      if (!installerResult.ok) {
        failed = true;
        notes.push({ target, mode: "build", note: installerResult.error ?? "installer build failed" });
      } else {
        notes.push({ target, mode: "build", note: "native build completed" });
      }

      const targetDir = path.join(artifactRoot, target);
      artifacts = artifacts.concat(gatherHostArtifacts(version, target, targetDir));
      continue;
    }

    const planRaw = runSafe("bun", ["scripts/build-binary.ts", "--target", target, "--format", "raw", "--mode", "plan"]);
    const planInstaller = runSafe("bun", ["scripts/build-binary.ts", "--target", target, "--format", "installer", "--mode", "plan"]);
    if (!planRaw.ok || !planInstaller.ok) {
      failed = true;
      notes.push({ target, mode: "plan", note: (planRaw.error || planInstaller.error || "plan build failed") });
    } else {
      notes.push({ target, mode: "plan", note: "cross-build skipped (native host required)" });
    }
    const targetDir = path.join(artifactRoot, target);
    artifacts = artifacts.concat(gatherPlanArtifacts(target, targetDir));
  }

  const reportPath = path.join(artifactRoot, "BUILD_REPORT.md");
  writeReport(reportPath, version, sha, dateStamp, host, artifacts, notes);
  console.log(`[build-daily] report written: ${reportPath}`);
  if (failed) process.exitCode = 1;
}

main();
