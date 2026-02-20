import { FocusTarget, Mode, isEditorMode, isModalMode, type Mode as ModeType } from "./modeFocus";
import type { TaskOverdueEvent } from "../notifications/types";

type UIModalReturnContext = {
  previousMode: Exclude<ModeType, typeof Mode.MODAL_CONFIRM>;
  previousFocus: FocusTarget;
};

type UIDeleteModalBase = {
  type: "delete";
  taskTitle: string;
} & UIModalReturnContext;

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
} & UIModalReturnContext;

export type UITaskLinkModalKind = "auto" | "url" | "path";
export type UITaskLinkFormField = "label" | "target" | "type" | "save" | "cancel";

type UITaskLinkFormTaskScope = {
  scope: "task";
  taskId: string;
};

type UITaskLinkFormEditorDraftScope = {
  scope: "editor_draft";
};

export type UITaskLinkFormModal = {
  type: "task_link_form";
  mode: "add" | "edit";
  source: UITaskLinkFormTaskScope | UITaskLinkFormEditorDraftScope;
  linkId?: string;
  labelValue: string;
  targetValue: string;
  kindValue: UITaskLinkModalKind;
  activeField: UITaskLinkFormField;
  error?: string;
} & UIModalReturnContext;

export type UITaskLinkDeleteModal = {
  type: "task_link_delete";
  taskId: string;
  linkId: string;
  label?: string;
  target: string;
} & UIModalReturnContext;

export type UITaskLinkExternalOpenConfirmModal = {
  type: "task_link_open_external";
  taskId: string;
  linkId: string;
  target: string;
  scheme: string;
} & UIModalReturnContext;

export type UIEditTargetSwitchModal = {
  type: "edit_switch_confirm";
  fromTaskId: string;
  toTaskId: string;
  toTaskTitle: string;
} & UIModalReturnContext;

export type UIEmptyNuxModal = {
  type: "emptyNux";
};

export type EmptyNuxStep = "welcome" | "shortcuts" | "adding" | "celebrate";

export type EmptyNuxState = {
  step: EmptyNuxStep;
  startedFromNux?: boolean;
  createdTaskId?: string;
};

export type UIConfirmModal =
  | UIDeleteModal
  | UIOverdueModal
  | UIEmptyNuxModal
  | UITaskLinkFormModal
  | UITaskLinkDeleteModal
  | UITaskLinkExternalOpenConfirmModal
  | UIEditTargetSwitchModal;

export type UIState = {
  mode: ModeType;
  focus: FocusTarget;
  selectedIndex: number;
  scrollOffset: number;
  editorScrollOffset: number;
  modal: UIConfirmModal | null;
  notificationModalQueue: TaskOverdueEvent[];
  emptyNuxDismissed: boolean;
  emptyNux?: EmptyNuxState;
  emptyNuxCelebratePending?: boolean;
  previousMode: ModeType;
  previousFocus: FocusTarget;
};

export type UIAction =
  | { type: "setMode"; mode: ModeType }
  | { type: "setFocus"; focus: FocusTarget }
  | { type: "setModal"; modal: UIConfirmModal | null }
  | {
      type: "OPEN_EMPTY_NUX";
      step?: EmptyNuxStep;
      startedFromNux?: boolean;
      createdTaskId?: string;
    }
  | { type: "DISMISS_EMPTY_NUX" }
  | { type: "CLEAR_EMPTY_NUX" }
  | { type: "SET_EMPTY_NUX_CELEBRATE_PENDING"; pending: boolean }
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
  emptyNux: undefined,
  emptyNuxCelebratePending: false,
  previousMode: Mode.LIST,
  previousFocus: FocusTarget.TASK_LIST
};

export function openEmptyNux(options?: {
  step?: EmptyNuxStep;
  startedFromNux?: boolean;
  createdTaskId?: string;
}): UIAction {
  return {
    type: "OPEN_EMPTY_NUX",
    ...(options ?? {})
  };
}

export function dismissEmptyNux(): UIAction {
  return {
    type: "DISMISS_EMPTY_NUX"
  };
}

export function clearEmptyNux(): UIAction {
  return {
    type: "CLEAR_EMPTY_NUX"
  };
}

export function setEmptyNuxCelebratePending(pending: boolean): UIAction {
  return {
    type: "SET_EMPTY_NUX_CELEBRATE_PENDING",
    pending
  };
}

export function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case "setMode":
      return { ...state, mode: action.mode };
    case "setFocus":
      return { ...state, focus: action.focus };
    case "setModal":
      return { ...state, modal: action.modal };
    case "OPEN_EMPTY_NUX":
      if (state.modal && state.modal.type !== "emptyNux") {
        return state;
      }
      if (state.emptyNuxDismissed) {
        return state;
      }
      {
        const step = action.step ?? state.emptyNux?.step ?? "welcome";
        const nextEmptyNux: EmptyNuxState = {
          ...(state.emptyNux ?? { step }),
          step,
          ...(action.startedFromNux !== undefined
            ? { startedFromNux: action.startedFromNux }
            : {}),
          ...(action.createdTaskId !== undefined
            ? { createdTaskId: action.createdTaskId }
            : {})
        };
        return {
          ...state,
          modal: {
            type: "emptyNux"
          },
          emptyNux: nextEmptyNux,
          emptyNuxCelebratePending:
            step === "celebrate" ? false : state.emptyNuxCelebratePending
        };
      }
    case "DISMISS_EMPTY_NUX": {
      const closingActiveEmptyNux = state.modal?.type === "emptyNux";
      return {
        ...state,
        ...(closingActiveEmptyNux
          ? {
              mode: Mode.LIST,
              focus: FocusTarget.TASK_LIST
            }
          : {}),
        emptyNuxDismissed: true,
        modal: closingActiveEmptyNux ? null : state.modal,
        emptyNux: undefined,
        emptyNuxCelebratePending: false
      };
    }
    case "CLEAR_EMPTY_NUX": {
      const closingActiveEmptyNux = state.modal?.type === "emptyNux";
      return {
        ...state,
        ...(closingActiveEmptyNux
          ? {
              mode: Mode.LIST,
              focus: FocusTarget.TASK_LIST
            }
          : {}),
        modal: closingActiveEmptyNux ? null : state.modal,
        emptyNux: undefined,
        emptyNuxCelebratePending: false
      };
    }
    case "SET_EMPTY_NUX_CELEBRATE_PENDING":
      return {
        ...state,
        emptyNuxCelebratePending: action.pending
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
          emptyNuxDismissed: true,
          emptyNux: undefined,
          emptyNuxCelebratePending: false
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

  if (state.mode === Mode.DASHBOARD) {
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
