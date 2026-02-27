import {
  ConfirmModal,
  EditorDraft,
  EditorFocus,
  FocusTarget,
  Mode
} from "../domain/models";
import { getEditorRecurrenceVisibility } from "../domain/editorPaneLayout";

const EDITOR_BASE_FOCUS_ORDER: FocusTarget[] = [
  FocusTarget.EDITOR_TITLE,
  FocusTarget.EDITOR_DUE_DATE,
  FocusTarget.EDITOR_DUE_TIME,
  FocusTarget.EDITOR_REPEAT_MODE,
  FocusTarget.EDITOR_TAGS,
  FocusTarget.EDITOR_CHECKLIST,
  FocusTarget.EDITOR_NOTES,
  FocusTarget.EDITOR_SAVE,
  FocusTarget.EDITOR_CANCEL
];

const RECURRENCE_DETAIL_FOCUS_ORDER: FocusTarget[] = [
  FocusTarget.EDITOR_REPEAT_INTERVAL,
  FocusTarget.EDITOR_REPEAT_WEEKDAYS,
  FocusTarget.EDITOR_REPEAT_MONTHDAY,
  FocusTarget.EDITOR_REPEAT_CUSTOM,
  FocusTarget.EDITOR_REPEAT_END_MODE,
  FocusTarget.EDITOR_REPEAT_UNTIL,
  FocusTarget.EDITOR_REPEAT_COUNT
];

function getFirstVisibleRecurrenceFocusTarget(
  order: FocusTarget[]
): FocusTarget | undefined {
  return order.find((target) => RECURRENCE_DETAIL_FOCUS_ORDER.includes(target));
}

export function getVisibleEditorFocusOrder(
  editorDraft: EditorDraft | null | undefined
): FocusTarget[] {
  const recurrenceVisibility = getEditorRecurrenceVisibility(
    editorDraft?.repeatMode,
    editorDraft?.repeatEndMode
  );

  const order: FocusTarget[] = [
    FocusTarget.EDITOR_TITLE,
    FocusTarget.EDITOR_DUE_DATE,
    FocusTarget.EDITOR_DUE_TIME,
    FocusTarget.EDITOR_REPEAT_MODE
  ];

  if (recurrenceVisibility.showInterval) {
    order.push(FocusTarget.EDITOR_REPEAT_INTERVAL);
  }
  if (recurrenceVisibility.showWeekdays) {
    order.push(FocusTarget.EDITOR_REPEAT_WEEKDAYS);
  }
  if (recurrenceVisibility.showMonthday) {
    order.push(FocusTarget.EDITOR_REPEAT_MONTHDAY);
  }
  if (recurrenceVisibility.showCustomRule) {
    order.push(FocusTarget.EDITOR_REPEAT_CUSTOM);
  }
  if (recurrenceVisibility.showRepeatEnd) {
    order.push(FocusTarget.EDITOR_REPEAT_END_MODE);
  }
  if (recurrenceVisibility.showUntil) {
    order.push(FocusTarget.EDITOR_REPEAT_UNTIL);
  }
  if (recurrenceVisibility.showCount) {
    order.push(FocusTarget.EDITOR_REPEAT_COUNT);
  }

  order.push(
    FocusTarget.EDITOR_TAGS,
    FocusTarget.EDITOR_CHECKLIST,
    FocusTarget.EDITOR_NOTES,
    FocusTarget.EDITOR_SAVE,
    FocusTarget.EDITOR_CANCEL
  );

  return order;
}

export function isEditorMode(
  mode: Mode
): mode is typeof Mode.ADD | typeof Mode.EDIT {
  return mode === Mode.ADD || mode === Mode.EDIT;
}

export function toFocusTarget(editorFocus: EditorFocus): FocusTarget {
  switch (editorFocus) {
    case "title":
      return FocusTarget.EDITOR_TITLE;
    case "due":
      return FocusTarget.EDITOR_DUE_DATE;
    case "time":
      return FocusTarget.EDITOR_DUE_TIME;
    case "repeat_mode":
      return FocusTarget.EDITOR_REPEAT_MODE;
    case "repeat_interval":
      return FocusTarget.EDITOR_REPEAT_INTERVAL;
    case "repeat_weekdays":
      return FocusTarget.EDITOR_REPEAT_WEEKDAYS;
    case "repeat_monthday":
      return FocusTarget.EDITOR_REPEAT_MONTHDAY;
    case "repeat_end_mode":
      return FocusTarget.EDITOR_REPEAT_END_MODE;
    case "repeat_until":
      return FocusTarget.EDITOR_REPEAT_UNTIL;
    case "repeat_count":
      return FocusTarget.EDITOR_REPEAT_COUNT;
    case "repeat_custom":
      return FocusTarget.EDITOR_REPEAT_CUSTOM;
    case "tags":
      return FocusTarget.EDITOR_TAGS;
    case "checklist":
      return FocusTarget.EDITOR_CHECKLIST;
    case "notes":
      return FocusTarget.EDITOR_NOTES;
    case "save":
      return FocusTarget.EDITOR_SAVE;
    case "cancel":
      return FocusTarget.EDITOR_CANCEL;
    default:
      return FocusTarget.EDITOR_TITLE;
  }
}

export function toEditorFocus(focus: FocusTarget): EditorFocus {
  switch (focus) {
    case FocusTarget.EDITOR_TITLE:
      return "title";
    case FocusTarget.EDITOR_DUE_DATE:
      return "due";
    case FocusTarget.EDITOR_DUE_TIME:
      return "time";
    case FocusTarget.EDITOR_REPEAT_MODE:
      return "repeat_mode";
    case FocusTarget.EDITOR_REPEAT_INTERVAL:
      return "repeat_interval";
    case FocusTarget.EDITOR_REPEAT_WEEKDAYS:
      return "repeat_weekdays";
    case FocusTarget.EDITOR_REPEAT_MONTHDAY:
      return "repeat_monthday";
    case FocusTarget.EDITOR_REPEAT_END_MODE:
      return "repeat_end_mode";
    case FocusTarget.EDITOR_REPEAT_UNTIL:
      return "repeat_until";
    case FocusTarget.EDITOR_REPEAT_COUNT:
      return "repeat_count";
    case FocusTarget.EDITOR_REPEAT_CUSTOM:
      return "repeat_custom";
    case FocusTarget.EDITOR_TAGS:
      return "tags";
    case FocusTarget.EDITOR_CHECKLIST:
      return "checklist";
    case FocusTarget.EDITOR_NOTES:
      return "notes";
    case FocusTarget.EDITOR_SAVE:
      return "save";
    case FocusTarget.EDITOR_CANCEL:
      return "cancel";
    default:
      return "title";
  }
}

export function nextEditorFocusTarget(
  current: FocusTarget,
  direction: 1 | -1,
  editorDraft: EditorDraft | null | undefined
): FocusTarget {
  const editorFocusOrder = getVisibleEditorFocusOrder(editorDraft);
  const index = editorFocusOrder.indexOf(current);
  const safeIndex = index === -1 ? 0 : index;
  const nextIndex = (safeIndex + direction + editorFocusOrder.length) % editorFocusOrder.length;
  return editorFocusOrder[nextIndex];
}

export function resolveEditorFocusAfterDraftChange(
  current: FocusTarget,
  previousDraft: EditorDraft | null | undefined,
  nextDraft: EditorDraft | null | undefined
): FocusTarget {
  if (!EDITOR_BASE_FOCUS_ORDER.includes(current) && !RECURRENCE_DETAIL_FOCUS_ORDER.includes(current)) {
    return current;
  }

  const nextOrder = getVisibleEditorFocusOrder(nextDraft);
  if (nextOrder.includes(current)) {
    return current;
  }

  if (RECURRENCE_DETAIL_FOCUS_ORDER.includes(current)) {
    const nextRecurrenceVisibility = getEditorRecurrenceVisibility(
      nextDraft?.repeatMode,
      nextDraft?.repeatEndMode
    );
    if (!nextRecurrenceVisibility.repeatEnabled) {
      return FocusTarget.EDITOR_REPEAT_MODE;
    }
    return (
      getFirstVisibleRecurrenceFocusTarget(nextOrder) ?? FocusTarget.EDITOR_REPEAT_MODE
    );
  }

  const previousOrder = getVisibleEditorFocusOrder(previousDraft);
  const previousIndex = previousOrder.indexOf(current);
  if (previousIndex === -1) {
    return nextOrder[0] ?? FocusTarget.EDITOR_TITLE;
  }

  const clampedIndex = Math.max(0, Math.min(previousIndex, nextOrder.length - 1));
  return nextOrder[clampedIndex] ?? FocusTarget.EDITOR_TITLE;
}

export function resolveModalAction(
  name: string,
  sequence: string
): "confirm" | "cancel" | "none" {
  if (sequence === "y" || name === "y") return "confirm";
  if (sequence === "n" || name === "n" || name === "escape") return "cancel";
  return "none";
}

export function shouldCloseHelp(name: string, sequence: string): boolean {
  return name === "escape" || sequence === "?";
}

export function shouldCloseSearch(name: string): boolean {
  return name === "escape" || name === "return" || name === "enter";
}

export type EscUnwindTarget = {
  mode: Mode;
  focus: FocusTarget;
  clearEditor: boolean;
  clearModal: boolean;
};

export function resolveEscUnwindTarget(params: {
  mode: Mode;
  modal: ConfirmModal | null;
  helpReturnMode: Mode;
  helpReturnFocus: FocusTarget;
}): EscUnwindTarget | null {
  const { mode, modal, helpReturnMode, helpReturnFocus } = params;

  if (mode === Mode.MODAL_CONFIRM) {
    if (modal?.type === "emptyNux") {
      return {
        mode: Mode.LIST,
        focus: FocusTarget.TASK_LIST,
        clearEditor: false,
        clearModal: true
      };
    }
    if (modal) {
      return {
        mode: modal.previousMode,
        focus: modal.previousFocus,
        clearEditor: false,
        clearModal: true
      };
    }
    return {
      mode: Mode.LIST,
      focus: FocusTarget.TASK_LIST,
      clearEditor: false,
      clearModal: true
    };
  }

  if (
    mode === Mode.HELP ||
    mode === Mode.BACKUP_CENTER ||
    mode === Mode.TAG_FILTER
  ) {
    return {
      mode: helpReturnMode,
      focus: helpReturnFocus,
      clearEditor: false,
      clearModal: false
    };
  }

  if (mode === Mode.SEARCH) {
    return {
      mode: Mode.LIST,
      focus: FocusTarget.TASK_LIST,
      clearEditor: false,
      clearModal: false
    };
  }

  if (mode === Mode.ADD || mode === Mode.EDIT) {
    return {
      mode: Mode.LIST,
      focus: FocusTarget.TASK_LIST,
      clearEditor: true,
      clearModal: false
    };
  }

  return null;
}

export function getNextSelectedIdAfterDelete(
  visibleIds: string[],
  deletedId: string
): string | undefined {
  if (visibleIds.length <= 1) return undefined;
  const index = visibleIds.indexOf(deletedId);
  if (index === -1) return visibleIds[0];
  if (index === visibleIds.length - 1) {
    return visibleIds[index - 1];
  }
  return visibleIds[index + 1];
}
