import { useEffect, useMemo, useRef, useState } from "react";
import type {
  InputRenderable,
  KeyEvent,
  ScrollBoxRenderable,
  TextareaRenderable
} from "@opentui/core";
import { EditorDraft, EditorFocus, Mode } from "../domain/models";
import { WEEKDAY_ORDER } from "../domain/recurrence/draft";
import { themeForObject } from "../app/theme";
import { TagInput } from "./TagInput";
import { normalizeTimeTextInput } from "../domain/dates";
import { normalizeReminderOffsetUnit } from "../domain/reminders";
import {
  EDITOR_ACTION_ROW,
  EDITOR_FOOTER_HINT_ROW,
  estimateEditorContentLines,
  getEditorFocusAnchorLine,
  getEditorReminderVisibility,
  getEditorRecurrenceVisibility,
  getEditorViewportHeights,
  hasEditorOverflow
} from "../domain/editorPaneLayout";
import { clampScrollOffset, ensureSelectedVisible } from "../domain/scroll";
import {
  cycleReminderKindClamp,
  cycleRepeatEndModeClamp,
  cycleRepeatModeClamp,
  shouldInterceptRepeatArrowAtEdge
} from "./editorRepeatKeyboard";
import { APP_NAME } from "../brand/brand";
import { getChecklistProgress, sortChecklistItems } from "../domain/checklist";

type EditorPaneProps = {
  mode: Mode;
  draft: EditorDraft;
  focus: EditorFocus;
  availableHeightLines: number;
  scrollOffset: number;
  titleInlineSuggestion?: { full: string; remainder: string } | null;
  tagInlineSuggestion?: { full: string; remainder: string } | null;
  dueSuggestionHint?: string | null;
  timeSuggestionHint?: string | null;
  recurrencePreview?: string[];
  selectedChecklistItemId?: string | null;
  checklistFocused?: boolean;
  onSelectChecklistItem?: (itemId: string | null) => void;
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
const REMINDER_KIND_OPTIONS = ["none", "absolute", "before_due"] as const;
const REMINDER_OFFSET_UNIT_OPTIONS = ["minutes", "hours", "days"] as const;
const WORKFLOW_STAGE_OPTIONS = [
  { value: "backlog", label: "BACKLOG" },
  { value: "todo", label: "TODO" },
  { value: "in_progress", label: "IN PROGRESS" },
  { value: "blocked", label: "BLOCKED" },
  { value: "review", label: "REVIEW" },
  { value: "done", label: "DONE" }
] as const satisfies Array<{ value: NonNullable<EditorDraft["workflowStage"]>; label: string }>;
const NOTES_VISIBLE_ROWS = 6;

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

function normalizeReminderKind(input: string): EditorDraft["reminderKind"] {
  const value = input.trim().toLowerCase();
  if (value === "absolute" || value === "before_due") {
    return value;
  }
  return "none";
}

function normalizeReminderOffsetUnitInput(input: string): EditorDraft["reminderOffsetUnit"] {
  return normalizeReminderOffsetUnit(input.trim().toLowerCase());
}

function normalizeWorkflowStageInput(input: string): EditorDraft["workflowStage"] {
  const value = input.trim().toLowerCase();
  if (value.length === 0 || value === "none" || value === "clear") {
    return undefined;
  }
  if (value === "doing" || value === "in-progress") {
    return "in_progress";
  }
  if (WORKFLOW_STAGE_OPTIONS.some((option) => option.value === value)) {
    return value as EditorDraft["workflowStage"];
  }
  return undefined;
}

function cycleWorkflowStage(
  current: EditorDraft["workflowStage"],
  direction: 1 | -1
): EditorDraft["workflowStage"] {
  const size = WORKFLOW_STAGE_OPTIONS.length;
  if (size === 0) return current;
  const currentIndex = WORKFLOW_STAGE_OPTIONS.findIndex((option) => option.value === current);
  if (currentIndex === -1) {
    return direction === 1
      ? WORKFLOW_STAGE_OPTIONS[1]?.value ?? WORKFLOW_STAGE_OPTIONS[0].value
      : WORKFLOW_STAGE_OPTIONS[size - 1]?.value ?? WORKFLOW_STAGE_OPTIONS[0].value;
  }
  const nextIndex = (currentIndex + direction + size) % size;
  return WORKFLOW_STAGE_OPTIONS[nextIndex]?.value ?? current;
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

export function shouldHandlePrimaryMouseDown(button: number): boolean {
  return button === 0;
}

export function runPrimaryMouseDownAction(button: number, action: () => void): boolean {
  if (!shouldHandlePrimaryMouseDown(button)) return false;
  action();
  return true;
}

export function EditorPane({
  mode,
  draft,
  focus,
  availableHeightLines,
  scrollOffset,
  titleInlineSuggestion,
  tagInlineSuggestion,
  dueSuggestionHint,
  timeSuggestionHint,
  recurrencePreview,
  selectedChecklistItemId = null,
  checklistFocused = false,
  onSelectChecklistItem,
  onUpdate,
  onScrollOffsetChange,
  onSave,
  onCancel
}: EditorPaneProps) {
  const theme = themeForObject("inputs");
  const repeatWeekdaysText = draft.repeatWeekdays.join(",");
  const reminderVisibility = useMemo(
    () => getEditorReminderVisibility(draft.reminderKind),
    [draft.reminderKind]
  );
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
  const checklistItems = sortChecklistItems(draft.checklist);
  const checklistProgress = getChecklistProgress(draft.checklist);
  const checklistWindowSize = 5;
  const checklistSelectedIndex = checklistItems.findIndex(
    (item) => item.id === selectedChecklistItemId
  );
  const checklistWindowStart = Math.max(
    0,
    Math.min(
      Math.max(0, checklistSelectedIndex),
      Math.max(0, checklistItems.length - checklistWindowSize)
    )
  );
  const checklistWindow = checklistItems.slice(
    checklistWindowStart,
    checklistWindowStart + checklistWindowSize
  );
  const checklistHiddenAbove = checklistWindowStart;
  const checklistHiddenBelow = Math.max(
    0,
    checklistItems.length - (checklistWindowStart + checklistWindow.length)
  );
  const previewLineCount = Math.max(1, previewRows.length);
  const estimateOptions = useMemo(
    () => ({
      hasTitleSuggestion: Boolean(titleInlineSuggestion?.remainder),
      hasDueSuggestion: Boolean(dueSuggestionHint),
      hasTimeSuggestion: Boolean(timeSuggestionHint),
      reminderKind: draft.reminderKind,
      hasTagSuggestion: Boolean(tagInlineSuggestion?.remainder),
      checklistItemCount: draft.checklist.length,
      repeatMode: draft.repeatMode,
      repeatEndMode: draft.repeatEndMode,
      previewRows: previewLineCount,
      notesVisibleRows: NOTES_VISIBLE_ROWS
    }),
    [
      draft.repeatEndMode,
      draft.repeatMode,
      draft.reminderKind,
      draft.checklist.length,
      titleInlineSuggestion?.remainder,
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
  const notesTextareaRef = useRef<TextareaRenderable | null>(null);
  const [notesScrollVersion, setNotesScrollVersion] = useState(0);
  const [workflowStageInput, setWorkflowStageInput] = useState(draft.workflowStage ?? "");
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
  const checklistHintText = checklistFocused
    ? " · CHECKLIST: J/K MOVE · SPACE TOGGLE · A/E/D"
    : "";
  const titleSuggestionPrefix = titleInlineSuggestion
    ? titleInlineSuggestion.full.slice(
        0,
        titleInlineSuggestion.full.length - titleInlineSuggestion.remainder.length
      )
    : "";
  const beforeDueReminderMissingDue =
    reminderVisibility.kind === "before_due" && draft.dueText.trim().length === 0;

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

  useEffect(() => {
    const textarea = notesTextareaRef.current;
    if (!textarea) return;
    if (focus === "notes") return;
    if (textarea.plainText !== draft.notes) {
      textarea.setText(draft.notes);
    }
  }, [draft.notes, focus]);

  useEffect(() => {
    if (focus === "workflow_stage") return;
    setWorkflowStageInput(draft.workflowStage ?? "");
  }, [draft.workflowStage, focus]);

  function fieldLabelColor(active: boolean): string {
    return active ? theme.muted : theme.outline;
  }

  function fieldInputColor(active: boolean): string {
    return active ? theme.text : theme.muted;
  }

  function refreshNotesScrollIndicator(): void {
    setNotesScrollVersion((value) => value + 1);
  }

  const notesScrollbar = useMemo(() => {
    const textarea = notesTextareaRef.current;
    if (!textarea) {
      return { hasOverflow: false, thumbTop: 0, thumbSize: NOTES_VISIBLE_ROWS };
    }
    const lineCount = textarea.lineInfo.lineStarts.length;
    const maxScroll = Math.max(0, lineCount - NOTES_VISIBLE_ROWS);
    const scrollY = Math.max(0, Math.min(textarea.scrollY, maxScroll));
    if (maxScroll === 0) {
      return { hasOverflow: false, thumbTop: 0, thumbSize: NOTES_VISIBLE_ROWS };
    }
    const thumbSize = Math.max(
      1,
      Math.min(NOTES_VISIBLE_ROWS, Math.floor((NOTES_VISIBLE_ROWS * NOTES_VISIBLE_ROWS) / lineCount))
    );
    const travel = NOTES_VISIBLE_ROWS - thumbSize;
    const thumbTop = travel > 0 ? Math.round((scrollY / maxScroll) * travel) : 0;
    return { hasOverflow: true, thumbTop, thumbSize };
  }, [draft.notes, focus, notesScrollVersion]);

  // Clamp behavior: repeat mode stops at OFF/CUS instead of wrapping.
  function handleRepeatCycleFromInputKey(
    key: KeyEvent,
    source: "time" | "reminder_kind" | "repeat_mode" | "repeat_interval" | "repeat_end_mode"
  ): void {
    if (key.name !== "left" && key.name !== "right") return;

    if (source === "reminder_kind") {
      key.preventDefault();
      key.stopPropagation();
      const direction: 1 | -1 = key.name === "right" ? 1 : -1;
      const nextReminderKind = cycleReminderKindClamp(draft.reminderKind, direction);
      if (nextReminderKind !== draft.reminderKind) {
        onUpdate({ reminderKind: nextReminderKind });
      }
      return;
    }

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

  function handleWorkflowStageInputKey(key: KeyEvent): void {
    if (key.name !== "left" && key.name !== "right") return;
    key.preventDefault();
    key.stopPropagation();
    const direction: 1 | -1 = key.name === "right" ? 1 : -1;
    const nextStage = cycleWorkflowStage(draft.workflowStage, direction);
    setWorkflowStageInput(nextStage ?? "");
    onUpdate({ workflowStage: nextStage });
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
        {titleInlineSuggestion?.remainder ? (
          <box style={{ flexDirection: "row", gap: 0, marginTop: 1 }}>
            <text style={{ color: theme.muted }}>→ </text>
            <text style={{ color: theme.text }}>{titleSuggestionPrefix}</text>
            <text style={{ color: theme.muted }}>{titleInlineSuggestion.remainder}</text>
            <text style={{ color: theme.muted }}> (press →)</text>
          </box>
        ) : null}
      </box>

      <box style={{ flexDirection: "column", marginTop: 1 }}>
        <text style={{ color: theme.muted }}>DATE (ISO or mini)</text>
        <input
          value={draft.dueText}
          onChange={(value) => onUpdate({ dueText: value })}
          focused={focus === "due"}
          placeholder="today | tomorrow | mon | +3d | 3pm | tomorrow 3pm"
          style={{ backgroundColor: theme.bg, color: theme.text, width: "100%" }}
        />
        {dueSuggestionHint ? (
          <text style={{ color: theme.muted, marginTop: 1 }}>{dueSuggestionHint}</text>
        ) : null}
      </box>

      <box style={{ flexDirection: "column", marginTop: 1 }}>
        <text style={{ color: theme.muted }}>TIME (HH:mm / 3pm optional)</text>
        <input
          ref={timeInputRef}
          value={draft.timeText}
          onChange={(value) => onUpdate({ timeText: normalizeTimeTextInput(value) })}
          onKeyDown={(key) => handleRepeatCycleFromInputKey(key, "time")}
          focused={focus === "time"}
          placeholder="3pm | 15:30"
          style={{ backgroundColor: theme.bg, color: theme.text, width: "100%" }}
        />
        {timeSuggestionHint ? (
          <text style={{ color: theme.muted, marginTop: 1 }}>{timeSuggestionHint}</text>
        ) : null}
      </box>

      <box style={{ flexDirection: "column", marginTop: 1 }}>
        <text style={{ color: theme.muted }}>REMINDER</text>
        <input
          value={draft.reminderKind}
          onChange={(value) => onUpdate({ reminderKind: normalizeReminderKind(value) })}
          onKeyDown={(key) => handleRepeatCycleFromInputKey(key, "reminder_kind")}
          focused={focus === "reminder_kind"}
          placeholder="none"
          style={{
            backgroundColor: theme.bg,
            color: fieldInputColor(true),
            width: "100%"
          }}
        />
        <box style={{ flexDirection: "row", gap: 0, marginTop: 1 }}>
          {REMINDER_KIND_OPTIONS.map((kind) => {
            const selected = draft.reminderKind === kind;
            const label = kind === "none" ? "NONE" : kind === "absolute" ? "AT" : "BEFORE DUE";
            return (
              <box
                key={kind}
                style={{
                  backgroundColor: selected ? theme.accentBlue : theme.panel,
                  paddingLeft: 1,
                  paddingRight: 1
                }}
                onMouseDown={(event) =>
                  runPrimaryMouseDownAction(event.button, () =>
                    onUpdate({ reminderKind: kind })
                  )
                }
              >
                <text style={{ color: selected ? theme.bg : theme.text, fontWeight: "bold" }}>
                  {label}
                </text>
              </box>
            );
          })}
        </box>
      </box>

      {reminderVisibility.showAbsolute ? (
        <>
          <box style={{ flexDirection: "column", marginTop: 1 }}>
            <text style={{ color: fieldLabelColor(true) }}>REMIND AT DATE (YYYY-MM-DD)</text>
            <input
              value={draft.reminderAtDateText}
              onChange={(value) => onUpdate({ reminderAtDateText: value })}
              focused={focus === "reminder_at_date"}
              placeholder="2026-02-08"
              style={{
                backgroundColor: theme.bg,
                color: fieldInputColor(true),
                width: "100%"
              }}
            />
          </box>
          <box style={{ flexDirection: "column", marginTop: 1 }}>
            <text style={{ color: fieldLabelColor(true) }}>REMIND AT TIME (HH:mm optional)</text>
            <input
              value={draft.reminderAtTimeText}
              onChange={(value) => onUpdate({ reminderAtTimeText: normalizeTimeTextInput(value) })}
              focused={focus === "reminder_at_time"}
              placeholder="09:00"
              style={{
                backgroundColor: theme.bg,
                color: fieldInputColor(true),
                width: "100%"
              }}
            />
          </box>
        </>
      ) : null}

      {reminderVisibility.showBeforeDue ? (
        <>
          <box style={{ flexDirection: "column", marginTop: 1 }}>
            <text style={{ color: fieldLabelColor(true) }}>BEFORE DUE OFFSET</text>
            <input
              value={draft.reminderOffsetText}
              onChange={(value) => onUpdate({ reminderOffsetText: value })}
              focused={focus === "reminder_offset_value"}
              placeholder="10"
              style={{
                backgroundColor: theme.bg,
                color: fieldInputColor(true),
                width: "100%"
              }}
            />
          </box>
          <box style={{ flexDirection: "column", marginTop: 1 }}>
            <text style={{ color: fieldLabelColor(true) }}>OFFSET UNIT</text>
            <input
              value={draft.reminderOffsetUnit}
              onChange={(value) =>
                onUpdate({
                  reminderOffsetUnit: normalizeReminderOffsetUnitInput(value)
                })
              }
              focused={focus === "reminder_offset_unit"}
              placeholder="minutes"
              style={{
                backgroundColor: theme.bg,
                color: fieldInputColor(true),
                width: "100%"
              }}
            />
            <box style={{ flexDirection: "row", gap: 1, marginTop: 1 }}>
              {REMINDER_OFFSET_UNIT_OPTIONS.map((unit) => {
                const selected = draft.reminderOffsetUnit === unit;
                const label = unit === "minutes" ? "MIN" : unit === "hours" ? "HRS" : "DAYS";
                return (
                  <box
                    key={unit}
                    style={{
                      backgroundColor: selected ? theme.accentBlue : theme.panel,
                      paddingLeft: 1,
                      paddingRight: 1
                    }}
                    onMouseDown={(event) =>
                      runPrimaryMouseDownAction(event.button, () =>
                        onUpdate({ reminderOffsetUnit: unit })
                      )
                    }
                  >
                    <text style={{ color: selected ? theme.bg : theme.text, fontWeight: "bold" }}>
                      {label}
                    </text>
                  </box>
                );
              })}
            </box>
          </box>
          {beforeDueReminderMissingDue ? (
            <text style={{ color: theme.warn, marginTop: 1 }}>
              Set a due date to use 'before due' reminders
            </text>
          ) : null}
        </>
      ) : null}

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
                onMouseDown={(event) =>
                  runPrimaryMouseDownAction(event.button, () =>
                    onUpdate({ repeatMode: repeatMode.value })
                  )
                }
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
                  onMouseDown={(event) =>
                    runPrimaryMouseDownAction(event.button, () => onUpdate({ repeatEndMode }))
                  }
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
        <text style={{ color: theme.muted }}>ASSIGNEE</text>
        <input
          value={draft.assigneeText}
          onChange={(value) => onUpdate({ assigneeText: value })}
          focused={focus === "assignee"}
          placeholder="alex"
          style={{ backgroundColor: theme.bg, color: theme.text, width: "100%" }}
        />
      </box>

      <box style={{ flexDirection: "column", marginTop: 1 }}>
        <text style={{ color: theme.muted }}>PROJECT</text>
        <input
          value={draft.projectText}
          onChange={(value) => onUpdate({ projectText: value })}
          focused={focus === "project"}
          placeholder="phoenix"
          style={{ backgroundColor: theme.bg, color: theme.text, width: "100%" }}
        />
      </box>

      <box style={{ flexDirection: "column", marginTop: 1 }}>
        <text style={{ color: theme.muted }}>STAGE</text>
        <input
          value={workflowStageInput}
          onChange={(value) => {
            setWorkflowStageInput(value);
            const normalized = normalizeWorkflowStageInput(value);
            if (normalized !== undefined || value.trim().length === 0) {
              onUpdate({ workflowStage: normalized });
            }
          }}
          onKeyDown={handleWorkflowStageInputKey}
          focused={focus === "workflow_stage"}
          placeholder="todo"
          style={{ backgroundColor: theme.bg, color: theme.text, width: "100%" }}
        />
        <text style={{ color: theme.muted, marginTop: 1 }}>
          valid: backlog|todo|doing|blocked|review|done
        </text>
        <box style={{ flexDirection: "row", gap: 0, marginTop: 1, flexWrap: "wrap" }}>
          {WORKFLOW_STAGE_OPTIONS.map((option) => {
            const selected = draft.workflowStage === option.value;
            return (
              <box
                key={option.value}
                style={{
                  backgroundColor: selected ? theme.accentBlue : theme.panel,
                  paddingLeft: 1,
                  paddingRight: 1
                }}
                onMouseDown={(event) =>
                  runPrimaryMouseDownAction(event.button, () => {
                    setWorkflowStageInput(option.value);
                    onUpdate({ workflowStage: option.value });
                  })
                }
              >
                <text style={{ color: selected ? theme.bg : theme.text, fontWeight: "bold" }}>
                  {option.label}
                </text>
              </box>
            );
          })}
        </box>
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
        <text style={{ color: checklistFocused ? theme.accentBlue : theme.muted }}>
          CHECKLIST ({String(checklistProgress.done)}/{String(checklistProgress.total)})
        </text>
        {checklistItems.length === 0 ? (
          <text style={{ color: checklistFocused ? theme.text : theme.muted }}>
            No checklist items (A to add)
          </text>
        ) : (
          <>
            {checklistHiddenAbove > 0 ? (
              <text style={{ color: theme.muted }}>↑ {String(checklistHiddenAbove)} more</text>
            ) : null}
            {checklistWindow.map((item) => {
              const selected = item.id === selectedChecklistItemId;
              const itemPrefix = item.isDone ? "[x]" : "[ ]";
              const bg = selected && checklistFocused ? theme.accentBlue : "transparent";
              const color = selected && checklistFocused ? theme.bg : theme.text;
              return (
                <box
                  key={item.id}
                  style={{
                    backgroundColor: bg,
                    paddingLeft: 1,
                    paddingRight: 1
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    onSelectChecklistItem?.(item.id);
                  }}
                >
                  <text style={{ color }}>
                    {itemPrefix} {item.text}
                  </text>
                </box>
              );
            })}
            {checklistHiddenBelow > 0 ? (
              <text style={{ color: theme.muted }}>↓ {String(checklistHiddenBelow)} more</text>
            ) : null}
          </>
        )}
      </box>

      <box style={{ flexDirection: "column", marginTop: 1 }}>
        <text style={{ color: theme.muted }}>NOTES</text>
        <box style={{ flexDirection: "row", width: "100%", minHeight: NOTES_VISIBLE_ROWS }}>
          <textarea
            ref={notesTextareaRef}
            initialValue={draft.notes}
            onContentChange={() => {
              const value = notesTextareaRef.current?.plainText ?? "";
              if (value !== draft.notes) {
                onUpdate({ notes: value });
              }
              refreshNotesScrollIndicator();
            }}
            onKeyDown={() => refreshNotesScrollIndicator()}
            onMouseScroll={() => refreshNotesScrollIndicator()}
            focused={focus === "notes"}
            placeholder="Optional details"
            wrapMode="word"
            style={{
              height: NOTES_VISIBLE_ROWS,
              minHeight: NOTES_VISIBLE_ROWS,
              maxHeight: NOTES_VISIBLE_ROWS,
              backgroundColor: theme.bg,
              color: theme.text,
              width: "100%"
            }}
          />
          <box
            style={{
              marginLeft: 1,
              minWidth: 1,
              width: 1,
              height: NOTES_VISIBLE_ROWS,
              flexDirection: "column"
            }}
          >
            {Array.from({ length: NOTES_VISIBLE_ROWS }).map((_, rowIndex) => {
              const inThumb =
                notesScrollbar.hasOverflow &&
                rowIndex >= notesScrollbar.thumbTop &&
                rowIndex < notesScrollbar.thumbTop + notesScrollbar.thumbSize;
              return (
                <text key={`notes-scroll-${rowIndex}`} style={{ color: theme.outline }}>
                  {notesScrollbar.hasOverflow ? (inThumb ? "█" : "│") : " "}
                </text>
              );
            })}
          </box>
        </box>
      </box>
      <box style={{ flexDirection: "column", marginTop: 1 }}>
        <text style={{ color: theme.muted }}>TOME CONTEXT</text>
        <text style={{ color: theme.muted }}>
          Ctrl+N quick-captures from editor and auto-targets this task context.
        </text>
        <text style={{ color: theme.muted }}>
          Bridge inline NOTES into TOME using --from-task-notes (optional --clear-task-notes).
        </text>
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
          onMouseDown={(event) => {
            runPrimaryMouseDownAction(event.button, onSave);
          }}
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
          onMouseDown={(event) => {
            runPrimaryMouseDownAction(event.button, onCancel);
          }}
        >
          <text>CANCEL</text>
        </box>
      </box>

      <box>
        <text style={{ color: theme.muted }}>
          {footerHintText}
          {checklistHintText}
        </text>
      </box>
      </box>
    </box>
  );
}
