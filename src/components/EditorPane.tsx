import { useEffect, useMemo, useRef } from "react";
import type { InputRenderable, KeyEvent, ScrollBoxRenderable } from "@opentui/core";
import { EditorDraft, EditorFocus, Mode } from "../domain/models";
import { WEEKDAY_ORDER } from "../domain/recurrence/draft";
import { themeForObject } from "../app/theme";
import { TagInput } from "./TagInput";
import { normalizeTimeTextInput } from "../domain/dates";
import {
  EDITOR_ACTION_ROW,
  EDITOR_FOOTER_HINT_ROW,
  estimateEditorContentLines,
  getEditorFocusAnchorLine,
  getEditorRecurrenceVisibility,
  getEditorViewportHeights,
  hasEditorOverflow
} from "../domain/editorPaneLayout";
import { clampScrollOffset, ensureSelectedVisible } from "../domain/scroll";
import {
  cycleRepeatEndModeClamp,
  cycleRepeatModeClamp,
  shouldInterceptRepeatArrowAtEdge
} from "./editorRepeatKeyboard";
import { APP_NAME } from "../brand/brand";

type EditorPaneProps = {
  mode: Mode;
  draft: EditorDraft;
  focus: EditorFocus;
  availableHeightLines: number;
  scrollOffset: number;
  tagInlineSuggestion?: { full: string; remainder: string } | null;
  dueSuggestionHint?: string | null;
  timeSuggestionHint?: string | null;
  recurrencePreview?: string[];
  onUpdate: (patch: Partial<EditorDraft>) => void;
  onScrollOffsetChange: (scrollOffset: number) => void;
  onSave: () => void;
  onCancel: () => void;
};

const REPEAT_MODES = [
  { value: "off", label: "OFF" },
  { value: "daily", label: "DLY" },
  { value: "weekly", label: "WLY" },
  { value: "monthly", label: "MLY" },
  { value: "custom", label: "CUS" }
] as const;
const END_MODES = ["never", "until", "count"] as const;

function normalizeRepeatMode(input: string): EditorDraft["repeatMode"] {
  const value = input.trim().toLowerCase();
  if (value === "daily" || value === "weekly" || value === "monthly" || value === "custom") {
    return value;
  }
  return "off";
}

function normalizeEndMode(input: string): EditorDraft["repeatEndMode"] {
  const value = input.trim().toLowerCase();
  if (value === "until" || value === "count") {
    return value;
  }
  return "never";
}

function parseWeekdaysInput(value: string): string[] {
  const raw = value
    .split(/[\s,]+/)
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean);
  return Array.from(
    new Set(
      raw.filter((token) => WEEKDAY_ORDER.includes(token as (typeof WEEKDAY_ORDER)[number]))
    )
  );
}

function formatPreviewValue(iso: string): string {
  return iso.replace("T", " ");
}

export function EditorPane({
  mode,
  draft,
  focus,
  availableHeightLines,
  scrollOffset,
  tagInlineSuggestion,
  dueSuggestionHint,
  timeSuggestionHint,
  recurrencePreview,
  onUpdate,
  onScrollOffsetChange,
  onSave,
  onCancel
}: EditorPaneProps) {
  const theme = themeForObject("inputs");
  const repeatWeekdaysText = draft.repeatWeekdays.join(",");
  const recurrenceVisibility = useMemo(
    () => getEditorRecurrenceVisibility(draft.repeatMode, draft.repeatEndMode),
    [draft.repeatEndMode, draft.repeatMode]
  );
  const repeatEnabled = recurrenceVisibility.repeatEnabled;
  const previewRows = [
    recurrencePreview?.[0] ?? "",
    recurrencePreview?.[1] ?? "",
    recurrencePreview?.[2] ?? ""
  ];
  const previewLineCount = Math.max(1, previewRows.length);
  const estimateOptions = useMemo(
    () => ({
      hasDueSuggestion: Boolean(dueSuggestionHint),
      hasTimeSuggestion: Boolean(timeSuggestionHint),
      hasTagSuggestion: Boolean(tagInlineSuggestion?.remainder),
      repeatMode: draft.repeatMode,
      repeatEndMode: draft.repeatEndMode,
      previewRows: previewLineCount
    }),
    [
      draft.repeatEndMode,
      draft.repeatMode,
      dueSuggestionHint,
      timeSuggestionHint,
      tagInlineSuggestion?.remainder,
      previewLineCount
    ]
  );
  const estimatedContentLines = estimateEditorContentLines(estimateOptions);
  const { contentHeight, footerHeight } = getEditorViewportHeights(availableHeightLines);
  const showOverflowIndicator = hasEditorOverflow(
    availableHeightLines,
    estimatedContentLines
  );
  const clampedOffset = clampScrollOffset(
    scrollOffset,
    contentHeight,
    estimatedContentLines
  );
  const scrollboxRef = useRef<ScrollBoxRenderable | null>(null);
  const timeInputRef = useRef<InputRenderable | null>(null);
  const repeatModeInputRef = useRef<InputRenderable | null>(null);
  const repeatIntervalInputRef = useRef<InputRenderable | null>(null);
  const clampedOffsetRef = useRef(clampedOffset);
  const focusInFooter = focus === "save" || focus === "cancel";
  const footerTopPadding = Math.max(
    0,
    footerHeight - EDITOR_ACTION_ROW - EDITOR_FOOTER_HINT_ROW
  );
  const linksHint =
    mode === Mode.ADD ? ` · CTRL+L: ADD LINK/ATTACHMENT (${draft.links.length})` : "";
  const footerHintText = showOverflowIndicator
    ? `TAB: NEXT FIELD · CTRL+S: SAVE · ESC: CANCEL · PgUp/PgDn: Scroll${linksHint}`
    : `TAB: NEXT FIELD · CTRL+S: SAVE · ESC: CANCEL${linksHint}`;

  useEffect(() => {
    if (clampedOffset !== scrollOffset) {
      onScrollOffsetChange(clampedOffset);
    }
  }, [clampedOffset, onScrollOffsetChange, scrollOffset]);

  useEffect(() => {
    clampedOffsetRef.current = clampedOffset;
  }, [clampedOffset]);

  useEffect(() => {
    scrollboxRef.current?.scrollTo({ x: 0, y: clampedOffset });
  }, [clampedOffset]);

  useEffect(() => {
    if (focusInFooter) return;
    const currentOffset = clampedOffsetRef.current;
    const focusAnchor = getEditorFocusAnchorLine(focus, estimateOptions);
    const nextOffset = ensureSelectedVisible({
      selectedIndex: focusAnchor,
      scrollOffset: currentOffset,
      visibleRows: contentHeight,
      itemCount: estimatedContentLines
    });
    if (nextOffset !== currentOffset) {
      onScrollOffsetChange(nextOffset);
    }
  }, [
    contentHeight,
    estimatedContentLines,
    estimateOptions,
    focus,
    focusInFooter,
    onScrollOffsetChange
  ]);

  function fieldLabelColor(active: boolean): string {
    return active ? theme.muted : theme.outline;
  }

  function fieldInputColor(active: boolean): string {
    return active ? theme.text : theme.muted;
  }

  // Clamp behavior: repeat mode stops at OFF/CUS instead of wrapping.
  function handleRepeatCycleFromInputKey(
    key: KeyEvent,
    source: "time" | "repeat_mode" | "repeat_interval" | "repeat_end_mode"
  ): void {
    if (key.name !== "left" && key.name !== "right") return;

    if (source === "repeat_mode") {
      key.preventDefault();
      key.stopPropagation();
      const direction: 1 | -1 = key.name === "right" ? 1 : -1;
      const nextRepeatMode = cycleRepeatModeClamp(draft.repeatMode, direction);
      if (nextRepeatMode !== draft.repeatMode) {
        onUpdate({ repeatMode: nextRepeatMode });
      }
      return;
    }
    if (source === "repeat_end_mode") {
      key.preventDefault();
      key.stopPropagation();
      const direction: 1 | -1 = key.name === "right" ? 1 : -1;
      const nextRepeatEndMode = cycleRepeatEndModeClamp(draft.repeatEndMode, direction);
      if (nextRepeatEndMode !== draft.repeatEndMode) {
        onUpdate({ repeatEndMode: nextRepeatEndMode });
      }
      return;
    }

    const inputRef = source === "time" ? timeInputRef.current : repeatIntervalInputRef.current;
    if (!inputRef) return;

    // Simple rule: only treat Left/Right as repeat navigation when the caret is at the
    // corresponding edge and there is no active selection. Otherwise keep normal cursor movement.
    const shouldIntercept = shouldInterceptRepeatArrowAtEdge({
      keyName: key.name,
      cursorOffset: inputRef.cursorOffset,
      valueLength: inputRef.value.length,
      hasSelection: inputRef.hasSelection()
    });
    if (!shouldIntercept) return;

    key.preventDefault();
    key.stopPropagation();

    const direction: 1 | -1 = key.name === "right" ? 1 : -1;
    const nextRepeatMode = cycleRepeatModeClamp(draft.repeatMode, direction);
    if (nextRepeatMode !== draft.repeatMode) {
      onUpdate({ repeatMode: nextRepeatMode });
    }
  }

  return (
    <box style={{ flexDirection: "column", height: "100%", minHeight: 0 }}>
      <box style={{ flexDirection: "column", height: contentHeight, minHeight: 0 }}>
        <scrollbox
          ref={scrollboxRef}
          scrollY
          style={{
            height: "100%",
            minHeight: 0,
            rootOptions: {
              backgroundColor: "transparent"
            },
            wrapperOptions: {
              backgroundColor: "transparent"
            },
            viewportOptions: {
              backgroundColor: "transparent"
            },
            contentOptions: {
              backgroundColor: "transparent"
            }
          }}
        >
          <box
            style={{
              flexDirection: "column",
              paddingRight: showOverflowIndicator ? 1 : 0
            }}
          >
      <box style={{ flexDirection: "column" }}>
        <text style={{ color: theme.muted }}>TASK NAME *</text>
        <input
          value={draft.title}
          onChange={(value) => onUpdate({ title: value })}
          focused={focus === "title"}
          placeholder={`Ship ${APP_NAME} app update`}
          style={{ backgroundColor: theme.bg, color: theme.text, width: "100%" }}
        />
      </box>

      <box style={{ flexDirection: "column", marginTop: 1 }}>
        <text style={{ color: theme.muted }}>DATE (YYYY-MM-DD)</text>
        <input
          value={draft.dueText}
          onChange={(value) => onUpdate({ dueText: value })}
          focused={focus === "due"}
          placeholder="2026-02-08"
          style={{ backgroundColor: theme.bg, color: theme.text, width: "100%" }}
        />
        {dueSuggestionHint ? (
          <text style={{ color: theme.muted, marginTop: 1 }}>{dueSuggestionHint}</text>
        ) : null}
      </box>

      <box style={{ flexDirection: "column", marginTop: 1 }}>
        <text style={{ color: theme.muted }}>TIME (HH:mm optional)</text>
        <input
          ref={timeInputRef}
          value={draft.timeText}
          onChange={(value) => onUpdate({ timeText: normalizeTimeTextInput(value) })}
          onKeyDown={(key) => handleRepeatCycleFromInputKey(key, "time")}
          focused={focus === "time"}
          placeholder="14:30"
          style={{ backgroundColor: theme.bg, color: theme.text, width: "100%" }}
        />
        {timeSuggestionHint ? (
          <text style={{ color: theme.muted, marginTop: 1 }}>{timeSuggestionHint}</text>
        ) : null}
      </box>

      <box style={{ flexDirection: "column", marginTop: 1 }}>
        <text style={{ color: theme.muted }}>REPEAT</text>
        <input
          ref={repeatModeInputRef}
          value={draft.repeatMode}
          onChange={(value) => onUpdate({ repeatMode: normalizeRepeatMode(value) })}
          onKeyDown={(key) => handleRepeatCycleFromInputKey(key, "repeat_mode")}
          focused={focus === "repeat_mode"}
          placeholder="off"
          style={{
            backgroundColor: theme.bg,
            color: fieldInputColor(repeatEnabled),
            width: "100%"
          }}
        />
        <box style={{ flexDirection: "row", gap: 0, marginTop: 1 }}>
          {REPEAT_MODES.map((repeatMode) => {
            const selected = draft.repeatMode === repeatMode.value;
            return (
              <box
                key={repeatMode.value}
                style={{
                  flexGrow: 1,
                  flexBasis: 0,
                  height: 3,
                  minHeight: 3,
                  maxHeight: 3,
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: selected ? theme.accentBlue : theme.panel,
                  border: true,
                  borderStyle: "single",
                  borderColor: selected ? theme.accentBlue : theme.outline
                }}
                onMouseDown={() => onUpdate({ repeatMode: repeatMode.value })}
              >
                <text style={{ color: selected ? theme.bg : theme.text }}>
                  {repeatMode.label}
                </text>
              </box>
            );
          })}
        </box>
      </box>

      {recurrenceVisibility.showInterval ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: fieldLabelColor(true) }}>INTERVAL (N)</text>
          <input
            ref={repeatIntervalInputRef}
            value={draft.repeatIntervalText}
            onChange={(value) => onUpdate({ repeatIntervalText: value })}
            onKeyDown={(key) => handleRepeatCycleFromInputKey(key, "repeat_interval")}
            focused={focus === "repeat_interval"}
            placeholder="1"
            style={{
              backgroundColor: theme.bg,
              color: fieldInputColor(true),
              width: "100%"
            }}
          />
        </box>
      ) : null}

      {recurrenceVisibility.showWeekdays ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: fieldLabelColor(true) }}>WEEKDAYS (WLY)</text>
          <input
            value={repeatWeekdaysText}
            onChange={(value) => onUpdate({ repeatWeekdays: parseWeekdaysInput(value) })}
            focused={focus === "repeat_weekdays"}
            placeholder="MO,WE"
            style={{
              backgroundColor: theme.bg,
              color: fieldInputColor(true),
              width: "100%"
            }}
          />
        </box>
      ) : null}

      {recurrenceVisibility.showMonthday ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: fieldLabelColor(true) }}>MONTH DAY (MLY)</text>
          <input
            value={draft.repeatMonthdayText}
            onChange={(value) => onUpdate({ repeatMonthdayText: value })}
            focused={focus === "repeat_monthday"}
            placeholder="same day as due date"
            style={{
              backgroundColor: theme.bg,
              color: fieldInputColor(true),
              width: "100%"
            }}
          />
        </box>
      ) : null}

      {recurrenceVisibility.showCustomRule ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: fieldLabelColor(true) }}>CUSTOM RRULE (CUS)</text>
          <input
            value={draft.repeatCustomRRuleText}
            onChange={(value) => onUpdate({ repeatCustomRRuleText: value })}
            focused={focus === "repeat_custom"}
            placeholder="FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE"
            style={{
              backgroundColor: theme.bg,
              color: fieldInputColor(true),
              width: "100%"
            }}
          />
        </box>
      ) : null}

      {recurrenceVisibility.showRepeatEnd ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: fieldLabelColor(true) }}>REPEAT END (NEVER/UNTIL/COUNT)</text>
          <input
            value={draft.repeatEndMode}
            onChange={(value) => onUpdate({ repeatEndMode: normalizeEndMode(value) })}
            onKeyDown={(key) => handleRepeatCycleFromInputKey(key, "repeat_end_mode")}
            focused={focus === "repeat_end_mode"}
            placeholder="never"
            style={{
              backgroundColor: theme.bg,
              color: fieldInputColor(true),
              width: "100%"
            }}
          />
          <box style={{ flexDirection: "row", gap: 1, marginTop: 1 }}>
            {END_MODES.map((repeatEndMode) => {
              const selected = draft.repeatEndMode === repeatEndMode;
              return (
                <box
                  key={repeatEndMode}
                  style={{
                    width: 7,
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: selected ? theme.accentBlue : theme.panel,
                    border: true,
                    borderStyle: "single",
                    borderColor: selected ? theme.accentBlue : theme.outline
                  }}
                  onMouseDown={() => onUpdate({ repeatEndMode })}
                >
                  <text style={{ color: selected ? theme.bg : theme.text }}>
                    {repeatEndMode.toUpperCase()}
                  </text>
                </box>
              );
            })}
          </box>
        </box>
      ) : null}

      {recurrenceVisibility.showUntil ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: fieldLabelColor(true) }}>UNTIL DATE (END=UNTIL)</text>
          <input
            value={draft.repeatUntilText}
            onChange={(value) => onUpdate({ repeatUntilText: value })}
            focused={focus === "repeat_until"}
            placeholder="2026-12-31"
            style={{
              backgroundColor: theme.bg,
              color: fieldInputColor(true),
              width: "100%"
            }}
          />
        </box>
      ) : null}

      {recurrenceVisibility.showCount ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: fieldLabelColor(true) }}>OCCURRENCE COUNT (END=COUNT)</text>
          <input
            value={draft.repeatCountText}
            onChange={(value) => onUpdate({ repeatCountText: value })}
            focused={focus === "repeat_count"}
            placeholder="10"
            style={{
              backgroundColor: theme.bg,
              color: fieldInputColor(true),
              width: "100%"
            }}
          />
        </box>
      ) : null}

      {recurrenceVisibility.showPreview ? (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ color: fieldLabelColor(true) }}>NEXT 3 OCCURRENCES</text>
          {previewRows.map((occurrence, index) =>
            occurrence ? (
              <text key={`preview:${index}:${occurrence}`} style={{ color: theme.text }}>
                {formatPreviewValue(occurrence)}
              </text>
            ) : (
              <text key={`preview:${index}`} style={{ color: theme.muted }}>
                {repeatEnabled && index === 0 ? "(invalid recurrence input)" : " "}
              </text>
            )
          )}
        </box>
      ) : null}

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
          style={{ backgroundColor: theme.bg, color: theme.text, width: "100%" }}
        />
      </box>
          </box>
        </scrollbox>
      </box>

      <box
        style={{
          height: footerHeight,
          flexDirection: "column",
          paddingTop: footerTopPadding
        }}
      >
      <box style={{ flexDirection: "row", gap: 1 }}>
        <box
          style={{
            paddingLeft: 2,
            paddingRight: 2,
            backgroundColor: focus === "save" ? theme.ok : theme.accentBlue,
            color: theme.bg
          }}
          onMouseDown={onSave}
        >
          <text>SAVE</text>
        </box>
        <box
          style={{
            paddingLeft: 2,
            paddingRight: 2,
            backgroundColor: focus === "cancel" ? theme.warn : theme.accentOrange,
            color: theme.bg
          }}
          onMouseDown={onCancel}
        >
          <text>CANCEL</text>
        </box>
      </box>

      <box>
        <text style={{ color: theme.muted }}>
          {footerHintText}
        </text>
      </box>
      </box>
    </box>
  );
}
