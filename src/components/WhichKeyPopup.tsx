import { themeForObject } from "../app/theme";
import type { WhichKeyPrefixPopup } from "../app/whichKeyHints";
import { truncateToWidth } from "../app/renderingComposition";

type WhichKeyPopupProps = {
  model: WhichKeyPrefixPopup;
  maxLineWidth?: number;
};

function formatHintLine(key: string, label: string): string {
  return `${key}: ${label}`;
}

export function buildWhichKeyPopupLines(
  model: WhichKeyPrefixPopup,
  maxLineWidth: number
): { title: string; hints: string[] } {
  const safeWidth = Math.max(12, maxLineWidth);
  return {
    title: truncateToWidth(model.title, safeWidth),
    hints: model.hints.map((hint) =>
      truncateToWidth(formatHintLine(hint.key, hint.label), safeWidth)
    )
  };
}

export function WhichKeyPopup({ model, maxLineWidth = 24 }: WhichKeyPopupProps) {
  const theme = themeForObject("help");
  const lines = buildWhichKeyPopupLines(model, maxLineWidth);
  return (
    <box
      style={{
        flexDirection: "column",
        backgroundColor: theme.panel,
        border: true,
        borderStyle: "single",
        borderColor: theme.accentBlue,
        minWidth: 28,
        paddingLeft: 1,
        paddingRight: 1
      }}
    >
      <text style={{ color: theme.text, fontWeight: "bold" }}>{lines.title}</text>
      {lines.hints.map((hintLine, index) => (
        <text key={`${hintLine}-${String(index)}`} style={{ color: theme.muted }}>
          {hintLine}
        </text>
      ))}
    </box>
  );
}
