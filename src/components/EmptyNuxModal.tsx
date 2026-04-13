import { themeForObject } from "../app/theme";
import type { EmptyNuxStep } from "../ui/state";
import {
  ModalActionButton,
  ModalActionRow,
  ModalContainer,
} from "./ModalPrimitives";

type EmptyNuxModalProps = {
  step: EmptyNuxStep;
  onCreateTask: () => void;
  onOpenBackupImport: () => void;
  onShowShortcuts: () => void;
  onBackToWelcome: () => void;
  onOpenWhatNext: () => void;
  onOpenFirstTome: () => void;
  onOpenChecklistAdd: () => void;
  onDismissSession: () => void;
  onClearWalkthrough: () => void;
  onGoToList: () => void;
  onboardingProgress: EmptyNuxOnboardingProgress;
  showImportBackupAction?: boolean;
};

export type EmptyNuxOnboardingProgress = {
  firstTask: boolean;
  firstTome: boolean;
  firstChecklistComplete: boolean;
  completed: number;
  total: 3;
};

export type EmptyNuxModalMeta = {
  title: string;
  closeAction: "dismiss_session" | "clear_walkthrough";
};

export function resolveEmptyNuxModalMeta(
  step: EmptyNuxStep,
): EmptyNuxModalMeta {
  if (step === "shortcuts") {
    return { title: "TADOI SHORTCUTS", closeAction: "clear_walkthrough" };
  }
  if (step === "celebrate") {
    return { title: "FIRST TASK CREATED", closeAction: "clear_walkthrough" };
  }
  if (step === "what_next") {
    return { title: "WHAT NEXT", closeAction: "clear_walkthrough" };
  }
  return { title: "WELCOME TO TADOI", closeAction: "dismiss_session" };
}

export function describeOnboardingProgress(
  progress: EmptyNuxOnboardingProgress,
): {
  label: string;
  chips: string[];
} {
  return {
    label: `ONBOARDING ${String(progress.completed)}/${String(progress.total)}`,
    chips: [
      `${progress.firstTask ? "[x]" : "[ ]"} TASK`,
      `${progress.firstTome ? "[x]" : "[ ]"} TOME`,
      `${progress.firstChecklistComplete ? "[x]" : "[ ]"} CHECKLIST`,
    ],
  };
}

export function EmptyNuxModal({
  step,
  onCreateTask,
  onOpenBackupImport,
  onShowShortcuts,
  onBackToWelcome,
  onOpenWhatNext,
  onOpenFirstTome,
  onOpenChecklistAdd,
  onDismissSession,
  onClearWalkthrough,
  onGoToList,
  onboardingProgress,
  showImportBackupAction = false,
}: EmptyNuxModalProps) {
  const theme = themeForObject("modal");
  const modalWidth = 64;
  const meta = resolveEmptyNuxModalMeta(step);
  const closeAction =
    meta.closeAction === "dismiss_session"
      ? onDismissSession
      : onClearWalkthrough;
  const showOnboardingProgress = step === "celebrate" || step === "what_next";
  const onboardingDisplay = describeOnboardingProgress(onboardingProgress);

  return (
    <ModalContainer theme={theme} minWidth={modalWidth}>
      <box style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <text style={{ fontWeight: "bold" }}>{meta.title}</text>
        <ModalActionButton
          theme={theme}
          label="CLOSE"
          onPress={closeAction}
          paddingX={2}
        />
      </box>

      {showOnboardingProgress ? (
        <box style={{ marginTop: 1, flexDirection: "column" }}>
          <text style={{ color: theme.text, fontWeight: "bold" }}>
            {onboardingDisplay.label}
          </text>
          <text style={{ color: theme.muted }}>
            {onboardingDisplay.chips.join("  ")}
          </text>
        </box>
      ) : null}

      {step === "welcome" ? (
        <>
          <text style={{ marginTop: 1 }}>
            Press A or Enter to create your first task.
          </text>
          <text style={{ color: theme.muted }}>
            Press S or Esc to skip this walkthrough for now.
          </text>
          <ModalActionRow marginTop={1}>
            <ModalActionButton
              theme={theme}
              label="CREATE TASK [A/ENTER]"
              primary
              onPress={onCreateTask}
              paddingX={2}
            />
            {showImportBackupAction ? (
              <ModalActionButton
                theme={theme}
                label="IMPORT BACKUP [I]"
                onPress={onOpenBackupImport}
                paddingX={2}
              />
            ) : null}
          </ModalActionRow>
          <ModalActionRow>
            <ModalActionButton
              theme={theme}
              label="SHORTCUTS [H]"
              onPress={onShowShortcuts}
              paddingX={2}
            />
            <ModalActionButton
              theme={theme}
              label="SKIP SESSION [S/ESC]"
              onPress={onDismissSession}
              paddingX={2}
            />
          </ModalActionRow>
        </>
      ) : null}

      {step === "shortcuts" ? (
        <>
          <text style={{ marginTop: 1 }}>A or Enter: create a task.</text>
          <text>Esc: return to welcome.</text>
          <text>J/K or Arrow keys: move selection.</text>
          <text style={{ color: theme.muted }}>
            Use ? anytime to open full help.
          </text>
          <ModalActionRow marginTop={1}>
            <ModalActionButton
              theme={theme}
              label="BACK TO WELCOME [ESC]"
              onPress={onBackToWelcome}
              paddingX={2}
            />
            <ModalActionButton
              theme={theme}
              label="CREATE TASK [A/ENTER]"
              primary
              onPress={onCreateTask}
              paddingX={2}
            />
          </ModalActionRow>
        </>
      ) : null}

      {step === "celebrate" ? (
        <>
          <text style={{ marginTop: 1 }}>
            Nice start. Your first task is saved.
          </text>
          <text style={{ color: theme.muted }}>
            Press Enter for next steps, or press A to create another task.
          </text>
          <ModalActionRow marginTop={1}>
            <ModalActionButton
              theme={theme}
              label="WHAT NEXT [ENTER]"
              primary
              onPress={onOpenWhatNext}
              paddingX={2}
            />
            <ModalActionButton
              theme={theme}
              label="ADD ANOTHER [A]"
              onPress={onCreateTask}
              paddingX={2}
            />
          </ModalActionRow>
          <ModalActionRow>
            <ModalActionButton
              theme={theme}
              label="SHORTCUTS [H]"
              onPress={onShowShortcuts}
              paddingX={2}
            />
            <ModalActionButton
              theme={theme}
              label="CLOSE [ESC]"
              onPress={onClearWalkthrough}
              paddingX={2}
            />
          </ModalActionRow>
        </>
      ) : null}

      {step === "what_next" ? (
        <>
          <text style={{ marginTop: 1 }}>
            Complete onboarding with these quick actions.
          </text>
          <text style={{ color: theme.muted }}>
            Build your first TOME note, add checklist items, then return to
            list.
          </text>
          <ModalActionRow marginTop={1}>
            <ModalActionButton
              theme={theme}
              label="FIRST TOME [T]"
              primary
              onPress={onOpenFirstTome}
              paddingX={2}
            />
            <ModalActionButton
              theme={theme}
              label="CHECKLIST [C]"
              onPress={onOpenChecklistAdd}
              paddingX={2}
            />
          </ModalActionRow>
          <ModalActionRow>
            <ModalActionButton
              theme={theme}
              label="GO TO LIST [ENTER]"
              onPress={onGoToList}
              paddingX={2}
            />
            <ModalActionButton
              theme={theme}
              label="ADD ANOTHER [A]"
              onPress={onCreateTask}
              paddingX={2}
            />
          </ModalActionRow>
          <ModalActionRow>
            <ModalActionButton
              theme={theme}
              label="SHORTCUTS [H]"
              onPress={onShowShortcuts}
              paddingX={2}
            />
            <ModalActionButton
              theme={theme}
              label="CLOSE [ESC]"
              onPress={onClearWalkthrough}
              paddingX={2}
            />
          </ModalActionRow>
        </>
      ) : null}
    </ModalContainer>
  );
}
