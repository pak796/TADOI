import { formatTagForReadOnlyDisplay } from "./priorityTags";

export type TagPillLayout = {
  visibleTags: string[];
  hiddenCount: number;
};

function chipWidth(label: string): number {
  // Left/right padding is 1 each.
  return label.length + 2;
}

function chipsRowWidth(labels: string[]): number {
  if (labels.length === 0) return 0;
  return labels.reduce((sum, label, index) => {
    return sum + chipWidth(label) + (index > 0 ? 1 : 0);
  }, 0);
}

export function computeVisibleTagPills(tags: string[], maxColumns: number): TagPillLayout {
  if (tags.length === 0) {
    return { visibleTags: [], hiddenCount: 0 };
  }

  const safeMaxColumns = Math.max(0, Math.floor(maxColumns));
  if (safeMaxColumns === 0) {
    return { visibleTags: [], hiddenCount: tags.length };
  }

  const labels = tags.map((tag) => formatTagForReadOnlyDisplay(tag));
  let visibleCount = 0;
  let usedWidth = 0;

  for (let index = 0; index < labels.length; index += 1) {
    const needed = chipWidth(labels[index]) + (visibleCount > 0 ? 1 : 0);
    if (usedWidth + needed > safeMaxColumns) break;
    usedWidth += needed;
    visibleCount += 1;
  }

  if (visibleCount >= tags.length) {
    return { visibleTags: tags, hiddenCount: 0 };
  }

  let hiddenCount = tags.length - visibleCount;
  while (visibleCount >= 0) {
    const overflowLabel = `+${String(hiddenCount)}`;
    const overflowNeeded = chipWidth(overflowLabel) + (visibleCount > 0 ? 1 : 0);
    if (visibleCount === 0 || usedWidth + overflowNeeded <= safeMaxColumns) {
      break;
    }
    visibleCount -= 1;
    usedWidth = chipsRowWidth(labels.slice(0, visibleCount));
    hiddenCount = tags.length - visibleCount;
  }

  const safeVisibleCount = Math.max(0, visibleCount);
  return {
    visibleTags: tags.slice(0, safeVisibleCount),
    hiddenCount: Math.max(0, tags.length - safeVisibleCount)
  };
}
