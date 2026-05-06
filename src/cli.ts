import {
  APP_NAME,
  APP_TAGLINE,
  CLI_NAME,
  ENV_VARS,
  getAsciiLogoLines
} from "./brand/brand";
import { APP_VERSION } from "./app/version";
import { runPortabilityCommand } from "./cli/portabilityCommands";
import { runCalendarCommand } from "./cli/calendarCommands";
import { runTitsCommandCli, TITS_CLI_EXIT_CODE } from "./cli/main";
import { runListCommand } from "./cli/listCommand";
import { runUninstallCommand } from "./cli/uninstallCommand";
import { runRemindersCommand } from "./cli/remindersCommands";
import { runRemindCommand } from "./reminders/remindCommand";
import { runTui, runTuiSmoke, type RunTuiOptions } from "./tui/runTui";
import { formatTadoiLockBusyMessage, TadoiLockBusyError } from "./state/lockfile";
import { redactedLogger } from "./logging/redactedLogger";

type CliOptions = {
  showLogo: boolean;
  showHelp: boolean;
  showVersion: boolean;
  smokeTui: boolean;
};

type RuntimeCliOptions = {
  interactive: boolean;
  json: boolean;
  quiet: boolean;
  noColor: boolean;
  dataFilePath?: string;
};

function detectNoColorEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env["NO_COLOR"];
  return typeof value === "string" && value.length > 0;
}

export type CliRoute =
  | { kind: "help"; showLogo: boolean }
  | { kind: "version" }
  | { kind: "smoke_tui" }
  | { kind: "list"; args: string[] }
  | { kind: "uninstall"; args: string[] }
  | { kind: "reminders"; args: string[] }
  | { kind: "remind"; args: string[] }
  | { kind: "portability"; command: "export" | "import"; args: string[] }
  | { kind: "calendar"; command: "export" | "import"; args: string[] }
  | { kind: "unknown"; token: string }
  | { kind: "tui"; showLogo: boolean };

type StructuredRunResult = {
  exitCode: number;
  data?: unknown;
};

type CliRunResult = number | StructuredRunResult | undefined;

export type CliRunDeps = {
  runPortability: (
    command: "export" | "import",
    args: string[]
  ) => Promise<number>;
  runCalendar: (command: "export" | "import", args: string[]) => Promise<number>;
  runList: (args: string[], options: { json: boolean }) => Promise<StructuredRunResult>;
  runUninstall: (args: string[]) => Promise<number>;
  runReminders: (args: string[]) => Promise<number>;
  runRemind: (args: string[]) => Promise<number>;
  runInteractiveTui: (options: RunTuiOptions) => Promise<void>;
  runSmokeTui: () => Promise<number>;
  printHelp: (showLogo: boolean) => void;
  printVersion: () => void;
};

function parseCliOptions(argv: string[]): CliOptions {
  let showHelp = false;
  let showLogo = true;
  let showVersion = false;
  let smokeTui = false;

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      showHelp = true;
      continue;
    }
    if (arg === "--no-logo") {
      showLogo = false;
      continue;
    }
    if (arg === "--version") {
      showVersion = true;
      continue;
    }
    if (arg === "--smoke-tui") {
      smokeTui = true;
    }
  }

  return { showHelp, showLogo, showVersion, smokeTui };
}

const CLI_ROUTE_ALIASES: Readonly<Record<string, string>> = {
  ls: "list",
  l: "list"
};

function normalizeCliCommandAlias(argv: string[]): string[] {
  if (argv.length === 0) return argv;
  if (argv[0] === "--uninstall") {
    return ["uninstall", ...argv.slice(1)];
  }
  const aliased = CLI_ROUTE_ALIASES[argv[0].toLowerCase()];
  if (aliased) {
    return [aliased, ...argv.slice(1)];
  }
  return argv;
}

function isCoreOptionToken(token: string): boolean {
  return (
    token === "--help" ||
    token === "-h" ||
    token === "--version" ||
    token === "--smoke-tui" ||
    token === "--no-logo"
  );
}

function parseRuntimeCliOptions(argv: string[]): {
  ok: true;
  argv: string[];
  runtime: RuntimeCliOptions;
} | {
  ok: false;
  error: string;
} {
  let interactive = false;
  let json = false;
  let quiet = false;
  let noColor = detectNoColorEnv();
  let dataFilePath: string | undefined;
  const nextArgv: string[] = [];
  let passthrough = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (passthrough) {
      nextArgv.push(arg);
      continue;
    }

    if (arg === "--") {
      passthrough = true;
      nextArgv.push(arg);
      continue;
    }
    if (arg === "--interactive") {
      interactive = true;
      continue;
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--quiet") {
      quiet = true;
      continue;
    }
    if (arg === "--no-color") {
      noColor = true;
      continue;
    }
    if (arg === "--data-file") {
      const next = argv[i + 1];
      if (next === undefined || next.length === 0) {
        return { ok: false, error: "--data-file requires a value" };
      }
      dataFilePath = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("--data-file=")) {
      const value = arg.slice("--data-file=".length);
      if (value.length === 0) {
        return { ok: false, error: "--data-file requires a value" };
      }
      dataFilePath = value;
      continue;
    }

    nextArgv.push(arg);
  }

  return {
    ok: true,
    argv: nextArgv,
    runtime: {
      interactive,
      json,
      quiet,
      noColor,
      ...(dataFilePath ? { dataFilePath } : {})
    }
  };
}

async function withDataFileOverride<T>(
  dataFilePath: string | undefined,
  run: () => Promise<T>
): Promise<T> {
  if (!dataFilePath) {
    return run();
  }
  const previous = process.env[ENV_VARS.DATA_PATH];
  process.env[ENV_VARS.DATA_PATH] = dataFilePath;
  try {
    return await run();
  } finally {
    if (previous === undefined) {
      delete process.env[ENV_VARS.DATA_PATH];
    } else {
      process.env[ENV_VARS.DATA_PATH] = previous;
    }
  }
}

async function withNoColorEnv<T>(
  noColor: boolean,
  run: () => Promise<T>
): Promise<T> {
  if (!noColor) {
    return run();
  }
  const previous = process.env["NO_COLOR"];
  if (previous === undefined || previous.length === 0) {
    process.env["NO_COLOR"] = "1";
  }
  try {
    return await run();
  } finally {
    if (previous === undefined) {
      delete process.env["NO_COLOR"];
    } else {
      process.env["NO_COLOR"] = previous;
    }
  }
}

function isStructuredRunResult(value: unknown): value is StructuredRunResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "exitCode" in value &&
    typeof (value as { exitCode?: unknown }).exitCode === "number"
  );
}

async function withOutputMode(
  runtime: RuntimeCliOptions,
  run: () => Promise<CliRunResult>
): Promise<number | undefined> {
  if (!runtime.json && !runtime.quiet) {
    const value = await run();
    if (isStructuredRunResult(value)) {
      return value.exitCode;
    }
    return value;
  }

  const stdout: string[] = [];
  const stderr: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  const lineify = (values: unknown[]): string => values.map((value) => String(value)).join(" ");

  console.log = (...values: unknown[]) => {
    if (runtime.json) {
      stdout.push(lineify(values));
      return;
    }
  };
  console.error = (...values: unknown[]) => {
    if (runtime.json) {
      stderr.push(lineify(values));
      return;
    }
    originalError(...values);
  };

  let value: CliRunResult = undefined;
  let thrown: unknown;
  try {
    value = await run();
  } catch (error: unknown) {
    thrown = error;
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  if (runtime.json) {
    const structured = isStructuredRunResult(value) ? value : undefined;
    const exitCode =
      thrown !== undefined
        ? TITS_CLI_EXIT_CODE.IO_ERROR
        : structured
          ? structured.exitCode
          : typeof value === "number"
            ? value
            : 0;
    if (thrown !== undefined) {
      stderr.push(
        `Unhandled error: ${thrown instanceof Error ? thrown.message : String(thrown)}`
      );
    }
    const envelope =
      structured && structured.data !== undefined
        ? {
            ok: exitCode === 0,
            exitCode,
            stdout,
            stderr,
            data: structured.data
          }
        : {
            ok: exitCode === 0,
            exitCode,
            stdout,
            stderr
          };
    originalLog(
      JSON.stringify(envelope, null, 2)
    );
    if (thrown !== undefined) {
      return TITS_CLI_EXIT_CODE.IO_ERROR;
    }
    return exitCode;
  } else if (thrown !== undefined) {
    throw thrown;
  }

  if (isStructuredRunResult(value)) {
    return value.exitCode;
  }
  return value;
}

export function printHelp(showLogo: boolean): void {
  if (showLogo) {
    redactedLogger.log(getAsciiLogoLines("MICRO").join("\n"));
  }
  redactedLogger.log(`${APP_NAME}`);
  redactedLogger.log(APP_TAGLINE);
  redactedLogger.log("");
  redactedLogger.log(`Usage: ${CLI_NAME} [options]`);
  redactedLogger.log(`       ${CLI_NAME} <command> [options]`);
  redactedLogger.log("");
  redactedLogger.log("Options:");
  redactedLogger.log("  -h, --help      Show this help");
  redactedLogger.log("      --uninstall Alias for: uninstall");
  redactedLogger.log("      --version   Print app version");
  redactedLogger.log("      --smoke-tui Run minimal TUI smoke render and exit");
  redactedLogger.log("      --interactive Force interactive TUI mode");
  redactedLogger.log("      --json      Emit machine-readable output for non-interactive commands");
  redactedLogger.log("      --quiet     Suppress non-essential non-error output");
  redactedLogger.log("      --data-file <path> Override data file path for this invocation");
  redactedLogger.log("      --no-color  Suppress ANSI color in non-interactive output (also: NO_COLOR env)");
  redactedLogger.log("      --no-logo   Hide ASCII logo in app header");
  redactedLogger.log("");
  redactedLogger.log("Commands:");
  redactedLogger.log("  add             Add task via TITS command engine");
  redactedLogger.log("  done            Mark task done by id via TITS command engine");
  redactedLogger.log("  due             Set/clear due by id via TITS command engine");
  redactedLogger.log("  recur           Set/clear recurrence by id via TITS command engine");
  redactedLogger.log("  note            TOME commands (quick/new/open/search/query/graph/links/reindex/help)");
  redactedLogger.log("  capture         Alias for: note q ...");
  redactedLogger.log("  nq              Alias for: note q ...");
  redactedLogger.log("  list            List tasks with selector filters");
  redactedLogger.log("  uninstall       Remove user-owned TADOI CLI extras and print main uninstall step");
  redactedLogger.log("  reminders       Out-of-app reminder helper commands");
  redactedLogger.log("  remind          Open reminder modal by event id");
  redactedLogger.log("  check:*         Checklist commands (add/toggle/edit/del/clear)");
  redactedLogger.log("  bulk:*          Bulk commands (done/tag/due/priority/assignee/project/stage/delete)");
  redactedLogger.log("  help            Show TITS command help topics");
  redactedLogger.log("  export          Export full persisted state (plus settings)");
  redactedLogger.log("  import          Import state from a JSON export");
  redactedLogger.log("  calendar:export Export one-way calendar ICS file");
  redactedLogger.log("  calendar:import Import one-way calendar ICS file");
  redactedLogger.log("");
  redactedLogger.log("Aliases:");
  redactedLogger.log("  a  -> add        ls -> list       d  -> done");
  redactedLogger.log("  r  -> recur      h  -> help       ?  -> help");
  redactedLogger.log("");
  redactedLogger.log("Examples:");
  redactedLogger.log(`  ${CLI_NAME} 'add \"Task\" due:2026-03-05 #tag'`);
  redactedLogger.log(`  ${CLI_NAME} a \"Buy milk\" due:tomorrow at:17:30 #errands`);
  redactedLogger.log(`  ${CLI_NAME} ls`);
  redactedLogger.log(`  Run '${CLI_NAME} <command> --help' for command-specific flags`);
  redactedLogger.log(`  Use '--' to pass literal tokens (example: ${CLI_NAME} add -- --help)`);
  redactedLogger.log("");
  redactedLogger.log("Environment:");
  redactedLogger.log(`  ${ENV_VARS.DATA_PATH}=<path>   Override data file location`);
  redactedLogger.log(`  ${ENV_VARS.PERF_DEBUG}=1        Enable perf debug logs`);
  redactedLogger.log("  NO_COLOR=<any>            Suppress ANSI color in non-interactive output");
}

function printVersion(): void {
  redactedLogger.log(APP_VERSION);
}

const DEFAULT_DEPS: CliRunDeps = {
  runPortability: runPortabilityCommand,
  runCalendar: runCalendarCommand,
  runList: runListCommand,
  runUninstall: runUninstallCommand,
  runReminders: runRemindersCommand,
  runRemind: runRemindCommand,
  runInteractiveTui: runTui,
  runSmokeTui: runTuiSmoke,
  printHelp,
  printVersion
};

export function resolveCliRoute(argv: string[]): CliRoute {
  const normalizedArgv = normalizeCliCommandAlias(argv);
  const command = normalizedArgv[0];
  if (command === "list") {
    return {
      kind: "list",
      args: normalizedArgv.slice(1)
    };
  }
  if (command === "uninstall") {
    return {
      kind: "uninstall",
      args: normalizedArgv.slice(1)
    };
  }
  if (command === "reminders") {
    return {
      kind: "reminders",
      args: normalizedArgv.slice(1)
    };
  }
  if (command === "remind") {
    return {
      kind: "remind",
      args: normalizedArgv.slice(1)
    };
  }
  if (command === "export" || command === "import") {
    return {
      kind: "portability",
      command,
      args: normalizedArgv.slice(1)
    };
  }
  if (command === "calendar:export") {
    return {
      kind: "calendar",
      command: "export",
      args: normalizedArgv.slice(1)
    };
  }
  if (command === "calendar:import") {
    return {
      kind: "calendar",
      command: "import",
      args: normalizedArgv.slice(1)
    };
  }

  if (normalizedArgv.length === 0) {
    return { kind: "tui", showLogo: true };
  }

  const cliOptions = parseCliOptions(normalizedArgv);
  const argsOnlyCoreOptions = normalizedArgv.every(isCoreOptionToken);

  if (cliOptions.showHelp && argsOnlyCoreOptions) {
    return { kind: "help", showLogo: cliOptions.showLogo };
  }

  if (cliOptions.showVersion && argsOnlyCoreOptions) {
    return { kind: "version" };
  }

  if (cliOptions.smokeTui && argsOnlyCoreOptions) {
    return { kind: "smoke_tui" };
  }

  if (argsOnlyCoreOptions) {
    return { kind: "tui", showLogo: cliOptions.showLogo };
  }

  const unknownToken = normalizedArgv.find((arg) => !isCoreOptionToken(arg));
  if (unknownToken) {
    return { kind: "unknown", token: unknownToken };
  }

  return { kind: "tui", showLogo: cliOptions.showLogo };
}

export async function runCli(
  argv: string[] = process.argv.slice(2),
  deps: CliRunDeps = DEFAULT_DEPS
): Promise<number | undefined> {
  const runtimeParsed = parseRuntimeCliOptions(argv);
  if (!runtimeParsed.ok) {
    redactedLogger.error(`Error: ${runtimeParsed.error}`);
    redactedLogger.error(`Run '${CLI_NAME} --help' for usage.`);
    return TITS_CLI_EXIT_CODE.PARSE_OR_VALIDATION;
  }

  const runtimeArgv = runtimeParsed.argv;
  const runtime = runtimeParsed.runtime;
  const route = resolveCliRoute(runtimeArgv);

  return withNoColorEnv(runtime.noColor, () =>
    withDataFileOverride(runtime.dataFilePath, () =>
      withOutputMode(runtime, async () => {
      if (route.kind === "portability") {
        return deps.runPortability(route.command, route.args);
      }
      if (route.kind === "calendar") {
        return deps.runCalendar(route.command, route.args);
      }
      if (route.kind === "list") {
        return deps.runList(route.args, { json: runtime.json });
      }
      if (route.kind === "uninstall") {
        return deps.runUninstall(route.args);
      }
      if (route.kind === "reminders") {
        return deps.runReminders(route.args);
      }
      if (route.kind === "remind") {
        if (runtime.json || runtime.quiet) {
          redactedLogger.error(
            "Error: --json and --quiet are not supported for reminder modal commands."
          );
          return TITS_CLI_EXIT_CODE.PARSE_OR_VALIDATION;
        }
        return deps.runRemind(route.args);
      }

      const titsResult = await runTitsCommandCli(runtimeArgv);
      if (titsResult.handled) {
        if (runtime.json && titsResult.data !== undefined) {
          return {
            exitCode: titsResult.exitCode ?? 0,
            data: titsResult.data
          };
        }
        return titsResult.exitCode ?? 0;
      }

      if (route.kind === "help") {
        deps.printHelp(route.showLogo);
        return 0;
      }

      if (route.kind === "version") {
        deps.printVersion();
        return 0;
      }

      if (route.kind === "smoke_tui") {
        return deps.runSmokeTui();
      }

      if (route.kind === "unknown") {
        redactedLogger.error(`Error: unknown command or option '${route.token}'.`);
        redactedLogger.error(`Run '${CLI_NAME} --help' for usage.`);
        return TITS_CLI_EXIT_CODE.PARSE_OR_VALIDATION;
      }

      if (runtime.json || runtime.quiet) {
        redactedLogger.error(
          "Error: --json and --quiet are only supported for non-interactive commands."
        );
        return TITS_CLI_EXIT_CODE.PARSE_OR_VALIDATION;
      }

      try {
        await deps.runInteractiveTui({ showLogo: route.showLogo });
        return undefined;
      } catch (error: unknown) {
        if (error instanceof TadoiLockBusyError) {
          redactedLogger.error(await formatTadoiLockBusyMessage(error.lockPath));
          return TITS_CLI_EXIT_CODE.LOCKED;
        }
        throw error;
      }
    })
    )
  );
}

if (import.meta.main) {
  const exitCode = await runCli(process.argv.slice(2));
  if (typeof exitCode === "number" && exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
