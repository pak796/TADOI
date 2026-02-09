import React, { useEffect, useReducer, useRef, useState } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { theme, layout } from "./theme";
import { TaskList } from "../components/TaskList";
import { DetailsPane } from "../components/DetailsPane";
import { EditorPane } from "../components/EditorPane";
import { LeftRail } from "../components/LeftRail";
import { diffLocalDays, startOfLocalDayMs } from "../domain/dates";
import { ensureSelectedVisible } from "../domain/scroll";
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
  normalizeTagQuery,
  normalizeTagsFromInput,
  rankTags,
  updateTagIndex
} from "../domain/tagIndex";
import { AppState, EditorFocus, Task } from "../domain/models";

const focusOrder: EditorFocus[] = [
  "title",
  "due",
  "time",
  "tags",
  "notes",
  "save",
  "cancel"
];

function nextFocus(current: EditorFocus, direction: 1 | -1): EditorFocus {
  const index = focusOrder.indexOf(current);
  const nextIndex = (index + direction + focusOrder.length) % focusOrder.length;
  return focusOrder[nextIndex];
}

function getTagQuery(tagsText: string): string | null {
  const tokens = tagsText.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const lastToken = tokens[tokens.length - 1];
  if (!lastToken.startsWith("#")) return null;
  return normalizeTagQuery(lastToken.slice(1));
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

function replaceLastTagToken(tagsText: string, tag: string): string {
  const tokens = tagsText.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return `#${tag}`;
  }
  tokens[tokens.length - 1] = `#${tag}`;
  return `${tokens.join(" ")} `;
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
  const skipInitialSaveRef = useRef(skipInitialSave);
  const [scrollOffset, setScrollOffset] = useState(0);
  const { height: terminalHeight } = useTerminalDimensions();

  const now = Date.now();
  const visibleTasks = getVisibleTasks(state, now);
  const selectedTask = visibleTasks.find((task) => task.id === state.selectedId) ?? visibleTasks[0];
  const selectedIndex = visibleTasks.findIndex((task) => task.id === state.selectedId);

  const listHeaderHeight = 2;
  const topBarHeight = 4;
  const bottomBarHeight = 3;
  const listPanelBorder = 2;
  const listPanelPadding = 2;
  const searchHeight = state.searchActive ? 3 : 0;
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
  const startOfToday = startOfLocalDayMs(now);
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

  const tagQuery = state.editor ? getTagQuery(state.editor.tagsText) : null;
  const tagSuggestions = tagQuery !== null ? rankTags(state.tagIndex, tagQuery) : [];
  const tagSuggestionActive = tagQuery !== null && tagSuggestions.length > 0;
  const tagInlineSuggestion =
    tagQuery !== null && tagSuggestions.length > 0 && tagSuggestions[0] !== tagQuery
      ? tagSuggestions[0]
      : null;
  const tagSuggestionHint =
    state.editorFocus === "tags" && tagInlineSuggestion
      ? `→ #${tagInlineSuggestion} (press →)`
      : null;
  const dueSuggestion =
    state.editorFocus === "due" && state.editor
      ? getDueSuggestion(state.editor.dueText, now)
      : null;
  const dueSuggestionHint = dueSuggestion ? `→ ${dueSuggestion} (press →)` : null;

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
    if (visibleTasks.length === 0) {
      if (scrollOffset !== 0) setScrollOffset(0);
      return;
    }
    const nextOffset = ensureSelectedVisible({
      selectedIndex: selectedIndex === -1 ? 0 : selectedIndex,
      scrollOffset,
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

    if (state.helpOpen) {
      if (name === "escape" || sequence === "?") {
        dispatch({ type: "setHelpOpen", value: false });
      }
      return;
    }

    if (state.confirmDelete) {
      if (sequence === "y" || name === "y") {
        handleDeleteSelected();
      }
      if (sequence === "n" || name === "n" || name === "escape") {
        dispatch({ type: "setConfirmDelete", value: false });
      }
      return;
    }

    if (state.mode !== "list") {
      handleEditorKey(name, sequence, key.ctrl === true, key.shift === true);
      return;
    }

    if (state.searchActive) {
      if (name === "escape" || name === "return" || name === "enter") {
        dispatch({ type: "setSearchActive", value: false });
      }
      return;
    }

    if (sequence === "?") {
      dispatch({ type: "setHelpOpen", value: true });
      return;
    }

    if (name === "q") {
      process.exit(0);
    }

    if (name === "j" || name === "down") {
      moveSelection(1);
    }

    if (name === "k" || name === "up") {
      moveSelection(-1);
    }

    if (name === "space") {
      toggleSelected();
    }

    if (name === "a") {
      openAdd();
    }

    if (name === "e") {
      openEdit();
    }

    if (name === "c") {
      openDuplicate();
    }

    if (name === "d") {
      if (selectedTask) {
        dispatch({ type: "setConfirmDelete", value: true });
      }
    }

    if (name === "/") {
      dispatch({ type: "setSearchActive", value: true });
    }

    if (name === "f") {
      cycleStatus();
    }

    if (name === "g") {
      cycleDue();
    }

    if (name === "t") {
      toggleTagFilter();
    }
  });

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
      if (state.editorFocus === "due" && dueSuggestion) {
        dispatch({ type: "updateEditor", patch: { dueText: dueSuggestion } });
        return;
      }
      if (state.editorFocus === "tags" && tagInlineSuggestion) {
        handlePickTag(tagInlineSuggestion);
        return;
      }
    }

    if (name === "tab") {
      const direction: 1 | -1 = shift ? -1 : 1;
      dispatch({
        type: "setEditorFocus",
        focus: nextFocus(state.editorFocus, direction)
      });
      return;
    }

    if ((name === "return" || name === "enter") && state.editorFocus === "save") {
      saveEditor();
      return;
    }

    if ((name === "return" || name === "enter") && state.editorFocus === "cancel") {
      cancelEditor();
    }

    if (sequence === "?" && state.mode !== "list") {
      dispatch({ type: "setHelpOpen", value: true });
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
    dispatch({ type: "setMode", mode: "add" });
    dispatch({ type: "setEditor", editor: createEmptyDraft(), focus: "title" });
  }

  function openEdit() {
    if (!selectedTask) return;
    dispatch({ type: "setMode", mode: "edit" });
    dispatch({ type: "setEditor", editor: createDraftFromTask(selectedTask), focus: "title" });
  }

  function openDuplicate() {
    if (!selectedTask) return;
    const baseDraft = createDraftFromTask(selectedTask);
    const dueText =
      selectedTask.status === "done"
        ? formatDate(now)
        : baseDraft.dueText;
    const timeText = selectedTask.status === "done" ? "" : baseDraft.timeText;
    dispatch({ type: "setMode", mode: "add" });
    dispatch({
      type: "setEditor",
      editor: { ...baseDraft, id: undefined, dueText, timeText },
      focus: "title"
    });
  }

  function cancelEditor() {
    dispatch({ type: "setMode", mode: "list" });
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
    dispatch({ type: "setEditor", editor: null });
  }

  function handleDeleteSelected() {
    if (!selectedTask) return;
    dispatch({
      type: "setTasks",
      tasks: state.tasks.filter((task) => task.id !== selectedTask.id)
    });
    dispatch({ type: "setConfirmDelete", value: false });
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
          searchActive={state.searchActive}
          helpOpen={state.helpOpen}
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
                {state.searchActive ? (
                  <box style={{ flexDirection: "column", marginBottom: 1 }}>
                    <text style={{ color: theme.muted }}>SEARCH</text>
                <input
                  value={state.filters.searchText ?? ""}
                  onChange={updateSearch}
                  focused
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
              {state.mode === "list" ? (
                <DetailsPane
                  task={selectedTask}
                  now={now}
                  pulseOn={pulseOn}
                  fastPulseOn={fastPulseOn}
                />
              ) : state.editor ? (
                <EditorPane
                  mode={state.mode}
                  draft={state.editor}
                  focus={state.editorFocus}
                  tagSuggestions={tagSuggestions}
                  tagSuggestionActive={tagSuggestionActive}
                  tagSuggestionHint={tagSuggestionHint}
                  dueSuggestionHint={dueSuggestionHint}
                  onUpdate={(patch) => dispatch({ type: "updateEditor", patch })}
                  onSave={saveEditor}
                  onCancel={cancelEditor}
                  onPickTag={handlePickTag}
                />
              ) : null}
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
        </box>
      </box>

      {state.confirmDelete ? (
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
          </box>
        </box>
      ) : null}

      {state.helpOpen ? (
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
