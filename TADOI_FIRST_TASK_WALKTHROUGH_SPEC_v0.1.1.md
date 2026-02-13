# TADOI First-Task Walkthrough (Empty NUX v2) — Spec (Aligned to Existing Modal Actions)
**Version:** v0.1.1  
**Status:** Draft (Codex-implementable)  
**Repository:** `TUI_TODO`  
**Scope:** Replace current single-step `emptyNux` modal with a step-driven first-task walkthrough **without introducing a new modal open/close action type** beyond existing `OPEN_EMPTY_NUX` / `DISMISS_EMPTY_NUX` + `setModal`.

---

## Goals
- Upgrade “empty state NUX” into a **guided first-task walkthrough**:
  - `welcome` → optional `shortcuts` → `adding` (reuse existing OPEN_ADD) → `celebrate`
- **Reuse existing add-task flow** (no duplicated add logic).
- Preserve **modal precedence** and **keyRouter patterns**.
- Keep it **incremental + shippable** (session-only dismissal in v0.1).

## Non-goals (v0.1)
- No persisted “Don’t show again” setting.
- No coach marks across other panels.
- No new domain modals.

---

## UX Flow States & Transitions (decision-complete)

### Steps (single modal type: `emptyNux`, step-driven)
We keep `modal.type === 'emptyNux'` and render step-specific content inside `EmptyNuxModal.tsx`.

| Step | UI | Entry | Primary exits |
|---|---|---|---|
| `welcome` | Modal | Startup when empty + idle + not dismissed | Create → `adding` + OPEN_ADD; Shortcuts → `shortcuts`; Skip → session-dismiss |
| `shortcuts` | Modal | From welcome | Back → `welcome`; Create → `adding` + OPEN_ADD |
| `adding` | Non-modal | When user chooses Create | Task saved (0→>0) → `celebrate`; Add canceled (still 0) → `welcome` unless session-dismissed |
| `celebrate` | Modal | After first task created *during* walkthrough | Go to list; Add another; Shortcuts; Close |

### Global gating / deferral rules
- Walkthrough **never preempts** existing modal/queue:
  - Do not open NUX if any modal is open.
  - Do not open NUX if `notificationModalQueue` is non-empty.
- If `celebrate` should appear but UI is not idle, mark it **pending** and show when idle.

---

## Minimal State Model Additions

### `src/ui/state.ts` (UIState additions)
Keep existing session flag `emptyNuxDismissed`. Add step state + pending flag.

```ts
export type EmptyNuxStep = 'welcome' | 'shortcuts' | 'adding' | 'celebrate';

export type EmptyNuxState = {
  step: EmptyNuxStep;
  // True only if user initiated add from the NUX (prevents celebrate on import/other flows).
  startedFromNux?: boolean;
  // Optional enhancement: used to select created task on "Go to list".
  createdTaskId?: string;
};

export type UIState = {
  // existing...
  modal: ModalState | null;
  notificationModalQueue: NotificationModal[];
  emptyNuxDismissed: boolean;

  // NEW
  emptyNux?: EmptyNuxState;
  emptyNuxCelebratePending?: boolean;
};
```

---

## Action Types & Creators (Aligned to Existing Conventions)

### Existing modal actions (must remain)
- `OPEN_EMPTY_NUX` (opener)
- `DISMISS_EMPTY_NUX` (session-only dismissal)

### Existing generic modal setter (must remain)
- `setModal(...)` (action creator; underlying action type may be `SET_MODAL` or similar — **do not rename**)

### New (minimal) UI actions to support step-state without overloading dismissal
We add **two** UI actions:
1) `CLEAR_EMPTY_NUX` — clear transient walkthrough state *without* setting session dismissal.
2) `SET_EMPTY_NUX_CELEBRATE_PENDING` — defer celebrate until UI is idle.

> Step transitions will reuse `OPEN_EMPTY_NUX` rather than introducing a separate `SET_STEP` action.

#### Action signatures

```ts
// Existing (extend payload; keep action type)
export type OpenEmptyNuxAction = {
  type: 'OPEN_EMPTY_NUX';
  // NEW optional payload; default to 'welcome' in reducer if omitted
  step?: 'welcome' | 'shortcuts' | 'celebrate';
  // Allow step transitions to carry metadata (optional)
  startedFromNux?: boolean;
  createdTaskId?: string;
};

// Existing (unchanged)
export type DismissEmptyNuxAction = {
  type: 'DISMISS_EMPTY_NUX';
};

// NEW: clear transient state without setting emptyNuxDismissed
export type ClearEmptyNuxAction = {
  type: 'CLEAR_EMPTY_NUX';
};

// NEW: celebrate deferral flag
export type SetEmptyNuxCelebratePendingAction = {
  type: 'SET_EMPTY_NUX_CELEBRATE_PENDING';
  pending: boolean;
};
```

#### Action creators (recommended exports in `src/ui/state.ts`)
Match your existing export style for action creators (same file as current `OPEN_EMPTY_NUX` / `DISMISS_EMPTY_NUX` creators).

```ts
export const openEmptyNux = (opts?: {
  step?: 'welcome' | 'shortcuts' | 'celebrate';
  startedFromNux?: boolean;
  createdTaskId?: string;
}): OpenEmptyNuxAction => ({
  type: 'OPEN_EMPTY_NUX',
  ...(opts ?? {}),
});

export const dismissEmptyNux = (): DismissEmptyNuxAction => ({
  type: 'DISMISS_EMPTY_NUX',
});

export const clearEmptyNux = (): ClearEmptyNuxAction => ({
  type: 'CLEAR_EMPTY_NUX',
});

export const setEmptyNuxCelebratePending = (pending: boolean): SetEmptyNuxCelebratePendingAction => ({
  type: 'SET_EMPTY_NUX_CELEBRATE_PENDING',
  pending,
});
```

---

## Reducer Wiring Layout (uiReducer switch-case)

### Invariants
- **Session dismissal** must only occur via `DISMISS_EMPTY_NUX`.
- Create path must close the modal **without** session dismissal so the flow can **resume** if user cancels Add Task while still empty.

### `src/ui/state.ts` → `uiReducer(state, action)`
Add/modify cases:

#### `OPEN_EMPTY_NUX` (existing, extended)
- Opens modal type `emptyNux` via existing reducer behavior (or uses `setModal` elsewhere; see App.tsx wiring).
- Initializes or updates `uiState.emptyNux.step` (default `welcome`).
- Clears `emptyNuxCelebratePending` if stepping to `celebrate`.

```ts
case 'OPEN_EMPTY_NUX': {
  const step = action.step ?? 'welcome';

  // Defensive: if another modal is open, do not preempt.
  // (App.tsx should gate this; reducer remains safe.)
  if (state.modal && state.modal.type !== 'emptyNux') return state;

  return {
    ...state,
    modal: { type: 'emptyNux' },
    emptyNux: {
      ...(state.emptyNux ?? { step }),
      step,
      ...(action.startedFromNux !== undefined ? { startedFromNux: action.startedFromNux } : null),
      ...(action.createdTaskId !== undefined ? { createdTaskId: action.createdTaskId } : null),
    },
    emptyNuxCelebratePending: step === 'celebrate' ? false : state.emptyNuxCelebratePending,
  };
}
```

#### `DISMISS_EMPTY_NUX` (existing)
- Sets `emptyNuxDismissed = true` (session-only).
- Clears emptyNux transient fields and pending flag.
- Closes modal only if it is currently `emptyNux`.

```ts
case 'DISMISS_EMPTY_NUX': {
  return {
    ...state,
    emptyNuxDismissed: true,
    modal: state.modal?.type === 'emptyNux' ? null : state.modal,
    emptyNux: undefined,
    emptyNuxCelebratePending: false,
  };
}
```

#### `CLEAR_EMPTY_NUX` (new)
- Clears transient state and closes the modal if it is the NUX modal.
- **Does not** set `emptyNuxDismissed`.

```ts
case 'CLEAR_EMPTY_NUX': {
  return {
    ...state,
    modal: state.modal?.type === 'emptyNux' ? null : state.modal,
    emptyNux: undefined,
    emptyNuxCelebratePending: false,
  };
}
```

#### `SET_EMPTY_NUX_CELEBRATE_PENDING` (new)

```ts
case 'SET_EMPTY_NUX_CELEBRATE_PENDING': {
  return { ...state, emptyNuxCelebratePending: action.pending };
}
```

> Important: Do not modify your existing Esc/unwind behavior globally. For emptyNux, keyRouter will dispatch `DISMISS_EMPTY_NUX` (session dismissal) or `setModal(null)` (close-only) based on step + action.

---

## Keybindings + Mouse Interactions (per step)

### `welcome` (modal)
- Keys:
  - `Enter` / `A` / `a`: **Create** → close modal via `setModal(null)` (NOT `DISMISS_EMPTY_NUX`) + set NUX state to `adding` (see below) + dispatch existing OPEN_ADD flow
  - `H` / `h`: `OPEN_EMPTY_NUX({ step: 'shortcuts' })`
  - `S` / `s` / `Esc`: `DISMISS_EMPTY_NUX`
- Mouse:
  - “ADD (A)” → Create
  - “Shortcuts (H)” → shortcuts
  - “Skip (S)” or “X” → dismiss session

### `shortcuts` (modal)
- Keys:
  - `Esc`: back → `OPEN_EMPTY_NUX({ step: 'welcome' })`
  - `Enter` / `A` / `a`: Create (same as welcome)
- Mouse:
  - “Back” → welcome
  - “ADD (A)” → Create

### `adding` (non-modal)
- No new keys; reuse Add Task pane.
- Walkthrough **observes**:
  - Task created (0→>0) while `startedFromNux` → schedule/show celebrate
  - Add canceled while still empty → return to welcome unless dismissed

### `celebrate` (modal)
- Keys:
  - `Enter`: Go to list → `CLEAR_EMPTY_NUX` + dispatch existing “focus list/select” action (best effort)
  - `A/a`: Add another → close modal via `setModal(null)` + mark `adding` + dispatch OPEN_ADD
  - `H/h`: `OPEN_EMPTY_NUX({ step: 'shortcuts' })`
  - `Esc`: `CLEAR_EMPTY_NUX`
- Mouse:
  - “Go to list” / “Add another” / “Shortcuts” / “Close”

---

## App Wiring (exact touchpoints)

### `src/app/App.tsx`

#### 1) Startup open (welcome)
Replace current “open empty NUX modal” gating logic with:

**Eligibility**
- `totalTasks === 0`
- `uiState.modal == null`
- `uiState.notificationModalQueue.length === 0`
- `uiState.emptyNuxDismissed === false`

**Dispatch**
- `dispatch(openEmptyNux({ step: 'welcome' }))`

#### 2) Track first task created during walkthrough
When task count transitions `0 → >0` and walkthrough was active:

Condition:
- `uiState.emptyNux?.step === 'adding'`
- `uiState.emptyNux.startedFromNux === true`

Action:
- If UI idle: `dispatch(openEmptyNux({ step: 'celebrate', createdTaskId }))`
- Else:
  - `dispatch(setEmptyNuxCelebratePending(true))`
  - Store `createdTaskId` by dispatching `openEmptyNux({ createdTaskId })` (step unchanged) OR compute id later.

**Created task id (best-effort)**
- If the domain state exposes last-created id, use it.
- Else, v0.1 may omit selection and still provide “Go to list”.

#### 3) Drain pending celebrate
When:
- `uiState.emptyNuxCelebratePending === true`
- `uiState.modal == null`
- `uiState.notificationModalQueue.length === 0`

Dispatch:
- `dispatch(setEmptyNuxCelebratePending(false))`
- `dispatch(openEmptyNux({ step: 'celebrate' }))`

#### 4) Auto-clear stale walkthrough when tasks become >0 without NUX
If:
- `totalTasks > 0` AND `uiState.modal?.type === 'emptyNux'` AND `uiState.emptyNux?.startedFromNux !== true`

Then:
- `dispatch(clearEmptyNux())` (prevents stale welcome/shortcuts when tasks appear via import)

---

## KeyRouter Wiring (exact touchpoints)

### `src/app/keyRouter.ts`
In the modal handling section for `modal.type === 'emptyNux'`:

#### Determine step
```ts
const step = uiState.emptyNux?.step ?? 'welcome';
```

#### Create path (welcome/shortcuts)
**Critical**: close modal without session-dismiss so cancel can resume.

On `Enter` / `A` / `a`:
1) `dispatch(openEmptyNux({ step: 'adding', startedFromNux: true }))`
2) `dispatch(setModal(null))`  // close modal only
3) `dispatch(OPEN_ADD /* existing */)`

#### Step transitions
- `H/h` (welcome/celebrate): `dispatch(openEmptyNux({ step: 'shortcuts' }))`
- `Esc` in shortcuts: `dispatch(openEmptyNux({ step: 'welcome' }))`

#### Dismiss vs clear
- `Esc` in welcome: `dispatch(dismissEmptyNux())` (sets session dismissal)
- `Esc` in celebrate: `dispatch(clearEmptyNux())` (no session dismissal needed)
- Clicking X in welcome should call `dismissEmptyNux()`; clicking Close in celebrate calls `clearEmptyNux()`.

> This preserves your existing pattern: `DISMISS_EMPTY_NUX` is the dedicated modal dismissal action used by keyRouter for session dismissal behavior.

---

## UI Component Changes

### `src/components/EmptyNuxModal.tsx`
Render content based on `uiState.emptyNux?.step`:
- `welcome`: CTA + skip + shortcuts
- `shortcuts`: cheat sheet + back + create
- `celebrate`: go to list / add another / shortcuts / close

Button handlers:
- Create → same as keyRouter create path (dispatch `openEmptyNux({step:'adding', startedFromNux:true})`, `setModal(null)`, OPEN_ADD)
- Skip/X from welcome → `dismissEmptyNux()`
- Close from celebrate → `clearEmptyNux()`

---

## Tests

### `src/ui/state.test.ts`
Add reducer tests:

1) `OPEN_EMPTY_NUX`:
- Opens modal `emptyNux` (or keeps it if already emptyNux)
- Sets step default `welcome`
- Stores `createdTaskId` if provided
- Preserves `emptyNuxDismissed` unchanged

2) `DISMISS_EMPTY_NUX`:
- Sets `emptyNuxDismissed=true`
- Clears `emptyNux` and `emptyNuxCelebratePending`
- Closes modal only if it is `emptyNux`

3) `CLEAR_EMPTY_NUX`:
- Clears `emptyNux` and pending
- Closes modal only if it is `emptyNux`
- Does **not** set `emptyNuxDismissed`

4) `SET_EMPTY_NUX_CELEBRATE_PENDING` toggles flag.

### `src/app/keyRouter.test.ts`
Add key handling tests for modal `emptyNux`:

**welcome**
- `Enter` dispatches:
  - `OPEN_EMPTY_NUX` with `{ step:'adding', startedFromNux:true }`
  - `setModal(null)` (or underlying action)
  - existing OPEN_ADD
- `h` dispatches `OPEN_EMPTY_NUX({step:'shortcuts'})`
- `esc` dispatches `DISMISS_EMPTY_NUX`

**shortcuts**
- `esc` dispatches `OPEN_EMPTY_NUX({step:'welcome'})`
- `a` dispatches create path (same as welcome)

**celebrate**
- `enter` dispatches `CLEAR_EMPTY_NUX` + your “focus list” action
- `a` dispatches create path
- `esc` dispatches `CLEAR_EMPTY_NUX`

### Manual Acceptance (QA checklist)
- Empty app start → welcome appears only when idle.
- Skip (Esc/X/S) → does not re-open during same session.
- Create (Enter/A/click) → opens add pane; cancel add (still empty) → welcome returns.
- Save first task → celebrate appears (or deferred until idle).
- Celebrate close (Esc/X) ends walkthrough.
- No regression: other modals and notification queue preempt NUX.

---

## Migration / Backward Compatibility
- No persisted data migration (UI-only session fields).
- Existing `OPEN_EMPTY_NUX` / `DISMISS_EMPTY_NUX` remain; `OPEN_EMPTY_NUX` gains optional payload fields (safe in TS if properties are optional).
- `emptyNuxDismissed` semantics remain unchanged (session-only).

---

## File-by-file Change List (Codex implementation checklist)

### `src/ui/state.ts`
- Add `EmptyNuxStep`, `EmptyNuxState`
- Extend `UIState` with `emptyNux`, `emptyNuxCelebratePending`
- Extend `OPEN_EMPTY_NUX` action to accept optional payload: `step`, `startedFromNux`, `createdTaskId`
- Add new actions + creators:
  - `CLEAR_EMPTY_NUX` + `clearEmptyNux()`
  - `SET_EMPTY_NUX_CELEBRATE_PENDING` + `setEmptyNuxCelebratePending(pending)`
- Wire reducer cases:
  - update `OPEN_EMPTY_NUX`
  - keep `DISMISS_EMPTY_NUX`
  - add `CLEAR_EMPTY_NUX`, `SET_EMPTY_NUX_CELEBRATE_PENDING`

### `src/app/App.tsx`
- Update startup gating to `openEmptyNux({ step:'welcome' })`
- Add effect for `0→>0` transition during `adding` to open/defer celebrate
- Add effect to drain celebrate pending when idle
- Add defensive auto-clear when tasks appear while NUX open but not startedFromNux

### `src/app/keyRouter.ts`
- In modal routing for `emptyNux`, implement step-driven keys:
  - Create path uses `setModal(null)` (close-only) + `OPEN_EMPTY_NUX({step:'adding', startedFromNux:true})` + OPEN_ADD
  - Dismiss session uses `DISMISS_EMPTY_NUX`
  - Celebrate close uses `CLEAR_EMPTY_NUX`
  - Step transitions use `OPEN_EMPTY_NUX({step: ...})`

### `src/components/EmptyNuxModal.tsx`
- Render by step and wire buttons to the same action sequences as keyRouter.

### `src/app/keyRouter.test.ts`
- Add step-driven modal key tests.

### `src/ui/state.test.ts`
- Add reducer tests for the updated/new actions.

