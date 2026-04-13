export type ScrollState = {
  selectedIndex: number;
  scrollOffset: number;
  visibleRows: number;
  itemCount: number;
};

export function clampSelectedIndex(
  selectedIndex: number,
  itemCount: number,
): number {
  if (itemCount <= 0) return 0;
  return Math.max(0, Math.min(selectedIndex, itemCount - 1));
}

export function clampScrollOffset(
  scrollOffset: number,
  visibleRows: number,
  itemCount: number,
): number {
  if (itemCount <= 0) return 0;
  const safeVisible = Math.max(1, visibleRows);
  const maxOffset = Math.max(0, itemCount - safeVisible);
  return Math.max(0, Math.min(scrollOffset, maxOffset));
}

export function ensureSelectedVisible({
  selectedIndex,
  scrollOffset,
  visibleRows,
  itemCount,
}: ScrollState): number {
  if (itemCount <= 0) return 0;
  const safeVisible = Math.max(1, visibleRows);
  const clampedSelected = clampSelectedIndex(selectedIndex, itemCount);
  const clampedOffset = clampScrollOffset(scrollOffset, visibleRows, itemCount);
  let nextOffset = clampedOffset;
  if (clampedSelected < clampedOffset) {
    nextOffset = clampedSelected;
  } else if (clampedSelected >= clampedOffset + safeVisible) {
    nextOffset = clampedSelected - safeVisible + 1;
  }
  return clampScrollOffset(nextOffset, visibleRows, itemCount);
}
