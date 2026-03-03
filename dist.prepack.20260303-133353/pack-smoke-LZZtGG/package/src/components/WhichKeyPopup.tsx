import { themeForObject } from "../app/theme";
import type { WhichKeyPrefixPopup } from "../app/whichKeyHints";

type WhichKeyPopupProps = {
  model: WhichKeyPrefixPopup;
};

export function WhichKeyPopup({ model }: WhichKeyPopupProps) {
  const theme = themeForObject("help");
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
      <text style={{ color: theme.text, fontWeight: "bold" }}>{model.title}</text>
      {model.hints.map((hint) => (
        <text key={`${hint.key}-${hint.label}`} style={{ color: theme.muted }}>
          {`${hint.key}: ${hint.label}`}
        </text>
      ))}
    </box>
  );
}
