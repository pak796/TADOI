import os from "os";
import { createHash } from "node:crypto";
import { promises as fs } from "fs";
import { THEMES, type ThemeId } from "../theme/themes";
import type {
  GitHubAutoPushPolicy,
  GitHubBackupSettings,
  NotesSettings,
  NotificationSettings,
  TadoiSettings,
} from "./types";
import {
  DEFAULT_HINT_DISPLAY_MODE,
  DEFAULT_SHOW_PREFIX_HINT_POPUP,
} from "./types";

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  inAppOverdueBanner: true,
  terminalBellOnOverdue: false,
  bannerDurationMs: 5000,
  bellCooldownMs: 2000,
};

export const DEFAULT_NOTES_SETTINGS: NotesSettings = {
  enabled: true,
  rootPath: null,
};

export const DEFAULT_GITHUB_BACKUP_BRANCH = "main";
export const DEFAULT_GITHUB_AUTO_PUSH_POLICY: GitHubAutoPushPolicy = "off";

function buildDefaultDeviceId(): string {
  const seed = `${os.hostname()}|${os.homedir()}|${process.platform}`;
  return `dev_${createHash("sha256").update(seed).digest("hex").slice(0, 12)}`;
}

export function getDefaultGitHubBackupSettings(
  deviceId = buildDefaultDeviceId(),
): GitHubBackupSettings {
  return {
    enabled: false,
    ownerRepo: null,
    branch: DEFAULT_GITHUB_BACKUP_BRANCH,
    deviceId,
    pathPrefix: `tadoi/devices/${deviceId}`,
    autoPushPolicy: DEFAULT_GITHUB_AUTO_PUSH_POLICY,
  };
}

export const DEFAULT_SETTINGS: TadoiSettings = {
  themeId: "default",
  logoMode: "default",
  flashMode: "slow",
  hintDisplayMode: DEFAULT_HINT_DISPLAY_MODE,
  showPrefixHintPopup: DEFAULT_SHOW_PREFIX_HINT_POPUP,
  notifications: DEFAULT_NOTIFICATION_SETTINGS,
  security: {
    nonHttpLinkPolicy: "prompt",
  },
  customThemes: {
    custom1: {
      global: { ...THEMES.default },
    },
  },
  githubBackup: getDefaultGitHubBackupSettings(),
  notes: DEFAULT_NOTES_SETTINGS,
};

export const DEFAULT_DEBOUNCE_MS = 150;
export const DEFAULT_FS_OPS = fs;
export const PRIVATE_DIR_MODE = 0o700;
export const PRIVATE_FILE_MODE = 0o600;
