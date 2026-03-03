import path from "node:path";
import { promises as fs } from "node:fs";

const APP_SHELL_COVERAGE_TEST_FILES = [
  "src/app/App.modalFlow.integration.test.ts",
  "src/app/App.tits.integration.test.ts",
  "src/app/App.tome.integration.test.ts",
  "src/app/App.bulk.integration.test.ts"
] as const;

async function main(): Promise<void> {
  const cwd = path.resolve(".");
  const coverageDir = path.join(cwd, "coverage");
  await fs.rm(coverageDir, { recursive: true, force: true });

  const absoluteFiles = APP_SHELL_COVERAGE_TEST_FILES.map((filePath) =>
    path.resolve(cwd, filePath)
  );

  const child = Bun.spawn({
    cmd: [
      process.execPath,
      "test",
      "--coverage",
      "--coverage-reporter=text",
      "--coverage-reporter=lcov",
      "--coverage-dir",
      coverageDir,
      ...absoluteFiles
    ],
    cwd,
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit"
  });

  const exitCode = await child.exited;
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[test-coverage-app-shell] ${detail}`);
    process.exit(1);
  });
}
