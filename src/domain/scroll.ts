export type ScrollState = {
  selectedIndex: number;
  scrollOffset: number;
  visibleRows: number;
  itemCount: number;
};

export function ensureSelectedVisible({
  selectedIndex,
  scrollOffset,
  visibleRows,
  itemCount
}: ScrollState): number {
  if (itemCount <= 0) return 0;
  const safeVisible = Math.max(1, visibleRows);
  const clampedSelected = Math.max(0, Math.min(selectedIndex, itemCount - 1));
  let nextOffset = scrollOffset;
  if (clampedSelected < scrollOffset) {
    nextOffset = clampedSelected;
  } else if (clampedSelected >= scrollOffset + safeVisible) {
    nextOffset = clampedSelected - safeVisible + 1;
  }
  const maxOffset = Math.max(0, itemCount - safeVisible);
  return Math.max(0, Math.min(nextOffset, maxOffset));
}
