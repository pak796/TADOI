import React from "react";
import type { RuntimeTheme } from "../app/theme";
import { Mode, type Task } from "../domain/models";
import { EmptyNuxModal } from "./EmptyNuxModal";
import { OverdueNotificationModal } from "./OverdueNotificationModal";
import type {
  EmptyNuxStep,
  UIOverdueModal,
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
  handleOverdueModalGoToTask
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
              <box
                style={{
                  padding: 2,
                  backgroundColor: modalTheme.warn,
                  color: modalTheme.bg,
                  minWidth: MODAL_STANDARD_WIDTH
                }}
              >
                <text>DELETE SELECTED TASK? [Y/N]</text>
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
                    <text style={{ color: modalTheme.warn, fontWeight: "bold" }}>YES [Y]</text>
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
                    <text style={{ color: modalTheme.warn, fontWeight: "bold" }}>NO [N]</text>
                  </box>
                </box>
              </box>
            ) : (
              <box
                style={{
                  padding: 2,
                  backgroundColor: modalTheme.warn,
                  color: modalTheme.bg,
                  minWidth: MODAL_STANDARD_WIDTH
                }}
              >
                <text>DELETE RECURRING OCCURRENCE? [Y/F/N]</text>
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
                      THIS EVENT [Y]
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
                      THIS + FUTURE [F]
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
                      CANCEL [N]
                    </text>
                  </box>
                </box>
              </box>
            )
          ) : uiState.modal.type === "recurring_delete_future_checkpoint" ? (
            <box
              style={{
                padding: 2,
                backgroundColor: modalTheme.warn,
                color: modalTheme.bg,
                minWidth: MODAL_STANDARD_WIDTH
              }}
            >
              <text>DELETE THIS + FUTURE OCCURRENCES? [Y/N]</text>
              <text>{uiState.modal.deleteModal.taskTitle}</text>
              <text>OCCURRENCE: {uiState.modal.deleteModal.occurrenceIso.slice(0, 16)}</text>
              <box style={{ flexDirection: "row", gap: 1, marginTop: 1 }}>
                <box
                  style={{
                    backgroundColor: modalTheme.bg,
                    paddingLeft: 2,
                    paddingRight: 2
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    handleRecurringDeleteFutureCheckpointConfirm();
                  }}
                >
                  <text style={{ color: modalTheme.warn, fontWeight: "bold" }}>YES [Y]</text>
                </box>
                <box
                  style={{
                    backgroundColor: modalTheme.bg,
                    paddingLeft: 2,
                    paddingRight: 2
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    cancelRecurringDeleteFutureCheckpoint();
                  }}
                >
                  <text style={{ color: modalTheme.warn, fontWeight: "bold" }}>NO [N/ESC]</text>
                </box>
              </box>
            </box>
          ) : uiState.modal.type === "checklist_input" ? (
            <box
              style={{
                padding: 2,
                backgroundColor: theme.panel,
                border: true,
                borderStyle: "single",
                borderColor: theme.outline,
                width: MODAL_STANDARD_WIDTH,
                flexDirection: "column",
                gap: 1
              }}
            >
              <text style={{ color: theme.text, fontWeight: "bold" }}>
                {uiState.modal.mode === "add" ? "ADD CHECKLIST ITEM" : "EDIT CHECKLIST ITEM"}
              </text>
              <text style={{ color: theme.muted }}>{uiState.modal.taskTitle}</text>
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
              <box style={{ flexDirection: "row", gap: 1 }}>
                <box
                  style={{
                    backgroundColor: theme.panel,
                    border: true,
                    borderStyle: "single",
                    borderColor: theme.outline,
                    paddingLeft: 2,
                    paddingRight: 2
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    submitChecklistInputModal();
                  }}
                >
                  <text style={{ color: theme.text, fontWeight: "bold" }}>SAVE [ENTER]</text>
                </box>
                <box
                  style={{
                    backgroundColor: theme.panel,
                    border: true,
                    borderStyle: "single",
                    borderColor: theme.outline,
                    paddingLeft: 2,
                    paddingRight: 2
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    applyEscUnwind();
                  }}
                >
                  <text style={{ color: theme.text, fontWeight: "bold" }}>CANCEL [ESC]</text>
                </box>
              </box>
            </box>
          ) : uiState.modal.type === "checklist_delete" ? (
            <box
              style={{
                padding: 2,
                backgroundColor: modalTheme.warn,
                color: modalTheme.bg,
                minWidth: MODAL_STANDARD_WIDTH,
                flexDirection: "column",
                gap: 1
              }}
            >
              <text>DELETE CHECKLIST ITEM? [Y/N]</text>
              <text>{uiState.modal.taskTitle}</text>
              <text>{uiState.modal.itemText}</text>
              <box style={{ flexDirection: "row", gap: 1 }}>
                <box
                  style={{
                    backgroundColor: modalTheme.bg,
                    paddingLeft: 2,
                    paddingRight: 2
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    handleDeleteChecklistItemFromModal();
                  }}
                >
                  <text style={{ color: modalTheme.warn, fontWeight: "bold" }}>YES [Y]</text>
                </box>
                <box
                  style={{
                    backgroundColor: modalTheme.bg,
                    paddingLeft: 2,
                    paddingRight: 2
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    applyEscUnwind();
                  }}
                >
                  <text style={{ color: modalTheme.warn, fontWeight: "bold" }}>NO [N]</text>
                </box>
              </box>
            </box>
          ) : uiState.modal.type === "bulk_delete" ? (
            <box
              style={{
                padding: 2,
                backgroundColor: modalTheme.warn,
                color: modalTheme.bg,
                minWidth: MODAL_STANDARD_WIDTH,
                flexDirection: "column",
                gap: 1
              }}
            >
              <text>DELETE {String(uiState.modal.taskIds.length)} TASKS? [Y/N]</text>
              <text>
                {uiState.modal.recurringSeriesCount > 0
                  ? `${String(uiState.modal.recurringSeriesCount)} recurring series included`
                  : "No recurring series in selection"}
              </text>
              <box style={{ flexDirection: "row", gap: 1 }}>
                <box
                  style={{
                    backgroundColor: modalTheme.bg,
                    paddingLeft: 2,
                    paddingRight: 2
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    handleConfirmBulkDeleteFromModal();
                  }}
                >
                  <text style={{ color: modalTheme.warn, fontWeight: "bold" }}>YES [Y]</text>
                </box>
                <box
                  style={{
                    backgroundColor: modalTheme.bg,
                    paddingLeft: 2,
                    paddingRight: 2
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    applyEscUnwind();
                  }}
                >
                  <text style={{ color: modalTheme.warn, fontWeight: "bold" }}>NO [N]</text>
                </box>
              </box>
            </box>
          ) : uiState.modal.type === "unsaved_changes" ? (
            <box
              style={{
                padding: 2,
                backgroundColor: theme.panel,
                border: true,
                borderStyle: "single",
                borderColor: theme.outline,
                minWidth: MODAL_STANDARD_WIDTH,
                flexDirection: "column",
                gap: 1
              }}
            >
              <text style={{ color: theme.text, fontWeight: "bold" }}>UNSAVED CHANGES</text>
              <text style={{ color: theme.muted }}>{describeUnsavedSource(uiState.modal.source)}</text>
              <text style={{ color: theme.muted }}>
                {uiState.modal.source === "task_editor"
                  ? `Continue action: ${describeTaskEditorContinuation(uiState.modal.continuation)}.`
                  : uiState.modal.continuation === "close_help"
                    ? "Continue action: close help."
                    : "Continue action: leave theme editor."}
              </text>
              <box style={{ flexDirection: "row", gap: 1 }}>
                <box
                  style={{
                    backgroundColor: theme.panel,
                    border: true,
                    borderStyle: "single",
                    borderColor: theme.outline,
                    paddingLeft: 2,
                    paddingRight: 2
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    handleUnsavedChangesSaveAndContinue();
                  }}
                >
                  <text style={{ color: theme.text, fontWeight: "bold" }}>
                    [S] Save+Continue
                  </text>
                </box>
                <box
                  style={{
                    backgroundColor: theme.panel,
                    border: true,
                    borderStyle: "single",
                    borderColor: theme.outline,
                    paddingLeft: 2,
                    paddingRight: 2
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    handleUnsavedChangesDiscardAndContinue();
                  }}
                >
                  <text style={{ color: theme.text, fontWeight: "bold" }}>
                    [D] Discard+Continue
                  </text>
                </box>
              </box>
              <box style={{ flexDirection: "row", gap: 1 }}>
                <box
                  style={{
                    backgroundColor: theme.panel,
                    border: true,
                    borderStyle: "single",
                    borderColor: theme.outline,
                    paddingLeft: 2,
                    paddingRight: 2
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    cancelUnsavedChangesContinue();
                  }}
                >
                  <text style={{ color: theme.text, fontWeight: "bold" }}>[C/Esc] Cancel</text>
                </box>
              </box>
            </box>
          ) : uiState.modal.type === "backup_final_checkpoint" ? (
            <box
              style={{
                padding: 2,
                backgroundColor: theme.panel,
                border: true,
                borderStyle: "single",
                borderColor: theme.outline,
                minWidth: MODAL_STANDARD_WIDTH,
                flexDirection: "column",
                gap: 1
              }}
            >
              <text style={{ color: theme.text, fontWeight: "bold" }}>FINAL IMPORT CHECKPOINT</text>
              <text style={{ color: theme.muted }}>
                {uiState.modal.checkpoint === "data_import"
                  ? "Commit backup data import now?"
                  : "Commit calendar import now?"}
              </text>
              <text style={{ color: theme.muted }}>
                This writes changes and cannot be undone from this screen.
              </text>
              <box style={{ flexDirection: "row", gap: 1 }}>
                <box
                  style={{
                    backgroundColor: theme.panel,
                    border: true,
                    borderStyle: "single",
                    borderColor: theme.outline,
                    paddingLeft: 2,
                    paddingRight: 2
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    handleBackupFinalCheckpointConfirm();
                  }}
                >
                  <text style={{ color: theme.text, fontWeight: "bold" }}>COMMIT [Y]</text>
                </box>
                <box
                  style={{
                    backgroundColor: theme.panel,
                    border: true,
                    borderStyle: "single",
                    borderColor: theme.outline,
                    paddingLeft: 2,
                    paddingRight: 2
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    cancelBackupFinalCheckpoint();
                  }}
                >
                  <text style={{ color: theme.text, fontWeight: "bold" }}>CANCEL [N/ESC]</text>
                </box>
              </box>
            </box>
          ) : uiState.modal.type === "task_link_form" ? (
            <box
              style={{
                padding: 2,
                backgroundColor: theme.panel,
                border: true,
                borderStyle: "single",
                borderColor: theme.outline,
                width: MODAL_STANDARD_WIDTH,
                flexDirection: "column",
                gap: 1
              }}
            >
              <text style={{ color: theme.text, fontWeight: "bold" }}>
                {uiState.modal.mode === "add"
                  ? "ADD LINK / ATTACHMENT"
                  : "EDIT LINK / ATTACHMENT"}
              </text>
              <text style={{ color: theme.muted }}>
                [TAB] NEXT  [UP/DOWN] MOVE  [LEFT/RIGHT] TYPE  [ENTER/CTRL+S] SAVE  [ESC] CANCEL
              </text>
              <box
                style={{ flexDirection: "column" }}
                onMouseDown={(event) => {
                  if (event.button !== 0) return;
                  patchTaskLinkFormModal({ activeField: "label" });
                }}
              >
                <text style={{ color: theme.muted }}>LABEL (OPTIONAL)</text>
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
                <text style={{ color: theme.muted }}>TARGET *</text>
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
                  TYPE ({uiState.modal.activeField === "type" ? "ACTIVE" : "AUTO/URL/PATH"})
                </text>
                <box style={{ flexDirection: "row", gap: 1 }}>
                  {TASK_LINK_FORM_KIND_ORDER.map((kind) => {
                    const selected = uiState.modal.kindValue === kind;
                    return (
                      <box
                        key={kind}
                        style={{
                          paddingLeft: 2,
                          paddingRight: 2,
                          backgroundColor: selected ? theme.accentBlue : theme.panel,
                          border: true,
                          borderStyle: "single",
                          borderColor:
                            uiState.modal.activeField === "type"
                              ? theme.accentBlue
                              : theme.outline
                        }}
                        onMouseDown={(event) => {
                          if (event.button !== 0) return;
                          patchTaskLinkFormModal({
                            kindValue: kind,
                            activeField: "type",
                            error: undefined
                          });
                        }}
                      >
                        <text style={{ color: selected ? theme.bg : theme.text }}>
                          {kind.toUpperCase()}
                        </text>
                      </box>
                    );
                  })}
                </box>
              </box>
              {uiState.modal.error ? (
                <text style={{ color: theme.warn }}>{uiState.modal.error}</text>
              ) : null}
              <box style={{ flexDirection: "row", gap: 1 }}>
                <box
                  style={{
                    backgroundColor:
                      uiState.modal.activeField === "save" ? theme.accentBlue : theme.panel,
                    border: true,
                    borderStyle: "single",
                    borderColor: theme.outline,
                    paddingLeft: 2,
                    paddingRight: 2
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    submitTaskLinkFormModal();
                  }}
                >
                  <text
                    style={{
                      color: uiState.modal.activeField === "save" ? theme.bg : theme.text,
                      fontWeight: "bold"
                    }}
                  >
                    SAVE [ENTER/CTRL+S]
                  </text>
                </box>
                <box
                  style={{
                    backgroundColor:
                      uiState.modal.activeField === "cancel" ? theme.accentBlue : theme.panel,
                    border: true,
                    borderStyle: "single",
                    borderColor: theme.outline,
                    paddingLeft: 2,
                    paddingRight: 2
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    applyEscUnwind();
                  }}
                >
                  <text
                    style={{
                      color: uiState.modal.activeField === "cancel" ? theme.bg : theme.text,
                      fontWeight: "bold"
                    }}
                  >
                    CANCEL [ESC]
                  </text>
                </box>
              </box>
            </box>
          ) : uiState.modal.type === "task_link_delete" ? (
            <box
              style={{
                padding: 2,
                backgroundColor: modalTheme.warn,
                color: modalTheme.bg,
                minWidth: MODAL_STANDARD_WIDTH
              }}
            >
              <text>REMOVE LINK? [Y/N]</text>
              <text>{formatLinkSnippet(uiState.modal.label, uiState.modal.target)}</text>
              <box style={{ flexDirection: "row", gap: 1, marginTop: 1 }}>
                <box
                  style={{ backgroundColor: modalTheme.bg, paddingLeft: 2, paddingRight: 2 }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    handleDeleteTaskLinkFromModal();
                  }}
                >
                  <text style={{ color: modalTheme.warn, fontWeight: "bold" }}>YES [Y]</text>
                </box>
                <box
                  style={{ backgroundColor: modalTheme.bg, paddingLeft: 2, paddingRight: 2 }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    applyEscUnwind();
                  }}
                >
                  <text style={{ color: modalTheme.warn, fontWeight: "bold" }}>NO [N]</text>
                </box>
              </box>
            </box>
          ) : uiState.modal.type === "task_link_open_external" ? (
            <box
              style={{
                padding: 2,
                backgroundColor: modalTheme.warn,
                color: modalTheme.bg,
                minWidth: MODAL_STANDARD_WIDTH
              }}
            >
              <text>{`OPEN EXTERNAL SCHEME \"${uiState.modal.scheme}\"? [Y/N]`}</text>
              <text>{formatLinkSnippet(undefined, uiState.modal.target)}</text>
              <box style={{ flexDirection: "row", gap: 1, marginTop: 1 }}>
                <box
                  style={{ backgroundColor: modalTheme.bg, paddingLeft: 2, paddingRight: 2 }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    handleOpenExternalTaskLinkFromModal();
                  }}
                >
                  <text style={{ color: modalTheme.warn, fontWeight: "bold" }}>YES [Y]</text>
                </box>
                <box
                  style={{ backgroundColor: modalTheme.bg, paddingLeft: 2, paddingRight: 2 }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    applyEscUnwind();
                  }}
                >
                  <text style={{ color: modalTheme.warn, fontWeight: "bold" }}>NO [N]</text>
                </box>
              </box>
            </box>
          ) : uiState.modal.type === "edit_switch_confirm" ? (
            <box
              style={{
                padding: 2,
                backgroundColor: theme.panel,
                border: true,
                borderStyle: "single",
                borderColor: theme.outline,
                minWidth: MODAL_STANDARD_WIDTH,
                flexDirection: "column",
                gap: 1
              }}
            >
              <text style={{ color: theme.text, fontWeight: "bold" }}>UNSAVED CHANGES</text>
              <text style={{ color: theme.muted }}>
                {`Switch edit target to: ${uiState.modal.toTaskTitle}`}
              </text>
              <box style={{ flexDirection: "row", gap: 1 }}>
                <box
                  style={{
                    backgroundColor: theme.panel,
                    border: true,
                    borderStyle: "single",
                    borderColor: theme.outline,
                    paddingLeft: 2,
                    paddingRight: 2
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    handleModalSaveAndSwitchEditTarget();
                  }}
                >
                  <text style={{ color: theme.text, fontWeight: "bold" }}>
                    [S] Save+Switch
                  </text>
                </box>
                <box
                  style={{
                    backgroundColor: theme.panel,
                    border: true,
                    borderStyle: "single",
                    borderColor: theme.outline,
                    paddingLeft: 2,
                    paddingRight: 2
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    handleModalDiscardAndSwitchEditTarget();
                  }}
                >
                  <text style={{ color: theme.text, fontWeight: "bold" }}>
                    [D] Discard+Switch
                  </text>
                </box>
              </box>
              <box style={{ flexDirection: "row", gap: 1 }}>
                <box
                  style={{
                    backgroundColor: theme.panel,
                    border: true,
                    borderStyle: "single",
                    borderColor: theme.outline,
                    paddingLeft: 2,
                    paddingRight: 2
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    handleModalDiscardAndCloseEditor();
                  }}
                >
                  <text style={{ color: theme.text, fontWeight: "bold" }}>
                    [C] Discard+Close
                  </text>
                </box>
                <box
                  style={{
                    backgroundColor: theme.panel,
                    border: true,
                    borderStyle: "single",
                    borderColor: theme.outline,
                    paddingLeft: 2,
                    paddingRight: 2
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    applyEscUnwind();
                  }}
                >
                  <text style={{ color: theme.text, fontWeight: "bold" }}>[Esc] Cancel</text>
                </box>
              </box>
            </box>
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
