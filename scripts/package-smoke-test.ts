import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";

const DIST_TARBALL_DIR = path.resolve("dist/tarball");
const EXPECTED_HELP_TOKENS = [
  "TADOI",
  "Terminal Accessible Digital Organization Interface",
  "Usage: tadoi [options]",
];

function runOrFail(command: string, args: string[], cwd?: string): string {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      TMPDIR: "/tmp",
    },
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    console.error(`[pack:smoke] command failed: ${command} ${args.join(" ")}`);
    console.error(output);
    process.exit(1);
  }

  return result.stdout;
}

function getNewestTarballPath(): string | null {
  try {
    const entries = readdirSync(DIST_TARBALL_DIR)
      .filter((entry) => entry.endsWith(".tgz"))
      .map((entry) => path.join(DIST_TARBALL_DIR, entry));

    if (entries.length === 0) return null;

    entries.sort((left, right) => {
      const leftTime = statSync(left).mtimeMs;
      const rightTime = statSync(right).mtimeMs;
      return rightTime - leftTime;
    });

    return entries[0];
  } catch {
    return null;
  }
}

function resolveTarballPath(): string {
  let tarballPath = getNewestTarballPath();
  if (tarballPath) return tarballPath;

  mkdirSync(DIST_TARBALL_DIR, { recursive: true });
  runOrFail("bun", [
    "pm",
    "pack",
    "--destination",
    DIST_TARBALL_DIR,
    "--quiet",
  ]);
  tarballPath = getNewestTarballPath();
  if (!tarballPath) {
    console.error("[pack:smoke] unable to locate tarball after pack");
    process.exit(1);
  }

  return tarballPath;
}

function main(): void {
  const tarballPath = resolveTarballPath();
  const smokeBaseDir = path.resolve("dist");
  mkdirSync(smokeBaseDir, { recursive: true });
  const tempRoot = mkdtempSync(path.join(smokeBaseDir, "pack-smoke-"));

  try {
    runOrFail("tar", ["-xzf", tarballPath, "-C", tempRoot]);

    const extractedPackageDir = path.join(tempRoot, "package");
    const cliEntry = path.join(extractedPackageDir, "bin", "tadoi.js");
    const helpOutput = runOrFail(
      "bun",
      [cliEntry, "--help"],
      extractedPackageDir,
    );

    for (const expectedToken of EXPECTED_HELP_TOKENS) {
      if (!helpOutput.includes(expectedToken)) {
        console.error(
          `[pack:smoke] expected help output to include: ${expectedToken}`,
        );
        process.exit(1);
      }
    }

    console.log("[pack:smoke] tarball install and CLI help check passed");
    console.log(`[pack:smoke] tarball: ${tarballPath}`);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

main();
