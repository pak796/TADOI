import { Task } from "./models";

export type SelectionReconcileResult = {
  selectedId?: string;
  selectedIndex: number;
};

function clampIndex(index: number, itemCount: number): number {
  if (itemCount <= 0) return 0;
  return Math.max(0, Math.min(index, itemCount - 1));
}

export function reconcileSelectionById(
  visibleTasks: Task[],
  selectedId: string | undefined,
  previousIndex: number
): SelectionReconcileResult {
  if (visibleTasks.length === 0) {
    return { selectedId: undefined, selectedIndex: 0 };
  }

  if (selectedId) {
    const nextIndex = visibleTasks.findIndex((task) => task.id === selectedId);
    if (nextIndex >= 0) {
      return { selectedId, selectedIndex: nextIndex };
    }
  }

  const fallbackIndex = clampIndex(previousIndex, visibleTasks.length);
  return {
    selectedId: visibleTasks[fallbackIndex].id,
    selectedIndex: fallbackIndex
  };
}
