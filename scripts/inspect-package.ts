import { spawnSync } from "node:child_process";

const REQUIRED_FILES = [
  "package.json",
  "README.md",
  "bin/tadoi.js",
  "src/index.tsx",
  "src/brand/brand.ts",
];

const FORBIDDEN_PATH_PATTERNS: RegExp[] = [
  /^tadoi_data\.json$/,
  /^tadoi_data_.*\.json$/,
  /^TADOI_SPEC.*$/,
  /^TADOI_TASKS.*$/,
];

function fail(message: string): never {
  console.error(`[pack:inspect] ${message}`);
  process.exit(1);
}

function runPackDryRun(): { filename: string; files: string[] } {
  const result = spawnSync("bun", ["pm", "pack", "--dry-run"], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    fail(`bun pm pack --dry-run failed\n${result.stderr || result.stdout}`);
  }

  const stdout = result.stdout;
  const files: string[] = [];
  let filename = "";
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const packedMatch = /^packed\s+\S+\s+(.+)$/.exec(trimmed);
    if (packedMatch) {
      files.push(packedMatch[1]);
      continue;
    }
    if (trimmed.endsWith(".tgz")) {
      filename = trimmed;
    }
  }

  if (files.length === 0) {
    fail("pack dry-run did not report packaged files");
  }
  if (!filename) {
    fail("pack dry-run did not report tarball filename");
  }

  return { filename, files };
}

function main(): void {
  const info = runPackDryRun();
  const fileSet = new Set(info.files);

  for (const requiredFile of REQUIRED_FILES) {
    if (!fileSet.has(requiredFile)) {
      fail(`required package file is missing: ${requiredFile}`);
    }
  }

  const forbiddenMatches = info.files.filter((filePath) =>
    FORBIDDEN_PATH_PATTERNS.some((pattern) => pattern.test(filePath)),
  );

  if (forbiddenMatches.length > 0) {
    fail(`forbidden files detected in package: ${forbiddenMatches.join(", ")}`);
  }

  console.log("[pack:inspect] package dry-run looks valid");
  console.log(`[pack:inspect] filename: ${info.filename}`);
  console.log(`[pack:inspect] entry count: ${info.files.length}`);
}

main();
