import type { EditorFocus } from "./models";

export const EDITOR_FOOTER_HEIGHT = 3;
export const EDITOR_FOOTER_HINT_ROW = 1;
export const EDITOR_ACTION_ROW = 1;
const DEFAULT_PREVIEW_ROWS = 3;

export type EditorContentEstimateOptions = {
  hasDueSuggestion?: boolean;
  hasTimeSuggestion?: boolean;
  hasTagSuggestion?: boolean;
  previewRows?: number;
};

export type EditorViewportHeights = {
  contentHeight: number;
  footerHeight: number;
};

type NormalizedEstimateOptions = {
  hasDueSuggestion: boolean;
  hasTimeSuggestion: boolean;
  hasTagSuggestion: boolean;
  previewRows: number;
};

function normalizeEstimateOptions(
  options: EditorContentEstimateOptions = {}
): NormalizedEstimateOptions {
  return {
    hasDueSuggestion: options.hasDueSuggestion === true,
    hasTimeSuggestion: options.hasTimeSuggestion === true,
    hasTagSuggestion: options.hasTagSuggestion === true,
    previewRows: Math.max(1, options.previewRows ?? DEFAULT_PREVIEW_ROWS)
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

  // INTERVAL
  line += 1; // section margin
  line += 1; // label
  anchors.repeat_interval = line; // input line
  line += 1; // input

  // WEEKDAYS
  line += 1; // section margin
  line += 1; // label
  anchors.repeat_weekdays = line; // input line
  line += 1; // input

  // MONTH DAY
  line += 1; // section margin
  line += 1; // label
  anchors.repeat_monthday = line; // input line
  line += 1; // input

  // CUSTOM RRULE
  line += 1; // section margin
  line += 1; // label
  anchors.repeat_custom = line; // input line
  line += 1; // input

  // REPEAT END
  line += 1; // section margin
  line += 1; // label
  anchors.repeat_end_mode = line; // input line
  line += 1; // input
  line += 1; // chip row margin
  line += 3; // bordered chip row

  // UNTIL
  line += 1; // section margin
  line += 1; // label
  anchors.repeat_until = line; // input line
  line += 1; // input

  // COUNT
  line += 1; // section margin
  line += 1; // label
  anchors.repeat_count = line; // input line
  line += 1; // input

  // PREVIEW
  line += 1; // section margin
  line += 1; // label
  line += options.previewRows; // rows

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
  line += 1; // input

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
