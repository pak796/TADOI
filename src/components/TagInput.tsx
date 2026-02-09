import { theme } from "../app/theme";

type TagInputProps = {
  value: string;
  focused: boolean;
  suggestionActive: boolean;
  suggestions: string[];
  suggestionHint?: string | null;
  onChange: (value: string) => void;
  onPick: (tag: string) => void;
};

export function TagInput({
  value,
  focused,
  suggestionActive,
  suggestions,
  suggestionHint,
  onChange,
  onPick
}: TagInputProps) {
  const options = suggestions.map((tag) => ({
    name: `#${tag}`,
    description: "",
    value: tag
  }));

  return (
    <box style={{ flexDirection: "column" }}>
      <input
        value={value}
        onChange={onChange}
        focused={focused && !suggestionActive}
        placeholder="#work #home"
        style={{ backgroundColor: theme.bg, color: theme.text }}
      />
      {suggestionActive && options.length > 0 ? (
        <box style={{ marginTop: 1 }}>
          <select
            focused
            options={options}
            onChange={(_, option) => {
              if (option?.value) {
                onPick(String(option.value));
              }
            }}
            showScrollIndicator
            style={{ flexGrow: 1, height: Math.min(5, options.length + 1) }}
          />
        </box>
      ) : null}
      {suggestionHint ? (
        <text style={{ color: theme.muted, marginTop: 1 }}>{suggestionHint}</text>
      ) : null}
    </box>
  );
}
