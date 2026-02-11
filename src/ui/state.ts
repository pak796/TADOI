import { FocusTarget, Mode, isEditorMode, isModalMode, type Mode as ModeType } from "./modeFocus";
import type { TaskOverdueEvent } from "../notifications/types";

type UIDeleteModalBase = {
  type: "delete";
  taskTitle: string;
  previousMode: Exclude<ModeType, typeof Mode.MODAL_CONFIRM>;
  previousFocus: FocusTarget;
};

export type UIRegularTaskDeleteModal = UIDeleteModalBase & {
  target: "regular_task";
  taskId: string;
};

export type UIRecurringOccurrenceDeleteModal = UIDeleteModalBase & {
  target: "recurring_occurrence";
  seriesTaskId: string;
  seriesId: string;
  occurrenceIso: string;
  selectedRowId: string;
};

export type UIDeleteModal = UIRegularTaskDeleteModal | UIRecurringOccurrenceDeleteModal;

export type UIOverdueModal = {
  type: "overdue";
  event: TaskOverdueEvent;
  previousMode: Exclude<ModeType, typeof Mode.MODAL_CONFIRM>;
  previousFocus: FocusTarget;
};

export type UIEmptyNuxModal = {
  type: "emptyNux";
};

export type UIConfirmModal = UIDeleteModal | UIOverdueModal | UIEmptyNuxModal;

export type UIState = {
  mode: ModeType;
  focus: FocusTarget;
  selectedIndex: number;
  scrollOffset: number;
  editorScrollOffset: number;
  modal: UIConfirmModal | null;
  notificationModalQueue: TaskOverdueEvent[];
  emptyNuxDismissed: boolean;
  previousMode: ModeType;
  previousFocus: FocusTarget;
};

export type UIAction =
  | { type: "setMode"; mode: ModeType }
  | { type: "setFocus"; focus: FocusTarget }
  | { type: "setModal"; modal: UIConfirmModal | null }
  | { type: "OPEN_EMPTY_NUX" }
  | { type: "DISMISS_EMPTY_NUX" }
  | { type: "enqueueNotificationModal"; event: TaskOverdueEvent }
  | { type: "dequeueNotificationModal" }
  | { type: "clearNotificationModalQueue" }
  | { type: "setSelectedIndex"; selectedIndex: number }
  | { type: "setScrollOffset"; scrollOffset: number }
  | { type: "setEditorScrollOffset"; scrollOffset: number }
  | { type: "captureReturnContext"; mode: ModeType; focus: FocusTarget }
  | { type: "replace"; state: UIState };

export type UnwindResult = {
  state: UIState;
  clearEditorDraft: boolean;
};

export const initialUIState: UIState = {
  mode: Mode.LIST,
  focus: FocusTarget.TASK_LIST,
  selectedIndex: 0,
  scrollOffset: 0,
  editorScrollOffset: 0,
  modal: null,
  notificationModalQueue: [],
  emptyNuxDismissed: false,
  previousMode: Mode.LIST,
  previousFocus: FocusTarget.TASK_LIST
};

export function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case "setMode":
      return { ...state, mode: action.mode };
    case "setFocus":
      return { ...state, focus: action.focus };
    case "setModal":
      return { ...state, modal: action.modal };
    case "OPEN_EMPTY_NUX":
      if (state.modal || state.emptyNuxDismissed) {
        return state;
      }
      return {
        ...state,
        modal: {
          type: "emptyNux"
        }
      };
    case "DISMISS_EMPTY_NUX":
      if (state.modal?.type !== "emptyNux") {
        return state;
      }
      return {
        ...state,
        mode: Mode.LIST,
        focus: FocusTarget.TASK_LIST,
        modal: null,
        emptyNuxDismissed: true
      };
    case "enqueueNotificationModal":
      return {
        ...state,
        notificationModalQueue: [...state.notificationModalQueue, action.event]
      };
    case "dequeueNotificationModal":
      if (state.notificationModalQueue.length === 0) {
        return state;
      }
      return {
        ...state,
        notificationModalQueue: state.notificationModalQueue.slice(1)
      };
    case "clearNotificationModalQueue":
      if (state.notificationModalQueue.length === 0) {
        return state;
      }
      return { ...state, notificationModalQueue: [] };
    case "setSelectedIndex":
      return { ...state, selectedIndex: action.selectedIndex };
    case "setScrollOffset":
      return { ...state, scrollOffset: action.scrollOffset };
    case "setEditorScrollOffset":
      return { ...state, editorScrollOffset: action.scrollOffset };
    case "captureReturnContext":
      return {
        ...state,
        previousMode: action.mode,
        previousFocus: action.focus
      };
    case "replace":
      return action.state;
    default:
      return state;
  }
}

export function unwind(state: UIState): UnwindResult | null {
  if (isModalMode(state.mode)) {
    if (state.modal?.type === "emptyNux") {
      return {
        state: {
          ...state,
          mode: Mode.LIST,
          focus: FocusTarget.TASK_LIST,
          modal: null,
          emptyNuxDismissed: true
        },
        clearEditorDraft: false
      };
    }
    if (state.modal) {
      return {
        state: {
          ...state,
          mode: state.modal.previousMode,
          focus: state.modal.previousFocus,
          modal: null
        },
        clearEditorDraft: false
      };
    }
    return {
      state: {
        ...state,
        mode: Mode.LIST,
        focus: FocusTarget.TASK_LIST,
        modal: null
      },
      clearEditorDraft: false
    };
  }

  if (
    state.mode === Mode.HELP ||
    state.mode === Mode.BACKUP_CENTER ||
    state.mode === Mode.TAG_FILTER
  ) {
    return {
      state: {
        ...state,
        mode: state.previousMode,
        focus: state.previousFocus
      },
      clearEditorDraft: false
    };
  }

  if (state.mode === Mode.SEARCH) {
    return {
      state: {
        ...state,
        mode: Mode.LIST,
        focus: FocusTarget.TASK_LIST
      },
      clearEditorDraft: false
    };
  }

  if (isEditorMode(state.mode)) {
    return {
      state: {
        ...state,
        mode: Mode.LIST,
        focus: FocusTarget.TASK_LIST
      },
      clearEditorDraft: true
    };
  }

  return null;
}
