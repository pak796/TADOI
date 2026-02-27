import {
  FocusTarget,
  Mode,
  type AppState,
  type Task
} from "../domain/models";
import { buildVisibleTaskRows } from "../domain/taskRows";
import {
  applyOverdueMarkDone,
  applyOverdueSnooze,
  resolveGoToTaskTarget
} from "../notifications/overdueTaskActions";
import { applyReminderDismiss, applyReminderSnooze } from "../domain/reminders";
import type { TaskOverdueEvent, TaskReminderEvent } from "../notifications/types";
import { deleteRecurringOccurrenceAndFuture } from "../domain/recurrence/delete";
import {
  clearEmptyNux,
  dismissEmptyNux,
  openEmptyNux,
  unwind,
  type EmptyNuxStep,
  type UIBackupFinalCheckpointModal,
  type UIDeleteModal,
  type UIHelpThemeUnsavedContinuation,
  type UIRecurringDeleteFutureCheckpointModal,
  type UIState,
  type UIUnsavedChangesModal,
  type UITaskEditorUnsavedContinuation
} from "../ui/state";
import type { BackupCenterScreen } from "../state/backupCenterFlow";
import { isEditorMode } from "../ui/modeFocus";

type ModalOrchestrationDeps = {
  uiState: UIState;
  state: Pick<AppState, "tasks" | "sortMode">;
  dispatch: (action: any) => void;
  uiDispatch: (action: any) => void;
  backupDispatch: (action: any) => void;
  setTimeSuggestion: (value: any) => void;
  requestTaskEditorUnsavedGuard: (
    continuation: UITaskEditorUnsavedContinuation
  ) => boolean;
  closeHelp: (options?: { bypassUnsavedGuard?: boolean }) => void;
  runTaskEditorContinuation: (
    continuation: UITaskEditorUnsavedContinuation
  ) => void;
  runHelpThemeEditorContinuation: (
    source: "help_custom1_editor" | "help_text_tuning_editor",
    continuation: UIHelpThemeUnsavedContinuation
  ) => void;
  saveEditor: (options?: {
    forceMode?: typeof Mode.ADD | typeof Mode.EDIT;
    closeAfterSave?: boolean;
  }) => boolean;
  saveCustom1Editor: () => boolean;
  saveBuiltInTextEditor: () => boolean;
  openModalWithContext: (modal: any) => void;
  closeModalWithPreviousContext: (modal: {
    previousMode: Mode;
    previousFocus: FocusTarget;
  }) => void;
  finishDeleteModalAction: (modal: UIDeleteModal, deletedRowId: string, nextTasks: Task[]) => void;
  handleDeleteSelected: () => void;
  runBackupImportCommitFlow: () => void;
  runCalendarImportCommitFromBackupCenter: () => void;
  runRoutedAction: (action: any) => void;
  openAdd: (options?: { bypassUnsavedGuard?: boolean }) => void;
  clearPendingGPrefix: () => void;
  closeViewsOverlay: () => void;
  openListMode: (options?: { bypassUnsavedGuard?: boolean }) => void;
  showShortNavigationBanner: (message: string) => void;
  emitCompletionFromDiff: (previousTasks: Task[], nextTasks: Task[], at: number) => void;
};

type ModalHandlers = {
  applyEscUnwind: (options?: { bypassUnsavedGuard?: boolean }) => boolean;
  openUnsavedChangesModal: (modal: UIUnsavedChangesModal) => void;
  openBackupFinalCheckpointModal: (modal: UIBackupFinalCheckpointModal) => void;
  openRecurringDeleteFutureCheckpointModal: (
    modal: UIRecurringDeleteFutureCheckpointModal
  ) => void;
  openBackupFinalCheckpoint: (
    checkpoint: UIBackupFinalCheckpointModal["checkpoint"],
    sourceScreen: BackupCenterScreen
  ) => void;
  handleUnsavedChangesSaveAndContinue: () => void;
  handleUnsavedChangesDiscardAndContinue: () => void;
  cancelUnsavedChangesContinue: () => void;
  handleBackupFinalCheckpointConfirm: () => void;
  cancelBackupFinalCheckpoint: () => void;
  handleRecurringDeleteFutureCheckpointConfirm: () => void;
  cancelRecurringDeleteFutureCheckpoint: () => void;
  requestRecurringDeleteFutureCheckpointFromDeleteModal: () => void;
  confirmDeleteSelectedFromModal: () => void;
  confirmDeleteSelectedAndFutureFromModal: () => void;
  cancelDeleteSelectedFromModal: () => void;
  openEmptyNuxModal: (options?: {
    step?: EmptyNuxStep;
    startedFromNux?: boolean;
    createdTaskId?: string;
  }) => void;
  startEmptyNuxAddFlow: () => void;
  dismissEmptyNuxModal: () => void;
  showEmptyNuxShortcutsModal: () => void;
  returnToEmptyNuxWelcomeModal: () => void;
  clearEmptyNuxWalkthrough: () => void;
  closeCelebrateToList: () => void;
  createTaskFromEmptyNuxModal: () => void;
  handleOverdueModalSnooze: () => void;
  handleOverdueModalDone: () => void;
  handleOverdueModalGoToTask: () => void;
  handleReminderModalDismiss: () => void;
  handleReminderModalSnooze: (deltaMs: number) => void;
  handleReminderModalGoToTask: () => void;
};

export function useModalOrchestration(deps: ModalOrchestrationDeps): ModalHandlers {
  function applyEscUnwind(options: { bypassUnsavedGuard?: boolean } = {}): boolean {
    if (!options.bypassUnsavedGuard && isEditorMode(deps.uiState.mode)) {
      if (deps.requestTaskEditorUnsavedGuard("close_editor")) {
        return true;
      }
    }
    if (deps.uiState.mode === Mode.HELP) {
      deps.closeHelp();
      return true;
    }
    const next = unwind(deps.uiState);
    if (!next) return false;
    if (deps.uiState.mode === Mode.BACKUP_CENTER) {
      deps.backupDispatch({ type: "reset" });
    }
    if (next.clearEditorDraft) {
      deps.setTimeSuggestion(null);
      deps.dispatch({ type: "setEditor", editor: null });
    }
    deps.uiDispatch({
      type: "replace",
      state: next.clearEditorDraft
        ? { ...next.state, editorScrollOffset: 0 }
        : next.state
    });
    return true;
  }

  function getUnsavedChangesModal(): UIUnsavedChangesModal | null {
    const modal = deps.uiState.modal;
    if (!modal || modal.type !== "unsaved_changes") return null;
    return modal;
  }

  function getBackupFinalCheckpointModal(): UIBackupFinalCheckpointModal | null {
    const modal = deps.uiState.modal;
    if (!modal || modal.type !== "backup_final_checkpoint") return null;
    return modal;
  }

  function getRecurringDeleteFutureCheckpointModal(): UIRecurringDeleteFutureCheckpointModal | null {
    const modal = deps.uiState.modal;
    if (!modal || modal.type !== "recurring_delete_future_checkpoint") return null;
    return modal;
  }

  function openUnsavedChangesModal(modal: UIUnsavedChangesModal): void {
    deps.openModalWithContext(modal);
  }

  function openBackupFinalCheckpointModal(modal: UIBackupFinalCheckpointModal): void {
    deps.openModalWithContext(modal);
  }

  function openRecurringDeleteFutureCheckpointModal(
    modal: UIRecurringDeleteFutureCheckpointModal
  ): void {
    deps.openModalWithContext(modal);
  }

  function openBackupFinalCheckpoint(
    checkpoint: UIBackupFinalCheckpointModal["checkpoint"],
    sourceScreen: BackupCenterScreen
  ): void {
    deps.runRoutedAction({
      scope: "ui",
      type: "OPEN_BACKUP_FINAL_CHECKPOINT_MODAL",
      modal: {
        type: "backup_final_checkpoint",
        checkpoint,
        sourceScreen,
        previousMode: Mode.BACKUP_CENTER,
        previousFocus: FocusTarget.BACKUP_CENTER
      }
    });
  }

  function handleUnsavedChangesSaveAndContinue(): void {
    const modal = getUnsavedChangesModal();
    if (!modal) return;

    let saveSucceeded = false;
    if (modal.source === "task_editor") {
      const forcedMode = modal.previousMode === Mode.EDIT ? Mode.EDIT : Mode.ADD;
      saveSucceeded = deps.saveEditor({ forceMode: forcedMode, closeAfterSave: false });
    } else if (modal.source === "help_custom1_editor") {
      saveSucceeded = deps.saveCustom1Editor();
    } else {
      saveSucceeded = deps.saveBuiltInTextEditor();
    }

    if (!saveSucceeded) {
      return;
    }

    deps.closeModalWithPreviousContext(modal);
    if (modal.source === "task_editor") {
      deps.runTaskEditorContinuation(modal.continuation);
      return;
    }
    deps.runHelpThemeEditorContinuation(modal.source, modal.continuation);
  }

  function handleUnsavedChangesDiscardAndContinue(): void {
    const modal = getUnsavedChangesModal();
    if (!modal) return;
    deps.closeModalWithPreviousContext(modal);
    if (modal.source === "task_editor") {
      deps.runTaskEditorContinuation(modal.continuation);
      return;
    }
    deps.runHelpThemeEditorContinuation(modal.source, modal.continuation);
  }

  function cancelUnsavedChangesContinue(): void {
    const modal = getUnsavedChangesModal();
    if (!modal) return;
    deps.closeModalWithPreviousContext(modal);
  }

  function handleBackupFinalCheckpointConfirm(): void {
    const modal = getBackupFinalCheckpointModal();
    if (!modal) return;
    deps.closeModalWithPreviousContext(modal);
    if (modal.checkpoint === "data_import") {
      deps.runBackupImportCommitFlow();
      return;
    }
    deps.runCalendarImportCommitFromBackupCenter();
  }

  function cancelBackupFinalCheckpoint(): void {
    const modal = getBackupFinalCheckpointModal();
    if (!modal) return;
    deps.closeModalWithPreviousContext(modal);
  }

  function handleRecurringDeleteFutureCheckpointConfirm(): void {
    const modal = getRecurringDeleteFutureCheckpointModal();
    if (!modal) return;
    const deleteModal = modal.deleteModal;
    const nowMs = Date.now();
    const nextTasks = deleteRecurringOccurrenceAndFuture(deps.state.tasks, {
      seriesTaskId: deleteModal.seriesTaskId,
      seriesId: deleteModal.seriesId,
      occurrenceIso: deleteModal.occurrenceIso,
      nowMs
    });
    deps.finishDeleteModalAction(deleteModal, deleteModal.selectedRowId, nextTasks);
  }

  function cancelRecurringDeleteFutureCheckpoint(): void {
    const modal = getRecurringDeleteFutureCheckpointModal();
    if (!modal) return;
    deps.openModalWithContext(modal.deleteModal);
  }

  function requestRecurringDeleteFutureCheckpointFromDeleteModal(): void {
    const modal = deps.uiState.modal;
    if (!modal || modal.type !== "delete" || modal.target !== "recurring_occurrence") {
      return;
    }
    deps.runRoutedAction({
      scope: "ui",
      type: "OPEN_RECURRING_DELETE_FUTURE_CHECKPOINT_MODAL",
      modal: {
        type: "recurring_delete_future_checkpoint",
        deleteModal: modal,
        previousMode: modal.previousMode,
        previousFocus: modal.previousFocus
      }
    });
  }

  function confirmDeleteSelectedFromModal() {
    deps.handleDeleteSelected();
  }

  function confirmDeleteSelectedAndFutureFromModal() {
    requestRecurringDeleteFutureCheckpointFromDeleteModal();
  }

  function cancelDeleteSelectedFromModal() {
    applyEscUnwind();
  }

  function openEmptyNuxModal(options?: {
    step?: EmptyNuxStep;
    startedFromNux?: boolean;
    createdTaskId?: string;
  }) {
    if (deps.uiState.modal && deps.uiState.modal.type !== "emptyNux") return;
    deps.uiDispatch(openEmptyNux(options));
    deps.uiDispatch({ type: "setMode", mode: Mode.MODAL_CONFIRM });
    deps.uiDispatch({ type: "setFocus", focus: FocusTarget.MODAL });
  }

  function startEmptyNuxAddFlow() {
    deps.uiDispatch(
      openEmptyNux({
        step: "adding",
        startedFromNux: true
      })
    );
    deps.uiDispatch({ type: "setModal", modal: null });
    deps.openAdd();
  }

  function dismissEmptyNuxModal() {
    deps.uiDispatch(dismissEmptyNux());
  }

  function showEmptyNuxShortcutsModal() {
    openEmptyNuxModal({ step: "shortcuts" });
  }

  function returnToEmptyNuxWelcomeModal() {
    openEmptyNuxModal({ step: "welcome" });
  }

  function clearEmptyNuxWalkthrough() {
    deps.uiDispatch(clearEmptyNux());
  }

  function closeCelebrateToList() {
    const createdTaskId = deps.uiState.emptyNux?.createdTaskId;
    deps.uiDispatch(clearEmptyNux());
    deps.clearPendingGPrefix();
    deps.closeViewsOverlay();
    deps.uiDispatch({ type: "setMode", mode: Mode.LIST });
    deps.uiDispatch({ type: "setFocus", focus: FocusTarget.TASK_LIST });
    if (createdTaskId) {
      deps.dispatch({ type: "setSelected", id: createdTaskId });
    }
  }

  function createTaskFromEmptyNuxModal() {
    startEmptyNuxAddFlow();
  }

  function getActiveOverdueModalEvent(): TaskOverdueEvent | null {
    if (deps.uiState.mode !== Mode.MODAL_CONFIRM) return null;
    if (!deps.uiState.modal || deps.uiState.modal.type !== "overdue") return null;
    return deps.uiState.modal.event;
  }

  function getActiveReminderModalEvent(): TaskReminderEvent | null {
    if (deps.uiState.mode !== Mode.MODAL_CONFIRM) return null;
    if (!deps.uiState.modal || deps.uiState.modal.type !== "reminder") return null;
    return deps.uiState.modal.event;
  }

  function handleOverdueModalSnooze() {
    const event = getActiveOverdueModalEvent();
    if (!event) return;
    const updatedTasks = applyOverdueSnooze(deps.state.tasks, event, Date.now(), 10);
    deps.dispatch({ type: "setTasks", tasks: updatedTasks });
    applyEscUnwind();
  }

  function handleOverdueModalDone() {
    const event = getActiveOverdueModalEvent();
    if (!event) return;
    const nowMs = Date.now();
    const updatedTasks = applyOverdueMarkDone(deps.state.tasks, event, nowMs);
    deps.dispatch({ type: "setTasks", tasks: updatedTasks });
    deps.emitCompletionFromDiff(deps.state.tasks, updatedTasks, nowMs);
    applyEscUnwind();
  }

  function handleOverdueModalGoToTask() {
    const event = getActiveOverdueModalEvent();
    if (!event) return;

    deps.openListMode();
    deps.dispatch({
      type: "setFilters",
      filters: {
        status: "all",
        due: "any",
        priority: undefined,
        tag: undefined,
        tagFilter: undefined,
        searchText: undefined
      }
    });

    const goToTarget = resolveGoToTaskTarget(deps.state.tasks, event);
    const revealRows = buildVisibleTaskRows(
      deps.state.tasks,
      {
        status: "all",
        due: "any",
        priority: undefined,
        tag: undefined,
        tagFilter: undefined,
        searchText: undefined
      },
      deps.state.sortMode,
      Date.now()
    );
    const selectedRow =
      revealRows.find((row) => row.id === goToTarget.preferredTaskId) ??
      (goToTarget.fallbackSourceTaskId
        ? revealRows.find((row) => row.sourceTaskId === goToTarget.fallbackSourceTaskId)
        : undefined) ??
      revealRows[0];
    if (selectedRow) {
      deps.dispatch({ type: "setSelected", id: selectedRow.id });
    }
    deps.showShortNavigationBanner(`Jumped to overdue task: ${event.title}`);
  }

  function handleReminderModalDismiss() {
    const event = getActiveReminderModalEvent();
    if (!event) return;
    const updatedTasks = applyReminderDismiss(
      deps.state.tasks,
      event.taskId,
      event.effectiveReminderAt,
      Date.now()
    );
    deps.dispatch({ type: "setTasks", tasks: updatedTasks });
    applyEscUnwind();
  }

  function handleReminderModalSnooze(deltaMs: number) {
    const event = getActiveReminderModalEvent();
    if (!event) return;
    const updatedTasks = applyReminderSnooze(
      deps.state.tasks,
      event.taskId,
      deltaMs,
      Date.now()
    );
    deps.dispatch({ type: "setTasks", tasks: updatedTasks });
    applyEscUnwind();
  }

  function handleReminderModalGoToTask() {
    const event = getActiveReminderModalEvent();
    if (!event) return;
    const task = deps.state.tasks.find((candidate) => candidate.id === event.taskId);

    deps.openListMode({ bypassUnsavedGuard: true });
    deps.dispatch({
      type: "setFilters",
      filters: {
        status: "all",
        due: "any",
        priority: undefined,
        tag: undefined,
        tagFilter: undefined,
        searchText: undefined
      }
    });

    if (!task) {
      deps.showShortNavigationBanner("Reminder task is no longer available");
      return;
    }
    deps.dispatch({ type: "setSelected", id: task.id });
    deps.showShortNavigationBanner(`Jumped to task: ${task.title}`);
  }

  return {
    applyEscUnwind,
    openUnsavedChangesModal,
    openBackupFinalCheckpointModal,
    openRecurringDeleteFutureCheckpointModal,
    openBackupFinalCheckpoint,
    handleUnsavedChangesSaveAndContinue,
    handleUnsavedChangesDiscardAndContinue,
    cancelUnsavedChangesContinue,
    handleBackupFinalCheckpointConfirm,
    cancelBackupFinalCheckpoint,
    handleRecurringDeleteFutureCheckpointConfirm,
    cancelRecurringDeleteFutureCheckpoint,
    requestRecurringDeleteFutureCheckpointFromDeleteModal,
    confirmDeleteSelectedFromModal,
    confirmDeleteSelectedAndFutureFromModal,
    cancelDeleteSelectedFromModal,
    openEmptyNuxModal,
    startEmptyNuxAddFlow,
    dismissEmptyNuxModal,
    showEmptyNuxShortcutsModal,
    returnToEmptyNuxWelcomeModal,
    clearEmptyNuxWalkthrough,
    closeCelebrateToList,
    createTaskFromEmptyNuxModal,
    handleOverdueModalSnooze,
    handleOverdueModalDone,
    handleOverdueModalGoToTask,
    handleReminderModalDismiss,
    handleReminderModalSnooze,
    handleReminderModalGoToTask
  };
}

export type { ModalHandlers, ModalOrchestrationDeps };
