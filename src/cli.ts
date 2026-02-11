import {
  APP_NAME,
  APP_TAGLINE,
  CLI_NAME,
  ENV_VARS,
  getAsciiLogoLines
} from "./brand/brand";
import { APP_VERSION } from "./app/version";
import { runPortabilityCommand } from "./cli/portabilityCommands";
import { runTui, runTuiSmoke, type RunTuiOptions } from "./tui/runTui";

type CliOptions = {
  showLogo: boolean;
  showHelp: boolean;
  showVersion: boolean;
  smokeTui: boolean;
};

export type CliRoute =
  | { kind: "help"; showLogo: boolean }
  | { kind: "version" }
  | { kind: "smoke_tui" }
  | { kind: "portability"; command: "export" | "import"; args: string[] }
  | { kind: "tui"; showLogo: boolean };

export type CliRunDeps = {
  runPortability: (
    command: "export" | "import",
    args: string[]
  ) => Promise<number>;
  runInteractiveTui: (options: RunTuiOptions) => Promise<void>;
  runSmokeTui: () => Promise<number>;
  printHelp: (showLogo: boolean) => void;
  printVersion: () => void;
};

function parseCliOptions(argv: string[]): CliOptions {
  const showHelp = argv.includes("--help") || argv.includes("-h");
  const showLogo = !argv.includes("--no-logo");
  const showVersion = argv.includes("--version");
  const smokeTui = argv.includes("--smoke-tui");
  return { showHelp, showLogo, showVersion, smokeTui };
}

export function printHelp(showLogo: boolean): void {
  if (showLogo) {
    console.log(getAsciiLogoLines("MICRO").join("\n"));
  }
  console.log(`${APP_NAME}`);
  console.log(APP_TAGLINE);
  console.log("");
  console.log(`Usage: ${CLI_NAME} [options]`);
  console.log(`       ${CLI_NAME} <command> [options]`);
  console.log("");
  console.log("Options:");
  console.log("  -h, --help      Show this help");
  console.log("      --version   Print app version");
  console.log("      --smoke-tui Run minimal TUI smoke render and exit");
  console.log("      --no-logo   Hide ASCII logo in app header");
  console.log("");
  console.log("Commands:");
  console.log("  export          Export full persisted state (plus settings)");
  console.log("  import          Import state from a JSON export");
  console.log(`  Run '${CLI_NAME} <command> --help' for command-specific flags`);
  console.log("");
  console.log("Environment:");
  console.log(`  ${ENV_VARS.DATA_PATH}=<path>   Override data file location`);
  console.log(`  ${ENV_VARS.PERF_DEBUG}=1        Enable perf debug logs`);
}

function printVersion(): void {
  console.log(APP_VERSION);
}

const DEFAULT_DEPS: CliRunDeps = {
  runPortability: runPortabilityCommand,
  runInteractiveTui: runTui,
  runSmokeTui: runTuiSmoke,
  printHelp,
  printVersion
};

export function resolveCliRoute(argv: string[]): CliRoute {
  const command = argv[0];
  if (command === "export" || command === "import") {
    return {
      kind: "portability",
      command,
      args: argv.slice(1)
    };
  }

  const cliOptions = parseCliOptions(argv);
  if (cliOptions.showHelp) {
    return { kind: "help", showLogo: cliOptions.showLogo };
  }

  if (cliOptions.showVersion) {
    return { kind: "version" };
  }

  if (cliOptions.smokeTui) {
    return { kind: "smoke_tui" };
  }

  return { kind: "tui", showLogo: cliOptions.showLogo };
}

export async function runCli(
  argv: string[] = process.argv.slice(2),
  deps: CliRunDeps = DEFAULT_DEPS
): Promise<number | undefined> {
  const route = resolveCliRoute(argv);

  if (route.kind === "portability") {
    return deps.runPortability(route.command, route.args);
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

  await deps.runInteractiveTui({ showLogo: route.showLogo });
  return undefined;
}

if (import.meta.main) {
  const exitCode = await runCli(process.argv.slice(2));
  if (typeof exitCode === "number" && exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
