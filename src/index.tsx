import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { App } from "./app/App";
import { applyTheme } from "./app/theme";
import { startOfLocalDayMs } from "./domain/dates";
import { normalizeTagIndex, normalizeTags } from "./domain/tagIndex";
import { loadSettings } from "./settings/settings";
import { CURRENT_SCHEMA_VERSION, safeLoadState } from "./state/persistence";
import { applyArchiveAging } from "./state/store";

const renderer = await createCliRenderer({ exitOnCtrlC: true });
const settingsResult = await loadSettings();
applyTheme(settingsResult.settings.themeId);
const loadResult = await safeLoadState();
const loaded = loadResult.data;
console.log(`[ToDui] data path: ${loadResult.resolvedPath}`);
console.log(`[ToDui] settings path: ${settingsResult.resolvedPath}`);
if (loadResult.bannerMessage) {
  console.warn(`[ToDui] ${loadResult.bannerMessage}`);
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
    settingsPath={settingsResult.resolvedPath}
  />
);
