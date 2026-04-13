import { theme } from "../app/theme";
import { formatTagForDisplay } from "../domain/tagIndex";

type TagInputProps = {
  value: string;
  focused: boolean;
  inlineSuggestion?: { full: string; remainder: string } | null;
  onChange: (value: string) => void;
};

export function TagInput({
  value,
  focused,
  inlineSuggestion,
  onChange,
}: TagInputProps) {
  const hasSuggestion =
    inlineSuggestion && inlineSuggestion.remainder.length > 0;
  const prefix = hasSuggestion
    ? inlineSuggestion.full.slice(
        0,
        inlineSuggestion.full.length - inlineSuggestion.remainder.length,
      )
    : "";
  const displayPrefix = formatTagForDisplay(prefix);

  return (
    <box style={{ flexDirection: "column" }}>
      <input
        value={value}
        onChange={onChange}
        focused={focused}
        placeholder="#work #home"
        style={{ backgroundColor: theme.bg, color: theme.text, width: "100%" }}
      />
      {hasSuggestion ? (
        <box style={{ flexDirection: "row", gap: 0, marginTop: 1 }}>
          <text style={{ color: theme.muted }}>→ </text>
          <text style={{ color: theme.text }}>{displayPrefix}</text>
          <text style={{ color: theme.muted }}>
            {inlineSuggestion?.remainder}
          </text>
          <text style={{ color: theme.muted }}> (press →)</text>
        </box>
      ) : null}
    </box>
  );
}
