import { importCalendarIcs } from "../src/state/calendarImportService";

type HarnessArgs = {
  inputPath: string;
  range: "next7" | "month" | "all";
  mode: "merge" | "update" | "create";
  dryRun: boolean;
  reportPath?: string;
};

function usage(): void {
  console.log("Usage:");
  console.log("  bun scripts/calendar-import-harness.ts --in <path> [options]");
  console.log("");
  console.log("Options:");
  console.log("  --in <path>                 Input .ics file (required)");
  console.log("  --range <next7|month|all>  Default: next7");
  console.log("  --mode <merge|update|create> Default: merge");
  console.log("  --dry-run                  Do not persist imported state");
  console.log("  --report <path>            Optional JSON report output");
}

function parseArgs(argv: string[]): HarnessArgs | null {
  let inputPath = "";
  let range: HarnessArgs["range"] = "next7";
  let mode: HarnessArgs["mode"] = "merge";
  let dryRun = false;
  let reportPath: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      usage();
      return null;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--in") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        throw new Error("--in requires a value");
      }
      inputPath = next;
      i += 1;
      continue;
    }
    if (arg === "--range") {
      const next = argv[i + 1];
      if (!next || !["next7", "month", "all"].includes(next)) {
        throw new Error("--range must be next7, month, or all");
      }
      range = next as HarnessArgs["range"];
      i += 1;
      continue;
    }
    if (arg === "--mode") {
      const next = argv[i + 1];
      if (!next || !["merge", "update", "create"].includes(next)) {
        throw new Error("--mode must be merge, update, or create");
      }
      mode = next as HarnessArgs["mode"];
      i += 1;
      continue;
    }
    if (arg === "--report") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        throw new Error("--report requires a value");
      }
      reportPath = next;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!inputPath.trim()) {
    throw new Error("--in is required");
  }

  return { inputPath, range, mode, dryRun, ...(reportPath ? { reportPath } : {}) };
}

async function main(): Promise<number> {
  let parsed: HarnessArgs | null = null;
  try {
    parsed = parseArgs(process.argv.slice(2));
    if (!parsed) {
      return 0;
    }
  } catch (error: unknown) {
    console.error(
      `[calendar-import-harness] ${error instanceof Error ? error.message : String(error)}`
    );
    usage();
    return 1;
  }

  try {
    const result = await importCalendarIcs(parsed);
    console.log(`[calendar-import-harness] parsed: ${result.summary.eventsParsed}`);
    console.log(`[calendar-import-harness] created: ${result.summary.created}`);
    console.log(`[calendar-import-harness] updated: ${result.summary.updated}`);
    console.log(`[calendar-import-harness] merged: ${result.summary.merged}`);
    console.log(`[calendar-import-harness] skipped: ${result.summary.skipped}`);
    console.log(`[calendar-import-harness] errors: ${result.summary.errors}`);
    console.log(`[calendar-import-harness] persisted: ${String(result.report.persisted)}`);
    if (result.outputReportPath) {
      console.log(`[calendar-import-harness] report: ${result.outputReportPath}`);
    }
    return result.hasErrors ? 1 : 0;
  } catch (error: unknown) {
    console.error(
      `[calendar-import-harness] ${error instanceof Error ? error.message : String(error)}`
    );
    return 2;
  }
}

if (import.meta.main) {
  process.exitCode = await main();
}
