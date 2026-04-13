import { promises as fs, watch, type FSWatcher } from "fs";
import path from "path";

type ReaddirWithDirent = (
  dirPath: string,
  options: { withFileTypes: true },
) => Promise<Array<{ isDirectory: () => boolean; name: string }>>;

export type WatchMarkdownTreeDeps = {
  watchImpl?: typeof watch;
  readdirImpl?: ReaddirWithDirent;
};

export type WatchMarkdownTreeOptions = {
  rootPath: string;
  onChange: () => void;
  onError?: (error: unknown) => void;
  debounceMs?: number;
  deps?: WatchMarkdownTreeDeps;
};

export type WatchMarkdownTreeHandle = {
  active: boolean;
  close: () => void;
};

const DEFAULT_DEBOUNCE_MS = 150;
const RESYNC_DELAY_MS = 400;

function normalizeWatcherKey(dirPath: string): string {
  const resolved = path.resolve(dirPath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

async function collectDirectories(
  rootPath: string,
  readdirImpl: ReaddirWithDirent,
): Promise<string[]> {
  const rootResolved = path.resolve(rootPath);
  const queue = [rootResolved];
  const results: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    results.push(current);

    let entries: Array<{ isDirectory: () => boolean; name: string }> = [];
    try {
      entries = await readdirImpl(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      queue.push(path.join(current, entry.name));
    }
  }

  return results;
}

export async function watchMarkdownTree(
  options: WatchMarkdownTreeOptions,
): Promise<WatchMarkdownTreeHandle> {
  const watchImpl = options.deps?.watchImpl ?? watch;
  const readdirImpl =
    options.deps?.readdirImpl ??
    ((dirPath: string, readOptions: { withFileTypes: true }) =>
      fs.readdir(dirPath, readOptions) as ReturnType<ReaddirWithDirent>);
  const debounceMs =
    typeof options.debounceMs === "number" &&
    Number.isFinite(options.debounceMs) &&
    options.debounceMs >= 0
      ? Math.floor(options.debounceMs)
      : DEFAULT_DEBOUNCE_MS;
  const watchersByKey = new Map<string, FSWatcher>();
  let closed = false;
  let changeTimer: ReturnType<typeof setTimeout> | undefined;
  let resyncTimer: ReturnType<typeof setTimeout> | undefined;
  let syncInFlight = false;
  let syncQueued = false;
  let watchErrorNotified = false;

  const clearTimers = () => {
    if (changeTimer) {
      clearTimeout(changeTimer);
      changeTimer = undefined;
    }
    if (resyncTimer) {
      clearTimeout(resyncTimer);
      resyncTimer = undefined;
    }
  };

  const closeWatchers = () => {
    for (const watcher of watchersByKey.values()) {
      try {
        watcher.close();
      } catch {
        // Best effort cleanup only.
      }
    }
    watchersByKey.clear();
  };

  const scheduleChange = () => {
    if (closed) return;
    if (changeTimer) {
      clearTimeout(changeTimer);
    }
    changeTimer = setTimeout(() => {
      changeTimer = undefined;
      try {
        options.onChange();
      } catch (error: unknown) {
        options.onError?.(error);
      }
    }, debounceMs);
  };

  const scheduleResync = () => {
    if (closed) return;
    if (resyncTimer) {
      clearTimeout(resyncTimer);
    }
    resyncTimer = setTimeout(() => {
      resyncTimer = undefined;
      void syncWatchers();
    }, RESYNC_DELAY_MS);
  };

  const onFsEvent = () => {
    scheduleChange();
    scheduleResync();
  };

  const attachWatcher = (dirPath: string): boolean => {
    const key = normalizeWatcherKey(dirPath);
    if (watchersByKey.has(key)) {
      return true;
    }
    try {
      const watcher = watchImpl(dirPath, { persistent: false }, onFsEvent);
      watcher.on("error", (error: unknown) => {
        if (!watchErrorNotified) {
          options.onError?.(error);
          watchErrorNotified = true;
        }
        scheduleResync();
      });
      watchersByKey.set(key, watcher);
      return true;
    } catch (error: unknown) {
      if (!watchErrorNotified) {
        options.onError?.(error);
        watchErrorNotified = true;
      }
      return false;
    }
  };

  const syncWatchers = async (): Promise<void> => {
    if (closed) return;
    if (syncInFlight) {
      syncQueued = true;
      return;
    }
    syncInFlight = true;
    try {
      const directories = await collectDirectories(
        options.rootPath,
        readdirImpl,
      );
      const nextKeys = new Set(
        directories.map((dirPath) => normalizeWatcherKey(dirPath)),
      );

      for (const [key, watcher] of watchersByKey.entries()) {
        if (nextKeys.has(key)) continue;
        try {
          watcher.close();
        } catch {
          // Best effort cleanup only.
        }
        watchersByKey.delete(key);
      }

      for (const dirPath of directories) {
        attachWatcher(dirPath);
      }
    } catch (error: unknown) {
      options.onError?.(error);
    } finally {
      syncInFlight = false;
      if (syncQueued) {
        syncQueued = false;
        void syncWatchers();
      }
    }
  };

  await syncWatchers();
  const active = watchersByKey.size > 0;

  return {
    active,
    close: () => {
      if (closed) return;
      closed = true;
      clearTimers();
      closeWatchers();
    },
  };
}
