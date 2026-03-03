import React, { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import type { KeyEvent } from "@opentui/core";
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react";
import {
  applyThemeWithSettings,
  colorForTag,
  theme,
  themeForObject,
  layout
} from "./theme";
import {
  getNextSelectedIdAfterDelete,
  nextEditorFocusTarget,
  resolveEditorFocusAfterDraftChange,
  toEditorFocus
} from "./uiState";
import { handleKey, type KeyRouterAction } from "./keyRouter";
import {
  resolveTaskListWheelSelectionIndex,
  TaskList
} from "../components/TaskList";
import { DetailsPane } from "../components/DetailsPane";
import { EditorPane } from "../components/EditorPane";
import { LeftRail, type LeftRailMenuItem } from "../components/LeftRail";
import { DashboardPane } from "../components/DashboardPane";
import { TagFilterPanel } from "../components/TagFilterPanel";
import { BackupCenterScreen } from "../components/BackupCenterScreen";
import { AppModalLayer } from "../components/AppModalLayer";
import { resolveCrtFxColor, resolveRetroSweepBorderColor } from "../components/CrtFxLite";
import { WhichKeyHintBar } from "../components/WhichKeyHintBar";
import { WhichKeyPopup } from "../components/WhichKeyPopup";
import {
  Custom1ThemeEditor,
  type Custom1ThemeEditorHandle
} from "../components/Custom1ThemeEditor";
import {
  BuiltInThemeTextEditor,
  type BuiltInThemeTextEditorHandle
} from "../components/BuiltInThemeTextEditor";
import { diffLocalDays, startOfLocalDayMs } from "../domain/dates";
import {
  computePriorityBucketBreakdown,
  computeTopTagsOpen
} from "../domain/dashboard";
import {
  buildRecurrencePreviewFromDraft
} from "../domain/recurrence/draft";
import { getEditorViewportHeights } from "../domain/editorPaneLayout";
import {
  formatDateToLocalIso,
  parseLocalIsoToDate
} from "../domain/recurrence/rruleAdapter";
import { isRepeatOccurrenceAfterSeriesStart } from "../domain/recurrence/repeatOccurrence";
import {
  deleteRecurringOccurrence,
  deleteRecurringOccurrenceAndFuture
} from "../domain/recurrence/delete";
import { materializeChecklistOccurrenceOverride } from "../domain/recurrence/checklistOccurrence";
import {
  findNextMatchingIndex,
  isTaskDueToday,
  isTaskOverdue
} from "../domain/navigation";
import { clampScrollOffset, ensureSelectedVisible } from "../domain/scroll";
import { computeOpenPriorityStats, computeTopTagStats } from "../domain/tagStats";
import { completeTaskWithRecurrence } from "../domain/recurrence";
import {
  addChecklistItem,
  checklistItemAtDisplayIndex,
  clearChecklist,
  deleteChecklistItem,
  editChecklistItem,
  sortChecklistItems,
  toggleChecklistItem
} from "../domain/checklist";
import {
  addTaskLink,
  deleteTaskLink,
  extractUrlScheme,
  updateTaskLink
} from "../domain/taskLinks";
import { decideTaskLinkOpen } from "./linkOpenFlow";
import { executeCommand } from "../commands/execute";
import { parseCommand } from "../commands/parse";
import type { CommandOutput } from "../commands/types";
import {
  addTagToTagFilterDraftBucket,
  resolveTagFilterDraftForApplyFromInput,
  resolveTagFilterInputCandidateValue,
  resolveTagFilterPanelHotkeyAction
} from "./tagFilterPanelInput";
import {
  applyAutocomplete,
  getAutocompleteStep,
  getSuggestedTime,
  type SuggestedTime
} from "../domain/timeAutocomplete";
import {
  getTitleCompletion,
  getTitleQuery,
  rankTaskTitles
} from "../domain/titleAutocomplete";
import {
  applyArchiveAging,
  combineDueDateTime,
  createDraftFromTask,
  createEmptyDraft,
  formatDate,
  getDueInLabel,
  getVisibleTasks,
  initialState,
  parseDueTime,
  reducer
} from "../state/store";
import {
  getDataFilePath,
  CURRENT_SCHEMA_VERSION,
  loadStateStrict,
  saveStateAtomic,
  saveStateDebounced,
  type LoadedData,
  type SaveStateResult
} from "../state/persistence";
import { retrySaveAfterConflictReload } from "./saveConflictRetry";
import {
  formatTagFilterBooleanSummary,
  isEmptyTagFilter,
  normalizeTagFilter,
  normalizeTagToken,
  resolveEffectiveTagFilter,
  type TagFilterBucket
} from "../domain/tagFilter";
import {
  formatTagForDisplay,
  getTagCompletion,
  mergeTagIndexWithTaskHistory,
  normalizeTagPrefix,
  rankTags,
  updateTagIndex
} from "../domain/tagIndex";
import {
  formatPriorityForDisplay,
  formatTagForReadOnlyDisplay,
  isPriorityToken,
  normalizePriorityFilterValue,
  normalizePriorityFromTokens,
  resolveTaskPriorityTag
} from "../domain/priorityTags";
import {
  getSortModeLabel,
  resolveAnalyticsWindowDays,
  SORT_MODE_ORDER
} from "../domain/query";
import { reconcileSelectionById } from "../domain/selection";
import { buildVisibleTaskRows, type VisibleTaskRow } from "../domain/taskRows";
import {
  cloneEditorDraft,
  isEditorDraftDirty
} from "../domain/editorDraftDirty";
import {
  AppState,
  EditorDraft,
  FocusTarget,
  Mode,
  SavedView,
  TagFilter,
  Task,
  TaskLink
} from "../domain/models";
import {
  formatThemeDisplayName,
  ROTATING_THEME_ORDER,
  THEMES,
  type RotatingThemeId,
  type ThemeId,
  type ThemeTokens
} from "../theme/themes";
import {
  formatContrastIssueForBanner,
  validateBuiltInTextContrast,
  validateCustomThemeContrast
} from "../theme/contrastValidation";
import {
  applySavedView,
  DEFAULT_VIEW_FILTERS,
  isSavedViewActive,
  MAX_SAVED_VIEWS,
  saveViewByName,
  deleteViewAtIndex
} from "../domain/savedViews";
import {
  cycleCrtFxLiteProfile,
  formatCrtFxLiteProfileLabel,
  cycleRetroFxMode,
  formatRetroFxModeLabel,
  type CrtFxLiteColor,
  type CrtFxLitePreset,
  type RetroFxMode,
  DEFAULT_CRT_FX_LITE_COLOR,
  DEFAULT_CRT_FX_LITE_PRESET,
  DEFAULT_RETRO_FX_MODE,
  cycleLogoMode,
  getDefaultSettings,
  loadSettings,
  saveSettingsDebounced,
  type BuiltInThemeTextOverrideConfig,
  type BuiltInThemeTextOverrides,
  type CustomThemeConfig,
  type CustomThemes,
  type FlashMode,
  type HintDisplayMode,
  type LogoMode,
  type SecuritySettings,
  type NotificationSettings,
  type ThemeObjectId,
  type ThemeTextTokenOverrides
} from "../settings/settings";
import { settingsReducer } from "../state/settingsStore";
import { isEditorMode } from "../ui/modeFocus";
import {
  clearEmptyNux,
  dismissEmptyNux,
  initialUIState,
  openEmptyNux,
  setEmptyNuxCelebratePending,
  uiReducer,
  unwind,
  type UIState,
  type UIBackupFinalCheckpointModal,
  type UIDeleteModal,
  type UIHelpThemeUnsavedContinuation,
  type UIRecurringDeleteFutureCheckpointModal,
  type UITaskEditorUnsavedContinuation,
  type UIUnsavedChangesModal,
  type EmptyNuxStep,
  type UITaskLinkFormField,
  type UITaskLinkFormModal,
  type UITaskLinkModalKind
} from "../ui/state";
import {
  BACKUP_IMPORT_PICKER_MAX_VISIBLE_ROWS,
  backupCenterReducer,
  hasMatchingCalendarImportDryRun,
  hasMatchingDryRun,
  initialBackupCenterState,
  isReplaceConfirmationValid,
  type BackupCenterScreen as BackupCenterFlowScreen
} from "../state/backupCenterFlow";
import {
  BackupImportPartialError,
  buildTimestampedBackupPath,
  ensureDefaultBackupDirExists,
  exportBackup,
  getDefaultBackupDir,
  getResolvedDataPath,
  importBackup,
  listBackupFiles
} from "../state/backupService";
import { NotificationManager } from "../notifications/notificationManager";
import { InAppModalNotifier } from "../notifications/notifiers/inAppModalNotifier";
import { OSNotifier } from "../notifications/notifiers/osNotifier";
import { TerminalBellNotifier } from "../notifications/notifiers/terminalBellNotifier";
import type { TaskOverdueEvent } from "../notifications/types";
import { APP_VERSION } from "./version";
import {
  getTerminalSizeWarning,
  isTerminalSizeSupported,
  MIN_TERMINAL_HEIGHT,
  MIN_TERMINAL_WIDTH
} from "./layoutGuard";
import {
  APP_NAME,
  APP_TAGLINE,
  ENV_VARS,
  PRODUCT_NAME_TM,
  TRADEMARK_NOTICE_LINES,
  formatLogoModeLabel
} from "../brand/brand";
import { copyToClipboard } from "./copyToClipboard";
import { openTarget } from "./openTarget";
import { redactPathForDisplay } from "./pathRedaction";
import { useEditorFlow } from "./editorFlow";
import { useModalOrchestration } from "./modalOrchestration";
import { useCalendarFlow } from "./calendarFlow";
import { shouldTriggerSaveConflictRetryFromMouse } from "./saveConflictBannerAction";
import {
  resolveKeymapAliases,
  type KeymapAliasConfig,
  type KeymapAliases
} from "./keymapAliases";
import {
  buildLeftRailHintLines,
  buildWhichKeyHintItems,
  buildWhichKeyPrefixPopup,
  resolveWhichKeyContext
} from "./whichKeyHints";
import {
  shouldRequireBackupReplaceConfirmation
} from "./backupCalendarOrchestration";
import {
  buildPriorityTickerSegments,
  buildTagTickerSegments,
  fitLineToWidth,
  pickHelpCloseButtonLabel,
  truncateToWidth
} from "./renderingComposition";
import { describeTaskEditorContinuation, resolveTaskEditorContinuationForLeftRail } from "./routingContinuations";
import {
  getTerminalBellCooldownMs,
  isInAppOverdueEnabled,
  isTerminalBellOverdueEnabled
} from "./notificationRuntime";

const TICKER_INTERVAL_MS = 6000;
const BOTTOM_INFO_VIEW_ORDER = ["summary", "tags", "priorities"] as const;
const SLOW_PULSE_INTERVAL_MS = 2000;
const FAST_PULSE_INTERVAL_MS = 700;
const NOTIFICATION_EVALUATION_INTERVAL_MS = 10000;
const ENGAGEMENT_TOAST_TICK_INTERVAL_MS = 350;
const FIRST_RECURRING_TASK_TOAST_MS = 10_000;
const FIRST_RECURRING_REPEAT_DONE_TOAST_MS = 10_000;
const ROTATING_THEME_INTERVAL_MS = 15000;
const G_PREFIX_RELEASE_TIMEOUT_MS = 1500;
const CORRUPTION_STARTUP_BANNER_AUTO_DISMISS_MS = 60_000;
const NAV_BANNER_TIMEOUT_MS = 1800;
const VIEW_NAME_MAX_LENGTH = 40;
const DASHBOARD_TOP_TAG_MIN = 5;
const DASHBOARD_TOP_TAG_MAX = 8;
const TAG_FILTER_BUCKET_ORDER: TagFilterBucket[] = ["all", "any", "none"];
const PERF_DEBUG_ENABLED = process.env[ENV_VARS.PERF_DEBUG] === "1";
const HELP_PANEL_MIN_WIDTH = 96;
const HELP_PANEL_MAX_WIDTH = 124;
const HELP_PANEL_MIN_HEIGHT = 14;
const HELP_PANEL_HORIZONTAL_MARGIN = 4;
const HELP_PANEL_VERTICAL_MARGIN = 2;
const HELP_PANEL_BORDER_ROWS = 2;
const HELP_PANEL_BORDER_COLS = 2;
const HELP_HEADER_ROWS = 2;
const HELP_DIVIDER_ROWS = 1;
const HELP_FOOTER_ROWS = 2;
const HELP_PANEL_CHROME_ROWS = HELP_HEADER_ROWS + HELP_DIVIDER_ROWS + HELP_FOOTER_ROWS;
const HELP_SECTION_SCROLL_PADDING = 1;
const HELP_NAV_ITEM_ROW_COUNT = 2;
const EDITOR_CHECKLIST_MODAL_ROW_ID = "__editor_checklist__";
const HELP_SETTINGS_STATUS_ROW_COUNT = 11;
const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings =
  getDefaultSettings().notifications;
const DEFAULT_SECURITY_SETTINGS: SecuritySettings = getDefaultSettings().security;
const DEFAULT_LOGO_MODE: LogoMode = getDefaultSettings().logoMode;
const DEFAULT_CUSTOM_THEMES: CustomThemes | undefined = getDefaultSettings().customThemes;
const DEFAULT_KEYMAP_ALIASES = getDefaultSettings().keymapAliases;
const DEFAULT_HINT_DISPLAY_MODE: HintDisplayMode =
  getDefaultSettings().hintDisplayMode ?? "bottom";
const DEFAULT_SHOW_PREFIX_HINT_POPUP =
  getDefaultSettings().showPrefixHintPopup ?? true;
const DEFAULT_CRT_FX_LITE = getDefaultSettings().crtFxLite === true;
const DEFAULT_CRT_FX_COLOR =
  getDefaultSettings().crtFxColor ?? DEFAULT_CRT_FX_LITE_COLOR;
const DEFAULT_CRT_FX_PRESET =
  getDefaultSettings().crtFxPreset ?? DEFAULT_CRT_FX_LITE_PRESET;
const DEFAULT_RETRO_FX =
  getDefaultSettings().retroFxMode ?? DEFAULT_RETRO_FX_MODE;
const CRT_FX_TICK_INTERVAL_BY_PRESET: Record<CrtFxLitePreset, number> = {
  subtle: 220,
  normal: 160,
  strong: 120
};
const RETRO_FX_TICK_INTERVAL_BY_MODE: Record<Exclude<RetroFxMode, "off">, number> = {
  classic: 220,
  broadcast: 120
};
const TASK_LINK_FORM_FIELD_ORDER: UITaskLinkFormField[] = [
  "label",
  "target",
  "type",
  "save",
  "cancel"
];
const TASK_LINK_FORM_KIND_ORDER: UITaskLinkModalKind[] = ["auto", "url", "path"];
const MODAL_STANDARD_WIDTH = 64;

type HelpMenuItem = {
  title: string;
  description?: string | string[];
};

type HelpMenuSection = {
  title: string;
  items: HelpMenuItem[];
};

type HelpRow =
  | { kind: "section_header"; sectionIndex: number }
  | { kind: "item_title"; sectionIndex: number; itemIndex: number }
  | {
      kind: "item_description";
      sectionIndex: number;
      itemIndex: number;
      descriptionLineIndex: number;
    };

type HelpSectionLayout = {
  id: string;
  sectionIndex: number;
  title: string;
  startRow: number;
  headerRow: number;
  endRow: number;
};

type HelpScrollbarThumb = {
  startRow: number;
  endRow: number;
};

type HelpPage =
  | "help"
  | "settings"
  | "keymapAliases"
  | "theme"
  | "custom1"
  | "custom1Edit"
  | "textTuning"
  | "textTuningTheme"
  | "textTuningEdit";

type HelpNavSelectionByPage = {
  settings: number;
  keymapAliases: number;
  theme: number;
  custom1: number;
  textTuning: number;
  textTuningTheme: number;
};

type HelpNavItem = {
  title: string;
  description: string;
};

type HelpThemeEditorSource = "help_custom1_editor" | "help_text_tuning_editor";

const HELP_SETTINGS_NAV_ITEMS: HelpNavItem[] = [
  {
    title: "Theme",
    description: "Theme mode and custom palette settings."
  },
  {
    title: "Keymap Aliases",
    description: "Configure alias presets for list, dashboard, backup, and help actions."
  },
  {
    title: "Navigation Hints",
    description: "Set hints surface: bottom only, left rail only, both, or none."
  },
  {
    title: "Prefix Popup",
    description: "Toggle the transient Ctrl+g / Ctrl+p / Ctrl+y prefix popup."
  },
  {
    title: "Logo",
    description: "Left/Right previews mode. Enter commits. Esc backs out."
  },
  {
    title: "Flash Mode",
    description: "Switch between static and pulse urgency cues."
  },
  {
    title: "CRT FX Lite",
    description: "Enable or disable CRT visual treatment."
  },
  {
    title: "CRT FX Profile",
    description: "Cycle Green/Amber with Subtle/Regular/Strong intensity."
  },
  {
    title: "Retro FX Mode",
    description: "Set vibe pack mode: Off, Classic, or Broadcast."
  },
  {
    title: "Notifications",
    description: "Enable or disable overdue notifications."
  },
  {
    title: "Overdue Popup",
    description: "Enable or disable in-app overdue popup."
  },
  {
    title: "Terminal Bell",
    description: "Enable or disable terminal bell on overdue."
  }
];

const HELP_THEME_NAV_ITEMS: HelpNavItem[] = [
  {
    title: "Current Theme",
    description: "Press Enter/Right to cycle theme mode."
  },
  {
    title: "Custom1",
    description: "Global palette plus per-object overrides."
  },
  {
    title: "Text Tuning",
    description: "Tune text colors for built-in themes one-by-one."
  }
];

const HELP_CUSTOM1_NAV_ITEMS: HelpNavItem[] = [
  {
    title: "Edit Colors",
    description: "Open editor (live preview, save/cancel/reset)."
  }
];

function formatThemeIdLabel(themeId: RotatingThemeId): string {
  return formatThemeDisplayName(themeId);
}

const HELP_TEXT_TUNING_THEMES: RotatingThemeId[] = [...ROTATING_THEME_ORDER];
const HELP_TEXT_TUNING_NAV_ITEMS: HelpNavItem[] = HELP_TEXT_TUNING_THEMES.map((themeId) => ({
  title: formatThemeIdLabel(themeId),
  description: "Per-theme + per-object text color overrides."
}));
const HELP_TEXT_TUNING_THEME_NAV_ITEMS: HelpNavItem[] = [
  {
    title: "Edit Text Colors",
    description: "Open editor (live preview, save/cancel/reset)."
  }
];

type KeymapAliasPresetContext = "list" | "dashboard" | "backup" | "help";
type KeymapAliasPresetState = "off" | "preset" | "custom";

const HELP_KEYMAP_ALIAS_NAV_ITEMS: HelpNavItem[] = [
  {
    title: "List aliases",
    description: "Preset: Ctrl+F search and n add."
  },
  {
    title: "Dashboard aliases",
    description: "Preset: j/k move selection and h open help."
  },
  {
    title: "Backup aliases",
    description: "Preset: q back and j/k movement."
  },
  {
    title: "Help aliases",
    description: "Preset: j/k move, h/l nav, q close."
  },
  {
    title: "Reset all aliases",
    description: "Clear all keymap alias overrides."
  }
];

const KEYMAP_ALIAS_PRESET_CONTEXT_ORDER: KeymapAliasPresetContext[] = [
  "list",
  "dashboard",
  "backup",
  "help"
];

const KEYMAP_ALIAS_PRESETS_BY_CONTEXT: Record<KeymapAliasPresetContext, KeymapAliasConfig> = {
  list: {
    list_open_search: ["Ctrl+F"],
    list_open_add: ["n"]
  },
  dashboard: {
    dashboard_move_up: ["k"],
    dashboard_move_down: ["j"],
    dashboard_open_help: ["h"]
  },
  backup: {
    backup_back: ["q"],
    backup_move_up: ["k"],
    backup_move_down: ["j"]
  },
  help: {
    help_move_up: ["k"],
    help_move_down: ["j"],
    help_nav_back: ["h"],
    help_nav_forward: ["l"],
    help_close: ["q"]
  }
};

function formatHintDisplayModeLabel(mode: HintDisplayMode): string {
  if (mode === "left_rail") return "Left rail only";
  if (mode === "both") return "Both";
  if (mode === "none") return "None";
  return "Bottom only";
}

function formatHintDisplayModeStatusLabel(mode: HintDisplayMode): string {
  if (mode === "left_rail") return "left rail only";
  if (mode === "both") return "both";
  if (mode === "none") return "none";
  return "bottom only";
}

/*
 * Help menu structure:
 * - Edit HELP_MENU_SECTIONS to add/remove categories and items.
 * - Help keyboard routing is in src/app/keyRouter.ts (Mode.HELP branch).
 */
const HELP_MENU_SECTIONS: HelpMenuSection[] = [
  {
    title: "Getting Started",
    items: [
      {
        title: "Open Help with ?",
        description: "Press ? from list/dashboard to open or close this menu."
      },
      {
        title: "Move around with arrows",
        description: "Use Up/Down to focus sections and Enter/Space to toggle."
      },
      {
        title: "Close with Esc",
        description: "Esc returns to the previous mode/focus."
      }
    ]
  },
  {
    title: "Navigation & Keybindings",
    items: [
      {
        title: "List navigation: j/k, arrows, Ctrl+g/Ctrl+p/Ctrl+y then g/G",
        description: "Jump and browse tasks quickly."
      },
      {
        title: "Page movement: Ctrl+U / Ctrl+D",
        description: "Page up/down through long task lists."
      },
      {
        title: "Attention jumps: [ ] and { }",
        description: "Cycle overdue and due-today tasks."
      },
      {
        title: "Search: / open, Enter/Esc close",
        description: "Type to filter by task title and tags while Search is open."
      }
    ]
  },
  {
    title: "Tasks (create/edit/complete)",
    items: [
      { title: "a add, l add link, e edit, E edit series, c copy" },
      { title: "Space toggle done/open, d delete" },
      { title: "Tab links focus: Enter/o open, c copy, l/e/d manage links" },
      {
        title: "Recurring controls: x skip, z snooze",
        description: "Skip or push the selected recurring occurrence by one day."
      },
      {
        title: "Bulk ops: m mark, ` bulk ...`, Esc clear",
        description: "Mark tasks in LIST, run bulk commands from TITS, and clear marks with Esc."
      }
    ]
  },
  {
    title: "Tags & Filters",
    items: [
      {
        title: "f status, s sort, g due, r priority, t single tag",
        description: "Use r for priority cycle and t for quick single-tag cycle."
      },
      {
        title: "PRIORITY (r)",
        description: "Cycle priority filter based on open-task priority tags."
      },
      {
        title: "TAG PANEL (p)",
        description: "Open boolean tag filter panel (ALL/ANY/NONE)."
      },
      {
        title: "Bottom quick filters are clickable",
        description: "Click buckets/tags to apply; click again to clear."
      },
      {
        title: "Saved views: v overlay, Ctrl+S save, 1..9 apply",
        description: "Pressing an active slot hotkey again resets to default view."
      }
    ]
  },
  {
    title: "Data (Import/Export/Backup)",
    items: [
      {
        title: "Press 1 in Help to open Backup Center",
        description: "Guided DATA and CALENDAR flows with dry-run safety gates."
      },
      {
        title: "CLI export/import commands available",
        description: "Use backup exports for portability and recovery."
      },
      {
        title: "Save conflict recovery",
        description:
          "If a save conflict banner appears, press R or click the banner to reload and retry."
      },
      {
        title: "Calendar (ICS) in Backup Center",
        description: [
          "Open Backup Center -> Calendar (ICS)... -> Export Calendar (.ics) or Import Calendar (.ics).",
          "Export: range/view/privacy + timestamped .ics path with deterministic output.",
          "Import: merge/update/create + horizon cap + mandatory dry-run before commit.",
          "Round-trip identity: X-TADOI-TASK-ID first, then TADOI UID conventions, then external UID.",
          "Boundary: one-way actions per run (not live calendar sync)."
        ]
      },
      {
        title: "Cloud sync integrations (placeholder)",
        description: "Reserved for future workspace sync options."
      }
    ]
  },
  {
    title: "Settings & Themes",
    items: [
      {
        title: "Settings",
        description: [
          "Open Settings submenu",
          "Press Enter/Right to change settings."
        ]
      }
    ]
  },
  {
    title: "Troubleshooting / Support",
    items: [
      {
        title: "Resize terminal if layout feels cramped",
        description: `Minimum supported terminal is ${MIN_TERMINAL_WIDTH}x${MIN_TERMINAL_HEIGHT}.`
      },
      {
        title: "Check app version and data path",
        description: "Useful when reporting issues or validating environment."
      },
      {
        title: "Legal / Trademarks",
        description: [...TRADEMARK_NOTICE_LINES]
      },
      {
        title: "License & usage",
        description: "See LICENSE for PolyForm Noncommercial terms."
      }
    ]
  }
];
const HELP_SETTINGS_NAV_SECTION_INDEX = HELP_MENU_SECTIONS.findIndex(
  (section) => section.title === "Settings & Themes"
);
const HELP_SETTINGS_THEME_NAV_INDEX = HELP_SETTINGS_NAV_ITEMS.findIndex(
  (item) => item.title === "Theme"
);
const HELP_SETTINGS_KEYMAP_ALIASES_NAV_INDEX = HELP_SETTINGS_NAV_ITEMS.findIndex(
  (item) => item.title === "Keymap Aliases"
);
const HELP_SETTINGS_NAVIGATION_HINTS_NAV_INDEX = HELP_SETTINGS_NAV_ITEMS.findIndex(
  (item) => item.title === "Navigation Hints"
);
const HELP_SETTINGS_PREFIX_POPUP_NAV_INDEX = HELP_SETTINGS_NAV_ITEMS.findIndex(
  (item) => item.title === "Prefix Popup"
);
const HELP_SETTINGS_LOGO_NAV_INDEX = HELP_SETTINGS_NAV_ITEMS.findIndex(
  (item) => item.title === "Logo"
);
const HELP_SETTINGS_FLASH_NAV_INDEX = HELP_SETTINGS_NAV_ITEMS.findIndex(
  (item) => item.title === "Flash Mode"
);
const HELP_SETTINGS_CRT_FX_NAV_INDEX = HELP_SETTINGS_NAV_ITEMS.findIndex(
  (item) => item.title === "CRT FX Lite"
);
const HELP_SETTINGS_CRT_FX_PROFILE_NAV_INDEX = HELP_SETTINGS_NAV_ITEMS.findIndex(
  (item) => item.title === "CRT FX Profile"
);
const HELP_SETTINGS_RETRO_FX_MODE_NAV_INDEX = HELP_SETTINGS_NAV_ITEMS.findIndex(
  (item) => item.title === "Retro FX Mode"
);
const HELP_SETTINGS_NOTIFICATIONS_NAV_INDEX = HELP_SETTINGS_NAV_ITEMS.findIndex(
  (item) => item.title === "Notifications"
);
const HELP_SETTINGS_OVERDUE_POPUP_NAV_INDEX = HELP_SETTINGS_NAV_ITEMS.findIndex(
  (item) => item.title === "Overdue Popup"
);
const HELP_SETTINGS_TERMINAL_BELL_NAV_INDEX = HELP_SETTINGS_NAV_ITEMS.findIndex(
  (item) => item.title === "Terminal Bell"
);
const HELP_KEYMAP_ALIAS_RESET_NAV_INDEX = HELP_KEYMAP_ALIAS_NAV_ITEMS.findIndex(
  (item) => item.title === "Reset all aliases"
);

function createDefaultHelpExpandedState(): boolean[] {
  return HELP_MENU_SECTIONS.map((_, index) => index === 0);
}

function clampToBounds(value: number, min: number, max: number): number {
  if (max <= min) return max;
  return Math.max(min, Math.min(value, max));
}

function normalizeHelpReturnContext(
  mode: Mode,
  focus: FocusTarget
): { mode: Mode; focus: FocusTarget } {
  const normalizedMode =
    mode === Mode.HELP || mode === Mode.BACKUP_CENTER ? Mode.LIST : mode;

  if (normalizedMode === Mode.LIST) {
    return { mode: normalizedMode, focus: FocusTarget.TASK_LIST };
  }
  if (normalizedMode === Mode.DASHBOARD) {
    return { mode: normalizedMode, focus: FocusTarget.DASHBOARD };
  }
  if (normalizedMode === Mode.BACKUP_CENTER) {
    return { mode: normalizedMode, focus: FocusTarget.BACKUP_CENTER };
  }
  if (normalizedMode === Mode.SEARCH) {
    return { mode: normalizedMode, focus: FocusTarget.SEARCH_INPUT };
  }
  if (normalizedMode === Mode.MODAL_CONFIRM) {
    return { mode: normalizedMode, focus: FocusTarget.MODAL };
  }
  if (
    (normalizedMode === Mode.ADD || normalizedMode === Mode.EDIT) &&
    toEditorFocus(focus) === null
  ) {
    return { mode: normalizedMode, focus: FocusTarget.EDITOR_TITLE };
  }

  return { mode: normalizedMode, focus };
}

function getHelpItemDescriptionLines(item: HelpMenuItem): string[] {
  if (!item.description) return [];
  if (Array.isArray(item.description)) {
    return item.description.filter((line) => line.length > 0);
  }
  return item.description.length > 0 ? [item.description] : [];
}

function buildHelpRows(expandedBySection: boolean[]): {
  rows: HelpRow[];
  sections: HelpSectionLayout[];
} {
  const rows: HelpRow[] = [];
  const sections: HelpSectionLayout[] = [];

  HELP_MENU_SECTIONS.forEach((section, sectionIndex) => {
    const startRow = rows.length;
    const headerRow = rows.length;
    const sectionId = `help-${sectionIndex}-${section.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")}`;
    rows.push({ kind: "section_header", sectionIndex });

    if (expandedBySection[sectionIndex]) {
      section.items.forEach((item, itemIndex) => {
        rows.push({ kind: "item_title", sectionIndex, itemIndex });
        const descriptionLines = getHelpItemDescriptionLines(item);
        descriptionLines.forEach((_, descriptionLineIndex) => {
          rows.push({
            kind: "item_description",
            sectionIndex,
            itemIndex,
            descriptionLineIndex
          });
        });
      });
    }

    sections.push({
      id: sectionId,
      sectionIndex,
      title: section.title,
      startRow,
      headerRow,
      endRow: Math.max(startRow, rows.length - 1)
    });
  });

  return { rows, sections };
}

function findHelpSectionIndexForViewportTop(
  sections: HelpSectionLayout[],
  viewportTopRow: number
): number {
  if (sections.length === 0) return 0;
  for (const section of sections) {
    if (section.headerRow >= viewportTopRow) {
      return section.sectionIndex;
    }
  }
  return sections[sections.length - 1]?.sectionIndex ?? 0;
}

function ensureHelpSectionVisible(params: {
  section: HelpSectionLayout | undefined;
  scrollOffset: number;
  visibleRows: number;
  itemCount: number;
  paddingRows: number;
}): number {
  const { section, scrollOffset, visibleRows, itemCount, paddingRows } = params;
  if (!section || itemCount <= 0) return 0;
  const safeVisibleRows = Math.max(1, visibleRows);
  const clampedOffset = clampScrollOffset(scrollOffset, safeVisibleRows, itemCount);
  const maxVisibleRow = clampedOffset + safeVisibleRows - 1;
  const safePadding = Math.max(
    0,
    Math.min(paddingRows, Math.floor((safeVisibleRows - 1) / 2))
  );
  const paddedTop = clampedOffset + safePadding;
  const paddedBottom = maxVisibleRow - safePadding;
  const selectedHeaderRow = section.headerRow;

  let nextOffset = clampedOffset;
  // Scroll-follow selection tracks the selected section header only.
  // Expanding/collapsing content should not force viewport jumps by itself.
  if (selectedHeaderRow < paddedTop) {
    nextOffset = selectedHeaderRow - safePadding;
  } else if (selectedHeaderRow > paddedBottom) {
    nextOffset = selectedHeaderRow - (safeVisibleRows - safePadding - 1);
  }

  return clampScrollOffset(nextOffset, safeVisibleRows, itemCount);
}

function getHelpNavStatusRowCount(page: HelpPage): number {
  return page === "settings" ? HELP_SETTINGS_STATUS_ROW_COUNT : 0;
}

function getHelpNavLineCount(page: HelpPage, navItemCount: number): number {
  const clampedCount = Math.max(0, navItemCount);
  return getHelpNavStatusRowCount(page) + clampedCount * HELP_NAV_ITEM_ROW_COUNT;
}

function getHelpNavSelectionAnchorRow(page: HelpPage, selectionIndex: number): number {
  return getHelpNavStatusRowCount(page) + Math.max(0, selectionIndex) * HELP_NAV_ITEM_ROW_COUNT;
}

function computeHelpScrollbarThumb(params: {
  scrollOffset: number;
  visibleRows: number;
  itemCount: number;
}): HelpScrollbarThumb | null {
  const { scrollOffset, visibleRows, itemCount } = params;
  if (itemCount <= visibleRows) return null;
  const safeVisibleRows = Math.max(1, visibleRows);
  const maxOffset = Math.max(1, itemCount - safeVisibleRows);
  const thumbSize = Math.max(
    1,
    Math.min(safeVisibleRows, Math.round((safeVisibleRows / itemCount) * safeVisibleRows))
  );
  const maxThumbTop = Math.max(0, safeVisibleRows - thumbSize);
  const thumbTop = Math.round((clampScrollOffset(scrollOffset, safeVisibleRows, itemCount) / maxOffset) * maxThumbTop);
  return {
    startRow: thumbTop,
    endRow: thumbTop + thumbSize - 1
  };
}

function cloneThemeTokens(tokens: ThemeTokens): ThemeTokens {
  return { ...tokens };
}

function cloneThemeObjectOverrides(
  objects: Partial<Record<ThemeObjectId, Partial<ThemeTokens>>> | undefined
): Partial<Record<ThemeObjectId, Partial<ThemeTokens>>> {
  if (!objects) return {};
  const next: Partial<Record<ThemeObjectId, Partial<ThemeTokens>>> = {};
  for (const [objectId, overrides] of Object.entries(objects) as Array<
    [ThemeObjectId, Partial<ThemeTokens>]
  >) {
    next[objectId] = { ...overrides };
  }
  return next;
}

function resolveCustom1Config(customThemes: CustomThemes | undefined): CustomThemeConfig {
  const fallback = getDefaultSettings().customThemes?.custom1?.global;
  if (!fallback) {
    throw new Error("Default custom1 theme is unavailable.");
  }
  const global = customThemes?.custom1?.global ?? fallback;
  return {
    global: cloneThemeTokens(global),
    objects: cloneThemeObjectOverrides(customThemes?.custom1?.objects)
  };
}

function cloneThemeTextTokenOverrides(
  overrides: ThemeTextTokenOverrides | undefined
): ThemeTextTokenOverrides {
  if (!overrides) return {};
  return { ...overrides };
}

function cloneThemeTextObjectOverrides(
  objects: Partial<Record<ThemeObjectId, ThemeTextTokenOverrides>> | undefined
): Partial<Record<ThemeObjectId, ThemeTextTokenOverrides>> {
  if (!objects) return {};
  const next: Partial<Record<ThemeObjectId, ThemeTextTokenOverrides>> = {};
  for (const [objectId, overrides] of Object.entries(objects) as Array<
    [ThemeObjectId, ThemeTextTokenOverrides]
  >) {
    next[objectId] = { ...overrides };
  }
  return next;
}

function sanitizeThemeTextTokenOverrides(
  overrides: ThemeTextTokenOverrides
): ThemeTextTokenOverrides | undefined {
  const next: ThemeTextTokenOverrides = {};
  if (overrides.text) next.text = overrides.text;
  if (overrides.mutedText) next.mutedText = overrides.mutedText;
  if (overrides.selectionText) next.selectionText = overrides.selectionText;
  return Object.keys(next).length > 0 ? next : undefined;
}

function sanitizeThemeTextObjectOverrides(
  objects: Partial<Record<ThemeObjectId, ThemeTextTokenOverrides>>
): Partial<Record<ThemeObjectId, ThemeTextTokenOverrides>> | undefined {
  const next: Partial<Record<ThemeObjectId, ThemeTextTokenOverrides>> = {};
  for (const [objectId, overrides] of Object.entries(objects) as Array<
    [ThemeObjectId, ThemeTextTokenOverrides]
  >) {
    const sanitized = sanitizeThemeTextTokenOverrides(overrides);
    if (sanitized) {
      next[objectId] = sanitized;
    }
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function resolveBuiltInThemeTextConfig(
  customThemes: CustomThemes | undefined,
  themeId: RotatingThemeId
): BuiltInThemeTextOverrideConfig {
  const source = customThemes?.textByTheme?.[themeId];
  const global = cloneThemeTextTokenOverrides(source?.global);
  const objects = cloneThemeTextObjectOverrides(source?.objects);
  return {
    global,
    objects
  };
}

function resolveDashboardTopTagLimit(panelHeight: number): number {
  const availableRows = Math.max(1, panelHeight - 8);
  if (availableRows < DASHBOARD_TOP_TAG_MIN) {
    return availableRows;
  }
  return Math.min(DASHBOARD_TOP_TAG_MAX, availableRows);
}

type DashboardSliceCount = {
  value: string;
  count: number;
};

const WORKFLOW_STAGE_ORDER: Array<NonNullable<Task["workflowStage"]>> = [
  "backlog",
  "todo",
  "in_progress",
  "blocked",
  "review",
  "done"
];

function computeTopSliceCounts(
  tasks: Task[],
  selector: (task: Task) => string | undefined,
  limit: number
): DashboardSliceCount[] {
  if (limit <= 0) return [];
  const counts = new Map<string, number>();
  for (const task of tasks) {
    const value = selector(task)?.trim();
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => {
      if (left.count !== right.count) return right.count - left.count;
      return left.value.localeCompare(right.value);
    })
    .slice(0, limit);
}

function computeWorkflowStageSliceCounts(tasks: Task[]): DashboardSliceCount[] {
  const counts = new Map<NonNullable<Task["workflowStage"]>, number>();
  for (const task of tasks) {
    const stage = task.workflowStage;
    if (!stage) continue;
    counts.set(stage, (counts.get(stage) ?? 0) + 1);
  }

  return WORKFLOW_STAGE_ORDER.filter((stage) => (counts.get(stage) ?? 0) > 0).map((stage) => ({
    value: stage,
    count: counts.get(stage) ?? 0
  }));
}

function getTagQuery(tagsText: string): string | null {
  if (/[\s,]$/.test(tagsText)) return null;
  const tokens = tagsText.split(/[\s,]+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const lastToken = tokens[tokens.length - 1];
  const normalized = normalizeTagPrefix(lastToken);
  return normalized.length ? normalized : null;
}

function parseTagsInput(input: string): string[] {
  const tokens = input.split(/[\s,]+/).filter(Boolean);
  return normalizePriorityFromTokens(tokens);
}

function getDueSuggestion(dueText: string, now: number): string | null {
  const trimmed = dueText.trim();
  const date = new Date(now);
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  if (!trimmed) {
    return year;
  }

  if (/^\d{1,3}$/.test(trimmed)) {
    return year;
  }

  if (/^\d{4}$/.test(trimmed)) {
    return `${trimmed}-${month}`;
  }

  if (/^\d{4}-$/.test(trimmed)) {
    return `${trimmed}${month}`;
  }

  if (/^\d{4}-\d{1}$/.test(trimmed)) {
    const prefix = trimmed.slice(0, -1);
    const partial = trimmed.slice(-1);
    return `${prefix}${partial}${month.slice(1)}`;
  }

  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return `${trimmed}-${day}`;
  }

  if (/^\d{4}-\d{2}-$/.test(trimmed)) {
    return `${trimmed}${day}`;
  }

  if (/^\d{4}-\d{2}-\d{1}$/.test(trimmed)) {
    const prefix = trimmed.slice(0, -1);
    const partial = trimmed.slice(-1);
    return `${prefix}${partial}${day.slice(1)}`;
  }

  return null;
}

function normalizeErrorDetail(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return detail.replace(/\s+/g, " ").trim();
}

function replaceLastTagToken(tagsText: string, tag: string, appendSpace = false): string {
  const tokens = tagsText.split(/[\s,]+/).filter(Boolean);
  if (tokens.length === 0) {
    return `${formatTagForDisplay(tag)}${appendSpace ? " " : ""}`;
  }
  tokens[tokens.length - 1] = formatTagForDisplay(tag);
  return `${tokens.join(" ")}${appendSpace ? " " : ""}`;
}

type TagTickerSegment = {
  tag: string;
  total: number;
  dueThisWeek: number;
  displayTag: string;
};

type BottomInfoView = (typeof BOTTOM_INFO_VIEW_ORDER)[number];

type PriorityTickerSegment = {
  priorityTag: string;
  displayPriority: string;
  total: number;
};

type DashboardFocusGroup =
  | "top_tags"
  | "due_buckets"
  | "priority"
  | "assignee"
  | "project"
  | "workflow_stage";

const DASHBOARD_FOCUS_GROUP_ORDER: DashboardFocusGroup[] = [
  "top_tags",
  "due_buckets",
  "priority",
  "assignee",
  "project",
  "workflow_stage"
];

function summarizeViewFilters(filters: SavedView["filters"]): string {
  const search = filters.searchText?.trim();
  const searchLabel = search ? ` search=${search}` : "";
  const priority = formatPriorityForDisplay(filters.priority);
  const priorityLabel = priority ? ` priority=${priority}` : "";
  const analyticsWindow = (filters.analyticsWindow ?? "7d").toUpperCase();
  const analyticsLabel = ` window=${analyticsWindow}`;
  const dueOffsetLabel =
    filters.dueDayOffset !== undefined ? ` due+${filters.dueDayOffset}` : "";
  const booleanTagSummary = formatTagFilterBooleanSummary(filters.tagFilter);
  const tagLabel = booleanTagSummary
    ? ` tags=${booleanTagSummary}`
    : filters.tag
      ? ` tag=${formatTagForReadOnlyDisplay(filters.tag)}`
      : "";
  const assigneeLabel = filters.assignee ? ` assignee=${filters.assignee}` : "";
  const projectLabel = filters.project ? ` project=${filters.project}` : "";
  const stageLabel = filters.workflowStage ? ` stage=${filters.workflowStage}` : "";
  return `status=${filters.status} due=${filters.due}${dueOffsetLabel}${analyticsLabel}${priorityLabel}${tagLabel}${assigneeLabel}${projectLabel}${stageLabel}${searchLabel}`;
}

function comparePriorityDigits(left: string, right: string): number {
  const normalizedLeft = left.replace(/^0+(?=\d)/, "");
  const normalizedRight = right.replace(/^0+(?=\d)/, "");
  if (normalizedLeft.length !== normalizedRight.length) {
    return normalizedLeft.length - normalizedRight.length;
  }
  const magnitudeCompare = normalizedLeft.localeCompare(normalizedRight);
  if (magnitudeCompare !== 0) {
    return magnitudeCompare;
  }
  if (left.length !== right.length) {
    return left.length - right.length;
  }
  return left.localeCompare(right);
}

function comparePriorityTags(left: string, right: string): number {
  const leftDigits = isPriorityToken(left)?.digits;
  const rightDigits = isPriorityToken(right)?.digits;
  if (!leftDigits || !rightDigits) {
    return left.localeCompare(right);
  }
  const digitCompare = comparePriorityDigits(leftDigits, rightDigits);
  if (digitCompare !== 0) {
    return digitCompare;
  }
  return left.localeCompare(right);
}

function getSortedOpenTaskPriorities(tasks: Task[]): string[] {
  const priorities = new Set<string>();
  for (const task of tasks) {
    if (task.status !== "open") continue;
    const priority = resolveTaskPriorityTag(task.tags);
    if (!priority) continue;
    priorities.add(priority);
  }
  return Array.from(priorities).sort(comparePriorityTags);
}

function cycleTaskLinkFormField(
  current: UITaskLinkFormField,
  direction: 1 | -1
): UITaskLinkFormField {
  const index = TASK_LINK_FORM_FIELD_ORDER.indexOf(current);
  const safeIndex = index === -1 ? 0 : index;
  const nextIndex =
    (safeIndex + direction + TASK_LINK_FORM_FIELD_ORDER.length) %
    TASK_LINK_FORM_FIELD_ORDER.length;
  return TASK_LINK_FORM_FIELD_ORDER[nextIndex];
}

function cycleTaskLinkFormKind(
  current: UITaskLinkModalKind,
  direction: 1 | -1
): UITaskLinkModalKind {
  const index = TASK_LINK_FORM_KIND_ORDER.indexOf(current);
  const safeIndex = index === -1 ? 0 : index;
  const nextIndex =
    (safeIndex + direction + TASK_LINK_FORM_KIND_ORDER.length) %
    TASK_LINK_FORM_KIND_ORDER.length;
  return TASK_LINK_FORM_KIND_ORDER[nextIndex];
}

function formatLinkSnippet(label: string | undefined, target: string): string {
  const value = label?.trim().length ? label.trim() : target;
  if (value.length <= 48) return value;
  return `${value.slice(0, 47)}…`;
}

function stableSerialize(value: unknown): string {
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) {
      return input.map((item) => normalize(item));
    }
    if (input && typeof input === "object") {
      const sortedEntries = Object.entries(input as Record<string, unknown>).sort(([a], [b]) =>
        a.localeCompare(b)
      );
      const next: Record<string, unknown> = {};
      for (const [key, entryValue] of sortedEntries) {
        next[key] = normalize(entryValue);
      }
      return next;
    }
    return input;
  };
  return JSON.stringify(normalize(value));
}

function cloneKeymapAliasConfig(config: KeymapAliasConfig): KeymapAliasConfig {
  const next: KeymapAliasConfig = {};
  for (const [actionId, tokens] of Object.entries(config)) {
    next[actionId as keyof KeymapAliasConfig] = [...tokens];
  }
  return next;
}

function cloneKeymapAliases(aliases: KeymapAliases | undefined): KeymapAliases | undefined {
  if (!aliases) return undefined;
  const next: KeymapAliases = {};
  for (const context of KEYMAP_ALIAS_PRESET_CONTEXT_ORDER) {
    const config = aliases[context];
    if (!config) continue;
    next[context] = cloneKeymapAliasConfig(config);
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function areKeymapAliasConfigsEqual(
  left: KeymapAliasConfig | undefined,
  right: KeymapAliasConfig
): boolean {
  const leftKeys = Object.keys(left ?? {}).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  for (let index = 0; index < rightKeys.length; index += 1) {
    if (leftKeys[index] !== rightKeys[index]) return false;
    const key = rightKeys[index] as keyof KeymapAliasConfig;
    const leftTokens = left?.[key] ?? [];
    const rightTokens = right[key] ?? [];
    if (leftTokens.length !== rightTokens.length) return false;
    for (let tokenIndex = 0; tokenIndex < rightTokens.length; tokenIndex += 1) {
      if (leftTokens[tokenIndex] !== rightTokens[tokenIndex]) return false;
    }
  }
  return true;
}

function resolveKeymapAliasPresetState(
  context: KeymapAliasPresetContext,
  aliases: KeymapAliases | undefined
): KeymapAliasPresetState {
  const config = aliases?.[context];
  if (!config) return "off";
  return areKeymapAliasConfigsEqual(config, KEYMAP_ALIAS_PRESETS_BY_CONTEXT[context])
    ? "preset"
    : "custom";
}

function formatKeymapAliasPresetState(state: KeymapAliasPresetState): string {
  if (state === "preset") return "on";
  if (state === "custom") return "custom";
  return "off";
}

function describeUnsavedSource(source: UIUnsavedChangesModal["source"]): string {
  switch (source) {
    case "task_editor":
      return "Task editor changes are unsaved.";
    case "help_custom1_editor":
      return "Custom1 theme changes are unsaved.";
    case "help_text_tuning_editor":
      return "Built-in text tuning changes are unsaved.";
    default:
      return "Unsaved changes detected.";
  }
}

function isBlockingOverlayOpen(uiState: UIState): boolean {
  return (
    uiState.mode === Mode.MODAL_CONFIRM ||
    uiState.mode === Mode.HELP ||
    uiState.mode === Mode.BACKUP_CENTER ||
    uiState.mode === Mode.TAG_FILTER
  );
}

type AppProps = {
  initialData?: LoadedData;
  skipInitialSave?: boolean;
  startupBanner?: string;
  showCorruptionRecoveryImportCta?: boolean;
  initialThemeId?: ThemeId;
  initialLogoMode?: LogoMode;
  initialFlashMode?: FlashMode;
  initialCrtFxLite?: boolean;
  initialCrtFxColor?: CrtFxLiteColor;
  initialCrtFxPreset?: CrtFxLitePreset;
  initialRetroFxMode?: RetroFxMode;
  initialNotificationSettings?: NotificationSettings;
  initialSecuritySettings?: SecuritySettings;
  initialCustomThemes?: CustomThemes;
  settingsPath?: string;
  showLogo?: boolean;
};

type SaveConflictBannerState = {
  filePath: string;
  expectedStateRevision?: number;
  actualStateRevision?: number;
};

type BackupBodyScrollRequest = {
  token: number;
  delta: number;
};

function initState(data?: LoadedData): AppState {
  return {
    ...initialState,
    tasks: data?.tasks ?? [],
    tagIndex: data?.tagIndex ?? {},
    savedViews: data?.savedViews ?? [],
    engagement: data?.engagement ?? initialState.engagement,
    engagementToastQueue: [],
    engagementToastActive: null
  };
}

export function App({
  initialData,
  skipInitialSave = false,
  startupBanner,
  showCorruptionRecoveryImportCta = false,
  initialThemeId = "default",
  initialLogoMode = DEFAULT_LOGO_MODE,
  initialFlashMode = "slow",
  initialCrtFxLite = DEFAULT_CRT_FX_LITE,
  initialCrtFxColor = DEFAULT_CRT_FX_COLOR,
  initialCrtFxPreset = DEFAULT_CRT_FX_PRESET,
  initialRetroFxMode = DEFAULT_RETRO_FX,
  initialNotificationSettings = DEFAULT_NOTIFICATION_SETTINGS,
  initialSecuritySettings = DEFAULT_SECURITY_SETTINGS,
  initialCustomThemes = DEFAULT_CUSTOM_THEMES,
  settingsPath,
  showLogo = true
}: AppProps) {
  const renderer = useRenderer();
  const [state, dispatch] = useReducer(reducer, initialData, initState);
  const [settingsState, settingsDispatch] = useReducer(settingsReducer, {
    themeId: initialThemeId,
    logoMode: initialLogoMode,
    flashMode: initialFlashMode,
    hintDisplayMode: DEFAULT_HINT_DISPLAY_MODE,
    showPrefixHintPopup: DEFAULT_SHOW_PREFIX_HINT_POPUP,
    crtFxLite: initialCrtFxLite,
    crtFxColor: initialCrtFxColor,
    crtFxPreset: initialCrtFxPreset,
    retroFxMode: initialRetroFxMode,
    notifications: initialNotificationSettings,
    security: initialSecuritySettings,
    customThemes: initialCustomThemes,
    keymapAliases: DEFAULT_KEYMAP_ALIASES
  });
  const [uiState, uiDispatch] = useReducer(uiReducer, initialUIState);
  const [backupState, backupDispatch] = useReducer(
    backupCenterReducer,
    initialBackupCenterState
  );
  const [backupBodyScrollRequest, setBackupBodyScrollRequest] =
    useState<BackupBodyScrollRequest>({
      token: 0,
      delta: 0
    });
  const calendarImportPathInputRef = useRef(backupState.calendarImportPathInput);
  calendarImportPathInputRef.current = backupState.calendarImportPathInput;
  const calendarImportRangeRef = useRef(backupState.calendarImportRange);
  calendarImportRangeRef.current = backupState.calendarImportRange;
  const calendarImportModeRef = useRef(backupState.calendarImportMode);
  calendarImportModeRef.current = backupState.calendarImportMode;
  const calendarImportConfirmInputRef = useRef(backupState.calendarImportConfirmInput);
  calendarImportConfirmInputRef.current = backupState.calendarImportConfirmInput;
  const [crtFxTick, setCrtFxTick] = useState(0);
  const [retroFxTick, setRetroFxTick] = useState(0);
  const [pulseOn, setPulseOn] = useState(false);
  const [fastPulseOn, setFastPulseOn] = useState(false);
  const [bottomInfoView, setBottomInfoView] = useState<BottomInfoView>("summary");
  const [rotatingThemeIndex, setRotatingThemeIndex] = useState(0);
  const [timeSuggestion, setTimeSuggestion] = useState<SuggestedTime | null>(null);
  const [saveFailureBanner, setSaveFailureBanner] = useState<string | null>(null);
  const [saveConflictBannerState, setSaveConflictBannerState] =
    useState<SaveConflictBannerState | null>(null);
  const [saveConflictRetryPending, setSaveConflictRetryPending] = useState(false);
  const [navigationBanner, setNavigationBanner] = useState<string | null>(null);
  const [startupBannerMessage, setStartupBannerMessage] = useState<string | null>(
    startupBanner ?? null
  );
  const [pendingGPrefix, setPendingGPrefix] = useState(false);
  const [viewsOverlayOpen, setViewsOverlayOpen] = useState(false);
  const [selectedViewIndex, setSelectedViewIndex] = useState(0);
  const [saveViewPromptOpen, setSaveViewPromptOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState("");
  const [commandActive, setCommandActive] = useState(false);
  const [commandText, setCommandText] = useState("");
  const commandTextRef = useRef("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [commandHistoryIndex, setCommandHistoryIndex] = useState<number | null>(null);
  const [commandOutput, setCommandOutput] = useState<CommandOutput | null>(null);
  const [dashboardTagSelection, setDashboardTagSelection] = useState(0);
  const [dashboardDueBucketSelection, setDashboardDueBucketSelection] = useState(0);
  const [dashboardPrioritySelection, setDashboardPrioritySelection] = useState(0);
  const [dashboardAssigneeSelection, setDashboardAssigneeSelection] = useState(0);
  const [dashboardProjectSelection, setDashboardProjectSelection] = useState(0);
  const [dashboardWorkflowStageSelection, setDashboardWorkflowStageSelection] = useState(0);
  const [dashboardFocusGroup, setDashboardFocusGroup] =
    useState<DashboardFocusGroup>("top_tags");
  const [selectedLinkId, setSelectedLinkId] = useState<string | undefined>(undefined);
  const [selectedChecklistItemId, setSelectedChecklistItemId] = useState<
    string | undefined
  >(undefined);
  const [selectedEditorChecklistItemId, setSelectedEditorChecklistItemId] = useState<
    string | undefined
  >(undefined);
  const [checklistScrollOffset, setChecklistScrollOffset] = useState(0);
  const [bulkMarkedTaskIds, setBulkMarkedTaskIds] = useState<string[]>([]);
  const [tagFilterDraft, setTagFilterDraft] = useState<TagFilter | undefined>(undefined);
  const [tagFilterInput, setTagFilterInput] = useState("");
  const tagFilterInputRef = useRef("");
  const [activeTagFilterBucket, setActiveTagFilterBucket] =
    useState<TagFilterBucket>("all");
  const [helpExpandedBySection, setHelpExpandedBySection] = useState<boolean[]>(
    createDefaultHelpExpandedState
  );
  const [helpFocusedSectionIndex, setHelpFocusedSectionIndex] = useState(0);
  const [helpScrollOffset, setHelpScrollOffset] = useState(0);
  const [helpNavScrollOffset, setHelpNavScrollOffset] = useState(0);
  const [helpNavStack, setHelpNavStack] = useState<HelpPage[]>(["help"]);
  const [helpNavSelection, setHelpNavSelection] = useState<HelpNavSelectionByPage>({
    settings: 0,
    keymapAliases: 0,
    theme: 0,
    custom1: 0,
    textTuning: 0,
    textTuningTheme: 0
  });
  const [helpPreviewThemeMode, setHelpPreviewThemeMode] = useState<ThemeId | null>(null);
  const [helpDraftLogoMode, setHelpDraftLogoMode] = useState<LogoMode | null>(null);
  const [helpTextTuningThemeId, setHelpTextTuningThemeId] = useState<RotatingThemeId>(
    HELP_TEXT_TUNING_THEMES[0] ?? "default"
  );
  const [custom1DraftGlobal, setCustom1DraftGlobal] = useState<ThemeTokens>(() =>
    resolveCustom1Config(initialCustomThemes).global
  );
  const [custom1DraftObjects, setCustom1DraftObjects] = useState<
    Partial<Record<ThemeObjectId, Partial<ThemeTokens>>>
  >(() => resolveCustom1Config(initialCustomThemes).objects ?? {});
  const [builtInTextDraftGlobal, setBuiltInTextDraftGlobal] = useState<ThemeTextTokenOverrides>(
    {}
  );
  const [builtInTextDraftObjects, setBuiltInTextDraftObjects] = useState<
    Partial<Record<ThemeObjectId, ThemeTextTokenOverrides>>
  >({});
  const selectedRowIdRef = useRef<string | undefined>(state.selectedId);
  const editorDraftRef = useRef<EditorDraft | null>(state.editor);
  const editorDirtyIntentRef = useRef(false);
  const editorTargetRowIdRef = useRef<string | undefined>(undefined);
  const editorBaselineDraftRef = useRef<EditorDraft | null>(null);
  const skipInitialSaveRef = useRef(skipInitialSave);
  const skipSettingsSaveRef = useRef(true);
  const lastSuccessfulSaveAtRef = useRef<number | undefined>(undefined);
  const expectedStateRevisionRef = useRef<number>(
    typeof initialData?.stateRevision === "number" &&
      Number.isInteger(initialData.stateRevision) &&
      initialData.stateRevision >= 0
      ? initialData.stateRevision
      : 0
  );
  const gPrefixTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousTaskCountRef = useRef(state.tasks.length);
  const pendingCelebrateTaskIdRef = useRef<string | undefined>(undefined);
  const helpScrollTopRef = useRef(0);
  const helpFocusedSectionRef = useRef(0);
  const helpReturnContextRef = useRef({
    mode: Mode.LIST,
    focus: FocusTarget.TASK_LIST
  });
  const helpPreviewRestoreThemeRef = useRef<ThemeId | null>(null);
  const custom1EditorRef = useRef<Custom1ThemeEditorHandle | null>(null);
  const builtInTextEditorRef = useRef<BuiltInThemeTextEditorHandle | null>(null);
  const { height: terminalHeight, width: terminalWidth } = useTerminalDimensions();
  const terminalIsSupported = isTerminalSizeSupported(terminalWidth, terminalHeight);
  const terminalSizeWarning = getTerminalSizeWarning(terminalWidth, terminalHeight);
  const backupImportPickerVisibleRows = Math.max(
    4,
    Math.min(BACKUP_IMPORT_PICKER_MAX_VISIBLE_ROWS, terminalHeight - 16)
  );
  const settingsRef = useRef(settingsState);
  const tasksRef = useRef(state.tasks);
  const notificationManagerRef = useRef<NotificationManager | null>(null);
  const modalBellNotifierRef = useRef<TerminalBellNotifier | null>(null);
  const evaluateNotificationsRef = useRef<(nowMs: number) => void>(() => {});

  settingsRef.current = settingsState;
  tasksRef.current = state.tasks;
  helpFocusedSectionRef.current = helpFocusedSectionIndex;

  if (!notificationManagerRef.current) {
    const inAppModalNotifier = new InAppModalNotifier({
      enqueueEvent: (event: TaskOverdueEvent) => {
        uiDispatch({ type: "enqueueNotificationModal", event });
      },
      isEnabled: () => isInAppOverdueEnabled(settingsRef.current.notifications)
    });
    modalBellNotifierRef.current = new TerminalBellNotifier({
      isEnabled: () => isTerminalBellOverdueEnabled(settingsRef.current.notifications),
      getCooldownMs: () => getTerminalBellCooldownMs(settingsRef.current.notifications)
    });
    const osNotifier = new OSNotifier();
    notificationManagerRef.current = new NotificationManager([
      inAppModalNotifier,
      osNotifier
    ]);
  }

  evaluateNotificationsRef.current = (nowMs: number) => {
    notificationManagerRef.current?.evaluate(tasksRef.current, nowMs);
  };

  // Force a frame request on mode/size transitions so borders are repainted
  // after layout shape changes (list/details <-> dashboard).
  useEffect(() => {
    renderer.requestRender();
  }, [renderer, uiState.mode, terminalWidth, terminalHeight]);

  useEffect(() => {
    editorDraftRef.current = state.editor;
    if (state.editor) return;
    resetEditorSessionTracking();
  }, [state.editor]);

  useEffect(() => {
    selectedRowIdRef.current = state.selectedId;
  }, [state.selectedId]);

  const now = Date.now();
  const dayKey = startOfLocalDayMs(now);
  const analyticsWindow = state.filters.analyticsWindow ?? "7d";
  const analyticsWindowDays = resolveAnalyticsWindowDays(analyticsWindow);
  const visibleTaskRows = buildVisibleTaskRows(
    state.tasks,
    state.filters,
    state.sortMode,
    now
  );
  const selectedTask =
    visibleTaskRows.find((task) => task.id === state.selectedId) ?? visibleTaskRows[0];
  const bulkActive = bulkMarkedTaskIds.length > 0;
  const bulkMarkedTaskIdSet = React.useMemo(
    () => new Set(bulkMarkedTaskIds),
    [bulkMarkedTaskIds]
  );
  const activeHelpPage = helpNavStack[helpNavStack.length - 1] ?? "help";
  const resolvedKeymapAliases = React.useMemo(
    () => resolveKeymapAliases(settingsState.keymapAliases),
    [settingsState.keymapAliases]
  );
  const whichKeyContext = resolveWhichKeyContext({
    mode: uiState.mode,
    focus: uiState.focus,
    backupScreen: uiState.mode === Mode.BACKUP_CENTER ? backupState.screen : null
  });
  const whichKeyHintItems = React.useMemo(
    () =>
      buildWhichKeyHintItems({
        context: whichKeyContext,
        resolvedAliases: resolvedKeymapAliases
      }),
    [whichKeyContext, resolvedKeymapAliases]
  );
  const leftRailHintLines = React.useMemo(
    () =>
      buildLeftRailHintLines({
        context: whichKeyContext,
        resolvedAliases: resolvedKeymapAliases
      }),
    [whichKeyContext, resolvedKeymapAliases]
  );
  const whichKeyPrefixPopup = React.useMemo(
    () =>
      buildWhichKeyPrefixPopup({
        pendingGPrefix,
        resolvedAliases: resolvedKeymapAliases
      }),
    [pendingGPrefix, resolvedKeymapAliases]
  );
  const persistedCustom1 = React.useMemo(
    () => resolveCustom1Config(settingsState.customThemes),
    [settingsState.customThemes]
  );
  const persistedBuiltInTextConfig = React.useMemo(
    () => resolveBuiltInThemeTextConfig(settingsState.customThemes, helpTextTuningThemeId),
    [helpTextTuningThemeId, settingsState.customThemes]
  );
  const builtInTextBaseTokens = React.useMemo(
    () => ({
      text: THEMES[helpTextTuningThemeId].text,
      mutedText: THEMES[helpTextTuningThemeId].mutedText,
      selectionText: THEMES[helpTextTuningThemeId].selectionText
    }),
    [helpTextTuningThemeId]
  );
  const custom1Draft: CustomThemeConfig = React.useMemo(
    () => ({
      global: custom1DraftGlobal,
      objects: Object.keys(custom1DraftObjects).length > 0 ? custom1DraftObjects : undefined
    }),
    [custom1DraftGlobal, custom1DraftObjects]
  );
  const builtInTextDraft: BuiltInThemeTextOverrides = React.useMemo(() => {
    const global = sanitizeThemeTextTokenOverrides(builtInTextDraftGlobal);
    const objects = sanitizeThemeTextObjectOverrides(builtInTextDraftObjects);
    if (!global && !objects) {
      return {};
    }
    const config: BuiltInThemeTextOverrideConfig = {};
    if (global) {
      config.global = global;
    }
    if (objects) {
      config.objects = objects;
    }
    return {
      [helpTextTuningThemeId]: config
    };
  }, [builtInTextDraftGlobal, builtInTextDraftObjects, helpTextTuningThemeId]);
  const clampedHelpFocusedSectionIndex = Math.max(
    0,
    Math.min(helpFocusedSectionIndex, HELP_MENU_SECTIONS.length - 1)
  );
  const { rows: helpRows, sections: helpSections } = React.useMemo(
    () => buildHelpRows(helpExpandedBySection),
    [helpExpandedBySection]
  );
  const helpNavItems =
    activeHelpPage === "settings"
      ? HELP_SETTINGS_NAV_ITEMS
      : activeHelpPage === "keymapAliases"
        ? HELP_KEYMAP_ALIAS_NAV_ITEMS
      : activeHelpPage === "theme"
        ? HELP_THEME_NAV_ITEMS
      : activeHelpPage === "custom1"
        ? HELP_CUSTOM1_NAV_ITEMS
      : activeHelpPage === "textTuning"
        ? HELP_TEXT_TUNING_NAV_ITEMS
        : activeHelpPage === "textTuningTheme"
          ? HELP_TEXT_TUNING_THEME_NAV_ITEMS
          : [];
  const helpNavSelectionIndex =
    activeHelpPage === "settings"
      ? helpNavSelection.settings
      : activeHelpPage === "keymapAliases"
        ? helpNavSelection.keymapAliases
      : activeHelpPage === "theme"
        ? helpNavSelection.theme
      : activeHelpPage === "custom1"
        ? helpNavSelection.custom1
        : activeHelpPage === "textTuning"
          ? helpNavSelection.textTuning
          : activeHelpPage === "textTuningTheme"
            ? helpNavSelection.textTuningTheme
          : 0;
  const clampedHelpNavSelectionIndex =
    helpNavItems.length === 0
      ? 0
      : Math.max(0, Math.min(helpNavSelectionIndex, helpNavItems.length - 1));
  const helpNavLineCount = getHelpNavLineCount(activeHelpPage, helpNavItems.length);
  const helpBodyLineCount =
    activeHelpPage === "help"
      ? helpRows.length
      : activeHelpPage === "custom1Edit" || activeHelpPage === "textTuningEdit"
        ? 22
        : Math.max(4, helpNavLineCount);
  const helpPanelMaxWidth = Math.max(20, terminalWidth - HELP_PANEL_HORIZONTAL_MARGIN * 2);
  const helpPanelWidthMin = Math.min(HELP_PANEL_MIN_WIDTH, helpPanelMaxWidth);
  const helpPanelWidthMax = Math.min(HELP_PANEL_MAX_WIDTH, helpPanelMaxWidth);
  const helpPanelWidth = clampToBounds(
    Math.floor(terminalWidth * 0.9),
    helpPanelWidthMin,
    helpPanelWidthMax
  );
  const helpPanelMaxHeight = Math.max(8, terminalHeight - HELP_PANEL_VERTICAL_MARGIN * 2);
  const helpPanelDesiredHeight =
    helpBodyLineCount + HELP_PANEL_CHROME_ROWS + HELP_PANEL_BORDER_ROWS;
  const helpPanelHeight = clampToBounds(
    helpPanelDesiredHeight,
    Math.min(HELP_PANEL_MIN_HEIGHT, helpPanelMaxHeight),
    helpPanelMaxHeight
  );
  const helpPanelInnerWidth = Math.max(1, helpPanelWidth - HELP_PANEL_BORDER_COLS);
  const helpPanelInnerHeight = Math.max(1, helpPanelHeight - HELP_PANEL_BORDER_ROWS);
  const helpContentVisibleRows = Math.max(1, helpPanelInnerHeight - HELP_PANEL_CHROME_ROWS);
  const helpHasOverflow = helpBodyLineCount > helpContentVisibleRows;
  const helpFooterWidth = Math.max(1, helpPanelInnerWidth - 2);
  const helpCloseButtonLabel = pickHelpCloseButtonLabel(Math.max(0, helpFooterWidth - 1));
  const helpCloseButtonWidth = helpCloseButtonLabel ? helpCloseButtonLabel.length + 2 : 0;
  const helpFooterHintLineWidth = Math.max(
    1,
    helpFooterWidth - helpCloseButtonWidth - (helpCloseButtonWidth > 0 ? 1 : 0)
  );
  // Reserve one column when Help content overflows so wrapped lines do not add
  // phantom rows and desync focus scroll math.
  const helpContentLineWidth = Math.max(1, helpFooterWidth - (helpHasOverflow ? 1 : 0));
  const helpPageStep = Math.max(1, helpContentVisibleRows - 1);
  const clampedHelpScrollOffset = clampScrollOffset(
    helpScrollOffset,
    helpContentVisibleRows,
    helpRows.length
  );
  const clampedHelpNavScrollOffset = clampScrollOffset(
    helpNavScrollOffset,
    helpContentVisibleRows,
    helpNavLineCount
  );
  const helpVisibleRows =
    activeHelpPage === "help"
      ? helpRows.slice(
          clampedHelpScrollOffset,
          clampedHelpScrollOffset + helpContentVisibleRows
        )
      : helpRows;
  const helpScrollbarThumb =
    activeHelpPage === "help"
      ? computeHelpScrollbarThumb({
          scrollOffset: clampedHelpScrollOffset,
          visibleRows: helpContentVisibleRows,
          itemCount: helpRows.length
        })
      : null;
  const helpNavVisibleRowCount =
    activeHelpPage === "help" ||
    activeHelpPage === "custom1Edit" ||
    activeHelpPage === "textTuningEdit"
      ? 0
      : Math.max(
          0,
          Math.min(helpContentVisibleRows, helpNavLineCount - clampedHelpNavScrollOffset)
        );
  const helpNavScrollbarThumb =
    activeHelpPage !== "help" &&
    activeHelpPage !== "custom1Edit" &&
    activeHelpPage !== "textTuningEdit"
      ? computeHelpScrollbarThumb({
          scrollOffset: clampedHelpNavScrollOffset,
          visibleRows: helpContentVisibleRows,
          itemCount: helpNavLineCount
        })
      : null;
  const helpFooterHintsRaw =
    activeHelpPage === "help"
      ? helpHasOverflow
        ? "1 Backup Center | Enter/Right on Settings opens Settings pages | Up/Down focus | Enter/Space expand | Left collapse | Esc close | Scroll"
        : "1 Backup Center | Enter/Right on Settings opens Settings pages | Up/Down focus | Enter/Space expand | Left collapse | Esc close"
      : activeHelpPage === "custom1Edit" || activeHelpPage === "textTuningEdit"
        ? "S save | C/Esc cancel | R reset token | Tab next focus | Arrows adjust/jump | Enter commit"
        : activeHelpPage === "settings" &&
            clampedHelpNavSelectionIndex === HELP_SETTINGS_LOGO_NAV_INDEX
          ? "Left/Right preview logo | Enter commit | Esc/Backspace back"
        : "Up/Down move | Enter/Right select | Left/Backspace/Esc back";
  const helpFooterHintsLine = fitLineToWidth(
    helpFooterHintsRaw,
    helpFooterHintLineWidth
  );
  const helpFooterDataPathLine = fitLineToWidth(
    `Data path: ${redactPathForDisplay(getDataFilePath())}`,
    helpFooterWidth
  );
  const helpHeaderTitle =
    activeHelpPage === "help"
      ? "Help"
      : activeHelpPage === "settings"
        ? "Help / Settings"
        : activeHelpPage === "keymapAliases"
          ? "Help / Settings / Keymap Aliases"
        : activeHelpPage === "theme"
          ? "Help / Settings / Theme"
          : activeHelpPage === "custom1"
            ? "Help / Settings / Theme / Custom1"
            : activeHelpPage === "custom1Edit"
              ? "Help / Settings / Theme / Custom1 / Edit Colors"
              : activeHelpPage === "textTuning"
                ? "Help / Settings / Theme / Text Tuning"
                : activeHelpPage === "textTuningTheme"
                  ? `Help / Settings / Theme / Text Tuning / ${formatThemeIdLabel(helpTextTuningThemeId)}`
                  : `Help / Settings / Theme / Text Tuning / ${formatThemeIdLabel(helpTextTuningThemeId)} / Edit Text Colors`;
  const helpTheme = themeForObject("help");
  const modalTheme = themeForObject("modal");
  const inputTheme = themeForObject("inputs");
  const notificationsTheme = themeForObject("notifications");
  const taskListTheme = themeForObject("taskList");
  const dashboardTheme = themeForObject("dashboard");

  function findTaskById(taskId: string | undefined): Task | undefined {
    if (!taskId) return undefined;
    return state.tasks.find((task) => task.id === taskId);
  }

  function findTaskForOverdueEvent(event: TaskOverdueEvent): Task | undefined {
    return findTaskById(event.taskId);
  }

  function findSeriesTaskBySeriesId(seriesId: string | undefined): Task | undefined {
    if (!seriesId) return undefined;
    return state.tasks.find((task) => task.recurrence?.series_id === seriesId);
  }

  function findMaterializedInstance(
    seriesId: string | undefined,
    occurrenceIso: string | undefined
  ): Task | undefined {
    if (!seriesId || !occurrenceIso) return undefined;
    return state.tasks.find(
      (task) =>
        task.instance_of?.series_id === seriesId &&
        task.instance_of?.occurrence === occurrenceIso
    );
  }

  function resolvePersistedTaskForRow(row: VisibleTaskRow | undefined): Task | undefined {
    if (!row) return undefined;
    if (row.rowKind === "series_occurrence_virtual") {
      return findTaskById(row.sourceTaskId);
    }
    return findTaskById(row.id);
  }

  function resetEditorSessionTracking() {
    editorDraftRef.current = null;
    editorDirtyIntentRef.current = false;
    editorTargetRowIdRef.current = undefined;
    editorBaselineDraftRef.current = null;
  }

  const selectedPersistedTask = resolvePersistedTaskForRow(selectedTask);
  const selectedTaskLinks = selectedPersistedTask?.links ?? [];
  const selectedTaskLinkIdsKey = selectedTaskLinks.map((link) => link.id).join("|");
  const selectedTaskLink = selectedTaskLinks.find((link) => link.id === selectedLinkId);
  const selectedChecklistTask =
    selectedTask?.rowKind === "series_occurrence_virtual"
      ? selectedTask
      : selectedPersistedTask;
  const selectedChecklistItems = sortChecklistItems(selectedChecklistTask?.checklist ?? []);
  const selectedChecklistItemIdsKey = selectedChecklistItems
    .map((item) => item.id)
    .join("|");
  const selectedChecklistItem =
    selectedChecklistItems.find((item) => item.id === selectedChecklistItemId) ??
    selectedChecklistItems[0];
  const editorChecklistItems = sortChecklistItems(state.editor?.checklist ?? []);
  const editorChecklistItemIdsKey = editorChecklistItems.map((item) => item.id).join("|");
  const selectedEditorChecklistItem =
    editorChecklistItems.find((item) => item.id === selectedEditorChecklistItemId) ??
    editorChecklistItems[0];
  const retroFxMode = settingsState.retroFxMode;
  const isRetroFxActive = retroFxMode !== "off";
  const bottomBarHeight = 3;
  const retroFxTickIntervalMs = isRetroFxActive
    ? RETRO_FX_TICK_INTERVAL_BY_MODE[retroFxMode]
    : 0;

  const listHeaderHeight = 2;
  const topBarHeight = 4;
  const activeBanners = [startupBannerMessage, saveFailureBanner, navigationBanner].filter(
    (value): value is string => Boolean(value)
  );
  const bannerHeight = activeBanners.length;
  const listPanelBorder = 2;
  const listPanelPadding = 2;
  const searchHeight = uiState.mode === Mode.SEARCH ? 3 : 0;
  const taskRowHeight = 3; // Keep in sync with TaskRow layout height.
  const listContentHeight =
    terminalHeight -
    topBarHeight -
    bottomBarHeight -
    bannerHeight -
    listHeaderHeight -
    listPanelBorder -
    listPanelPadding -
    searchHeight;
  const visibleLines = Math.max(1, listContentHeight);
  const visibleRows = Math.max(1, Math.floor(visibleLines / taskRowHeight));
  const editorPaneHeightLines = Math.max(
    1,
    terminalHeight -
      topBarHeight -
      bottomBarHeight -
      bannerHeight -
      listHeaderHeight -
      listPanelBorder -
      listPanelPadding
  );
  const { contentHeight: editorContentVisibleLines } =
    getEditorViewportHeights(editorPaneHeightLines);
  const editorPageStep = Math.max(1, editorContentVisibleLines - 1);
  const checklistViewportRows = Math.max(3, Math.min(8, editorPaneHeightLines - 18));
  const selectedChecklistIndex = selectedChecklistItem
    ? selectedChecklistItems.findIndex((item) => item.id === selectedChecklistItem.id)
    : -1;
  const dashboardPaneWidth = Math.max(20, terminalWidth - layout.railWidth - 4);
  const dashboardPaneHeight = Math.max(
    8,
    terminalHeight - topBarHeight - bottomBarHeight - bannerHeight - 4
  );
  const startOfToday = dayKey;
  const selectedDayDiff =
    selectedTask && selectedTask.status === "open" && selectedTask.dueAt !== undefined
      ? diffLocalDays(selectedTask.dueAt, startOfToday)
      : null;
  const selectedHasTime = selectedTask?.hasExplicitTime === true;
  const selectedTimeOverdue =
    selectedTask &&
    selectedTask.status === "open" &&
    selectedHasTime &&
    selectedDayDiff === 0 &&
    selectedTask.dueAt !== undefined &&
    now > selectedTask.dueAt;
  const selectedDueToday = selectedDayDiff === 0 && !selectedTimeOverdue;
  const selectedDueSoon =
    selectedDayDiff !== null && selectedDayDiff >= 1 && selectedDayDiff <= 7;
  const selectedDueLater = selectedDayDiff !== null && selectedDayDiff >= 8;
  const selectedOverdue =
    selectedDayDiff !== null && (selectedDayDiff < 0 || selectedTimeOverdue);
  const isStaticFlashMode = settingsState.flashMode === "static";
  const visibleBaseMode =
    uiState.mode === Mode.TAG_FILTER ? uiState.previousMode : uiState.mode;
  const isDashboardMode = visibleBaseMode === Mode.DASHBOARD;
  const isBackupMode = visibleBaseMode === Mode.BACKUP_CENTER;
  const selectedHeaderBackground = isBackupMode
    ? theme.accentBlue
    : selectedOverdue
      ? isStaticFlashMode
        ? theme.warn
        : fastPulseOn
          ? theme.warn
          : theme.dueSoon
      : selectedDueToday
        ? theme.dueSoon
        : selectedDueSoon
          ? theme.dueSoon
          : selectedDueLater
            ? theme.dueLater
            : selectedTask?.status === "done"
              ? theme.ok
              : theme.accentOrange;

  const summaryOverdueRows = React.useMemo(
    () => buildVisibleTaskRows(state.tasks, { status: "open", due: "overdue" }, state.sortMode, now),
    [state.tasks, state.sortMode, now]
  );
  const summaryTodayRows = React.useMemo(
    () => buildVisibleTaskRows(state.tasks, { status: "open", due: "today" }, state.sortMode, now),
    [state.tasks, state.sortMode, now]
  );
  const summaryNext7Rows = React.useMemo(
    () => buildVisibleTaskRows(state.tasks, { status: "open", due: "next7" }, state.sortMode, now),
    [state.tasks, state.sortMode, now]
  );
  const summaryDoneRows = React.useMemo(
    () => buildVisibleTaskRows(state.tasks, { status: "done", due: "any" }, state.sortMode, now),
    [state.tasks, state.sortMode, now]
  );
  const summary = summaryDoneRows.reduce(
    (acc, task) => {
      const closedAt = task.closedAt ?? task.updatedAt;
      const closedDiff = diffLocalDays(closedAt, startOfToday);
      if (closedDiff <= 0 && closedDiff >= -6) {
        acc.completed7 += 1;
      }
      return acc;
    },
    {
      overdue: summaryOverdueRows.length,
      today: summaryTodayRows.length,
      next7: summaryNext7Rows.length,
      completed7: 0
    }
  );

  const summaryTagRows = React.useMemo(
    () => buildVisibleTaskRows(state.tasks, { status: "all", due: "any" }, state.sortMode, now),
    [state.tasks, state.sortMode, now]
  );

  const tagStats = React.useMemo(
    () => computeTopTagStats(summaryTagRows, dayKey, 5),
    [summaryTagRows, dayKey]
  );
  const openPriorityStats = React.useMemo(
    () => computeOpenPriorityStats(state.tasks),
    [state.tasks]
  );

  const bottomBarWidth = Math.max(0, terminalWidth - layout.railWidth);
  const bottomBarContentWidth = Math.max(0, bottomBarWidth - 2);
  const tagTickerSegments = React.useMemo(
    () => buildTagTickerSegments(tagStats, bottomBarContentWidth),
    [tagStats, bottomBarContentWidth]
  );
  const priorityTickerSegments = React.useMemo(
    () => buildPriorityTickerSegments(openPriorityStats, bottomBarContentWidth),
    [openPriorityStats, bottomBarContentWidth]
  );
  const priorityTickerNeedsWiderLayout =
    openPriorityStats.length > 0 && priorityTickerSegments.length === 0;
  const dashboardTopTagLimit = React.useMemo(
    () => resolveDashboardTopTagLimit(dashboardPaneHeight),
    [dashboardPaneHeight]
  );
  const dashboardTopTags = React.useMemo(
    () => computeTopTagsOpen(visibleTaskRows, dashboardTopTagLimit),
    [visibleTaskRows, dashboardTopTagLimit]
  );
  const clampedDashboardTagSelection =
    dashboardTopTags.length === 0
      ? 0
      : Math.max(0, Math.min(dashboardTagSelection, dashboardTopTags.length - 1));
  const clampedDashboardDueBucketSelection = Math.max(
    0,
    Math.min(dashboardDueBucketSelection, 7)
  );
  const dashboardPriorityBuckets = React.useMemo(
    () => computePriorityBucketBreakdown(visibleTaskRows),
    [visibleTaskRows]
  );
  const clampedDashboardPrioritySelection =
    dashboardPriorityBuckets.length === 0
      ? 0
      : Math.max(0, Math.min(dashboardPrioritySelection, dashboardPriorityBuckets.length - 1));
  const dashboardAssigneeSlices = React.useMemo(
    () => computeTopSliceCounts(visibleTaskRows, (task) => task.assignee, 5),
    [visibleTaskRows]
  );
  const dashboardProjectSlices = React.useMemo(
    () => computeTopSliceCounts(visibleTaskRows, (task) => task.project, 5),
    [visibleTaskRows]
  );
  const dashboardWorkflowStageSlices = React.useMemo(
    () => computeWorkflowStageSliceCounts(visibleTaskRows),
    [visibleTaskRows]
  );
  const clampedDashboardAssigneeSelection =
    dashboardAssigneeSlices.length === 0
      ? 0
      : Math.max(0, Math.min(dashboardAssigneeSelection, dashboardAssigneeSlices.length - 1));
  const clampedDashboardProjectSelection =
    dashboardProjectSlices.length === 0
      ? 0
      : Math.max(0, Math.min(dashboardProjectSelection, dashboardProjectSlices.length - 1));
  const clampedDashboardWorkflowStageSelection =
    dashboardWorkflowStageSlices.length === 0
      ? 0
      : Math.max(
          0,
          Math.min(dashboardWorkflowStageSelection, dashboardWorkflowStageSlices.length - 1)
        );
  const overdueQuickFilterActive =
    state.filters.status === "open" &&
    state.filters.due === "overdue" &&
    state.filters.dueDayOffset === undefined;
  const todayQuickFilterActive =
    state.filters.status === "open" &&
    state.filters.due === "today" &&
    state.filters.dueDayOffset === undefined;
  const next7QuickFilterActive =
    state.filters.status === "open" &&
    state.filters.due === "next7" &&
    state.filters.dueDayOffset === undefined;
  const doneQuickFilterActive =
    state.filters.status === "done" &&
    state.filters.due === "any" &&
    state.filters.dueDayOffset === undefined;

  const titleQuery = state.editor ? getTitleQuery(state.editor.title) : null;
  const titleSuggestions = titleQuery ? rankTaskTitles(state.tasks, titleQuery) : [];
  const titleInlineSuggestion = titleQuery
    ? getTitleCompletion(titleQuery, titleSuggestions)
    : null;
  const predictiveTagIndex = React.useMemo(
    () => mergeTagIndexWithTaskHistory(state.tagIndex, state.tasks),
    [state.tagIndex, state.tasks]
  );
  const tagQuery = state.editor ? getTagQuery(state.editor.tagsText) : null;
  const tagSuggestions = tagQuery ? rankTags(predictiveTagIndex, tagQuery) : [];
  const tagInlineSuggestion = tagQuery
    ? getTagCompletion(tagQuery, tagSuggestions)
    : null;
  const tagFilterQuery = uiState.mode === Mode.TAG_FILTER
    ? normalizeTagPrefix(tagFilterInput)
    : "";
  const tagFilterSuggestions = tagFilterQuery
    ? rankTags(predictiveTagIndex, tagFilterQuery).filter((tag) => !isPriorityToken(tag))
    : [];
  const tagFilterInlineSuggestion = tagFilterQuery
    ? getTagCompletion(tagFilterQuery, tagFilterSuggestions)
    : null;
  const selectedThemeMode = helpPreviewThemeMode ?? settingsState.themeId;
  const activeThemeId =
    selectedThemeMode === "rotating"
      ? ROTATING_THEME_ORDER[rotatingThemeIndex % ROTATING_THEME_ORDER.length]
      : selectedThemeMode;
  const crtFxPreset: CrtFxLitePreset = settingsState.crtFxPreset;
  const crtFxTickIntervalMs = CRT_FX_TICK_INTERVAL_BY_PRESET[crtFxPreset];
  const isCrtFxLiteActive = settingsState.crtFxLite;
  const headerBackgroundColor = resolveCrtFxColor({
    baseColor: isDashboardMode ? theme.accentBlue : selectedHeaderBackground,
    enabled: isCrtFxLiteActive,
    preset: crtFxPreset,
    color: settingsState.crtFxColor,
    tick: crtFxTick,
    role: "accent"
  });
  const headerBorderColor = resolveRetroSweepBorderColor({
    baseColor: resolveCrtFxColor({
      baseColor: theme.outline,
      enabled: isCrtFxLiteActive,
      preset: crtFxPreset,
      color: settingsState.crtFxColor,
      tick: crtFxTick,
      role: "border"
    }),
    mode: retroFxMode,
    tick: retroFxTick,
    phase: 2
  });
  const railPanelBackgroundColor = theme.accentPurple;
  const railPanelBorderColor = theme.outline;
  const taskListPanelBackgroundColor = resolveCrtFxColor({
    baseColor: taskListTheme.panel,
    enabled: isCrtFxLiteActive,
    preset: crtFxPreset,
    color: settingsState.crtFxColor,
    tick: crtFxTick,
    role: "panel"
  });
  const taskListPanelBorderColor = resolveRetroSweepBorderColor({
    baseColor: resolveCrtFxColor({
      baseColor: taskListTheme.outline,
      enabled: isCrtFxLiteActive,
      preset: crtFxPreset,
      color: settingsState.crtFxColor,
      tick: crtFxTick,
      role: "border"
    }),
    mode: retroFxMode,
    tick: retroFxTick,
    phase: 4
  });
  const detailsPanelBackgroundColor = resolveCrtFxColor({
    baseColor: theme.panel,
    enabled: isCrtFxLiteActive,
    preset: crtFxPreset,
    color: settingsState.crtFxColor,
    tick: crtFxTick,
    role: "panel"
  });
  const detailsPanelBorderColor = resolveRetroSweepBorderColor({
    baseColor: resolveCrtFxColor({
      baseColor: theme.outline,
      enabled: isCrtFxLiteActive,
      preset: crtFxPreset,
      color: settingsState.crtFxColor,
      tick: crtFxTick,
      role: "border"
    }),
    mode: retroFxMode,
    tick: retroFxTick,
    phase: 6
  });
  const dashboardPanelBackgroundColor = resolveCrtFxColor({
    baseColor: dashboardTheme.panel,
    enabled: isCrtFxLiteActive,
    preset: crtFxPreset,
    color: settingsState.crtFxColor,
    tick: crtFxTick,
    role: "panel"
  });
  const dashboardPanelBorderColor = resolveRetroSweepBorderColor({
    baseColor: resolveCrtFxColor({
      baseColor: dashboardTheme.outline,
      enabled: isCrtFxLiteActive,
      preset: crtFxPreset,
      color: settingsState.crtFxColor,
      tick: crtFxTick,
      role: "border"
    }),
    mode: retroFxMode,
    tick: retroFxTick,
    phase: 8
  });
  const bottomBarBackgroundColor = resolveCrtFxColor({
    baseColor: theme.panel,
    enabled: isCrtFxLiteActive,
    preset: crtFxPreset,
    color: settingsState.crtFxColor,
    tick: crtFxTick,
    role: "panel"
  });
  const bottomBarBorderColor = resolveRetroSweepBorderColor({
    baseColor: resolveCrtFxColor({
      baseColor: theme.outline,
      enabled: isCrtFxLiteActive,
      preset: crtFxPreset,
      color: settingsState.crtFxColor,
      tick: crtFxTick,
      role: "border"
    }),
    mode: retroFxMode,
    tick: retroFxTick,
    phase: 10
  });
  const helpThemeStatusLineRaw = helpPreviewThemeMode
    ? `Theme mode: ${formatThemeDisplayName(settingsState.themeId)} (preview: ${formatThemeDisplayName(helpPreviewThemeMode)})`
    : settingsState.themeId === "rotating"
      ? `Theme mode: Rotating (active: ${formatThemeDisplayName(activeThemeId)})`
      : `Theme mode: ${formatThemeDisplayName(settingsState.themeId)}`;
  const effectiveLogoModeForHelp = helpDraftLogoMode ?? settingsState.logoMode;
  const helpLogoStatusLineRaw =
    helpDraftLogoMode && helpDraftLogoMode !== settingsState.logoMode
      ? `Logo: ${formatLogoModeLabel(settingsState.logoMode)} (preview: ${formatLogoModeLabel(helpDraftLogoMode)})`
      : `Logo: ${formatLogoModeLabel(settingsState.logoMode)}`;
  const helpThemeStatusLine = fitLineToWidth(
    `    ${helpThemeStatusLineRaw}`,
    helpContentLineWidth
  );
  const helpLogoStatusLine = fitLineToWidth(
    `    ${helpLogoStatusLineRaw}`,
    helpContentLineWidth
  );
  const helpNavigationHintsStatusLine = fitLineToWidth(
    `    Navigation hints: ${formatHintDisplayModeStatusLabel(settingsState.hintDisplayMode)}`,
    helpContentLineWidth
  );
  const helpPrefixPopupStatusLine = fitLineToWidth(
    `    Prefix popup: ${settingsState.showPrefixHintPopup ? "on" : "off"}`,
    helpContentLineWidth
  );
  const helpFlashStatusLine = fitLineToWidth(
    `    Flash mode: ${settingsState.flashMode}`,
    helpContentLineWidth
  );
  const helpCrtFxLiteState = settingsState.crtFxLite ? "on" : "off";
  const helpCrtFxLiteStatusLine = fitLineToWidth(
    `    CRT FX Lite: ${helpCrtFxLiteState}`,
    helpContentLineWidth
  );
  const helpCrtFxProfileLabel = formatCrtFxLiteProfileLabel(
    settingsState.crtFxColor,
    settingsState.crtFxPreset
  );
  const helpCrtFxProfileStatusLine = fitLineToWidth(
    `    CRT FX Profile: ${helpCrtFxProfileLabel}`,
    helpContentLineWidth
  );
  const helpRetroFxModeStatusLine = fitLineToWidth(
    `    Retro FX Mode: ${formatRetroFxModeLabel(settingsState.retroFxMode)}`,
    helpContentLineWidth
  );
  const helpNotificationsEnabledStatusLine = fitLineToWidth(
    `    Notifications: ${settingsState.notifications.enabled ? "on" : "off"}`,
    helpContentLineWidth
  );
  const helpInAppBannerStatusLine = fitLineToWidth(
    `    Overdue popup: ${settingsState.notifications.inAppOverdueBanner ? "on" : "off"}`,
    helpContentLineWidth
  );
  const helpTerminalBellStatusLine = fitLineToWidth(
    `    Terminal bell: ${settingsState.notifications.terminalBellOnOverdue ? "on" : "off"}`,
    helpContentLineWidth
  );
  const helpSettingsStatusLines = [
    helpThemeStatusLine.trim(),
    helpNavigationHintsStatusLine.trim(),
    helpPrefixPopupStatusLine.trim(),
    helpLogoStatusLine.trim(),
    helpFlashStatusLine.trim(),
    helpCrtFxLiteStatusLine.trim(),
    helpCrtFxProfileStatusLine.trim(),
    helpRetroFxModeStatusLine.trim(),
    helpNotificationsEnabledStatusLine.trim(),
    helpInAppBannerStatusLine.trim(),
    helpTerminalBellStatusLine.trim()
  ];
  const helpKeymapAliasPresetStates = {
    list: resolveKeymapAliasPresetState("list", settingsState.keymapAliases),
    dashboard: resolveKeymapAliasPresetState("dashboard", settingsState.keymapAliases),
    backup: resolveKeymapAliasPresetState("backup", settingsState.keymapAliases),
    help: resolveKeymapAliasPresetState("help", settingsState.keymapAliases)
  } as const;
  const helpNavStatusLineCount =
    activeHelpPage === "settings" ? helpSettingsStatusLines.length : 0;
  function resolveHelpNavItemTitle(item: HelpNavItem, index: number): string {
    if (activeHelpPage === "theme" && index === 0) {
      return helpThemeStatusLineRaw;
    }
    if (activeHelpPage === "settings" && index === HELP_SETTINGS_LOGO_NAV_INDEX) {
      return `Logo: ${formatLogoModeLabel(effectiveLogoModeForHelp)}`;
    }
    if (activeHelpPage === "settings" && index === HELP_SETTINGS_NAVIGATION_HINTS_NAV_INDEX) {
      return `Navigation Hints: ${formatHintDisplayModeLabel(settingsState.hintDisplayMode)}`;
    }
    if (activeHelpPage === "settings" && index === HELP_SETTINGS_PREFIX_POPUP_NAV_INDEX) {
      return `Prefix Popup: ${settingsState.showPrefixHintPopup ? "on" : "off"}`;
    }
    if (activeHelpPage === "settings" && index === HELP_SETTINGS_RETRO_FX_MODE_NAV_INDEX) {
      return `Retro FX Mode: ${formatRetroFxModeLabel(settingsState.retroFxMode)}`;
    }
    if (activeHelpPage === "keymapAliases") {
      if (index === 0) {
        return `List aliases: ${formatKeymapAliasPresetState(helpKeymapAliasPresetStates.list)}`;
      }
      if (index === 1) {
        return `Dashboard aliases: ${formatKeymapAliasPresetState(helpKeymapAliasPresetStates.dashboard)}`;
      }
      if (index === 2) {
        return `Backup aliases: ${formatKeymapAliasPresetState(helpKeymapAliasPresetStates.backup)}`;
      }
      if (index === 3) {
        return `Help aliases: ${formatKeymapAliasPresetState(helpKeymapAliasPresetStates.help)}`;
      }
    }
    return item.title;
  }
  const dueSuggestion =
    uiState.focus === FocusTarget.EDITOR_DUE_DATE && state.editor
      ? getDueSuggestion(state.editor.dueText, now)
      : null;
  const dueSuggestionHint = dueSuggestion ? `→ ${dueSuggestion} (press →)` : null;

  const timeAutocompleteStep =
    isEditorMode(uiState.mode) &&
    uiState.focus === FocusTarget.EDITOR_DUE_TIME &&
    state.editor &&
    timeSuggestion
      ? getAutocompleteStep(state.editor.timeText, timeSuggestion)
      : "none";
  const timeSuggestionHint =
    timeAutocompleteStep === "hour" && timeSuggestion
      ? `→ ${timeSuggestion.hh}`
      : timeAutocompleteStep === "minute" && timeSuggestion
        ? `→ ${timeSuggestion.hh}:${timeSuggestion.mm}`
        : null;
  const editorDueTime = state.editor
    ? combineDueDateTime(state.editor.dueText, state.editor.timeText)
    : { dueAt: undefined, hasExplicitTime: false };
  const recurrencePreview = state.editor
    ? buildRecurrencePreviewFromDraft(
        state.editor,
        editorDueTime.dueAt,
        editorDueTime.hasExplicitTime,
        now,
        3
      )
    : [];
  const activeOverdueModal =
    uiState.mode === Mode.MODAL_CONFIRM && uiState.modal?.type === "overdue"
      ? uiState.modal
      : null;
  const activeOverdueTask = activeOverdueModal
    ? findTaskForOverdueEvent(activeOverdueModal.event)
    : undefined;
  const isNuxIdle =
    uiState.modal === null &&
    uiState.notificationModalQueue.length === 0 &&
    uiState.mode === Mode.LIST;
  const activeEmptyNuxStep: EmptyNuxStep = uiState.emptyNux?.step ?? "welcome";
  const blockingOverlayOpen = isBlockingOverlayOpen(uiState);
  const activeEngagementToast =
    !commandActive && !blockingOverlayOpen && state.engagementToastActive
      ? state.engagementToastActive
      : null;
  const showLeftRailHints =
    settingsState.hintDisplayMode === "left_rail" ||
    settingsState.hintDisplayMode === "both";
  const showBottomHintSurface =
    settingsState.hintDisplayMode === "bottom" ||
    settingsState.hintDisplayMode === "both";
  const suppressWhichKeyHints =
    commandActive || viewsOverlayOpen || saveViewPromptOpen || activeEngagementToast !== null;
  const showWhichKeyHintBar =
    showBottomHintSurface &&
    !suppressWhichKeyHints &&
    whichKeyHintItems.length > 0;
  const showWhichKeyPrefixPopup =
    settingsState.showPrefixHintPopup &&
    !suppressWhichKeyHints &&
    whichKeyPrefixPopup !== null &&
    uiState.mode === Mode.LIST &&
    uiState.focus === FocusTarget.TASK_LIST;
  const whichKeyHintBarBottom = bottomBarHeight + activeBanners.length + 1;
  const whichKeyPopupBottom = whichKeyHintBarBottom + (showWhichKeyHintBar ? 3 : 1);
  const engagementToastLine = activeEngagementToast
    ? fitLineToWidth(
        activeEngagementToast.message,
        Math.max(1, bottomBarWidth - 4)
      )
    : "";
  const commandOutputLine = commandOutput
    ? truncateToWidth(commandOutput.text.replace(/\s+/g, " ").trim(), Math.max(1, bottomBarWidth - 8))
    : "";
  const commandOverlayInnerWidth = Math.max(1, bottomBarContentWidth - 4);
  const commandHeaderLine = fitLineToWidth(
    "TITS — Terminal in Terminal System  ·  Esc Close  Enter Run  ↑/↓ History",
    commandOverlayInnerWidth
  );
  const commandIdleHintLine = fitLineToWidth(
    'Try: add "Buy milk" #errands  •  help',
    commandOverlayInnerWidth
  );
  const commandStatusLine = commandOutput
    ? fitLineToWidth(
        `${commandOutput.kind === "error" ? "ERR:" : "OK:"} ${commandOutputLine}`,
        commandOverlayInnerWidth
      )
    : commandIdleHintLine;
  const renderStartMs = Date.now();

  function formatSaveTimestamp(epochMs: number): string {
    const date = new Date(epochMs);
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mi = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
  }

  function handleSaveResult(result: SaveStateResult): void {
    if (result.ok) {
      lastSuccessfulSaveAtRef.current = result.savedAt;
      expectedStateRevisionRef.current = result.stateRevision;
      setSaveFailureBanner(null);
      setSaveConflictBannerState(null);
      setSaveConflictRetryPending(false);
      return;
    }

    const lastSavedAt = result.lastSuccessfulSaveAt ?? lastSuccessfulSaveAtRef.current;
    const summary = result.error.message || "Unknown persistence error";
    if (result.isRevisionConflict) {
      const expected = String(result.expectedStateRevision ?? "unknown");
      const actual = String(result.actualStateRevision ?? "unknown");
      const lastSaveText = lastSavedAt
        ? ` | Last successful save: ${formatSaveTimestamp(lastSavedAt)}`
        : "";
      setSaveConflictBannerState({
        filePath: result.filePath,
        expectedStateRevision: result.expectedStateRevision,
        actualStateRevision: result.actualStateRevision
      });
      setSaveFailureBanner(
        `Save blocked by concurrent update (expected revision ${expected}, found ${actual}). Press R or click to reload and retry. | Path: ${result.filePath}${lastSaveText}`
      );
      return;
    }
    setSaveConflictBannerState(null);
    const lastSaveText = lastSavedAt
      ? ` | Last successful save: ${formatSaveTimestamp(lastSavedAt)}`
      : "";
    setSaveFailureBanner(
      `Save failed: ${summary} | Path: ${result.filePath}${lastSaveText}`
    );
  }

  useEffect(() => {
    const id = setInterval(() => {
      const { data, changed } = applyArchiveAging(
        {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          tasks: state.tasks,
          tagIndex: state.tagIndex,
          savedViews: state.savedViews,
          engagement: state.engagement
        },
        Date.now()
      );
      if (changed) {
        dispatch({ type: "setTasks", tasks: data.tasks });
      }
    }, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [state.tasks, state.tagIndex, state.engagement, state.savedViews]);

  useEffect(() => {
    if (isStaticFlashMode) {
      setPulseOn(false);
      return;
    }
    const id = setInterval(() => {
      setPulseOn((prev) => !prev);
    }, SLOW_PULSE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isStaticFlashMode]);

  useEffect(() => {
    if (isStaticFlashMode) {
      setFastPulseOn(false);
      return;
    }
    const id = setInterval(() => {
      setFastPulseOn((prev) => !prev);
    }, FAST_PULSE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isStaticFlashMode]);

  useEffect(() => {
    if (!isCrtFxLiteActive) {
      setCrtFxTick(0);
      return;
    }
    const id = setInterval(() => {
      setCrtFxTick((previous) => (previous + 1) % 10_000);
    }, crtFxTickIntervalMs);
    return () => clearInterval(id);
  }, [crtFxTickIntervalMs, isCrtFxLiteActive]);

  useEffect(() => {
    if (!isRetroFxActive) {
      setRetroFxTick(0);
      return;
    }
    const id = setInterval(() => {
      setRetroFxTick((previous) => (previous + 1) % 10_000);
    }, retroFxTickIntervalMs);
    return () => clearInterval(id);
  }, [isRetroFxActive, retroFxTickIntervalMs]);

  useEffect(() => {
    const id = setInterval(() => {
      setBottomInfoView((prev) => {
        const index = BOTTOM_INFO_VIEW_ORDER.indexOf(prev);
        const safeIndex = index === -1 ? 0 : index;
        const nextIndex = (safeIndex + 1) % BOTTOM_INFO_VIEW_ORDER.length;
        return BOTTOM_INFO_VIEW_ORDER[nextIndex] ?? "summary";
      });
    }, TICKER_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setStartupBannerMessage(startupBanner ?? null);
  }, [startupBanner]);

  useEffect(() => {
    if (!showCorruptionRecoveryImportCta || !startupBannerMessage) {
      return;
    }
    const timeoutId = setTimeout(() => {
      setStartupBannerMessage(null);
    }, CORRUPTION_STARTUP_BANNER_AUTO_DISMISS_MS);
    return () => clearTimeout(timeoutId);
  }, [showCorruptionRecoveryImportCta, startupBannerMessage]);

  useEffect(() => {
    const id = setInterval(() => {
      evaluateNotificationsRef.current(Date.now());
    }, NOTIFICATION_EVALUATION_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      dispatch({
        type: "tickEngagementToast",
        now: Date.now(),
        overlayBlocked: blockingOverlayOpen
      });
    }, ENGAGEMENT_TOAST_TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [blockingOverlayOpen]);

  useEffect(() => {
    evaluateNotificationsRef.current(Date.now());
  }, [state.tasks]);

  useEffect(() => {
    if (state.tasks.length !== 0) return;
    if (uiState.emptyNuxDismissed) {
      return;
    }
    if (!isNuxIdle) return;
    openEmptyNuxModal({ step: "welcome" });
  }, [
    state.tasks.length,
    uiState.emptyNuxDismissed,
    isNuxIdle
  ]);

  useEffect(() => {
    if (uiState.emptyNux?.step !== "adding") return;
    if (state.tasks.length !== 0) return;
    if (uiState.emptyNuxDismissed) return;
    if (!isNuxIdle) return;
    openEmptyNuxModal({
      step: "welcome",
      startedFromNux: true,
      createdTaskId: uiState.emptyNux.createdTaskId
    });
  }, [
    state.tasks.length,
    uiState.emptyNux?.step,
    uiState.emptyNux?.createdTaskId,
    uiState.emptyNuxDismissed,
    isNuxIdle
  ]);

  useEffect(() => {
    const previousTaskCount = previousTaskCountRef.current;
    const nextTaskCount = state.tasks.length;
    if (
      nextTaskCount > previousTaskCount &&
      showCorruptionRecoveryImportCta &&
      startupBannerMessage
    ) {
      setStartupBannerMessage(null);
    }
    const transitionedFromEmptyToNonEmpty = previousTaskCount === 0 && nextTaskCount > 0;

    if (
      transitionedFromEmptyToNonEmpty &&
      uiState.emptyNux?.step === "adding" &&
      uiState.emptyNux.startedFromNux === true
    ) {
      const createdTaskId = state.selectedId;
      if (isNuxIdle) {
        openEmptyNuxModal({
          step: "celebrate",
          startedFromNux: true,
          createdTaskId
        });
      } else {
        pendingCelebrateTaskIdRef.current = createdTaskId;
        uiDispatch(setEmptyNuxCelebratePending(true));
      }
    }

    previousTaskCountRef.current = nextTaskCount;
  }, [
    state.tasks.length,
    state.selectedId,
    uiState.emptyNux?.step,
    uiState.emptyNux?.startedFromNux,
    isNuxIdle,
    showCorruptionRecoveryImportCta,
    startupBannerMessage
  ]);

  useEffect(() => {
    if (!uiState.emptyNuxCelebratePending) return;
    if (!isNuxIdle) return;

    uiDispatch(setEmptyNuxCelebratePending(false));
    openEmptyNuxModal({
      step: "celebrate",
      startedFromNux: true,
      createdTaskId: pendingCelebrateTaskIdRef.current
    });
    pendingCelebrateTaskIdRef.current = undefined;
  }, [uiState.emptyNuxCelebratePending, isNuxIdle]);

  useEffect(() => {
    if (state.tasks.length === 0) return;
    if (uiState.modal?.type !== "emptyNux") return;
    if (uiState.emptyNux?.startedFromNux === true) return;
    uiDispatch(clearEmptyNux());
  }, [state.tasks.length, uiState.modal, uiState.emptyNux?.startedFromNux]);

  useEffect(() => {
    if (
      !settingsState.notifications.enabled ||
      !settingsState.notifications.inAppOverdueBanner
    ) {
      return;
    }
    if (uiState.modal) return;
    if (uiState.notificationModalQueue.length === 0) return;

    const nextEvent = uiState.notificationModalQueue[0];
    const previousMode = uiState.mode === Mode.MODAL_CONFIRM ? Mode.LIST : uiState.mode;
    const previousFocus =
      uiState.mode === Mode.MODAL_CONFIRM ? FocusTarget.TASK_LIST : uiState.focus;

    uiDispatch({ type: "dequeueNotificationModal" });
    uiDispatch({
      type: "setModal",
      modal: {
        type: "overdue",
        event: nextEvent,
        previousMode,
        previousFocus
      }
    });
    uiDispatch({ type: "setMode", mode: Mode.MODAL_CONFIRM });
    uiDispatch({ type: "setFocus", focus: FocusTarget.MODAL });
    modalBellNotifierRef.current?.notify(nextEvent);
  }, [
    settingsState.notifications.enabled,
    settingsState.notifications.inAppOverdueBanner,
    uiState.modal,
    uiState.mode,
    uiState.focus,
    uiState.notificationModalQueue
  ]);

  useEffect(() => {
    if (
      settingsState.notifications.enabled &&
      settingsState.notifications.inAppOverdueBanner
    ) {
      return;
    }
    if (uiState.notificationModalQueue.length > 0) {
      uiDispatch({ type: "clearNotificationModalQueue" });
    }
    if (uiState.modal?.type === "overdue") {
      applyEscUnwind();
    }
  }, [
    settingsState.notifications.enabled,
    settingsState.notifications.inAppOverdueBanner,
    uiState.modal,
    uiState.notificationModalQueue.length
  ]);

  useEffect(() => {
    return () => {
      if (gPrefixTimerRef.current) {
        clearTimeout(gPrefixTimerRef.current);
      }
      if (navBannerTimerRef.current) {
        clearTimeout(navBannerTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (uiState.mode !== Mode.LIST || uiState.focus !== FocusTarget.TASK_LIST) {
      clearPendingGPrefix();
      setViewsOverlayOpen(false);
      setSaveViewPromptOpen(false);
    }
  }, [uiState.mode, uiState.focus]);

  useEffect(() => {
    if (uiState.mode === Mode.TAG_FILTER) return;
    setTagFilterInputValue("");
    setTagFilterDraft(undefined);
    setActiveTagFilterBucket("all");
  }, [uiState.mode]);

  useEffect(() => {
    if (!commandActive) return;
    if (uiState.mode === Mode.LIST) return;
    setCommandActive(false);
    setCommandTextValue("");
    setCommandHistoryIndex(null);
  }, [commandActive, uiState.mode]);

  useEffect(() => {
    if (state.savedViews.length === 0) {
      setSelectedViewIndex(0);
      return;
    }
    if (selectedViewIndex >= state.savedViews.length) {
      setSelectedViewIndex(state.savedViews.length - 1);
    }
  }, [selectedViewIndex, state.savedViews.length]);

  useEffect(() => {
    if (settingsState.themeId === "rotating") return;
    const index = ROTATING_THEME_ORDER.indexOf(settingsState.themeId);
    if (index >= 0) {
      setRotatingThemeIndex(index);
    }
  }, [settingsState.themeId]);

  useEffect(() => {
    if (settingsState.themeId !== "rotating") return;
    const id = setInterval(() => {
      setRotatingThemeIndex((prev) => (prev + 1) % ROTATING_THEME_ORDER.length);
    }, ROTATING_THEME_INTERVAL_MS);
    return () => clearInterval(id);
  }, [settingsState.themeId]);

  useEffect(() => {
    if (
      activeHelpPage !== "settings" ||
      clampedHelpNavSelectionIndex !== HELP_SETTINGS_LOGO_NAV_INDEX
    ) {
      setHelpDraftLogoMode(null);
    }
  }, [activeHelpPage, clampedHelpNavSelectionIndex]);

  useEffect(() => {
    applyThemeWithSettings(activeThemeId, settingsState, {
      draft:
        uiState.mode === Mode.HELP && activeHelpPage === "custom1Edit"
          ? custom1Draft
          : undefined,
      builtInTextDraft:
        uiState.mode === Mode.HELP && activeHelpPage === "textTuningEdit"
          ? builtInTextDraft
          : undefined
    });
  }, [
    activeHelpPage,
    activeThemeId,
    builtInTextDraft,
    custom1Draft,
    settingsState,
    uiState.mode
  ]);

  useEffect(() => {
    if (resolvedKeymapAliases.warnings.length === 0) return;
    for (const warning of resolvedKeymapAliases.warnings) {
      console.warn(`[TADOI][keymapAliases] ${warning}`);
    }
  }, [resolvedKeymapAliases]);

  useEffect(() => {
    if (skipSettingsSaveRef.current) {
      skipSettingsSaveRef.current = false;
      return;
    }
    saveSettingsDebounced(
      {
        themeId: settingsState.themeId,
        logoMode: settingsState.logoMode,
        flashMode: settingsState.flashMode,
        hintDisplayMode: settingsState.hintDisplayMode,
        showPrefixHintPopup: settingsState.showPrefixHintPopup,
        crtFxLite: settingsState.crtFxLite,
        crtFxColor: settingsState.crtFxColor,
        crtFxPreset: settingsState.crtFxPreset,
        retroFxMode: settingsState.retroFxMode,
        notifications: settingsState.notifications,
        security: settingsState.security,
        customThemes: settingsState.customThemes,
        keymapAliases: settingsState.keymapAliases
      },
      150,
      settingsPath ? { filePath: settingsPath } : {}
    );
  }, [
    settingsPath,
    settingsState.crtFxLite,
    settingsState.crtFxColor,
    settingsState.crtFxPreset,
    settingsState.retroFxMode,
    settingsState.customThemes,
    settingsState.flashMode,
    settingsState.hintDisplayMode,
    settingsState.keymapAliases,
    settingsState.logoMode,
    settingsState.notifications,
    settingsState.security,
    settingsState.showPrefixHintPopup,
    settingsState.themeId
  ]);

  useEffect(() => {
    if (skipInitialSaveRef.current) {
      skipInitialSaveRef.current = false;
      return;
    }
    saveStateDebounced(
      {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        tasks: state.tasks,
        tagIndex: state.tagIndex,
        savedViews: state.savedViews,
        engagement: state.engagement
      },
      350,
      undefined,
      undefined,
      handleSaveResult,
      { expectedStateRevision: expectedStateRevisionRef.current }
    );
  }, [state.tasks, state.tagIndex, state.savedViews, state.engagement]);

  useEffect(() => {
    if (!PERF_DEBUG_ENABLED) return;
    const durationMs = Date.now() - renderStartMs;
    console.log(
      `[${APP_NAME}][perf] render=${durationMs}ms terminal=${terminalWidth}x${terminalHeight} visibleRows=${visibleRows} visibleTaskRows=${visibleTaskRows.length}`
    );
  });

  useEffect(() => {
    const reconciled = reconcileSelectionById(
      visibleTaskRows,
      state.selectedId,
      uiState.selectedIndex
    );

    if (reconciled.selectedId !== state.selectedId) {
      dispatch({ type: "setSelected", id: reconciled.selectedId });
    }
    if (reconciled.selectedIndex !== uiState.selectedIndex) {
      uiDispatch({ type: "setSelectedIndex", selectedIndex: reconciled.selectedIndex });
    }
    if (visibleTaskRows.length === 0 && uiState.scrollOffset !== 0) {
      uiDispatch({ type: "setScrollOffset", scrollOffset: 0 });
    }
  }, [visibleTaskRows, state.selectedId, uiState.selectedIndex, uiState.scrollOffset]);

  useEffect(() => {
    const clamped = clampScrollOffset(
      uiState.scrollOffset,
      visibleRows,
      visibleTaskRows.length
    );
    const nextOffset = ensureSelectedVisible({
      selectedIndex: uiState.selectedIndex,
      scrollOffset: clamped,
      visibleRows,
      itemCount: visibleTaskRows.length
    });
    if (nextOffset !== uiState.scrollOffset) {
      uiDispatch({ type: "setScrollOffset", scrollOffset: nextOffset });
    }
  }, [uiState.scrollOffset, uiState.selectedIndex, visibleRows, visibleTaskRows.length]);

  useEffect(() => {
    if (selectedTaskLinks.length === 0) {
      if (selectedLinkId !== undefined) {
        setSelectedLinkId(undefined);
      }
      return;
    }

    if (selectedLinkId && selectedTaskLinks.some((link) => link.id === selectedLinkId)) {
      return;
    }

    setSelectedLinkId(selectedTaskLinks[0]?.id);
  }, [selectedLinkId, selectedTaskLinkIdsKey, selectedPersistedTask?.id]);

  useEffect(() => {
    if (selectedChecklistItems.length === 0) {
      if (selectedChecklistItemId !== undefined) {
        setSelectedChecklistItemId(undefined);
      }
      return;
    }

    if (
      selectedChecklistItemId &&
      selectedChecklistItems.some((item) => item.id === selectedChecklistItemId)
    ) {
      return;
    }

    setSelectedChecklistItemId(selectedChecklistItems[0]?.id);
  }, [
    selectedChecklistItemId,
    selectedChecklistItemIdsKey,
    selectedChecklistTask?.id
  ]);

  useEffect(() => {
    if (!isEditorMode(uiState.mode) || !state.editor) {
      if (selectedEditorChecklistItemId !== undefined) {
        setSelectedEditorChecklistItemId(undefined);
      }
      return;
    }

    if (editorChecklistItems.length === 0) {
      if (selectedEditorChecklistItemId !== undefined) {
        setSelectedEditorChecklistItemId(undefined);
      }
      return;
    }

    if (
      selectedEditorChecklistItemId &&
      editorChecklistItems.some((item) => item.id === selectedEditorChecklistItemId)
    ) {
      return;
    }

    setSelectedEditorChecklistItemId(editorChecklistItems[0]?.id);
  }, [
    editorChecklistItemIdsKey,
    selectedEditorChecklistItemId,
    state.editor,
    uiState.mode
  ]);

  useEffect(() => {
    if (selectedChecklistItems.length === 0) {
      if (checklistScrollOffset !== 0) {
        setChecklistScrollOffset(0);
      }
      return;
    }
    const safeSelectedIndex = Math.max(0, selectedChecklistIndex);
    const clampedOffset = clampScrollOffset(
      checklistScrollOffset,
      checklistViewportRows,
      selectedChecklistItems.length
    );
    const nextOffset = ensureSelectedVisible({
      selectedIndex: safeSelectedIndex,
      scrollOffset: clampedOffset,
      visibleRows: checklistViewportRows,
      itemCount: selectedChecklistItems.length
    });
    if (nextOffset !== checklistScrollOffset) {
      setChecklistScrollOffset(nextOffset);
    }
  }, [
    checklistScrollOffset,
    checklistViewportRows,
    selectedChecklistIndex,
    selectedChecklistItems.length
  ]);

  useEffect(() => {
    if (!bulkActive) return;
    const visibleIds = new Set(visibleTaskRows.map((row) => row.id));
    setBulkMarkedTaskIds((previous) => {
      const next = previous.filter((id) => visibleIds.has(id));
      return next.length === previous.length ? previous : next;
    });
  }, [bulkActive, visibleTaskRows]);

  useEffect(() => {
    if (dashboardTopTags.length === 0) {
      if (dashboardTagSelection !== 0) {
        setDashboardTagSelection(0);
      }
      return;
    }
    if (dashboardTagSelection > dashboardTopTags.length - 1) {
      setDashboardTagSelection(dashboardTopTags.length - 1);
    }
  }, [dashboardTagSelection, dashboardTopTags.length]);

  useEffect(() => {
    if (dashboardPriorityBuckets.length === 0) {
      if (dashboardPrioritySelection !== 0) {
        setDashboardPrioritySelection(0);
      }
    } else if (dashboardPrioritySelection > dashboardPriorityBuckets.length - 1) {
      setDashboardPrioritySelection(dashboardPriorityBuckets.length - 1);
    }

    if (dashboardAssigneeSlices.length === 0) {
      if (dashboardAssigneeSelection !== 0) {
        setDashboardAssigneeSelection(0);
      }
    } else if (dashboardAssigneeSelection > dashboardAssigneeSlices.length - 1) {
      setDashboardAssigneeSelection(dashboardAssigneeSlices.length - 1);
    }

    if (dashboardProjectSlices.length === 0) {
      if (dashboardProjectSelection !== 0) {
        setDashboardProjectSelection(0);
      }
    } else if (dashboardProjectSelection > dashboardProjectSlices.length - 1) {
      setDashboardProjectSelection(dashboardProjectSlices.length - 1);
    }

    if (dashboardWorkflowStageSlices.length === 0) {
      if (dashboardWorkflowStageSelection !== 0) {
        setDashboardWorkflowStageSelection(0);
      }
    } else if (dashboardWorkflowStageSelection > dashboardWorkflowStageSlices.length - 1) {
      setDashboardWorkflowStageSelection(dashboardWorkflowStageSlices.length - 1);
    }

    if (getDashboardFocusGroupItemCount(dashboardFocusGroup) > 0) return;
    const fallback =
      DASHBOARD_FOCUS_GROUP_ORDER.find(
        (group) => getDashboardFocusGroupItemCount(group) > 0
      ) ?? "due_buckets";
    setDashboardFocusGroup(fallback);
  }, [
    dashboardAssigneeSelection,
    dashboardAssigneeSlices.length,
    dashboardFocusGroup,
    dashboardPriorityBuckets.length,
    dashboardPrioritySelection,
    dashboardProjectSelection,
    dashboardProjectSlices.length,
    dashboardWorkflowStageSelection,
    dashboardWorkflowStageSlices.length,
    dashboardTopTags.length,
    state.filters.status
  ]);

  function getCurrentHelpScrollTop(): number {
    const current = Number.isFinite(helpScrollTopRef.current)
      ? helpScrollTopRef.current
      : helpScrollOffset;
    return clampScrollOffset(current, helpContentVisibleRows, helpRows.length);
  }

  function scrollHelpTo(offset: number): number {
    const clamped = clampScrollOffset(offset, helpContentVisibleRows, helpRows.length);
    helpScrollTopRef.current = clamped;
    setHelpScrollOffset((prev) => (prev === clamped ? prev : clamped));
    return clamped;
  }

  function getCurrentHelpNavScrollTop(): number {
    return clampScrollOffset(
      helpNavScrollOffset,
      helpContentVisibleRows,
      helpNavLineCount
    );
  }

  function scrollHelpNavTo(offset: number): number {
    const clamped = clampScrollOffset(offset, helpContentVisibleRows, helpNavLineCount);
    setHelpNavScrollOffset((prev) => (prev === clamped ? prev : clamped));
    return clamped;
  }

  function ensureHelpSectionVisibleNow(sectionIndex: number): number {
    const clampedSectionIndex = Math.max(
      0,
      Math.min(sectionIndex, HELP_MENU_SECTIONS.length - 1)
    );
    const section = helpSections[clampedSectionIndex] ?? helpSections[0];
    const nextOffset = ensureHelpSectionVisible({
      section,
      scrollOffset: getCurrentHelpScrollTop(),
      visibleRows: helpContentVisibleRows,
      itemCount: helpRows.length,
      paddingRows: HELP_SECTION_SCROLL_PADDING
    });
    return scrollHelpTo(nextOffset);
  }

  useLayoutEffect(() => {
    if (uiState.mode !== Mode.HELP || activeHelpPage !== "help") return;
    const clampedIndex = Math.max(
      0,
      Math.min(helpFocusedSectionIndex, HELP_MENU_SECTIONS.length - 1)
    );
    if (clampedIndex !== helpFocusedSectionIndex) {
      helpFocusedSectionRef.current = clampedIndex;
      setHelpFocusedSectionIndex(clampedIndex);
    }
    ensureHelpSectionVisibleNow(clampedIndex);
  }, [
    uiState.mode,
    activeHelpPage,
    helpFocusedSectionIndex,
    helpRows.length,
    helpSections,
    helpContentVisibleRows,
    helpExpandedBySection,
    helpPanelWidth,
    helpPanelHeight,
    helpPanelInnerWidth,
    helpPanelInnerHeight
  ]);

  useLayoutEffect(() => {
    if (uiState.mode !== Mode.HELP) return;
    if (
      activeHelpPage === "help" ||
      activeHelpPage === "custom1Edit" ||
      activeHelpPage === "textTuningEdit"
    ) {
      return;
    }

    if (helpNavLineCount <= 0) return;

    const currentOffset = getCurrentHelpNavScrollTop();

    const nextOffset = ensureSelectedVisible({
      selectedIndex: getHelpNavSelectionAnchorRow(
        activeHelpPage,
        clampedHelpNavSelectionIndex
      ),
      scrollOffset: currentOffset,
      visibleRows: helpContentVisibleRows,
      itemCount: helpNavLineCount
    });

    if (nextOffset !== currentOffset) {
      scrollHelpNavTo(nextOffset);
    }
  }, [
    uiState.mode,
    activeHelpPage,
    clampedHelpNavSelectionIndex,
    helpNavScrollOffset,
    helpContentVisibleRows,
    helpNavLineCount,
    helpPanelWidth,
    helpPanelHeight,
    helpPanelInnerWidth,
    helpPanelInnerHeight
  ]);

  useEffect(() => {
    if (uiState.mode !== Mode.HELP) return;
    renderer.requestRender();
  }, [
    renderer,
    uiState.mode,
    activeHelpPage,
    helpPanelWidth,
    helpPanelHeight,
    helpPanelInnerWidth,
    helpPanelInnerHeight,
    helpBodyLineCount,
    helpRows.length,
    helpExpandedBySection,
    helpNavSelection,
    helpScrollOffset,
    helpFooterHintsLine,
    helpFooterDataPathLine,
    custom1Draft,
    builtInTextDraft,
    helpTextTuningThemeId
  ]);

  function applyEscUnwind(options: { bypassUnsavedGuard?: boolean } = {}): boolean {
    return modalFlow.applyEscUnwind(options);
  }

  function isTaskEditorDirty(): boolean {
    if (!isEditorMode(uiState.mode)) return false;
    const draft = editorDraftRef.current ?? state.editor;
    if (!draft) return false;
    if (uiState.mode === Mode.EDIT) {
      return (
        editorDirtyIntentRef.current ||
        isEditorDraftDirty(draft, editorBaselineDraftRef.current)
      );
    }
    return editorDirtyIntentRef.current || isEditorDraftDirty(draft, createEmptyDraft());
  }

  function isCustom1EditorDirty(): boolean {
    const persistedObjects = sanitizeDraftObjects(persistedCustom1.objects ?? {}) ?? {};
    const draftObjects = sanitizeDraftObjects(custom1DraftObjects) ?? {};
    return (
      stableSerialize(persistedCustom1.global) !== stableSerialize(custom1DraftGlobal) ||
      stableSerialize(persistedObjects) !== stableSerialize(draftObjects)
    );
  }

  function isBuiltInTextEditorDirty(): boolean {
    const persistedGlobal = sanitizeThemeTextTokenOverrides(persistedBuiltInTextConfig.global);
    const persistedObjects = sanitizeThemeTextObjectOverrides(persistedBuiltInTextConfig.objects);
    const draftGlobal = sanitizeThemeTextTokenOverrides(builtInTextDraftGlobal);
    const draftObjects = sanitizeThemeTextObjectOverrides(builtInTextDraftObjects);
    return (
      stableSerialize(persistedGlobal ?? {}) !== stableSerialize(draftGlobal ?? {}) ||
      stableSerialize(persistedObjects ?? {}) !== stableSerialize(draftObjects ?? {})
    );
  }

  function requestTaskEditorUnsavedGuard(
    continuation: UITaskEditorUnsavedContinuation
  ): boolean {
    if (!isEditorMode(uiState.mode) || !isTaskEditorDirty()) {
      return false;
    }
    runRoutedAction({
      scope: "ui",
      type: "OPEN_UNSAVED_CHANGES_MODAL",
      modal: {
        type: "unsaved_changes",
        source: "task_editor",
        continuation,
        previousMode: uiState.mode,
        previousFocus: uiState.focus
      }
    });
    return true;
  }

  function requestHelpThemeEditorUnsavedGuard(
    source: HelpThemeEditorSource,
    continuation: UIHelpThemeUnsavedContinuation
  ): boolean {
    if (uiState.mode !== Mode.HELP) return false;
    const matchesSource =
      (source === "help_custom1_editor" && activeHelpPage === "custom1Edit") ||
      (source === "help_text_tuning_editor" && activeHelpPage === "textTuningEdit");
    if (!matchesSource) return false;
    const dirty =
      source === "help_custom1_editor" ? isCustom1EditorDirty() : isBuiltInTextEditorDirty();
    if (!dirty) return false;
    runRoutedAction({
      scope: "ui",
      type: "OPEN_UNSAVED_CHANGES_MODAL",
      modal: {
        type: "unsaved_changes",
        source,
        continuation,
        previousMode: Mode.HELP,
        previousFocus: uiState.focus
      }
    });
    return true;
  }

  function runTaskEditorContinuation(continuation: UITaskEditorUnsavedContinuation): void {
    switch (continuation) {
      case "close_editor":
      case "open_list":
        openListMode({ bypassUnsavedGuard: true });
        return;
      case "open_dashboard":
        openDashboardMode({ bypassUnsavedGuard: true });
        return;
      case "open_backup_center":
        openBackupCenter({ bypassUnsavedGuard: true });
        return;
      case "open_search":
        openSearchMode({ bypassUnsavedGuard: true });
        return;
      case "open_help":
        openListMode({ bypassUnsavedGuard: true });
        openHelp({ bypassUnsavedGuard: true });
        return;
      case "open_add":
        openAdd({ bypassUnsavedGuard: true });
        return;
      case "open_edit":
        openEdit({ bypassUnsavedGuard: true });
        return;
      case "open_tag_filter_panel":
        openListMode({ bypassUnsavedGuard: true });
        openTagFilterPanel();
        return;
      case "open_delete_confirm":
        openListMode({ bypassUnsavedGuard: true });
        openDeleteConfirm();
        return;
      default:
        return;
    }
  }

  function runHelpThemeEditorContinuation(
    source: HelpThemeEditorSource,
    continuation: UIHelpThemeUnsavedContinuation
  ): void {
    if (continuation === "close_help") {
      closeHelp({ bypassUnsavedGuard: true });
      return;
    }
    if (source === "help_custom1_editor") {
      closeCustom1EditorCancel();
      return;
    }
    closeBuiltInTextEditorCancel();
  }

  function openUnsavedChangesModal(modal: UIUnsavedChangesModal): void {
    modalFlow.openUnsavedChangesModal(modal);
  }

  function openBackupFinalCheckpointModal(modal: UIBackupFinalCheckpointModal): void {
    modalFlow.openBackupFinalCheckpointModal(modal);
  }

  function openRecurringDeleteFutureCheckpointModal(
    modal: UIRecurringDeleteFutureCheckpointModal
  ): void {
    modalFlow.openRecurringDeleteFutureCheckpointModal(modal);
  }

  function openBackupFinalCheckpoint(
    checkpoint: UIBackupFinalCheckpointModal["checkpoint"],
    sourceScreen: BackupCenterFlowScreen
  ): void {
    modalFlow.openBackupFinalCheckpoint(checkpoint, sourceScreen);
  }

  function handleUnsavedChangesSaveAndContinue(): void {
    modalFlow.handleUnsavedChangesSaveAndContinue();
  }

  function handleUnsavedChangesDiscardAndContinue(): void {
    modalFlow.handleUnsavedChangesDiscardAndContinue();
  }

  function cancelUnsavedChangesContinue(): void {
    modalFlow.cancelUnsavedChangesContinue();
  }

  function handleBackupFinalCheckpointConfirm(): void {
    modalFlow.handleBackupFinalCheckpointConfirm();
  }

  function cancelBackupFinalCheckpoint(): void {
    modalFlow.cancelBackupFinalCheckpoint();
  }

  function handleRecurringDeleteFutureCheckpointConfirm(): void {
    modalFlow.handleRecurringDeleteFutureCheckpointConfirm();
  }

  function cancelRecurringDeleteFutureCheckpoint(): void {
    modalFlow.cancelRecurringDeleteFutureCheckpoint();
  }

  function requestRecurringDeleteFutureCheckpointFromDeleteModal(): void {
    modalFlow.requestRecurringDeleteFutureCheckpointFromDeleteModal();
  }

  function openBackupError(
    message: string,
    error?: unknown,
    returnScreen?: BackupCenterFlowScreen
  ) {
    backupDispatch({
      type: "setError",
      message,
      detail: error ? normalizeErrorDetail(error) : undefined,
      returnScreen
    });
  }

  async function refreshRuntimeStateFromDisk() {
    const dataPath = getResolvedDataPath();
    const stateResult = await loadStateStrict({ filePath: dataPath });
    expectedStateRevisionRef.current =
      typeof stateResult.data.stateRevision === "number" &&
      Number.isInteger(stateResult.data.stateRevision) &&
      stateResult.data.stateRevision >= 0
        ? stateResult.data.stateRevision
        : 0;
    dispatch({ type: "load", data: stateResult.data });
    const settingsResult = await loadSettings();
    settingsDispatch({ type: "setTheme", themeId: settingsResult.settings.themeId });
    settingsDispatch({
      type: "setLogoMode",
      logoMode: settingsResult.settings.logoMode
    });
    settingsDispatch({
      type: "setFlashMode",
      flashMode: settingsResult.settings.flashMode
    });
    settingsDispatch({
      type: "setHintDisplayMode",
      hintDisplayMode:
        settingsResult.settings.hintDisplayMode ?? DEFAULT_HINT_DISPLAY_MODE
    });
    settingsDispatch({
      type: "setShowPrefixHintPopup",
      showPrefixHintPopup:
        settingsResult.settings.showPrefixHintPopup ?? DEFAULT_SHOW_PREFIX_HINT_POPUP
    });
    settingsDispatch({
      type: "setCrtFxLite",
      crtFxLite: settingsResult.settings.crtFxLite === true
    });
    settingsDispatch({
      type: "setCrtFxColor",
      crtFxColor: settingsResult.settings.crtFxColor ?? DEFAULT_CRT_FX_COLOR
    });
    settingsDispatch({
      type: "setCrtFxPreset",
      crtFxPreset: settingsResult.settings.crtFxPreset ?? DEFAULT_CRT_FX_PRESET
    });
    settingsDispatch({
      type: "setRetroFxMode",
      retroFxMode: settingsResult.settings.retroFxMode ?? DEFAULT_RETRO_FX
    });
    settingsDispatch({
      type: "setNotifications",
      notifications: settingsResult.settings.notifications
    });
    settingsDispatch({
      type: "setSecurity",
      security: settingsResult.settings.security
    });
    settingsDispatch({
      type: "setCustomThemes",
      customThemes: settingsResult.settings.customThemes
    });
    settingsDispatch({
      type: "setKeymapAliases",
      keymapAliases: settingsResult.settings.keymapAliases
    });
  }

  async function handleRetrySaveAfterConflictReload() {
    if (saveConflictRetryPending || !saveConflictBannerState) return;
    setSaveConflictRetryPending(true);

    const stateSnapshot = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      tasks: state.tasks,
      tagIndex: state.tagIndex,
      savedViews: state.savedViews,
      engagement: state.engagement
    };
    const dataPath = getResolvedDataPath();
    const lastSavedAt = lastSuccessfulSaveAtRef.current;

    try {
      const result = await retrySaveAfterConflictReload({
        snapshot: stateSnapshot,
        filePath: dataPath,
        deps: {
          loadLatest: async (filePath) => {
            const latest = await loadStateStrict({ filePath });
            return { stateRevision: latest.data.stateRevision };
          },
          saveAtomic: async (data, filePath, options) =>
            saveStateAtomic(data, filePath, undefined, options)
        }
      });

      if (result.ok) {
        const savedAt = Date.now();
        lastSuccessfulSaveAtRef.current = savedAt;
        expectedStateRevisionRef.current = result.stateRevision;
        setSaveFailureBanner(null);
        setSaveConflictBannerState(null);
        showShortNavigationBanner("Save retried after reload.");
      } else if (result.kind === "conflict") {
        setSaveConflictBannerState({
          filePath: dataPath,
          expectedStateRevision: result.expectedStateRevision,
          actualStateRevision: result.actualStateRevision
        });
        const lastSaveText = lastSavedAt
          ? ` | Last successful save: ${formatSaveTimestamp(lastSavedAt)}`
          : "";
        setSaveFailureBanner(
          `Save blocked by concurrent update (expected revision ${String(result.expectedStateRevision)}, found ${String(result.actualStateRevision)}). Press R or click to reload and retry. | Path: ${dataPath}${lastSaveText}`
        );
      } else {
        setSaveConflictBannerState(null);
        const detail = normalizeErrorDetail(result.error);
        const lastSaveText = lastSavedAt
          ? ` | Last successful save: ${formatSaveTimestamp(lastSavedAt)}`
          : "";
        setSaveFailureBanner(
          `Save retry failed: ${detail} | Path: ${dataPath}${lastSaveText}`
        );
      }
    } finally {
      setSaveConflictRetryPending(false);
    }
  }

  function runBackupExportFlow() {
    if (backupState.screen === "exporting") return;
    backupDispatch({ type: "startExport" });
    void (async () => {
      try {
        const dataPath = getResolvedDataPath();
        await ensureDefaultBackupDirExists(dataPath);
        const outputPath = await buildTimestampedBackupPath({ dataPath });
        const result = await exportBackup({
          outputPath,
          pretty: true
        });
        backupDispatch({ type: "exportSucceeded", outputPath: result.outputPath });
      } catch (error: unknown) {
        openBackupError("Export failed", error, "menu");
      }
    })();
  }

  function openBackupImportPicker() {
    void (async () => {
      const dataPath = getResolvedDataPath();
      const directoryPath = getDefaultBackupDir(dataPath);
      backupDispatch({ type: "openImportPicker", directoryPath });
      backupDispatch({ type: "loadImportPickerFilesRequest", directoryPath });
      try {
        await ensureDefaultBackupDirExists(dataPath);
        const files = await listBackupFiles({ dirPath: directoryPath });
        backupDispatch({
          type: "loadImportPickerFilesSuccess",
          directoryPath,
          files
        });
      } catch (error: unknown) {
        backupDispatch({
          type: "loadImportPickerFilesFailure",
          directoryPath,
          error: normalizeErrorDetail(error)
        });
      }
    })();
  }

  function runBackupDryRunFlow(options: {
    inputPath?: string;
    mode?: "merge" | "replace";
    replaceConfirmed?: boolean;
  } = {}) {
    const inputPath = (options.inputPath ?? backupState.importPathInput).trim();
    const mode = options.mode ?? backupState.importMode;
    const replaceConfirmed = options.replaceConfirmed ?? backupState.replaceConfirmed;

    if (!inputPath) {
      openBackupError("Import path is required.");
      return;
    }

    if (
      shouldRequireBackupReplaceConfirmation({
        ...backupState,
        importMode: mode,
        replaceConfirmed
      })
    ) {
      backupDispatch({ type: "openImportConfirm" });
      return;
    }

    void (async () => {
      try {
        const summary = await importBackup({
          inputPath,
          mode,
          dryRun: true
        });
        backupDispatch({ type: "dryRunSucceeded", summary, inputPath });
      } catch (error: unknown) {
        openBackupError("Dry-run failed", error, "import_mode");
      }
    })();
  }

  function runBackupImportCommitFlow() {
    if (!hasMatchingDryRun(backupState)) {
      openBackupError("Dry-run summary is required before commit.");
      return;
    }
    if (shouldRequireBackupReplaceConfirmation(backupState)) {
      backupDispatch({ type: "openImportConfirm" });
      return;
    }

    backupDispatch({ type: "startImporting" });
    void (async () => {
      try {
        const summary = await importBackup({
          inputPath: backupState.importPathInput.trim(),
          mode: backupState.importMode,
          dryRun: false,
          backup: true
        });
        backupDispatch({ type: "importSucceeded", summary });
        if (showCorruptionRecoveryImportCta && startupBannerMessage) {
          setStartupBannerMessage(null);
        }
        await refreshRuntimeStateFromDisk();
      } catch (error: unknown) {
        if (error instanceof BackupImportPartialError) {
          if (showCorruptionRecoveryImportCta && startupBannerMessage) {
            setStartupBannerMessage(null);
          }
          try {
            await refreshRuntimeStateFromDisk();
          } catch {
            // Best effort refresh for partial success paths.
          }
        }
        openBackupError("Import failed", error, "import_dryrun");
      }
    })();
  }

  const calendarFlow = useCalendarFlow({
    backupState,
    backupDispatch,
    savedViews: state.savedViews,
    calendarImportPathInputRef,
    calendarImportRangeRef,
    calendarImportModeRef,
    calendarImportConfirmInputRef,
    openBackupError,
    openBackupFinalCheckpoint,
    refreshRuntimeStateFromDisk
  });

  function runCalendarExportFromBackupCenter() {
    calendarFlow.runCalendarExportFromBackupCenter();
  }

  function runCalendarImportDryRunFromBackupCenter() {
    calendarFlow.runCalendarImportDryRunFromBackupCenter();
  }

  function runCalendarImportCommitFromBackupCenter() {
    calendarFlow.runCalendarImportCommitFromBackupCenter();
  }

  function handleCalendarMenuSelect(index: 0 | 1 | 2) {
    calendarFlow.handleCalendarMenuSelect(index);
  }

  function handleBackupMenuSelect(index: 0 | 1 | 2 | 3) {
    switch (index) {
      case 0:
        runBackupExportFlow();
        return;
      case 1:
        openBackupImportPicker();
        return;
      case 2:
        backupDispatch({ type: "showDataPath", path: getResolvedDataPath() });
        return;
      case 3:
        backupDispatch({ type: "setScreen", screen: "calendar_menu" });
        return;
      default:
        return;
    }
  }

  function handleBackupDigitSelection(digit: number) {
    calendarFlow.handleCalendarDigitSelection(digit);
  }

  function requestBackupBodyScroll(delta: number) {
    if (!Number.isFinite(delta) || delta === 0) return;
    setBackupBodyScrollRequest((prev) => ({
      token: prev.token + 1,
      delta
    }));
  }

  function handleBackupBackAction() {
    if (backupState.screen === "menu") {
      const { mode: returnMode, focus: returnFocus } = normalizeHelpReturnContext(
        uiState.previousMode,
        uiState.previousFocus
      );
      backupDispatch({ type: "reset" });
      uiDispatch({ type: "setMode", mode: returnMode });
      uiDispatch({ type: "setFocus", focus: returnFocus });
      return;
    }
    backupDispatch({ type: "back" });
  }

  function handleBackupPrimaryAction() {
    if (calendarFlow.handleCalendarPrimaryAction()) {
      return;
    }

    switch (backupState.screen) {
      case "menu":
        handleBackupMenuSelect(backupState.menuIndex);
        return;
      case "export_done":
      case "import_done":
      case "show_path":
        backupDispatch({ type: "openMenu" });
        return;
      case "error":
        backupDispatch({ type: "back" });
        return;
      case "import_picker":
        backupDispatch({ type: "confirmImportPickerSelection" });
        return;
      case "import_path":
        if (!backupState.importPathInput.trim()) {
          openBackupError("Import path is required.", undefined, "import_path");
          return;
        }
        backupDispatch({ type: "openImportMode" });
        return;
      case "import_mode":
        runBackupDryRunFlow();
        return;
      case "import_confirm":
        if (!isReplaceConfirmationValid(backupState)) {
          backupDispatch({ type: "replaceConfirmRejected" });
          return;
        }
        backupDispatch({ type: "replaceConfirmAccepted" });
        runBackupDryRunFlow({
          replaceConfirmed: true
        });
        return;
      case "import_dryrun":
        if (!hasMatchingDryRun(backupState)) {
          openBackupError("Dry-run summary is required before commit.");
          return;
        }
        if (backupState.importMode === "replace" && !backupState.replaceConfirmed) {
          backupDispatch({ type: "openImportConfirm" });
          return;
        }
        openBackupFinalCheckpoint("data_import", "import_dryrun");
        return;
      case "exporting":
      case "importing":
      default:
        return;
    }
  }

  function assertLinkActionInvariant(action: KeyRouterAction): void {
    if (process.env.NODE_ENV === "production") return;

    const detailsFocusOnly = new Set<KeyRouterAction["type"]>([
      "MOVE_LINK_SELECTION",
      "OPEN_SELECTED_LINK",
      "COPY_SELECTED_LINK",
      "OPEN_EDIT_TASK_LINK_MODAL",
      "OPEN_DELETE_TASK_LINK_MODAL"
    ]);
    const detailsChecklistFocusOnly = new Set<KeyRouterAction["type"]>([
      "MOVE_CHECKLIST_SELECTION",
      "TOGGLE_SELECTED_CHECKLIST_ITEM",
      "OPEN_ADD_CHECKLIST_ITEM_MODAL",
      "OPEN_EDIT_CHECKLIST_ITEM_MODAL",
      "OPEN_DELETE_CHECKLIST_ITEM_MODAL"
    ]);
    const modalOnly = new Set<KeyRouterAction["type"]>([
      "MODAL_CONFIRM_TASK_LINK_DELETE",
      "MODAL_CONFIRM_TASK_LINK_OPEN_EXTERNAL",
      "MODAL_SUBMIT_TASK_LINK_FORM",
      "MODAL_MOVE_TASK_LINK_FORM_FOCUS",
      "MODAL_CYCLE_TASK_LINK_FORM_TYPE",
      "MODAL_CONFIRM_CHECKLIST_DELETE",
      "MODAL_SUBMIT_CHECKLIST_INPUT",
      "MODAL_CONFIRM_BULK_DELETE"
    ]);

    if (
      detailsFocusOnly.has(action.type) &&
      (uiState.mode !== Mode.LIST || uiState.focus !== FocusTarget.DETAILS_LINKS)
    ) {
      throw new Error(
        `Link action ${action.type} requires LIST + DETAILS_LINKS (got ${uiState.mode}/${uiState.focus})`
      );
    }

    const inListChecklistFocus =
      uiState.mode === Mode.LIST && uiState.focus === FocusTarget.DETAILS_CHECKLIST;
    const inEditorChecklistFocus =
      isEditorMode(uiState.mode) && uiState.focus === FocusTarget.EDITOR_CHECKLIST;
    if (
      detailsChecklistFocusOnly.has(action.type) &&
      !inListChecklistFocus &&
      !inEditorChecklistFocus
    ) {
      throw new Error(
        `Checklist action ${action.type} requires LIST+DETAILS_CHECKLIST or EDITOR_CHECKLIST (got ${uiState.mode}/${uiState.focus})`
      );
    }

    if (
      action.type === "OPEN_ADD_TASK_LINK_MODAL" &&
      uiState.mode !== Mode.LIST &&
      uiState.mode !== Mode.ADD
    ) {
      throw new Error(
        `Link action ${action.type} requires LIST or ADD mode (got ${uiState.mode})`
      );
    }

    if (
      action.type === "TOGGLE_BULK_MARK" &&
      (uiState.mode !== Mode.LIST || uiState.focus !== FocusTarget.TASK_LIST)
    ) {
      throw new Error(
        `Bulk action ${action.type} requires LIST + TASK_LIST (got ${uiState.mode}/${uiState.focus})`
      );
    }

    if (modalOnly.has(action.type) && uiState.mode !== Mode.MODAL_CONFIRM) {
      throw new Error(
        `Modal action ${action.type} requires MODAL_CONFIRM mode (got ${uiState.mode})`
      );
    }
  }

  function runRoutedAction(action: KeyRouterAction) {
    assertLinkActionInvariant(action);
    switch (action.type) {
      case "UNWIND":
        applyEscUnwind();
        return;
      case "OPEN_EMPTY_NUX":
        openEmptyNuxModal({
          step: action.step,
          startedFromNux: action.startedFromNux,
          createdTaskId: action.createdTaskId
        });
        return;
      case "DISMISS_EMPTY_NUX":
        uiDispatch(dismissEmptyNux());
        return;
      case "CLEAR_EMPTY_NUX":
        uiDispatch(clearEmptyNux());
        return;
      case "SET_MODAL":
        uiDispatch({ type: "setModal", modal: action.modal });
        return;
      case "TOGGLE_DASHBOARD":
        toggleDashboard();
        return;
      case "OPEN_HELP":
        openHelp();
        return;
      case "OPEN_BACKUP_CENTER":
        openBackupCenter();
        return;
      case "OPEN_BACKUP_CENTER_IMPORT":
        openBackupImportFromEmptyNux();
        return;
      case "OPEN_TAG_FILTER_PANEL":
        openTagFilterPanel();
        return;
      case "CLOSE_HELP":
        closeHelp();
        return;
      case "HELP_MOVE_SECTION_FOCUS":
        moveHelpSectionFocus(action.delta);
        return;
      case "HELP_TOGGLE_FOCUSED_SECTION":
        toggleFocusedHelpSection();
        return;
      case "HELP_NAV_FORWARD":
        handleHelpNavForward();
        return;
      case "HELP_NAV_BACK":
        handleHelpNavBack();
        return;
      case "HELP_SET_FOCUSED_SECTION_EXPANDED":
        setFocusedHelpSectionExpanded(action.expanded);
        return;
      case "HELP_SCROLL_PAGE":
        scrollHelpByPage(action.direction);
        return;
      case "BACKUP_PRIMARY":
        handleBackupPrimaryAction();
        return;
      case "BACKUP_BACK":
        handleBackupBackAction();
        return;
      case "BACKUP_MOVE_MENU_SELECTION":
        backupDispatch({ type: "moveMenuIndex", delta: action.delta });
        return;
      case "BACKUP_SELECT_MENU_OPTION":
        backupDispatch({ type: "setMenuIndex", index: action.index });
        handleBackupMenuSelect(action.index);
        return;
      case "BACKUP_SELECT_DIGIT":
        handleBackupDigitSelection(action.digit);
        return;
      case "BACKUP_SET_IMPORT_MODE":
        backupDispatch({ type: "setImportMode", mode: action.mode });
        return;
      case "BACKUP_PICKER_MOVE_SELECTION":
        backupDispatch({
          type: "moveImportPickerSelection",
          delta: action.delta,
          visibleRows: backupImportPickerVisibleRows
        });
        return;
      case "BACKUP_PICKER_PAGE_SELECTION":
        backupDispatch({
          type: "pageImportPickerSelection",
          delta: action.delta,
          visibleRows: backupImportPickerVisibleRows
        });
        return;
      case "BACKUP_PICKER_JUMP_SELECTION":
        backupDispatch({
          type: "jumpImportPickerSelection",
          target: action.target,
          visibleRows: backupImportPickerVisibleRows
        });
        return;
      case "BACKUP_PICKER_CONFIRM_SELECTION":
        handleBackupPrimaryAction();
        return;
      case "BACKUP_PICKER_OPEN_MANUAL_PATH":
        backupDispatch({ type: "openImportPathManual" });
        return;
      case "BACKUP_SCROLL_BODY":
        requestBackupBodyScroll(action.delta);
        return;
      case "OPEN_SEARCH":
        openSearchMode();
        return;
      case "CLOSE_SEARCH":
        closeSearch();
        return;
      case "MOVE_EDITOR_FOCUS":
        uiDispatch({
          type: "setFocus",
          focus: nextEditorFocusTarget(uiState.focus, action.direction, state.editor)
        });
        return;
      case "SET_LIST_FOCUS":
        clearPendingGPrefix();
        uiDispatch({ type: "setFocus", focus: action.focus });
        return;
      case "CLEAR_BULK_MARKS":
        clearBulkMarks();
        return;
      case "SET_G_PREFIX":
        if (action.active) {
          armPendingGPrefix();
        } else {
          clearPendingGPrefix();
        }
        return;
      case "TOGGLE_VIEWS_OVERLAY":
        toggleViewsOverlay();
        return;
      case "CLOSE_VIEWS_OVERLAY":
        closeViewsOverlay();
        return;
      case "MOVE_VIEW_SELECTION":
        moveViewSelection(action.delta);
        return;
      case "MOVE_DASHBOARD_TAG_SELECTION":
        moveDashboardActiveSelection(action.delta);
        return;
      case "DASHBOARD_NEXT_FOCUS_GROUP":
        moveDashboardFocusGroup(1);
        return;
      case "DASHBOARD_PREV_FOCUS_GROUP":
        moveDashboardFocusGroup(-1);
        return;
      case "DASHBOARD_MOVE_ACTIVE_SELECTION":
        moveDashboardActiveSelection(action.delta);
        return;
      case "SCROLL_EDITOR_PAGE": {
        const nextOffset = Math.max(
          0,
          uiState.editorScrollOffset + action.direction * editorPageStep
        );
        uiDispatch({ type: "setEditorScrollOffset", scrollOffset: nextOffset });
        return;
      }
      case "OPEN_SAVE_VIEW_PROMPT":
        openSaveViewPrompt();
        return;
      case "CONFIRM_SAVE_VIEW_PROMPT":
        confirmSaveViewPrompt();
        return;
      case "CANCEL_SAVE_VIEW_PROMPT":
        cancelSaveViewPrompt();
        return;
      case "CYCLE_THEME":
        cycleThemeModeSetting();
        return;
      case "TOGGLE_FLASH_MODE":
        switchFlashModeSetting();
        return;
      case "TOGGLE_NOTIFICATIONS_ENABLED":
        switchNotificationsEnabledSetting();
        return;
      case "TOGGLE_INAPP_OVERDUE_BANNER":
        switchInAppOverduePopupSetting();
        return;
      case "TOGGLE_TERMINAL_BELL_ON_OVERDUE":
        switchTerminalBellSetting();
        return;
      case "EXIT_APP":
        void renderer.destroy();
        return;
      case "MOVE_SELECTION":
        moveSelection(action.delta);
        return;
      case "MOVE_SELECTION_PAGE":
        moveSelectionPage(action.direction);
        return;
      case "JUMP_TOP":
        jumpToTop();
        return;
      case "JUMP_BOTTOM":
        jumpToBottom();
        return;
      case "JUMP_TO_ATTENTION":
        jumpToAttention(action.kind, action.direction);
        return;
      case "APPLY_VIEW_SLOT":
        applyViewAtSlot(action.slot);
        return;
      case "APPLY_SELECTED_VIEW":
        applySelectedView();
        return;
      case "DELETE_SELECTED_VIEW":
        deleteSelectedView();
        return;
      case "TOGGLE_SELECTED":
        toggleSelected();
        return;
      case "TOGGLE_BULK_MARK":
        toggleBulkMark();
        return;
      case "OPEN_ADD":
        openAdd();
        return;
      case "OPEN_EDIT":
        openEdit();
        return;
      case "OPEN_EDIT_CHECKLIST_QUICK":
        openChecklistQuickEditFromList();
        return;
      case "OPEN_EDIT_SERIES":
        openEditSeries();
        return;
      case "OPEN_DUPLICATE":
        openDuplicate();
        return;
      case "SKIP_SELECTED_OCCURRENCE":
        skipSelectedOccurrence();
        return;
      case "SNOOZE_SELECTED_OCCURRENCE":
        snoozeSelectedOccurrence();
        return;
      case "MOVE_LINK_SELECTION":
        moveLinkSelection(action.delta);
        return;
      case "MOVE_CHECKLIST_SELECTION":
        moveChecklistSelection(action.delta);
        return;
      case "OPEN_SELECTED_LINK":
        openSelectedTaskLink();
        return;
      case "COPY_SELECTED_LINK":
        copySelectedTaskLink();
        return;
      case "TOGGLE_SELECTED_CHECKLIST_ITEM":
        toggleSelectedChecklistItem();
        return;
      case "OPEN_ADD_CHECKLIST_ITEM_MODAL":
        openAddChecklistItemModal();
        return;
      case "OPEN_EDIT_CHECKLIST_ITEM_MODAL":
        openEditChecklistItemModal();
        return;
      case "OPEN_DELETE_CHECKLIST_ITEM_MODAL":
        openDeleteChecklistItemModal();
        return;
      case "OPEN_ADD_TASK_LINK_MODAL":
        openAddTaskLinkModal();
        return;
      case "OPEN_EDIT_TASK_LINK_MODAL":
        openEditTaskLinkModal();
        return;
      case "OPEN_DELETE_TASK_LINK_MODAL":
        openDeleteTaskLinkModal();
        return;
      case "OPEN_DELETE_CONFIRM":
        openDeleteConfirm();
        return;
      case "OPEN_UNSAVED_CHANGES_MODAL":
        openUnsavedChangesModal(action.modal);
        return;
      case "MODAL_CONFIRM_UNSAVED_SAVE_CONTINUE":
        handleUnsavedChangesSaveAndContinue();
        return;
      case "MODAL_CONFIRM_UNSAVED_DISCARD_CONTINUE":
        handleUnsavedChangesDiscardAndContinue();
        return;
      case "MODAL_CANCEL_UNSAVED_CONTINUE":
        cancelUnsavedChangesContinue();
        return;
      case "OPEN_BACKUP_FINAL_CHECKPOINT_MODAL":
        openBackupFinalCheckpointModal(action.modal);
        return;
      case "MODAL_CONFIRM_BACKUP_FINAL_CHECKPOINT":
        handleBackupFinalCheckpointConfirm();
        return;
      case "MODAL_CANCEL_BACKUP_FINAL_CHECKPOINT":
        cancelBackupFinalCheckpoint();
        return;
      case "OPEN_RECURRING_DELETE_FUTURE_CHECKPOINT_MODAL":
        openRecurringDeleteFutureCheckpointModal(action.modal);
        return;
      case "MODAL_CONFIRM_RECURRING_DELETE_FUTURE_CHECKPOINT":
        handleRecurringDeleteFutureCheckpointConfirm();
        return;
      case "MODAL_CANCEL_RECURRING_DELETE_FUTURE_CHECKPOINT":
        cancelRecurringDeleteFutureCheckpoint();
        return;
      case "MODAL_CONFIRM_DELETE":
        handleDeleteSelected();
        return;
      case "MODAL_CONFIRM_DELETE_FUTURE":
        handleDeleteSelectedAndFuture();
        return;
      case "MODAL_CONFIRM_CHECKLIST_DELETE":
        handleDeleteChecklistItemFromModal();
        return;
      case "MODAL_SUBMIT_CHECKLIST_INPUT":
        submitChecklistInputModal();
        return;
      case "MODAL_CONFIRM_BULK_DELETE":
        handleConfirmBulkDeleteFromModal();
        return;
      case "MODAL_CONFIRM_TASK_LINK_DELETE":
        handleDeleteTaskLinkFromModal();
        return;
      case "MODAL_CONFIRM_TASK_LINK_OPEN_EXTERNAL":
        handleOpenExternalTaskLinkFromModal();
        return;
      case "MODAL_EDIT_SWITCH_SAVE":
        handleModalSaveAndSwitchEditTarget();
        return;
      case "MODAL_EDIT_SWITCH_DISCARD_SWITCH":
        handleModalDiscardAndSwitchEditTarget();
        return;
      case "MODAL_EDIT_SWITCH_DISCARD_CLOSE":
        handleModalDiscardAndCloseEditor();
        return;
      case "MODAL_SUBMIT_TASK_LINK_FORM":
        submitTaskLinkFormModal();
        return;
      case "MODAL_MOVE_TASK_LINK_FORM_FOCUS":
        moveTaskLinkFormFocus(action.direction);
        return;
      case "MODAL_CYCLE_TASK_LINK_FORM_TYPE":
        cycleTaskLinkFormType(action.direction);
        return;
      case "MODAL_OVERDUE_SNOOZE":
        handleOverdueModalSnooze();
        return;
      case "MODAL_OVERDUE_DONE":
        handleOverdueModalDone();
        return;
      case "MODAL_OVERDUE_GO_TO_TASK":
        handleOverdueModalGoToTask();
        return;
      case "CYCLE_STATUS":
        cycleStatus();
        return;
      case "CYCLE_SORT":
        cycleSort();
        return;
      case "CYCLE_DUE":
        cycleDue();
        return;
      case "CYCLE_ANALYTICS_WINDOW":
        cycleAnalyticsWindow();
        return;
      case "CYCLE_PRIORITY":
        cyclePriority();
        return;
      case "TOGGLE_TAG_FILTER":
        toggleTagFilter();
        return;
      case "APPLY_DASHBOARD_SELECTED_TAG":
        applyDashboardSelectedTag();
        return;
      case "APPLY_DASHBOARD_ACTIVE_SELECTION":
        applyDashboardActiveSelection();
        return;
      case "SAVE_EDITOR":
        saveEditor();
        return;
      case "ACCEPT_TITLE_INLINE":
        if (titleInlineSuggestion) {
          dispatch({
            type: "updateEditor",
            patch: { title: titleInlineSuggestion.full }
          });
        }
        return;
      case "APPLY_TIME_AUTOCOMPLETE":
        if (
          isEditorMode(uiState.mode) &&
          uiState.focus === FocusTarget.EDITOR_DUE_TIME &&
          state.editor &&
          timeSuggestion
        ) {
          const step = getAutocompleteStep(state.editor.timeText, timeSuggestion);
          if (step === "hour" || step === "minute") {
            const nextValue = applyAutocomplete(
              state.editor.timeText,
              timeSuggestion,
              step
            );
            dispatch({ type: "updateEditor", patch: { timeText: nextValue } });
          }
        }
        return;
      case "ACCEPT_DUE_SUGGESTION":
        if (dueSuggestion) {
          dispatch({ type: "updateEditor", patch: { dueText: dueSuggestion } });
        }
        return;
      case "ACCEPT_TAG_INLINE":
        if (tagInlineSuggestion) {
          handlePickTag(tagInlineSuggestion.full);
        }
        return;
      default:
        return;
    }
  }

  function closeCommandBar() {
    setCommandActive(false);
    setCommandTextValue("");
    setCommandHistoryIndex(null);
  }

  function setCommandTextValue(value: string) {
    commandTextRef.current = value;
    setCommandText(value);
  }

  function moveCommandHistory(direction: -1 | 1) {
    if (commandHistory.length === 0) return;
    if (direction === -1) {
      const nextIndex =
        commandHistoryIndex === null
          ? commandHistory.length - 1
          : Math.max(0, commandHistoryIndex - 1);
      setCommandHistoryIndex(nextIndex);
      setCommandTextValue(commandHistory[nextIndex]);
      return;
    }

    if (commandHistoryIndex === null) return;
    if (commandHistoryIndex >= commandHistory.length - 1) {
      setCommandHistoryIndex(null);
      setCommandTextValue("");
      return;
    }
    const nextIndex = commandHistoryIndex + 1;
    setCommandHistoryIndex(nextIndex);
    setCommandTextValue(commandHistory[nextIndex]);
  }

  function executeCommandBar() {
    const raw = commandTextRef.current;
    const trimmed = raw.trim();
    if (!trimmed) {
      setCommandOutput({ kind: "error", text: "Error: command is empty" });
      return;
    }

    const parsed = parseCommand(trimmed);
    if (!parsed.ok) {
      setCommandOutput({ kind: "error", text: parsed.error });
      return;
    }

    const nowMs = Date.now();
    const visibleTasks = getVisibleTasks(state, nowMs);

    if (
      parsed.command.type === "check" &&
      parsed.command.target.type === "selected" &&
      selectedTask &&
      (selectedTask.rowKind === "series_occurrence_virtual" ||
        selectedTask.rowKind === "series_occurrence_instance")
    ) {
      const nowIso = new Date(nowMs).toISOString();
      let outcome:
        | { ok: true; checklist: NonNullable<Task["checklist"]>; selectedTaskId: string }
        | { ok: false; error: string };
      let outputText = "";

      if (parsed.command.operation === "add") {
        outcome = mutateChecklistForRow(selectedTask.id, (checklist) =>
          addChecklistItem(checklist, parsed.command.text, nowIso)
        );
        outputText = `Checklist added: ${selectedTask.title}`;
      } else if (parsed.command.operation === "clear") {
        outcome = mutateChecklistForRow(selectedTask.id, () => clearChecklist());
        outputText = `Checklist cleared: ${selectedTask.title}`;
      } else {
        const item = checklistItemAtDisplayIndex(
          selectedChecklistTask?.checklist,
          parsed.command.index
        );
        if (!item) {
          setCommandOutput({ kind: "error", text: "Error: checklist item not found" });
          return;
        }
        if (parsed.command.operation === "toggle") {
          outcome = mutateChecklistForRow(selectedTask.id, (checklist) =>
            toggleChecklistItem(checklist, item.id, nowIso)
          );
          outputText = `Checklist toggled: ${selectedTask.title} (#${String(parsed.command.index)})`;
        } else if (parsed.command.operation === "edit") {
          outcome = mutateChecklistForRow(selectedTask.id, (checklist) =>
            editChecklistItem(checklist, item.id, parsed.command.text, nowIso)
          );
          outputText = `Checklist edited: ${selectedTask.title} (#${String(parsed.command.index)})`;
        } else {
          outcome = mutateChecklistForRow(selectedTask.id, (checklist) =>
            deleteChecklistItem(checklist, item.id)
          );
          outputText = `Checklist deleted: ${selectedTask.title} (#${String(parsed.command.index)})`;
        }
      }

      if (!outcome.ok) {
        setCommandOutput({ kind: "error", text: outcome.error });
        return;
      }

      if (parsed.command.operation === "add") {
        const nextItems = sortChecklistItems(outcome.checklist);
        setSelectedChecklistItemId(nextItems[nextItems.length - 1]?.id);
      } else if (parsed.command.operation === "clear") {
        setSelectedChecklistItemId(undefined);
      } else if (parsed.command.operation === "del") {
        const nextItems = sortChecklistItems(outcome.checklist);
        setSelectedChecklistItemId(nextItems[0]?.id);
      } else {
        const item = checklistItemAtDisplayIndex(
          selectedChecklistTask?.checklist,
          parsed.command.index
        );
        setSelectedChecklistItemId(item?.id);
      }

      setCommandOutput({ kind: "ok", text: outputText });
      setCommandHistory((previous) => [...previous, raw]);
      setCommandHistoryIndex(null);
      setCommandTextValue("");
      return;
    }

    if (parsed.command.type === "bulk" && parsed.command.operation === "delete") {
      const targetIds =
        parsed.command.target.type === "marked"
          ? bulkMarkedTaskIds
          : parsed.command.target.ids;
      const resolvedTargetIds = Array.from(new Set(targetIds)).sort((left, right) =>
        left.localeCompare(right)
      );
      if (resolvedTargetIds.length === 0) {
        setCommandOutput({ kind: "error", text: "No tasks marked. Press 'm' to mark tasks first." });
        return;
      }
      const byId = new Map(state.tasks.map((task) => [task.id, task]));
      const targetTasks: Task[] = [];
      for (const id of resolvedTargetIds) {
        const task = byId.get(id);
        if (!task) {
          setCommandOutput({ kind: "error", text: `Error: bulk target id not found (${id})` });
          return;
        }
        targetTasks.push(task);
      }
      if (targetTasks.some((task) => task.instance_of)) {
        setCommandOutput({
          kind: "error",
          text:
            "Bulk delete cannot delete recurring occurrences. Unmark occurrences or delete individually (d)."
        });
        return;
      }
      openModalWithContext({
        type: "bulk_delete",
        taskIds: resolvedTargetIds,
        recurringSeriesCount: targetTasks.filter((task) => Boolean(task.recurrence)).length,
        previousMode: Mode.LIST,
        previousFocus: uiState.focus
      });
      setCommandOutput({
        kind: "ok",
        text: `Bulk delete pending confirmation (${String(resolvedTargetIds.length)} tasks)`
      });
      setCommandHistory((previous) => [...previous, raw]);
      setCommandHistoryIndex(null);
      setCommandTextValue("");
      return;
    }

    const result = executeCommand(parsed.command, {
      now: nowMs,
      state,
      visibleTasks,
      selectedTaskId: state.selectedId ?? visibleTasks[0]?.id,
      bulkMarkedTaskIds
    });
    for (const action of result.actions) {
      dispatch(action);
    }
    setCommandOutput(result.output);
    setCommandHistory((previous) => [...previous, raw]);
    setCommandHistoryIndex(null);
    setCommandTextValue("");
  }

  useKeyboard((key) => {
    if (!terminalIsSupported) {
      if ((key.name ?? "") === "q" && key.eventType !== "release") {
        void renderer.destroy();
      }
      return;
    }

    const keyName = key.name ?? "";
    const keySequence = key.sequence ?? "";
    const isCtrlPrefixStartKey =
      key.ctrl &&
      !key.meta &&
      !key.option &&
      !key.shift &&
      (
        keyName === "g" ||
        keySequence === "g" ||
        keyName === "p" ||
        keySequence === "p" ||
        keyName === "y" ||
        keySequence === "y"
      );

    if (key.eventType === "release") {
      if (isCtrlPrefixStartKey && pendingGPrefix) {
        armPendingGPrefixResolveTimeout();
      }
      return;
    }

    if (
      isCtrlPrefixStartKey &&
      pendingGPrefix &&
      (key.eventType === "repeat" || key.repeated === true)
    ) {
      // Keep prefix popup open while Ctrl+g/Ctrl+p/Ctrl+y is held by extending timeout on repeats.
      armPendingGPrefixResolveTimeout();
      return;
    }

    if (
      uiState.mode === Mode.EDIT &&
      uiState.focus !== FocusTarget.EDITOR_SAVE &&
      uiState.focus !== FocusTarget.EDITOR_CANCEL
    ) {
      const isUnmodifiedInput = !key.ctrl && !key.meta && !key.option;
      const isPrintableInput =
        keySequence.length === 1 && keySequence >= " " && keyName !== "escape";
      const isDeletionInput = keyName === "backspace" || keyName === "delete";
      if (isUnmodifiedInput && (isPrintableInput || isDeletionInput)) {
        editorDirtyIntentRef.current = true;
      }
    }
    if (commandActive) {
      if (keyName === "escape") {
        closeCommandBar();
        return;
      }
      if (keyName === "up") {
        moveCommandHistory(-1);
        return;
      }
      if (keyName === "down") {
        moveCommandHistory(1);
        return;
      }
      if (keyName === "return" || keyName === "enter") {
        executeCommandBar();
        return;
      }
      return;
    }

    if (
      saveConflictBannerState &&
      !saveConflictRetryPending &&
      !key.ctrl &&
      !key.meta &&
      !key.option &&
      keyName === "r"
    ) {
      void handleRetrySaveAfterConflictReload();
      return;
    }

    if (
      uiState.mode === Mode.LIST &&
      !viewsOverlayOpen &&
      !saveViewPromptOpen &&
      (keySequence === "`" || keyName === "`")
    ) {
      setCommandActive(true);
      setCommandTextValue("");
      setCommandHistoryIndex(null);
      return;
    }

    if (uiState.mode === Mode.HELP && activeHelpPage === "custom1Edit") {
      const handled = custom1EditorRef.current?.handleKey(key) ?? false;
      if (handled) {
        return;
      }
    }
    if (uiState.mode === Mode.HELP && activeHelpPage === "textTuningEdit") {
      const handled = builtInTextEditorRef.current?.handleKey(key) ?? false;
      if (handled) {
        return;
      }
    }

    if (
      uiState.mode === Mode.HELP &&
      activeHelpPage === "settings" &&
      clampedHelpNavSelectionIndex === HELP_SETTINGS_LOGO_NAV_INDEX
    ) {
      if (keyName === "left") {
        cycleLogoModeSetting(-1, false);
        return;
      }
      if (keyName === "right") {
        cycleLogoModeSetting(1, false);
        return;
      }
      if (keyName === "return" || keyName === "enter") {
        commitLogoModeSetting();
        return;
      }
      if (keyName === "escape" || keyName === "backspace") {
        cancelLogoModeSetting();
        handleHelpNavBack();
        return;
      }
    }

    const actions = handleKey(
      {
        name: keyName,
        sequence: keySequence,
        ctrl: key.ctrl === true,
        shift: key.shift === true
      },
      {
        uiState,
        hasTitleInlineSuggestion: Boolean(titleInlineSuggestion),
        hasTagInlineSuggestion: Boolean(tagInlineSuggestion),
        hasDueSuggestion: Boolean(dueSuggestion),
        timeAutocompleteStep,
        hasPendingGPrefix: pendingGPrefix,
        bulkActive,
        viewsOverlayOpen,
        saveViewPromptOpen,
        allowEmptyNuxRecoveryImport: showCorruptionRecoveryImportCta,
        backupScreen: uiState.mode === Mode.BACKUP_CENTER ? backupState.screen : null,
        selectedTaskHasChecklistItems: (selectedTask?.checklist?.length ?? 0) > 0,
        resolvedKeymapAliases,
        helpPage: activeHelpPage
      }
    );

    for (const action of actions) {
      try {
        runRoutedAction(action);
      } catch (error) {
        const detail = normalizeErrorDetail(error);
        showShortNavigationBanner(`Action failed: ${detail}`);
        console.error("[TADOI] routed action failed", action, error);
      }
    }
  }, { release: true });

  function openHelp(options: { bypassUnsavedGuard?: boolean } = {}) {
    if (!options.bypassUnsavedGuard && requestTaskEditorUnsavedGuard("open_help")) {
      return;
    }
    clearPendingGPrefix();
    setHelpExpandedBySection(createDefaultHelpExpandedState());
    helpFocusedSectionRef.current = 0;
    setHelpFocusedSectionIndex(0);
    helpScrollTopRef.current = 0;
    setHelpScrollOffset(0);
    setHelpNavScrollOffset(0);
    setHelpNavStack(["help"]);
    setHelpNavSelection({
      settings: 0,
      keymapAliases: 0,
      theme: 0,
      custom1: 0,
      textTuning: 0,
      textTuningTheme: 0
    });
    setHelpTextTuningThemeId(HELP_TEXT_TUNING_THEMES[0] ?? "default");
    setHelpPreviewThemeMode(null);
    setHelpDraftLogoMode(null);
    setBuiltInTextDraftGlobal({});
    setBuiltInTextDraftObjects({});
    helpPreviewRestoreThemeRef.current = null;
    helpReturnContextRef.current = {
      mode: uiState.mode,
      focus: uiState.focus
    };
    uiDispatch({
      type: "captureReturnContext",
      mode: uiState.mode,
      focus: uiState.focus
    });
    uiDispatch({ type: "setMode", mode: Mode.HELP });
  }

  function pushHelpPage(page: HelpPage) {
    setHelpNavStack((prev) => {
      if (prev[prev.length - 1] === page) return prev;
      return [...prev, page];
    });
    helpScrollTopRef.current = 0;
    setHelpScrollOffset(0);
    setHelpNavScrollOffset(0);
  }

  function popHelpPage() {
    setHelpNavStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
    helpScrollTopRef.current = 0;
    setHelpScrollOffset(0);
    setHelpNavScrollOffset(0);
  }

  function sanitizeDraftObjects(
    objects: Partial<Record<ThemeObjectId, Partial<ThemeTokens>>>
  ): Partial<Record<ThemeObjectId, Partial<ThemeTokens>>> | undefined {
    const next: Partial<Record<ThemeObjectId, Partial<ThemeTokens>>> = {};
    for (const [objectId, tokens] of Object.entries(objects) as Array<
      [ThemeObjectId, Partial<ThemeTokens>]
    >) {
      if (Object.keys(tokens).length > 0) {
        next[objectId] = { ...tokens };
      }
    }
    return Object.keys(next).length > 0 ? next : undefined;
  }

  function openCustom1Editor() {
    const persisted = resolveCustom1Config(settingsState.customThemes);
    setCustom1DraftGlobal(cloneThemeTokens(persisted.global));
    setCustom1DraftObjects(cloneThemeObjectOverrides(persisted.objects));
    helpPreviewRestoreThemeRef.current = settingsState.themeId;
    setHelpPreviewThemeMode("custom1");
    pushHelpPage("custom1Edit");
  }

  function closeCustom1EditorCancel() {
    const persisted = resolveCustom1Config(settingsState.customThemes);
    const restoreTheme = helpPreviewRestoreThemeRef.current;
    setCustom1DraftGlobal(cloneThemeTokens(persisted.global));
    setCustom1DraftObjects(cloneThemeObjectOverrides(persisted.objects));
    setHelpPreviewThemeMode(null);
    if (restoreTheme && settingsState.themeId !== restoreTheme) {
      settingsDispatch({ type: "setTheme", themeId: restoreTheme });
    }
    helpPreviewRestoreThemeRef.current = null;
    setHelpNavStack((prev) =>
      prev[prev.length - 1] === "custom1Edit" ? prev.slice(0, -1) : prev
    );
  }

  function saveCustom1Editor(): boolean {
    const objects = sanitizeDraftObjects(custom1DraftObjects);
    const contrastResult = validateCustomThemeContrast({
      global: custom1DraftGlobal,
      objects,
      baselineGlobal: persistedCustom1.global,
      baselineObjects: persistedCustom1.objects
    });
    if (!contrastResult.ok) {
      const firstIssue = contrastResult.issues[0];
      if (firstIssue) {
        showShortNavigationBanner(
          `Theme save blocked: ${formatContrastIssueForBanner(firstIssue)}`
        );
      } else {
        showShortNavigationBanner("Theme save blocked by contrast gate");
      }
      return false;
    }

    settingsDispatch({
      type: "setCustomThemes",
      customThemes: {
        ...(settingsState.customThemes ?? {}),
        custom1: objects
          ? { global: cloneThemeTokens(custom1DraftGlobal), objects }
          : { global: cloneThemeTokens(custom1DraftGlobal) }
      }
    });
    settingsDispatch({ type: "setTheme", themeId: "custom1" });
    setHelpPreviewThemeMode(null);
    helpPreviewRestoreThemeRef.current = null;
    setHelpNavStack((prev) =>
      prev[prev.length - 1] === "custom1Edit" ? prev.slice(0, -1) : prev
    );
    showShortNavigationBanner("Custom1 theme saved");
    return true;
  }

  function openBuiltInTextEditor() {
    setBuiltInTextDraftGlobal(cloneThemeTextTokenOverrides(persistedBuiltInTextConfig.global));
    setBuiltInTextDraftObjects(cloneThemeTextObjectOverrides(persistedBuiltInTextConfig.objects));
    helpPreviewRestoreThemeRef.current = settingsState.themeId;
    setHelpPreviewThemeMode(helpTextTuningThemeId);
    pushHelpPage("textTuningEdit");
  }

  function closeBuiltInTextEditorCancel() {
    const restoreTheme = helpPreviewRestoreThemeRef.current;
    setBuiltInTextDraftGlobal(cloneThemeTextTokenOverrides(persistedBuiltInTextConfig.global));
    setBuiltInTextDraftObjects(cloneThemeTextObjectOverrides(persistedBuiltInTextConfig.objects));
    setHelpPreviewThemeMode(null);
    if (restoreTheme && settingsState.themeId !== restoreTheme) {
      settingsDispatch({ type: "setTheme", themeId: restoreTheme });
    }
    helpPreviewRestoreThemeRef.current = null;
    setHelpNavStack((prev) =>
      prev[prev.length - 1] === "textTuningEdit" ? prev.slice(0, -1) : prev
    );
  }

  function saveBuiltInTextEditor(): boolean {
    const sanitizedGlobal = sanitizeThemeTextTokenOverrides(builtInTextDraftGlobal);
    const sanitizedObjects = sanitizeThemeTextObjectOverrides(builtInTextDraftObjects);
    const contrastResult = validateBuiltInTextContrast({
      themeId: helpTextTuningThemeId,
      global: sanitizedGlobal,
      objects: sanitizedObjects,
      baselineGlobal: persistedBuiltInTextConfig.global,
      baselineObjects: persistedBuiltInTextConfig.objects
    });
    if (!contrastResult.ok) {
      const firstIssue = contrastResult.issues[0];
      if (firstIssue) {
        showShortNavigationBanner(
          `Text tuning blocked: ${formatContrastIssueForBanner(firstIssue)}`
        );
      } else {
        showShortNavigationBanner("Text tuning blocked by contrast gate");
      }
      return false;
    }

    const existingTextByTheme = {
      ...(settingsState.customThemes?.textByTheme ?? {})
    };

    if (!sanitizedGlobal && !sanitizedObjects) {
      delete existingTextByTheme[helpTextTuningThemeId];
    } else {
      const nextConfig: BuiltInThemeTextOverrideConfig = {};
      if (sanitizedGlobal) {
        nextConfig.global = sanitizedGlobal;
      }
      if (sanitizedObjects) {
        nextConfig.objects = sanitizedObjects;
      }
      existingTextByTheme[helpTextTuningThemeId] = nextConfig;
    }

    const nextCustomThemes: CustomThemes = {
      ...(settingsState.customThemes ?? {})
    };
    if (Object.keys(existingTextByTheme).length > 0) {
      nextCustomThemes.textByTheme = existingTextByTheme;
    } else {
      delete nextCustomThemes.textByTheme;
    }

    settingsDispatch({
      type: "setCustomThemes",
      customThemes: nextCustomThemes
    });

    const restoreTheme = helpPreviewRestoreThemeRef.current;
    setHelpPreviewThemeMode(null);
    if (restoreTheme && settingsState.themeId !== restoreTheme) {
      settingsDispatch({ type: "setTheme", themeId: restoreTheme });
    }
    helpPreviewRestoreThemeRef.current = null;
    setHelpNavStack((prev) =>
      prev[prev.length - 1] === "textTuningEdit" ? prev.slice(0, -1) : prev
    );
    showShortNavigationBanner(`${formatThemeIdLabel(helpTextTuningThemeId)} text colors saved`);
    return true;
  }

  function cycleLogoModeSetting(direction: 1 | -1, commit: boolean) {
    const baseMode = helpDraftLogoMode ?? settingsState.logoMode;
    const nextMode = cycleLogoMode(baseMode, direction);
    if (!commit) {
      setHelpDraftLogoMode(nextMode);
      return;
    }
    setHelpDraftLogoMode(null);
    if (nextMode === settingsState.logoMode) {
      return;
    }
    settingsDispatch({ type: "setLogoMode", logoMode: nextMode });
    showShortNavigationBanner(`Logo: ${formatLogoModeLabel(nextMode)}`);
  }

  function commitLogoModeSetting() {
    const nextMode = helpDraftLogoMode ?? settingsState.logoMode;
    setHelpDraftLogoMode(null);
    if (nextMode === settingsState.logoMode) {
      return;
    }
    settingsDispatch({ type: "setLogoMode", logoMode: nextMode });
    showShortNavigationBanner(`Logo: ${formatLogoModeLabel(nextMode)}`);
  }

  function cancelLogoModeSetting() {
    setHelpDraftLogoMode(null);
  }

  function cycleThemeModeSetting() {
    settingsDispatch({ type: "cycleTheme" });
  }

  function cycleHintDisplayModeSetting() {
    const nextMode: HintDisplayMode =
      settingsState.hintDisplayMode === "bottom"
        ? "left_rail"
        : settingsState.hintDisplayMode === "left_rail"
          ? "both"
          : settingsState.hintDisplayMode === "both"
            ? "none"
            : "bottom";
    settingsDispatch({ type: "setHintDisplayMode", hintDisplayMode: nextMode });
    showShortNavigationBanner(
      `Navigation hints: ${formatHintDisplayModeStatusLabel(nextMode)}`
    );
  }

  function switchPrefixPopupSetting() {
    const nextEnabled = !settingsState.showPrefixHintPopup;
    settingsDispatch({
      type: "setShowPrefixHintPopup",
      showPrefixHintPopup: nextEnabled
    });
    showShortNavigationBanner(`Prefix popup: ${nextEnabled ? "on" : "off"}`);
  }

  function switchFlashModeSetting() {
    const nextMode: FlashMode = settingsState.flashMode === "slow" ? "static" : "slow";
    settingsDispatch({ type: "toggleFlashMode" });
    showShortNavigationBanner(
      nextMode === "static" ? "Flash mode: static (overdue = red)" : "Flash mode: slow"
    );
  }

  function switchCrtFxLiteSetting() {
    const nextEnabled = !settingsState.crtFxLite;
    settingsDispatch({ type: "toggleCrtFxLite" });
    showShortNavigationBanner(`CRT FX Lite: ${nextEnabled ? "on" : "off"}`);
  }

  function cycleCrtFxProfileSetting() {
    const nextProfile = cycleCrtFxLiteProfile({
      color: settingsState.crtFxColor,
      preset: settingsState.crtFxPreset
    });
    settingsDispatch({ type: "setCrtFxColor", crtFxColor: nextProfile.color });
    settingsDispatch({ type: "setCrtFxPreset", crtFxPreset: nextProfile.preset });
    showShortNavigationBanner(
      `CRT FX Profile: ${formatCrtFxLiteProfileLabel(nextProfile.color, nextProfile.preset)}`
    );
  }

  function cycleRetroFxModeSetting() {
    const nextMode = cycleRetroFxMode(settingsState.retroFxMode);
    settingsDispatch({ type: "setRetroFxMode", retroFxMode: nextMode });
    showShortNavigationBanner(`Retro FX Mode: ${formatRetroFxModeLabel(nextMode)}`);
  }

  function switchNotificationsEnabledSetting() {
    const nextEnabled = !settingsState.notifications.enabled;
    settingsDispatch({ type: "toggleNotificationsEnabled" });
    showShortNavigationBanner(`Notifications: ${nextEnabled ? "on" : "off"}`);
  }

  function switchInAppOverduePopupSetting() {
    const nextEnabled = !settingsState.notifications.inAppOverdueBanner;
    settingsDispatch({ type: "toggleInAppOverdueBanner" });
    showShortNavigationBanner(`Overdue popup: ${nextEnabled ? "on" : "off"}`);
  }

  function switchTerminalBellSetting() {
    const nextEnabled = !settingsState.notifications.terminalBellOnOverdue;
    settingsDispatch({ type: "toggleTerminalBellOnOverdue" });
    showShortNavigationBanner(`Terminal bell: ${nextEnabled ? "on" : "off"}`);
  }

  function setContextKeymapAliasPreset(context: KeymapAliasPresetContext, enabled: boolean) {
    const nextAliases = cloneKeymapAliases(settingsState.keymapAliases) ?? {};
    if (enabled) {
      nextAliases[context] = cloneKeymapAliasConfig(KEYMAP_ALIAS_PRESETS_BY_CONTEXT[context]);
    } else {
      delete nextAliases[context];
    }
    settingsDispatch({
      type: "setKeymapAliases",
      keymapAliases: Object.keys(nextAliases).length > 0 ? nextAliases : undefined
    });
  }

  function toggleContextKeymapAliasPreset(context: KeymapAliasPresetContext) {
    const currentState = resolveKeymapAliasPresetState(context, settingsState.keymapAliases);
    const nextEnabled = currentState !== "preset";
    setContextKeymapAliasPreset(context, nextEnabled);
    showShortNavigationBanner(
      `${context} aliases: ${nextEnabled ? "on (preset)" : "off"}`
    );
  }

  function clearAllKeymapAliases() {
    settingsDispatch({ type: "setKeymapAliases", keymapAliases: undefined });
    showShortNavigationBanner("Keymap aliases reset to defaults");
  }

  function openBackupCenter(options: { bypassUnsavedGuard?: boolean } = {}) {
    if (!options.bypassUnsavedGuard && requestTaskEditorUnsavedGuard("open_backup_center")) {
      return;
    }
    clearPendingGPrefix();
    closeViewsOverlay();
    if (uiState.modal) {
      uiDispatch({ type: "setModal", modal: null });
    }
    if (isEditorMode(uiState.mode)) {
      setTimeSuggestion(null);
      dispatch({ type: "setEditor", editor: null });
      uiDispatch({ type: "setEditorScrollOffset", scrollOffset: 0 });
    }
    backupDispatch({ type: "reset" });
    uiDispatch({
      type: "captureReturnContext",
      mode: uiState.mode,
      focus: uiState.focus
    });
    uiDispatch({ type: "setMode", mode: Mode.BACKUP_CENTER });
    uiDispatch({ type: "setFocus", focus: FocusTarget.BACKUP_CENTER });
  }

  function openBackupImportFromEmptyNux() {
    clearPendingGPrefix();
    closeViewsOverlay();
    uiDispatch(clearEmptyNux());
    backupDispatch({ type: "reset" });
    uiDispatch({
      type: "captureReturnContext",
      mode: Mode.LIST,
      focus: FocusTarget.TASK_LIST
    });
    uiDispatch({ type: "setMode", mode: Mode.BACKUP_CENTER });
    uiDispatch({ type: "setFocus", focus: FocusTarget.BACKUP_CENTER });
    openBackupImportPicker();
  }

  function toggleDashboard() {
    clearPendingGPrefix();
    closeViewsOverlay();

    if (uiState.mode === Mode.DASHBOARD) {
      uiDispatch({ type: "setMode", mode: Mode.LIST });
      uiDispatch({ type: "setFocus", focus: FocusTarget.TASK_LIST });
      return;
    }

    if (isEditorMode(uiState.mode)) {
      setTimeSuggestion(null);
      dispatch({ type: "setEditor", editor: null });
      uiDispatch({ type: "setEditorScrollOffset", scrollOffset: 0 });
    }

    setDashboardTagSelection(0);
    setDashboardDueBucketSelection(0);
    setDashboardPrioritySelection(0);
    setDashboardAssigneeSelection(0);
    setDashboardProjectSelection(0);
    setDashboardWorkflowStageSelection(0);
    setDashboardFocusGroup("top_tags");
    uiDispatch({ type: "setMode", mode: Mode.DASHBOARD });
    uiDispatch({ type: "setFocus", focus: FocusTarget.DASHBOARD });
  }

  function closeHelp(options: { bypassUnsavedGuard?: boolean } = {}) {
    if (
      !options.bypassUnsavedGuard &&
      helpNavStack[helpNavStack.length - 1] === "custom1Edit" &&
      requestHelpThemeEditorUnsavedGuard("help_custom1_editor", "close_help")
    ) {
      return;
    }
    if (
      !options.bypassUnsavedGuard &&
      helpNavStack[helpNavStack.length - 1] === "textTuningEdit" &&
      requestHelpThemeEditorUnsavedGuard("help_text_tuning_editor", "close_help")
    ) {
      return;
    }
    if (helpNavStack[helpNavStack.length - 1] === "custom1Edit") {
      closeCustom1EditorCancel();
    }
    if (helpNavStack[helpNavStack.length - 1] === "textTuningEdit") {
      closeBuiltInTextEditorCancel();
    }
    cancelLogoModeSetting();
    const { mode: returnMode, focus: returnFocus } = normalizeHelpReturnContext(
      helpReturnContextRef.current.mode,
      helpReturnContextRef.current.focus
    );
    uiDispatch({ type: "setMode", mode: returnMode });
    uiDispatch({ type: "setFocus", focus: returnFocus });
  }

  function moveHelpSectionFocus(delta: 1 | -1) {
    if (activeHelpPage !== "help") {
      if (activeHelpPage === "settings") {
        setHelpNavSelection((prev) => ({
          ...prev,
          settings: Math.max(
            0,
            Math.min(prev.settings + delta, HELP_SETTINGS_NAV_ITEMS.length - 1)
          )
        }));
      } else if (activeHelpPage === "keymapAliases") {
        setHelpNavSelection((prev) => ({
          ...prev,
          keymapAliases: Math.max(
            0,
            Math.min(prev.keymapAliases + delta, HELP_KEYMAP_ALIAS_NAV_ITEMS.length - 1)
          )
        }));
      } else if (activeHelpPage === "theme") {
        setHelpNavSelection((prev) => ({
          ...prev,
          theme: Math.max(
            0,
            Math.min(prev.theme + delta, HELP_THEME_NAV_ITEMS.length - 1)
          )
        }));
      } else if (activeHelpPage === "custom1") {
        setHelpNavSelection((prev) => ({
          ...prev,
          custom1: Math.max(
            0,
            Math.min(prev.custom1 + delta, HELP_CUSTOM1_NAV_ITEMS.length - 1)
          )
        }));
      } else if (activeHelpPage === "textTuning") {
        setHelpNavSelection((prev) => ({
          ...prev,
          textTuning: Math.max(
            0,
            Math.min(prev.textTuning + delta, HELP_TEXT_TUNING_NAV_ITEMS.length - 1)
          )
        }));
      } else if (activeHelpPage === "textTuningTheme") {
        setHelpNavSelection((prev) => ({
          ...prev,
          textTuningTheme: Math.max(
            0,
            Math.min(prev.textTuningTheme + delta, HELP_TEXT_TUNING_THEME_NAV_ITEMS.length - 1)
          )
        }));
      }
      return;
    }
    const nextIndex = Math.max(
      0,
      Math.min(helpFocusedSectionRef.current + delta, HELP_MENU_SECTIONS.length - 1)
    );
    helpFocusedSectionRef.current = nextIndex;
    setHelpFocusedSectionIndex(nextIndex);
    ensureHelpSectionVisibleNow(nextIndex);
  }

  function scrollHelpByPage(direction: 1 | -1) {
    if (activeHelpPage !== "help") return;
    const currentOffset = getCurrentHelpScrollTop();
    const nextOffset = clampScrollOffset(
      currentOffset + direction * helpPageStep,
      helpContentVisibleRows,
      helpRows.length
    );
    const appliedOffset = scrollHelpTo(nextOffset);
    // Page-scrolling in Help moves focus to the section nearest the top of the viewport.
    const nextFocusedSectionIndex = findHelpSectionIndexForViewportTop(
      helpSections,
      appliedOffset
    );
    helpFocusedSectionRef.current = nextFocusedSectionIndex;
    setHelpFocusedSectionIndex(nextFocusedSectionIndex);
  }

  function setHelpSectionExpanded(sectionIndex: number, expanded: boolean) {
    setHelpExpandedBySection((prev) => {
      if (sectionIndex < 0 || sectionIndex >= prev.length) return prev;
      if (prev[sectionIndex] === expanded) return prev;
      const next = [...prev];
      next[sectionIndex] = expanded;
      return next;
    });
  }

  function toggleHelpSection(sectionIndex: number) {
    setHelpExpandedBySection((prev) => {
      if (sectionIndex < 0 || sectionIndex >= prev.length) return prev;
      const next = [...prev];
      next[sectionIndex] = !next[sectionIndex];
      return next;
    });
  }

  function toggleFocusedHelpSection() {
    if (
      activeHelpPage === "help" &&
      HELP_SETTINGS_NAV_SECTION_INDEX >= 0 &&
      clampedHelpFocusedSectionIndex === HELP_SETTINGS_NAV_SECTION_INDEX
    ) {
      pushHelpPage("settings");
      return;
    }
    toggleHelpSection(clampedHelpFocusedSectionIndex);
  }

  function setFocusedHelpSectionExpanded(expanded: boolean) {
    if (
      activeHelpPage === "help" &&
      expanded &&
      HELP_SETTINGS_NAV_SECTION_INDEX >= 0 &&
      clampedHelpFocusedSectionIndex === HELP_SETTINGS_NAV_SECTION_INDEX
    ) {
      pushHelpPage("settings");
      return;
    }
    setHelpSectionExpanded(clampedHelpFocusedSectionIndex, expanded);
  }

  function handleHelpSectionHeaderClick(sectionIndex: number) {
    if (activeHelpPage !== "help") return;
    const nextIndex = Math.max(0, Math.min(sectionIndex, HELP_MENU_SECTIONS.length - 1));
    helpFocusedSectionRef.current = nextIndex;
    setHelpFocusedSectionIndex(nextIndex);
    ensureHelpSectionVisibleNow(nextIndex);
    if (HELP_SETTINGS_NAV_SECTION_INDEX >= 0 && sectionIndex === HELP_SETTINGS_NAV_SECTION_INDEX) {
      pushHelpPage("settings");
      return;
    }
    toggleHelpSection(sectionIndex);
  }

  function setHelpNavSelectionForActivePage(index: number) {
    if (activeHelpPage === "settings") {
      setHelpNavSelection((prev) => ({ ...prev, settings: index }));
      return;
    }
    if (activeHelpPage === "keymapAliases") {
      setHelpNavSelection((prev) => ({ ...prev, keymapAliases: index }));
      return;
    }
    if (activeHelpPage === "theme") {
      setHelpNavSelection((prev) => ({ ...prev, theme: index }));
      return;
    }
    if (activeHelpPage === "custom1") {
      setHelpNavSelection((prev) => ({ ...prev, custom1: index }));
      return;
    }
    if (activeHelpPage === "textTuning") {
      setHelpNavSelection((prev) => ({ ...prev, textTuning: index }));
      return;
    }
    if (activeHelpPage === "textTuningTheme") {
      setHelpNavSelection((prev) => ({ ...prev, textTuningTheme: index }));
    }
  }

  function handleHelpNavForward(targetIndex = clampedHelpNavSelectionIndex) {
    if (activeHelpPage === "settings") {
      if (targetIndex === HELP_SETTINGS_THEME_NAV_INDEX) {
        cancelLogoModeSetting();
        pushHelpPage("theme");
      }
      if (targetIndex === HELP_SETTINGS_KEYMAP_ALIASES_NAV_INDEX) {
        pushHelpPage("keymapAliases");
      }
      if (targetIndex === HELP_SETTINGS_NAVIGATION_HINTS_NAV_INDEX) {
        cycleHintDisplayModeSetting();
      }
      if (targetIndex === HELP_SETTINGS_PREFIX_POPUP_NAV_INDEX) {
        switchPrefixPopupSetting();
      }
      if (targetIndex === HELP_SETTINGS_LOGO_NAV_INDEX) {
        cycleLogoModeSetting(1, true);
      }
      if (targetIndex === HELP_SETTINGS_FLASH_NAV_INDEX) switchFlashModeSetting();
      if (targetIndex === HELP_SETTINGS_CRT_FX_NAV_INDEX) switchCrtFxLiteSetting();
      if (targetIndex === HELP_SETTINGS_CRT_FX_PROFILE_NAV_INDEX) cycleCrtFxProfileSetting();
      if (targetIndex === HELP_SETTINGS_RETRO_FX_MODE_NAV_INDEX) cycleRetroFxModeSetting();
      if (targetIndex === HELP_SETTINGS_NOTIFICATIONS_NAV_INDEX) {
        switchNotificationsEnabledSetting();
      }
      if (targetIndex === HELP_SETTINGS_OVERDUE_POPUP_NAV_INDEX) {
        switchInAppOverduePopupSetting();
      }
      if (targetIndex === HELP_SETTINGS_TERMINAL_BELL_NAV_INDEX) switchTerminalBellSetting();
      return;
    }
    if (activeHelpPage === "keymapAliases") {
      if (targetIndex === HELP_KEYMAP_ALIAS_RESET_NAV_INDEX) {
        clearAllKeymapAliases();
        return;
      }
      const context = KEYMAP_ALIAS_PRESET_CONTEXT_ORDER[targetIndex];
      if (!context) return;
      toggleContextKeymapAliasPreset(context);
      return;
    }
    if (activeHelpPage === "theme") {
      if (targetIndex === 0) cycleThemeModeSetting();
      if (targetIndex === 1) pushHelpPage("custom1");
      if (targetIndex === 2) pushHelpPage("textTuning");
      return;
    }
    if (activeHelpPage === "custom1") {
      if (targetIndex === 0) {
        openCustom1Editor();
      }
      return;
    }
    if (activeHelpPage === "textTuning") {
      const targetThemeId = HELP_TEXT_TUNING_THEMES[targetIndex];
      if (!targetThemeId) return;
      setHelpTextTuningThemeId(targetThemeId);
      setHelpNavSelection((prev) => ({ ...prev, textTuningTheme: 0 }));
      pushHelpPage("textTuningTheme");
      return;
    }
    if (activeHelpPage === "textTuningTheme") {
      if (targetIndex === 0) {
        openBuiltInTextEditor();
      }
    }
  }

  function handleHelpNavBack() {
    if (activeHelpPage === "custom1Edit") {
      if (requestHelpThemeEditorUnsavedGuard("help_custom1_editor", "close_editor")) {
        return;
      }
      closeCustom1EditorCancel();
      return;
    }
    if (activeHelpPage === "textTuningEdit") {
      if (requestHelpThemeEditorUnsavedGuard("help_text_tuning_editor", "close_editor")) {
        return;
      }
      closeBuiltInTextEditorCancel();
      return;
    }
    if (activeHelpPage === "settings") {
      cancelLogoModeSetting();
    }
    popHelpPage();
  }

  function openListMode(options: { bypassUnsavedGuard?: boolean } = {}) {
    if (!options.bypassUnsavedGuard && requestTaskEditorUnsavedGuard("open_list")) {
      return;
    }
    clearPendingGPrefix();
    closeViewsOverlay();
    if (uiState.modal) {
      uiDispatch({ type: "setModal", modal: null });
    }
    if (isEditorMode(uiState.mode)) {
      setTimeSuggestion(null);
      dispatch({ type: "setEditor", editor: null });
      uiDispatch({ type: "setEditorScrollOffset", scrollOffset: 0 });
    }
    uiDispatch({ type: "setMode", mode: Mode.LIST });
    uiDispatch({ type: "setFocus", focus: FocusTarget.TASK_LIST });
  }

  function openDashboardMode(options: { bypassUnsavedGuard?: boolean } = {}) {
    if (uiState.mode === Mode.DASHBOARD) return;
    if (!options.bypassUnsavedGuard && requestTaskEditorUnsavedGuard("open_dashboard")) {
      return;
    }
    clearPendingGPrefix();
    closeViewsOverlay();
    if (uiState.modal) {
      uiDispatch({ type: "setModal", modal: null });
    }
    if (isEditorMode(uiState.mode)) {
      setTimeSuggestion(null);
      dispatch({ type: "setEditor", editor: null });
      uiDispatch({ type: "setEditorScrollOffset", scrollOffset: 0 });
    }
    setDashboardTagSelection(0);
    setDashboardDueBucketSelection(0);
    setDashboardPrioritySelection(0);
    setDashboardAssigneeSelection(0);
    setDashboardProjectSelection(0);
    setDashboardWorkflowStageSelection(0);
    setDashboardFocusGroup("top_tags");
    uiDispatch({ type: "setMode", mode: Mode.DASHBOARD });
    uiDispatch({ type: "setFocus", focus: FocusTarget.DASHBOARD });
  }

  function openSearchMode(options: { bypassUnsavedGuard?: boolean } = {}) {
    if (!options.bypassUnsavedGuard && requestTaskEditorUnsavedGuard("open_search")) {
      return;
    }
    clearPendingGPrefix();
    closeViewsOverlay();
    if (uiState.modal) {
      uiDispatch({ type: "setModal", modal: null });
    }
    if (isEditorMode(uiState.mode)) {
      setTimeSuggestion(null);
      dispatch({ type: "setEditor", editor: null });
      uiDispatch({ type: "setEditorScrollOffset", scrollOffset: 0 });
    }
    uiDispatch({ type: "setMode", mode: Mode.SEARCH });
    uiDispatch({ type: "setFocus", focus: FocusTarget.SEARCH_INPUT });
  }

  function openTagFilterPanel() {
    if (uiState.mode !== Mode.LIST && uiState.mode !== Mode.DASHBOARD) return;
    clearPendingGPrefix();
    closeViewsOverlay();
    const seedFilter = resolveEffectiveTagFilter(state.filters);
    setTagFilterDraft(normalizeTagFilter(seedFilter));
    setTagFilterInputValue("");
    setActiveTagFilterBucket("all");
    uiDispatch({
      type: "captureReturnContext",
      mode: uiState.mode,
      focus: uiState.focus
    });
    uiDispatch({ type: "setMode", mode: Mode.TAG_FILTER });
    uiDispatch({ type: "setFocus", focus: FocusTarget.TAG_FILTER_INPUT });
  }

  function closeTagFilterPanel() {
    setTagFilterInputValue("");
    setTagFilterDraft(undefined);
    setActiveTagFilterBucket("all");
    applyEscUnwind();
  }

  function clearTagFilterPanelDraft() {
    setTagFilterInputValue("");
    setTagFilterDraft(undefined);
  }

  function setTagFilterInputValue(value: string) {
    tagFilterInputRef.current = value;
    setTagFilterInput(value);
  }

  function setTagFilterBucketAndFocusInput(bucket: TagFilterBucket) {
    setActiveTagFilterBucket(bucket);
    uiDispatch({ type: "setFocus", focus: FocusTarget.TAG_FILTER_INPUT });
  }

  function cycleTagFilterBucket(step: 1 | -1 = 1) {
    setActiveTagFilterBucket((current) => {
      const index = TAG_FILTER_BUCKET_ORDER.indexOf(current);
      const safeIndex = index >= 0 ? index : 0;
      return TAG_FILTER_BUCKET_ORDER[
        (safeIndex + step + TAG_FILTER_BUCKET_ORDER.length) % TAG_FILTER_BUCKET_ORDER.length
      ];
    });
    uiDispatch({ type: "setFocus", focus: FocusTarget.TAG_FILTER_INPUT });
  }

  function applyTagFilterPanel(includeInputCandidate = false) {
    const nextTagFilter = normalizeTagFilter(
      resolveTagFilterDraftForApplyFromInput({
        draft: tagFilterDraft,
        includeInputCandidate,
        inputValue: tagFilterInputRef.current,
        inlineSuggestion: tagFilterInlineSuggestion,
        bucket: activeTagFilterBucket
      })
    );
    if (nextTagFilter) {
      setTagFilter(nextTagFilter);
      showShortNavigationBanner(
        `Boolean tags: ${formatTagFilterBooleanSummary(nextTagFilter)}`
      );
    } else {
      clearTagFilters();
      showShortNavigationBanner("Tag filter cleared");
    }
    setTagFilterInputValue("");
    setTagFilterDraft(undefined);
    setActiveTagFilterBucket("all");
    applyEscUnwind();
  }

  function addTagFilterDraftCandidateFromInput(candidateOverride?: string): boolean {
    const candidate =
      candidateOverride ??
      resolveTagFilterInputCandidateValue(
        tagFilterInputRef.current,
        tagFilterInlineSuggestion
      );
    const normalizedCandidate = normalizeTagToken(candidate);
    if (!normalizedCandidate) return false;

    setTagFilterDraft((current) =>
      addTagToTagFilterDraftBucket(current, normalizedCandidate, activeTagFilterBucket)
    );
    setTagFilterInputValue("");
    return true;
  }

  function handleTagFilterPanelInputKeyDown(key: KeyEvent) {
    const action = resolveTagFilterPanelHotkeyAction({
      key,
      hasInlineSuggestion: Boolean(tagFilterInlineSuggestion),
      inputValue: tagFilterInputRef.current
    });
    if (!action) return;

    key.preventDefault();
    key.stopPropagation();

    switch (action.type) {
      case "cycleBucket":
        cycleTagFilterBucket(action.step);
        return;
      case "setBucket":
        setTagFilterBucketAndFocusInput(action.bucket);
        return;
      case "clearDraft":
        clearTagFilterPanelDraft();
        return;
      case "closePanel":
        closeTagFilterPanel();
        return;
      case "applyWithInputCandidate":
        applyTagFilterPanel(true);
        return;
      case "acceptInlineSuggestion":
        if (tagFilterInlineSuggestion) {
          setTagFilterInputValue(formatTagForDisplay(tagFilterInlineSuggestion.full));
        }
        return;
      case "removeLastDraftTag":
        setTagFilterDraft((current) =>
          removeLastTagFromTagFilter(current, activeTagFilterBucket)
        );
        return;
      case "addInputCandidate":
        addTagFilterDraftCandidateFromInput();
        return;
    }
  }

  function handleLeftRailMenuSelect(item: LeftRailMenuItem) {
    if (isEditorMode(uiState.mode)) {
      const continuation = resolveTaskEditorContinuationForLeftRail(item);
      if (continuation && requestTaskEditorUnsavedGuard(continuation)) {
        return;
      }
    }
    switch (item) {
      case "LIST":
        openListMode();
        return;
      case "DASHBOARD":
        openDashboardMode();
        return;
      case "BACKUP":
        openBackupCenter();
        return;
      case "ADD":
        openAdd();
        return;
      case "EDIT":
        openEdit();
        return;
      case "SEARCH":
        openSearchMode();
        return;
      case "TAG_PANEL":
        if (isEditorMode(uiState.mode)) {
          openListMode({ bypassUnsavedGuard: true });
        }
        openTagFilterPanel();
        return;
      case "HELP":
        if (uiState.mode === Mode.HELP) return;
        openHelp();
        return;
      case "DELETE":
        openDeleteConfirm();
        return;
      default:
        return;
    }
  }

  function closeSearch() {
    clearPendingGPrefix();
    uiDispatch({ type: "setMode", mode: Mode.LIST });
    uiDispatch({ type: "setFocus", focus: FocusTarget.TASK_LIST });
  }

  function openDeleteConfirm() {
    if (!selectedTask) return;
    let modal: UIDeleteModal | null = null;
    if (
      selectedTask.rowKind === "series_occurrence_virtual" ||
      selectedTask.rowKind === "series_occurrence_instance"
    ) {
      const occurrenceContext = resolveSelectedOccurrenceContext();
      if (!occurrenceContext) return;
      modal = {
        type: "delete",
        target: "recurring_occurrence",
        seriesTaskId: occurrenceContext.seriesTask.id,
        seriesId: occurrenceContext.seriesId,
        occurrenceIso: occurrenceContext.occurrenceIso,
        selectedRowId: occurrenceContext.row.id,
        taskTitle: occurrenceContext.seriesTask.title,
        previousMode: Mode.LIST,
        previousFocus: uiState.focus
      };
    } else {
      const persistedTask = resolvePersistedTaskForRow(selectedTask);
      if (!persistedTask) return;
      modal = {
        type: "delete",
        target: "regular_task",
        taskId: persistedTask.id,
        taskTitle: persistedTask.title,
        previousMode: Mode.LIST,
        previousFocus: uiState.focus
      };
    }

    closeViewsOverlay();
    uiDispatch({
      type: "setModal",
      modal
    });
    uiDispatch({ type: "setMode", mode: Mode.MODAL_CONFIRM });
    uiDispatch({ type: "setFocus", focus: FocusTarget.MODAL });
  }

  function openModalWithContext(modal: NonNullable<typeof uiState.modal>) {
    closeViewsOverlay();
    uiDispatch({ type: "setModal", modal });
    uiDispatch({ type: "setMode", mode: Mode.MODAL_CONFIRM });
    uiDispatch({ type: "setFocus", focus: FocusTarget.MODAL });
  }

  function closeModalWithPreviousContext(modal: {
    previousMode: Mode;
    previousFocus: FocusTarget;
  }) {
    uiDispatch({ type: "setModal", modal: null });
    uiDispatch({ type: "setMode", mode: modal.previousMode });
    uiDispatch({ type: "setFocus", focus: modal.previousFocus });
  }

  function applyTaskLinkMutation(
    taskId: string,
    mutate: (task: Task) => Task
  ): Task | undefined {
    const nowMs = Date.now();
    let updatedTask: Task | undefined;
    const nextTasks = state.tasks.map((task) => {
      if (task.id !== taskId) return task;
      updatedTask = {
        ...mutate(task),
        updatedAt: nowMs
      };
      return updatedTask;
    });
    if (!updatedTask) return undefined;
    dispatch({ type: "setTasks", tasks: nextTasks });
    return updatedTask;
  }

  function moveLinkSelection(delta: 1 | -1) {
    if (selectedTaskLinks.length === 0) return;
    const currentIndex = selectedTaskLinks.findIndex((link) => link.id === selectedLinkId);
    const safeIndex = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex = (safeIndex + delta + selectedTaskLinks.length) % selectedTaskLinks.length;
    setSelectedLinkId(selectedTaskLinks[nextIndex]?.id);
  }

  function findVisibleRowById(rowId: string | undefined): VisibleTaskRow | undefined {
    if (!rowId) return undefined;
    if (selectedTask?.id === rowId) return selectedTask;
    return visibleTaskRows.find((row) => row.id === rowId);
  }

  function mutateChecklistForRow(
    rowId: string,
    mutate: (checklist: Task["checklist"]) => { ok: true; checklist: NonNullable<Task["checklist"]> } | { ok: false; error: string }
  ): { ok: true; checklist: NonNullable<Task["checklist"]>; selectedTaskId: string } | { ok: false; error: string } {
    const row = findVisibleRowById(rowId);
    if (!row) {
      return { ok: false, error: "Checklist target is not visible." };
    }

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    if (row.rowKind === "series_occurrence_virtual") {
      const context = resolveOccurrenceContextForRow(row);
      if (!context) {
        return { ok: false, error: "Unable to resolve recurring occurrence." };
      }

      const source = context.instanceTask ?? context.seriesTask;
      const mutation = mutate(source.checklist);
      if (!mutation.ok) {
        return { ok: false, error: mutation.error };
      }
      const materialized = materializeChecklistOccurrenceOverride({
        tasks: state.tasks,
        context: {
          seriesTask: context.seriesTask,
          seriesId: context.seriesId,
          occurrenceIso: context.occurrenceIso,
          instanceTask: context.instanceTask
        },
        checklist: mutation.checklist,
        nowMs
      });
      if (!materialized.ok) {
        return { ok: false, error: materialized.error };
      }
      dispatch({ type: "setTasks", tasks: materialized.tasks });
      dispatch({ type: "setSelected", id: materialized.instance.id });
      return {
        ok: true,
        checklist: mutation.checklist,
        selectedTaskId: materialized.instance.id
      };
    }

    const persisted = resolvePersistedTaskForRow(row);
    if (!persisted) {
      return { ok: false, error: "Checklist target could not be resolved." };
    }
    const mutation = mutate(persisted.checklist);
    if (!mutation.ok) {
      return { ok: false, error: mutation.error };
    }
    const updatedTask: Task = {
      ...persisted,
      checklist: mutation.checklist,
      updatedAt: nowMs
    };
    dispatch({
      type: "setTasks",
      tasks: state.tasks.map((task) => (task.id === updatedTask.id ? updatedTask : task))
    });
    dispatch({ type: "setSelected", id: updatedTask.id });
    return {
      ok: true,
      checklist: mutation.checklist,
      selectedTaskId: updatedTask.id
    };
  }

  function moveChecklistSelection(delta: 1 | -1) {
    if (isEditorMode(uiState.mode) && uiState.focus === FocusTarget.EDITOR_CHECKLIST) {
      if (editorChecklistItems.length === 0) return;
      const currentIndex = editorChecklistItems.findIndex(
        (item) => item.id === selectedEditorChecklistItemId
      );
      const safeIndex = currentIndex === -1 ? 0 : currentIndex;
      const nextIndex =
        (safeIndex + delta + editorChecklistItems.length) % editorChecklistItems.length;
      setSelectedEditorChecklistItemId(editorChecklistItems[nextIndex]?.id);
      return;
    }

    if (selectedChecklistItems.length === 0) return;
    const currentIndex = selectedChecklistItems.findIndex(
      (item) => item.id === selectedChecklistItemId
    );
    const safeIndex = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex =
      (safeIndex + delta + selectedChecklistItems.length) % selectedChecklistItems.length;
    setSelectedChecklistItemId(selectedChecklistItems[nextIndex]?.id);
  }

  function toggleSelectedChecklistItem() {
    if (isEditorMode(uiState.mode) && uiState.focus === FocusTarget.EDITOR_CHECKLIST) {
      if (!state.editor) {
        showShortNavigationBanner("Editor draft unavailable");
        return;
      }
      const checklistItem = selectedEditorChecklistItem ?? editorChecklistItems[0];
      if (!checklistItem) {
        showShortNavigationBanner("No checklist item selected");
        return;
      }
      const nowIso = new Date().toISOString();
      const outcome = toggleChecklistItem(state.editor.checklist, checklistItem.id, nowIso);
      if (!outcome.ok) {
        showShortNavigationBanner(outcome.error);
        return;
      }
      updateEditorDraft({ checklist: outcome.checklist });
      setSelectedEditorChecklistItemId(checklistItem.id);
      return;
    }

    if (!selectedTask) {
      showShortNavigationBanner("No task selected");
      return;
    }
    const checklistItem = selectedChecklistItem ?? selectedChecklistItems[0];
    if (!checklistItem) {
      showShortNavigationBanner("No checklist item selected");
      return;
    }
    const nowIso = new Date().toISOString();
    const outcome = mutateChecklistForRow(selectedTask.id, (checklist) =>
      toggleChecklistItem(checklist, checklistItem.id, nowIso)
    );
    if (!outcome.ok) {
      showShortNavigationBanner(outcome.error);
      return;
    }
    setSelectedChecklistItemId(checklistItem.id);
  }

  function openAddChecklistItemModal() {
    if (isEditorMode(uiState.mode) && uiState.focus === FocusTarget.EDITOR_CHECKLIST) {
      const taskTitle = state.editor?.title?.trim() || (uiState.mode === Mode.ADD ? "New task" : "Task");
      openModalWithContext({
        type: "checklist_input",
        mode: "add",
        rowId: EDITOR_CHECKLIST_MODAL_ROW_ID,
        taskTitle,
        value: "",
        previousMode: uiState.mode,
        previousFocus: uiState.focus
      });
      return;
    }

    if (uiState.mode !== Mode.LIST || !selectedTask) {
      showShortNavigationBanner("No task selected");
      return;
    }
    openModalWithContext({
      type: "checklist_input",
      mode: "add",
      rowId: selectedTask.id,
      taskTitle: selectedTask.title,
      value: "",
      previousMode: Mode.LIST,
      previousFocus: uiState.focus
    });
  }

  function openEditChecklistItemModal() {
    if (isEditorMode(uiState.mode) && uiState.focus === FocusTarget.EDITOR_CHECKLIST) {
      if (!state.editor) {
        showShortNavigationBanner("Editor draft unavailable");
        return;
      }
      const checklistItem = selectedEditorChecklistItem ?? editorChecklistItems[0];
      if (!checklistItem) {
        showShortNavigationBanner("No checklist item selected");
        return;
      }
      const taskTitle = state.editor.title.trim() || (uiState.mode === Mode.ADD ? "New task" : "Task");
      openModalWithContext({
        type: "checklist_input",
        mode: "edit",
        rowId: EDITOR_CHECKLIST_MODAL_ROW_ID,
        itemId: checklistItem.id,
        taskTitle,
        value: checklistItem.text,
        previousMode: uiState.mode,
        previousFocus: uiState.focus
      });
      return;
    }

    if (uiState.mode !== Mode.LIST || !selectedTask) {
      showShortNavigationBanner("No task selected");
      return;
    }
    const checklistItem = selectedChecklistItem ?? selectedChecklistItems[0];
    if (!checklistItem) {
      showShortNavigationBanner("No checklist item selected");
      return;
    }
    openModalWithContext({
      type: "checklist_input",
      mode: "edit",
      rowId: selectedTask.id,
      itemId: checklistItem.id,
      taskTitle: selectedTask.title,
      value: checklistItem.text,
      previousMode: Mode.LIST,
      previousFocus: uiState.focus
    });
  }

  function openDeleteChecklistItemModal() {
    if (isEditorMode(uiState.mode) && uiState.focus === FocusTarget.EDITOR_CHECKLIST) {
      if (!state.editor) {
        showShortNavigationBanner("Editor draft unavailable");
        return;
      }
      const checklistItem = selectedEditorChecklistItem ?? editorChecklistItems[0];
      if (!checklistItem) {
        showShortNavigationBanner("No checklist item selected");
        return;
      }
      const taskTitle = state.editor.title.trim() || (uiState.mode === Mode.ADD ? "New task" : "Task");
      openModalWithContext({
        type: "checklist_delete",
        rowId: EDITOR_CHECKLIST_MODAL_ROW_ID,
        itemId: checklistItem.id,
        itemText: checklistItem.text,
        taskTitle,
        previousMode: uiState.mode,
        previousFocus: uiState.focus
      });
      return;
    }

    if (uiState.mode !== Mode.LIST || !selectedTask) {
      showShortNavigationBanner("No task selected");
      return;
    }
    const checklistItem = selectedChecklistItem ?? selectedChecklistItems[0];
    if (!checklistItem) {
      showShortNavigationBanner("No checklist item selected");
      return;
    }
    openModalWithContext({
      type: "checklist_delete",
      rowId: selectedTask.id,
      itemId: checklistItem.id,
      itemText: checklistItem.text,
      taskTitle: selectedTask.title,
      previousMode: Mode.LIST,
      previousFocus: uiState.focus
    });
  }

  function getChecklistInputModal() {
    return uiState.modal?.type === "checklist_input" ? uiState.modal : null;
  }

  function patchChecklistInputModal(patch: { value?: string; error?: string }) {
    const modal = getChecklistInputModal();
    if (!modal) return;
    uiDispatch({
      type: "setModal",
      modal: {
        ...modal,
        ...patch
      }
    });
  }

  function submitChecklistInputModal() {
    const modal = getChecklistInputModal();
    if (!modal) return;
    const nowIso = new Date().toISOString();

    if (modal.rowId === EDITOR_CHECKLIST_MODAL_ROW_ID) {
      if (!state.editor) {
        patchChecklistInputModal({ error: "Editor draft unavailable." });
        return;
      }
      if (modal.mode === "add") {
        const outcome = addChecklistItem(state.editor.checklist, modal.value, nowIso);
        if (!outcome.ok) {
          patchChecklistInputModal({ error: outcome.error });
          return;
        }
        updateEditorDraft({ checklist: outcome.checklist });
        const nextItems = sortChecklistItems(outcome.checklist);
        setSelectedEditorChecklistItemId(nextItems[nextItems.length - 1]?.id);
        closeModalWithPreviousContext(modal);
        return;
      }

      if (!modal.itemId) {
        patchChecklistInputModal({ error: "Checklist item not found." });
        return;
      }

      const outcome = editChecklistItem(state.editor.checklist, modal.itemId, modal.value, nowIso);
      if (!outcome.ok) {
        patchChecklistInputModal({ error: outcome.error });
        return;
      }
      updateEditorDraft({ checklist: outcome.checklist });
      setSelectedEditorChecklistItemId(modal.itemId);
      closeModalWithPreviousContext(modal);
      return;
    }

    if (modal.mode === "add") {
      const outcome = mutateChecklistForRow(modal.rowId, (checklist) =>
        addChecklistItem(checklist, modal.value, nowIso)
      );
      if (!outcome.ok) {
        patchChecklistInputModal({ error: outcome.error });
        return;
      }
      const nextItems = sortChecklistItems(outcome.checklist);
      setSelectedChecklistItemId(nextItems[nextItems.length - 1]?.id);
      closeModalWithPreviousContext(modal);
      return;
    }

    if (!modal.itemId) {
      patchChecklistInputModal({ error: "Checklist item not found." });
      return;
    }

    const outcome = mutateChecklistForRow(modal.rowId, (checklist) =>
      editChecklistItem(checklist, modal.itemId as string, modal.value, nowIso)
    );
    if (!outcome.ok) {
      patchChecklistInputModal({ error: outcome.error });
      return;
    }
    setSelectedChecklistItemId(modal.itemId);
    closeModalWithPreviousContext(modal);
  }

  function handleDeleteChecklistItemFromModal() {
    const modal = uiState.modal;
    if (!modal || modal.type !== "checklist_delete") return;

    if (modal.rowId === EDITOR_CHECKLIST_MODAL_ROW_ID) {
      if (!state.editor) {
        showShortNavigationBanner("Editor draft unavailable");
        closeModalWithPreviousContext(modal);
        return;
      }
      const outcome = deleteChecklistItem(state.editor.checklist, modal.itemId);
      if (!outcome.ok) {
        showShortNavigationBanner(outcome.error);
        closeModalWithPreviousContext(modal);
        return;
      }
      updateEditorDraft({ checklist: outcome.checklist });
      const nextItems = sortChecklistItems(outcome.checklist);
      setSelectedEditorChecklistItemId(nextItems[0]?.id);
      closeModalWithPreviousContext(modal);
      return;
    }

    const outcome = mutateChecklistForRow(modal.rowId, (checklist) =>
      deleteChecklistItem(checklist, modal.itemId)
    );
    if (!outcome.ok) {
      showShortNavigationBanner(outcome.error);
      closeModalWithPreviousContext(modal);
      return;
    }
    const nextItems = sortChecklistItems(outcome.checklist);
    setSelectedChecklistItemId(nextItems[0]?.id);
    closeModalWithPreviousContext(modal);
  }

  function clearBulkMarks() {
    if (!bulkActive) return;
    setBulkMarkedTaskIds([]);
  }

  function toggleBulkMark() {
    if (uiState.mode !== Mode.LIST || uiState.focus !== FocusTarget.TASK_LIST || !selectedTask) {
      return;
    }
    if (selectedTask.rowKind === "series_occurrence_virtual") {
      showShortNavigationBanner("Bulk selection does not support virtual occurrences (yet).");
      return;
    }
    setBulkMarkedTaskIds((previous) => {
      if (previous.includes(selectedTask.id)) {
        return previous.filter((id) => id !== selectedTask.id);
      }
      return [...previous, selectedTask.id];
    });
  }

  function handleConfirmBulkDeleteFromModal() {
    const modal = uiState.modal;
    if (!modal || modal.type !== "bulk_delete") return;

    const nowMs = Date.now();
    const visibleTasks = getVisibleTasks(state, nowMs);
    const result = executeCommand(
      {
        type: "bulk",
        operation: "delete",
        target: {
          type: "ids",
          ids: modal.taskIds
        }
      },
      {
        now: nowMs,
        state,
        visibleTasks,
        selectedTaskId: state.selectedId ?? visibleTasks[0]?.id,
        bulkMarkedTaskIds
      }
    );

    if (result.output.kind === "error") {
      showShortNavigationBanner(result.output.text);
      closeModalWithPreviousContext(modal);
      return;
    }

    for (const action of result.actions) {
      dispatch(action);
    }
    setBulkMarkedTaskIds((previous) =>
      previous.filter((id) => !modal.taskIds.includes(id))
    );
    setCommandOutput(result.output);
    closeModalWithPreviousContext(modal);
  }

  function openAddTaskLinkModal() {
    if (uiState.mode === Mode.ADD) {
      if (!state.editor) {
        showShortNavigationBanner("No task draft open");
        return;
      }
      openModalWithContext({
        type: "task_link_form",
        mode: "add",
        source: {
          scope: "editor_draft"
        },
        labelValue: "",
        targetValue: "",
        kindValue: "auto",
        activeField: "target",
        previousMode: uiState.mode,
        previousFocus: uiState.focus
      });
      return;
    }

    if (!selectedPersistedTask) {
      showShortNavigationBanner("No task selected");
      return;
    }
    openModalWithContext({
      type: "task_link_form",
      mode: "add",
      source: {
        scope: "task",
        taskId: selectedPersistedTask.id
      },
      labelValue: "",
      targetValue: "",
      kindValue: "auto",
      activeField: "target",
      previousMode: Mode.LIST,
      previousFocus: uiState.focus
    });
  }

  function openEditTaskLinkModal() {
    if (!selectedPersistedTask || !selectedTaskLink) {
      showShortNavigationBanner("No link selected");
      return;
    }
    openModalWithContext({
      type: "task_link_form",
      mode: "edit",
      source: {
        scope: "task",
        taskId: selectedPersistedTask.id
      },
      linkId: selectedTaskLink.id,
      labelValue: selectedTaskLink.label ?? "",
      targetValue: selectedTaskLink.target,
      kindValue: selectedTaskLink.kind ?? "auto",
      activeField: "target",
      previousMode: Mode.LIST,
      previousFocus: uiState.focus
    });
  }

  function openDeleteTaskLinkModal() {
    if (!selectedPersistedTask || !selectedTaskLink) {
      showShortNavigationBanner("No link selected");
      return;
    }
    openModalWithContext({
      type: "task_link_delete",
      taskId: selectedPersistedTask.id,
      linkId: selectedTaskLink.id,
      label: selectedTaskLink.label,
      target: selectedTaskLink.target,
      previousMode: Mode.LIST,
      previousFocus: uiState.focus
    });
  }

  async function openTaskLinkTarget(target: string): Promise<void> {
    try {
      await openTarget(target);
    } catch {
      showShortNavigationBanner("Could not open link.");
    }
  }

  function openTaskLink(
    link: TaskLink,
    sourceTask: Task,
    previousFocus: FocusTarget = uiState.focus
  ) {
    const openDecision = decideTaskLinkOpen(link, {
      nonHttpLinkPolicy: settingsState.security.nonHttpLinkPolicy
    });
    if (openDecision.policy === "block") {
      showShortNavigationBanner("Blocked by security policy.");
      return;
    }
    if (openDecision.policy === "confirm") {
      openModalWithContext({
        type: "task_link_open_external",
        taskId: sourceTask.id,
        linkId: link.id,
        target: openDecision.target,
        scheme: openDecision.scheme,
        previousMode: Mode.LIST,
        previousFocus
      });
      return;
    }
    void openTaskLinkTarget(openDecision.target);
  }

  function selectDetailsLink(linkId: string) {
    if (uiState.mode !== Mode.LIST) return;
    if (!selectedTaskLinks.some((link) => link.id === linkId)) return;
    setSelectedLinkId(linkId);
    uiDispatch({ type: "setFocus", focus: FocusTarget.DETAILS_LINKS });
  }

  function openDetailsLink(linkId: string) {
    if (uiState.mode !== Mode.LIST || !selectedPersistedTask) return;
    const link = selectedTaskLinks.find((candidate) => candidate.id === linkId);
    if (!link) return;
    setSelectedLinkId(link.id);
    uiDispatch({ type: "setFocus", focus: FocusTarget.DETAILS_LINKS });
    openTaskLink(link, selectedPersistedTask, FocusTarget.DETAILS_LINKS);
  }

  function openSelectedTaskLink() {
    if (!selectedTaskLink || !selectedPersistedTask) {
      showShortNavigationBanner("No link selected");
      return;
    }
    openTaskLink(selectedTaskLink, selectedPersistedTask);
  }

  function copySelectedTaskLink() {
    if (!selectedTaskLink) {
      showShortNavigationBanner("No link selected");
      return;
    }
    void copyToClipboard(selectedTaskLink.target).catch(() => {
      showShortNavigationBanner("Copy failed.");
    });
  }

  function getTaskLinkFormModal(): UITaskLinkFormModal | null {
    return uiState.modal?.type === "task_link_form" ? uiState.modal : null;
  }

  function patchTaskLinkFormModal(patch: Partial<UITaskLinkFormModal>) {
    const modal = getTaskLinkFormModal();
    if (!modal) return;
    uiDispatch({
      type: "setModal",
      modal: {
        ...modal,
        ...patch
      }
    });
  }

  function moveTaskLinkFormFocus(direction: 1 | -1) {
    const modal = getTaskLinkFormModal();
    if (!modal) return;
    patchTaskLinkFormModal({
      activeField: cycleTaskLinkFormField(modal.activeField, direction)
    });
  }

  function cycleTaskLinkFormType(direction: 1 | -1) {
    const modal = getTaskLinkFormModal();
    if (!modal) return;
    patchTaskLinkFormModal({
      kindValue: cycleTaskLinkFormKind(modal.kindValue, direction)
    });
  }

  function submitTaskLinkFormModal() {
    const modal = getTaskLinkFormModal();
    if (!modal) return;

    const target = modal.targetValue.trim();
    const label = modal.labelValue.trim();
    if (!target) {
      patchTaskLinkFormModal({ error: "Target is required." });
      return;
    }

    if (modal.kindValue === "url" && !extractUrlScheme(target)) {
      patchTaskLinkFormModal({ error: "URL type requires a scheme (e.g. https://)." });
      return;
    }

    const kind = modal.kindValue === "auto" ? undefined : modal.kindValue;

    if (modal.source.scope === "editor_draft") {
      if (!state.editor) return;
      if (modal.mode !== "add") return;
      const link: TaskLink = {
        id: crypto.randomUUID(),
        target,
        ...(label ? { label } : {}),
        ...(kind ? { kind } : {}),
        source: "manual"
      };
      dispatch({
        type: "updateEditor",
        patch: {
          links: [...state.editor.links, link]
        }
      });
      showShortNavigationBanner(`Added link (${state.editor.links.length + 1})`);
      closeModalWithPreviousContext(modal);
      return;
    }

    if (modal.mode === "add") {
      const link: TaskLink = {
        id: crypto.randomUUID(),
        target,
        ...(label ? { label } : {}),
        ...(kind ? { kind } : {}),
        source: "manual"
      };
      const updatedTask = applyTaskLinkMutation(modal.source.taskId, (task) =>
        addTaskLink(task, link)
      );
      if (!updatedTask) return;
      setSelectedLinkId(link.id);
      closeModalWithPreviousContext(modal);
      return;
    }

    if (!modal.linkId) return;
    const updatedTask = applyTaskLinkMutation(modal.source.taskId, (task) =>
      updateTaskLink(task, modal.linkId, {
        target,
        label: label || undefined,
        kind
      })
    );
    if (!updatedTask) return;
    setSelectedLinkId(modal.linkId);
    closeModalWithPreviousContext(modal);
  }

  function handleDeleteTaskLinkFromModal() {
    const modal = uiState.modal;
    if (!modal || modal.type !== "task_link_delete") return;
    const updatedTask = applyTaskLinkMutation(modal.taskId, (task) =>
      deleteTaskLink(task, modal.linkId)
    );
    if (!updatedTask) return;
    const nextLinks = updatedTask.links ?? [];
    setSelectedLinkId((current) => {
      if (current && nextLinks.some((link) => link.id === current)) {
        return current;
      }
      return nextLinks[0]?.id;
    });
    closeModalWithPreviousContext(modal);
  }

  function handleOpenExternalTaskLinkFromModal() {
    const modal = uiState.modal;
    if (!modal || modal.type !== "task_link_open_external") return;
    closeModalWithPreviousContext(modal);
    void openTaskLinkTarget(modal.target);
  }

  function moveSelection(delta: number) {
    if (visibleTaskRows.length === 0) return;
    const currentIndex = visibleTaskRows.findIndex((task) => task.id === state.selectedId);
    const safeIndex = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex = (safeIndex + delta + visibleTaskRows.length) % visibleTaskRows.length;
    dispatch({ type: "setSelected", id: visibleTaskRows[nextIndex].id });
  }

  function setSelectedByIndex(index: number) {
    if (visibleTaskRows.length === 0) return;
    const nextIndex = Math.max(0, Math.min(index, visibleTaskRows.length - 1));
    dispatch({ type: "setSelected", id: visibleTaskRows[nextIndex].id });
  }

  function moveSelectionClamped(delta: number) {
    if (visibleTaskRows.length === 0 || delta === 0) return;
    const currentIndex = visibleTaskRows.findIndex((task) => task.id === state.selectedId);
    const safeIndex = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex = resolveTaskListWheelSelectionIndex({
      currentIndex: safeIndex,
      delta: delta > 0 ? 1 : -1,
      itemCount: visibleTaskRows.length
    });
    if (nextIndex === safeIndex) return;
    setSelectedByIndex(nextIndex);
  }

  function handleTaskListWheelScroll(delta: 1 | -1) {
    if (uiState.mode !== Mode.LIST && uiState.mode !== Mode.SEARCH) return;
    moveSelectionClamped(delta);
  }

  function selectTaskById(taskId: string) {
    const targetExists = visibleTaskRows.some((task) => task.id === taskId);
    if (!targetExists) return;
    clearPendingGPrefix();
    // Optimistically mirror selection so rapid double-clicks can observe the first click.
    selectedRowIdRef.current = taskId;
    dispatch({ type: "setSelected", id: taskId });
  }

  const editorFlow = useEditorFlow({
    uiState,
    state,
    selectedTask,
    visibleTaskRows,
    now,
    selectedRowIdRef,
    editorDraftRef,
    editorDirtyIntentRef,
    editorTargetRowIdRef,
    editorBaselineDraftRef,
    dispatch,
    uiDispatch,
    setTimeSuggestion,
    closeViewsOverlay,
    clearPendingGPrefix,
    requestTaskEditorUnsavedGuard,
    resetEditorSessionTracking,
    openModalWithContext,
    closeModalWithPreviousContext,
    showShortNavigationBanner,
    resolveOccurrenceContextForRow,
    resolvePersistedTaskForRow,
    findSeriesTaskBySeriesId,
    findTaskById,
    normalizeOccurrenceIso,
    withSeriesOccurrenceExcluded,
    removeMaterializedOccurrenceInstance,
    parseTagsInput,
    triggerFirstRecurringTaskCreated,
    selectTaskById
  });

  function requestEditTargetSwitch(toTaskId: string) {
    editorFlow.requestEditTargetSwitch(toTaskId);
  }

  function handleModalSaveAndSwitchEditTarget() {
    editorFlow.handleModalSaveAndSwitchEditTarget();
  }

  function handleModalDiscardAndSwitchEditTarget() {
    editorFlow.handleModalDiscardAndSwitchEditTarget();
  }

  function handleModalDiscardAndCloseEditor() {
    editorFlow.handleModalDiscardAndCloseEditor();
  }

  function handleTaskRowClick(input: { taskId: string; wasSelected: boolean }) {
    editorFlow.handleTaskRowClick(input);
  }

  function jumpToTop() {
    setSelectedByIndex(0);
  }

  function jumpToBottom() {
    setSelectedByIndex(visibleTaskRows.length - 1);
  }

  function moveSelectionPage(direction: 1 | -1) {
    if (visibleTaskRows.length === 0) return;
    const pageStep = Math.max(1, visibleRows - 1);
    const currentIndex = visibleTaskRows.findIndex((task) => task.id === state.selectedId);
    const safeIndex = currentIndex === -1 ? 0 : currentIndex;
    setSelectedByIndex(safeIndex + direction * pageStep);
  }

  function showShortNavigationBanner(message: string) {
    setNavigationBanner(message);
    if (navBannerTimerRef.current) {
      clearTimeout(navBannerTimerRef.current);
    }
    navBannerTimerRef.current = setTimeout(() => {
      setNavigationBanner(null);
      navBannerTimerRef.current = null;
    }, NAV_BANNER_TIMEOUT_MS);
  }

  function jumpToAttention(kind: "overdue" | "today", direction: 1 | -1) {
    if (visibleTaskRows.length === 0) {
      showShortNavigationBanner(
        kind === "overdue" ? "No overdue tasks" : "No due-today tasks"
      );
      return;
    }

    const currentIndex = visibleTaskRows.findIndex((task) => task.id === state.selectedId);
    const safeIndex = currentIndex === -1 ? 0 : currentIndex;
    const matcher =
      kind === "overdue"
        ? (task: Task) => isTaskOverdue(task, now)
        : (task: Task) => isTaskDueToday(task, now);
    const nextIndex = findNextMatchingIndex(
      visibleTaskRows,
      safeIndex,
      direction,
      matcher,
      true
    );

    if (nextIndex === null) {
      showShortNavigationBanner(
        kind === "overdue" ? "No overdue tasks" : "No due-today tasks"
      );
      return;
    }

    setSelectedByIndex(nextIndex);
  }

  function clearPendingGPrefix() {
    setPendingGPrefix(false);
    if (gPrefixTimerRef.current) {
      clearTimeout(gPrefixTimerRef.current);
      gPrefixTimerRef.current = null;
    }
  }

  function armPendingGPrefixResolveTimeout() {
    if (gPrefixTimerRef.current) {
      clearTimeout(gPrefixTimerRef.current);
    }
    gPrefixTimerRef.current = setTimeout(() => {
      setPendingGPrefix(false);
      gPrefixTimerRef.current = null;
    }, G_PREFIX_RELEASE_TIMEOUT_MS);
  }

  function armPendingGPrefix() {
    armPendingGPrefixResolveTimeout();
    setPendingGPrefix(true);
  }

  function closeViewsOverlay() {
    setViewsOverlayOpen(false);
    setSaveViewPromptOpen(false);
    setSaveViewName("");
  }

  function toggleViewsOverlay() {
    clearPendingGPrefix();
    if (viewsOverlayOpen) {
      closeViewsOverlay();
      return;
    }
    setViewsOverlayOpen(true);
    setSaveViewPromptOpen(false);
    setSelectedViewIndex((prev) =>
      state.savedViews.length === 0
        ? 0
        : Math.max(0, Math.min(prev, state.savedViews.length - 1))
    );
  }

  function moveViewSelection(delta: 1 | -1) {
    if (state.savedViews.length === 0) return;
    setSelectedViewIndex((prev) => {
      const next = (prev + delta + state.savedViews.length) % state.savedViews.length;
      return next;
    });
  }

  function applyView(view: SavedView) {
    const nextFilters = applySavedView(view);
    dispatch({
      type: "setFilters",
      filters: {
        status: nextFilters.status,
        due: nextFilters.due,
        analyticsWindow: nextFilters.analyticsWindow,
        dueDayOffset: nextFilters.dueDayOffset,
        priority: nextFilters.priority,
        tag: nextFilters.tag,
        tagFilter: nextFilters.tagFilter,
        searchText: nextFilters.searchText,
        assignee: nextFilters.assignee,
        project: nextFilters.project,
        workflowStage: nextFilters.workflowStage
      }
    });
    closeViewsOverlay();
    showShortNavigationBanner(`Applied view: ${view.name}`);
  }

  function applyViewAtSlot(slot: number) {
    if (slot < 0 || slot >= state.savedViews.length) {
      showShortNavigationBanner(`No saved view in slot ${slot + 1}`);
      return;
    }
    const view = state.savedViews[slot];
    if (isSavedViewActive(state.filters, view)) {
      dispatch({
        type: "setFilters",
        filters: {
          ...DEFAULT_VIEW_FILTERS,
          analyticsWindow: "7d",
          dueDayOffset: undefined,
          priority: undefined,
          tag: undefined,
          tagFilter: undefined,
          searchText: undefined,
          assignee: undefined,
          project: undefined,
          workflowStage: undefined
        }
      });
      closeViewsOverlay();
      showShortNavigationBanner("Default view");
      return;
    }
    applyView(view);
  }

  function applySelectedView() {
    if (state.savedViews.length === 0) {
      showShortNavigationBanner("No saved views");
      return;
    }
    const index = Math.max(0, Math.min(selectedViewIndex, state.savedViews.length - 1));
    applyView(state.savedViews[index]);
  }

  function deleteSelectedView() {
    if (state.savedViews.length === 0) {
      showShortNavigationBanner("No saved views to delete");
      return;
    }
    const index = Math.max(0, Math.min(selectedViewIndex, state.savedViews.length - 1));
    const target = state.savedViews[index];
    const next = deleteViewAtIndex(state.savedViews, index);
    dispatch({ type: "setSavedViews", savedViews: next });
    setSelectedViewIndex(Math.max(0, Math.min(index, next.length - 1)));
    showShortNavigationBanner(`Deleted view: ${target.name}`);
  }

  function openSaveViewPrompt() {
    clearPendingGPrefix();
    setViewsOverlayOpen(true);
    setSaveViewPromptOpen(true);
    setSaveViewName("");
  }

  function cancelSaveViewPrompt() {
    setSaveViewPromptOpen(false);
    setSaveViewName("");
  }

  function confirmSaveViewPrompt() {
    const nowMs = Date.now();
    const result = saveViewByName(
      state.savedViews,
      saveViewName,
      state.filters,
      nowMs,
      MAX_SAVED_VIEWS
    );

    if (result.kind === "invalid_name") {
      showShortNavigationBanner("View name is required");
      return;
    }
    if (result.kind === "full") {
      showShortNavigationBanner(`Saved view limit reached (${MAX_SAVED_VIEWS})`);
      return;
    }

    dispatch({ type: "setSavedViews", savedViews: result.savedViews });
    const idx = result.savedViews.findIndex((view) => view.id === result.view.id);
    setSelectedViewIndex(idx >= 0 ? idx : 0);
    setSaveViewPromptOpen(false);
    setSaveViewName("");
    showShortNavigationBanner(
      result.kind === "created"
        ? `Saved view: ${result.view.name}`
        : `Updated view: ${result.view.name}`
    );
  }

  function normalizeOccurrenceIso(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const occurrenceDate = parseLocalIsoToDate(value);
    if (!occurrenceDate) return undefined;
    return formatDateToLocalIso(occurrenceDate);
  }

  function withSeriesOccurrenceExcluded(
    tasks: Task[],
    seriesTaskId: string,
    occurrenceIso: string,
    nowMs: number
  ): Task[] {
    return tasks.map((task) => {
      if (task.id !== seriesTaskId || !task.recurrence) {
        return task;
      }
      const nextExdates = Array.from(
        new Set([...(task.recurrence.exdates ?? []), occurrenceIso])
      ).sort((left, right) => left.localeCompare(right));
      return {
        ...task,
        updatedAt: nowMs,
        recurrence: {
          ...task.recurrence,
          exdates: nextExdates
        }
      };
    });
  }

  function removeMaterializedOccurrenceInstance(
    tasks: Task[],
    seriesId: string,
    occurrenceIso: string
  ): Task[] {
    return tasks.filter(
      (task) =>
        !(
          task.instance_of?.series_id === seriesId &&
          task.instance_of?.occurrence === occurrenceIso
        )
    );
  }

  function resolveOccurrenceContextForRow(row: VisibleTaskRow | undefined): {
    row: VisibleTaskRow;
    seriesTask: Task;
    seriesId: string;
    occurrenceIso: string;
    instanceTask?: Task;
  } | null {
    if (!row) return null;
    if (
      row.rowKind !== "series_occurrence_virtual" &&
      row.rowKind !== "series_occurrence_instance"
    ) {
      return null;
    }

    const normalizedIso = normalizeOccurrenceIso(row.occurrenceIso);
    const seriesId = row.seriesId;
    const seriesTask = findSeriesTaskBySeriesId(seriesId);

    if (!normalizedIso || !seriesId || !seriesTask) {
      return null;
    }

    const instanceTask =
      row.rowKind === "series_occurrence_instance"
        ? findTaskById(row.id)
        : findMaterializedInstance(seriesId, normalizedIso);

    return {
      row,
      seriesTask,
      seriesId,
      occurrenceIso: normalizedIso,
      instanceTask
    };
  }

  function resolveSelectedOccurrenceContext(): {
    row: VisibleTaskRow;
    seriesTask: Task;
    seriesId: string;
    occurrenceIso: string;
    instanceTask?: Task;
  } | null {
    return resolveOccurrenceContextForRow(selectedTask);
  }

  /*
   * Engagement QA checklist:
   * - open -> done records exactly one completion event
   * - done -> open records no completion event
   * - recurring completion paths emit once per completed occurrence
   * - blocked overlays suppress active toast rendering; queue resumes after close
   */
  function triggerFirstRecurringTaskCreated(at: number, seriesId: string) {
    dispatch({
      type: "triggerEngagementMilestone",
      achievementKey: "FIRST_RECURRING_TASK_CREATED",
      achievementId: "FIRST_RECURRING_TASK_CREATED",
      at,
      meta: { seriesId },
      toast: {
        message: "Created your first recurring task.",
        priority: 3,
        durationMs: FIRST_RECURRING_TASK_TOAST_MS
      }
    });
  }

  function triggerFirstRecurringRepeatDone(at: number, seriesId: string, occurrenceIso: string) {
    dispatch({
      type: "triggerEngagementMilestone",
      achievementKey: "FIRST_RECURRING_REPEAT_DONE",
      achievementId: "FIRST_RECURRING_REPEAT_DONE",
      at,
      meta: { seriesId, occurrenceIso },
      toast: {
        message: "Completed your first recurring repeat occurrence.",
        priority: 2,
        durationMs: FIRST_RECURRING_REPEAT_DONE_TOAST_MS
      }
    });
  }

  function emitCompletionForTransition(params: {
    taskId: string;
    previousStatus: Task["status"] | undefined;
    nextStatus: Task["status"];
    tags: string[];
    at: number;
    recurringRepeat?: {
      seriesId: string;
      occurrenceIso: string;
    };
  }) {
    if (params.previousStatus !== "open" || params.nextStatus !== "done") {
      return;
    }
    dispatch({
      type: "recordCompletion",
      taskId: params.taskId,
      at: params.at,
      tags: params.tags
    });
    dispatch({ type: "evaluateEngagement", at: params.at });
    if (params.recurringRepeat) {
      triggerFirstRecurringRepeatDone(
        params.at,
        params.recurringRepeat.seriesId,
        params.recurringRepeat.occurrenceIso
      );
    }
  }

  function emitCompletionFromDiff(previousTasks: Task[], nextTasks: Task[], at: number) {
    const previousById = new Map(previousTasks.map((task) => [task.id, task]));
    const seriesById = new Map(
      nextTasks
        .filter((task) => task.recurrence?.series_id)
        .map((task) => [task.recurrence!.series_id, task])
    );
    for (const nextTask of nextTasks) {
      const previousTask = previousById.get(nextTask.id);
      const instance = nextTask.instance_of;
      const recurringRepeat =
        instance &&
        isRepeatOccurrenceAfterSeriesStart(
          seriesById.get(instance.series_id)?.recurrence?.dtstart,
          instance.occurrence
        )
          ? {
              seriesId: instance.series_id,
              occurrenceIso: instance.occurrence
            }
          : undefined;
      emitCompletionForTransition({
        taskId: nextTask.id,
        previousStatus: previousTask?.status ?? "open",
        nextStatus: nextTask.status,
        tags: nextTask.tags,
        at,
        recurringRepeat
      });
    }
  }

  function completeRecurringOccurrence() {
    const context = resolveSelectedOccurrenceContext();
    if (!context) {
      return;
    }

    const nowMs = Date.now();
    const occurrenceDate = parseLocalIsoToDate(context.occurrenceIso);
    if (!occurrenceDate) {
      showShortNavigationBanner("Invalid occurrence timestamp");
      return;
    }

    if (context.instanceTask) {
      const nextStatus = context.instanceTask.status === "done" ? "open" : "done";
      const updatedTasks = state.tasks.map((task) => {
        if (task.id !== context.instanceTask?.id) return task;
        return {
          ...task,
          status: nextStatus,
          updatedAt: nowMs,
          closedAt: nextStatus === "done" ? nowMs : undefined
        };
      });
      dispatch({ type: "setTasks", tasks: updatedTasks });
      dispatch({ type: "setSelected", id: context.instanceTask.id });
      const recurringRepeat = isRepeatOccurrenceAfterSeriesStart(
        context.seriesTask.recurrence?.dtstart,
        context.occurrenceIso
      )
        ? {
            seriesId: context.seriesId,
            occurrenceIso: context.occurrenceIso
          }
        : undefined;
      emitCompletionForTransition({
        taskId: context.instanceTask.id,
        previousStatus: context.instanceTask.status,
        nextStatus,
        tags: context.instanceTask.tags,
        at: nowMs,
        recurringRepeat
      });
      return;
    }

    const dueAt = occurrenceDate.getTime();
    const instanceId = crypto.randomUUID();
    const doneInstance: Task = {
      id: instanceId,
      title: context.seriesTask.title,
      status: "done",
      createdAt: nowMs,
      updatedAt: nowMs,
      closedAt: nowMs,
      dueAt,
      hasExplicitTime: context.seriesTask.hasExplicitTime,
      notes: context.seriesTask.notes,
      tags: context.seriesTask.tags,
      instance_of: {
        series_id: context.seriesId,
        occurrence: context.occurrenceIso
      }
    };

    const withExdate = withSeriesOccurrenceExcluded(
      state.tasks,
      context.seriesTask.id,
      context.occurrenceIso,
      nowMs
    );
    const updatedTasks = [...withExdate, doneInstance];
    dispatch({ type: "setTasks", tasks: updatedTasks });
    dispatch({
      type: "setTagIndex",
      tagIndex: updateTagIndex(state.tagIndex, doneInstance.tags, nowMs)
    });
    dispatch({ type: "setSelected", id: instanceId });
    const recurringRepeat = isRepeatOccurrenceAfterSeriesStart(
      context.seriesTask.recurrence?.dtstart,
      context.occurrenceIso
    )
      ? {
          seriesId: context.seriesId,
          occurrenceIso: context.occurrenceIso
        }
      : undefined;
    emitCompletionForTransition({
      taskId: instanceId,
      previousStatus: "open",
      nextStatus: "done",
      tags: doneInstance.tags,
      at: nowMs,
      recurringRepeat
    });
  }

  function skipSelectedOccurrence() {
    const context = resolveSelectedOccurrenceContext();
    if (!context) {
      showShortNavigationBanner("Skip applies to recurring occurrences");
      return;
    }

    const nowMs = Date.now();
    const withExdate = withSeriesOccurrenceExcluded(
      state.tasks,
      context.seriesTask.id,
      context.occurrenceIso,
      nowMs
    );
    const updatedTasks = removeMaterializedOccurrenceInstance(
      withExdate,
      context.seriesId,
      context.occurrenceIso
    );
    dispatch({ type: "setTasks", tasks: updatedTasks });
    showShortNavigationBanner("Skipped selected occurrence");
  }

  function snoozeSelectedOccurrence() {
    const context = resolveSelectedOccurrenceContext();
    if (!context) {
      showShortNavigationBanner("Snooze applies to recurring occurrences");
      return;
    }

    const nowMs = Date.now();
    const occurrenceDate = parseLocalIsoToDate(context.occurrenceIso);
    if (!occurrenceDate) {
      showShortNavigationBanner("Invalid occurrence timestamp");
      return;
    }

    const snoozedDate = new Date(
      occurrenceDate.getFullYear(),
      occurrenceDate.getMonth(),
      occurrenceDate.getDate() + 1,
      occurrenceDate.getHours(),
      occurrenceDate.getMinutes(),
      occurrenceDate.getSeconds()
    );

    const source = context.instanceTask ?? context.seriesTask;
    const instanceId = context.instanceTask?.id ?? crypto.randomUUID();
    const snoozedInstance: Task = {
      id: instanceId,
      title: source.title,
      status: "open",
      createdAt: context.instanceTask?.createdAt ?? nowMs,
      updatedAt: nowMs,
      dueAt: snoozedDate.getTime(),
      hasExplicitTime: source.hasExplicitTime,
      notes: source.notes,
      tags: source.tags,
      instance_of: {
        series_id: context.seriesId,
        occurrence: context.occurrenceIso
      }
    };

    const withExdate = withSeriesOccurrenceExcluded(
      state.tasks,
      context.seriesTask.id,
      context.occurrenceIso,
      nowMs
    );
    const withoutPreviousInstance = removeMaterializedOccurrenceInstance(
      withExdate,
      context.seriesId,
      context.occurrenceIso
    );
    const updatedTasks = [...withoutPreviousInstance, snoozedInstance];
    dispatch({ type: "setTasks", tasks: updatedTasks });
    dispatch({
      type: "setTagIndex",
      tagIndex: updateTagIndex(state.tagIndex, snoozedInstance.tags, nowMs)
    });
    dispatch({ type: "setSelected", id: instanceId });
    showShortNavigationBanner("Snoozed occurrence by +1 day");
  }

  function toggleSelected() {
    if (!selectedTask) return;

    if (
      selectedTask.rowKind === "series_occurrence_virtual" ||
      selectedTask.rowKind === "series_occurrence_instance"
    ) {
      completeRecurringOccurrence();
      return;
    }

    const persisted = resolvePersistedTaskForRow(selectedTask);
    if (!persisted) return;
    const nowMs = Date.now();
    const nextStatus = persisted.status === "done" ? "open" : "done";

    if (persisted.status === "open") {
      const completion = completeTaskWithRecurrence(state.tasks, persisted.id, nowMs);
      dispatch({
        type: "setTasks",
        tasks: completion.tasks
      });
      if (completion.spawnedId) {
        dispatch({ type: "setSelected", id: completion.spawnedId });
      }
      emitCompletionForTransition({
        taskId: persisted.id,
        previousStatus: persisted.status,
        nextStatus,
        tags: persisted.tags,
        at: nowMs
      });
      return;
    }

    const updated: Task = {
      ...persisted,
      status: "open",
      updatedAt: nowMs,
      closedAt: undefined
    };
    dispatch({
      type: "setTasks",
      tasks: state.tasks.map((task) => (task.id === updated.id ? updated : task))
    });
    emitCompletionForTransition({
      taskId: updated.id,
      previousStatus: persisted.status,
      nextStatus,
      tags: updated.tags,
      at: nowMs
    });
  }

  function openAdd(options: { bypassUnsavedGuard?: boolean } = {}) {
    editorFlow.openAdd(options);
  }

  function startEditSession(rowId: string, draft: EditorDraft) {
    editorFlow.startEditSession(rowId, draft);
  }

  function buildEditDraftForRow(row: VisibleTaskRow): EditorDraft | null {
    return editorFlow.buildEditDraftForRow(row);
  }

  function openEditForRow(row: VisibleTaskRow): boolean {
    return editorFlow.openEditForRow(row);
  }

  function openEditForRowId(rowId: string): boolean {
    return editorFlow.openEditForRowId(rowId);
  }

  function openEditSeries() {
    editorFlow.openEditSeries();
  }

  function openEdit(options: { bypassUnsavedGuard?: boolean } = {}) {
    editorFlow.openEdit(options);
  }

  function openChecklistQuickEditFromList() {
    if (uiState.mode !== Mode.LIST || uiState.focus !== FocusTarget.TASK_LIST) return;
    if (!selectedTask || (selectedTask.checklist?.length ?? 0) === 0) return;
    const opened = openEditForRow(selectedTask);
    if (!opened) return;
    uiDispatch({ type: "setFocus", focus: FocusTarget.EDITOR_CHECKLIST });
  }

  function openDuplicate() {
    editorFlow.openDuplicate();
  }

  function cancelEditor() {
    editorFlow.cancelEditor();
  }

  function updateEditorDraft(patch: Partial<EditorDraft>) {
    editorFlow.updateEditorDraft(patch);
  }

  function saveEditor(options: {
    forceMode?: typeof Mode.ADD | typeof Mode.EDIT;
    closeAfterSave?: boolean;
  } = {}): boolean {
    return editorFlow.saveEditor(options);
  }

  const modalFlow = useModalOrchestration({
    uiState,
    state,
    dispatch,
    uiDispatch,
    backupDispatch,
    setTimeSuggestion,
    requestTaskEditorUnsavedGuard,
    closeHelp,
    runTaskEditorContinuation,
    runHelpThemeEditorContinuation,
    saveEditor,
    saveCustom1Editor,
    saveBuiltInTextEditor,
    openModalWithContext,
    closeModalWithPreviousContext,
    finishDeleteModalAction,
    handleDeleteSelected,
    runBackupImportCommitFlow,
    runCalendarImportCommitFromBackupCenter,
    runRoutedAction,
    openAdd,
    clearPendingGPrefix,
    closeViewsOverlay,
    openListMode,
    showShortNavigationBanner,
    emitCompletionFromDiff
  });

  function finishDeleteModalAction(
    modal: UIDeleteModal,
    deletedRowId: string,
    nextTasks: Task[]
  ) {
    const visibleIds = visibleTaskRows.map((task) => task.id);
    const nextSelectedId = getNextSelectedIdAfterDelete(visibleIds, deletedRowId);
    dispatch({ type: "setTasks", tasks: nextTasks });
    dispatch({ type: "setSelected", id: nextSelectedId });
    uiDispatch({ type: "setModal", modal: null });
    uiDispatch({ type: "setMode", mode: modal.previousMode });
    uiDispatch({ type: "setFocus", focus: modal.previousFocus });
  }

  function handleDeleteSelected() {
    const modal = uiState.modal;
    if (!modal || modal.type !== "delete") return;
    if (modal.target === "regular_task") {
      finishDeleteModalAction(
        modal,
        modal.taskId,
        state.tasks.filter((task) => task.id !== modal.taskId)
      );
      return;
    }

    const nowMs = Date.now();
    const nextTasks = deleteRecurringOccurrence(state.tasks, {
      seriesTaskId: modal.seriesTaskId,
      seriesId: modal.seriesId,
      occurrenceIso: modal.occurrenceIso,
      nowMs
    });
    finishDeleteModalAction(modal, modal.selectedRowId, nextTasks);
  }

  function handleDeleteSelectedAndFuture() {
    const modal = uiState.modal;
    if (!modal || modal.type !== "delete" || modal.target !== "recurring_occurrence") return;
    const nowMs = Date.now();
    const nextTasks = deleteRecurringOccurrenceAndFuture(state.tasks, {
      seriesTaskId: modal.seriesTaskId,
      seriesId: modal.seriesId,
      occurrenceIso: modal.occurrenceIso,
      nowMs
    });
    finishDeleteModalAction(modal, modal.selectedRowId, nextTasks);
  }

  function confirmDeleteSelectedFromModal() {
    modalFlow.confirmDeleteSelectedFromModal();
  }

  function confirmDeleteSelectedAndFutureFromModal() {
    modalFlow.confirmDeleteSelectedAndFutureFromModal();
  }

  function cancelDeleteSelectedFromModal() {
    modalFlow.cancelDeleteSelectedFromModal();
  }

  function openEmptyNuxModal(options?: {
    step?: EmptyNuxStep;
    startedFromNux?: boolean;
    createdTaskId?: string;
  }) {
    modalFlow.openEmptyNuxModal(options);
  }

  function startEmptyNuxAddFlow() {
    modalFlow.startEmptyNuxAddFlow();
  }

  function dismissEmptyNuxModal() {
    modalFlow.dismissEmptyNuxModal();
  }

  function showEmptyNuxShortcutsModal() {
    modalFlow.showEmptyNuxShortcutsModal();
  }

  function returnToEmptyNuxWelcomeModal() {
    modalFlow.returnToEmptyNuxWelcomeModal();
  }

  function clearEmptyNuxWalkthrough() {
    modalFlow.clearEmptyNuxWalkthrough();
  }

  function closeCelebrateToList() {
    modalFlow.closeCelebrateToList();
  }

  function createTaskFromEmptyNuxModal() {
    modalFlow.createTaskFromEmptyNuxModal();
  }

  function handleOverdueModalSnooze() {
    modalFlow.handleOverdueModalSnooze();
  }

  function handleOverdueModalDone() {
    modalFlow.handleOverdueModalDone();
  }

  function handleOverdueModalGoToTask() {
    modalFlow.handleOverdueModalGoToTask();
  }

  function setTagFilter(next?: TagFilter) {
    dispatch({
      type: "setFilters",
      filters: {
        tag: undefined,
        tagFilter: normalizeTagFilter(next)
      }
    });
  }

  function clearTagFilters() {
    dispatch({
      type: "setFilters",
      filters: {
        tag: undefined,
        tagFilter: undefined
      }
    });
  }

  function toggleTagInTagFilter(
    current: TagFilter | undefined,
    rawTag: string,
    bucket: TagFilterBucket
  ): TagFilter | undefined {
    const normalizedTag = normalizeTagToken(rawTag);
    if (!normalizedTag) return normalizeTagFilter(current);

    const next: TagFilter = {
      all: [...(current?.all ?? [])],
      any: [...(current?.any ?? [])],
      none: [...(current?.none ?? [])]
    };
    const bucketTags = next[bucket] ?? [];
    const alreadyPresent = bucketTags.includes(normalizedTag);
    const updatedBucketTags = alreadyPresent
      ? bucketTags.filter((tag) => tag !== normalizedTag)
      : [...bucketTags, normalizedTag];
    next[bucket] = updatedBucketTags;
    return normalizeTagFilter(next);
  }

  function removeLastTagFromTagFilter(
    current: TagFilter | undefined,
    bucket: TagFilterBucket
  ): TagFilter | undefined {
    const tags = current?.[bucket] ?? [];
    if (tags.length === 0) return normalizeTagFilter(current);
    const next: TagFilter = {
      all: [...(current?.all ?? [])],
      any: [...(current?.any ?? [])],
      none: [...(current?.none ?? [])]
    };
    next[bucket] = tags.slice(0, -1);
    return normalizeTagFilter(next);
  }

  function removeTagFromTagFilter(
    current: TagFilter | undefined,
    bucket: TagFilterBucket,
    rawTag: string
  ): TagFilter | undefined {
    const normalizedTag = normalizeTagToken(rawTag);
    if (!normalizedTag) return normalizeTagFilter(current);
    const next: TagFilter = {
      all: [...(current?.all ?? [])],
      any: [...(current?.any ?? [])],
      none: [...(current?.none ?? [])]
    };
    next[bucket] = (next[bucket] ?? []).filter((tag) => tag !== normalizedTag);
    return normalizeTagFilter(next);
  }

  function toggleTagInBucket(
    rawTag: string,
    bucket: TagFilterBucket
  ): TagFilter | undefined {
    const nextTagFilter = toggleTagInTagFilter(state.filters.tagFilter, rawTag, bucket);
    setTagFilter(nextTagFilter);
    return nextTagFilter;
  }

  function cycleStatus() {
    const order: Array<"all" | "open" | "done" | "archived"> = [
      "all",
      "open",
      "done",
      "archived"
    ];
    const current = order.indexOf(state.filters.status);
    const next = order[(current + 1) % order.length];
    dispatch({ type: "setFilters", filters: { status: next } });
  }

  function cycleSort() {
    const currentIndex = SORT_MODE_ORDER.indexOf(state.sortMode);
    const safeIndex = currentIndex === -1 ? 0 : currentIndex;
    const nextSortMode = SORT_MODE_ORDER[(safeIndex + 1) % SORT_MODE_ORDER.length];
    dispatch({ type: "setSortMode", sortMode: nextSortMode });
    showShortNavigationBanner(`Sort: ${getSortModeLabel(nextSortMode)}`);
  }

  function cycleDue() {
    const order: Array<"any" | "overdue" | "today" | "next7"> = [
      "any",
      "overdue",
      "today",
      "next7"
    ];
    const current = order.indexOf(state.filters.due);
    const next = order[(current + 1) % order.length];
    dispatch({ type: "setFilters", filters: { due: next, dueDayOffset: undefined } });
  }

  function cycleAnalyticsWindow() {
    const order: Array<"7d" | "14d" | "30d"> = ["7d", "14d", "30d"];
    const current = state.filters.analyticsWindow ?? "7d";
    const currentIndex = order.indexOf(current);
    const safeIndex = currentIndex === -1 ? 0 : currentIndex;
    const next = order[(safeIndex + 1) % order.length];
    dispatch({ type: "setFilters", filters: { analyticsWindow: next } });
    showShortNavigationBanner(`Analytics window: ${next.toUpperCase()}`);
  }

  function cyclePriority() {
    const priorities = getSortedOpenTaskPriorities(state.tasks);
    if (priorities.length === 0) {
      dispatch({ type: "setFilters", filters: { priority: undefined } });
      showShortNavigationBanner("No priority tags on open tasks");
      return;
    }

    const current = normalizePriorityFilterValue(state.filters.priority);
    const currentIndex = current ? priorities.indexOf(current) : -1;
    if (currentIndex < 0) {
      dispatch({ type: "setFilters", filters: { priority: priorities[0] } });
      return;
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex >= priorities.length) {
      dispatch({ type: "setFilters", filters: { priority: undefined } });
      return;
    }
    dispatch({ type: "setFilters", filters: { priority: priorities[nextIndex] } });
  }

  function getDashboardFocusGroupItemCount(group: DashboardFocusGroup): number {
    switch (group) {
      case "top_tags":
        return state.filters.status === "done" || state.filters.status === "archived"
          ? 0
          : dashboardTopTags.length;
      case "due_buckets":
        return 8;
      case "priority":
        return dashboardPriorityBuckets.length;
      case "assignee":
        return dashboardAssigneeSlices.length;
      case "project":
        return dashboardProjectSlices.length;
      case "workflow_stage":
        return dashboardWorkflowStageSlices.length;
      default:
        return 0;
    }
  }

  function moveDashboardFocusGroup(direction: 1 | -1) {
    if (uiState.mode !== Mode.DASHBOARD) return;
    const currentIndex = DASHBOARD_FOCUS_GROUP_ORDER.indexOf(dashboardFocusGroup);
    const safeIndex = currentIndex === -1 ? 0 : currentIndex;
    for (let step = 1; step <= DASHBOARD_FOCUS_GROUP_ORDER.length; step += 1) {
      const candidateIndex =
        (safeIndex + direction * step + DASHBOARD_FOCUS_GROUP_ORDER.length) %
        DASHBOARD_FOCUS_GROUP_ORDER.length;
      const candidate = DASHBOARD_FOCUS_GROUP_ORDER[candidateIndex];
      if (getDashboardFocusGroupItemCount(candidate) > 0) {
        setDashboardFocusGroup(candidate);
        return;
      }
    }
  }

  function moveDashboardActiveSelection(delta: 1 | -1) {
    if (uiState.mode !== Mode.DASHBOARD) return;
    const count = getDashboardFocusGroupItemCount(dashboardFocusGroup);
    if (count <= 0) return;

    switch (dashboardFocusGroup) {
      case "top_tags":
        setDashboardTagSelection((prev) => (prev + delta + count) % count);
        return;
      case "due_buckets":
        setDashboardDueBucketSelection((prev) => (prev + delta + count) % count);
        return;
      case "priority":
        setDashboardPrioritySelection((prev) => (prev + delta + count) % count);
        return;
      case "assignee":
        setDashboardAssigneeSelection((prev) => (prev + delta + count) % count);
        return;
      case "project":
        setDashboardProjectSelection((prev) => (prev + delta + count) % count);
        return;
      case "workflow_stage":
        setDashboardWorkflowStageSelection((prev) => (prev + delta + count) % count);
        return;
      default:
        return;
    }
  }

  function applyDashboardTagAtIndex(selectionIndex: number) {
    if (state.filters.status === "done" || state.filters.status === "archived") {
      showShortNavigationBanner("Top tags available for OPEN tasks only");
      return;
    }
    if (dashboardTopTags.length === 0) {
      showShortNavigationBanner("No tagged open tasks");
      return;
    }

    const clampedIndex = Math.max(0, Math.min(selectionIndex, dashboardTopTags.length - 1));
    const selected = dashboardTopTags[clampedIndex];
    if (!selected) return;
    setDashboardTagSelection(clampedIndex);
    dispatch({
      type: "setFilters",
      filters: {
        tag: selected.tag,
        tagFilter: undefined
      }
    });
    showShortNavigationBanner(
      `Dashboard tag filter: ${formatTagForReadOnlyDisplay(selected.tag)}`
    );
  }

  function applyDashboardDueBucketAtIndex(selectionIndex: number) {
    const clampedIndex = Math.max(0, Math.min(selectionIndex, 7));
    setDashboardDueBucketSelection(clampedIndex);

    if (clampedIndex === 0) {
      dispatch({
        type: "setFilters",
        filters: {
          status: "open",
          due: "overdue",
          dueDayOffset: undefined
        }
      });
      showShortNavigationBanner("Dashboard due filter: OPEN + OVERDUE");
      return;
    }

    if (clampedIndex === 1) {
      dispatch({
        type: "setFilters",
        filters: {
          status: "open",
          due: "today",
          dueDayOffset: undefined
        }
      });
      showShortNavigationBanner("Dashboard due filter: OPEN + TODAY");
      return;
    }

    const dueDayOffset = clampedIndex - 1;
    dispatch({
      type: "setFilters",
      filters: {
        status: "open",
        due: "any",
        dueDayOffset: dueDayOffset as 1 | 2 | 3 | 4 | 5 | 6
      }
    });
    showShortNavigationBanner(`Dashboard due filter: OPEN + EXACT +${dueDayOffset}`);
  }

  function applyDashboardPriorityAtIndex(selectionIndex: number) {
    if (dashboardPriorityBuckets.length === 0) {
      showShortNavigationBanner("No priority buckets in current view");
      return;
    }
    const clampedIndex = Math.max(
      0,
      Math.min(selectionIndex, dashboardPriorityBuckets.length - 1)
    );
    const selected = dashboardPriorityBuckets[clampedIndex];
    if (!selected) return;
    const normalizedPriority = normalizePriorityFilterValue(selected.priority);
    if (!normalizedPriority) return;

    setDashboardPrioritySelection(clampedIndex);
    dispatch({
      type: "setFilters",
      filters: {
        status: "open",
        due: "any",
        dueDayOffset: undefined,
        priority: normalizedPriority
      }
    });
    const displayPriority = formatPriorityForDisplay(normalizedPriority) ?? normalizedPriority;
    showShortNavigationBanner(`Dashboard priority filter: ${displayPriority}`);
  }

  function applyDashboardAssigneeAtIndex(selectionIndex: number) {
    if (dashboardAssigneeSlices.length === 0) {
      showShortNavigationBanner("No assignee slices in current view");
      return;
    }
    const clampedIndex = Math.max(
      0,
      Math.min(selectionIndex, dashboardAssigneeSlices.length - 1)
    );
    const selected = dashboardAssigneeSlices[clampedIndex];
    if (!selected) return;
    setDashboardAssigneeSelection(clampedIndex);
    dispatch({
      type: "setFilters",
      filters: {
        assignee: selected.value
      }
    });
    showShortNavigationBanner(`Dashboard assignee filter: ${selected.value}`);
  }

  function applyDashboardProjectAtIndex(selectionIndex: number) {
    if (dashboardProjectSlices.length === 0) {
      showShortNavigationBanner("No project slices in current view");
      return;
    }
    const clampedIndex = Math.max(
      0,
      Math.min(selectionIndex, dashboardProjectSlices.length - 1)
    );
    const selected = dashboardProjectSlices[clampedIndex];
    if (!selected) return;
    setDashboardProjectSelection(clampedIndex);
    dispatch({
      type: "setFilters",
      filters: {
        project: selected.value
      }
    });
    showShortNavigationBanner(`Dashboard project filter: ${selected.value}`);
  }

  function applyDashboardWorkflowStageAtIndex(selectionIndex: number) {
    if (dashboardWorkflowStageSlices.length === 0) {
      showShortNavigationBanner("No workflow-stage slices in current view");
      return;
    }
    const clampedIndex = Math.max(
      0,
      Math.min(selectionIndex, dashboardWorkflowStageSlices.length - 1)
    );
    const selected = dashboardWorkflowStageSlices[clampedIndex];
    if (!selected) return;
    setDashboardWorkflowStageSelection(clampedIndex);
    dispatch({
      type: "setFilters",
      filters: {
        workflowStage: selected.value as Task["workflowStage"]
      }
    });
    showShortNavigationBanner(`Dashboard stage filter: ${selected.value}`);
  }

  function applyDashboardActiveSelection() {
    if (uiState.mode !== Mode.DASHBOARD) return;
    switch (dashboardFocusGroup) {
      case "top_tags":
        applyDashboardTagAtIndex(clampedDashboardTagSelection);
        return;
      case "due_buckets":
        applyDashboardDueBucketAtIndex(clampedDashboardDueBucketSelection);
        return;
      case "priority":
        applyDashboardPriorityAtIndex(clampedDashboardPrioritySelection);
        return;
      case "assignee":
        applyDashboardAssigneeAtIndex(clampedDashboardAssigneeSelection);
        return;
      case "project":
        applyDashboardProjectAtIndex(clampedDashboardProjectSelection);
        return;
      case "workflow_stage":
        applyDashboardWorkflowStageAtIndex(clampedDashboardWorkflowStageSelection);
        return;
      default:
        return;
    }
  }

  function applyDashboardSelectedTag() {
    if (uiState.mode !== Mode.DASHBOARD) return;
    applyDashboardTagAtIndex(clampedDashboardTagSelection);
  }

  function handleDashboardTopTagClick(index: number) {
    if (uiState.mode !== Mode.DASHBOARD) return;
    setDashboardFocusGroup("top_tags");
    applyDashboardTagAtIndex(index);
  }

  function handleDashboardDueBucketClick(index: number) {
    if (uiState.mode !== Mode.DASHBOARD) return;
    setDashboardFocusGroup("due_buckets");
    applyDashboardDueBucketAtIndex(index);
  }

  function handleDashboardPriorityClick(index: number) {
    if (uiState.mode !== Mode.DASHBOARD) return;
    setDashboardFocusGroup("priority");
    applyDashboardPriorityAtIndex(index);
  }

  function handleDashboardAssigneeClick(index: number) {
    if (uiState.mode !== Mode.DASHBOARD) return;
    setDashboardFocusGroup("assignee");
    applyDashboardAssigneeAtIndex(index);
  }

  function handleDashboardProjectClick(index: number) {
    if (uiState.mode !== Mode.DASHBOARD) return;
    setDashboardFocusGroup("project");
    applyDashboardProjectAtIndex(index);
  }

  function handleDashboardWorkflowStageClick(index: number) {
    if (uiState.mode !== Mode.DASHBOARD) return;
    setDashboardFocusGroup("workflow_stage");
    applyDashboardWorkflowStageAtIndex(index);
  }

  function toggleBottomDueQuickFilter(targetDue: "overdue" | "today" | "next7") {
    const alreadyActive =
      state.filters.status === "open" &&
      state.filters.due === targetDue &&
      state.filters.dueDayOffset === undefined;
    if (alreadyActive) {
      dispatch({
        type: "setFilters",
        filters: { status: "all", due: "any", dueDayOffset: undefined }
      });
      showShortNavigationBanner("Quick filter cleared");
      return;
    }

    dispatch({
      type: "setFilters",
      filters: {
        status: "open",
        due: targetDue,
        dueDayOffset: undefined
      }
    });
    showShortNavigationBanner(`Quick filter: OPEN + ${targetDue.toUpperCase()}`);
  }

  function toggleBottomCompletedQuickFilter() {
    const alreadyActive =
      state.filters.status === "done" &&
      state.filters.due === "any" &&
      state.filters.dueDayOffset === undefined;
    if (alreadyActive) {
      dispatch({
        type: "setFilters",
        filters: { status: "all", dueDayOffset: undefined }
      });
      showShortNavigationBanner("Quick filter cleared");
      return;
    }

    dispatch({
      type: "setFilters",
      filters: {
        status: "done",
        due: "any",
        dueDayOffset: undefined
      }
    });
    showShortNavigationBanner("Quick filter: DONE");
  }

  function isBottomTagQuickFilterActive(tag: string): boolean {
    if (!isEmptyTagFilter(state.filters.tagFilter)) {
      return (state.filters.tagFilter?.all ?? []).includes(tag);
    }
    return state.filters.tag === tag;
  }

  function toggleBottomTagQuickFilter(tag: string) {
    if (!isEmptyTagFilter(state.filters.tagFilter)) {
      const nextTagFilter = toggleTagInBucket(tag, "all");
      showShortNavigationBanner(
        nextTagFilter
          ? `Tag filter (ALL): ${formatTagForReadOnlyDisplay(tag)}`
          : "Boolean tag filter cleared"
      );
      return;
    }

    const alreadyActive = state.filters.tag === tag;
    dispatch({
      type: "setFilters",
      filters: {
        tag: alreadyActive ? undefined : tag,
        tagFilter: undefined
      }
    });
    showShortNavigationBanner(
      alreadyActive
        ? "Tag quick filter cleared"
        : `Tag quick filter: ${formatTagForReadOnlyDisplay(tag)}`
    );
  }

  function isBottomPriorityQuickFilterActive(priorityTag: string): boolean {
    const normalizedPriority = normalizePriorityFilterValue(priorityTag);
    if (!normalizedPriority) return false;
    return (
      state.filters.status === "open" &&
      state.filters.due === "any" &&
      state.filters.dueDayOffset === undefined &&
      normalizePriorityFilterValue(state.filters.priority) === normalizedPriority
    );
  }

  function toggleBottomPriorityQuickFilter(priorityTag: string) {
    const normalizedPriority = normalizePriorityFilterValue(priorityTag);
    if (!normalizedPriority) return;

    const alreadyActive = isBottomPriorityQuickFilterActive(normalizedPriority);
    if (alreadyActive) {
      dispatch({
        type: "setFilters",
        filters: {
          status: "all",
          due: "any",
          dueDayOffset: undefined,
          priority: undefined
        }
      });
      showShortNavigationBanner("Priority quick filter cleared");
      return;
    }

    dispatch({
      type: "setFilters",
      filters: {
        status: "open",
        due: "any",
        dueDayOffset: undefined,
        priority: normalizedPriority
      }
    });
    const displayPriority =
      formatPriorityForDisplay(normalizedPriority) ?? normalizedPriority;
    showShortNavigationBanner(`Quick filter: OPEN + ${displayPriority}`);
  }

  function toggleTagFilter() {
    const activeTags = Array.from(
      new Set(
        state.tasks
          .filter((task) => task.status === "open")
          .flatMap((task) => task.tags)
          .filter((tag) => !isPriorityToken(tag))
      )
    ).sort((left, right) => left.localeCompare(right));

    if (activeTags.length === 0) {
      dispatch({ type: "setFilters", filters: { tag: undefined, tagFilter: undefined } });
      return;
    }

    const currentTag = state.filters.tag;
    const currentIndex = currentTag ? activeTags.indexOf(currentTag) : -1;
    const nextIndex = currentIndex + 1;

    if (nextIndex >= activeTags.length || currentIndex === -1) {
      dispatch({
        type: "setFilters",
        filters: {
          tag: currentIndex === -1 ? activeTags[0] : undefined,
          tagFilter: undefined
        }
      });
      return;
    }

    dispatch({
      type: "setFilters",
      filters: {
        tag: activeTags[nextIndex],
        tagFilter: undefined
      }
    });
  }

  function updateSearch(value: string) {
    dispatch({ type: "setFilters", filters: { searchText: value } });
  }

  function handlePickTag(tag: string) {
    if (!state.editor) return;
    const nextValue = replaceLastTagToken(state.editor.tagsText, tag);
    dispatch({ type: "updateEditor", patch: { tagsText: nextValue } });
  }

  function updateSaveViewName(value: string) {
    setSaveViewName(value.slice(0, VIEW_NAME_MAX_LENGTH));
  }

  if (!terminalIsSupported) {
    return (
      <box
        style={{
          height: "100%",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: theme.bg,
          color: theme.text
        }}
      >
        <box
          style={{
            border: true,
            borderStyle: "single",
            borderColor: theme.warn,
            backgroundColor: theme.panel,
            paddingLeft: 2,
            paddingRight: 2,
            paddingTop: 1,
            paddingBottom: 1,
            flexDirection: "column",
            alignItems: "center"
          }}
        >
          <text style={{ color: theme.warn, fontWeight: "bold" }}>{terminalSizeWarning}</text>
          <text style={{ color: theme.muted }}>Resize terminal to continue.</text>
          <text style={{ color: theme.muted }}>Press q to quit.</text>
        </box>
      </box>
    );
  }

  return (
    <box
      style={{
        flexDirection: "row",
        height: "100%",
        backgroundColor: theme.bg,
        color: theme.text
      }}
    >
      <box
        style={{
          width: layout.railWidth,
          backgroundColor: railPanelBackgroundColor,
          padding: 1,
          border: true,
          borderStyle: "single",
          borderColor: railPanelBorderColor
        }}
      >
        <LeftRail
          mode={uiState.mode}
          focus={uiState.focus}
          filters={state.filters}
          sortMode={state.sortMode}
          fastPulseOn={false}
          flashMode="static"
          logoMode={settingsState.logoMode}
          onMenuSelect={handleLeftRailMenuSelect}
          terminalWidth={terminalWidth}
          hintLines={leftRailHintLines}
          showHints={showLeftRailHints}
          showLogo={showLogo}
          activeThemeId={settingsState.themeId === "rotating" ? activeThemeId : undefined}
        />
      </box>

      <box style={{ flexDirection: "column", flexGrow: 1 }}>
        <box
          style={{
            height: 4,
            backgroundColor: headerBackgroundColor,
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "column",
            border: true,
            borderStyle: "single",
            borderColor: headerBorderColor
          }}
        >
          <box style={{ width: "100%", justifyContent: "center", alignItems: "center" }}>
            <text
              style={{
                color: theme.bg,
                fontWeight: "bold"
              }}
            >
              {isDashboardMode
                ? "DASHBOARD MODE"
                : isBackupMode
                  ? "BACKUP CENTER"
                : selectedTask
                  ? selectedTask.title.toUpperCase()
                  : "NO TASK SELECTED"}
            </text>
          </box>
          <box style={{ width: "100%", justifyContent: "center", alignItems: "center" }}>
            <text
              style={{
                color: theme.bg,
                fontWeight: "bold"
              }}
            >
              {isDashboardMode
                ? `FILTERED TASKS: ${visibleTaskRows.length}`
                : isBackupMode
                  ? "SAFE IMPORT / EXPORT FLOW"
                : bulkActive
                  ? `BULK MARKED: ${String(bulkMarkedTaskIds.length)} · \` bulk ... · Esc clear`
                : selectedTask
                  ? getDueInLabel(selectedTask, now)
                  : ""}
            </text>
          </box>
        </box>

        {isDashboardMode ? (
          <box
            key={`dashboard-pane-${terminalWidth}x${terminalHeight}`}
            style={{ flexDirection: "column", flexGrow: 1 }}
          >
            <box
              style={{
                backgroundColor: dashboardPanelBackgroundColor,
                paddingLeft: 3,
                paddingTop: 1
              }}
            >
              <text style={{ color: dashboardTheme.muted }}>DASHBOARD</text>
            </box>
            <box
                style={{
                  flexGrow: 1,
                  padding: 1,
                  backgroundColor: dashboardPanelBackgroundColor,
                  border: true,
                  borderStyle: "single",
                  borderColor: dashboardPanelBorderColor
                }}
              >
              <DashboardPane
                tasks={visibleTaskRows}
                filters={state.filters}
                topTags={dashboardTopTags}
                selectedTopTagIndex={clampedDashboardTagSelection}
                selectedDueBucketIndex={clampedDashboardDueBucketSelection}
                selectedPriorityIndex={clampedDashboardPrioritySelection}
                selectedAssigneeIndex={clampedDashboardAssigneeSelection}
                selectedProjectIndex={clampedDashboardProjectSelection}
                selectedWorkflowStageIndex={clampedDashboardWorkflowStageSelection}
                analyticsWindowDays={analyticsWindowDays}
                prioritySlices={dashboardPriorityBuckets.map((bucket) => ({
                  value: bucket.priority,
                  count: bucket.count
                }))}
                assigneeSlices={dashboardAssigneeSlices}
                projectSlices={dashboardProjectSlices}
                workflowStageSlices={dashboardWorkflowStageSlices}
                activeFocusGroup={dashboardFocusGroup}
                now={now}
                width={dashboardPaneWidth}
                height={dashboardPaneHeight}
                onTopTagClick={handleDashboardTopTagClick}
                onDueBucketClick={handleDashboardDueBucketClick}
                onPriorityClick={handleDashboardPriorityClick}
                onAssigneeClick={handleDashboardAssigneeClick}
                onProjectClick={handleDashboardProjectClick}
                onWorkflowStageClick={handleDashboardWorkflowStageClick}
              />
            </box>
          </box>
        ) : (
          <box
            key={`list-pane-${terminalWidth}x${terminalHeight}`}
            style={{ flexDirection: "row", flexGrow: 1 }}
          >
            <box style={{ flexDirection: "column", flexGrow: 1 }}>
              <box
                style={{
                  backgroundColor: taskListTheme.panel,
                  paddingLeft: 3,
                  paddingTop: 1
                }}
              >
                <text style={{ color: taskListTheme.muted }}>TASK LIST</text>
              </box>
              <box
                style={{
                  flexGrow: 1,
                  padding: 1,
                  backgroundColor: taskListPanelBackgroundColor,
                  border: true,
                  borderStyle: "single",
                  borderColor: taskListPanelBorderColor
                }}
              >
                <box style={{ flexDirection: "column", flexGrow: 1 }}>
                  {uiState.mode === Mode.SEARCH ? (
                    <box style={{ flexDirection: "column", marginBottom: 1 }}>
                      <text style={{ color: taskListTheme.muted }}>SEARCH</text>
                      <input
                        value={state.filters.searchText ?? ""}
                        onChange={updateSearch}
                        focused={uiState.focus === FocusTarget.SEARCH_INPUT}
                        placeholder="Type to filter tasks and tags; Enter/Esc closes"
                        style={{ backgroundColor: inputTheme.bg, color: inputTheme.text }}
                      />
                    </box>
                  ) : null}
                  <TaskList
                    tasks={visibleTaskRows}
                    markedTaskIds={bulkMarkedTaskIdSet}
                    selectedId={state.selectedId}
                    now={now}
                    pulseOn={pulseOn}
                    fastPulseOn={fastPulseOn}
                    flashMode={settingsState.flashMode}
                    onTaskRowClick={handleTaskRowClick}
                    onWheelScroll={handleTaskListWheelScroll}
                    scrollOffset={uiState.scrollOffset}
                    visibleRows={visibleRows}
                    visibleLines={visibleLines}
                  />
                </box>
              </box>
            </box>

            <box style={{ flexDirection: "column", width: layout.rightWidth }}>
              {isEditorMode(uiState.mode) ? (
                <box
                  style={{
                    backgroundColor: theme.panel,
                    paddingLeft: 3,
                    paddingTop: 1
                  }}
                >
                  <text style={{ color: theme.muted }}>
                    {uiState.mode === Mode.ADD ? "ADD TASK" : "EDIT TASK"}
                  </text>
                </box>
              ) : (
              <box
                style={{
                  backgroundColor: theme.panel,
                  paddingLeft: 3,
                  paddingTop: 1
                }}
              >
                <text style={{ color: theme.muted }}>DETAILS</text>
              </box>
              )}
              <box
                style={{
                  flexGrow: 1,
                  padding: 1,
                  backgroundColor: detailsPanelBackgroundColor,
                  border: true,
                  borderStyle: "single",
                  borderColor: detailsPanelBorderColor
                }}
              >
                {isEditorMode(uiState.mode) && state.editor ? (
                  <EditorPane
                    mode={uiState.mode}
                    draft={state.editor}
                    focus={toEditorFocus(uiState.focus)}
                    availableHeightLines={editorPaneHeightLines}
                    scrollOffset={uiState.editorScrollOffset}
                    titleInlineSuggestion={
                      uiState.focus === FocusTarget.EDITOR_TITLE ? titleInlineSuggestion : null
                    }
                    tagInlineSuggestion={
                      uiState.focus === FocusTarget.EDITOR_TAGS ? tagInlineSuggestion : null
                    }
                    dueSuggestionHint={dueSuggestionHint}
                    timeSuggestionHint={timeSuggestionHint}
                    recurrencePreview={recurrencePreview}
                    selectedChecklistItemId={selectedEditorChecklistItem?.id}
                    checklistFocused={uiState.focus === FocusTarget.EDITOR_CHECKLIST}
                    onSelectChecklistItem={setSelectedEditorChecklistItemId}
                    onUpdate={updateEditorDraft}
                    onScrollOffsetChange={(scrollOffset) =>
                      uiDispatch({ type: "setEditorScrollOffset", scrollOffset })
                    }
                    onSave={saveEditor}
                    onCancel={cancelEditor}
                  />
                ) : (
                  <DetailsPane
                    task={selectedTask}
                    now={now}
                    pulseOn={pulseOn}
                    fastPulseOn={fastPulseOn}
                    flashMode={settingsState.flashMode}
                    selectedLinkId={selectedLinkId}
                    linksFocused={uiState.focus === FocusTarget.DETAILS_LINKS}
                    selectedChecklistItemId={selectedChecklistItemId}
                    checklistFocused={uiState.focus === FocusTarget.DETAILS_CHECKLIST}
                    checklistWindowStart={checklistScrollOffset}
                    checklistWindowSize={checklistViewportRows}
                    onSelectLink={selectDetailsLink}
                    onOpenLink={openDetailsLink}
                    onSelectChecklistItem={setSelectedChecklistItemId}
                  />
                )}
              </box>
            </box>
          </box>
        )}

        {activeBanners.map((message, index) => {
          const isSaveFailure =
            message.startsWith("Save failed:") ||
            message.startsWith("Save blocked by concurrent update") ||
            message.startsWith("Save retry failed:");
          const isSaveConflictBanner =
            saveConflictBannerState !== null &&
            saveFailureBanner !== null &&
            message === saveFailureBanner;
          const isNavigationNotice = message.startsWith("No ");
          const withActionLabel = isSaveConflictBanner
            ? `${message} ${saveConflictRetryPending ? "[Retrying...]" : "[R] Reload + Retry"}`
            : message;
          return (
            <box
              key={`${index}:${message}`}
              style={{
                height: 1,
                backgroundColor: isSaveFailure
                  ? notificationsTheme.danger
                  : isNavigationNotice
                    ? notificationsTheme.accentBlue
                    : notificationsTheme.warn,
                paddingLeft: 1,
                paddingRight: 1
              }}
              onMouseDown={
                isSaveConflictBanner && !saveConflictRetryPending
                  ? (event) => {
                      if (
                        !shouldTriggerSaveConflictRetryFromMouse({
                          isSaveConflictBanner,
                          retryPending: saveConflictRetryPending,
                          button: event.button
                        })
                      ) {
                        return;
                      }
                      void handleRetrySaveAfterConflictReload();
                    }
                  : undefined
              }
            >
              <text style={{ color: notificationsTheme.bg }}>{withActionLabel}</text>
            </box>
          );
        })}

        <box
          style={{
            height: bottomBarHeight,
            backgroundColor: bottomBarBackgroundColor,
            border: true,
            borderStyle: "single",
            borderColor: bottomBarBorderColor,
            justifyContent: "center",
            alignItems: "center"
          }}
        >
          <box style={{ flexDirection: "column", alignItems: "center", gap: 0 }}>
            {bottomInfoView === "tags" ? (
              <box style={{ flexDirection: "row", gap: 0 }}>
                {tagTickerSegments.length === 0 ? (
                  <text style={{ color: theme.muted }}>NO TAGS</text>
                ) : (
                  tagTickerSegments.map((segment, index) => (
                    <box key={segment.tag} style={{ flexDirection: "row", gap: 0 }}>
                      {index > 0 ? (
                        <text style={{ color: theme.muted }}>  </text>
                      ) : null}
                      <box
                        style={{
                          backgroundColor: colorForTag(segment.tag),
                          paddingLeft: 1,
                          paddingRight: 1
                        }}
                        onMouseDown={(event) => {
                          if (event.button !== 0) return;
                          toggleBottomTagQuickFilter(segment.tag);
                        }}
                      >
                        <text
                          style={{
                            color: isBottomTagQuickFilterActive(segment.tag)
                              ? theme.text
                              : theme.bg,
                            fontWeight: isBottomTagQuickFilterActive(segment.tag)
                              ? "bold"
                              : "normal"
                          }}
                        >
                          {segment.total} {segment.displayTag}
                        </text>
                      </box>
                    </box>
                  ))
                )}
              </box>
            ) : bottomInfoView === "priorities" ? (
              <box style={{ flexDirection: "row", gap: 0 }}>
                {priorityTickerSegments.length === 0 ? (
                  <text style={{ color: theme.muted }}>
                    {priorityTickerNeedsWiderLayout
                      ? "WIDEN TO VIEW PRIORITIES"
                      : "NO OPEN PRIORITIES"}
                  </text>
                ) : (
                  priorityTickerSegments.map((segment, index) => (
                    <box key={segment.priorityTag} style={{ flexDirection: "row", gap: 0 }}>
                      {index > 0 ? (
                        <text style={{ color: theme.muted }}>  </text>
                      ) : null}
                      <box
                        style={{
                          backgroundColor: colorForTag(segment.priorityTag),
                          paddingLeft: 1,
                          paddingRight: 1
                        }}
                        onMouseDown={(event) => {
                          if (event.button !== 0) return;
                          toggleBottomPriorityQuickFilter(segment.priorityTag);
                        }}
                      >
                        <text
                          style={{
                            color: isBottomPriorityQuickFilterActive(segment.priorityTag)
                              ? theme.text
                              : theme.bg,
                            fontWeight: isBottomPriorityQuickFilterActive(segment.priorityTag)
                              ? "bold"
                              : "normal"
                          }}
                        >
                          {segment.total} {segment.displayPriority}
                        </text>
                      </box>
                    </box>
                  ))
                )}
              </box>
            ) : (
              <box style={{ flexDirection: "row", gap: 2 }}>
                <box
                  style={{
                    backgroundColor: theme.warn,
                    paddingLeft: 1,
                    paddingRight: 1
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    toggleBottomDueQuickFilter("overdue");
                  }}
                >
                  <text
                    style={{
                      color: overdueQuickFilterActive ? theme.text : theme.bg,
                      fontWeight: overdueQuickFilterActive ? "bold" : "normal"
                    }}
                  >
                    {summary.overdue} OVERDUE
                  </text>
                </box>
                <box
                  style={{
                    backgroundColor: theme.dueSoon,
                    paddingLeft: 1,
                    paddingRight: 1
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    toggleBottomDueQuickFilter("today");
                  }}
                >
                  <text
                    style={{
                      color: todayQuickFilterActive ? theme.text : theme.bg,
                      fontWeight: todayQuickFilterActive ? "bold" : "normal"
                    }}
                  >
                    {summary.today} DUE TODAY
                  </text>
                </box>
                <box
                  style={{
                    backgroundColor: theme.dueLater,
                    paddingLeft: 1,
                    paddingRight: 1
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    toggleBottomDueQuickFilter("next7");
                  }}
                >
                  <text
                    style={{
                      color: next7QuickFilterActive ? theme.text : theme.bg,
                      fontWeight: next7QuickFilterActive ? "bold" : "normal"
                    }}
                  >
                    {summary.next7} DUE THIS WEEK
                  </text>
                </box>
                <box
                  style={{
                    backgroundColor: theme.ok,
                    paddingLeft: 1,
                    paddingRight: 1
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    toggleBottomCompletedQuickFilter();
                  }}
                >
                  <text
                    style={{
                      color: doneQuickFilterActive ? theme.text : theme.bg,
                      fontWeight: doneQuickFilterActive ? "bold" : "normal"
                    }}
                  >
                    {summary.completed7} COMPLETED THIS WEEK
                  </text>
                </box>
              </box>
            )}
          </box>
        </box>
      </box>

      {activeEngagementToast ? (
        <box
          style={{
            position: "absolute",
            left: layout.railWidth + 1,
            right: 1,
            bottom: 1,
            paddingLeft: 1,
            paddingRight: 1,
            backgroundColor: theme.panel,
            border: true,
            borderStyle: "single",
            borderColor: theme.outline
          }}
        >
          <text style={{ color: theme.text }}>{engagementToastLine}</text>
        </box>
      ) : null}

      {commandActive ? (
        <box
          style={{
            position: "absolute",
            left: layout.railWidth + 1,
            right: 1,
            bottom: 1,
            paddingLeft: 1,
            paddingRight: 1,
            paddingTop: 1,
            paddingBottom: 1,
            flexDirection: "column",
            backgroundColor: theme.panel,
            border: true,
            borderStyle: "single",
            borderColor: commandOutput?.kind === "error" ? theme.warn : theme.outline
          }}
        >
          <box
            style={{
              backgroundColor: theme.accentBlue,
              paddingLeft: 1,
              paddingRight: 1
            }}
          >
            <text style={{ color: theme.bg, fontWeight: "bold" }}>{commandHeaderLine}</text>
          </box>
          <box
            style={{
              paddingLeft: 1,
              paddingRight: 1,
              marginTop: 1
            }}
          >
            <text style={{ color: commandOutput ? (commandOutput.kind === "error" ? theme.warn : theme.ok) : theme.muted }}>
              {commandStatusLine}
            </text>
          </box>
          <box
            style={{
              flexDirection: "row",
              backgroundColor: theme.bg,
              paddingLeft: 1,
              paddingRight: 1,
              marginTop: 1
            }}
          >
            <text style={{ color: theme.muted, marginRight: 1, fontWeight: "bold" }}>:</text>
            <input
              value={commandText}
              onInput={setCommandTextValue}
              focused
              placeholder='add "Buy milk" #errands'
              style={{
                backgroundColor: theme.bg,
                color: inputTheme.text,
                flexGrow: 1
              }}
            />
          </box>
        </box>
      ) : null}

      <AppModalLayer
        uiState={uiState}
        theme={theme}
        modalTheme={modalTheme}
        inputTheme={inputTheme}
        MODAL_STANDARD_WIDTH={MODAL_STANDARD_WIDTH}
        activeEmptyNuxStep={activeEmptyNuxStep}
        showCorruptionRecoveryImportCta={showCorruptionRecoveryImportCta}
        activeOverdueModal={activeOverdueModal}
        activeOverdueTask={activeOverdueTask}
        now={now}
        TASK_LINK_FORM_KIND_ORDER={TASK_LINK_FORM_KIND_ORDER}
        describeUnsavedSource={describeUnsavedSource}
        describeTaskEditorContinuation={describeTaskEditorContinuation}
        formatLinkSnippet={formatLinkSnippet}
        confirmDeleteSelectedFromModal={confirmDeleteSelectedFromModal}
        confirmDeleteSelectedAndFutureFromModal={confirmDeleteSelectedAndFutureFromModal}
        cancelDeleteSelectedFromModal={cancelDeleteSelectedFromModal}
        handleRecurringDeleteFutureCheckpointConfirm={handleRecurringDeleteFutureCheckpointConfirm}
        cancelRecurringDeleteFutureCheckpoint={cancelRecurringDeleteFutureCheckpoint}
        handleUnsavedChangesSaveAndContinue={handleUnsavedChangesSaveAndContinue}
        handleUnsavedChangesDiscardAndContinue={handleUnsavedChangesDiscardAndContinue}
        cancelUnsavedChangesContinue={cancelUnsavedChangesContinue}
        handleBackupFinalCheckpointConfirm={handleBackupFinalCheckpointConfirm}
        cancelBackupFinalCheckpoint={cancelBackupFinalCheckpoint}
        patchChecklistInputModal={patchChecklistInputModal}
        submitChecklistInputModal={submitChecklistInputModal}
        handleDeleteChecklistItemFromModal={handleDeleteChecklistItemFromModal}
        handleConfirmBulkDeleteFromModal={handleConfirmBulkDeleteFromModal}
        patchTaskLinkFormModal={patchTaskLinkFormModal}
        submitTaskLinkFormModal={submitTaskLinkFormModal}
        applyEscUnwind={applyEscUnwind}
        handleDeleteTaskLinkFromModal={handleDeleteTaskLinkFromModal}
        handleOpenExternalTaskLinkFromModal={handleOpenExternalTaskLinkFromModal}
        handleModalSaveAndSwitchEditTarget={handleModalSaveAndSwitchEditTarget}
        handleModalDiscardAndSwitchEditTarget={handleModalDiscardAndSwitchEditTarget}
        handleModalDiscardAndCloseEditor={handleModalDiscardAndCloseEditor}
        dismissEmptyNuxModal={dismissEmptyNuxModal}
        clearEmptyNuxWalkthrough={clearEmptyNuxWalkthrough}
        createTaskFromEmptyNuxModal={createTaskFromEmptyNuxModal}
        openBackupImportFromEmptyNux={openBackupImportFromEmptyNux}
        showEmptyNuxShortcutsModal={showEmptyNuxShortcutsModal}
        returnToEmptyNuxWelcomeModal={returnToEmptyNuxWelcomeModal}
        closeCelebrateToList={closeCelebrateToList}
        handleOverdueModalSnooze={handleOverdueModalSnooze}
        handleOverdueModalDone={handleOverdueModalDone}
        handleOverdueModalGoToTask={handleOverdueModalGoToTask}
      />

      {viewsOverlayOpen ? (
        <box
          style={{
            position: "absolute",
            top: 3,
            left: layout.railWidth + 3,
            padding: 1,
            backgroundColor: theme.panel,
            border: true,
            borderStyle: "single",
            borderColor: theme.outline,
            minWidth: 58
          }}
        >
          <box style={{ flexDirection: "column" }}>
            <text style={{ color: theme.text, fontWeight: "bold" }}>
              SAVED VIEWS ({state.savedViews.length}/{MAX_SAVED_VIEWS})
            </text>
            <text style={{ color: theme.muted }}>
              enter: apply  d: delete  ctrl+s: save current  v/esc: close
            </text>
            {state.savedViews.length === 0 ? (
              <text style={{ color: theme.muted, marginTop: 1 }}>No saved views yet.</text>
            ) : (
              <box style={{ flexDirection: "column", marginTop: 1 }}>
                {state.savedViews.map((view, index) => {
                  const selected = index === selectedViewIndex;
                  const slot = String(index + 1);
                  return (
                    <box
                      key={view.id}
                      style={{
                        paddingLeft: 1,
                        paddingRight: 1,
                        backgroundColor: selected ? theme.accentBlue : "transparent"
                      }}
                    >
                      <text style={{ color: selected ? theme.bg : theme.text }}>
                        [{slot}] {view.name} - {summarizeViewFilters(view.filters)}
                      </text>
                    </box>
                  );
                })}
              </box>
            )}

            {saveViewPromptOpen ? (
              <box style={{ flexDirection: "column", marginTop: 1 }}>
                <text style={{ color: theme.text }}>Save current filters as view name:</text>
                <input
                  value={saveViewName}
                  onChange={updateSaveViewName}
                  focused
                  placeholder="e.g. TODAY FOCUS"
                  style={{ backgroundColor: inputTheme.bg, color: inputTheme.text }}
                />
                <text style={{ color: theme.muted }}>
                  Enter: save, Esc: cancel ({saveViewName.length}/{VIEW_NAME_MAX_LENGTH})
                </text>
              </box>
            ) : null}
          </box>
        </box>
      ) : null}

      {uiState.mode === Mode.TAG_FILTER ? (
        <box
          style={{
            position: "absolute",
            top: 1,
            left: 2,
            right: 2,
            bottom: 1,
            justifyContent: "center",
            alignItems: "center"
          }}
        >
          <TagFilterPanel
            draft={tagFilterDraft}
            inputValue={tagFilterInput}
            activeBucket={activeTagFilterBucket}
            inlineSuggestion={tagFilterInlineSuggestion}
            suggestions={tagFilterSuggestions}
            onInputChange={setTagFilterInputValue}
            onInputKeyDown={handleTagFilterPanelInputKeyDown}
            onInputSubmit={(value) => addTagFilterDraftCandidateFromInput(value)}
            onSetBucket={setTagFilterBucketAndFocusInput}
            onRemoveTag={(bucket, tag) =>
              setTagFilterDraft((current) =>
                removeTagFromTagFilter(current, bucket, tag)
              )
            }
            onApply={applyTagFilterPanel}
            onClear={clearTagFilterPanelDraft}
            onCancel={closeTagFilterPanel}
          />
        </box>
      ) : null}

      {uiState.mode === Mode.BACKUP_CENTER ? (
        <box
          style={{
            position: "absolute",
            top: 2,
            left: 8,
            right: 8,
            bottom: 2,
            justifyContent: "center",
            alignItems: "center"
          }}
        >
          <BackupCenterScreen
            state={backupState}
            dataPath={getDataFilePath()}
            importPickerVisibleRows={backupImportPickerVisibleRows}
            bodyScrollRequest={backupBodyScrollRequest}
            savedViewNames={state.savedViews.map((view) => view.name)}
            onImportPathChange={(value) =>
              backupDispatch({ type: "setImportPath", value })
            }
            onImportPickerSelectIndex={(index) =>
              backupDispatch({
                type: "setImportPickerSelection",
                index,
                visibleRows: backupImportPickerVisibleRows
              })
            }
            onOpenImportPathFallback={() => backupDispatch({ type: "openImportPathManual" })}
            onImportPickerWheelScroll={(delta) =>
              backupDispatch({
                type: "moveImportPickerSelection",
                delta,
                visibleRows: backupImportPickerVisibleRows
              })
            }
            onReplaceConfirmChange={(value) =>
              backupDispatch({ type: "setReplaceConfirmInput", value })
            }
            onCalendarExportPathChange={(value) =>
              backupDispatch({ type: "setCalendarExportPath", value })
            }
            onCalendarImportPathChange={(value) =>
              {
                calendarImportPathInputRef.current = value;
                backupDispatch({ type: "setCalendarImportPath", value });
              }
            }
            onCalendarImportHorizonChange={(value) =>
              backupDispatch({ type: "setCalendarImportHorizonInput", value })
            }
            onCalendarImportTagChange={(value) =>
              backupDispatch({ type: "setCalendarImportTagInput", value })
            }
            onCalendarImportConfirmChange={(value) =>
              {
                calendarImportConfirmInputRef.current = value;
                backupDispatch({ type: "setCalendarImportConfirmInput", value });
              }
            }
            onPrimaryAction={handleBackupPrimaryAction}
            onBackAction={handleBackupBackAction}
            onMenuSelect={handleBackupMenuSelect}
            onCalendarMenuSelect={handleCalendarMenuSelect}
            onImportModeSelect={(mode) =>
              backupDispatch({ type: "setImportMode", mode })
            }
            onCalendarExportRangeSelect={(range) =>
              backupDispatch({ type: "setCalendarExportRange", range })
            }
            onCalendarExportViewSelect={(viewName) =>
              backupDispatch({ type: "setCalendarExportViewName", viewName })
            }
            onCalendarExportPrivacySelect={(privacy) =>
              backupDispatch({ type: "setCalendarExportPrivacy", privacy })
            }
            onCalendarImportRangeSelect={(range) =>
              {
                calendarImportRangeRef.current = range;
                backupDispatch({ type: "setCalendarImportRange", range });
              }
            }
            onCalendarImportViewSelect={(viewName) =>
              backupDispatch({ type: "setCalendarImportViewName", viewName })
            }
            onCalendarImportModeSelect={(mode) =>
              {
                calendarImportModeRef.current = mode;
                backupDispatch({ type: "setCalendarImportMode", mode });
              }
            }
          />
        </box>
      ) : null}

      {uiState.mode === Mode.HELP ? (
        <box
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: "center",
            alignItems: "center"
          }}
        >
          <box
            style={{
              width: helpPanelWidth,
              height: helpPanelHeight,
              maxWidth: "100%",
              flexDirection: "column",
              backgroundColor: helpTheme.panel,
              overflow: "hidden",
              border: true,
              borderStyle: "single",
              borderColor: helpTheme.outline
            }}
          >
            <box
              style={{
                flexDirection: "column",
                height: HELP_HEADER_ROWS,
                minHeight: HELP_HEADER_ROWS,
                maxHeight: HELP_HEADER_ROWS,
                paddingLeft: 1,
                paddingRight: 1,
                backgroundColor: helpTheme.panel
              }}
            >
              <text style={{ color: helpTheme.text, fontWeight: "bold" }}>{helpHeaderTitle}</text>
              <text style={{ color: helpTheme.muted }}>
                {PRODUCT_NAME_TM} {APP_VERSION} · {APP_TAGLINE}
              </text>
            </box>
            <box
              style={{
                height: HELP_DIVIDER_ROWS,
                minHeight: HELP_DIVIDER_ROWS,
                maxHeight: HELP_DIVIDER_ROWS,
                paddingLeft: 1,
                paddingRight: 1,
                backgroundColor: helpTheme.panel
              }}
            >
              <text style={{ color: helpTheme.outline }}>
                {"─".repeat(helpFooterWidth)}
              </text>
            </box>
            <box
              style={{
                height: helpContentVisibleRows,
                minHeight: helpContentVisibleRows,
                maxHeight: helpContentVisibleRows,
                paddingLeft: 1,
                paddingRight: 1,
                backgroundColor: helpTheme.panel,
                overflow: "hidden"
              }}
            >
              {activeHelpPage === "custom1Edit" ? (
                <Custom1ThemeEditor
                  ref={custom1EditorRef}
                  draftGlobal={custom1DraftGlobal}
                  draftObjects={custom1DraftObjects}
                  persistedGlobal={persistedCustom1.global}
                  onChangeGlobal={setCustom1DraftGlobal}
                  onChangeObjects={setCustom1DraftObjects}
                  onSave={saveCustom1Editor}
                  onCancel={() => {
                    if (
                      requestHelpThemeEditorUnsavedGuard("help_custom1_editor", "close_editor")
                    ) {
                      return;
                    }
                    closeCustom1EditorCancel();
                  }}
                />
              ) : activeHelpPage === "textTuningEdit" ? (
                <BuiltInThemeTextEditor
                  ref={builtInTextEditorRef}
                  themeId={helpTextTuningThemeId}
                  baseTokens={builtInTextBaseTokens}
                  draftGlobal={builtInTextDraftGlobal}
                  draftObjects={builtInTextDraftObjects}
                  onChangeGlobal={setBuiltInTextDraftGlobal}
                  onChangeObjects={setBuiltInTextDraftObjects}
                  onSave={saveBuiltInTextEditor}
                  onCancel={() => {
                    if (
                      requestHelpThemeEditorUnsavedGuard(
                        "help_text_tuning_editor",
                        "close_editor"
                      )
                    ) {
                      return;
                    }
                    closeBuiltInTextEditorCancel();
                  }}
                />
              ) : activeHelpPage === "help" ? (
                <box
                  style={{
                    height: "100%",
                    minHeight: 0,
                    maxHeight: "100%",
                    flexDirection: "column",
                    overflow: "hidden"
                  }}
                  onMouseScroll={(event) => {
                    const direction = event.scroll?.direction;
                    if (direction === "up") {
                      scrollHelpTo(clampedHelpScrollOffset - 1);
                    } else if (direction === "down") {
                      scrollHelpTo(clampedHelpScrollOffset + 1);
                    }
                  }}
                >
                  <box
                    style={{
                      flexDirection: "column"
                    }}
                  >
                    {helpVisibleRows.map((row, visibleRowIndex) => {
                      const rowIndex = clampedHelpScrollOffset + visibleRowIndex;
                      const scrollbarIsThumb =
                        helpScrollbarThumb !== null &&
                        visibleRowIndex >= helpScrollbarThumb.startRow &&
                        visibleRowIndex <= helpScrollbarThumb.endRow;
                      const scrollbarGlyph =
                        helpHasOverflow && scrollbarIsThumb ? "█" : helpHasOverflow ? "│" : "";
                      if (row.kind === "section_header") {
                        const section = HELP_MENU_SECTIONS[row.sectionIndex];
                        const expanded = helpExpandedBySection[row.sectionIndex] === true;
                        const focused = row.sectionIndex === clampedHelpFocusedSectionIndex;
                        const sectionLine = fitLineToWidth(
                          `${expanded ? "▾" : "▸"} ${section.title}`,
                          helpContentLineWidth
                        );
                        return (
                          <box
                            key={`help-row-${rowIndex}`}
                            style={{
                              flexDirection: "row",
                              backgroundColor: focused ? helpTheme.accentBlue : "transparent",
                              width: "100%"
                            }}
                            onMouseDown={(event) => {
                              if (event.button !== 0) return;
                              handleHelpSectionHeaderClick(row.sectionIndex);
                            }}
                          >
                            <text
                              style={{
                                color: focused ? helpTheme.bg : helpTheme.text,
                                fontWeight: focused ? "bold" : "normal"
                              }}
                            >
                              {sectionLine}
                            </text>
                            {helpHasOverflow ? (
                              <text
                                style={{
                                  color: scrollbarIsThumb
                                    ? focused
                                      ? helpTheme.bg
                                      : helpTheme.accentBlue
                                    : focused
                                      ? helpTheme.bg
                                      : helpTheme.outline
                                }}
                              >
                                {scrollbarGlyph}
                              </text>
                            ) : null}
                          </box>
                        );
                      }

                      const section = HELP_MENU_SECTIONS[row.sectionIndex];
                      const item = section.items[row.itemIndex];
                      if (row.kind === "item_title") {
                        return (
                          <box
                            key={`help-row-${rowIndex}`}
                            style={{ flexDirection: "row", width: "100%" }}
                          >
                            <text style={{ color: helpTheme.text }}>
                              {fitLineToWidth(`  • ${item.title}`, helpContentLineWidth)}
                            </text>
                            {helpHasOverflow ? (
                              <text
                                style={{
                                  color: scrollbarIsThumb
                                    ? helpTheme.accentBlue
                                    : helpTheme.outline
                                }}
                              >
                                {scrollbarGlyph}
                              </text>
                            ) : null}
                          </box>
                        );
                      }
                      const descriptionLines = getHelpItemDescriptionLines(item);
                      const descriptionLine = fitLineToWidth(
                        `    ${descriptionLines[row.descriptionLineIndex] ?? ""}`,
                        helpContentLineWidth
                      );
                      return (
                        <box
                          key={`help-row-${rowIndex}`}
                          style={{ flexDirection: "row", width: "100%" }}
                        >
                          <text style={{ color: helpTheme.muted }}>{descriptionLine}</text>
                          {helpHasOverflow ? (
                            <text
                              style={{
                                color: scrollbarIsThumb
                                  ? helpTheme.accentBlue
                                  : helpTheme.outline
                              }}
                            >
                              {scrollbarGlyph}
                            </text>
                          ) : null}
                        </box>
                      );
                    })}
                  </box>
                </box>
              ) : (
                <box
                  style={{
                    height: "100%",
                    minHeight: 0,
                    maxHeight: "100%",
                    flexDirection: "column",
                    overflow: "hidden"
                  }}
                  onMouseScroll={(event) => {
                    const direction = event.scroll?.direction;
                    if (direction === "up") {
                      scrollHelpNavTo(clampedHelpNavScrollOffset - 1);
                    } else if (direction === "down") {
                      scrollHelpNavTo(clampedHelpNavScrollOffset + 1);
                    }
                  }}
                >
                  <box style={{ flexDirection: "column" }}>
                    {Array.from({ length: helpNavVisibleRowCount }, (_, visibleRowIndex) => {
                      const rowIndex = clampedHelpNavScrollOffset + visibleRowIndex;
                      const scrollbarIsThumb =
                        helpNavScrollbarThumb !== null &&
                        visibleRowIndex >= helpNavScrollbarThumb.startRow &&
                        visibleRowIndex <= helpNavScrollbarThumb.endRow;
                      const scrollbarGlyph =
                        helpHasOverflow && scrollbarIsThumb ? "█" : helpHasOverflow ? "│" : "";

                      if (rowIndex < helpNavStatusLineCount) {
                        const statusLine = helpSettingsStatusLines[rowIndex] ?? "";
                        return (
                          <box
                            key={`help-nav-status-${rowIndex}`}
                            style={{ flexDirection: "row", width: "100%" }}
                          >
                            <text style={{ color: helpTheme.muted }}>
                              {fitLineToWidth(statusLine, helpContentLineWidth)}
                            </text>
                            {helpHasOverflow ? (
                              <text
                                style={{
                                  color: scrollbarIsThumb
                                    ? helpTheme.accentBlue
                                    : helpTheme.outline
                                }}
                              >
                                {scrollbarGlyph}
                              </text>
                            ) : null}
                          </box>
                        );
                      }

                      const navRowIndex = rowIndex - helpNavStatusLineCount;
                      const itemIndex = Math.floor(navRowIndex / HELP_NAV_ITEM_ROW_COUNT);
                      const item = helpNavItems[itemIndex];
                      if (!item) return null;

                      if (navRowIndex % HELP_NAV_ITEM_ROW_COUNT === 0) {
                        const focused = itemIndex === clampedHelpNavSelectionIndex;
                        const itemTitle = resolveHelpNavItemTitle(item, itemIndex);
                        return (
                          <box
                            key={`help-nav-title-${itemIndex}`}
                            style={{
                              flexDirection: "row",
                              width: "100%",
                              backgroundColor: focused ? helpTheme.accentBlue : "transparent",
                              paddingLeft: 1,
                              paddingRight: 1
                            }}
                            onMouseDown={(event) => {
                              if (event.button !== 0) return;
                              setHelpNavSelectionForActivePage(itemIndex);
                              handleHelpNavForward(itemIndex);
                            }}
                          >
                            <text
                              style={{
                                color: focused ? helpTheme.bg : helpTheme.text,
                                fontWeight: focused ? "bold" : "normal"
                              }}
                            >
                              {fitLineToWidth(
                                `${focused ? "▶" : " "} ${itemTitle}`,
                                helpContentLineWidth
                              )}
                            </text>
                            {helpHasOverflow ? (
                              <text
                                style={{
                                  color: scrollbarIsThumb
                                    ? focused
                                      ? helpTheme.bg
                                      : helpTheme.accentBlue
                                    : focused
                                      ? helpTheme.bg
                                      : helpTheme.outline
                                }}
                              >
                                {scrollbarGlyph}
                              </text>
                            ) : null}
                          </box>
                        );
                      }

                      return (
                        <box
                          key={`help-nav-description-${itemIndex}`}
                          style={{ flexDirection: "row", width: "100%" }}
                        >
                          <text style={{ color: helpTheme.muted }}>
                            {fitLineToWidth(`    ${item.description}`, helpContentLineWidth)}
                          </text>
                          {helpHasOverflow ? (
                            <text
                              style={{
                                color: scrollbarIsThumb
                                  ? helpTheme.accentBlue
                                  : helpTheme.outline
                              }}
                            >
                              {scrollbarGlyph}
                            </text>
                          ) : null}
                        </box>
                      );
                    })}
                  </box>
                </box>
              )}
            </box>
            {/*
             * Keep footer fixed to exactly 2 rows with full-width background fill.
             * Border-aware sizing + clipping keeps footer rows inside the panel interior and
             * avoids stale glyph overprint/spillage from content redraws.
             */}
            <box
              style={{
                flexDirection: "column",
                height: HELP_FOOTER_ROWS,
                minHeight: HELP_FOOTER_ROWS,
                maxHeight: HELP_FOOTER_ROWS,
                backgroundColor: helpTheme.panel,
                overflow: "hidden"
              }}
            >
              <box
                style={{
                  height: 1,
                  minHeight: 1,
                  maxHeight: 1,
                  width: "100%",
                  flexDirection: "row",
                  alignItems: "center",
                  paddingLeft: 1,
                  paddingRight: 1,
                  backgroundColor: helpTheme.panel
                }}
              >
                <text style={{ color: helpTheme.muted }}>{helpFooterHintsLine}</text>
                {helpCloseButtonLabel ? (
                  <box
                    style={{
                      marginLeft: 1,
                      backgroundColor: helpTheme.accentBlue,
                      paddingLeft: 1,
                      paddingRight: 1
                    }}
                    onMouseDown={(event) => {
                      if (event.button !== 0) return;
                      closeHelp();
                    }}
                  >
                    <text style={{ color: helpTheme.bg, fontWeight: "bold" }}>
                      {helpCloseButtonLabel}
                    </text>
                  </box>
                ) : null}
              </box>
              <box
                style={{
                  height: 1,
                  minHeight: 1,
                  maxHeight: 1,
                  width: "100%",
                  paddingLeft: 1,
                  paddingRight: 1,
                  backgroundColor: helpTheme.panel
                }}
              >
                <text style={{ color: helpTheme.muted }}>{helpFooterDataPathLine}</text>
              </box>
            </box>
          </box>
        </box>
      ) : null}

      {showWhichKeyHintBar ? (
        <box
          style={{
            position: "absolute",
            left: layout.railWidth + 1,
            right: 1,
            bottom: whichKeyHintBarBottom
          }}
        >
          <WhichKeyHintBar items={whichKeyHintItems} width={Math.max(8, bottomBarWidth - 2)} />
        </box>
      ) : null}

      {showWhichKeyPrefixPopup && whichKeyPrefixPopup ? (
        <box
          style={{
            position: "absolute",
            right: 2,
            bottom: whichKeyPopupBottom
          }}
        >
          <WhichKeyPopup model={whichKeyPrefixPopup} />
        </box>
      ) : null}
    </box>
  );
}
