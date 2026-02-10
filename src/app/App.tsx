import React, { useEffect, useReducer, useRef, useState } from "react";
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react";
import { applyTheme, colorForTag, theme, layout } from "./theme";
import {
  getNextSelectedIdAfterDelete,
  nextEditorFocusTarget,
  toEditorFocus
} from "./uiState";
import { handleKey, type KeyRouterAction } from "./keyRouter";
import { TaskList } from "../components/TaskList";
import { DetailsPane } from "../components/DetailsPane";
import { EditorPane } from "../components/EditorPane";
import { LeftRail, type LeftRailMenuItem } from "../components/LeftRail";
import { DashboardPane } from "../components/DashboardPane";
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
  saveStateDebounced,
  type LoadedData,
  type SaveStateResult
} from "../state/persistence";
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
import { AppState, FocusTarget, Mode, SavedView, Task } from "../domain/models";
import { ROTATING_THEME_ORDER, THEMES, ThemeId } from "../theme/themes";
import {
  applySavedView,
  MAX_SAVED_VIEWS,
  saveViewByName,
  deleteViewAtIndex
} from "../domain/savedViews";
import { saveSettingsDebounced, type FlashMode } from "../settings/settings";
import { settingsReducer } from "../state/settingsStore";
import { isEditorMode } from "../ui/modeFocus";
import { initialUIState, uiReducer, unwind } from "../ui/state";
import { APP_VERSION } from "./version";
import { getTerminalSizeWarning, isTerminalSizeSupported } from "./layoutGuard";
import { APP_NAME, APP_TAGLINE, ENV_VARS } from "../brand/brand";

const TICKER_INTERVAL_MS = 6000;
const SLOW_PULSE_INTERVAL_MS = 2000;
const FAST_PULSE_INTERVAL_MS = 700;
const ROTATING_THEME_INTERVAL_MS = 15000;
const G_PREFIX_TIMEOUT_MS = 280;
const NAV_BANNER_TIMEOUT_MS = 1800;
const VIEW_NAME_MAX_LENGTH = 40;
const DASHBOARD_TOP_TAG_MIN = 5;
const DASHBOARD_TOP_TAG_MAX = 8;
const PERF_DEBUG_ENABLED = process.env[ENV_VARS.PERF_DEBUG] === "1";

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
  const tagLabel = filters.tag ? ` tag=#${filters.tag}` : "";
  return `status=${filters.status} due=${filters.due}${tagLabel}${searchLabel}`;
}

type AppProps = {
  initialData?: LoadedData;
  skipInitialSave?: boolean;
  startupBanner?: string;
  initialThemeId?: ThemeId;
  initialFlashMode?: FlashMode;
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
  settingsPath,
  showLogo = true
}: AppProps) {
  const renderer = useRenderer();
  const [state, dispatch] = useReducer(reducer, initialData, initState);
  const [settingsState, settingsDispatch] = useReducer(settingsReducer, {
    themeId: initialThemeId,
    flashMode: initialFlashMode
  });
  const [uiState, uiDispatch] = useReducer(uiReducer, initialUIState);
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
  const skipInitialSaveRef = useRef(skipInitialSave);
  const skipSettingsSaveRef = useRef(true);
  const lastSuccessfulSaveAtRef = useRef<number | undefined>(undefined);
  const gPrefixTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { height: terminalHeight, width: terminalWidth } = useTerminalDimensions();
  const terminalIsSupported = isTerminalSizeSupported(terminalWidth, terminalHeight);
  const terminalSizeWarning = getTerminalSizeWarning(terminalWidth, terminalHeight);

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
  const sortModeLabel = getSortModeLabel(state.sortMode);

  function findTaskById(taskId: string | undefined): Task | undefined {
    if (!taskId) return undefined;
    return state.tasks.find((task) => task.id === taskId);
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
  const isDashboardMode = uiState.mode === Mode.DASHBOARD;
  const selectedHeaderBackground = selectedOverdue
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
  const activeThemeId =
    settingsState.themeId === "rotating"
      ? ROTATING_THEME_ORDER[rotatingThemeIndex % ROTATING_THEME_ORDER.length]
      : settingsState.themeId;
  const activeThemeTokens = THEMES[activeThemeId];
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
    applyTheme(activeThemeId);
  }, [activeThemeId]);

  useEffect(() => {
    if (skipSettingsSaveRef.current) {
      skipSettingsSaveRef.current = false;
      return;
    }
    saveSettingsDebounced(
      {
        themeId: settingsState.themeId,
        flashMode: settingsState.flashMode
      },
      150,
      settingsPath ? { filePath: settingsPath } : {}
    );
  }, [settingsPath, settingsState.themeId, settingsState.flashMode]);

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

  function applyEscUnwind(): boolean {
    const next = unwind(uiState);
    if (!next) return false;
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

  function runRoutedAction(action: KeyRouterAction) {
    switch (action.type) {
      case "UNWIND":
        applyEscUnwind();
        return;
      case "TOGGLE_DASHBOARD":
        toggleDashboard();
        return;
      case "OPEN_HELP":
        openHelp();
        return;
      case "CLOSE_HELP":
        closeHelp();
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
          focus: nextEditorFocusTarget(uiState.focus, action.direction)
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
        settingsDispatch({ type: "cycleTheme" });
        return;
      case "TOGGLE_FLASH_MODE": {
        const nextMode: FlashMode = settingsState.flashMode === "slow" ? "static" : "slow";
        settingsDispatch({ type: "toggleFlashMode" });
        showShortNavigationBanner(
          nextMode === "static" ? "Flash mode: static (overdue = red)" : "Flash mode: slow"
        );
        return;
      }
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
        saveViewPromptOpen
      }
    );

    for (const action of actions) {
      runRoutedAction(action);
    }
  });

  function openHelp() {
    clearPendingGPrefix();
    uiDispatch({
      type: "captureReturnContext",
      mode: uiState.mode,
      focus: uiState.focus
    });
    uiDispatch({ type: "setMode", mode: Mode.HELP });
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
    uiDispatch({ type: "setMode", mode: uiState.previousMode });
    uiDispatch({ type: "setFocus", focus: uiState.previousFocus });
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

  function handleLeftRailMenuSelect(item: LeftRailMenuItem) {
    switch (item) {
      case "LIST":
        openListMode();
        return;
      case "DASHBOARD":
        openDashboardMode();
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
    if (selectedTask.rowKind === "series_occurrence_virtual") {
      showShortNavigationBanner("Use x to skip a recurring occurrence");
      return;
    }
    const persistedTask = resolvePersistedTaskForRow(selectedTask);
    if (!persistedTask) return;
    closeViewsOverlay();
    uiDispatch({
      type: "setModal",
      modal: {
        type: "delete",
        taskId: persistedTask.id,
        taskTitle: persistedTask.title,
        previousMode: Mode.LIST,
        previousFocus: uiState.focus
      }
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
    applyView(state.savedViews[slot]);
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

  function saveEditor() {
    if (!state.editor) return;
    const draft = state.editor;
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

  function handleDeleteSelected() {
    const modal = uiState.modal;
    if (!modal || modal.type !== "delete") return;
    const visibleIds = visibleTaskRows.map((task) => task.id);
    const nextSelectedId = getNextSelectedIdAfterDelete(visibleIds, modal.taskId);
    dispatch({
      type: "setTasks",
      tasks: state.tasks.filter((task) => task.id !== modal.taskId)
    });
    dispatch({ type: "setSelected", id: nextSelectedId });
    uiDispatch({ type: "setModal", modal: null });
    uiDispatch({ type: "setMode", mode: modal.previousMode });
    uiDispatch({ type: "setFocus", focus: modal.previousFocus });
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
    dispatch({ type: "setFilters", filters: { tag: selected.tag } });
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

  function toggleBottomTagQuickFilter(tag: string) {
    const alreadyActive = state.filters.tag === tag;
    dispatch({
      type: "setFilters",
      filters: { tag: alreadyActive ? undefined : tag }
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
      dispatch({ type: "setFilters", filters: { tag: undefined } });
      return;
    }

    const currentTag = state.filters.tag;
    const currentIndex = currentTag ? activeTags.indexOf(currentTag) : -1;
    const nextIndex = currentIndex + 1;

    if (nextIndex >= activeTags.length || currentIndex === -1) {
      dispatch({
        type: "setFilters",
        filters: { tag: currentIndex === -1 ? activeTags[0] : undefined }
      });
      return;
    }

    dispatch({ type: "setFilters", filters: { tag: activeTags[nextIndex] } });
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
                backgroundColor: theme.panel,
                paddingLeft: 3,
                paddingTop: 1
              }}
            >
              <text style={{ color: theme.muted }}>DASHBOARD</text>
            </box>
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
                  backgroundColor: theme.panel,
                  paddingLeft: 3,
                  paddingTop: 1
                }}
              >
                <text style={{ color: theme.muted }}>TASK LIST</text>
              </box>
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
                <box style={{ flexDirection: "column", flexGrow: 1 }}>
                  {uiState.mode === Mode.SEARCH ? (
                    <box style={{ flexDirection: "column", marginBottom: 1 }}>
                      <text style={{ color: theme.muted }}>SEARCH</text>
                      <input
                        value={state.filters.searchText ?? ""}
                        onChange={updateSearch}
                        focused={uiState.focus === FocusTarget.SEARCH_INPUT}
                        placeholder="Search for tasks and tags then press enter"
                        style={{ backgroundColor: theme.bg, color: theme.text }}
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
                    onUpdate={(patch) => dispatch({ type: "updateEditor", patch })}
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
                  ? theme.danger
                  : isNavigationNotice
                    ? theme.accentBlue
                    : theme.warn,
                paddingLeft: 1,
                paddingRight: 1
              }}
            >
              <text style={{ color: theme.bg }}>{message}</text>
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
                          color:
                            state.filters.tag === segment.tag ? theme.text : theme.bg,
                          fontWeight:
                            state.filters.tag === segment.tag ? "bold" : "normal"
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

      {uiState.mode === Mode.MODAL_CONFIRM && uiState.modal?.type === "delete" ? (
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
          <box style={{ padding: 2, backgroundColor: theme.warn, color: theme.bg }}>
            <text>DELETE SELECTED TASK? (y/n)</text>
            <text>{uiState.modal.taskTitle}</text>
            <text>ID: {uiState.modal.taskId.slice(0, 8)}</text>
          </box>
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
                  style={{ backgroundColor: theme.bg, color: theme.text }}
                />
                <text style={{ color: theme.muted }}>
                  Enter: save, Esc: cancel ({saveViewName.length}/{VIEW_NAME_MAX_LENGTH})
                </text>
              </box>
            ) : null}
          </box>
        </box>
      ) : null}

      {uiState.mode === Mode.HELP ? (
        <box
          style={{
            position: "absolute",
            top: 2,
            left: 10,
            padding: 2,
            backgroundColor: theme.accentBlue,
            color: theme.bg
          }}
        >
          <box style={{ flexDirection: "column" }}>
            <text>KEYBINDINGS</text>
            <text>j/k or arrows: move</text>
            <text>gg: top</text>
            <text>G: bottom</text>
            <text>ctrl+u / ctrl+d: page up/down</text>
            <text>[ ]: prev/next overdue</text>
            <text>{'{'} {'}'}: prev/next due today</text>
            <text>a: add</text>
            <text>e: edit (recurring occurrence => edit occurrence)</text>
            <text>E: edit recurring series</text>
            <text>c: copy</text>
            <text>space: toggle done</text>
            <text>x: skip selected recurring occurrence</text>
            <text>z: snooze selected recurring occurrence (+1 day)</text>
            <text>d: delete</text>
            <text>/: search</text>
            <text>b: toggle dashboard</text>
            <text>f: cycle status</text>
            <text>s: cycle sort ({sortModeLabel})</text>
            <text>DUE sort priority: OPEN+due first, then OPEN no-due, then DONE/ARCHIVED groups.</text>
            <text>g: cycle due</text>
            <text>t: tag filter</text>
            <text>Mouse: bottom bar buckets/tags toggle quick filters (click again to clear).</text>
            <text>v: views overlay</text>
            <text>ctrl+s: save current view</text>
            <text>1..9: apply view slot</text>
            <text>H: cycle theme</text>
            <text>M: toggle flash mode</text>
            <text>q: quit</text>
            <text>esc: close</text>
            <text>DASHBOARD</text>
            <text>Uses the same filtered dataset as TASK LIST.</text>
            <text>KPI STRIP: OVD(overdue), TOD(today), N7(next7), OPN(open), D7(done7d).</text>
            <text>KPI meters use Unicode block bars and compact to abbreviations on narrow widths.</text>
            <text>KPI colors: OVD/TOD/N7/OPN=blue, D7=green.</text>
            <text>D7 uses the current filtered set; status filters can reduce it to zero.</text>
            <text>Widgets: due buckets (OVD/TOD/+1..+6) and TOP TAGS (OPEN).</text>
            <text>In dashboard: b returns to list, f/g/t cycle shared filters.</text>
            <text>Top tags: up/down select row, Enter applies tag filter.</text>
            <text>App Version: {APP_VERSION}</text>
            <text>{APP_NAME}</text>
            <text>{APP_TAGLINE}</text>
            <text>License: PolyForm Noncommercial 1.0.0</text>
            <text>See ./LICENSE for full terms.</text>
            <text>Noncommercial use only (no selling or paid bundling).</text>
            <text>
              Theme:{" "}
              {settingsState.themeId === "rotating"
                ? `rotating (${activeThemeId})`
                : settingsState.themeId}
            </text>
            {settingsState.themeId === "rotating" ? (
              <text>Auto-rotate: every 15s</text>
            ) : null}
            <text>Flash mode: {settingsState.flashMode}</text>
            {settingsState.flashMode === "static" ? (
              <text>Static: overdue indicators are solid red.</text>
            ) : (
              <text>Slow: due-today and overdue indicators pulse.</text>
            )}
            <text>Recurring tasks: RRULE-based series with sparse occurrence materialization.</text>
            <text>Occurrence completion creates done history rows without closing the series.</text>
            <box style={{ flexDirection: "row", gap: 1, marginTop: 1 }}>
              <box
                style={{
                  backgroundColor: activeThemeTokens.accent,
                  paddingLeft: 1,
                  paddingRight: 1
                }}
              >
                <text style={{ color: activeThemeTokens.selectionText }}>ACCENT</text>
              </box>
              <box
                style={{
                  backgroundColor: activeThemeTokens.warn,
                  paddingLeft: 1,
                  paddingRight: 1
                }}
              >
                <text style={{ color: activeThemeTokens.selectionText }}>WARN</text>
              </box>
              <box
                style={{
                  backgroundColor: activeThemeTokens.ok,
                  paddingLeft: 1,
                  paddingRight: 1
                }}
              >
                <text style={{ color: activeThemeTokens.selectionText }}>OK</text>
              </box>
            </box>
            <text>Data file:</text>
            <text>{getDataFilePath()}</text>
            <text>DATA: IMPORT / EXPORT</text>
            <text>Resolved data path: {getDataFilePath()}</text>
            <text>tadoi export --out ./tadoi_export.json --pretty</text>
            <text>tadoi export --out ./tadoi_export_redacted.json --redact --pretty</text>
            <text>tadoi import --in ./tadoi_export.json --mode merge --dry-run</text>
            <text>tadoi import --in ./tadoi_export.json --mode merge --backup --pretty</text>
            <text>tadoi import --in ./tadoi_export.json --mode replace --backup --yes</text>
            <text>MERGE conflicts: newest updatedAt wins (then incoming tie-break).</text>
            <text>REPLACE overwrites local data; backups are created first.</text>
            <text>Use --redact before sharing exports.</text>
            <text style={{ marginTop: 1 }}>
              Vibe coded by Patrick Kazar and GPT-5.2-Codex
            </text>
          </box>
        </box>
      ) : null}
    </box>
  );
}
