import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { App } from "../app/App";
import { redactPathForDisplay } from "../app/pathRedaction";
import { applyThemeWithSettings } from "../app/theme";
import { startOfLocalDayMs } from "../domain/dates";
import { normalizeEngagementState } from "../domain/engagement";
import { normalizeTagIndex, normalizeTags } from "../domain/tagIndex";
import {
  DEFAULT_CRT_FX_LITE_COLOR,
  DEFAULT_CRT_FX_LITE_PRESET,
  DEFAULT_RETRO_FX_MODE,
  loadSettings
} from "../settings/settings";
import {
  CURRENT_SCHEMA_VERSION,
  safeLoadState,
  type LoadedData
} from "../state/persistence";
import {
  acquireTadoiLockOrThrow,
  createDefaultLockPayload,
  getTadoiLockPath,
  removeTadoiLock,
  removeTadoiLockSync
} from "../state/lockfile";
import { applyArchiveAging } from "../state/store";
import { APP_NAME, PRODUCT_NAME_TM } from "../brand/brand";

export type RunTuiOptions = {
  showLogo: boolean;
};

export type StartupNormalizationResult = {
  normalizedLoaded: LoadedData;
  tasksChanged: boolean;
  tagIndexChanged: boolean;
};

export function redactStartupPath(
  pathValue: string,
  options: { homeDir?: string; env?: NodeJS.ProcessEnv } = {}
): string {
  return redactPathForDisplay(pathValue, options);
}

export function normalizeLoadedDataForStartup(
  loaded: LoadedData
): StartupNormalizationResult {
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

  return {
    normalizedLoaded: {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      tasks: normalizedTasks,
      tagIndex: normalizedTagIndex,
      savedViews: Array.isArray(loaded.savedViews) ? loaded.savedViews : [],
      engagement: normalizeEngagementState(loaded.engagement)
    },
    tasksChanged,
    tagIndexChanged
  };
}

export function shouldPersistInitialRuntimeState(options: {
  tasksChanged: boolean;
  tagIndexChanged: boolean;
  archiveChanged: boolean;
  didMigrate: boolean;
  shouldPersistRecoveredState: boolean;
}): boolean {
  return (
    options.tasksChanged ||
    options.tagIndexChanged ||
    options.archiveChanged ||
    options.didMigrate ||
    options.shouldPersistRecoveredState
  );
}

export async function runTui(options: RunTuiOptions): Promise<void> {
  const renderer = await createCliRenderer({ exitOnCtrlC: true });
  const settingsResult = await loadSettings();
  applyThemeWithSettings(settingsResult.settings.themeId, settingsResult.settings);
  const loadResult = await safeLoadState();
  const lockPath = getTadoiLockPath(loadResult.resolvedPath);
  const redactedLockPath = redactStartupPath(lockPath);
  let lockAcquired = false;
  let lockCleanedUp = false;
  const cleanupLock = async (sync: boolean): Promise<void> => {
    if (lockCleanedUp || !lockAcquired) return;
    lockCleanedUp = true;
    process.off("exit", onProcessExit);
    try {
      if (sync) {
        removeTadoiLockSync(lockPath);
      } else {
        await removeTadoiLock(lockPath);
      }
    } catch (error: unknown) {
      console.warn(
        `[${APP_NAME}] failed to remove lock file (${redactedLockPath}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };
  const onProcessExit = () => {
    void cleanupLock(true);
  };
  process.on("exit", onProcessExit);

  const originalDestroy = renderer.destroy.bind(renderer);
  (renderer as { destroy: () => unknown }).destroy = () => {
    void cleanupLock(false);
    return originalDestroy();
  };

  try {
    await acquireTadoiLockOrThrow(
      lockPath,
      createDefaultLockPayload(loadResult.resolvedPath)
    );
    lockAcquired = true;
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.warn(`[${APP_NAME}] ${error.message} (${redactedLockPath})`);
    } else {
      console.warn(`[${APP_NAME}] failed to acquire lock (${redactedLockPath}): ${String(error)}`);
    }
    throw error;
  }

  const loaded = loadResult.data;
  const startupWarnings = [...settingsResult.warnings];
  if (loadResult.bannerMessage) {
    startupWarnings.push(loadResult.bannerMessage);
  }
  const startupBanner =
    startupWarnings.length > 0 ? startupWarnings.join(" | ") : undefined;

  console.log(`[${APP_NAME}] data path: ${redactStartupPath(loadResult.resolvedPath)}`);
  console.log(`[${APP_NAME}] settings path: ${redactStartupPath(settingsResult.resolvedPath)}`);
  for (const warning of settingsResult.warnings) {
    console.warn(`[${APP_NAME}] ${warning}`);
  }
  if (loadResult.bannerMessage) {
    console.warn(`[${APP_NAME}] ${loadResult.bannerMessage}`);
  }

  const { normalizedLoaded, tasksChanged, tagIndexChanged } =
    normalizeLoadedDataForStartup(loaded);

  const now = Date.now();
  const { data: agedData, changed: archiveChanged } = applyArchiveAging(
    normalizedLoaded,
    now
  );
  const shouldSaveInitial = shouldPersistInitialRuntimeState({
    tasksChanged,
    tagIndexChanged,
    archiveChanged,
    didMigrate: loadResult.didMigrate,
    shouldPersistRecoveredState: loadResult.shouldPersistRecoveredState
  });
  const showCorruptionRecoveryImportCta = loadResult.shouldPersistRecoveredState;

  createRoot(renderer).render(
    <App
      initialData={agedData}
      skipInitialSave={!shouldSaveInitial}
      initialThemeId={settingsResult.settings.themeId}
      initialLogoMode={settingsResult.settings.logoMode}
      initialFlashMode={settingsResult.settings.flashMode}
      initialCrtFxLite={settingsResult.settings.crtFxLite === true}
      initialCrtFxColor={settingsResult.settings.crtFxColor ?? DEFAULT_CRT_FX_LITE_COLOR}
      initialCrtFxPreset={settingsResult.settings.crtFxPreset ?? DEFAULT_CRT_FX_LITE_PRESET}
      initialRetroFxMode={settingsResult.settings.retroFxMode ?? DEFAULT_RETRO_FX_MODE}
      initialNotificationSettings={settingsResult.settings.notifications}
      initialSecuritySettings={settingsResult.settings.security}
      initialCustomThemes={settingsResult.settings.customThemes}
      settingsPath={settingsResult.resolvedPath}
      showLogo={options.showLogo}
      startupBanner={startupBanner}
      showCorruptionRecoveryImportCta={showCorruptionRecoveryImportCta}
    />
  );
}

export async function runTuiSmoke(): Promise<number> {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    useAlternateScreen: false,
    useMouse: false
  });

  try {
    createRoot(renderer).render(
      <box>
        <text>{`${PRODUCT_NAME_TM} smoke`}</text>
      </box>
    );
    renderer.requestRender();
    await renderer.idle();
    return 0;
  } finally {
    await renderer.destroy();
  }
}
