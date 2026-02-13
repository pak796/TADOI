import { themeForObject } from "../app/theme";
import type { EmptyNuxStep } from "../ui/state";

type EmptyNuxModalProps = {
  step: EmptyNuxStep;
  onCreateTask: () => void;
  onShowShortcuts: () => void;
  onBackToWelcome: () => void;
  onDismissSession: () => void;
  onClearWalkthrough: () => void;
  onGoToList: () => void;
};

function ActionButton(props: {
  label: string;
  primary?: boolean;
  onPress: () => void;
}) {
  const theme = themeForObject("modal");
  return (
    <box
      style={{
        backgroundColor: props.primary ? theme.accentBlue : theme.bg,
        paddingLeft: 1,
        paddingRight: 1
      }}
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.button !== 0) return;
        props.onPress();
      }}
    >
      <text
        style={{
          color: props.primary ? theme.bg : theme.text,
          fontWeight: "bold"
        }}
      >
        {props.label}
      </text>
    </box>
  );
}

export function EmptyNuxModal({
  step,
  onCreateTask,
  onShowShortcuts,
  onBackToWelcome,
  onDismissSession,
  onClearWalkthrough,
  onGoToList
}: EmptyNuxModalProps) {
  const theme = themeForObject("modal");
  const modalWidth = 64;

  const title =
    step === "shortcuts"
      ? "TADOI Shortcuts"
      : step === "celebrate"
        ? "First Task Created"
        : "Welcome to TADOI";
  const closeAction = step === "welcome" ? onDismissSession : onClearWalkthrough;

  return (
    <box
      style={{
        padding: 2,
        backgroundColor: theme.panel,
        color: theme.text,
        minWidth: modalWidth,
        border: true,
        borderStyle: "single",
        borderColor: theme.outline,
        flexDirection: "column"
      }}
    >
      <box style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <text style={{ fontWeight: "bold" }}>{title}</text>
        <box
          style={{ backgroundColor: theme.bg, paddingLeft: 1, paddingRight: 1 }}
          onMouseDown={(mouseEvent) => {
            if (mouseEvent.button !== 0) return;
            closeAction();
          }}
        >
          <text style={{ color: theme.text, fontWeight: "bold" }}>(X)</text>
        </box>
      </box>

      {step === "welcome" ? (
        <>
          <text style={{ marginTop: 1 }}>Press A to create a task, or click ADD.</text>
          <text style={{ color: theme.muted }}>Esc or S to skip for this session.</text>
          <box style={{ flexDirection: "row", gap: 1, marginTop: 1 }}>
            <ActionButton label="ADD (A/Enter)" primary onPress={onCreateTask} />
            <ActionButton label="Shortcuts (H)" onPress={onShowShortcuts} />
            <ActionButton label="Skip (S)" onPress={onDismissSession} />
          </box>
        </>
      ) : null}

      {step === "shortcuts" ? (
        <>
          <text style={{ marginTop: 1 }}>A/Enter: Add task</text>
          <text>Esc: Back to welcome</text>
          <text>j/k or arrows: Move selection</text>
          <text style={{ color: theme.muted }}>You can view full help anytime with ?</text>
          <box style={{ flexDirection: "row", gap: 1, marginTop: 1 }}>
            <ActionButton label="Back (Esc)" onPress={onBackToWelcome} />
            <ActionButton label="ADD (A/Enter)" primary onPress={onCreateTask} />
          </box>
        </>
      ) : null}

      {step === "celebrate" ? (
        <>
          <text style={{ marginTop: 1 }}>Nice start. Your first task is saved.</text>
          <text style={{ color: theme.muted }}>Enter to return to list, or add another task.</text>
          <box style={{ flexDirection: "row", gap: 1, marginTop: 1 }}>
            <ActionButton label="Go to list (Enter)" primary onPress={onGoToList} />
            <ActionButton label="Add another (A)" onPress={onCreateTask} />
            <ActionButton label="Shortcuts (H)" onPress={onShowShortcuts} />
            <ActionButton label="Close (Esc)" onPress={onClearWalkthrough} />
          </box>
        </>
      ) : null}
    </box>
  );
}
