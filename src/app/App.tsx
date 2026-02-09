import React, { useEffect, useReducer, useRef, useState } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
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
import { LeftRail } from "../components/LeftRail";
import { diffLocalDays, startOfLocalDayMs } from "../domain/dates";
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
  getVisibleTasks,
  initialState,
  parseDueTime,
  reducer
} from "../state/store";
import {
  getDataFilePath,
  CURRENT_SCHEMA_VERSION,
  saveStateDebounced,
  type LoadedData
} from "../state/persistence";
import {
  formatTagForDisplay,
  getTagCompletion,
  normalizeTagPrefix,
  normalizeTagsFromInput,
  rankTags,
  updateTagIndex
} from "../domain/tagIndex";
import { AppState, FocusTarget, Mode, Task } from "../domain/models";
import { THEMES, ThemeId } from "../theme/themes";
import { saveSettingsDebounced } from "../settings/settings";
import { settingsReducer } from "../state/settingsStore";
import { isEditorMode } from "../ui/modeFocus";
import { initialUIState, uiReducer, unwind } from "../ui/state";
import { APP_VERSION } from "./version";

const TICKER_INTERVAL_MS = 6000;

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

type AppProps = {
  initialData?: LoadedData;
  skipInitialSave?: boolean;
  startupBanner?: string;
  initialThemeId?: ThemeId;
  settingsPath?: string;
};

function initState(data?: LoadedData): AppState {
  return {
    ...initialState,
    tasks: data?.tasks ?? [],
    tagIndex: data?.tagIndex ?? {}
  };
}

export function App({
  initialData,
  skipInitialSave = false,
  startupBanner,
  initialThemeId = "default",
  settingsPath
}: AppProps) {
  const [state, dispatch] = useReducer(reducer, initialData, initState);
  const [settingsState, settingsDispatch] = useReducer(settingsReducer, {
    themeId: initialThemeId
  });
  const [uiState, uiDispatch] = useReducer(uiReducer, initialUIState);
  const [pulseOn, setPulseOn] = useState(false);
  const [fastPulseOn, setFastPulseOn] = useState(false);
  const [showTagTicker, setShowTagTicker] = useState(false);
  const [timeSuggestion, setTimeSuggestion] = useState<SuggestedTime | null>(null);
  const skipInitialSaveRef = useRef(skipInitialSave);
  const skipSettingsSaveRef = useRef(true);
  const { height: terminalHeight, width: terminalWidth } = useTerminalDimensions();

  const now = Date.now();
  const dayKey = startOfLocalDayMs(now);
  const visibleTasks = getVisibleTasks(state, now);
  const selectedTask = visibleTasks.find((task) => task.id === state.selectedId) ?? visibleTasks[0];
  const computedSelectedIndex = visibleTasks.findIndex((task) => task.id === state.selectedId);

  const listHeaderHeight = 2;
  const topBarHeight = 4;
  const bottomBarHeight = 3;
  const startupBannerHeight = startupBanner ? 1 : 0;
  const listPanelBorder = 2;
  const listPanelPadding = 2;
  const searchHeight = uiState.mode === Mode.SEARCH ? 3 : 0;
  const taskRowHeight = 3; // Keep in sync with TaskRow layout height.
  const listContentHeight =
    terminalHeight -
    topBarHeight -
    bottomBarHeight -
    startupBannerHeight -
    listHeaderHeight -
    listPanelBorder -
    listPanelPadding -
    searchHeight;
  const visibleLines = Math.max(1, listContentHeight);
  const visibleRows = Math.max(1, Math.floor(visibleLines / taskRowHeight));
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

  const summary = state.tasks.reduce(
    (acc, task) => {
      if (task.status === "open" && task.dueAt !== undefined) {
        const dayDiff = diffLocalDays(task.dueAt, startOfToday);
        const timeOverdue =
          task.hasExplicitTime === true && dayDiff === 0 && now > task.dueAt;
        if (dayDiff < 0 || timeOverdue) {
          acc.overdue += 1;
        } else if (dayDiff === 0) {
          acc.today += 1;
        } else if (dayDiff >= 1 && dayDiff <= 7) {
          acc.next7 += 1;
        }
      }

      if (task.status === "done") {
        const closedAt = task.closedAt ?? task.updatedAt;
        const closedDiff = diffLocalDays(closedAt, startOfToday);
        if (closedDiff <= 0 && closedDiff >= -6) {
          acc.completed7 += 1;
        }
      }
      return acc;
    },
    { overdue: 0, today: 0, next7: 0, completed7: 0 }
  );

  const tagStats = React.useMemo(
    () => computeTopTagStats(state.tasks, dayKey, 5),
    [state.tasks, dayKey]
  );

  const bottomBarWidth = Math.max(0, terminalWidth - layout.railWidth);
  const bottomBarContentWidth = Math.max(0, bottomBarWidth - 2);
  const tagTickerSegments = React.useMemo(
    () => buildTagTickerSegments(tagStats, bottomBarContentWidth),
    [tagStats, bottomBarContentWidth]
  );

  const tagQuery = state.editor ? getTagQuery(state.editor.tagsText) : null;
  const tagSuggestions = tagQuery ? rankTags(state.tagIndex, tagQuery) : [];
  const tagInlineSuggestion = tagQuery
    ? getTagCompletion(tagQuery, tagSuggestions)
    : null;
  const activeThemeTokens = THEMES[settingsState.themeId];
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

  useEffect(() => {
    const id = setInterval(() => {
      const { data, changed } = applyArchiveAging(
        {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          tasks: state.tasks,
          tagIndex: state.tagIndex
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
    const id = setInterval(() => {
      setPulseOn((prev) => !prev);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setFastPulseOn((prev) => !prev);
    }, 700);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setShowTagTicker((prev) => !prev);
    }, TICKER_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    applyTheme(settingsState.themeId);
  }, [settingsState.themeId]);

  useEffect(() => {
    if (skipSettingsSaveRef.current) {
      skipSettingsSaveRef.current = false;
      return;
    }
    saveSettingsDebounced(
      { themeId: settingsState.themeId },
      150,
      settingsPath ? { filePath: settingsPath } : {}
    );
  }, [settingsPath, settingsState.themeId]);

  useEffect(() => {
    if (skipInitialSaveRef.current) {
      skipInitialSaveRef.current = false;
      return;
    }
    saveStateDebounced({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      tasks: state.tasks,
      tagIndex: state.tagIndex
    });
  }, [state.tasks, state.tagIndex]);

  useEffect(() => {
    if (visibleTasks.length === 0) {
      if (state.selectedId) {
        dispatch({ type: "setSelected", id: undefined });
      }
      uiDispatch({ type: "setScrollOffset", scrollOffset: 0 });
      return;
    }
    if (!state.selectedId || !visibleTasks.some((task) => task.id === state.selectedId)) {
      dispatch({ type: "setSelected", id: visibleTasks[0].id });
    }
  }, [visibleTasks, state.selectedId]);

  useEffect(() => {
    const safeIndex =
      visibleTasks.length === 0
        ? 0
        : computedSelectedIndex === -1
          ? 0
          : computedSelectedIndex;
    if (uiState.selectedIndex !== safeIndex) {
      uiDispatch({ type: "setSelectedIndex", selectedIndex: safeIndex });
    }
  }, [computedSelectedIndex, uiState.selectedIndex, visibleTasks.length]);

  useEffect(() => {
    const clamped = clampScrollOffset(
      uiState.scrollOffset,
      visibleRows,
      visibleTasks.length
    );
    const nextOffset = ensureSelectedVisible({
      selectedIndex: uiState.selectedIndex,
      scrollOffset: clamped,
      visibleRows,
      itemCount: visibleTasks.length
    });
    if (nextOffset !== uiState.scrollOffset) {
      uiDispatch({ type: "setScrollOffset", scrollOffset: nextOffset });
    }
  }, [uiState.scrollOffset, uiState.selectedIndex, visibleRows, visibleTasks.length]);

  function applyEscUnwind(): boolean {
    const next = unwind(uiState);
    if (!next) return false;
    if (next.clearEditorDraft) {
      setTimeSuggestion(null);
      dispatch({ type: "setEditor", editor: null });
    }
    uiDispatch({ type: "replace", state: next.state });
    return true;
  }

  function runRoutedAction(action: KeyRouterAction) {
    switch (action.type) {
      case "UNWIND":
        applyEscUnwind();
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
      case "CYCLE_THEME":
        settingsDispatch({ type: "cycleTheme" });
        return;
      case "EXIT_APP":
        process.exit(0);
        return;
      case "MOVE_SELECTION":
        moveSelection(action.delta);
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
      case "OPEN_DUPLICATE":
        openDuplicate();
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
      case "CYCLE_DUE":
        cycleDue();
        return;
      case "TOGGLE_TAG_FILTER":
        toggleTagFilter();
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
        timeAutocompleteStep
      }
    );

    for (const action of actions) {
      runRoutedAction(action);
    }
  });

  function openHelp() {
    uiDispatch({
      type: "captureReturnContext",
      mode: uiState.mode,
      focus: uiState.focus
    });
    uiDispatch({ type: "setMode", mode: Mode.HELP });
  }

  function closeHelp() {
    uiDispatch({ type: "setMode", mode: uiState.previousMode });
    uiDispatch({ type: "setFocus", focus: uiState.previousFocus });
  }

  function closeSearch() {
    uiDispatch({ type: "setMode", mode: Mode.LIST });
    uiDispatch({ type: "setFocus", focus: FocusTarget.TASK_LIST });
  }

  function openDeleteConfirm() {
    if (!selectedTask) return;
    uiDispatch({
      type: "setModal",
      modal: {
        type: "delete",
        taskId: selectedTask.id,
        taskTitle: selectedTask.title,
        previousMode: Mode.LIST,
        previousFocus: uiState.focus
      }
    });
    uiDispatch({ type: "setMode", mode: Mode.MODAL_CONFIRM });
    uiDispatch({ type: "setFocus", focus: FocusTarget.MODAL });
  }

  function moveSelection(delta: number) {
    if (visibleTasks.length === 0) return;
    const currentIndex = visibleTasks.findIndex((task) => task.id === state.selectedId);
    const safeIndex = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex = (safeIndex + delta + visibleTasks.length) % visibleTasks.length;
    dispatch({ type: "setSelected", id: visibleTasks[nextIndex].id });
  }

  function toggleSelected() {
    if (!selectedTask) return;
    const now = Date.now();
    const nextStatus = selectedTask.status === "done" ? "open" : "done";
    const updated: Task = {
      ...selectedTask,
      status: nextStatus,
      updatedAt: now,
      closedAt: nextStatus === "done" ? now : undefined
    };
    dispatch({
      type: "setTasks",
      tasks: state.tasks.map((task) => (task.id === updated.id ? updated : task))
    });
  }

  function openAdd() {
    setTimeSuggestion(getSuggestedTime(new Date()));
    uiDispatch({ type: "setMode", mode: Mode.ADD });
    uiDispatch({ type: "setFocus", focus: FocusTarget.EDITOR_TITLE });
    dispatch({
      type: "setEditor",
      editor: createEmptyDraft()
    });
  }

  function openEdit() {
    if (!selectedTask) return;
    setTimeSuggestion(null);
    uiDispatch({ type: "setMode", mode: Mode.EDIT });
    uiDispatch({ type: "setFocus", focus: FocusTarget.EDITOR_TITLE });
    dispatch({
      type: "setEditor",
      editor: createDraftFromTask(selectedTask)
    });
  }

  function openDuplicate() {
    if (!selectedTask) return;
    const baseDraft = createDraftFromTask(selectedTask);
    const dueText =
      selectedTask.status === "done"
        ? formatDate(now)
        : baseDraft.dueText;
    const timeText = selectedTask.status === "done" ? "" : baseDraft.timeText;
    setTimeSuggestion(getSuggestedTime(new Date()));
    uiDispatch({ type: "setMode", mode: Mode.ADD });
    uiDispatch({ type: "setFocus", focus: FocusTarget.EDITOR_TITLE });
    dispatch({
      type: "setEditor",
      editor: { ...baseDraft, id: undefined, dueText, timeText }
    });
  }

  function cancelEditor() {
    setTimeSuggestion(null);
    uiDispatch({ type: "setMode", mode: Mode.LIST });
    uiDispatch({ type: "setFocus", focus: FocusTarget.TASK_LIST });
    dispatch({ type: "setEditor", editor: null });
  }

  function saveEditor() {
    if (!state.editor) return;
    const title = state.editor.title.trim();
    if (!title) return;

    const now = Date.now();
    const timeText = state.editor.timeText.trim();
    const timeMinutes = timeText ? parseDueTime(timeText) : undefined;
    if (timeText && timeMinutes === undefined) {
      return;
    }
    const { dueAt, hasExplicitTime } = combineDueDateTime(
      state.editor.dueText,
      timeText
    );
    const tags = normalizeTagsFromInput(state.editor.tagsText);
    const notes = state.editor.notes.trim() || undefined;

    if (uiState.mode === Mode.ADD) {
      const newTask: Task = {
        id: crypto.randomUUID(),
        title,
        status: "open",
        createdAt: now,
        updatedAt: now,
        dueAt,
        hasExplicitTime,
        notes,
        tags
      };
      dispatch({ type: "setTasks", tasks: [...state.tasks, newTask] });
      dispatch({
        type: "setTagIndex",
        tagIndex: updateTagIndex(state.tagIndex, tags, now)
      });
      dispatch({ type: "setSelected", id: newTask.id });
    }

    if (uiState.mode === Mode.EDIT && state.editor.id) {
      const updatedTasks = state.tasks.map((task) => {
        if (task.id !== state.editor?.id) return task;
        return {
          ...task,
          title,
          dueAt,
          hasExplicitTime,
          notes,
          tags,
          updatedAt: now
        };
      });
      dispatch({ type: "setTasks", tasks: updatedTasks });
      dispatch({
        type: "setTagIndex",
        tagIndex: updateTagIndex(state.tagIndex, tags, now)
      });
    }

    uiDispatch({ type: "setMode", mode: Mode.LIST });
    uiDispatch({ type: "setFocus", focus: FocusTarget.TASK_LIST });
    dispatch({ type: "setEditor", editor: null });
  }

  function handleDeleteSelected() {
    const modal = uiState.modal;
    if (!modal || modal.type !== "delete") return;
    const visibleIds = visibleTasks.map((task) => task.id);
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

  function toggleTagFilter() {
    if (!selectedTask || selectedTask.tags.length === 0) {
      dispatch({ type: "setFilters", filters: { tag: undefined } });
      return;
    }

    const tags = selectedTask.tags;
    const currentTag = state.filters.tag;
    const currentIndex = currentTag ? tags.indexOf(currentTag) : -1;
    const nextIndex = currentIndex + 1;

    if (nextIndex >= tags.length || currentIndex === -1) {
      dispatch({
        type: "setFilters",
        filters: { tag: currentIndex === -1 ? tags[0] : undefined }
      });
      return;
    }

    dispatch({ type: "setFilters", filters: { tag: tags[nextIndex] } });
  }

  function updateSearch(value: string) {
    dispatch({ type: "setFilters", filters: { searchText: value } });
  }

  function handlePickTag(tag: string) {
    if (!state.editor) return;
    const nextValue = replaceLastTagToken(state.editor.tagsText, tag);
    dispatch({ type: "updateEditor", patch: { tagsText: nextValue } });
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
          fastPulseOn={fastPulseOn}
        />
      </box>

      <box style={{ flexDirection: "column", flexGrow: 1 }}>
        <box
          style={{
            height: 4,
            backgroundColor: selectedOverdue
              ? fastPulseOn
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
                      : theme.accentOrange,
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
              {selectedTask ? selectedTask.title.toUpperCase() : "NO TASK SELECTED"}
            </text>
          </box>
          <box style={{ width: "100%", justifyContent: "center", alignItems: "center" }}>
            <text
              style={{
                color: theme.bg,
                fontWeight: "bold"
              }}
            >
              {selectedTask ? getDueInLabel(selectedTask, now) : ""}
            </text>
          </box>
        </box>

          <box style={{ flexDirection: "row", flexGrow: 1 }}>
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
                  tasks={visibleTasks}
                  selectedId={state.selectedId}
                  now={now}
                  pulseOn={pulseOn}
                  fastPulseOn={fastPulseOn}
                  scrollOffset={uiState.scrollOffset}
                  visibleRows={visibleRows}
                  visibleLines={visibleLines}
                />
              </box>
            </box>
          </box>

          <box style={{ flexDirection: "column", width: layout.rightWidth }}>
            <box
              style={{
                backgroundColor: theme.panel,
                paddingLeft: 3,
                paddingTop: 1
              }}
            >
              <text style={{ color: theme.muted }}>DETAILS</text>
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
              {isEditorMode(uiState.mode) && state.editor ? (
                <EditorPane
                  mode={uiState.mode}
                  draft={state.editor}
                  focus={toEditorFocus(uiState.focus)}
                  tagInlineSuggestion={
                    uiState.focus === FocusTarget.EDITOR_TAGS ? tagInlineSuggestion : null
                  }
                  dueSuggestionHint={dueSuggestionHint}
                  timeSuggestionHint={timeSuggestionHint}
                  onUpdate={(patch) => dispatch({ type: "updateEditor", patch })}
                  onSave={saveEditor}
                  onCancel={cancelEditor}
                />
              ) : (
                <DetailsPane
                  task={selectedTask}
                  now={now}
                  pulseOn={pulseOn}
                  fastPulseOn={fastPulseOn}
                />
              )}
            </box>
          </box>
        </box>

        {startupBanner ? (
          <box
            style={{
              height: 1,
              backgroundColor: theme.warn,
              paddingLeft: 1,
              paddingRight: 1
            }}
          >
            <text style={{ color: theme.bg }}>{startupBanner}</text>
          </box>
        ) : null}

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
                    >
                      <text style={{ color: theme.bg }}>
                        {segment.total} {segment.displayTag}
                      </text>
                    </box>
                  </box>
                ))
              )}
            </box>
          ) : (
            <box style={{ flexDirection: "row", gap: 2 }}>
              <box style={{ backgroundColor: theme.warn, paddingLeft: 1, paddingRight: 1 }}>
                <text style={{ color: theme.bg }}>{summary.overdue} OVERDUE</text>
              </box>
              <box style={{ backgroundColor: theme.dueSoon, paddingLeft: 1, paddingRight: 1 }}>
                <text style={{ color: theme.bg }}>{summary.today} DUE TODAY</text>
              </box>
              <box style={{ backgroundColor: theme.dueLater, paddingLeft: 1, paddingRight: 1 }}>
                <text style={{ color: theme.bg }}>{summary.next7} DUE THIS WEEK</text>
              </box>
              <box style={{ backgroundColor: theme.ok, paddingLeft: 1, paddingRight: 1 }}>
                <text style={{ color: theme.bg }}>
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
            <text>a: add</text>
            <text>e: edit</text>
            <text>c: copy</text>
            <text>space: toggle done</text>
            <text>d: delete</text>
            <text>/: search</text>
            <text>f: cycle status</text>
            <text>g: cycle due</text>
            <text>t: tag filter</text>
            <text>H: cycle theme</text>
            <text>q: quit</text>
            <text>esc: close</text>
            <text>App Version: {APP_VERSION}</text>
            <text>Theme: {settingsState.themeId}</text>
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
            <text style={{ marginTop: 1 }}>
              Vibe coded by Patrick Kazar and GPT-5.2-Codex
            </text>
          </box>
        </box>
      ) : null}
    </box>
  );
}
