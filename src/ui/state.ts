import { FocusTarget, Mode, isEditorMode, isModalMode, type Mode as ModeType } from "./modeFocus";

export type UIConfirmModal = {
  type: "delete";
  taskId: string;
  taskTitle: string;
  previousMode: Exclude<ModeType, typeof Mode.MODAL_CONFIRM>;
  previousFocus: FocusTarget;
};

export type UIState = {
  mode: ModeType;
  focus: FocusTarget;
  selectedIndex: number;
  scrollOffset: number;
  editorScrollOffset: number;
  modal: UIConfirmModal | null;
  previousMode: ModeType;
  previousFocus: FocusTarget;
};

export type UIAction =
  | { type: "setMode"; mode: ModeType }
  | { type: "setFocus"; focus: FocusTarget }
  | { type: "setModal"; modal: UIConfirmModal | null }
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

  if (state.mode === Mode.HELP || state.mode === Mode.BACKUP_CENTER) {
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
