import { themeForObject } from "../app/theme";
import type { EmptyNuxStep } from "../ui/state";
import { ModalActionButton, ModalActionRow, ModalContainer } from "./ModalPrimitives";

type EmptyNuxModalProps = {
  step: EmptyNuxStep;
  onCreateTask: () => void;
  onOpenBackupImport: () => void;
  onShowShortcuts: () => void;
  onBackToWelcome: () => void;
  onDismissSession: () => void;
  onClearWalkthrough: () => void;
  onGoToList: () => void;
  showImportBackupAction?: boolean;
};

export type EmptyNuxModalMeta = {
  title: string;
  closeAction: "dismiss_session" | "clear_walkthrough";
};

export function resolveEmptyNuxModalMeta(step: EmptyNuxStep): EmptyNuxModalMeta {
  if (step === "shortcuts") {
    return { title: "TADOI SHORTCUTS", closeAction: "clear_walkthrough" };
  }
  if (step === "celebrate") {
    return { title: "FIRST TASK CREATED", closeAction: "clear_walkthrough" };
  }
  return { title: "WELCOME TO TADOI", closeAction: "dismiss_session" };
}

export function EmptyNuxModal({
  step,
  onCreateTask,
  onOpenBackupImport,
  onShowShortcuts,
  onBackToWelcome,
  onDismissSession,
  onClearWalkthrough,
  onGoToList,
  showImportBackupAction = false
}: EmptyNuxModalProps) {
  const theme = themeForObject("modal");
  const modalWidth = 64;
  const meta = resolveEmptyNuxModalMeta(step);
  const closeAction =
    meta.closeAction === "dismiss_session" ? onDismissSession : onClearWalkthrough;

  return (
    <ModalContainer theme={theme} minWidth={modalWidth}>
      <box style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <text style={{ fontWeight: "bold" }}>{meta.title}</text>
        <ModalActionButton theme={theme} label="CLOSE" onPress={closeAction} paddingX={1} />
      </box>

      {step === "welcome" ? (
        <>
          <text style={{ marginTop: 1 }}>Press A or Enter to create your first task.</text>
          <text style={{ color: theme.muted }}>Press S or Esc to skip for this session.</text>
          <ModalActionRow marginTop={1}>
            <ModalActionButton
              theme={theme}
              label="CREATE TASK [A/ENTER]"
              primary
              onPress={onCreateTask}
            />
            {showImportBackupAction ? (
              <ModalActionButton
                theme={theme}
                label="IMPORT BACKUP [I]"
                onPress={onOpenBackupImport}
              />
            ) : null}
            <ModalActionButton theme={theme} label="SHORTCUTS [H]" onPress={onShowShortcuts} />
            <ModalActionButton
              theme={theme}
              label="SKIP SESSION [S/ESC]"
              onPress={onDismissSession}
            />
          </ModalActionRow>
        </>
      ) : null}

      {step === "shortcuts" ? (
        <>
          <text style={{ marginTop: 1 }}>A/Enter: create task.</text>
          <text>Esc: back to welcome.</text>
          <text>J/K or arrows: move selection.</text>
          <text style={{ color: theme.muted }}>Use ? anytime to open full help.</text>
          <ModalActionRow marginTop={1}>
            <ModalActionButton
              theme={theme}
              label="BACK TO WELCOME [ESC]"
              onPress={onBackToWelcome}
            />
            <ModalActionButton
              theme={theme}
              label="CREATE TASK [A/ENTER]"
              primary
              onPress={onCreateTask}
            />
          </ModalActionRow>
        </>
      ) : null}

      {step === "celebrate" ? (
        <>
          <text style={{ marginTop: 1 }}>Nice start. Your first task is saved.</text>
          <text style={{ color: theme.muted }}>
            Press Enter to return to list, or create another task.
          </text>
          <ModalActionRow marginTop={1}>
            <ModalActionButton
              theme={theme}
              label="GO TO LIST [ENTER]"
              primary
              onPress={onGoToList}
            />
            <ModalActionButton theme={theme} label="ADD ANOTHER [A]" onPress={onCreateTask} />
            <ModalActionButton theme={theme} label="SHORTCUTS [H]" onPress={onShowShortcuts} />
            <ModalActionButton
              theme={theme}
              label="CLOSE [ESC]"
              onPress={onClearWalkthrough}
            />
          </ModalActionRow>
        </>
      ) : null}
    </ModalContainer>
  );
}
