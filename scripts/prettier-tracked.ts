import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const SUPPORTED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".yml",
  ".yaml"
]);

const EXCLUDED_PREFIXES = [
  "dist.prepack.20260303-133353/",
  "dist/",
  "build/",
  "coverage/",
  "node_modules/",
  ".cache/",
  ".turbo/"
] as const;

const PRETTIER_BATCH_SIZE = 100;

type Mode = "--check" | "--write";

function fail(message: string): never {
  console.error(`[prettier-tracked] ${message}`);
  process.exit(1);
}

function parseMode(argv: string[]): Mode {
  const hasCheck = argv.includes("--check");
  const hasWrite = argv.includes("--write");
  if (hasCheck === hasWrite) {
    fail("pass exactly one mode: --check or --write");
  }
  return hasWrite ? "--write" : "--check";
}

function runGitTrackedFiles(): string[] {
  const result = spawnSync("git", ["ls-files", "-z"], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (result.status !== 0) {
    fail(result.stderr.trim() || "git ls-files failed");
  }
  return result.stdout.split("\0").filter(Boolean);
}

function shouldFormat(filePath: string): boolean {
  if (EXCLUDED_PREFIXES.some((prefix) => filePath.startsWith(prefix))) {
    return false;
  }
  return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function resolvePrettierBin(): string {
  const prettierBin = path.resolve(
    "node_modules",
    ".bin",
    process.platform === "win32" ? "prettier.cmd" : "prettier"
  );
  if (!existsSync(prettierBin)) {
    fail("local prettier binary not found. Run bun install.");
  }
  return prettierBin;
}

function runPrettier(mode: Mode, files: string[]): void {
  const prettierBin = resolvePrettierBin();
  for (let index = 0; index < files.length; index += PRETTIER_BATCH_SIZE) {
    const batch = files.slice(index, index + PRETTIER_BATCH_SIZE);
    const result = spawnSync(
      prettierBin,
      ["--ignore-path", ".prettierignore", mode, ...batch],
      {
        cwd: process.cwd(),
        stdio: "inherit"
      }
    );
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}

function main(): void {
  const mode = parseMode(process.argv.slice(2));
  const files = runGitTrackedFiles().filter(shouldFormat);
  if (files.length === 0) {
    console.log("[prettier-tracked] no tracked files matched");
    return;
  }
  runPrettier(mode, files);
}

main();
