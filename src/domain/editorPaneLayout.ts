import type { EditorDraft, EditorFocus } from "./models";

export const EDITOR_FOOTER_HEIGHT = 3;
export const EDITOR_FOOTER_HINT_ROW = 1;
export const EDITOR_ACTION_ROW = 1;
const DEFAULT_PREVIEW_ROWS = 3;
const DEFAULT_NOTES_VISIBLE_ROWS = 6;

export type EditorContentEstimateOptions = {
  hasDueSuggestion?: boolean;
  hasTimeSuggestion?: boolean;
  hasTagSuggestion?: boolean;
  repeatMode?: EditorDraft["repeatMode"];
  repeatEndMode?: EditorDraft["repeatEndMode"];
  previewRows?: number;
  notesVisibleRows?: number;
};

export type EditorRecurrenceVisibility = {
  repeatEnabled: boolean;
  showInterval: boolean;
  showWeekdays: boolean;
  showMonthday: boolean;
  showCustomRule: boolean;
  showRepeatEnd: boolean;
  showUntil: boolean;
  showCount: boolean;
  showPreview: boolean;
};

export type EditorViewportHeights = {
  contentHeight: number;
  footerHeight: number;
};

type NormalizedEstimateOptions = {
  hasDueSuggestion: boolean;
  hasTimeSuggestion: boolean;
  hasTagSuggestion: boolean;
  repeatMode: EditorDraft["repeatMode"];
  repeatEndMode: EditorDraft["repeatEndMode"];
  previewRows: number;
  notesVisibleRows: number;
};

export function getEditorRecurrenceVisibility(
  repeatMode: EditorDraft["repeatMode"] | undefined,
  repeatEndMode: EditorDraft["repeatEndMode"] | undefined
): EditorRecurrenceVisibility {
  const mode = repeatMode ?? "off";
  const endMode = repeatEndMode ?? "never";
  const repeatEnabled = mode !== "off";

  if (!repeatEnabled) {
    return {
      repeatEnabled: false,
      showInterval: false,
      showWeekdays: false,
      showMonthday: false,
      showCustomRule: false,
      showRepeatEnd: false,
      showUntil: false,
      showCount: false,
      showPreview: false
    };
  }

  if (mode === "custom") {
    return {
      repeatEnabled: true,
      showInterval: false,
      showWeekdays: false,
      showMonthday: false,
      showCustomRule: true,
      showRepeatEnd: false,
      showUntil: false,
      showCount: false,
      showPreview: true
    };
  }

  const showRepeatEnd = true;
  const showUntil = endMode === "until";
  const showCount = endMode === "count";

  return {
    repeatEnabled: true,
    showInterval: true,
    showWeekdays: mode === "weekly",
    showMonthday: mode === "monthly",
    showCustomRule: false,
    showRepeatEnd,
    showUntil,
    showCount,
    showPreview: true
  };
}

function normalizeEstimateOptions(
  options: EditorContentEstimateOptions = {}
): NormalizedEstimateOptions {
  return {
    hasDueSuggestion: options.hasDueSuggestion === true,
    hasTimeSuggestion: options.hasTimeSuggestion === true,
    hasTagSuggestion: options.hasTagSuggestion === true,
    repeatMode: options.repeatMode ?? "off",
    repeatEndMode: options.repeatEndMode ?? "never",
    previewRows: Math.max(1, options.previewRows ?? DEFAULT_PREVIEW_ROWS),
    notesVisibleRows: Math.max(1, options.notesVisibleRows ?? DEFAULT_NOTES_VISIBLE_ROWS)
  };
}

function buildEditorLineModel(options: NormalizedEstimateOptions): {
  totalLines: number;
  anchors: Record<EditorFocus, number>;
} {
  let line = 0;
  const anchors = {} as Record<EditorFocus, number>;

  // TASK NAME
  line += 1; // label
  anchors.title = line; // input line
  line += 1; // input

  // DATE
  line += 1; // section margin
  line += 1; // label
  anchors.due = line; // input line
  line += 1; // input
  if (options.hasDueSuggestion) line += 1;

  // TIME
  line += 1; // section margin
  line += 1; // label
  anchors.time = line; // input line
  line += 1; // input
  if (options.hasTimeSuggestion) line += 1;

  // REPEAT MODE
  line += 1; // section margin
  line += 1; // label
  anchors.repeat_mode = line; // input line
  line += 1; // input
  line += 1; // chip row margin
  line += 3; // bordered chip row

  const recurrenceVisibility = getEditorRecurrenceVisibility(
    options.repeatMode,
    options.repeatEndMode
  );
  let firstVisibleRecurrenceAnchor: number | null = null;

  const markRecurrenceAnchor = (focus: EditorFocus) => {
    if (firstVisibleRecurrenceAnchor === null) {
      firstVisibleRecurrenceAnchor = anchors[focus];
    }
  };

  if (recurrenceVisibility.showInterval) {
    line += 1; // section margin
    line += 1; // label
    anchors.repeat_interval = line; // input line
    line += 1; // input
    markRecurrenceAnchor("repeat_interval");
  }

  if (recurrenceVisibility.showWeekdays) {
    line += 1; // section margin
    line += 1; // label
    anchors.repeat_weekdays = line; // input line
    line += 1; // input
    markRecurrenceAnchor("repeat_weekdays");
  }

  if (recurrenceVisibility.showMonthday) {
    line += 1; // section margin
    line += 1; // label
    anchors.repeat_monthday = line; // input line
    line += 1; // input
    markRecurrenceAnchor("repeat_monthday");
  }

  if (recurrenceVisibility.showCustomRule) {
    line += 1; // section margin
    line += 1; // label
    anchors.repeat_custom = line; // input line
    line += 1; // input
    markRecurrenceAnchor("repeat_custom");
  }

  if (recurrenceVisibility.showRepeatEnd) {
    line += 1; // section margin
    line += 1; // label
    anchors.repeat_end_mode = line; // input line
    line += 1; // input
    line += 1; // chip row margin
    line += 3; // bordered chip row
    markRecurrenceAnchor("repeat_end_mode");
  }

  if (recurrenceVisibility.showUntil) {
    line += 1; // section margin
    line += 1; // label
    anchors.repeat_until = line; // input line
    line += 1; // input
    markRecurrenceAnchor("repeat_until");
  }

  if (recurrenceVisibility.showCount) {
    line += 1; // section margin
    line += 1; // label
    anchors.repeat_count = line; // input line
    line += 1; // input
    markRecurrenceAnchor("repeat_count");
  }

  if (recurrenceVisibility.showPreview) {
    line += 1; // section margin
    line += 1; // label
    line += options.previewRows; // rows
  }

  // Hidden recurrence targets anchor to the nearest visible recurrence row, or repeat mode.
  const recurrenceFallbackAnchor = firstVisibleRecurrenceAnchor ?? anchors.repeat_mode;
  anchors.repeat_interval ??= recurrenceFallbackAnchor;
  anchors.repeat_weekdays ??= recurrenceFallbackAnchor;
  anchors.repeat_monthday ??= recurrenceFallbackAnchor;
  anchors.repeat_custom ??= recurrenceFallbackAnchor;
  anchors.repeat_end_mode ??= recurrenceFallbackAnchor;
  const repeatEndFallbackAnchor = anchors.repeat_end_mode ?? recurrenceFallbackAnchor;
  anchors.repeat_until ??= repeatEndFallbackAnchor;
  anchors.repeat_count ??= repeatEndFallbackAnchor;

  // TAGS
  line += 1; // section margin
  line += 1; // label
  anchors.tags = line; // input line
  line += 1; // input
  if (options.hasTagSuggestion) {
    line += 2; // margin + suggestion row
  }

  // NOTES
  line += 1; // section margin
  line += 1; // label
  anchors.notes = line; // input line
  line += options.notesVisibleRows; // input rows

  // Save/cancel are footer controls, not content lines. Anchor to last content row.
  const footerAnchor = Math.max(0, line - 1);
  anchors.save = footerAnchor;
  anchors.cancel = footerAnchor;

  return { totalLines: line, anchors };
}

export function getEditorViewportHeights(totalHeightLines: number): EditorViewportHeights {
  const safeTotal = Math.max(1, Math.floor(totalHeightLines));
  const footerHeight = Math.min(EDITOR_FOOTER_HEIGHT, Math.max(0, safeTotal - 1));
  const contentHeight = Math.max(1, safeTotal - footerHeight);
  return { contentHeight, footerHeight };
}

export function estimateEditorContentLines(
  options: EditorContentEstimateOptions = {}
): number {
  const normalized = normalizeEstimateOptions(options);
  return buildEditorLineModel(normalized).totalLines;
}

export function getEditorFocusAnchorLine(
  focus: EditorFocus,
  options: EditorContentEstimateOptions = {}
): number {
  const normalized = normalizeEstimateOptions(options);
  const model = buildEditorLineModel(normalized);
  return model.anchors[focus] ?? 0;
}

export function hasEditorOverflow(
  totalHeightLines: number,
  estimatedContentLines: number
): boolean {
  const { contentHeight } = getEditorViewportHeights(totalHeightLines);
  return estimatedContentLines > contentHeight;
}
