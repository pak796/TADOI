import type { BackupFileInfo } from "./backupService";
import type { GitHubSnapshotListItem } from "./backupCenterFlow";

const BACKUP_IMPORT_PICKER_MIN_VISIBLE_ROWS = 1;

export function normalizeOptionalInput(
  value: string | undefined,
): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function normalizeImportPickerVisibleRows(visibleRows: number): number {
  if (!Number.isFinite(visibleRows) || visibleRows <= 0) {
    return BACKUP_IMPORT_PICKER_MIN_VISIBLE_ROWS;
  }
  return Math.max(
    BACKUP_IMPORT_PICKER_MIN_VISIBLE_ROWS,
    Math.floor(visibleRows),
  );
}

export function clampImportPickerSelection(
  index: number,
  fileCount: number,
): number {
  if (fileCount <= 0) return 0;
  return Math.max(0, Math.min(index, fileCount - 1));
}

export function clampGitHubSnapshotSelection(
  index: number,
  fileCount: number,
): number {
  if (fileCount <= 0) return 0;
  return Math.max(0, Math.min(index, fileCount - 1));
}

export function ensureImportPickerSelectionVisible(
  files: BackupFileInfo[],
  selectedIndex: number,
  scrollOffset: number,
  visibleRows: number,
): { selectedIndex: number; scrollOffset: number } {
  const fileCount = files.length;
  if (fileCount === 0) {
    return { selectedIndex: 0, scrollOffset: 0 };
  }

  const rows = normalizeImportPickerVisibleRows(visibleRows);
  const clampedSelected = clampImportPickerSelection(selectedIndex, fileCount);
  const maxOffset = Math.max(0, fileCount - rows);
  let clampedOffset = Math.max(0, Math.min(scrollOffset, maxOffset));

  if (clampedSelected < clampedOffset) {
    clampedOffset = clampedSelected;
  } else if (clampedSelected >= clampedOffset + rows) {
    clampedOffset = clampedSelected - rows + 1;
  }

  return {
    selectedIndex: clampedSelected,
    scrollOffset: Math.max(0, Math.min(clampedOffset, maxOffset)),
  };
}

export function ensureGitHubSnapshotSelectionVisible(
  snapshots: GitHubSnapshotListItem[],
  selectedIndex: number,
  scrollOffset: number,
  visibleRows: number,
): { selectedIndex: number; scrollOffset: number } {
  const rowCount = normalizeImportPickerVisibleRows(visibleRows);
  const itemCount = snapshots.length;
  if (itemCount <= 0) {
    return { selectedIndex: 0, scrollOffset: 0 };
  }

  const clampedSelected = clampGitHubSnapshotSelection(selectedIndex, itemCount);
  const maxOffset = Math.max(0, itemCount - rowCount);
  let clampedOffset = Math.max(0, Math.min(scrollOffset, maxOffset));
  if (clampedSelected < clampedOffset) {
    clampedOffset = clampedSelected;
  } else if (clampedSelected >= clampedOffset + rowCount) {
    clampedOffset = clampedSelected - rowCount + 1;
  }

  return {
    selectedIndex: clampedSelected,
    scrollOffset: Math.max(0, Math.min(clampedOffset, maxOffset)),
  };
}
