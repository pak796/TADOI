import { themeForObject } from "../app/theme";
import { PRODUCT_NAME_TM } from "../brand/brand";

type EmptyNuxModalProps = {
  onClose: () => void;
  onCreateTask: () => void;
};

export function EmptyNuxModal({ onClose, onCreateTask }: EmptyNuxModalProps) {
  const theme = themeForObject("modal");
  const modalWidth = 64;
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
        <text style={{ fontWeight: "bold" }}>{`Welcome to ${PRODUCT_NAME_TM}`}</text>
        <box
          style={{ backgroundColor: theme.bg, paddingLeft: 1, paddingRight: 1 }}
          onMouseDown={(mouseEvent) => {
            if (mouseEvent.button !== 0) return;
            onClose();
          }}
        >
          <text style={{ color: theme.text, fontWeight: "bold" }}>[ESC]</text>
        </box>
      </box>

      <text style={{ marginTop: 1 }}>[A] CREATE TASK OR CLICK CREATE TASK [A].</text>
      <text style={{ color: theme.muted }}>[ESC] CLOSE</text>

      <box style={{ flexDirection: "row", gap: 1, marginTop: 1 }}>
        <box
          style={{ backgroundColor: theme.accentBlue, paddingLeft: 1, paddingRight: 1 }}
          onMouseDown={(mouseEvent) => {
            if (mouseEvent.button !== 0) return;
            onCreateTask();
          }}
        >
          <text style={{ color: theme.bg, fontWeight: "bold" }}>CREATE TASK (A)</text>
        </box>
        <box
          style={{ backgroundColor: theme.bg, paddingLeft: 1, paddingRight: 1 }}
          onMouseDown={(mouseEvent) => {
            if (mouseEvent.button !== 0) return;
            onClose();
          }}
        >
          <text style={{ color: theme.text, fontWeight: "bold" }}>CLOSE (ESC)</text>
        </box>
      </box>
    </box>
  );
}
