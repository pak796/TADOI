import React from "react";
import type { RuntimeTheme } from "../app/theme";
import { Mode, type Task } from "../domain/models";
import { EmptyNuxModal } from "./EmptyNuxModal";
import { ModalActionButton, ModalActionRow, ModalContainer } from "./ModalPrimitives";
import { OverdueNotificationModal } from "./OverdueNotificationModal";
import { ReminderNotificationModal } from "./ReminderNotificationModal";
import type {
  EmptyNuxStep,
  UIOverdueModal,
  UIReminderModal,
  UIState,
  UITaskEditorUnsavedContinuation,
  UITaskLinkFormModal,
  UITaskLinkModalKind,
  UIUnsavedChangesModal
} from "../ui/state";

type AppModalLayerProps = {
  uiState: UIState;
  theme: RuntimeTheme;
  modalTheme: RuntimeTheme;
  inputTheme: RuntimeTheme;
  MODAL_STANDARD_WIDTH: number;
  activeEmptyNuxStep: EmptyNuxStep;
  showCorruptionRecoveryImportCta: boolean;
  activeOverdueModal: UIOverdueModal | null;
  activeOverdueTask: Task | undefined;
  activeReminderModal: UIReminderModal | null;
  activeReminderTask: Task | undefined;
  now: number;
  TASK_LINK_FORM_KIND_ORDER: UITaskLinkModalKind[];
  describeUnsavedSource: (source: UIUnsavedChangesModal["source"]) => string;
  describeTaskEditorContinuation: (continuation: UITaskEditorUnsavedContinuation) => string;
  formatLinkSnippet: (label: string | undefined, target: string) => string;
  confirmDeleteSelectedFromModal: () => void;
  confirmDeleteSelectedAndFutureFromModal: () => void;
  cancelDeleteSelectedFromModal: () => void;
  handleRecurringDeleteFutureCheckpointConfirm: () => void;
  cancelRecurringDeleteFutureCheckpoint: () => void;
  handleUnsavedChangesSaveAndContinue: () => void;
  handleUnsavedChangesDiscardAndContinue: () => void;
  cancelUnsavedChangesContinue: () => void;
  handleBackupFinalCheckpointConfirm: () => void;
  cancelBackupFinalCheckpoint: () => void;
  patchChecklistInputModal: (patch: { value?: string; error?: string }) => void;
  submitChecklistInputModal: () => void;
  handleDeleteChecklistItemFromModal: () => void;
  handleConfirmBulkDeleteFromModal: () => void;
  patchTaskLinkFormModal: (patch: Partial<UITaskLinkFormModal>) => void;
  submitTaskLinkFormModal: () => void;
  applyEscUnwind: () => void;
  handleDeleteTaskLinkFromModal: () => void;
  handleOpenExternalTaskLinkFromModal: () => void;
  handleModalSaveAndSwitchEditTarget: () => void;
  handleModalDiscardAndSwitchEditTarget: () => void;
  handleModalDiscardAndCloseEditor: () => void;
  dismissEmptyNuxModal: () => void;
  clearEmptyNuxWalkthrough: () => void;
  createTaskFromEmptyNuxModal: () => void;
  openBackupImportFromEmptyNux: () => void;
  showEmptyNuxShortcutsModal: () => void;
  returnToEmptyNuxWelcomeModal: () => void;
  closeCelebrateToList: () => void;
  handleOverdueModalSnooze: () => void;
  handleOverdueModalDone: () => void;
  handleOverdueModalGoToTask: () => void;
  handleReminderModalDismiss: () => void;
  handleReminderModalSnooze10m: () => void;
  handleReminderModalSnooze1h: () => void;
  handleReminderModalSnooze1d: () => void;
  handleReminderModalGoToTask: () => void;
};

export function AppModalLayer({
  uiState,
  theme,
  modalTheme,
  inputTheme,
  MODAL_STANDARD_WIDTH,
  activeEmptyNuxStep,
  showCorruptionRecoveryImportCta,
  activeOverdueModal,
  activeOverdueTask,
  activeReminderModal,
  activeReminderTask,
  now,
  TASK_LINK_FORM_KIND_ORDER,
  describeUnsavedSource,
  describeTaskEditorContinuation,
  formatLinkSnippet,
  confirmDeleteSelectedFromModal,
  confirmDeleteSelectedAndFutureFromModal,
  cancelDeleteSelectedFromModal,
  handleRecurringDeleteFutureCheckpointConfirm,
  cancelRecurringDeleteFutureCheckpoint,
  handleUnsavedChangesSaveAndContinue,
  handleUnsavedChangesDiscardAndContinue,
  cancelUnsavedChangesContinue,
  handleBackupFinalCheckpointConfirm,
  cancelBackupFinalCheckpoint,
  patchChecklistInputModal,
  submitChecklistInputModal,
  handleDeleteChecklistItemFromModal,
  handleConfirmBulkDeleteFromModal,
  patchTaskLinkFormModal,
  submitTaskLinkFormModal,
  applyEscUnwind,
  handleDeleteTaskLinkFromModal,
  handleOpenExternalTaskLinkFromModal,
  handleModalSaveAndSwitchEditTarget,
  handleModalDiscardAndSwitchEditTarget,
  handleModalDiscardAndCloseEditor,
  dismissEmptyNuxModal,
  clearEmptyNuxWalkthrough,
  createTaskFromEmptyNuxModal,
  openBackupImportFromEmptyNux,
  showEmptyNuxShortcutsModal,
  returnToEmptyNuxWelcomeModal,
  closeCelebrateToList,
  handleOverdueModalSnooze,
  handleOverdueModalDone,
  handleOverdueModalGoToTask,
  handleReminderModalDismiss,
  handleReminderModalSnooze10m,
  handleReminderModalSnooze1h,
  handleReminderModalSnooze1d,
  handleReminderModalGoToTask
}: AppModalLayerProps) {
  if (uiState.mode !== Mode.MODAL_CONFIRM || !uiState.modal) {
    return null;
  }

  return (
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
              <ModalContainer theme={modalTheme} tone="warning" minWidth={MODAL_STANDARD_WIDTH}>
                <text style={{ fontWeight: "bold" }}>DELETE SELECTED TASK? [Y/N/ESC]</text>
                <text>Task: {uiState.modal.taskTitle}</text>
                <text>Task ID: {uiState.modal.taskId.slice(0, 8)}</text>
                <ModalActionRow marginTop={1}>
                  <ModalActionButton
                    theme={modalTheme}
                    tone="warning"
                    label="CONFIRM DELETE [Y]"
                    onPress={confirmDeleteSelectedFromModal}
                  />
                  <ModalActionButton
                    theme={modalTheme}
                    tone="warning"
                    label="CANCEL [N/ESC]"
                    onPress={cancelDeleteSelectedFromModal}
                  />
                </ModalActionRow>
              </ModalContainer>
            ) : (
              <ModalContainer theme={modalTheme} tone="warning" minWidth={MODAL_STANDARD_WIDTH}>
                <text style={{ fontWeight: "bold" }}>DELETE RECURRING OCCURRENCE? [Y/F/N/ESC]</text>
                <text>Task: {uiState.modal.taskTitle}</text>
                <text>Occurrence: {uiState.modal.occurrenceIso.slice(0, 16)}</text>
                <ModalActionRow marginTop={1}>
                  <ModalActionButton
                    theme={modalTheme}
                    tone="warning"
                    label="THIS EVENT [Y]"
                    onPress={confirmDeleteSelectedFromModal}
                    paddingX={2}
                  />
                  <ModalActionButton
                    theme={modalTheme}
                    tone="warning"
                    label="THIS + FUTURE [F]"
                    onPress={confirmDeleteSelectedAndFutureFromModal}
                    paddingX={2}
                  />
                </ModalActionRow>
                <ModalActionRow>
                  <ModalActionButton
                    theme={modalTheme}
                    tone="warning"
                    label="CANCEL [N/ESC]"
                    onPress={cancelDeleteSelectedFromModal}
                    paddingX={2}
                  />
                </ModalActionRow>
              </ModalContainer>
            )
          ) : uiState.modal.type === "recurring_delete_future_checkpoint" ? (
            <ModalContainer theme={modalTheme} tone="warning" minWidth={MODAL_STANDARD_WIDTH}>
              <text style={{ fontWeight: "bold" }}>DELETE THIS + FUTURE OCCURRENCES? [Y/N/ESC]</text>
              <text>Task: {uiState.modal.deleteModal.taskTitle}</text>
              <text>Occurrence: {uiState.modal.deleteModal.occurrenceIso.slice(0, 16)}</text>
              <ModalActionRow marginTop={1}>
                <ModalActionButton
                  theme={modalTheme}
                  tone="warning"
                  label="CONFIRM DELETE [Y]"
                  onPress={handleRecurringDeleteFutureCheckpointConfirm}
                />
                <ModalActionButton
                  theme={modalTheme}
                  tone="warning"
                  label="CANCEL [N/ESC]"
                  onPress={cancelRecurringDeleteFutureCheckpoint}
                />
              </ModalActionRow>
            </ModalContainer>
          ) : uiState.modal.type === "checklist_input" ? (
            <ModalContainer theme={theme} width={MODAL_STANDARD_WIDTH}>
              <text style={{ color: theme.text, fontWeight: "bold" }}>
                {uiState.modal.mode === "add" ? "ADD CHECKLIST ITEM" : "EDIT CHECKLIST ITEM"}
              </text>
              <text style={{ color: theme.muted }}>Task: {uiState.modal.taskTitle}</text>
              <input
                value={uiState.modal.value}
                onChange={(value) => patchChecklistInputModal({ value, error: undefined })}
                onInput={(value) => patchChecklistInputModal({ value, error: undefined })}
                onKeyDown={(event) => {
                  if (event.name === "return" || event.name === "enter") {
                    event.preventDefault();
                    event.stopPropagation();
                    submitChecklistInputModal();
                    return;
                  }
                  if (event.name === "escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    applyEscUnwind();
                  }
                }}
                focused
                placeholder="Checklist item text"
                style={{
                  backgroundColor: inputTheme.bg,
                  color: inputTheme.text
                }}
              />
              {uiState.modal.error ? (
                <text style={{ color: theme.warn }}>{uiState.modal.error}</text>
              ) : null}
              <ModalActionRow>
                <ModalActionButton
                  theme={theme}
                  label="SAVE [ENTER]"
                  onPress={submitChecklistInputModal}
                />
                <ModalActionButton theme={theme} label="CANCEL [ESC]" onPress={applyEscUnwind} />
              </ModalActionRow>
            </ModalContainer>
          ) : uiState.modal.type === "checklist_delete" ? (
            <ModalContainer theme={modalTheme} tone="warning" minWidth={MODAL_STANDARD_WIDTH}>
              <text style={{ fontWeight: "bold" }}>DELETE CHECKLIST ITEM? [Y/N/ESC]</text>
              <text>Task: {uiState.modal.taskTitle}</text>
              <text>Item: {uiState.modal.itemText}</text>
              <ModalActionRow>
                <ModalActionButton
                  theme={modalTheme}
                  tone="warning"
                  label="CONFIRM DELETE [Y]"
                  onPress={handleDeleteChecklistItemFromModal}
                />
                <ModalActionButton
                  theme={modalTheme}
                  tone="warning"
                  label="CANCEL [N/ESC]"
                  onPress={applyEscUnwind}
                />
              </ModalActionRow>
            </ModalContainer>
          ) : uiState.modal.type === "bulk_delete" ? (
            <ModalContainer theme={modalTheme} tone="warning" minWidth={MODAL_STANDARD_WIDTH}>
              <text style={{ fontWeight: "bold" }}>
                DELETE {String(uiState.modal.taskIds.length)} TASKS? [Y/N/ESC]
              </text>
              <text>
                {uiState.modal.recurringSeriesCount > 0
                  ? `Recurring series included: ${String(uiState.modal.recurringSeriesCount)}.`
                  : "No recurring series in selection."}
              </text>
              <ModalActionRow>
                <ModalActionButton
                  theme={modalTheme}
                  tone="warning"
                  label="CONFIRM DELETE [Y]"
                  onPress={handleConfirmBulkDeleteFromModal}
                />
                <ModalActionButton
                  theme={modalTheme}
                  tone="warning"
                  label="CANCEL [N/ESC]"
                  onPress={applyEscUnwind}
                />
              </ModalActionRow>
            </ModalContainer>
          ) : uiState.modal.type === "unsaved_changes" ? (
            <ModalContainer theme={theme} minWidth={MODAL_STANDARD_WIDTH}>
              <text style={{ color: theme.text, fontWeight: "bold" }}>UNSAVED CHANGES</text>
              <text style={{ color: theme.muted }}>{describeUnsavedSource(uiState.modal.source)}</text>
              <text style={{ color: theme.muted }}>
                {uiState.modal.source === "task_editor"
                  ? `Continue action: ${describeTaskEditorContinuation(uiState.modal.continuation)}.`
                  : uiState.modal.continuation === "close_help"
                    ? "Continue action: close help."
                    : "Continue action: leave theme editor."}
              </text>
              <ModalActionRow>
                <ModalActionButton
                  theme={theme}
                  label="SAVE + CONTINUE [S]"
                  onPress={handleUnsavedChangesSaveAndContinue}
                  paddingX={2}
                />
                <ModalActionButton
                  theme={theme}
                  label="DISCARD + CONTINUE [D]"
                  onPress={handleUnsavedChangesDiscardAndContinue}
                  paddingX={2}
                />
              </ModalActionRow>
              <ModalActionRow>
                <ModalActionButton
                  theme={theme}
                  label="CANCEL [C/N/ESC]"
                  onPress={cancelUnsavedChangesContinue}
                  paddingX={2}
                />
              </ModalActionRow>
            </ModalContainer>
          ) : uiState.modal.type === "backup_final_checkpoint" ? (
            <ModalContainer theme={theme} minWidth={MODAL_STANDARD_WIDTH}>
              <text style={{ color: theme.text, fontWeight: "bold" }}>FINAL IMPORT CHECKPOINT</text>
              <text style={{ color: theme.muted }}>
                {uiState.modal.checkpoint === "data_import"
                  ? "Commit backup data import now?"
                  : "Commit calendar import now?"}
              </text>
              <text style={{ color: theme.muted }}>
                This writes changes and cannot be undone from this screen.
              </text>
              <ModalActionRow>
                <ModalActionButton
                  theme={theme}
                  label="COMMIT [Y]"
                  onPress={handleBackupFinalCheckpointConfirm}
                />
                <ModalActionButton
                  theme={theme}
                  label="CANCEL [N/ESC]"
                  onPress={cancelBackupFinalCheckpoint}
                />
              </ModalActionRow>
            </ModalContainer>
          ) : uiState.modal.type === "task_link_form" ? (
            <ModalContainer theme={theme} width={MODAL_STANDARD_WIDTH}>
              <text style={{ color: theme.text, fontWeight: "bold" }}>
                {uiState.modal.mode === "add" ? "ADD LINK / ATTACHMENT" : "EDIT LINK / ATTACHMENT"}
              </text>
              <text style={{ color: theme.muted }}>
                Tab: next field. Up/Down: move focus. Left/Right: cycle type. Enter/Ctrl+S:
                save. Esc: cancel.
              </text>
              <box
                style={{ flexDirection: "column" }}
                onMouseDown={(event) => {
                  if (event.button !== 0) return;
                  patchTaskLinkFormModal({ activeField: "label" });
                }}
              >
                <text style={{ color: theme.muted }}>Label (optional)</text>
                <input
                  value={uiState.modal.labelValue}
                  onChange={(value) =>
                    patchTaskLinkFormModal({
                      labelValue: value,
                      error: undefined
                    })
                  }
                  focused={uiState.modal.activeField === "label"}
                  placeholder="e.g. Design doc"
                  style={{ backgroundColor: inputTheme.bg, color: inputTheme.text }}
                />
              </box>
              <box
                style={{ flexDirection: "column" }}
                onMouseDown={(event) => {
                  if (event.button !== 0) return;
                  patchTaskLinkFormModal({ activeField: "target" });
                }}
              >
                <text style={{ color: theme.muted }}>Target *</text>
                <input
                  value={uiState.modal.targetValue}
                  onChange={(value) =>
                    patchTaskLinkFormModal({
                      targetValue: value,
                      error: undefined
                    })
                  }
                  focused={uiState.modal.activeField === "target"}
                  placeholder="https://... or /path/to/file"
                  style={{ backgroundColor: inputTheme.bg, color: inputTheme.text }}
                />
              </box>
              <box style={{ flexDirection: "column" }}>
                <text style={{ color: theme.muted }}>
                  Type ({uiState.modal.activeField === "type" ? "active field" : "auto/url/path"})
                </text>
                <ModalActionRow>
                  {TASK_LINK_FORM_KIND_ORDER.map((kind) => {
                    const selected = uiState.modal.kindValue === kind;
                    return (
                      <ModalActionButton
                        key={kind}
                        theme={theme}
                        label={kind.toUpperCase()}
                        active={selected}
                        paddingX={2}
                        onPress={() => {
                          patchTaskLinkFormModal({
                            kindValue: kind,
                            activeField: "type",
                            error: undefined
                          });
                        }}
                      />
                    );
                  })}
                </ModalActionRow>
              </box>
              {uiState.modal.error ? (
                <text style={{ color: theme.warn }}>{uiState.modal.error}</text>
              ) : null}
              <ModalActionRow>
                <ModalActionButton
                  theme={theme}
                  label="SAVE [CTRL+S/ENTER]"
                  active={uiState.modal.activeField === "save"}
                  onPress={submitTaskLinkFormModal}
                  paddingX={2}
                />
                <ModalActionButton
                  theme={theme}
                  label="CANCEL [ESC/ENTER]"
                  active={uiState.modal.activeField === "cancel"}
                  onPress={applyEscUnwind}
                  paddingX={2}
                />
              </ModalActionRow>
            </ModalContainer>
          ) : uiState.modal.type === "task_link_delete" ? (
            <ModalContainer theme={modalTheme} tone="warning" minWidth={MODAL_STANDARD_WIDTH}>
              <text style={{ fontWeight: "bold" }}>REMOVE LINK? [Y/N/ESC]</text>
              <text>{formatLinkSnippet(uiState.modal.label, uiState.modal.target)}</text>
              <ModalActionRow marginTop={1}>
                <ModalActionButton
                  theme={modalTheme}
                  tone="warning"
                  label="REMOVE [Y]"
                  onPress={handleDeleteTaskLinkFromModal}
                />
                <ModalActionButton
                  theme={modalTheme}
                  tone="warning"
                  label="CANCEL [N/ESC]"
                  onPress={applyEscUnwind}
                />
              </ModalActionRow>
            </ModalContainer>
          ) : uiState.modal.type === "task_link_open_external" ? (
            <ModalContainer theme={modalTheme} tone="warning" minWidth={MODAL_STANDARD_WIDTH}>
              <text style={{ fontWeight: "bold" }}>{`OPEN EXTERNAL SCHEME "${uiState.modal.scheme}"? [Y/N/ESC]`}</text>
              <text>{formatLinkSnippet(undefined, uiState.modal.target)}</text>
              <ModalActionRow marginTop={1}>
                <ModalActionButton
                  theme={modalTheme}
                  tone="warning"
                  label="OPEN LINK [Y]"
                  onPress={handleOpenExternalTaskLinkFromModal}
                />
                <ModalActionButton
                  theme={modalTheme}
                  tone="warning"
                  label="CANCEL [N/ESC]"
                  onPress={applyEscUnwind}
                />
              </ModalActionRow>
            </ModalContainer>
          ) : uiState.modal.type === "edit_switch_confirm" ? (
            <ModalContainer theme={theme} minWidth={MODAL_STANDARD_WIDTH}>
              <text style={{ color: theme.text, fontWeight: "bold" }}>UNSAVED CHANGES</text>
              <text style={{ color: theme.muted }}>
                {`Switch edit target to this task: ${uiState.modal.toTaskTitle}.`}
              </text>
              <ModalActionRow>
                <ModalActionButton
                  theme={theme}
                  label="SAVE + SWITCH [S]"
                  onPress={handleModalSaveAndSwitchEditTarget}
                  paddingX={2}
                />
                <ModalActionButton
                  theme={theme}
                  label="DISCARD + SWITCH [D]"
                  onPress={handleModalDiscardAndSwitchEditTarget}
                  paddingX={2}
                />
              </ModalActionRow>
              <ModalActionRow>
                <ModalActionButton
                  theme={theme}
                  label="DISCARD + CLOSE [C]"
                  onPress={handleModalDiscardAndCloseEditor}
                  paddingX={2}
                />
                <ModalActionButton
                  theme={theme}
                  label="CANCEL [ESC]"
                  onPress={applyEscUnwind}
                  paddingX={2}
                />
              </ModalActionRow>
            </ModalContainer>
          ) : uiState.modal.type === "emptyNux" ? (
            <EmptyNuxModal
              step={activeEmptyNuxStep}
              onDismissSession={dismissEmptyNuxModal}
              onClearWalkthrough={clearEmptyNuxWalkthrough}
              onCreateTask={createTaskFromEmptyNuxModal}
              onOpenBackupImport={openBackupImportFromEmptyNux}
              onShowShortcuts={showEmptyNuxShortcutsModal}
              onBackToWelcome={returnToEmptyNuxWelcomeModal}
              onGoToList={closeCelebrateToList}
              showImportBackupAction={
                showCorruptionRecoveryImportCta && activeEmptyNuxStep === "welcome"
              }
            />
          ) : activeReminderModal ? (
            <ReminderNotificationModal
              event={activeReminderModal.event}
              task={activeReminderTask}
              onDismiss={handleReminderModalDismiss}
              onSnooze10m={handleReminderModalSnooze10m}
              onSnooze1h={handleReminderModalSnooze1h}
              onSnooze1d={handleReminderModalSnooze1d}
              onGoToTask={handleReminderModalGoToTask}
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
  );
}
