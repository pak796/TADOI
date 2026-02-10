import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { App } from "./app/App";
import { applyTheme } from "./app/theme";
import { startOfLocalDayMs } from "./domain/dates";
import { normalizeTagIndex, normalizeTags } from "./domain/tagIndex";
import { loadSettings } from "./settings/settings";
import { CURRENT_SCHEMA_VERSION, safeLoadState } from "./state/persistence";
import { applyArchiveAging } from "./state/store";
import { runPortabilityCommand } from "./cli/portabilityCommands";
import {
  APP_NAME,
  APP_TAGLINE,
  CLI_NAME,
  ENV_VARS,
  getAsciiLogoLines
} from "./brand/brand";

type CliOptions = {
  showLogo: boolean;
  showHelp: boolean;
};

function parseCliOptions(argv: string[]): CliOptions {
  const showHelp = argv.includes("--help") || argv.includes("-h");
  const showLogo = !argv.includes("--no-logo");
  return { showHelp, showLogo };
}

function printHelp(showLogo: boolean): void {
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
  console.log("  -h, --help     Show this help");
  console.log("      --no-logo  Hide ASCII logo in app header");
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

async function main(): Promise<number | undefined> {
  const argv = process.argv.slice(2);
  const command = argv[0];
  if (command === "export" || command === "import") {
    return runPortabilityCommand(command, argv.slice(1));
  }

  const cliOptions = parseCliOptions(argv);
  if (cliOptions.showHelp) {
    printHelp(cliOptions.showLogo);
    return 0;
  }

  const renderer = await createCliRenderer({ exitOnCtrlC: true });
  const settingsResult = await loadSettings();
  applyTheme(settingsResult.settings.themeId);
  const loadResult = await safeLoadState();
  const loaded = loadResult.data;
  console.log(`[${APP_NAME}] data path: ${loadResult.resolvedPath}`);
  console.log(`[${APP_NAME}] settings path: ${settingsResult.resolvedPath}`);
  if (loadResult.bannerMessage) {
    console.warn(`[${APP_NAME}] ${loadResult.bannerMessage}`);
  }
  let tasksChanged = false;
  const normalizedTasks = loaded.tasks.map((task) => {
    const nextTags = normalizeTags(task.tags ?? []);
    const hasExplicitTime =
      typeof task.hasExplicitTime === "boolean" ? task.hasExplicitTime : false;
    const normalizedDueAt =
      task.dueAt !== undefined && !hasExplicitTime
        ? startOfLocalDayMs(task.dueAt)
        : task.dueAt;
    if (!tasksChanged) {
      const currentTags = task.tags ?? [];
      if (currentTags.length !== nextTags.length) {
        tasksChanged = true;
      } else {
        for (let i = 0; i < currentTags.length; i += 1) {
          if (currentTags[i] !== nextTags[i]) {
            tasksChanged = true;
            break;
          }
        }
      }
      if (task.hasExplicitTime !== hasExplicitTime) {
        tasksChanged = true;
      }
      if (task.dueAt !== normalizedDueAt) {
        tasksChanged = true;
      }
    }
    return {
      ...task,
      tags: nextTags,
      hasExplicitTime,
      dueAt: normalizedDueAt
    };
  });
  const normalizedTagIndex = normalizeTagIndex(loaded.tagIndex ?? {});
  const tagIndexChanged =
    JSON.stringify(normalizedTagIndex) !== JSON.stringify(loaded.tagIndex ?? {});
  const normalizedLoaded = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    tasks: normalizedTasks,
    tagIndex: normalizedTagIndex,
    savedViews: Array.isArray(loaded.savedViews) ? loaded.savedViews : []
  };
  const now = Date.now();
  // Apply archive aging before first render (rolling 7+ days since closed).
  const { data: agedData, changed: archiveChanged } = applyArchiveAging(
    normalizedLoaded,
    now
  );
  const shouldSaveInitial =
    tasksChanged ||
    tagIndexChanged ||
    archiveChanged ||
    loadResult.didMigrate ||
    loadResult.shouldPersistRecoveredState;
  createRoot(renderer).render(
    <App
      initialData={agedData}
      skipInitialSave={!shouldSaveInitial}
      startupBanner={loadResult.bannerMessage}
      initialThemeId={settingsResult.settings.themeId}
      initialFlashMode={settingsResult.settings.flashMode}
      settingsPath={settingsResult.resolvedPath}
      showLogo={cliOptions.showLogo}
    />
  );
  return undefined;
}

const exitCode = await main();
if (typeof exitCode === "number" && exitCode !== 0) {
  process.exitCode = exitCode;
}
