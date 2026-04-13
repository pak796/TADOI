import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const DASHBOARD_SPEC_PATH = "DASHBOARD_SPEC_MVP.md";
const README_PATH = "README.md";
const SPEC_PATH_ENV = "TADOI_SPEC_PATH";
const SKIP_DIRS = new Set([".git", "node_modules", "dist", "coverage"]);
const TEST_FILE_PATTERN = /\.test\.(ts|tsx)$/;
const DTF_SPEC_ROW_PATTERN = /^\|\s*(DTF-\d{3})\s*\|/gm;
const TEST_CASE_NAME_PATTERN = /\b(?:it|test)\s*\(\s*(["'`])([\s\S]*?)\1/gm;
const README_SPEC_LINK_PATTERN = /`(TADOI_SPEC_v\d+\.\d+\.\d+\.md)`/;
const SPEC_FILENAME_PATTERN = /^TADOI_SPEC_v(\d+)\.(\d+)\.(\d+)\.md$/;

function normalizeDtfIds(ids: Iterable<string>): string[] {
  return Array.from(new Set(ids)).sort();
}

export function extractDtfIdsFromSpec(markdown: string): string[] {
  const ids: string[] = [];
  let match: RegExpExecArray | null = DTF_SPEC_ROW_PATTERN.exec(markdown);
  while (match) {
    ids.push(match[1] ?? "");
    match = DTF_SPEC_ROW_PATTERN.exec(markdown);
  }
  DTF_SPEC_ROW_PATTERN.lastIndex = 0;
  return normalizeDtfIds(ids);
}

export function extractDtfIdsFromTestCaseNames(source: string): string[] {
  const ids: string[] = [];
  let nameMatch: RegExpExecArray | null = TEST_CASE_NAME_PATTERN.exec(source);
  while (nameMatch) {
    const testName = nameMatch[2] ?? "";
    const idMatches = testName.match(/DTF-\d{3}/g) ?? [];
    for (const id of idMatches) {
      ids.push(id);
    }
    nameMatch = TEST_CASE_NAME_PATTERN.exec(source);
  }
  TEST_CASE_NAME_PATTERN.lastIndex = 0;
  return normalizeDtfIds(ids);
}

export function extractCurrentSpecPathFromReadme(
  readme: string,
): string | null {
  const match = README_SPEC_LINK_PATTERN.exec(readme);
  README_SPEC_LINK_PATTERN.lastIndex = 0;
  return match?.[1] ?? null;
}

function compareVersionTriples(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return a[1] - b[1];
  return a[2] - b[2];
}

function parseSpecVersion(filename: string): [number, number, number] | null {
  const match = SPEC_FILENAME_PATTERN.exec(filename);
  SPEC_FILENAME_PATTERN.lastIndex = 0;
  if (!match) return null;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (
    !Number.isInteger(major) ||
    !Number.isInteger(minor) ||
    !Number.isInteger(patch)
  ) {
    return null;
  }
  return [major, minor, patch];
}

async function resolveSpecPathFromFallback(
  rootDir: string,
): Promise<string | null> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const specFiles = entries
    .filter((entry) => entry.isFile() && SPEC_FILENAME_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .map((filename) => ({ filename, version: parseSpecVersion(filename) }))
    .filter(
      (
        candidate,
      ): candidate is { filename: string; version: [number, number, number] } =>
        candidate.version !== null,
    )
    .sort((a, b) => compareVersionTriples(b.version, a.version));
  return specFiles[0]?.filename ?? null;
}

type DriftCheckEnv = NodeJS.ProcessEnv | Record<string, string | undefined>;

async function resolveCurrentSpecPath(
  rootDir: string,
  env: DriftCheckEnv,
): Promise<string> {
  const envSpecPath = env[SPEC_PATH_ENV];
  if (envSpecPath && envSpecPath.trim().length > 0) {
    const candidate = envSpecPath.trim();
    const absolute = path.join(rootDir, candidate);
    await fs.access(absolute);
    return candidate;
  }

  const readmePath = path.join(rootDir, README_PATH);
  const readme = await fs.readFile(readmePath, "utf8");
  const currentSpecFromReadme = extractCurrentSpecPathFromReadme(readme);
  if (currentSpecFromReadme) {
    const absolute = path.join(rootDir, currentSpecFromReadme);
    await fs.access(absolute);
    return currentSpecFromReadme;
  }

  const fallbackSpecPath = await resolveSpecPathFromFallback(rootDir);
  if (fallbackSpecPath) {
    return fallbackSpecPath;
  }

  throw new Error(
    `[dtf-contract] Could not resolve current product spec from ${README_PATH}, ${SPEC_PATH_ENV}, or TADOI_SPEC_v*.md files.`,
  );
}

export function computeMissingDtfIds(
  specIds: Iterable<string>,
  coveredIds: Iterable<string>,
): string[] {
  const covered = new Set(coveredIds);
  return normalizeDtfIds(specIds).filter((id) => !covered.has(id));
}

async function collectTestFiles(
  dirPath: string,
  files: string[],
): Promise<void> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await collectTestFiles(fullPath, files);
      continue;
    }
    if (TEST_FILE_PATTERN.test(entry.name)) {
      files.push(fullPath);
    }
  }
}

async function resolveSpecFiles(
  rootDir: string,
  env: DriftCheckEnv,
): Promise<string[]> {
  const currentSpec = await resolveCurrentSpecPath(rootDir, env);
  const candidates = [currentSpec, DASHBOARD_SPEC_PATH];
  const resolved: string[] = [];
  for (const candidate of candidates) {
    const absolute = path.join(rootDir, candidate);
    await fs.access(absolute);
    resolved.push(candidate);
  }

  return normalizeDtfIds(resolved);
}

type DriftResult = {
  specFiles: string[];
  testFilesScanned: number;
  specIds: string[];
  coveredIds: string[];
  missingIds: string[];
  sourcesById: Map<string, string[]>;
};

export async function runDtfContractDriftCheck(
  rootDir = ROOT_DIR,
  env: DriftCheckEnv = process.env,
): Promise<DriftResult> {
  const specFiles = await resolveSpecFiles(rootDir, env);
  const sourcesById = new Map<string, string[]>();
  for (const specFile of specFiles) {
    const specPath = path.join(rootDir, specFile);
    const markdown = await fs.readFile(specPath, "utf8");
    const ids = extractDtfIdsFromSpec(markdown);
    for (const id of ids) {
      const existing = sourcesById.get(id) ?? [];
      sourcesById.set(id, normalizeDtfIds([...existing, specFile]));
    }
  }

  const specIds = normalizeDtfIds(sourcesById.keys());
  if (specIds.length === 0) {
    throw new Error("[dtf-contract] No DTF-* rows found in spec tables.");
  }

  const testFiles: string[] = [];
  await collectTestFiles(path.join(rootDir, "src"), testFiles);
  const covered = new Set<string>();
  for (const testFile of testFiles) {
    const source = await fs.readFile(testFile, "utf8");
    const ids = extractDtfIdsFromTestCaseNames(source);
    for (const id of ids) {
      covered.add(id);
    }
  }

  const coveredIds = normalizeDtfIds(covered);
  const missingIds = computeMissingDtfIds(specIds, coveredIds);
  return {
    specFiles,
    testFilesScanned: testFiles.length,
    specIds,
    coveredIds,
    missingIds,
    sourcesById,
  };
}

async function main(): Promise<void> {
  const result = await runDtfContractDriftCheck(ROOT_DIR);

  if (result.missingIds.length > 0) {
    console.error("[dtf-contract] Missing test case coverage for spec IDs:");
    for (const id of result.missingIds) {
      const sources = result.sourcesById.get(id) ?? [];
      const sourceLabel = sources.length > 0 ? sources.join(", ") : "unknown";
      console.error(`- ${id} (spec: ${sourceLabel})`);
    }
    console.error(
      '[dtf-contract] Add matching test case names, e.g. it("DTF-001: ...", ...).',
    );
    process.exit(1);
  }

  console.log(
    `[dtf-contract] OK: ${result.specIds.length} DTF IDs from ${result.specFiles.join(
      ", ",
    )} are covered by named test cases in ${result.testFilesScanned} test files.`,
  );
}

if (import.meta.main) {
  void main().catch((error: unknown) => {
    console.error(
      `[dtf-contract] Check failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exit(1);
  });
}
