import type { BackupCenterState } from "../state/backupCenterFlow";
import type { SavedView } from "../domain/models";

export function resolveCalendarViewSelectionDigit(
  digit: number,
  savedViews: SavedView[]
): string | undefined | null {
  if (digit <= 0) return null;
  if (digit === 1) return undefined;
  const view = savedViews[digit - 2];
  return view ? view.name : null;
}

export function parseCalendarImportHorizonOrThrow(horizonInput: string): number {
  const raw = horizonInput.trim();
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 3650) {
    throw new Error("Horizon days must be a positive integer <= 3650.");
  }
  return parsed;
}

export function shouldRequireBackupReplaceConfirmation(
  state: BackupCenterState
): boolean {
  return state.importMode === "replace" && !state.replaceConfirmed;
}
