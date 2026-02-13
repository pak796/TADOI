import type { KeyEvent } from "@opentui/core";
import { colorForTag, themeForObject } from "../app/theme";
import type { TagFilter } from "../domain/models";
import type { TagFilterBucket } from "../domain/tagFilter";
import { formatTagFilterBooleanSummary } from "../domain/tagFilter";
import { formatTagForDisplay } from "../domain/tagIndex";

type TagFilterPanelProps = {
  draft?: TagFilter;
  inputValue: string;
  activeBucket: TagFilterBucket;
  inlineSuggestion?: { full: string; remainder: string } | null;
  suggestions: string[];
  onInputChange: (value: string) => void;
  onInputKeyDown: (key: KeyEvent) => void;
  onInputSubmit: (value: string) => void;
  onSetBucket: (bucket: TagFilterBucket) => void;
  onRemoveTag: (bucket: TagFilterBucket, tag: string) => void;
  onApply: () => void;
  onClear: () => void;
  onCancel: () => void;
};

const BUCKET_META: Array<{
  bucket: TagFilterBucket;
  label: string;
  marker: string;
}> = [
  { bucket: "all", label: "ALL (AND)", marker: "+" },
  { bucket: "any", label: "ANY (OR)", marker: "~" },
  { bucket: "none", label: "NONE (NOT)", marker: "-" }
];
const MAX_TAG_CHIPS_PER_BUCKET = 24;

function getBucketTags(draft: TagFilter | undefined, bucket: TagFilterBucket): string[] {
  return draft?.[bucket] ?? [];
}

export function TagFilterPanel({
  draft,
  inputValue,
  activeBucket,
  inlineSuggestion,
  suggestions,
  onInputChange,
  onInputKeyDown,
  onInputSubmit,
  onSetBucket,
  onRemoveTag,
  onApply,
  onClear,
  onCancel
}: TagFilterPanelProps) {
  const theme = themeForObject("inputs");
  const summary = formatTagFilterBooleanSummary(draft) ?? "(none)";
  const hasSuggestion = Boolean(inlineSuggestion?.remainder);

  return (
    <box
      style={{
        width: 78,
        maxWidth: "100%",
        minHeight: 0,
        maxHeight: "100%",
        flexDirection: "column",
        backgroundColor: theme.panel,
        border: true,
        borderStyle: "single",
        borderColor: theme.outline,
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 1,
        paddingBottom: 1,
        overflow: "hidden"
      }}
    >
      <text style={{ color: theme.text, fontWeight: "bold" }}>
        TAG FILTER PANEL
      </text>
      <text style={{ color: theme.muted }}>
        Tab: next bucket | 1/2/3: bucket | Enter: add | Ctrl+Enter: apply | Esc: close
      </text>

      {BUCKET_META.map((meta) => {
        const isActive = activeBucket === meta.bucket;
        const tags = getBucketTags(draft, meta.bucket);
        const visibleTags = tags.slice(0, MAX_TAG_CHIPS_PER_BUCKET);
        const hiddenTagCount = Math.max(0, tags.length - visibleTags.length);
        return (
          <box key={meta.bucket} style={{ flexDirection: "column", marginTop: 1 }}>
            <box
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: isActive ? theme.accentBlue : "transparent",
                paddingLeft: 1,
                paddingRight: 1
              }}
              onMouseDown={(event) => {
                if (event.button !== 0) return;
                onSetBucket(meta.bucket);
              }}
            >
              <text style={{ color: isActive ? theme.bg : theme.text }}>
                {meta.bucket === "all" ? "1" : meta.bucket === "any" ? "2" : "3"}.
              </text>
              <text style={{ color: isActive ? theme.bg : theme.text }}>
                {" "}
                {meta.label}
              </text>
            </box>
            <box style={{ flexDirection: "row", flexWrap: "wrap", gap: 1, paddingLeft: 1 }}>
              {tags.length === 0 ? (
                <text style={{ color: theme.muted }}>(none)</text>
              ) : (
                visibleTags.map((tag) => (
                  <box
                    key={`${meta.bucket}:${tag}`}
                    style={{
                      backgroundColor: colorForTag(tag),
                      paddingLeft: 1,
                      paddingRight: 1
                    }}
                    onMouseDown={(event) => {
                      if (event.button !== 0) return;
                      onSetBucket(meta.bucket);
                      onRemoveTag(meta.bucket, tag);
                    }}
                  >
                    <text style={{ color: theme.bg }}>
                      {meta.marker}
                      {formatTagForDisplay(tag)}
                    </text>
                  </box>
                ))
              )}
            </box>
            {hiddenTagCount > 0 ? (
              <text style={{ color: theme.muted, paddingLeft: 1 }}>
                ... +{hiddenTagCount} more
              </text>
            ) : null}
          </box>
        );
      })}

      <box style={{ flexDirection: "column", marginTop: 1 }}>
        <text style={{ color: theme.muted }}>
          Add tag ({activeBucket.toUpperCase()}): 
        </text>
        <input
          value={inputValue}
          onChange={onInputChange}
          onKeyDown={onInputKeyDown}
          onSubmit={onInputSubmit}
          focused
          placeholder="#work"
          style={{ backgroundColor: theme.bg, color: theme.text }}
        />
        {hasSuggestion ? (
          <box style={{ flexDirection: "row", gap: 0, marginTop: 1 }}>
            <text style={{ color: theme.muted }}>→ </text>
            <text style={{ color: theme.text }}>
              {formatTagForDisplay(
                inlineSuggestion?.full.slice(
                  0,
                  inlineSuggestion.full.length - inlineSuggestion.remainder.length
                ) ?? ""
              )}
            </text>
            <text style={{ color: theme.muted }}>{inlineSuggestion?.remainder}</text>
            <text style={{ color: theme.muted }}> (press →)</text>
          </box>
        ) : null}
        <text style={{ color: theme.muted, marginTop: 1 }}>
          Suggestions:{" "}
          {suggestions.length > 0
            ? suggestions
                .slice(0, 6)
                .map((tag) => formatTagForDisplay(tag))
                .join(" ")
            : "(none)"}
        </text>
      </box>

      <text style={{ color: theme.text, marginTop: 1 }}>Tags: {summary}</text>
      <box style={{ flexDirection: "row", gap: 1, marginTop: 1 }}>
        <box
          style={{ backgroundColor: theme.accentBlue, paddingLeft: 1, paddingRight: 1 }}
          onMouseDown={(event) => {
            if (event.button !== 0) return;
            onApply();
          }}
        >
          <text style={{ color: theme.bg, fontWeight: "bold" }}>APPLY</text>
        </box>
        <box
          style={{ backgroundColor: theme.warn, paddingLeft: 1, paddingRight: 1 }}
          onMouseDown={(event) => {
            if (event.button !== 0) return;
            onClear();
          }}
        >
          <text style={{ color: theme.bg, fontWeight: "bold" }}>CLEAR</text>
        </box>
        <box
          style={{ backgroundColor: theme.outline, paddingLeft: 1, paddingRight: 1 }}
          onMouseDown={(event) => {
            if (event.button !== 0) return;
            onCancel();
          }}
        >
          <text style={{ color: theme.text, fontWeight: "bold" }}>CLOSE</text>
        </box>
      </box>
    </box>
  );
}
