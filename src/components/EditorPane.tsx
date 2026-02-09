import { EditorDraft, EditorFocus, Mode } from "../domain/models";
import { theme } from "../app/theme";
import { TagInput } from "./TagInput";
import { normalizeTimeTextInput } from "../domain/dates";

type EditorPaneProps = {
  mode: Mode;
  draft: EditorDraft;
  focus: EditorFocus;
  tagInlineSuggestion?: { full: string; remainder: string } | null;
  dueSuggestionHint?: string | null;
  timeSuggestionHint?: string | null;
  onUpdate: (patch: Partial<EditorDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function EditorPane({
  mode,
  draft,
  focus,
  tagInlineSuggestion,
  dueSuggestionHint,
  timeSuggestionHint,
  onUpdate,
  onSave,
  onCancel
}: EditorPaneProps) {
  const heading = mode === "add" ? "ADD TASK" : "EDIT TASK";

  return (
    <box style={{ flexDirection: "column" }}>
      <text style={{ color: theme.text, fontWeight: "bold" }}>{heading}</text>

      <box style={{ flexDirection: "column", marginTop: 1 }}>
        <text style={{ color: theme.muted }}>TITLE *</text>
        <input
          value={draft.title}
          onChange={(value) => onUpdate({ title: value })}
          focused={focus === "title"}
          placeholder="Ship LCARS update"
          style={{ backgroundColor: theme.bg, color: theme.text }}
        />
      </box>

      <box style={{ flexDirection: "column", marginTop: 1 }}>
        <text style={{ color: theme.muted }}>DUE (YYYY-MM-DD)</text>
        <input
          value={draft.dueText}
          onChange={(value) => onUpdate({ dueText: value })}
          focused={focus === "due"}
          placeholder="2026-02-08"
          style={{ backgroundColor: theme.bg, color: theme.text }}
        />
        {dueSuggestionHint ? (
          <text style={{ color: theme.muted, marginTop: 1 }}>{dueSuggestionHint}</text>
        ) : null}
      </box>

      <box style={{ flexDirection: "column", marginTop: 1 }}>
        <text style={{ color: theme.muted }}>TIME (HH:mm, optional)</text>
        <input
          value={draft.timeText}
          onChange={(value) => onUpdate({ timeText: normalizeTimeTextInput(value) })}
          focused={focus === "time"}
          placeholder="14:30"
          style={{ backgroundColor: theme.bg, color: theme.text, width: "100%" }}
        />
        {timeSuggestionHint ? (
          <box style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 1 }}>
            <text style={{ color: theme.muted }}>{timeSuggestionHint}</text>
          </box>
        ) : null}
      </box>

      <box style={{ flexDirection: "column", marginTop: 1 }}>
        <text style={{ color: theme.muted }}>TAGS (#TAG)</text>
        <TagInput
          value={draft.tagsText}
          focused={focus === "tags"}
          inlineSuggestion={focus === "tags" ? tagInlineSuggestion : null}
          onChange={(value) => onUpdate({ tagsText: value })}
        />
      </box>

      <box style={{ flexDirection: "column", marginTop: 1 }}>
        <text style={{ color: theme.muted }}>NOTES</text>
        <input
          value={draft.notes}
          onChange={(value) => onUpdate({ notes: value })}
          focused={focus === "notes"}
          placeholder="Optional details"
          style={{ backgroundColor: theme.bg, color: theme.text }}
        />
      </box>

      <box style={{ flexDirection: "row", gap: 1, marginTop: 2 }}>
        <box
          style={{
            paddingLeft: 2,
            paddingRight: 2,
            backgroundColor: focus === "save" ? theme.ok : theme.accentBlue,
            color: theme.bg
          }}
        >
          <text onClick={onSave}>SAVE</text>
        </box>
        <box
          style={{
            paddingLeft: 2,
            paddingRight: 2,
            backgroundColor: focus === "cancel" ? theme.warn : theme.accentOrange,
            color: theme.bg
          }}
        >
          <text onClick={onCancel}>CANCEL</text>
        </box>
      </box>

      <box style={{ marginTop: 1 }}>
        <text style={{ color: theme.muted }}>
          TAB: NEXT FIELD · CTRL+S: SAVE · ESC: CANCEL
        </text>
      </box>
    </box>
  );
}
