# TADOI™ Engagement Notifications (NUX Stickiness) — Spec v0.1

Updated: 2026-02-12  
Runtime baseline: `v0.3.5`  
Package baseline: `0.3.5`  
Persistence schema baseline: `5`

Status: Implemented baseline (v0.3.5)

---

## 0) Summary

Add **non-interactive, bottom-bar “engagement toasts”** triggered by task-completion milestones and lightweight streak logic:

- First-ever completion (“★ First task completed.”)
- Daily momentum (“🔥 3 tasks completed today.”)
- Weekly tag momentum (“🏷 5 #work tasks completed this week.”)
- Streak milestones (“✅ 3-day streak …”)

**Design constraint (v0.1):**
- Toasts are **not modal** and **have no interaction** (no hotkeys, no routing presets, no dismiss key).
- Toasts **auto-dismiss** and **queue**.

This is intended to feel **NUX-adjacent** (first-run wins + habit reinforcement) without introducing a new screen.

---

## 1) Goals / Non-goals

### Goals
1. Reinforce early product value with **first-win** messaging.
2. Provide habit feedback via **daily counts**, **weekly tag totals**, and **streak milestones**.
3. Keep UI footprint minimal: **reuse bottom bar** and do not change key routing.
4. Persist unlock state so “first time” messages show **once** across restarts.

### Non-goals (v0.1)
- No modal achievement popups.
- No clickable actions / routing presets.
- No achievements/stats screen.
- No background notifications while app is closed.
- No social, XP, points, leveling, or leaderboards.

---

## 2) UX Contract

### 2.1 Surface: Bottom Engagement Toast Bar
- Renders as a bottom overlay bar (same visual affordance class as existing bottom bar surfaces).
- Shows **one message at a time**.
- **No interaction**:
  - no `Enter` / no hotkeys
  - no click handlers
  - no `Esc` dismiss
- Auto-dismiss timers depend on toast type.

### 2.2 Display Rules
- Toasts **do not steal focus** and **do not intercept keys**.
- If a blocking overlay is visible (Help, confirm modals, overdue modal, Backup Center, etc.), the toast should:
  - **not render**, but
  - **remain queued**, and show once overlays clear.

### 2.3 Queue & Priority
If multiple events trigger on a single completion, show the highest priority first and queue the rest (bounded).

**Priority (1 highest):**
1. `FIRST_TASK_DONE`
2. `STREAK_3_DAYS` (and future streak milestones)
3. `TAG_5_LAST_7_DAYS`
4. `DONE_3_TODAY`

**Queue:**
- `maxQueued = 3`
- When exceeding, drop lowest priority first (FIFO within same priority).

### 2.4 Durations
- First-time and streak milestones: `10_000–12_000ms`
- Daily/weekly momentum: `6_000–8_000ms`

### 2.5 Copy (examples)
- `★ First task completed.`
- `🔥 3 tasks completed today.`
- `🏷 5 #work tasks completed this week.`
- `✅ 3-day streak — completed tasks 3 days in a row.`

---

## 3) Definitions

### 3.1 Completion Event
A completion event fires when a task transitions:
- `status: "open" → "done"`

No event when:
- `done → open` (reopen)
- edit without status change

### 3.2 Local Time Semantics
- “Today” and streak day boundaries use the user’s **local timezone**.
- “This week” uses a **rolling last-7-days** window for simplicity and deterministic behavior.

---

## 4) Data Model

### 4.1 New persisted slice: `engagement`
Add a new top-level persisted object.

```ts
type CompletionEvent = {
  taskId: string;
  at: number;        // epoch ms
  tags: string[];    // normalized snapshot at completion time
};

type AchievementUnlock = {
  id: string;
  unlockedAt: number;
  meta?: Record<string, string | number>;
};

type EngagementState = {
  completionLog: CompletionEvent[];                 // bounded retention
  achievements: Record<string, AchievementUnlock>;  // unlocked once
  streak: {
    currentDays: number;
    bestDays: number;
    lastCompletionDayKey: string | null;           // "YYYY-MM-DD"
  };
};
```

### 4.2 Retention Limits
To control file size:
- Keep completion events for **last 90 days** OR last **500 events** (whichever is smaller).

### 4.3 UI-only toast state (ephemeral)
Store in UI state (not persisted):

```ts
type EngagementToast = {
  id: string;
  message: string;
  priority: 1 | 2 | 3 | 4;
  createdAt: number;
  durationMs: number;
};

type UIState = {
  engagementToastQueue: EngagementToast[];
  engagementToastActive: EngagementToast | null;
};
```

---

## 5) Milestones (v0.1)

### 5.1 First-time Milestones
**M1: FIRST_TASK_DONE**
- Condition: first completion event ever.
- Toast: `★ First task completed.`
- Duration: 12s
- Persist unlock: `engagement.achievements["FIRST_TASK_DONE"]`

*(Optional, if you want slightly richer early NUX without interaction)*
**M2: FIRST_TAGGED_TASK_DONE**
- Condition: first completion where `tags.length > 0`
- Toast: `🏷 First tagged task completed (#tag).`
- Duration: 10s
- Persist unlock.

### 5.2 Daily Momentum
**M3: DONE_3_TODAY**
- Condition: 3 completion events in the same local day.
- Toast: `🔥 3 tasks completed today.`
- Duration: 8s
- Cooldown: once per local day.

### 5.3 Weekly Tag Momentum
**M4: TAG_5_LAST_7_DAYS**
- Condition: within the last 7 days, at least 5 completion events share the same tag.
- Tag selection rule: the tag that hits threshold **on this completion** (deterministic).
- Toast: `🏷 5 #<tag> tasks completed this week.`
- Duration: 8s
- Cooldown: once per tag per rolling 7 days (recommended), stored as:
  - `engagement.achievements["TAG_5_LAST_7_DAYS:<tag>"]` with `unlockedAt`

### 5.4 Streaks
**M5: STREAK_3_DAYS**
- Condition: `streak.currentDays` reaches 3.
- Toast: `✅ 3-day streak — completed tasks 3 days in a row.`
- Duration: 10s
- Persist unlock: `engagement.achievements["STREAK_3_DAYS"]`

---

## 6) Algorithms

### 6.1 Streak Calculation
On each completion:

1. Compute `dayKey = YYYY-MM-DD` in local time.
2. If `lastCompletionDayKey === dayKey`: no change (already counted today).
3. Else if `lastCompletionDayKey` is yesterday: `currentDays += 1`
4. Else: `currentDays = 1`
5. `bestDays = max(bestDays, currentDays)`
6. `lastCompletionDayKey = dayKey`

### 6.2 “3 tasks today” Calculation
Count completion events where `dayKey(event.at) === todayDayKey` and threshold-crossing occurs at `3`.

### 6.3 “5 #tag last 7 days” Calculation
For the completion event at time `now`:
- windowStart = `now - 7d`
- Count completions in `[windowStart..now]` grouped by tag.
- Identify tags that cross threshold on this event.
- If multiple cross at once, pick highest count; tie-break lexicographically.

---

## 7) Reducer & Action Signatures (matching current patterns)

> Assumes your state has a domain reducer (tasks/filters/engagement) plus UI reducer (modals/toasts). Keep this consistent with current “modal-first” routing/overlay behavior.

### 7.1 New Action Types (domain)
Add to `Action` union (store reducer):

```ts
// When a task transitions open → done
type RecordCompletionAction = {
  type: "recordCompletion";
  taskId: string;
  at: number;
  tags: string[];
};

// Evaluate milestones based on updated engagement state and produce UI toast payloads
type EvaluateEngagementAction = {
  type: "evaluateEngagement";
  at: number;
};
```

### 7.2 New Action Types (UI)
```ts
type PushEngagementToastAction = {
  type: "pushEngagementToast";
  toast: EngagementToast;
};

type TickEngagementToastAction = {
  type: "tickEngagementToast";
  now: number;
};

type PopEngagementToastAction = {
  type: "popEngagementToast";
};
```

### 7.3 Reducer Responsibilities
- `recordCompletion`:
  - append to `engagement.completionLog` (then enforce retention)
  - update streak
- `evaluateEngagement`:
  - compute triggered milestone(s) (priority + cooldown checks)
  - mark unlocks in `engagement.achievements`
  - emit `pushEngagementToast` for highest priority (and optionally queue others up to cap)
- `tickEngagementToast`:
  - if no active toast and queue non-empty and overlays clear → activate next toast
  - if active toast expired → clear and promote next

---

## 8) File-by-file Change List (implementation plan)

> Paths below follow current conventions referenced in v0.3.5 docs (store/persistence/models/routing). Adjust filenames only if your repo has renamed modules.

### A) Domain + Persistence
1. `src/domain/models.ts`
   - Add `EngagementState` types (or dedicated `src/domain/engagement.ts` if preferred).
   - Optional: add `completedAt?: number` to `Task` (future-proofing; not required if `completionLog` is source of truth).

2. `src/state/store.ts`
   - Extend `initialState` to include `engagement: EngagementState`.
   - Extend `Action` union with new engagement actions.
   - Update task completion path (toggle done / complete occurrence) to dispatch:
     - `recordCompletion` (only when open → done)
     - `evaluateEngagement`

3. `src/state/persistence.ts`
   - Include `engagement` in load/save payloads.
   - Ensure missing `engagement` defaults safely.

4. `src/state/validation.ts` (or equivalent schema validator)
   - Extend persisted-state validator to accept `engagement`.
   - Ensure older files without `engagement` are accepted.

5. `src/state/migrations.ts` (or equivalent)
   - Bump schema `4 → 5`
   - Migration: add default `engagement` object.

### B) UI Layer
6. `src/state/state.ts` (or equivalent UI state/reducer)
   - Add `engagementToastQueue` and `engagementToastActive`.
   - Add reducer handlers for push/tick/pop.

7. `src/components/BottomBar.tsx` (or whatever renders the bottom rotating/info bar)
   - Add a rendering layer for engagement toast messages.
   - Precedence:
     - show critical banners (save failure) first (if you have them)
     - show engagement toast next
     - otherwise show existing rotating info bar content

8. `src/app/App.tsx` (or `src/tui/runTui.tsx`)
   - Add a timer tick (`setInterval` or animation frame) to dispatch `tickEngagementToast`.
   - Ensure tick does not create high CPU (250–500ms is sufficient).

### C) Routing / Overlays (no key changes)
9. `src/state/keyRouter.ts` (if present)
   - **No new key handlers** (v0.1 is non-interactive).
   - Ensure any existing “banner” rendering does not capture keys.

10. `src/components/modals/*`
   - No changes for v0.1; but ensure overlay-detection API exists for “toast suppressed while modal visible”.

---

## 9) Overlay / Mode Compatibility Rules

Engagement toast rendering is suppressed when any of these are active:
- blocking confirm modal(s)
- Help overlay
- Backup Center
- Overdue notification modal queue (Tier 1/2 system)
- Editor/Add/Edit flows **may** still show toasts (recommended) because they do not interfere, but if visual clutter is a concern, suppress there too.

**Rule of thumb:** if the screen is already “overlay-heavy,” queue and show later.

---

## 10) QA Checklist (manual, matching current patterns)

### A) Persistence / Migration
- [ ] Start from a **schema v4** data file with tasks; launch app.
  - Expect: app loads and initializes `engagement` defaults.
- [ ] Complete a task; quit; relaunch.
  - Expect: `FIRST_TASK_DONE` does **not** re-trigger if unlocked.

### B) Completion Event Correctness
- [ ] Toggle open → done:
  - Expect: completion logged; toast triggers if milestone conditions met.
- [ ] Toggle done → open:
  - Expect: **no** completion logged; no milestone evaluation.
- [ ] Complete recurring occurrence (if applicable):
  - Expect: completion logged once per occurrence completion path.

### C) Toast Queue + Priority
- [ ] On first-ever completion that also happens to be “3rd today”:
  - Expect: only `FIRST_TASK_DONE` shows first; `DONE_3_TODAY` may queue (cap 3).
- [ ] Ensure queue cap holds:
  - Trigger >3 toasts quickly; verify lowest priority drops first.

### D) Suppression under overlays
- [ ] Trigger toast, then open Help immediately:
  - Expect: toast not visible during Help; appears after closing Help (if still within queue).
- [ ] Trigger toast while confirm delete modal is open:
  - Expect: toast suppressed and then shows after modal closes.

### E) Daily & Weekly Logic
- [ ] Complete 3 tasks in same local day:
  - Expect: `DONE_3_TODAY` fires once.
- [ ] Cross day boundary (manually adjust system time or inject test clock):
  - Expect: streak resets/increments correctly.
- [ ] Complete 5 tasks with `#work` over rolling 7 days:
  - Expect: weekly tag toast fires once per tag per 7 days.

### F) Visual / Layout Regression
- [ ] Minimum terminal size guard still works (`104x24`) and the toast does not render on the “too small” screen.
- [ ] Bottom bar content does not clip/overlap with existing bottom surfaces.
- [ ] No flicker: toast text remains stable during refresh.

### G) Performance
- [ ] Idle CPU remains low; tick interval does not spin.
- [ ] Completion log retention enforced (no unbounded growth).

---

## 11) Release Notes Snapshot (Shipped)
Added:
- NUX engagement notifications in bottom bar: first completion, daily momentum, weekly tag momentum, and streak milestones.

Changed:
- Persistence schema bump `4 → 5` to store engagement state.

---

## Trademark Notice
TADOI™ is a trademark of <OWNER>. Other names may be trademarks of their respective owners.
