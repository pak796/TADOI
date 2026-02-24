import { formatTagForReadOnlyDisplay } from "../domain/priorityTags";

export type TopTagStat = {
  tag: string;
  total: number;
  dueThisWeek: number;
};

export type OpenPriorityStat = {
  priorityTag: string;
  displayPriority: string;
  total: number;
};

export type TagTickerSegment = {
  tag: string;
  total: number;
  dueThisWeek: number;
  displayTag: string;
};

export type PriorityTickerSegment = {
  priorityTag: string;
  displayPriority: string;
  total: number;
};

const TAG_PILL_PADDING = 2;

export function truncateToWidth(value: string, maxWidth: number): string {
  if (maxWidth <= 0) return "";
  if (value.length <= maxWidth) return value;
  if (maxWidth <= 3) return value.slice(0, maxWidth);
  return `${value.slice(0, maxWidth - 3)}...`;
}

export function fitLineToWidth(value: string, width: number): string {
  const truncated = truncateToWidth(value, width);
  if (truncated.length >= width) return truncated;
  return truncated.padEnd(width, " ");
}

export function pickHelpCloseButtonLabel(maxWidth: number): string {
  if (maxWidth >= "[Esc] Close".length + 2) return "[Esc] Close";
  if (maxWidth >= "Close".length + 2) return "Close";
  if (maxWidth >= "X".length + 2) return "X";
  return "";
}

export function truncateTagDisplay(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  if (maxLen <= 1) return "#";
  if (maxLen === 2) return "#~";
  return `${value.slice(0, maxLen - 1)}~`;
}

export function buildTagTickerSegments(
  stats: TopTagStat[],
  maxWidth: number
): TagTickerSegment[] {
  const separator = "  ";
  const segments: TagTickerSegment[] = [];
  let used = 0;

  for (const stat of stats) {
    const displayTag = formatTagForReadOnlyDisplay(stat.tag);
    const countText = String(stat.total);
    const segmentText = `${countText} ${displayTag}`;
    let segmentLen = segmentText.length + TAG_PILL_PADDING;
    const extra = segments.length ? separator.length : 0;

    if (used + extra + segmentLen <= maxWidth) {
      segments.push({ ...stat, displayTag });
      used += extra + segmentLen;
      continue;
    }

    const available = maxWidth - used - extra;
    if (available <= 0) break;
    const nonTagLen = countText.length + TAG_PILL_PADDING;
    const maxTagLen = available - nonTagLen;
    if (maxTagLen <= 1) break;

    const truncatedTag = truncateTagDisplay(displayTag, maxTagLen);
    const truncatedText = `${countText} ${truncatedTag}`;
    segmentLen = truncatedText.length + TAG_PILL_PADDING;
    if (used + extra + segmentLen <= maxWidth) {
      segments.push({ ...stat, displayTag: truncatedTag });
    }
    break;
  }

  return segments;
}

export function buildPriorityTickerSegments(
  stats: OpenPriorityStat[],
  maxWidth: number
): PriorityTickerSegment[] {
  const separator = "  ";
  const segments: PriorityTickerSegment[] = [];
  let used = 0;

  for (const stat of stats) {
    const segmentText = `${stat.total} ${stat.displayPriority}`;
    const segmentLen = segmentText.length + TAG_PILL_PADDING;
    const extra = segments.length ? separator.length : 0;

    if (used + extra + segmentLen > maxWidth) {
      break;
    }

    segments.push({ ...stat });
    used += extra + segmentLen;
  }

  return segments;
}
