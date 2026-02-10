export type SelectionReconcileResult = {
  selectedId?: string;
  selectedIndex: number;
};

function clampIndex(index: number, itemCount: number): number {
  if (itemCount <= 0) return 0;
  return Math.max(0, Math.min(index, itemCount - 1));
}

export function reconcileSelectionById(
  visibleItems: Array<{ id: string }>,
  selectedId: string | undefined,
  previousIndex: number
): SelectionReconcileResult {
  if (visibleItems.length === 0) {
    return { selectedId: undefined, selectedIndex: 0 };
  }

  if (selectedId) {
    const nextIndex = visibleItems.findIndex((item) => item.id === selectedId);
    if (nextIndex >= 0) {
      return { selectedId, selectedIndex: nextIndex };
    }
  }

  const fallbackIndex = clampIndex(previousIndex, visibleItems.length);
  return {
    selectedId: visibleItems[fallbackIndex].id,
    selectedIndex: fallbackIndex
  };
}
