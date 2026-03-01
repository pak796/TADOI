import type React from "react";
import { resolveTaskRowClickIntent } from "../components/TaskList";
import { buildRecurrenceFromDraft } from "../domain/recurrence/draft";
import {
  reconcileOverrideChecklistWithSeries,
  sortChecklistItems
} from "../domain/checklist";
import {
  formatDateToLocalIso,
  parseLocalIsoToDate
} from "../domain/recurrence/rruleAdapter";
import { buildReminderFromDraft, stripReminderRuntimeState } from "../domain/reminders";
import { getSuggestedTime, type SuggestedTime } from "../domain/timeAutocomplete";
import {
  combineDueDateTime,
  createDraftFromTask,
  createEmptyDraft,
  formatDate,
  parseDueTime
} from "../state/store";
import { updateTagIndex } from "../domain/tagIndex";
import {
  cloneEditorDraft,
  isEditorDraftDirty
} from "../domain/editorDraftDirty";
import {
  FocusTarget,
  Mode,
  type AppState,
  type EditorDraft,
  type Task
} from "../domain/models";
import type { VisibleTaskRow } from "../domain/taskRows";
import type {
  UIEditTargetSwitchModal,
  UITaskEditorUnsavedContinuation
} from "../ui/state";
import { resolveEditorFocusAfterDraftChange } from "./uiState";
import { decideEditTargetSwitch } from "./editTargetSwitchFlow";

type OccurrenceContext = {
  row: VisibleTaskRow;
  seriesTask: Task;
  seriesId: string;
  occurrenceIso: string;
  instanceTask?: Task;
};

type EditorFlowDeps = {
  uiState: {
    mode: Mode;
    focus: FocusTarget;
    modal: unknown;
  };
  state: Pick<AppState, "editor" | "tasks" | "tagIndex">;
  selectedTask: VisibleTaskRow | undefined;
  visibleTaskRows: VisibleTaskRow[];
  now: number;
  selectedRowIdRef: React.MutableRefObject<string | undefined>;
  editorDraftRef: React.MutableRefObject<EditorDraft | null>;
  editorDirtyIntentRef: React.MutableRefObject<boolean>;
  editorTargetRowIdRef: React.MutableRefObject<string | undefined>;
  editorBaselineDraftRef: React.MutableRefObject<EditorDraft | null>;
  dispatch: (action: any) => void;
  uiDispatch: (action: any) => void;
  setTimeSuggestion: (value: SuggestedTime | null) => void;
  closeViewsOverlay: () => void;
  clearPendingGPrefix: () => void;
  requestTaskEditorUnsavedGuard: (
    continuation: UITaskEditorUnsavedContinuation
  ) => boolean;
  resetEditorSessionTracking: () => void;
  openModalWithContext: (modal: any) => void;
  closeModalWithPreviousContext: (modal: {
    previousMode: Mode;
    previousFocus: FocusTarget;
  }) => void;
  showShortNavigationBanner: (message: string) => void;
  resolveOccurrenceContextForRow: (
    row: VisibleTaskRow | undefined
  ) => OccurrenceContext | null;
  resolvePersistedTaskForRow: (row: VisibleTaskRow | undefined) => Task | undefined;
  findSeriesTaskBySeriesId: (seriesId: string | undefined) => Task | undefined;
  findTaskById: (taskId: string | undefined) => Task | undefined;
  normalizeOccurrenceIso: (value: string | undefined) => string | undefined;
  withSeriesOccurrenceExcluded: (
    tasks: Task[],
    seriesTaskId: string,
    occurrenceIso: string,
    nowMs: number
  ) => Task[];
  removeMaterializedOccurrenceInstance: (
    tasks: Task[],
    seriesId: string,
    occurrenceIso: string
  ) => Task[];
  parseTagsInput: (input: string) => string[];
  triggerFirstRecurringTaskCreated: (at: number, seriesId: string) => void;
  triggerChecklistMilestonesForTaskTransition: (
    previousTask: Task | undefined,
    nextTask: Task | undefined,
    at: number
  ) => void;
  selectTaskById: (taskId: string) => void;
};

type SaveEditorOptions = {
  forceMode?: typeof Mode.ADD | typeof Mode.EDIT;
  closeAfterSave?: boolean;
};

type EditorFlowHandlers = {
  requestEditTargetSwitch: (toTaskId: string) => void;
  handleModalSaveAndSwitchEditTarget: () => void;
  handleModalDiscardAndSwitchEditTarget: () => void;
  handleModalDiscardAndCloseEditor: () => void;
  handleTaskRowClick: (input: { taskId: string; wasSelected: boolean }) => void;
  openAdd: (options?: { bypassUnsavedGuard?: boolean }) => void;
  startEditSession: (rowId: string, draft: EditorDraft) => void;
  buildEditDraftForRow: (row: VisibleTaskRow) => EditorDraft | null;
  openEditForRow: (row: VisibleTaskRow) => boolean;
  openEditForRowId: (rowId: string) => boolean;
  openEditSeries: () => void;
  openEdit: (options?: { bypassUnsavedGuard?: boolean }) => void;
  openDuplicate: () => void;
  cancelEditor: () => void;
  updateEditorDraft: (patch: Partial<EditorDraft>) => void;
  saveEditor: (options?: SaveEditorOptions) => boolean;
};

export function useEditorFlow(deps: EditorFlowDeps): EditorFlowHandlers {
  function getEditSwitchModal(): UIEditTargetSwitchModal | null {
    const modal = deps.uiState.modal;
    if (!modal || typeof modal !== "object") return null;
    if ((modal as { type?: string }).type !== "edit_switch_confirm") return null;
    return modal as UIEditTargetSwitchModal;
  }

  function openEditForRowId(rowId: string): boolean {
    const row = deps.visibleTaskRows.find((task) => task.id === rowId);
    if (!row) return false;
    return openEditForRow(row);
  }

  function requestEditTargetSwitch(toTaskId: string) {
    if (deps.uiState.mode !== Mode.EDIT) return;
    const editorDraft = deps.editorDraftRef.current ?? deps.state.editor;
    if (!editorDraft) return;
    const targetRow = deps.visibleTaskRows.find((task) => task.id === toTaskId);
    if (!targetRow) return;

    const decision = decideEditTargetSwitch({
      fromTaskId: deps.editorTargetRowIdRef.current,
      toTaskId,
      isDirty:
        deps.editorDirtyIntentRef.current ||
        isEditorDraftDirty(editorDraft, deps.editorBaselineDraftRef.current),
      hasActiveModal: deps.uiState.modal !== null
    });

    if (decision.type === "ignore") return;
    if (decision.type === "switch_now") {
      openEditForRowId(decision.toTaskId);
      return;
    }

    deps.openModalWithContext({
      type: "edit_switch_confirm",
      fromTaskId: decision.fromTaskId,
      toTaskId: decision.toTaskId,
      toTaskTitle: targetRow.title,
      previousMode: Mode.EDIT,
      previousFocus: deps.uiState.focus
    });
  }

  function handleModalSaveAndSwitchEditTarget() {
    const modal = getEditSwitchModal();
    if (!modal) return;
    const saveSucceeded = saveEditor({
      forceMode: Mode.EDIT,
      closeAfterSave: false
    });
    if (!saveSucceeded) return;
    deps.closeModalWithPreviousContext(modal);
    openEditForRowId(modal.toTaskId);
  }

  function handleModalDiscardAndSwitchEditTarget() {
    const modal = getEditSwitchModal();
    if (!modal) return;
    deps.closeModalWithPreviousContext(modal);
    openEditForRowId(modal.toTaskId);
  }

  function handleModalDiscardAndCloseEditor() {
    const modal = getEditSwitchModal();
    if (!modal) return;
    deps.closeModalWithPreviousContext(modal);
    cancelEditor();
  }

  function handleTaskRowClick(input: { taskId: string; wasSelected: boolean }) {
    if (deps.uiState.mode === Mode.MODAL_CONFIRM && deps.uiState.modal) return;
    const targetExists = deps.visibleTaskRows.some((task) => task.id === input.taskId);
    if (!targetExists) return;
    const effectiveWasSelected =
      input.wasSelected || deps.selectedRowIdRef.current === input.taskId;

    if (deps.uiState.mode === Mode.EDIT) {
      requestEditTargetSwitch(input.taskId);
      return;
    }

    const intent = resolveTaskRowClickIntent({
      button: 0,
      wasSelected: effectiveWasSelected,
      mode: deps.uiState.mode
    });

    if (intent === "none") return;
    if (intent === "select") {
      deps.selectTaskById(input.taskId);
      return;
    }
    openEditForRowId(input.taskId);
  }

  function openAdd(options: { bypassUnsavedGuard?: boolean } = {}) {
    if (
      !options.bypassUnsavedGuard &&
      deps.requestTaskEditorUnsavedGuard("open_add")
    ) {
      return;
    }
    deps.resetEditorSessionTracking();
    deps.closeViewsOverlay();
    deps.setTimeSuggestion(getSuggestedTime(new Date()));
    const emptyDraft = createEmptyDraft();
    deps.editorDraftRef.current = emptyDraft;
    deps.editorDirtyIntentRef.current = false;
    deps.uiDispatch({ type: "setMode", mode: Mode.ADD });
    deps.uiDispatch({ type: "setFocus", focus: FocusTarget.EDITOR_TITLE });
    deps.uiDispatch({ type: "setEditorScrollOffset", scrollOffset: 0 });
    deps.dispatch({
      type: "setEditor",
      editor: emptyDraft
    });
  }

  function startEditSession(rowId: string, draft: EditorDraft) {
    deps.closeViewsOverlay();
    deps.setTimeSuggestion(getSuggestedTime(new Date()));
    deps.uiDispatch({ type: "setMode", mode: Mode.EDIT });
    deps.uiDispatch({ type: "setFocus", focus: FocusTarget.EDITOR_TITLE });
    deps.uiDispatch({ type: "setEditorScrollOffset", scrollOffset: 0 });
    deps.editorDraftRef.current = draft;
    deps.editorDirtyIntentRef.current = false;
    deps.dispatch({ type: "setEditor", editor: draft });
    deps.editorTargetRowIdRef.current = rowId;
    deps.editorBaselineDraftRef.current = cloneEditorDraft(draft);
  }

  function buildEditDraftForRow(row: VisibleTaskRow): EditorDraft | null {
    if (
      row.rowKind === "series_occurrence_virtual" ||
      row.rowKind === "series_occurrence_instance"
    ) {
      const context = deps.resolveOccurrenceContextForRow(row);
      if (!context) {
        deps.showShortNavigationBanner("No recurring occurrence selected");
        return null;
      }

      const occurrenceDate = parseLocalIsoToDate(context.occurrenceIso);
      if (!occurrenceDate) {
        deps.showShortNavigationBanner("Invalid occurrence timestamp");
        return null;
      }

      const editSource: Task = context.instanceTask
        ? context.instanceTask
        : {
            ...context.seriesTask,
            id: `occurrence:${context.seriesId}:${context.occurrenceIso}`,
            dueAt: occurrenceDate.getTime(),
            reminder: stripReminderRuntimeState(context.seriesTask.reminder),
            recurrence: undefined
          };
      const baseDraft = createDraftFromTask(editSource);
      return {
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
      };
    }

    const persisted = deps.resolvePersistedTaskForRow(row);
    if (!persisted) return null;
    return {
      ...createDraftFromTask(persisted),
      editKind: "regular"
    };
  }

  function openEditForRow(row: VisibleTaskRow): boolean {
    const draft = buildEditDraftForRow(row);
    if (!draft) return false;
    startEditSession(row.id, draft);
    return true;
  }

  function openEditSeries() {
    if (!deps.selectedTask) return;

    const seriesTask =
      deps.selectedTask.rowKind === "series_occurrence_virtual" ||
      deps.selectedTask.rowKind === "series_occurrence_instance"
        ? deps.findSeriesTaskBySeriesId(deps.selectedTask.seriesId)
        : deps.selectedTask.recurrence
          ? deps.resolvePersistedTaskForRow(deps.selectedTask)
          : undefined;

    if (!seriesTask) {
      deps.showShortNavigationBanner("No recurring series selected");
      return;
    }

    startEditSession(deps.selectedTask.id, {
      ...createDraftFromTask(seriesTask),
      editKind: "series",
      sourceTaskId: seriesTask.id,
      sourceSeriesId: seriesTask.recurrence?.series_id
    });
  }

  function openEdit(options: { bypassUnsavedGuard?: boolean } = {}) {
    if (
      !options.bypassUnsavedGuard &&
      deps.requestTaskEditorUnsavedGuard("open_edit")
    ) {
      return;
    }
    if (!deps.selectedTask) return;
    openEditForRow(deps.selectedTask);
  }

  function openDuplicate() {
    if (!deps.selectedTask) return;
    const persisted = deps.resolvePersistedTaskForRow(deps.selectedTask);
    if (!persisted) return;
    deps.resetEditorSessionTracking();
    deps.closeViewsOverlay();
    const baseDraft = createDraftFromTask(persisted);
    const dueText = persisted.status === "done" ? formatDate(deps.now) : baseDraft.dueText;
    const timeText = persisted.status === "done" ? "" : baseDraft.timeText;
    deps.setTimeSuggestion(getSuggestedTime(new Date()));
    const duplicateDraft: EditorDraft = {
      ...baseDraft,
      id: undefined,
      dueText,
      timeText,
      editKind: "regular",
      sourceTaskId: undefined,
      sourceSeriesId: undefined,
      occurrenceIso: undefined
    };
    deps.editorDraftRef.current = duplicateDraft;
    deps.editorDirtyIntentRef.current = false;
    deps.uiDispatch({ type: "setMode", mode: Mode.ADD });
    deps.uiDispatch({ type: "setFocus", focus: FocusTarget.EDITOR_TITLE });
    deps.uiDispatch({ type: "setEditorScrollOffset", scrollOffset: 0 });
    deps.dispatch({
      type: "setEditor",
      editor: duplicateDraft
    });
  }

  function cancelEditor() {
    deps.resetEditorSessionTracking();
    deps.clearPendingGPrefix();
    deps.setTimeSuggestion(null);
    deps.uiDispatch({ type: "setMode", mode: Mode.LIST });
    deps.uiDispatch({ type: "setFocus", focus: FocusTarget.TASK_LIST });
    deps.uiDispatch({ type: "setEditorScrollOffset", scrollOffset: 0 });
    deps.dispatch({ type: "setEditor", editor: null });
  }

  function updateEditorDraft(patch: Partial<EditorDraft>) {
    const previousDraft = deps.editorDraftRef.current ?? deps.state.editor;
    if (!previousDraft) return;
    const nextDraft: EditorDraft = {
      ...previousDraft,
      ...patch
    };
    deps.editorDraftRef.current = nextDraft;
    if (deps.uiState.mode === Mode.EDIT) {
      deps.editorDirtyIntentRef.current = isEditorDraftDirty(
        nextDraft,
        deps.editorBaselineDraftRef.current
      );
    }
    const reconciledFocus = resolveEditorFocusAfterDraftChange(
      deps.uiState.focus,
      previousDraft,
      nextDraft
    );
    if (reconciledFocus !== deps.uiState.focus) {
      deps.uiDispatch({ type: "setFocus", focus: reconciledFocus });
    }
    deps.dispatch({ type: "updateEditor", patch });
  }

  function saveEditor(options: SaveEditorOptions = {}): boolean {
    const draft = deps.editorDraftRef.current ?? deps.state.editor;
    if (!draft) return false;
    const activeMode = options.forceMode ?? deps.uiState.mode;
    const closeAfterSave = options.closeAfterSave ?? true;
    if (activeMode !== Mode.ADD && activeMode !== Mode.EDIT) return false;

    // Keep recurrence draft values in-memory; persistence is gated by repeatMode in buildRecurrenceFromDraft.
    const title = draft.title.trim();
    if (!title) return false;

    const nowMs = Date.now();
    const timeText = draft.timeText.trim();
    const timeMinutes = timeText ? parseDueTime(timeText) : undefined;
    if (timeText && timeMinutes === undefined) {
      deps.showShortNavigationBanner("Invalid time format (HH:mm)");
      return false;
    }

    const { dueAt, hasExplicitTime } = combineDueDateTime(draft.dueText, timeText);
    const tags = deps.parseTagsInput(draft.tagsText);
    const notes = draft.notes.length > 0 ? draft.notes : undefined;
    const assignee = draft.assigneeText.trim().length > 0 ? draft.assigneeText.trim() : undefined;
    const project = draft.projectText.trim().length > 0 ? draft.projectText.trim() : undefined;
    const links = draft.links.map((link) => ({ ...link }));
    const checklist = sortChecklistItems(draft.checklist.map((item) => ({ ...item })));

    if (activeMode === Mode.ADD) {
      const reminderBuild = buildReminderFromDraft({
        draft,
        dueAt
      });
      if (reminderBuild.validationMessage) {
        deps.showShortNavigationBanner(reminderBuild.validationMessage);
      }

      const taskId = crypto.randomUUID();
      const recurrenceBuild = buildRecurrenceFromDraft(
        draft,
        dueAt,
        `series:${taskId}`
      );
      if (recurrenceBuild.error) {
        deps.showShortNavigationBanner(recurrenceBuild.error);
        return false;
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
        checklist,
        assignee,
        project,
        workflowStage: draft.workflowStage ?? "todo",
        ...(reminderBuild.reminder ? { reminder: reminderBuild.reminder } : {}),
        ...(links.length > 0 ? { links } : {}),
        ...(recurrenceBuild.recurrence ? { recurrence: recurrenceBuild.recurrence } : {})
      };

      deps.dispatch({ type: "setTasks", tasks: [...deps.state.tasks, newTask] });
      deps.dispatch({
        type: "setTagIndex",
        tagIndex: updateTagIndex(deps.state.tagIndex, tags, nowMs)
      });
      deps.triggerChecklistMilestonesForTaskTransition(undefined, newTask, nowMs);
      if (recurrenceBuild.recurrence) {
        deps.triggerFirstRecurringTaskCreated(nowMs, recurrenceBuild.recurrence.series_id);
      }
      deps.dispatch({ type: "setSelected", id: newTask.id });
      if (closeAfterSave) {
        deps.uiDispatch({ type: "setMode", mode: Mode.LIST });
        deps.uiDispatch({ type: "setFocus", focus: FocusTarget.TASK_LIST });
        deps.uiDispatch({ type: "setEditorScrollOffset", scrollOffset: 0 });
        deps.dispatch({ type: "setEditor", editor: null });
      }
      return true;
    }

    if (activeMode === Mode.EDIT) {
      if (draft.editKind === "occurrence") {
        const seriesId = draft.sourceSeriesId;
        const occurrenceIso = deps.normalizeOccurrenceIso(draft.occurrenceIso);
        const seriesTask =
          deps.findTaskById(draft.sourceTaskId) ?? deps.findSeriesTaskBySeriesId(seriesId);

        if (!seriesId || !occurrenceIso || !seriesTask?.recurrence) {
          deps.showShortNavigationBanner("Unable to edit occurrence");
          return false;
        }

        let tasksWithSeriesExdate = deps.withSeriesOccurrenceExcluded(
          deps.state.tasks,
          seriesTask.id,
          occurrenceIso,
          nowMs
        );
        const withoutPreviousInstance = deps.removeMaterializedOccurrenceInstance(
          tasksWithSeriesExdate,
          seriesId,
          occurrenceIso
        );

        const instanceId = draft.id ?? crypto.randomUUID();
        const existingInstance = draft.id ? deps.findTaskById(draft.id) : undefined;
        const reminderBuild = buildReminderFromDraft({
          draft,
          dueAt,
          previousReminder: existingInstance?.reminder
        });
        if (reminderBuild.validationMessage) {
          deps.showShortNavigationBanner(reminderBuild.validationMessage);
        }
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
          checklist,
          assignee,
          project,
          workflowStage:
            draft.workflowStage ??
            existingInstance?.workflowStage ??
            ((existingInstance?.status ?? "open") === "done" ? "done" : "todo"),
          ...(reminderBuild.reminder ? { reminder: reminderBuild.reminder } : {}),
          instance_of: {
            series_id: seriesId,
            occurrence: occurrenceIso
          }
        };

        tasksWithSeriesExdate = [...withoutPreviousInstance, instance];
        deps.dispatch({ type: "setTasks", tasks: tasksWithSeriesExdate });
        deps.dispatch({
          type: "setTagIndex",
          tagIndex: updateTagIndex(deps.state.tagIndex, tags, nowMs)
        });
        deps.triggerChecklistMilestonesForTaskTransition(
          existingInstance ?? seriesTask,
          instance,
          nowMs
        );
        deps.dispatch({ type: "setSelected", id: instanceId });
      } else if (draft.editKind === "series") {
        const seriesTask =
          deps.findTaskById(draft.sourceTaskId ?? draft.id) ??
          deps.findSeriesTaskBySeriesId(draft.sourceSeriesId);
        if (!seriesTask) {
          deps.showShortNavigationBanner("Unable to edit recurring series");
          return false;
        }

        const recurrenceBuild = buildRecurrenceFromDraft(
          draft,
          dueAt,
          seriesTask.recurrence?.series_id ?? draft.sourceSeriesId ?? `series:${seriesTask.id}`
        );
        if (recurrenceBuild.error) {
          deps.showShortNavigationBanner(recurrenceBuild.error);
          return false;
        }

        const nowIso = new Date(nowMs).toISOString();
        const reminderBuild = buildReminderFromDraft({
          draft,
          dueAt,
          previousReminder: seriesTask.reminder
        });
        if (reminderBuild.validationMessage) {
          deps.showShortNavigationBanner(reminderBuild.validationMessage);
        }
        const resolvedSeriesId =
          recurrenceBuild.recurrence?.series_id ??
          seriesTask.recurrence?.series_id ??
          draft.sourceSeriesId;
        const updatedTasks = deps.state.tasks.map((task) => {
          if (task.id === seriesTask.id) {
            return {
              ...task,
              title,
              dueAt,
              hasExplicitTime,
              notes,
              tags,
              checklist,
              assignee,
              project,
              workflowStage:
                draft.workflowStage ??
                task.workflowStage ??
                (task.status === "done" || task.status === "archived" ? "done" : "todo"),
              updatedAt: nowMs,
              reminder: reminderBuild.reminder,
              recurrence: recurrenceBuild.recurrence
            };
          }
          if (!resolvedSeriesId || task.instance_of?.series_id !== resolvedSeriesId) {
            return task;
          }
          return {
            ...task,
            updatedAt: nowMs,
            checklist: reconcileOverrideChecklistWithSeries(
              task.checklist,
              checklist,
              nowIso
            )
          };
        });
        deps.dispatch({ type: "setTasks", tasks: updatedTasks });
        deps.dispatch({
          type: "setTagIndex",
          tagIndex: updateTagIndex(deps.state.tagIndex, tags, nowMs)
        });
        const updatedSeriesTask = updatedTasks.find((task) => task.id === seriesTask.id);
        deps.triggerChecklistMilestonesForTaskTransition(seriesTask, updatedSeriesTask, nowMs);
        deps.dispatch({ type: "setSelected", id: seriesTask.id });
      } else {
        const targetTask = draft.id ? deps.findTaskById(draft.id) : undefined;
        if (!targetTask) return false;

        const recurrenceBuild = buildRecurrenceFromDraft(
          draft,
          dueAt,
          targetTask.recurrence?.series_id ?? `series:${targetTask.id}`
        );
        if (recurrenceBuild.error) {
          deps.showShortNavigationBanner(recurrenceBuild.error);
          return false;
        }

        const reminderBuild = buildReminderFromDraft({
          draft,
          dueAt,
          previousReminder: targetTask.reminder
        });
        if (reminderBuild.validationMessage) {
          deps.showShortNavigationBanner(reminderBuild.validationMessage);
        }
        const updatedTasks = deps.state.tasks.map((task) => {
          if (task.id !== targetTask.id) return task;
          return {
            ...task,
            title,
            dueAt,
            hasExplicitTime,
            notes,
            tags,
            checklist,
            assignee,
            project,
            workflowStage:
              draft.workflowStage ??
              task.workflowStage ??
              (task.status === "done" || task.status === "archived" ? "done" : "todo"),
            updatedAt: nowMs,
            reminder: reminderBuild.reminder,
            recurrence: recurrenceBuild.recurrence
          };
        });
        deps.dispatch({ type: "setTasks", tasks: updatedTasks });
        deps.dispatch({
          type: "setTagIndex",
          tagIndex: updateTagIndex(deps.state.tagIndex, tags, nowMs)
        });
        const updatedTargetTask = updatedTasks.find((task) => task.id === targetTask.id);
        deps.triggerChecklistMilestonesForTaskTransition(
          targetTask,
          updatedTargetTask,
          nowMs
        );
        if (!targetTask.recurrence && recurrenceBuild.recurrence) {
          deps.triggerFirstRecurringTaskCreated(nowMs, recurrenceBuild.recurrence.series_id);
        }
      }
    }

    if (closeAfterSave) {
      deps.uiDispatch({ type: "setMode", mode: Mode.LIST });
      deps.uiDispatch({ type: "setFocus", focus: FocusTarget.TASK_LIST });
      deps.uiDispatch({ type: "setEditorScrollOffset", scrollOffset: 0 });
      deps.dispatch({ type: "setEditor", editor: null });
    }

    deps.editorDirtyIntentRef.current = false;
    return true;
  }

  return {
    requestEditTargetSwitch,
    handleModalSaveAndSwitchEditTarget,
    handleModalDiscardAndSwitchEditTarget,
    handleModalDiscardAndCloseEditor,
    handleTaskRowClick,
    openAdd,
    startEditSession,
    buildEditDraftForRow,
    openEditForRow,
    openEditForRowId,
    openEditSeries,
    openEdit,
    openDuplicate,
    cancelEditor,
    updateEditorDraft,
    saveEditor
  };
}

export type { EditorFlowDeps, EditorFlowHandlers };
