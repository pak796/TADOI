import React, { useEffect, useReducer, useRef, useState } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { colorForTag, theme, layout } from "./theme";
import {
  getNextSelectedIdAfterDelete,
  isEditorMode,
  nextEditorFocusTarget,
  resolveModalAction,
  shouldCloseHelp,
  shouldCloseSearch,
  toEditorFocus
} from "./uiState";
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
};

function initState(data?: LoadedData): AppState {
  return {
    ...initialState,
    tasks: data?.tasks ?? [],
    tagIndex: data?.tagIndex ?? {}
  };
}

export function App({ initialData, skipInitialSave = false }: AppProps) {
  const [state, dispatch] = useReducer(reducer, initialData, initState);
  const [pulseOn, setPulseOn] = useState(false);
  const [fastPulseOn, setFastPulseOn] = useState(false);
  const [showTagTicker, setShowTagTicker] = useState(false);
  const [timeSuggestion, setTimeSuggestion] = useState<SuggestedTime | null>(null);
  const [helpReturnMode, setHelpReturnMode] = useState<Mode>("list");
  const [helpReturnFocus, setHelpReturnFocus] = useState<FocusTarget>("task_list");
  const skipInitialSaveRef = useRef(skipInitialSave);
  const [scrollOffset, setScrollOffset] = useState(0);
  const { height: terminalHeight, width: terminalWidth } = useTerminalDimensions();

  const now = Date.now();
  const dayKey = startOfLocalDayMs(now);
  const visibleTasks = getVisibleTasks(state, now);
  const selectedTask = visibleTasks.find((task) => task.id === state.selectedId) ?? visibleTasks[0];
  const selectedIndex = visibleTasks.findIndex((task) => task.id === state.selectedId);

  const listHeaderHeight = 2;
  const topBarHeight = 4;
  const bottomBarHeight = 3;
  const listPanelBorder = 2;
  const listPanelPadding = 2;
  const searchHeight = state.mode === "search" ? 3 : 0;
  const taskRowHeight = 3; // Keep in sync with TaskRow layout height.
  const listContentHeight =
    terminalHeight -
    topBarHeight -
    bottomBarHeight -
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
  const dueSuggestion =
    state.focus === "editor_due_date" && state.editor
      ? getDueSuggestion(state.editor.dueText, now)
      : null;
  const dueSuggestionHint = dueSuggestion ? `→ ${dueSuggestion} (press →)` : null;

  const timeAutocompleteStep =
    state.mode === "add" &&
    state.focus === "editor_due_time" &&
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
      setScrollOffset(0);
      return;
    }
    if (!state.selectedId || !visibleTasks.some((task) => task.id === state.selectedId)) {
      dispatch({ type: "setSelected", id: visibleTasks[0].id });
    }
  }, [visibleTasks, state.selectedId]);

  useEffect(() => {
    const clamped = clampScrollOffset(scrollOffset, visibleRows, visibleTasks.length);
    const nextOffset = ensureSelectedVisible({
      selectedIndex: selectedIndex === -1 ? 0 : selectedIndex,
      scrollOffset: clamped,
      visibleRows,
      itemCount: visibleTasks.length
    });
    if (nextOffset !== scrollOffset) {
      setScrollOffset(nextOffset);
    }
  }, [selectedIndex, visibleRows, visibleTasks.length, scrollOffset]);

  useKeyboard((key) => {
    const name = key.name ?? "";
    const sequence = key.sequence ?? "";
    const ctrl = key.ctrl === true;
    const shift = key.shift === true;

    switch (state.mode) {
      case "modal_confirm":
        handleModalKey(name, sequence);
        return;
      case "help":
        if (shouldCloseHelp(name, sequence)) {
          closeHelp();
        }
        return;
      case "search":
        if (shouldCloseSearch(name)) {
          closeSearch();
        }
        return;
      case "add":
      case "edit":
        handleEditorKey(name, sequence, ctrl, shift);
        return;
      default:
        handleListKey(name, sequence);
    }
  });

  function handleListKey(name: string, sequence: string) {
    if (sequence === "?") {
      openHelp();
      return;
    }

    if (name === "q") {
      process.exit(0);
    }

    if (name === "j" || name === "down") {
      moveSelection(1);
      return;
    }

    if (name === "k" || name === "up") {
      moveSelection(-1);
      return;
    }

    if (name === "space") {
      toggleSelected();
      return;
    }

    if (name === "a") {
      openAdd();
      return;
    }

    if (name === "e") {
      openEdit();
      return;
    }

    if (name === "c") {
      openDuplicate();
      return;
    }

    if (name === "d") {
      openDeleteConfirm();
      return;
    }

    if (name === "/") {
      dispatch({ type: "setMode", mode: "search" });
      dispatch({ type: "setFocus", focus: "search_input" });
      return;
    }

    if (name === "f") {
      cycleStatus();
      return;
    }

    if (name === "g") {
      cycleDue();
      return;
    }

    if (name === "t") {
      toggleTagFilter();
    }
  }

  function handleModalKey(name: string, sequence: string) {
    const action = resolveModalAction(name, sequence);
    if (action === "none") return;
    if (action === "confirm") {
      handleDeleteSelected();
      return;
    }
    closeModal();
  }

  function openHelp() {
    setHelpReturnMode(state.mode);
    setHelpReturnFocus(state.focus);
    dispatch({ type: "setMode", mode: "help" });
  }

  function closeHelp() {
    dispatch({ type: "setMode", mode: helpReturnMode });
    dispatch({ type: "setFocus", focus: helpReturnFocus });
  }

  function closeSearch() {
    dispatch({ type: "setMode", mode: "list" });
    dispatch({ type: "setFocus", focus: "task_list" });
  }

  function openDeleteConfirm() {
    if (!selectedTask) return;
    dispatch({
      type: "setModal",
      modal: {
        type: "delete",
        taskId: selectedTask.id,
        taskTitle: selectedTask.title,
        previousMode: "list",
        previousFocus: state.focus
      }
    });
    dispatch({ type: "setMode", mode: "modal_confirm" });
    dispatch({ type: "setFocus", focus: "modal" });
  }

  function closeModal() {
    if (!state.modal) {
      dispatch({ type: "setMode", mode: "list" });
      dispatch({ type: "setFocus", focus: "task_list" });
      return;
    }
    dispatch({ type: "setMode", mode: state.modal.previousMode });
    dispatch({ type: "setFocus", focus: state.modal.previousFocus });
    dispatch({ type: "setModal", modal: null });
  }

  function handleEditorKey(
    name: string,
    sequence: string,
    ctrl: boolean,
    shift: boolean
  ) {
    if (name === "escape") {
      cancelEditor();
      return;
    }

    if (ctrl && name === "s") {
      saveEditor();
      return;
    }

    if (name === "right") {
      if (
        state.focus === "editor_due_time" &&
        state.mode === "add" &&
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
          return;
        }
      }
      if (state.focus === "editor_due_date" && dueSuggestion) {
        dispatch({ type: "updateEditor", patch: { dueText: dueSuggestion } });
        return;
      }
      if (state.focus === "editor_tags" && tagInlineSuggestion) {
        handlePickTag(tagInlineSuggestion.full);
        return;
      }
    }

    if (name === "tab") {
      if (state.focus === "editor_tags" && tagInlineSuggestion) {
        const nextValue = replaceLastTagToken(
          state.editor?.tagsText ?? "",
          tagInlineSuggestion.full
        );
        dispatch({ type: "updateEditor", patch: { tagsText: nextValue } });
      }
      const direction: 1 | -1 = shift ? -1 : 1;
      dispatch({
        type: "setFocus",
        focus: nextEditorFocusTarget(state.focus, direction)
      });
      return;
    }

    if ((name === "return" || name === "enter") && state.focus === "editor_tags") {
      if (tagInlineSuggestion) {
        const nextValue = replaceLastTagToken(
          state.editor?.tagsText ?? "",
          tagInlineSuggestion.full
        );
        dispatch({ type: "updateEditor", patch: { tagsText: nextValue } });
        return;
      }
    }

    if ((name === "return" || name === "enter") && state.focus === "editor_save") {
      saveEditor();
      return;
    }

    if ((name === "return" || name === "enter") && state.focus === "editor_cancel") {
      cancelEditor();
    }

    if (sequence === "?" && state.mode !== "list") {
      openHelp();
    }
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
    dispatch({ type: "setMode", mode: "add" });
    dispatch({ type: "setEditor", editor: createEmptyDraft(), focus: "editor_title" });
  }

  function openEdit() {
    if (!selectedTask) return;
    setTimeSuggestion(null);
    dispatch({ type: "setMode", mode: "edit" });
    dispatch({
      type: "setEditor",
      editor: createDraftFromTask(selectedTask),
      focus: "editor_title"
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
    dispatch({ type: "setMode", mode: "add" });
    dispatch({
      type: "setEditor",
      editor: { ...baseDraft, id: undefined, dueText, timeText },
      focus: "editor_title"
    });
  }

  function cancelEditor() {
    setTimeSuggestion(null);
    dispatch({ type: "setMode", mode: "list" });
    dispatch({ type: "setFocus", focus: "task_list" });
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

    if (state.mode === "add") {
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

    if (state.mode === "edit" && state.editor.id) {
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

    dispatch({ type: "setMode", mode: "list" });
    dispatch({ type: "setFocus", focus: "task_list" });
    dispatch({ type: "setEditor", editor: null });
  }

  function handleDeleteSelected() {
    const modal = state.modal;
    if (!modal || modal.type !== "delete") return;
    const visibleIds = visibleTasks.map((task) => task.id);
    const nextSelectedId = getNextSelectedIdAfterDelete(visibleIds, modal.taskId);
    dispatch({
      type: "setTasks",
      tasks: state.tasks.filter((task) => task.id !== modal.taskId)
    });
    dispatch({ type: "setSelected", id: nextSelectedId });
    dispatch({ type: "setModal", modal: null });
    dispatch({ type: "setMode", mode: modal.previousMode });
    dispatch({ type: "setFocus", focus: modal.previousFocus });
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
          mode={state.mode}
          focus={state.focus}
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
                {state.mode === "search" ? (
                  <box style={{ flexDirection: "column", marginBottom: 1 }}>
                    <text style={{ color: theme.muted }}>SEARCH</text>
                <input
                  value={state.filters.searchText ?? ""}
                  onChange={updateSearch}
                  focused={state.focus === "search_input"}
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
                  scrollOffset={scrollOffset}
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
              {isEditorMode(state.mode) && state.editor ? (
                <EditorPane
                  mode={state.mode}
                  draft={state.editor}
                  focus={toEditorFocus(state.focus)}
                  tagInlineSuggestion={
                    state.focus === "editor_tags" ? tagInlineSuggestion : null
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

      {state.mode === "modal_confirm" && state.modal?.type === "delete" ? (
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
            <text>{state.modal.taskTitle}</text>
            <text>ID: {state.modal.taskId.slice(0, 8)}</text>
          </box>
        </box>
      ) : null}

      {state.mode === "help" ? (
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
            <text>q: quit</text>
            <text>esc: close</text>
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
