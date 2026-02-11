import { themeForObject } from "../app/theme";

type EmptyNuxModalProps = {
  onClose: () => void;
  onCreateTask: () => void;
};

export function EmptyNuxModal({ onClose, onCreateTask }: EmptyNuxModalProps) {
  const theme = themeForObject("modal");
  return (
    <box
      style={{
        padding: 2,
        backgroundColor: theme.panel,
        color: theme.text,
        minWidth: 56,
        border: true,
        borderStyle: "single",
        borderColor: theme.outline,
        flexDirection: "column"
      }}
    >
      <box style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <text style={{ fontWeight: "bold" }}>Welcome to TADOI</text>
        <box
          style={{ backgroundColor: theme.bg, paddingLeft: 1, paddingRight: 1 }}
          onMouseDown={(mouseEvent) => {
            if (mouseEvent.button !== 0) return;
            onClose();
          }}
        >
          <text style={{ color: theme.text, fontWeight: "bold" }}>(X)</text>
        </box>
      </box>

      <text style={{ marginTop: 1 }}>Press A to create a task, or click ADD.</text>
      <text style={{ color: theme.muted }}>Esc to close</text>

      <box style={{ flexDirection: "row", gap: 1, marginTop: 1 }}>
        <box
          style={{ backgroundColor: theme.accentBlue, paddingLeft: 1, paddingRight: 1 }}
          onMouseDown={(mouseEvent) => {
            if (mouseEvent.button !== 0) return;
            onCreateTask();
          }}
        >
          <text style={{ color: theme.bg, fontWeight: "bold" }}>Create task (A)</text>
        </box>
        <box
          style={{ backgroundColor: theme.bg, paddingLeft: 1, paddingRight: 1 }}
          onMouseDown={(mouseEvent) => {
            if (mouseEvent.button !== 0) return;
            onClose();
          }}
        >
          <text style={{ color: theme.text, fontWeight: "bold" }}>Close (Esc)</text>
        </box>
      </box>
    </box>
  );
}
