import type { ChecklistItem, EditorDraft, TaskLink } from "./models";

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function areTaskLinksEqual(left: TaskLink[], right: TaskLink[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const leftLink = left[index];
    const rightLink = right[index];
    if (
      leftLink.id !== rightLink.id ||
      leftLink.target !== rightLink.target ||
      leftLink.label !== rightLink.label ||
      leftLink.kind !== rightLink.kind ||
      leftLink.source !== rightLink.source
    ) {
      return false;
    }
  }
  return true;
}

function areChecklistItemsEqual(left: ChecklistItem[], right: ChecklistItem[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const leftItem = left[index];
    const rightItem = right[index];
    if (
      leftItem.id !== rightItem.id ||
      leftItem.text !== rightItem.text ||
      leftItem.isDone !== rightItem.isDone ||
      leftItem.createdAt !== rightItem.createdAt ||
      leftItem.updatedAt !== rightItem.updatedAt ||
      leftItem.completedAt !== rightItem.completedAt ||
      leftItem.sort !== rightItem.sort
    ) {
      return false;
    }
  }
  return true;
}

export function cloneEditorDraft(draft: EditorDraft): EditorDraft {
  return {
    ...draft,
    repeatWeekdays: [...draft.repeatWeekdays],
    links: draft.links.map((link) => ({ ...link })),
    checklist: draft.checklist.map((item) => ({ ...item }))
  };
}

export function areEditorDraftsEqual(left: EditorDraft, right: EditorDraft): boolean {
  return (
    left.id === right.id &&
    left.title === right.title &&
    left.dueText === right.dueText &&
    left.timeText === right.timeText &&
    left.tagsText === right.tagsText &&
    left.notes === right.notes &&
    areTaskLinksEqual(left.links, right.links) &&
    areChecklistItemsEqual(left.checklist, right.checklist) &&
    left.repeatMode === right.repeatMode &&
    left.repeatIntervalText === right.repeatIntervalText &&
    areStringArraysEqual(left.repeatWeekdays, right.repeatWeekdays) &&
    left.repeatMonthdayText === right.repeatMonthdayText &&
    left.repeatEndMode === right.repeatEndMode &&
    left.repeatUntilText === right.repeatUntilText &&
    left.repeatCountText === right.repeatCountText &&
    left.repeatCustomRRuleText === right.repeatCustomRRuleText &&
    left.assigneeText === right.assigneeText &&
    left.projectText === right.projectText &&
    left.workflowStage === right.workflowStage &&
    left.editKind === right.editKind &&
    left.sourceTaskId === right.sourceTaskId &&
    left.sourceSeriesId === right.sourceSeriesId &&
    left.occurrenceIso === right.occurrenceIso
  );
}

export function isEditorDraftDirty(
  draft: EditorDraft | null | undefined,
  baseline: EditorDraft | null | undefined
): boolean {
  if (!draft && !baseline) return false;
  if (!draft || !baseline) return true;
  return !areEditorDraftsEqual(draft, baseline);
}
