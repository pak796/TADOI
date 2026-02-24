import { promises as fs } from "fs";
import path from "path";

type LcovRecord = {
  sourceFile: string;
  linesFound: number;
  linesHit: number;
  functionsFound: number;
  functionsHit: number;
};

type CoverageCheckOptions = {
  lcovFile: string;
  file: string;
  minLines: number;
  minFunctions: number;
};

function normalizeFilePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function parseFloatOrThrow(raw: string, flag: string): number {
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new Error(`${flag} must be a number between 0 and 100.`);
  }
  return parsed;
}

export function parseArgs(argv: string[]): CoverageCheckOptions {
  const options: CoverageCheckOptions = {
    lcovFile: "coverage/lcov.info",
    file: "src/app/App.tsx",
    minLines: 45,
    minFunctions: 40
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === "--lcov-file" && next) {
      options.lcovFile = next;
      index += 1;
      continue;
    }
    if (token === "--file" && next) {
      options.file = next;
      index += 1;
      continue;
    }
    if (token === "--min-lines" && next) {
      options.minLines = parseFloatOrThrow(next, "--min-lines");
      index += 1;
      continue;
    }
    if (token === "--min-functions" && next) {
      options.minFunctions = parseFloatOrThrow(next, "--min-functions");
      index += 1;
      continue;
    }
    if (token === "--help") {
      throw new Error(
        "Usage: bun scripts/check-app-shell-coverage.ts " +
          "[--lcov-file <path>] [--file <path>] [--min-lines <0-100>] [--min-functions <0-100>]"
      );
    }
    if (token.startsWith("--")) {
      throw new Error(`Unknown option: ${token}`);
    }
  }

  return options;
}

export function parseLcov(content: string): LcovRecord[] {
  const records: LcovRecord[] = [];
  let sourceFile: string | null = null;
  let linesFound = 0;
  let linesHit = 0;
  let functionsFound = 0;
  let functionsHit = 0;
  let seenLineData = false;
  let seenFunctionData = false;

  const flush = () => {
    if (!sourceFile) return;
    records.push({
      sourceFile,
      linesFound,
      linesHit,
      functionsFound,
      functionsHit
    });
  };

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("SF:")) {
      flush();
      sourceFile = line.slice(3);
      linesFound = 0;
      linesHit = 0;
      functionsFound = 0;
      functionsHit = 0;
      seenLineData = false;
      seenFunctionData = false;
      continue;
    }

    if (line === "end_of_record") {
      flush();
      sourceFile = null;
      continue;
    }

    if (!sourceFile) {
      continue;
    }

    if (line.startsWith("DA:")) {
      const data = line.slice(3).split(",");
      const hits = Number.parseInt(data[1] ?? "0", 10);
      linesFound += 1;
      if (Number.isFinite(hits) && hits > 0) {
        linesHit += 1;
      }
      seenLineData = true;
      continue;
    }

    if (line.startsWith("LF:")) {
      linesFound = Number.parseInt(line.slice(3), 10) || 0;
      continue;
    }

    if (line.startsWith("LH:")) {
      linesHit = Number.parseInt(line.slice(3), 10) || 0;
      continue;
    }

    if (line.startsWith("FNDA:")) {
      const data = line.slice(5).split(",");
      const hits = Number.parseInt(data[0] ?? "0", 10);
      functionsFound += 1;
      if (Number.isFinite(hits) && hits > 0) {
        functionsHit += 1;
      }
      seenFunctionData = true;
      continue;
    }

    if (line.startsWith("FNF:") && !seenFunctionData) {
      functionsFound = Number.parseInt(line.slice(4), 10) || 0;
      continue;
    }

    if (line.startsWith("FNH:") && !seenFunctionData) {
      functionsHit = Number.parseInt(line.slice(4), 10) || 0;
      continue;
    }
  }

  flush();
  return records;
}

export function findLcovRecord(
  records: LcovRecord[],
  targetPath: string,
  cwd: string = process.cwd()
): LcovRecord | undefined {
  const absoluteTarget = normalizeFilePath(path.resolve(cwd, targetPath));
  const relativeTarget = normalizeFilePath(targetPath).replace(/^\.\//, "");

  for (const record of records) {
    const normalizedRecord = normalizeFilePath(record.sourceFile);
    const absoluteRecord = normalizeFilePath(path.resolve(cwd, normalizedRecord));
    const relativeRecord = normalizeFilePath(path.relative(cwd, absoluteRecord));
    if (
      absoluteRecord === absoluteTarget ||
      relativeRecord === relativeTarget ||
      relativeRecord.endsWith(`/${relativeTarget}`)
    ) {
      return record;
    }
  }

  return undefined;
}

function toPercent(covered: number, total: number): number {
  if (total <= 0) return 100;
  return (covered / total) * 100;
}

export async function checkCoverage(options: CoverageCheckOptions): Promise<number> {
  const lcovPath = path.resolve(options.lcovFile);
  const content = await fs.readFile(lcovPath, "utf8");
  const records = parseLcov(content);
  const record = findLcovRecord(records, options.file);

  if (!record) {
    console.error(`[app-shell-coverage] coverage record not found for ${options.file}`);
    return 2;
  }

  const linePct = toPercent(record.linesHit, record.linesFound);
  const functionPct = toPercent(record.functionsHit, record.functionsFound);
  const summary =
    `[app-shell-coverage] file=${options.file} ` +
    `lines=${linePct.toFixed(2)}% (${record.linesHit}/${record.linesFound}) ` +
    `funcs=${functionPct.toFixed(2)}% (${record.functionsHit}/${record.functionsFound})`;

  if (linePct < options.minLines || functionPct < options.minFunctions) {
    console.error(summary);
    console.error(
      `[app-shell-coverage] FAIL: minimum lines=${options.minLines.toFixed(
        2
      )}% funcs=${options.minFunctions.toFixed(2)}%`
    );
    return 1;
  }

  console.log(summary);
  console.log(
    `[app-shell-coverage] PASS: minimum lines=${options.minLines.toFixed(
      2
    )}% funcs=${options.minFunctions.toFixed(2)}%`
  );
  return 0;
}

async function main(): Promise<void> {
  try {
    const options = parseArgs(process.argv.slice(2));
    const exitCode = await checkCoverage(options);
    process.exitCode = exitCode;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[app-shell-coverage] ${message}`);
    process.exitCode = 2;
  }
}

if (import.meta.main) {
  void main();
}
