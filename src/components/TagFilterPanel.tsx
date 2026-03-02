import type { KeyEvent } from "@opentui/core";
import { colorForTag, themeForObject } from "../app/theme";
import type { TagFilter } from "../domain/models";
import { formatTagForReadOnlyDisplay } from "../domain/priorityTags";
import { type TagStats } from "../domain/tagAliases";
import { formatTagFilterBooleanSummary, type TagFilterBucket } from "../domain/tagFilter";
import { formatTagForDisplay } from "../domain/tagIndex";

type TagFilterPanelProps = {
  draft?: TagFilter;
  inputValue: string;
  activeBucket: TagFilterBucket;
  inlineSuggestion?: { full: string; remainder: string } | null;
  suggestions: string[];
  insights: TagStats;
  availableWidth: number;
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
const MIN_PANEL_WIDTH = 64;
const MAX_PANEL_WIDTH = 108;
const SIDE_PANEL_MIN_WIDTH = 30;
const SIDE_PANEL_MAX_WIDTH = 45;
const SIDE_PANEL_THRESHOLD = 92;

function truncateInline(value: string, maxWidth: number): string {
  if (maxWidth <= 0) return "";
  if (value.length <= maxWidth) return value;
  if (maxWidth <= 3) return value.slice(0, maxWidth);
  return `${value.slice(0, maxWidth - 3)}...`;
}

function formatAliasExamples(values: string[]): string {
  if (values.length === 0) return "(none)";
  return values
    .slice(0, 3)
    .map((value) => formatTagForReadOnlyDisplay(value))
    .join(", ");
}

function formatTopCoTags(stats: TagStats): string {
  if (stats.topCoTags.length === 0) return "(none)";
  return stats.topCoTags
    .map((entry) => `${formatTagForReadOnlyDisplay(entry.tag)}(${String(entry.count)})`)
    .join(", ");
}

function buildNarrowInsightsSummary(stats: TagStats, width: number): string {
  if (!stats.selectedCanonical) {
    return truncateInline("INSIGHTS: type a tag or choose one from the active bucket", width);
  }
  const sourceLabel =
    stats.selectedInput && stats.selectedInput !== stats.selectedCanonical
      ? ` from "${stats.selectedInput.trim()}"`
      : "";
  const topCoTags = formatTopCoTags(stats);
  return truncateInline(
    `INSIGHTS: ${formatTagForReadOnlyDisplay(stats.selectedCanonical)}${sourceLabel} | ${String(stats.usageCount)} tasks | aliases in ${String(stats.incomingAliases.length)} | co: ${topCoTags}`,
    width
  );
}

export function getBucketTags(draft: TagFilter | undefined, bucket: TagFilterBucket): string[] {
  return draft?.[bucket] ?? [];
}

export function splitBucketTags(
  tags: string[],
  maxVisible: number = MAX_TAG_CHIPS_PER_BUCKET
): { visibleTags: string[]; hiddenTagCount: number } {
  const visibleTags = tags.slice(0, maxVisible);
  const hiddenTagCount = Math.max(0, tags.length - visibleTags.length);
  return { visibleTags, hiddenTagCount };
}

type TagFilterMainPanelProps = {
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

function TagFilterMainPanel({
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
}: TagFilterMainPanelProps) {
  const theme = themeForObject("inputs");
  const summary = formatTagFilterBooleanSummary(draft) ?? "(none)";
  const hasSuggestion = Boolean(inlineSuggestion?.remainder);

  return (
    <box style={{ flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
      <text style={{ color: theme.text, fontWeight: "bold" }}>TAG FILTER PANEL</text>
      <text style={{ color: theme.muted }}>
        Tab/Arrows: bucket | Enter: add | Ctrl+Enter/Ctrl+S: apply | Esc: close
      </text>
      <text style={{ color: theme.muted }}>Insights are informational only.</text>

      {BUCKET_META.map((meta) => {
        const isActive = activeBucket === meta.bucket;
        const tags = getBucketTags(draft, meta.bucket);
        const { visibleTags, hiddenTagCount } = splitBucketTags(tags);
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
                event.preventDefault();
                onSetBucket(meta.bucket);
              }}
            >
              <text style={{ color: isActive ? theme.bg : theme.text }}>{meta.label}</text>
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
                      event.preventDefault();
                      onSetBucket(meta.bucket);
                      onRemoveTag(meta.bucket, tag);
                    }}
                  >
                    <text style={{ color: theme.bg }}>
                      {meta.marker}
                      {formatTagForReadOnlyDisplay(tag)}
                    </text>
                  </box>
                ))
              )}
            </box>
            {hiddenTagCount > 0 ? (
              <text style={{ color: theme.muted, paddingLeft: 1 }}>
                ... +{String(hiddenTagCount)} more
              </text>
            ) : null}
          </box>
        );
      })}

      <box style={{ flexDirection: "column", marginTop: 1 }}>
        <text style={{ color: theme.muted }}>Add tag ({activeBucket.toUpperCase()}): </text>
        <input
          value={inputValue}
          onInput={onInputChange}
          onKeyDown={onInputKeyDown}
          onSubmit={onInputSubmit}
          focused
          placeholder="#work"
          style={{ backgroundColor: theme.bg, color: theme.text }}
        />
        {hasSuggestion ? (
          <box style={{ flexDirection: "row", gap: 0, marginTop: 1 }}>
            <text style={{ color: theme.muted }}>-> </text>
            <text style={{ color: theme.text }}>
              {formatTagForDisplay(
                inlineSuggestion?.full.slice(
                  0,
                  inlineSuggestion.full.length - inlineSuggestion.remainder.length
                ) ?? ""
              )}
            </text>
            <text style={{ color: theme.muted }}>{inlineSuggestion?.remainder}</text>
            <text style={{ color: theme.muted }}> (press ->)</text>
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

function TagFilterInsightsPanel({
  insights,
  width
}: {
  insights: TagStats;
  width: number;
}) {
  const theme = themeForObject("inputs");
  const selectedCanonical = insights.selectedCanonical;
  const selectedInput = insights.selectedInput?.trim();
  const header = selectedCanonical
    ? selectedInput && selectedInput.length > 0 && selectedInput !== selectedCanonical
      ? `TAG: ${formatTagForReadOnlyDisplay(selectedCanonical)} (from "${selectedInput}")`
      : `TAG: ${formatTagForReadOnlyDisplay(selectedCanonical)}`
    : "TAG: (none)";
  const coTagSummary = formatTopCoTags(insights);
  const aliasInSummary = formatAliasExamples(insights.incomingAliases);

  return (
    <box
      style={{
        width,
        flexDirection: "column",
        minHeight: 0,
        maxHeight: "100%",
        backgroundColor: theme.bg,
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
        {truncateInline(header, Math.max(1, width - 4))}
      </text>
      <text style={{ color: theme.text, marginTop: 1 }}>
        Usage: {String(insights.usageCount)} tasks
      </text>
      {insights.percentOfTaggedTasks !== undefined ? (
        <text style={{ color: theme.muted }}>
          Share: {String(insights.percentOfTaggedTasks)}% of tagged tasks
        </text>
      ) : null}
      <text style={{ color: theme.text }}>
        Aliases in: {String(insights.incomingAliases.length)}
      </text>
      <text style={{ color: theme.muted }}>
        {truncateInline(aliasInSummary, Math.max(1, width - 4))}
      </text>
      <text style={{ color: theme.text }}>
        Aliases out:{" "}
        {insights.outgoingAliasTarget
          ? formatTagForReadOnlyDisplay(insights.outgoingAliasTarget)
          : "none"}
      </text>
      <text style={{ color: theme.text, marginTop: 1 }}>Top co-tags:</text>
      <text style={{ color: theme.muted }}>
        {truncateInline(coTagSummary, Math.max(1, width - 4))}
      </text>
      {insights.normalizedCollisionCount > 0 ? (
        <text style={{ color: theme.warn, marginTop: 1 }}>
          Normalized collisions: {String(insights.normalizedCollisionCount)}
        </text>
      ) : null}
    </box>
  );
}

export function TagFilterPanel({
  draft,
  inputValue,
  activeBucket,
  inlineSuggestion,
  suggestions,
  insights,
  availableWidth,
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
  const panelWidth = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, availableWidth));
  const showSideInsights = panelWidth >= SIDE_PANEL_THRESHOLD;
  const sidePanelWidth = showSideInsights
    ? Math.max(
        SIDE_PANEL_MIN_WIDTH,
        Math.min(SIDE_PANEL_MAX_WIDTH, Math.floor(panelWidth * 0.38))
      )
    : 0;
  const narrowSummary = buildNarrowInsightsSummary(insights, Math.max(1, panelWidth - 4));

  return (
    <box
      style={{
        width: panelWidth,
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
      {showSideInsights ? (
        <box style={{ flexDirection: "row", gap: 1, minHeight: 0, overflow: "hidden" }}>
          <box style={{ flexGrow: 1, minHeight: 0, overflow: "hidden" }}>
            <TagFilterMainPanel
              draft={draft}
              inputValue={inputValue}
              activeBucket={activeBucket}
              inlineSuggestion={inlineSuggestion}
              suggestions={suggestions}
              onInputChange={onInputChange}
              onInputKeyDown={onInputKeyDown}
              onInputSubmit={onInputSubmit}
              onSetBucket={onSetBucket}
              onRemoveTag={onRemoveTag}
              onApply={onApply}
              onClear={onClear}
              onCancel={onCancel}
            />
          </box>
          <TagFilterInsightsPanel insights={insights} width={sidePanelWidth} />
        </box>
      ) : (
        <box style={{ flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <TagFilterMainPanel
            draft={draft}
            inputValue={inputValue}
            activeBucket={activeBucket}
            inlineSuggestion={inlineSuggestion}
            suggestions={suggestions}
            onInputChange={onInputChange}
            onInputKeyDown={onInputKeyDown}
            onInputSubmit={onInputSubmit}
            onSetBucket={onSetBucket}
            onRemoveTag={onRemoveTag}
            onApply={onApply}
            onClear={onClear}
            onCancel={onCancel}
          />
          <text style={{ color: theme.muted, marginTop: 1 }}>{narrowSummary}</text>
        </box>
      )}
    </box>
  );
}
