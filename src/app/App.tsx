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
import { TaskList } from "../components/TaskList";
import { DetailsPane } from "../components/DetailsPane";
import { EditorPane } from "../components/EditorPane";
import { LeftRail, type LeftRailMenuItem } from "../components/LeftRail";
import { DashboardPane } from "../components/DashboardPane";
import { TagFilterPanel } from "../components/TagFilterPanel";
import { BackupCenterScreen } from "../components/BackupCenterScreen";
import { EmptyNuxModal } from "../components/EmptyNuxModal";
import {
  Custom1ThemeEditor,
  type Custom1ThemeEditorHandle
} from "../components/Custom1ThemeEditor";
import { OverdueNotificationModal } from "../components/OverdueNotificationModal";
import { diffLocalDays, startOfLocalDayMs } from "../domain/dates";
import { computeTopTagsOpen } from "../domain/dashboard";
import {
  buildRecurrenceFromDraft,
  buildRecurrencePreviewFromDraft
} from "../domain/recurrence/draft";
import { getEditorViewportHeights } from "../domain/editorPaneLayout";
import {
  formatDateToLocalIso,
  parseLocalIsoToDate
} from "../domain/recurrence/rruleAdapter";
import {
  deleteRecurringOccurrence,
  deleteRecurringOccurrenceAndFuture
} from "../domain/recurrence/delete";
import {
  findNextMatchingIndex,
  isTaskDueToday,
  isTaskOverdue
} from "../domain/navigation";
import { clampScrollOffset, ensureSelectedVisible } from "../domain/scroll";
import { computeTopTagStats } from "../domain/tagStats";
import {
  applyAutocomplete,
  getAutocompleteStep,
  getSuggestedTime,
  type SuggestedTime
} from "../domain/timeAutocomplete";
import {
  applyArchiveAging,
  combineDueDateTime,
  createDraftFromTask,
  createEmptyDraft,
  formatDate,
  getDueInLabel,
  initialState,
  parseDueTime,
  reducer
} from "../state/store";
import {
  getDataFilePath,
  CURRENT_SCHEMA_VERSION,
  loadStateStrict,
  saveStateDebounced,
  type LoadedData,
  type SaveStateResult
} from "../state/persistence";
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
  normalizeTagPrefix,
  normalizeTagsFromInput,
  rankTags,
  updateTagIndex
} from "../domain/tagIndex";
import {
  getSortModeLabel,
  SORT_MODE_ORDER
} from "../domain/query";
import { reconcileSelectionById } from "../domain/selection";
import { buildVisibleTaskRows, type VisibleTaskRow } from "../domain/taskRows";
import {
  AppState,
  EditorDraft,
  FocusTarget,
  Mode,
  SavedView,
  TagFilter,
  Task
} from "../domain/models";
import { ROTATING_THEME_ORDER, ThemeId } from "../theme/themes";
import {
  applySavedView,
  DEFAULT_VIEW_FILTERS,
  isSavedViewActive,
  MAX_SAVED_VIEWS,
  saveViewByName,
  deleteViewAtIndex
} from "../domain/savedViews";
import {
  getDefaultSettings,
  loadSettings,
  saveSettingsDebounced,
  type CustomThemeConfig,
  type CustomThemes,
  type FlashMode,
  type NotificationSettings,
  type ThemeObjectId
} from "../settings/settings";
import { settingsReducer } from "../state/settingsStore";
import { isEditorMode } from "../ui/modeFocus";
import { initialUIState, uiReducer, unwind, type UIDeleteModal } from "../ui/state";
import {
  backupCenterReducer,
  hasMatchingDryRun,
  initialBackupCenterState,
  isReplaceConfirmationValid
} from "../state/backupCenterFlow";
import {
  BackupImportPartialError,
  buildTimestampedBackupPath,
  exportBackup,
  getResolvedDataPath,
  importBackup
} from "../state/backupService";
import { NotificationManager } from "../notifications/notificationManager";
import { InAppModalNotifier } from "../notifications/notifiers/inAppModalNotifier";
import { OSNotifier } from "../notifications/notifiers/osNotifier";
import { TerminalBellNotifier } from "../notifications/notifiers/terminalBellNotifier";
import {
  applyOverdueMarkDone,
  applyOverdueSnooze,
  resolveGoToTaskTarget
} from "../notifications/overdueTaskActions";
import type { TaskOverdueEvent } from "../notifications/types";
import { APP_VERSION } from "./version";
import {
  getTerminalSizeWarning,
  isTerminalSizeSupported,
  MIN_TERMINAL_HEIGHT,
  MIN_TERMINAL_WIDTH
} from "./layoutGuard";
import { APP_NAME, APP_TAGLINE, ENV_VARS } from "../brand/brand";
import type { ThemeTokens } from "../theme/themes";

const TICKER_INTERVAL_MS = 6000;
const SLOW_PULSE_INTERVAL_MS = 2000;
const FAST_PULSE_INTERVAL_MS = 700;
const NOTIFICATION_EVALUATION_INTERVAL_MS = 10000;
const ROTATING_THEME_INTERVAL_MS = 15000;
const G_PREFIX_TIMEOUT_MS = 280;
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
const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings =
  getDefaultSettings().notifications;
const DEFAULT_CUSTOM_THEMES: CustomThemes | undefined = getDefaultSettings().customThemes;

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

type HelpPage = "help" | "settings" | "theme" | "custom1" | "custom1Edit";

type HelpNavSelectionByPage = {
  settings: number;
  theme: number;
  custom1: number;
};

type HelpNavItem = {
  title: string;
  description: string;
};

const HELP_SETTINGS_NAV_ITEMS: HelpNavItem[] = [
  {
    title: "Theme",
    description: "Theme mode and custom palette settings."
  },
  {
    title: "Flash Mode",
    description: "Switch between static and pulse urgency cues."
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
  }
];

const HELP_CUSTOM1_NAV_ITEMS: HelpNavItem[] = [
  {
    title: "Edit Colors",
    description: "Open editor (live preview, save/cancel/reset)."
  }
];

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
        title: "List navigation: j/k, arrows, gg, G",
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
      { title: "a add, e edit, E edit series, c copy" },
      { title: "Space toggle done/open, d delete" },
      {
        title: "Recurring controls: x skip, z snooze",
        description: "Skip or push the selected recurring occurrence by one day."
      }
    ]
  },
  {
    title: "Tags & Filters",
    items: [
      {
        title: "f status, s sort, g due, t single tag, T boolean tags",
        description: "Use t for quick single-tag cycle and T for boolean tag panel."
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
        description: "Guided flow: path -> mode -> confirm -> dry-run -> commit."
      },
      {
        title: "CLI export/import commands available",
        description: "Use backup exports for portability and recovery."
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
        title: "License & usage",
        description: "See LICENSE for PolyForm Noncommercial terms."
      }
    ]
  }
];
const HELP_SETTINGS_NAV_SECTION_INDEX = HELP_MENU_SECTIONS.findIndex(
  (section) => section.title === "Settings & Themes"
);

function createDefaultHelpExpandedState(): boolean[] {
  return HELP_MENU_SECTIONS.map((_, index) => index === 0);
}

function clampToBounds(value: number, min: number, max: number): number {
  if (max <= min) return max;
  return Math.max(min, Math.min(value, max));
}

function truncateToWidth(value: string, maxWidth: number): string {
  if (maxWidth <= 0) return "";
  if (value.length <= maxWidth) return value;
  if (maxWidth <= 3) return value.slice(0, maxWidth);
  return `${value.slice(0, maxWidth - 3)}...`;
}

function fitLineToWidth(value: string, width: number): string {
  const truncated = truncateToWidth(value, width);
  if (truncated.length >= width) return truncated;
  return truncated.padEnd(width, " ");
}

function pickHelpCloseButtonLabel(maxWidth: number): string {
  if (maxWidth >= "[Esc] Close".length + 2) return "[Esc] Close";
  if (maxWidth >= "Close".length + 2) return "Close";
  if (maxWidth >= "X".length + 2) return "X";
  return "";
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

function resolveDashboardTopTagLimit(panelHeight: number): number {
  const availableRows = Math.max(1, panelHeight - 8);
  if (availableRows < DASHBOARD_TOP_TAG_MIN) {
    return availableRows;
  }
  return Math.min(DASHBOARD_TOP_TAG_MAX, availableRows);
}

function getTagQuery(tagsText: string): string | null {
  if (/[\s,]$/.test(tagsText)) return null;
  const tokens = tagsText.split(/[\s,]+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const lastToken = tokens[tokens.length - 1];
  const normalized = normalizeTagPrefix(lastToken);
  return normalized.length ? normalized : null;
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

const TAG_PILL_PADDING = 2;

function truncateTagDisplay(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  if (maxLen <= 1) return "#";
  if (maxLen === 2) return "#~";
  return `${value.slice(0, maxLen - 1)}~`;
}

function buildTagTickerSegments(
  stats: ReturnType<typeof computeTopTagStats>,
  maxWidth: number
): TagTickerSegment[] {
  const separator = "  ";
  const segments: TagTickerSegment[] = [];
  let used = 0;

  for (const stat of stats) {
    const displayTag = formatTagForDisplay(stat.tag);
    const countText = String(stat.total);
    const segmentText = `${countText} ${displayTag}`;
    let segmentLen = segmentText.length + TAG_PILL_PADDING;
    const extra = segments.length ? separator.length : 0;

    if (used + extra + segmentLen <= maxWidth) {
      segments.push({ ...stat, displayTag });
      used += extra + segmentLen;
      continue;
    }

    const available = maxWidth - used - extra;
    if (available <= 0) break;
    const nonTagLen = countText.length + TAG_PILL_PADDING;
    const maxTagLen = available - nonTagLen;
    if (maxTagLen <= 1) break;

    const truncatedTag = truncateTagDisplay(displayTag, maxTagLen);
    const truncatedText = `${countText} ${truncatedTag}`;
    segmentLen = truncatedText.length + TAG_PILL_PADDING;
    if (used + extra + segmentLen <= maxWidth) {
      segments.push({ ...stat, displayTag: truncatedTag });
    }
    break;
  }

  return segments;
}

function summarizeViewFilters(filters: SavedView["filters"]): string {
  const search = filters.searchText?.trim();
  const searchLabel = search ? ` search=${search}` : "";
  const booleanTagSummary = formatTagFilterBooleanSummary(filters.tagFilter);
  const tagLabel = booleanTagSummary
    ? ` tags=${booleanTagSummary}`
    : filters.tag
      ? ` tag=#${filters.tag}`
      : "";
  return `status=${filters.status} due=${filters.due}${tagLabel}${searchLabel}`;
}

type AppProps = {
  initialData?: LoadedData;
  skipInitialSave?: boolean;
  startupBanner?: string;
  initialThemeId?: ThemeId;
  initialFlashMode?: FlashMode;
  initialNotificationSettings?: NotificationSettings;
  initialCustomThemes?: CustomThemes;
  settingsPath?: string;
  showLogo?: boolean;
};

function initState(data?: LoadedData): AppState {
  return {
    ...initialState,
    tasks: data?.tasks ?? [],
    tagIndex: data?.tagIndex ?? {},
    savedViews: data?.savedViews ?? []
  };
}

export function App({
  initialData,
  skipInitialSave = false,
  startupBanner,
  initialThemeId = "default",
  initialFlashMode = "slow",
  initialNotificationSettings = DEFAULT_NOTIFICATION_SETTINGS,
  initialCustomThemes = DEFAULT_CUSTOM_THEMES,
  settingsPath,
  showLogo = true
}: AppProps) {
  const renderer = useRenderer();
  const [state, dispatch] = useReducer(reducer, initialData, initState);
  const [settingsState, settingsDispatch] = useReducer(settingsReducer, {
    themeId: initialThemeId,
    flashMode: initialFlashMode,
    notifications: initialNotificationSettings,
    customThemes: initialCustomThemes
  });
  const [uiState, uiDispatch] = useReducer(uiReducer, initialUIState);
  const [backupState, backupDispatch] = useReducer(
    backupCenterReducer,
    initialBackupCenterState
  );
  const [pulseOn, setPulseOn] = useState(false);
  const [fastPulseOn, setFastPulseOn] = useState(false);
  const [showTagTicker, setShowTagTicker] = useState(false);
  const [rotatingThemeIndex, setRotatingThemeIndex] = useState(0);
  const [timeSuggestion, setTimeSuggestion] = useState<SuggestedTime | null>(null);
  const [saveFailureBanner, setSaveFailureBanner] = useState<string | null>(null);
  const [navigationBanner, setNavigationBanner] = useState<string | null>(null);
  const [pendingGPrefix, setPendingGPrefix] = useState(false);
  const [viewsOverlayOpen, setViewsOverlayOpen] = useState(false);
  const [selectedViewIndex, setSelectedViewIndex] = useState(0);
  const [saveViewPromptOpen, setSaveViewPromptOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState("");
  const [dashboardTagSelection, setDashboardTagSelection] = useState(0);
  const [tagFilterDraft, setTagFilterDraft] = useState<TagFilter | undefined>(undefined);
  const [tagFilterInput, setTagFilterInput] = useState("");
  const [activeTagFilterBucket, setActiveTagFilterBucket] =
    useState<TagFilterBucket>("all");
  const [helpExpandedBySection, setHelpExpandedBySection] = useState<boolean[]>(
    createDefaultHelpExpandedState
  );
  const [helpFocusedSectionIndex, setHelpFocusedSectionIndex] = useState(0);
  const [helpScrollOffset, setHelpScrollOffset] = useState(0);
  const [helpNavStack, setHelpNavStack] = useState<HelpPage[]>(["help"]);
  const [helpNavSelection, setHelpNavSelection] = useState<HelpNavSelectionByPage>({
    settings: 0,
    theme: 0,
    custom1: 0
  });
  const [helpPreviewThemeMode, setHelpPreviewThemeMode] = useState<ThemeId | null>(null);
  const [custom1DraftGlobal, setCustom1DraftGlobal] = useState<ThemeTokens>(() =>
    resolveCustom1Config(initialCustomThemes).global
  );
  const [custom1DraftObjects, setCustom1DraftObjects] = useState<
    Partial<Record<ThemeObjectId, Partial<ThemeTokens>>>
  >(() => resolveCustom1Config(initialCustomThemes).objects ?? {});
  const skipInitialSaveRef = useRef(skipInitialSave);
  const skipSettingsSaveRef = useRef(true);
  const lastSuccessfulSaveAtRef = useRef<number | undefined>(undefined);
  const gPrefixTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emptyNuxEligibilityCheckedRef = useRef(false);
  const helpScrollTopRef = useRef(0);
  const helpFocusedSectionRef = useRef(0);
  const helpReturnContextRef = useRef({
    mode: Mode.LIST,
    focus: FocusTarget.TASK_LIST
  });
  const helpPreviewRestoreThemeRef = useRef<ThemeId | null>(null);
  const custom1EditorRef = useRef<Custom1ThemeEditorHandle | null>(null);
  const { height: terminalHeight, width: terminalWidth } = useTerminalDimensions();
  const terminalIsSupported = isTerminalSizeSupported(terminalWidth, terminalHeight);
  const terminalSizeWarning = getTerminalSizeWarning(terminalWidth, terminalHeight);
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
      isEnabled: () => {
        const notifications = settingsRef.current.notifications;
        return notifications.enabled && notifications.inAppOverdueBanner;
      }
    });
    modalBellNotifierRef.current = new TerminalBellNotifier({
      isEnabled: () => {
        const notifications = settingsRef.current.notifications;
        return notifications.enabled && notifications.terminalBellOnOverdue;
      },
      getCooldownMs: () => settingsRef.current.notifications.bellCooldownMs
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

  const now = Date.now();
  const dayKey = startOfLocalDayMs(now);
  const visibleTaskRows = buildVisibleTaskRows(
    state.tasks,
    state.filters,
    state.sortMode,
    now
  );
  const selectedTask =
    visibleTaskRows.find((task) => task.id === state.selectedId) ?? visibleTaskRows[0];
  const activeHelpPage = helpNavStack[helpNavStack.length - 1] ?? "help";
  const persistedCustom1 = React.useMemo(
    () => resolveCustom1Config(settingsState.customThemes),
    [settingsState.customThemes]
  );
  const custom1Draft: CustomThemeConfig = React.useMemo(
    () => ({
      global: custom1DraftGlobal,
      objects: Object.keys(custom1DraftObjects).length > 0 ? custom1DraftObjects : undefined
    }),
    [custom1DraftGlobal, custom1DraftObjects]
  );
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
      : activeHelpPage === "theme"
        ? HELP_THEME_NAV_ITEMS
        : activeHelpPage === "custom1"
          ? HELP_CUSTOM1_NAV_ITEMS
          : [];
  const helpNavSelectionIndex =
    activeHelpPage === "settings"
      ? helpNavSelection.settings
      : activeHelpPage === "theme"
        ? helpNavSelection.theme
        : activeHelpPage === "custom1"
          ? helpNavSelection.custom1
          : 0;
  const clampedHelpNavSelectionIndex =
    helpNavItems.length === 0
      ? 0
      : Math.max(0, Math.min(helpNavSelectionIndex, helpNavItems.length - 1));
  const helpBodyLineCount =
    activeHelpPage === "help"
      ? helpRows.length
      : activeHelpPage === "custom1Edit"
        ? 22
        : Math.max(4, helpNavItems.length * 2 + 2);
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
  const helpFooterHintsRaw =
    activeHelpPage === "help"
      ? helpHasOverflow
        ? "1 Backup Center | Enter/Right on Settings opens Settings pages | Up/Down focus | Enter/Space expand | Left collapse | Esc close | Scroll"
        : "1 Backup Center | Enter/Right on Settings opens Settings pages | Up/Down focus | Enter/Space expand | Left collapse | Esc close"
      : activeHelpPage === "custom1Edit"
        ? "S save | C/Esc cancel | R reset token | Tab next focus | Arrows adjust/jump | Enter commit"
        : "Up/Down move | Enter/Right select | Left/Backspace/Esc back";
  const helpFooterHintsLine = fitLineToWidth(
    helpFooterHintsRaw,
    helpFooterHintLineWidth
  );
  const helpFooterDataPathLine = fitLineToWidth(
    `Data path: ${getDataFilePath()}`,
    helpFooterWidth
  );
  const helpHeaderTitle =
    activeHelpPage === "help"
      ? "Help"
      : activeHelpPage === "settings"
        ? "Help / Settings"
        : activeHelpPage === "theme"
          ? "Help / Settings / Theme"
          : activeHelpPage === "custom1"
            ? "Help / Settings / Theme / Custom1"
            : "Help / Settings / Theme / Custom1 / Edit Colors";
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

  const listHeaderHeight = 2;
  const topBarHeight = 4;
  const bottomBarHeight = 3;
  const activeBanners = [startupBanner, saveFailureBanner, navigationBanner].filter(
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

  const bottomBarWidth = Math.max(0, terminalWidth - layout.railWidth);
  const bottomBarContentWidth = Math.max(0, bottomBarWidth - 2);
  const tagTickerSegments = React.useMemo(
    () => buildTagTickerSegments(tagStats, bottomBarContentWidth),
    [tagStats, bottomBarContentWidth]
  );
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
  const overdueQuickFilterActive =
    state.filters.status === "open" && state.filters.due === "overdue";
  const todayQuickFilterActive =
    state.filters.status === "open" && state.filters.due === "today";
  const next7QuickFilterActive =
    state.filters.status === "open" && state.filters.due === "next7";
  const doneQuickFilterActive =
    state.filters.status === "done" && state.filters.due === "any";

  const tagQuery = state.editor ? getTagQuery(state.editor.tagsText) : null;
  const tagSuggestions = tagQuery ? rankTags(state.tagIndex, tagQuery) : [];
  const tagInlineSuggestion = tagQuery
    ? getTagCompletion(tagQuery, tagSuggestions)
    : null;
  const tagFilterQuery = uiState.mode === Mode.TAG_FILTER
    ? normalizeTagPrefix(tagFilterInput)
    : "";
  const tagFilterSuggestions = tagFilterQuery
    ? rankTags(state.tagIndex, tagFilterQuery)
    : [];
  const tagFilterInlineSuggestion = tagFilterQuery
    ? getTagCompletion(tagFilterQuery, tagFilterSuggestions)
    : null;
  const selectedThemeMode = helpPreviewThemeMode ?? settingsState.themeId;
  const activeThemeId =
    selectedThemeMode === "rotating"
      ? ROTATING_THEME_ORDER[rotatingThemeIndex % ROTATING_THEME_ORDER.length]
      : selectedThemeMode;
  const helpThemeStatusLineRaw = helpPreviewThemeMode
    ? `Theme mode: ${settingsState.themeId} (preview: ${helpPreviewThemeMode})`
    : settingsState.themeId === "rotating"
      ? `Theme mode: rotating (active: ${activeThemeId})`
      : `Theme mode: ${settingsState.themeId}`;
  const helpThemeStatusLine = fitLineToWidth(
    `    ${helpThemeStatusLineRaw}`,
    helpContentLineWidth
  );
  const helpFlashStatusLine = fitLineToWidth(
    `    Flash mode: ${settingsState.flashMode}`,
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
  const dueSuggestion =
    uiState.focus === FocusTarget.EDITOR_DUE_DATE && state.editor
      ? getDueSuggestion(state.editor.dueText, now)
      : null;
  const dueSuggestionHint = dueSuggestion ? `→ ${dueSuggestion} (press →)` : null;

  const timeAutocompleteStep =
    uiState.mode === Mode.ADD &&
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
      setSaveFailureBanner(null);
      return;
    }

    const lastSavedAt = result.lastSuccessfulSaveAt ?? lastSuccessfulSaveAtRef.current;
    const summary = result.error.message || "Unknown persistence error";
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
          savedViews: state.savedViews
        },
        Date.now()
      );
      if (changed) {
        dispatch({ type: "setTasks", tasks: data.tasks });
      }
    }, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [state.tasks, state.tagIndex]);

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
    const id = setInterval(() => {
      setShowTagTicker((prev) => !prev);
    }, TICKER_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      evaluateNotificationsRef.current(Date.now());
    }, NOTIFICATION_EVALUATION_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    evaluateNotificationsRef.current(Date.now());
  }, [state.tasks]);

  useEffect(() => {
    if (emptyNuxEligibilityCheckedRef.current) return;
    if (uiState.modal) return;
    if (uiState.notificationModalQueue.length > 0) return;

    if (state.tasks.length > 0) {
      emptyNuxEligibilityCheckedRef.current = true;
      return;
    }

    if (uiState.emptyNuxDismissed) {
      emptyNuxEligibilityCheckedRef.current = true;
      return;
    }

    uiDispatch({ type: "OPEN_EMPTY_NUX" });
    uiDispatch({ type: "setMode", mode: Mode.MODAL_CONFIRM });
    uiDispatch({ type: "setFocus", focus: FocusTarget.MODAL });
    emptyNuxEligibilityCheckedRef.current = true;
  }, [
    state.tasks.length,
    uiState.modal,
    uiState.notificationModalQueue.length,
    uiState.emptyNuxDismissed
  ]);

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
    setTagFilterInput("");
    setTagFilterDraft(undefined);
    setActiveTagFilterBucket("all");
  }, [uiState.mode]);

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
    applyThemeWithSettings(activeThemeId, settingsState, {
      draft:
        uiState.mode === Mode.HELP && activeHelpPage === "custom1Edit"
          ? custom1Draft
          : undefined
    });
  }, [activeHelpPage, activeThemeId, custom1Draft, settingsState, uiState.mode]);

  useEffect(() => {
    if (skipSettingsSaveRef.current) {
      skipSettingsSaveRef.current = false;
      return;
    }
    saveSettingsDebounced(
      {
        themeId: settingsState.themeId,
        flashMode: settingsState.flashMode,
        notifications: settingsState.notifications,
        customThemes: settingsState.customThemes
      },
      150,
      settingsPath ? { filePath: settingsPath } : {}
    );
  }, [
    settingsPath,
    settingsState.customThemes,
    settingsState.flashMode,
    settingsState.notifications,
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
        savedViews: state.savedViews
      },
      350,
      undefined,
      undefined,
      handleSaveResult
    );
  }, [state.tasks, state.tagIndex, state.savedViews]);

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
    custom1Draft
  ]);

  function applyEscUnwind(): boolean {
    if (uiState.mode === Mode.HELP) {
      closeHelp();
      return true;
    }
    const next = unwind(uiState);
    if (!next) return false;
    if (uiState.mode === Mode.BACKUP_CENTER) {
      backupDispatch({ type: "reset" });
    }
    if (next.clearEditorDraft) {
      setTimeSuggestion(null);
      dispatch({ type: "setEditor", editor: null });
    }
    uiDispatch({
      type: "replace",
      state: next.clearEditorDraft
        ? { ...next.state, editorScrollOffset: 0 }
        : next.state
    });
    return true;
  }

  function openBackupError(message: string, error?: unknown) {
    backupDispatch({
      type: "setError",
      message,
      detail: error ? normalizeErrorDetail(error) : undefined
    });
  }

  async function refreshRuntimeStateFromDisk() {
    const dataPath = getResolvedDataPath();
    const stateResult = await loadStateStrict({ filePath: dataPath });
    dispatch({ type: "load", data: stateResult.data });
    const settingsResult = await loadSettings();
    settingsDispatch({ type: "setTheme", themeId: settingsResult.settings.themeId });
    settingsDispatch({
      type: "setFlashMode",
      flashMode: settingsResult.settings.flashMode
    });
    settingsDispatch({
      type: "setNotifications",
      notifications: settingsResult.settings.notifications
    });
    settingsDispatch({
      type: "setCustomThemes",
      customThemes: settingsResult.settings.customThemes
    });
  }

  function runBackupExportFlow() {
    if (backupState.screen === "exporting") return;
    backupDispatch({ type: "startExport" });
    void (async () => {
      try {
        const outputPath = await buildTimestampedBackupPath();
        const result = await exportBackup({
          outputPath,
          pretty: true
        });
        backupDispatch({ type: "exportSucceeded", outputPath: result.outputPath });
      } catch (error: unknown) {
        openBackupError("Export failed", error);
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

    if (mode === "replace" && !replaceConfirmed) {
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
        openBackupError("Dry-run failed", error);
      }
    })();
  }

  function runBackupImportCommitFlow() {
    if (!hasMatchingDryRun(backupState)) {
      openBackupError("Dry-run summary is required before commit.");
      return;
    }
    if (backupState.importMode === "replace" && !backupState.replaceConfirmed) {
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
        await refreshRuntimeStateFromDisk();
      } catch (error: unknown) {
        if (error instanceof BackupImportPartialError) {
          try {
            await refreshRuntimeStateFromDisk();
          } catch {
            // Best effort refresh for partial success paths.
          }
        }
        openBackupError("Import failed", error);
      }
    })();
  }

  function handleBackupMenuSelect(index: 0 | 1 | 2) {
    switch (index) {
      case 0:
        runBackupExportFlow();
        return;
      case 1:
        backupDispatch({ type: "openImportPath" });
        return;
      case 2:
        backupDispatch({ type: "showDataPath", path: getResolvedDataPath() });
        return;
      default:
        return;
    }
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
    switch (backupState.screen) {
      case "menu":
        handleBackupMenuSelect(backupState.menuIndex);
        return;
      case "export_done":
      case "import_done":
      case "show_path":
      case "error":
        backupDispatch({ type: "openMenu" });
        return;
      case "import_path":
        if (!backupState.importPathInput.trim()) {
          openBackupError("Import path is required.");
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
        runBackupImportCommitFlow();
        return;
      case "exporting":
      case "importing":
      default:
        return;
    }
  }

  function runRoutedAction(action: KeyRouterAction) {
    switch (action.type) {
      case "UNWIND":
        applyEscUnwind();
        return;
      case "DISMISS_EMPTY_NUX":
        uiDispatch({ type: "DISMISS_EMPTY_NUX" });
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
      case "BACKUP_SET_IMPORT_MODE":
        backupDispatch({ type: "setImportMode", mode: action.mode });
        return;
      case "OPEN_SEARCH":
        uiDispatch({ type: "setMode", mode: Mode.SEARCH });
        uiDispatch({ type: "setFocus", focus: FocusTarget.SEARCH_INPUT });
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
        moveDashboardTagSelection(action.delta);
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
      case "OPEN_ADD":
        openAdd();
        return;
      case "OPEN_EDIT":
        openEdit();
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
      case "OPEN_DELETE_CONFIRM":
        openDeleteConfirm();
        return;
      case "MODAL_CONFIRM_DELETE":
        handleDeleteSelected();
        return;
      case "MODAL_CONFIRM_DELETE_FUTURE":
        handleDeleteSelectedAndFuture();
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
      case "TOGGLE_TAG_FILTER":
        toggleTagFilter();
        return;
      case "APPLY_DASHBOARD_SELECTED_TAG":
        applyDashboardSelectedTag();
        return;
      case "SAVE_EDITOR":
        saveEditor();
        return;
      case "APPLY_TIME_AUTOCOMPLETE":
        if (
          uiState.mode === Mode.ADD &&
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

  useKeyboard((key) => {
    if (!terminalIsSupported) {
      if ((key.name ?? "") === "q") {
        void renderer.destroy();
      }
      return;
    }

    if (uiState.mode === Mode.HELP && activeHelpPage === "custom1Edit") {
      const handled = custom1EditorRef.current?.handleKey(key) ?? false;
      if (handled) {
        return;
      }
    }

    const actions = handleKey(
      {
        name: key.name ?? "",
        sequence: key.sequence ?? "",
        ctrl: key.ctrl === true,
        shift: key.shift === true
      },
      {
        uiState,
        hasTagInlineSuggestion: Boolean(tagInlineSuggestion),
        hasDueSuggestion: Boolean(dueSuggestion),
        timeAutocompleteStep,
        hasPendingGPrefix: pendingGPrefix,
        viewsOverlayOpen,
        saveViewPromptOpen,
        backupScreen: uiState.mode === Mode.BACKUP_CENTER ? backupState.screen : null,
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
  });

  function openHelp() {
    clearPendingGPrefix();
    setHelpExpandedBySection(createDefaultHelpExpandedState());
    helpFocusedSectionRef.current = 0;
    setHelpFocusedSectionIndex(0);
    helpScrollTopRef.current = 0;
    setHelpScrollOffset(0);
    setHelpNavStack(["help"]);
    setHelpNavSelection({ settings: 0, theme: 0, custom1: 0 });
    setHelpPreviewThemeMode(null);
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
  }

  function popHelpPage() {
    setHelpNavStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
    helpScrollTopRef.current = 0;
    setHelpScrollOffset(0);
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

  function saveCustom1Editor() {
    const objects = sanitizeDraftObjects(custom1DraftObjects);
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
  }

  function cycleThemeModeSetting() {
    settingsDispatch({ type: "cycleTheme" });
  }

  function switchFlashModeSetting() {
    const nextMode: FlashMode = settingsState.flashMode === "slow" ? "static" : "slow";
    settingsDispatch({ type: "toggleFlashMode" });
    showShortNavigationBanner(
      nextMode === "static" ? "Flash mode: static (overdue = red)" : "Flash mode: slow"
    );
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

  function openBackupCenter() {
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
    uiDispatch({ type: "setMode", mode: Mode.DASHBOARD });
    uiDispatch({ type: "setFocus", focus: FocusTarget.DASHBOARD });
  }

  function closeHelp() {
    if (helpNavStack[helpNavStack.length - 1] === "custom1Edit") {
      closeCustom1EditorCancel();
    }
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
    if (activeHelpPage === "theme") {
      setHelpNavSelection((prev) => ({ ...prev, theme: index }));
      return;
    }
    if (activeHelpPage === "custom1") {
      setHelpNavSelection((prev) => ({ ...prev, custom1: index }));
    }
  }

  function handleHelpNavForward() {
    if (activeHelpPage === "settings") {
      if (clampedHelpNavSelectionIndex === 0) pushHelpPage("theme");
      if (clampedHelpNavSelectionIndex === 1) switchFlashModeSetting();
      if (clampedHelpNavSelectionIndex === 2) switchNotificationsEnabledSetting();
      if (clampedHelpNavSelectionIndex === 3) switchInAppOverduePopupSetting();
      if (clampedHelpNavSelectionIndex === 4) switchTerminalBellSetting();
      return;
    }
    if (activeHelpPage === "theme") {
      if (clampedHelpNavSelectionIndex === 0) cycleThemeModeSetting();
      if (clampedHelpNavSelectionIndex === 1) pushHelpPage("custom1");
      return;
    }
    if (activeHelpPage === "custom1") {
      if (clampedHelpNavSelectionIndex === 0) {
        openCustom1Editor();
      }
    }
  }

  function handleHelpNavBack() {
    if (activeHelpPage === "custom1Edit") {
      closeCustom1EditorCancel();
      return;
    }
    popHelpPage();
  }

  function openListMode() {
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

  function openDashboardMode() {
    if (uiState.mode === Mode.DASHBOARD) return;
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
    uiDispatch({ type: "setMode", mode: Mode.DASHBOARD });
    uiDispatch({ type: "setFocus", focus: FocusTarget.DASHBOARD });
  }

  function openSearchMode() {
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
    setTagFilterInput("");
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
    setTagFilterInput("");
    setTagFilterDraft(undefined);
    setActiveTagFilterBucket("all");
    applyEscUnwind();
  }

  function clearTagFilterPanelDraft() {
    setTagFilterInput("");
    setTagFilterDraft(undefined);
  }

  function cycleTagFilterBucket(step: 1 | -1 = 1) {
    setActiveTagFilterBucket((current) => {
      const index = TAG_FILTER_BUCKET_ORDER.indexOf(current);
      const safeIndex = index >= 0 ? index : 0;
      return TAG_FILTER_BUCKET_ORDER[
        (safeIndex + step + TAG_FILTER_BUCKET_ORDER.length) % TAG_FILTER_BUCKET_ORDER.length
      ];
    });
  }

  function applyTagFilterPanel(includeInputCandidate = false) {
    const nextTagFilter = normalizeTagFilter(
      resolveTagFilterDraftForApply(includeInputCandidate)
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
    setTagFilterInput("");
    setTagFilterDraft(undefined);
    setActiveTagFilterBucket("all");
    applyEscUnwind();
  }

  function isEnterLikeKey(key: KeyEvent): boolean {
    return (
      key.name === "return" ||
      key.name === "enter" ||
      key.sequence === "\r" ||
      key.sequence === "\n"
    );
  }

  function resolveTagFilterInputCandidate(): string {
    return tagFilterInlineSuggestion?.full ?? tagFilterInput;
  }

  function resolveTagFilterDraftForApply(includeInputCandidate: boolean): TagFilter | undefined {
    if (!includeInputCandidate) return tagFilterDraft;
    return addTagToTagFilter(
      tagFilterDraft,
      resolveTagFilterInputCandidate(),
      activeTagFilterBucket
    );
  }

  function addTagFilterDraftCandidateFromInput(candidateOverride?: string): boolean {
    const candidate = candidateOverride ?? resolveTagFilterInputCandidate();
    const normalizedCandidate = normalizeTagToken(candidate);
    if (!normalizedCandidate) return false;

    setTagFilterDraft((current) =>
      addTagToTagFilter(current, normalizedCandidate, activeTagFilterBucket)
    );
    setTagFilterInput("");
    return true;
  }

  function handleTagFilterPanelInputKeyDown(key: KeyEvent) {
    const isEnter = isEnterLikeKey(key);
    const isCtrlEnter =
      (isEnter && key.ctrl) ||
      key.sequence === "\u001b[13;5u";

    if (key.name === "tab") {
      key.preventDefault();
      key.stopPropagation();
      cycleTagFilterBucket(key.shift ? -1 : 1);
      return;
    }

    if (key.name === "1" || key.sequence === "1") {
      key.preventDefault();
      key.stopPropagation();
      setActiveTagFilterBucket("all");
      return;
    }
    if (key.name === "2" || key.sequence === "2") {
      key.preventDefault();
      key.stopPropagation();
      setActiveTagFilterBucket("any");
      return;
    }
    if (key.name === "3" || key.sequence === "3") {
      key.preventDefault();
      key.stopPropagation();
      setActiveTagFilterBucket("none");
      return;
    }

    if (key.ctrl && key.name === "l") {
      key.preventDefault();
      key.stopPropagation();
      clearTagFilterPanelDraft();
      return;
    }

    if (key.name === "escape") {
      key.preventDefault();
      key.stopPropagation();
      closeTagFilterPanel();
      return;
    }

    if (isCtrlEnter) {
      key.preventDefault();
      key.stopPropagation();
      applyTagFilterPanel(true);
      return;
    }

    if (key.name === "right" && tagFilterInlineSuggestion) {
      key.preventDefault();
      key.stopPropagation();
      setTagFilterInput(formatTagForDisplay(tagFilterInlineSuggestion.full));
      return;
    }

    if (key.name === "backspace" && tagFilterInput.trim().length === 0) {
      key.preventDefault();
      key.stopPropagation();
      setTagFilterDraft((current) =>
        removeLastTagFromTagFilter(current, activeTagFilterBucket)
      );
      return;
    }

    if (isEnter) {
      key.preventDefault();
      key.stopPropagation();
      addTagFilterDraftCandidateFromInput();
    }
  }

  function handleLeftRailMenuSelect(item: LeftRailMenuItem) {
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

  function selectTaskById(taskId: string) {
    const targetExists = visibleTaskRows.some((task) => task.id === taskId);
    if (!targetExists) return;
    clearPendingGPrefix();
    dispatch({ type: "setSelected", id: taskId });
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

  function armPendingGPrefix() {
    clearPendingGPrefix();
    setPendingGPrefix(true);
    gPrefixTimerRef.current = setTimeout(() => {
      setPendingGPrefix(false);
      gPrefixTimerRef.current = null;
      cycleDue();
    }, G_PREFIX_TIMEOUT_MS);
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
        tag: nextFilters.tag,
        tagFilter: nextFilters.tagFilter,
        searchText: nextFilters.searchText
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
          tag: undefined,
          tagFilter: undefined,
          searchText: undefined
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

  function resolveSelectedOccurrenceContext(): {
    row: VisibleTaskRow;
    seriesTask: Task;
    seriesId: string;
    occurrenceIso: string;
    instanceTask?: Task;
  } | null {
    if (!selectedTask) return null;
    if (
      selectedTask.rowKind !== "series_occurrence_virtual" &&
      selectedTask.rowKind !== "series_occurrence_instance"
    ) {
      return null;
    }

    const normalizedIso = normalizeOccurrenceIso(selectedTask.occurrenceIso);
    const seriesId = selectedTask.seriesId;
    const seriesTask = findSeriesTaskBySeriesId(seriesId);

    if (!normalizedIso || !seriesId || !seriesTask) {
      return null;
    }

    const instanceTask =
      selectedTask.rowKind === "series_occurrence_instance"
        ? findTaskById(selectedTask.id)
        : findMaterializedInstance(seriesId, normalizedIso);

    return {
      row: selectedTask,
      seriesTask,
      seriesId,
      occurrenceIso: normalizedIso,
      instanceTask
    };
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
    const updated: Task = {
      ...persisted,
      status: nextStatus,
      updatedAt: nowMs,
      closedAt: nextStatus === "done" ? nowMs : undefined
    };
    dispatch({
      type: "setTasks",
      tasks: state.tasks.map((task) => (task.id === updated.id ? updated : task))
    });
  }

  function openAdd() {
    closeViewsOverlay();
    setTimeSuggestion(getSuggestedTime(new Date()));
    uiDispatch({ type: "setMode", mode: Mode.ADD });
    uiDispatch({ type: "setFocus", focus: FocusTarget.EDITOR_TITLE });
    uiDispatch({ type: "setEditorScrollOffset", scrollOffset: 0 });
    dispatch({
      type: "setEditor",
      editor: createEmptyDraft()
    });
  }

  function openEditOccurrence() {
    const context = resolveSelectedOccurrenceContext();
    if (!context) {
      showShortNavigationBanner("No recurring occurrence selected");
      return;
    }

    const occurrenceDate = parseLocalIsoToDate(context.occurrenceIso);
    if (!occurrenceDate) {
      showShortNavigationBanner("Invalid occurrence timestamp");
      return;
    }

    const editSource: Task = context.instanceTask
      ? context.instanceTask
      : {
          ...context.seriesTask,
          id: `occurrence:${context.seriesId}:${context.occurrenceIso}`,
          dueAt: occurrenceDate.getTime(),
          recurrence: undefined
        };
    const baseDraft = createDraftFromTask(editSource);

    closeViewsOverlay();
    setTimeSuggestion(null);
    uiDispatch({ type: "setMode", mode: Mode.EDIT });
    uiDispatch({ type: "setFocus", focus: FocusTarget.EDITOR_TITLE });
    uiDispatch({ type: "setEditorScrollOffset", scrollOffset: 0 });
    dispatch({
      type: "setEditor",
      editor: {
        ...baseDraft,
        id: context.instanceTask?.id,
        repeatMode: "off",
        repeatIntervalText: "1",
        repeatWeekdays: [],
        repeatMonthdayText: "",
        repeatEndMode: "never",
        repeatUntilText: "",
        repeatCountText: "",
        repeatCustomRRuleText: "",
        editKind: "occurrence",
        sourceTaskId: context.seriesTask.id,
        sourceSeriesId: context.seriesId,
        occurrenceIso: context.occurrenceIso
      }
    });
  }

  function openEditSeries() {
    if (!selectedTask) return;

    const seriesTask =
      selectedTask.rowKind === "series_occurrence_virtual" ||
      selectedTask.rowKind === "series_occurrence_instance"
        ? findSeriesTaskBySeriesId(selectedTask.seriesId)
        : selectedTask.recurrence
          ? resolvePersistedTaskForRow(selectedTask)
          : undefined;

    if (!seriesTask) {
      showShortNavigationBanner("No recurring series selected");
      return;
    }

    closeViewsOverlay();
    setTimeSuggestion(null);
    uiDispatch({ type: "setMode", mode: Mode.EDIT });
    uiDispatch({ type: "setFocus", focus: FocusTarget.EDITOR_TITLE });
    uiDispatch({ type: "setEditorScrollOffset", scrollOffset: 0 });
    dispatch({
      type: "setEditor",
      editor: {
        ...createDraftFromTask(seriesTask),
        editKind: "series",
        sourceTaskId: seriesTask.id,
        sourceSeriesId: seriesTask.recurrence?.series_id
      }
    });
  }

  function openEdit() {
    if (!selectedTask) return;
    if (
      selectedTask.rowKind === "series_occurrence_virtual" ||
      selectedTask.rowKind === "series_occurrence_instance"
    ) {
      openEditOccurrence();
      return;
    }

    const persisted = resolvePersistedTaskForRow(selectedTask);
    if (!persisted) return;
    closeViewsOverlay();
    setTimeSuggestion(null);
    uiDispatch({ type: "setMode", mode: Mode.EDIT });
    uiDispatch({ type: "setFocus", focus: FocusTarget.EDITOR_TITLE });
    uiDispatch({ type: "setEditorScrollOffset", scrollOffset: 0 });
    dispatch({
      type: "setEditor",
      editor: {
        ...createDraftFromTask(persisted),
        editKind: "regular"
      }
    });
  }

  function openDuplicate() {
    if (!selectedTask) return;
    const persisted = resolvePersistedTaskForRow(selectedTask);
    if (!persisted) return;
    closeViewsOverlay();
    const baseDraft = createDraftFromTask(persisted);
    const dueText = persisted.status === "done" ? formatDate(now) : baseDraft.dueText;
    const timeText = persisted.status === "done" ? "" : baseDraft.timeText;
    setTimeSuggestion(getSuggestedTime(new Date()));
    uiDispatch({ type: "setMode", mode: Mode.ADD });
    uiDispatch({ type: "setFocus", focus: FocusTarget.EDITOR_TITLE });
    uiDispatch({ type: "setEditorScrollOffset", scrollOffset: 0 });
    dispatch({
      type: "setEditor",
      editor: {
        ...baseDraft,
        id: undefined,
        dueText,
        timeText,
        editKind: "regular",
        sourceTaskId: undefined,
        sourceSeriesId: undefined,
        occurrenceIso: undefined
      }
    });
  }

  function cancelEditor() {
    clearPendingGPrefix();
    setTimeSuggestion(null);
    uiDispatch({ type: "setMode", mode: Mode.LIST });
    uiDispatch({ type: "setFocus", focus: FocusTarget.TASK_LIST });
    uiDispatch({ type: "setEditorScrollOffset", scrollOffset: 0 });
    dispatch({ type: "setEditor", editor: null });
  }

  function updateEditorDraft(patch: Partial<EditorDraft>) {
    if (!state.editor) return;
    const previousDraft = state.editor;
    const nextDraft: EditorDraft = {
      ...previousDraft,
      ...patch
    };
    const reconciledFocus = resolveEditorFocusAfterDraftChange(
      uiState.focus,
      previousDraft,
      nextDraft
    );
    if (reconciledFocus !== uiState.focus) {
      uiDispatch({ type: "setFocus", focus: reconciledFocus });
    }
    dispatch({ type: "updateEditor", patch });
  }

  function saveEditor() {
    if (!state.editor) return;
    const draft = state.editor;
    // Keep recurrence draft values in-memory; persistence is gated by repeatMode in buildRecurrenceFromDraft.
    const title = draft.title.trim();
    if (!title) return;

    const nowMs = Date.now();
    const timeText = draft.timeText.trim();
    const timeMinutes = timeText ? parseDueTime(timeText) : undefined;
    if (timeText && timeMinutes === undefined) {
      showShortNavigationBanner("Invalid time format (HH:mm)");
      return;
    }

    const { dueAt, hasExplicitTime } = combineDueDateTime(draft.dueText, timeText);
    const tags = normalizeTagsFromInput(draft.tagsText);
    const notes = draft.notes.trim() || undefined;

    if (uiState.mode === Mode.ADD) {
      const taskId = crypto.randomUUID();
      const recurrenceBuild = buildRecurrenceFromDraft(
        draft,
        dueAt,
        `series:${taskId}`
      );
      if (recurrenceBuild.error) {
        showShortNavigationBanner(recurrenceBuild.error);
        return;
      }

      const newTask: Task = {
        id: taskId,
        title,
        status: "open",
        createdAt: nowMs,
        updatedAt: nowMs,
        dueAt,
        hasExplicitTime,
        notes,
        tags,
        ...(recurrenceBuild.recurrence ? { recurrence: recurrenceBuild.recurrence } : {})
      };

      dispatch({ type: "setTasks", tasks: [...state.tasks, newTask] });
      dispatch({
        type: "setTagIndex",
        tagIndex: updateTagIndex(state.tagIndex, tags, nowMs)
      });
      dispatch({ type: "setSelected", id: newTask.id });
      uiDispatch({ type: "setMode", mode: Mode.LIST });
      uiDispatch({ type: "setFocus", focus: FocusTarget.TASK_LIST });
      uiDispatch({ type: "setEditorScrollOffset", scrollOffset: 0 });
      dispatch({ type: "setEditor", editor: null });
      return;
    }

    if (uiState.mode === Mode.EDIT) {
      if (draft.editKind === "occurrence") {
        const seriesId = draft.sourceSeriesId;
        const occurrenceIso = normalizeOccurrenceIso(draft.occurrenceIso);
        const seriesTask =
          findTaskById(draft.sourceTaskId) ?? findSeriesTaskBySeriesId(seriesId);

        if (!seriesId || !occurrenceIso || !seriesTask?.recurrence) {
          showShortNavigationBanner("Unable to edit occurrence");
          return;
        }

        let tasksWithSeriesExdate = withSeriesOccurrenceExcluded(
          state.tasks,
          seriesTask.id,
          occurrenceIso,
          nowMs
        );
        const withoutPreviousInstance = removeMaterializedOccurrenceInstance(
          tasksWithSeriesExdate,
          seriesId,
          occurrenceIso
        );

        const instanceId = draft.id ?? crypto.randomUUID();
        const existingInstance = draft.id ? findTaskById(draft.id) : undefined;
        const instance: Task = {
          id: instanceId,
          title,
          status: existingInstance?.status ?? "open",
          createdAt: existingInstance?.createdAt ?? nowMs,
          updatedAt: nowMs,
          dueAt,
          hasExplicitTime,
          closedAt: existingInstance?.status === "done" ? existingInstance.closedAt : undefined,
          notes,
          tags,
          instance_of: {
            series_id: seriesId,
            occurrence: occurrenceIso
          }
        };

        tasksWithSeriesExdate = [...withoutPreviousInstance, instance];
        dispatch({ type: "setTasks", tasks: tasksWithSeriesExdate });
        dispatch({
          type: "setTagIndex",
          tagIndex: updateTagIndex(state.tagIndex, tags, nowMs)
        });
        dispatch({ type: "setSelected", id: instanceId });
      } else if (draft.editKind === "series") {
        const seriesTask =
          findTaskById(draft.sourceTaskId ?? draft.id) ??
          findSeriesTaskBySeriesId(draft.sourceSeriesId);
        if (!seriesTask) {
          showShortNavigationBanner("Unable to edit recurring series");
          return;
        }

        const recurrenceBuild = buildRecurrenceFromDraft(
          draft,
          dueAt,
          seriesTask.recurrence?.series_id ?? draft.sourceSeriesId ?? `series:${seriesTask.id}`
        );
        if (recurrenceBuild.error) {
          showShortNavigationBanner(recurrenceBuild.error);
          return;
        }

        const updatedTasks = state.tasks.map((task) => {
          if (task.id !== seriesTask.id) return task;
          return {
            ...task,
            title,
            dueAt,
            hasExplicitTime,
            notes,
            tags,
            updatedAt: nowMs,
            recurrence: recurrenceBuild.recurrence
          };
        });
        dispatch({ type: "setTasks", tasks: updatedTasks });
        dispatch({
          type: "setTagIndex",
          tagIndex: updateTagIndex(state.tagIndex, tags, nowMs)
        });
        dispatch({ type: "setSelected", id: seriesTask.id });
      } else {
        const targetTask = draft.id ? findTaskById(draft.id) : undefined;
        if (!targetTask) return;

        const recurrenceBuild = buildRecurrenceFromDraft(
          draft,
          dueAt,
          targetTask.recurrence?.series_id ?? `series:${targetTask.id}`
        );
        if (recurrenceBuild.error) {
          showShortNavigationBanner(recurrenceBuild.error);
          return;
        }

        const updatedTasks = state.tasks.map((task) => {
          if (task.id !== targetTask.id) return task;
          return {
            ...task,
            title,
            dueAt,
            hasExplicitTime,
            notes,
            tags,
            updatedAt: nowMs,
            recurrence: recurrenceBuild.recurrence
          };
        });
        dispatch({ type: "setTasks", tasks: updatedTasks });
        dispatch({
          type: "setTagIndex",
          tagIndex: updateTagIndex(state.tagIndex, tags, nowMs)
        });
      }
    }

    uiDispatch({ type: "setMode", mode: Mode.LIST });
    uiDispatch({ type: "setFocus", focus: FocusTarget.TASK_LIST });
    uiDispatch({ type: "setEditorScrollOffset", scrollOffset: 0 });
    dispatch({ type: "setEditor", editor: null });
  }

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
    handleDeleteSelected();
  }

  function confirmDeleteSelectedAndFutureFromModal() {
    handleDeleteSelectedAndFuture();
  }

  function cancelDeleteSelectedFromModal() {
    applyEscUnwind();
  }

  function dismissEmptyNuxModal() {
    uiDispatch({ type: "DISMISS_EMPTY_NUX" });
  }

  function createTaskFromEmptyNuxModal() {
    uiDispatch({ type: "DISMISS_EMPTY_NUX" });
    openAdd();
  }

  function getActiveOverdueModalEvent(): TaskOverdueEvent | null {
    if (uiState.mode !== Mode.MODAL_CONFIRM) return null;
    if (!uiState.modal || uiState.modal.type !== "overdue") return null;
    return uiState.modal.event;
  }

  function handleOverdueModalSnooze() {
    const event = getActiveOverdueModalEvent();
    if (!event) return;
    const updatedTasks = applyOverdueSnooze(state.tasks, event, Date.now(), 10);
    dispatch({ type: "setTasks", tasks: updatedTasks });
    applyEscUnwind();
  }

  function handleOverdueModalDone() {
    const event = getActiveOverdueModalEvent();
    if (!event) return;
    const updatedTasks = applyOverdueMarkDone(state.tasks, event, Date.now());
    dispatch({ type: "setTasks", tasks: updatedTasks });
    applyEscUnwind();
  }

  function handleOverdueModalGoToTask() {
    const event = getActiveOverdueModalEvent();
    if (!event) return;

    openListMode();
    dispatch({
      type: "setFilters",
      filters: {
        status: "all",
        due: "any",
        tag: undefined,
        tagFilter: undefined,
        searchText: undefined
      }
    });

    const goToTarget = resolveGoToTaskTarget(state.tasks, event);
    const revealRows = buildVisibleTaskRows(
      state.tasks,
      {
        status: "all",
        due: "any",
        tag: undefined,
        tagFilter: undefined,
        searchText: undefined
      },
      state.sortMode,
      Date.now()
    );
    const selectedRow =
      revealRows.find((row) => row.id === goToTarget.preferredTaskId) ??
      (goToTarget.fallbackSourceTaskId
        ? revealRows.find((row) => row.sourceTaskId === goToTarget.fallbackSourceTaskId)
        : undefined) ??
      revealRows[0];
    if (selectedRow) {
      dispatch({ type: "setSelected", id: selectedRow.id });
    }
    showShortNavigationBanner(`Jumped to overdue task: ${event.title}`);
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

  function addTagToTagFilter(
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
    const bucketTags = new Set(next[bucket] ?? []);
    bucketTags.add(normalizedTag);
    next[bucket] = Array.from(bucketTags);
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
    dispatch({ type: "setFilters", filters: { due: next } });
  }

  function moveDashboardTagSelection(delta: 1 | -1) {
    if (uiState.mode !== Mode.DASHBOARD || dashboardTopTags.length === 0) return;
    setDashboardTagSelection((prev) => {
      const next = (prev + delta + dashboardTopTags.length) % dashboardTopTags.length;
      return next;
    });
  }

  function applyDashboardSelectedTag() {
    if (uiState.mode !== Mode.DASHBOARD) return;
    if (state.filters.status === "done" || state.filters.status === "archived") {
      showShortNavigationBanner("Top tags available for OPEN tasks only");
      return;
    }
    if (dashboardTopTags.length === 0) {
      showShortNavigationBanner("No tagged open tasks");
      return;
    }

    const selected = dashboardTopTags[clampedDashboardTagSelection];
    dispatch({
      type: "setFilters",
      filters: {
        tag: selected.tag,
        tagFilter: undefined
      }
    });
    showShortNavigationBanner(`Dashboard tag filter: ${formatTagForDisplay(selected.tag)}`);
  }

  function toggleBottomDueQuickFilter(targetDue: "overdue" | "today" | "next7") {
    const alreadyActive =
      state.filters.status === "open" && state.filters.due === targetDue;
    if (alreadyActive) {
      dispatch({ type: "setFilters", filters: { status: "all", due: "any" } });
      showShortNavigationBanner("Quick filter cleared");
      return;
    }

    dispatch({
      type: "setFilters",
      filters: {
        status: "open",
        due: targetDue
      }
    });
    showShortNavigationBanner(`Quick filter: OPEN + ${targetDue.toUpperCase()}`);
  }

  function toggleBottomCompletedQuickFilter() {
    const alreadyActive =
      state.filters.status === "done" && state.filters.due === "any";
    if (alreadyActive) {
      dispatch({ type: "setFilters", filters: { status: "all" } });
      showShortNavigationBanner("Quick filter cleared");
      return;
    }

    dispatch({
      type: "setFilters",
      filters: {
        status: "done",
        due: "any"
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
          ? `Tag filter (ALL): ${formatTagForDisplay(tag)}`
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
        : `Tag quick filter: ${formatTagForDisplay(tag)}`
    );
  }

  function toggleTagFilter() {
    const activeTags = Array.from(
      new Set(
        state.tasks
          .filter((task) => task.status === "open")
          .flatMap((task) => task.tags)
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
          backgroundColor: theme.accentPurple,
          padding: 1,
          border: true,
          borderStyle: "single",
          borderColor: theme.outline
        }}
      >
        <LeftRail
          mode={uiState.mode}
          focus={uiState.focus}
          filters={state.filters}
          sortMode={state.sortMode}
          fastPulseOn={fastPulseOn}
          flashMode={settingsState.flashMode}
          onMenuSelect={handleLeftRailMenuSelect}
          terminalWidth={terminalWidth}
          showLogo={showLogo}
          activeThemeId={settingsState.themeId === "rotating" ? activeThemeId : undefined}
        />
      </box>

      <box style={{ flexDirection: "column", flexGrow: 1 }}>
        <box
          style={{
            height: 4,
            backgroundColor: isDashboardMode ? theme.accentBlue : selectedHeaderBackground,
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "column",
            border: true,
            borderStyle: "single",
            borderColor: theme.outline
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
                backgroundColor: dashboardTheme.panel,
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
                backgroundColor: dashboardTheme.panel,
                border: true,
                borderStyle: "single",
                borderColor: dashboardTheme.outline
              }}
            >
              <DashboardPane
                tasks={visibleTaskRows}
                filters={state.filters}
                topTags={dashboardTopTags}
                selectedTopTagIndex={clampedDashboardTagSelection}
                now={now}
                width={dashboardPaneWidth}
                height={dashboardPaneHeight}
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
                  backgroundColor: taskListTheme.panel,
                  border: true,
                  borderStyle: "single",
                  borderColor: taskListTheme.outline
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
                    selectedId={state.selectedId}
                    now={now}
                    pulseOn={pulseOn}
                    fastPulseOn={fastPulseOn}
                    flashMode={settingsState.flashMode}
                    onSelectTask={selectTaskById}
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
                  backgroundColor: theme.panel,
                  border: true,
                  borderStyle: "single",
                  borderColor: theme.outline
                }}
              >
                {isEditorMode(uiState.mode) && state.editor ? (
                  <EditorPane
                    mode={uiState.mode}
                    draft={state.editor}
                    focus={toEditorFocus(uiState.focus)}
                    availableHeightLines={editorPaneHeightLines}
                    scrollOffset={uiState.editorScrollOffset}
                    tagInlineSuggestion={
                      uiState.focus === FocusTarget.EDITOR_TAGS ? tagInlineSuggestion : null
                    }
                    dueSuggestionHint={dueSuggestionHint}
                    timeSuggestionHint={timeSuggestionHint}
                    recurrencePreview={recurrencePreview}
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
                  />
                )}
              </box>
            </box>
          </box>
        )}

        {activeBanners.map((message, index) => {
          const isSaveFailure = message.startsWith("Save failed:");
          const isNavigationNotice = message.startsWith("No ");
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
            >
              <text style={{ color: notificationsTheme.bg }}>{message}</text>
            </box>
          );
        })}

        <box
          style={{
            height: 3,
            backgroundColor: theme.panel,
            border: true,
            borderStyle: "single",
            borderColor: theme.outline,
            justifyContent: "center",
            alignItems: "center"
          }}
        >
          {showTagTicker ? (
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

      {uiState.mode === Mode.MODAL_CONFIRM && uiState.modal ? (
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
          {uiState.modal.type === "delete" ? (
            uiState.modal.target === "regular_task" ? (
              <box style={{ padding: 2, backgroundColor: modalTheme.warn, color: modalTheme.bg }}>
                <text>DELETE SELECTED TASK? (y/n)</text>
                <text>{uiState.modal.taskTitle}</text>
                <text>ID: {uiState.modal.taskId.slice(0, 8)}</text>
                <box style={{ flexDirection: "row", gap: 1, marginTop: 1 }}>
                  <box
                    style={{
                      backgroundColor: modalTheme.bg,
                      paddingLeft: 2,
                      paddingRight: 2
                    }}
                    onMouseDown={(event) => {
                      if (event.button !== 0) return;
                      confirmDeleteSelectedFromModal();
                    }}
                  >
                    <text style={{ color: modalTheme.warn, fontWeight: "bold" }}>YES</text>
                  </box>
                  <box
                    style={{
                      backgroundColor: modalTheme.bg,
                      paddingLeft: 2,
                      paddingRight: 2
                    }}
                    onMouseDown={(event) => {
                      if (event.button !== 0) return;
                      cancelDeleteSelectedFromModal();
                    }}
                  >
                    <text style={{ color: modalTheme.warn, fontWeight: "bold" }}>NO</text>
                  </box>
                </box>
              </box>
            ) : (
              <box style={{ padding: 2, backgroundColor: modalTheme.warn, color: modalTheme.bg }}>
                <text>DELETE RECURRING OCCURRENCE?</text>
                <text>{uiState.modal.taskTitle}</text>
                <text>OCCURRENCE: {uiState.modal.occurrenceIso.slice(0, 16)}</text>
                <box style={{ flexDirection: "row", gap: 1, marginTop: 1 }}>
                  <box
                    style={{
                      backgroundColor: modalTheme.bg,
                      paddingLeft: 2,
                      paddingRight: 2
                    }}
                    onMouseDown={(event) => {
                      if (event.button !== 0) return;
                      confirmDeleteSelectedFromModal();
                    }}
                  >
                    <text style={{ color: modalTheme.warn, fontWeight: "bold" }}>
                      THIS EVENT [y]
                    </text>
                  </box>
                  <box
                    style={{
                      backgroundColor: modalTheme.bg,
                      paddingLeft: 2,
                      paddingRight: 2
                    }}
                    onMouseDown={(event) => {
                      if (event.button !== 0) return;
                      confirmDeleteSelectedAndFutureFromModal();
                    }}
                  >
                    <text style={{ color: modalTheme.warn, fontWeight: "bold" }}>
                      THIS + FUTURE [f]
                    </text>
                  </box>
                  <box
                    style={{
                      backgroundColor: modalTheme.bg,
                      paddingLeft: 2,
                      paddingRight: 2
                    }}
                    onMouseDown={(event) => {
                      if (event.button !== 0) return;
                      cancelDeleteSelectedFromModal();
                    }}
                  >
                    <text style={{ color: modalTheme.warn, fontWeight: "bold" }}>
                      CANCEL [n]
                    </text>
                  </box>
                </box>
              </box>
            )
          ) : uiState.modal.type === "emptyNux" ? (
            <EmptyNuxModal
              onClose={dismissEmptyNuxModal}
              onCreateTask={createTaskFromEmptyNuxModal}
            />
          ) : activeOverdueModal ? (
            <OverdueNotificationModal
              event={activeOverdueModal.event}
              task={activeOverdueTask}
              nowMs={now}
              onSnooze={handleOverdueModalSnooze}
              onDone={handleOverdueModalDone}
              onGoToTask={handleOverdueModalGoToTask}
              onDismiss={() => {
                applyEscUnwind();
              }}
            />
          ) : null}
        </box>
      ) : null}

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
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
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
            onInputChange={setTagFilterInput}
            onInputKeyDown={handleTagFilterPanelInputKeyDown}
            onInputSubmit={(value) => addTagFilterDraftCandidateFromInput(value)}
            onSetBucket={setActiveTagFilterBucket}
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
            onImportPathChange={(value) =>
              backupDispatch({ type: "setImportPath", value })
            }
            onReplaceConfirmChange={(value) =>
              backupDispatch({ type: "setReplaceConfirmInput", value })
            }
            onPrimaryAction={handleBackupPrimaryAction}
            onBackAction={handleBackupBackAction}
            onMenuSelect={handleBackupMenuSelect}
            onImportModeSelect={(mode) =>
              backupDispatch({ type: "setImportMode", mode })
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
                {APP_NAME} {APP_VERSION} · {APP_TAGLINE}
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
                  onCancel={closeCustom1EditorCancel}
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
                <scrollbox
                  scrollY
                  style={{
                    height: "100%",
                    minHeight: 0,
                    rootOptions: { backgroundColor: helpTheme.panel },
                    wrapperOptions: { backgroundColor: helpTheme.panel },
                    viewportOptions: { backgroundColor: helpTheme.panel },
                    contentOptions: { backgroundColor: helpTheme.panel }
                  }}
                >
                  <box style={{ flexDirection: "column", paddingRight: helpHasOverflow ? 1 : 0 }}>
                    {activeHelpPage === "settings" ? (
                      <>
                        <text style={{ color: helpTheme.muted }}>{helpThemeStatusLine.trim()}</text>
                        <text style={{ color: helpTheme.muted }}>{helpFlashStatusLine.trim()}</text>
                        <text style={{ color: helpTheme.muted }}>
                          {helpNotificationsEnabledStatusLine.trim()}
                        </text>
                        <text style={{ color: helpTheme.muted }}>
                          {helpInAppBannerStatusLine.trim()}
                        </text>
                        <text style={{ color: helpTheme.muted }}>
                          {helpTerminalBellStatusLine.trim()}
                        </text>
                      </>
                    ) : null}
                    {helpNavItems.map((item, index) => {
                      const focused = index === clampedHelpNavSelectionIndex;
                      const itemTitle =
                        activeHelpPage === "theme" && index === 0
                          ? helpThemeStatusLineRaw
                          : item.title;
                      return (
                        <box key={`${activeHelpPage}-${item.title}`}>
                          <box
                            style={{
                              flexDirection: "row",
                              backgroundColor: focused ? helpTheme.accentBlue : "transparent",
                              paddingLeft: 1,
                              paddingRight: 1
                            }}
                            onMouseDown={(event) => {
                              if (event.button !== 0) return;
                              setHelpNavSelectionForActivePage(index);
                              handleHelpNavForward();
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
                          </box>
                          <text style={{ color: helpTheme.muted }}>
                            {fitLineToWidth(`    ${item.description}`, helpContentLineWidth)}
                          </text>
                        </box>
                      );
                    })}
                  </box>
                </scrollbox>
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
    </box>
  );
}
