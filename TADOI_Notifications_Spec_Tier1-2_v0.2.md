# TADOI Notifications Spec Sheet (Tier 1–2) + Tier 3 Scaffold (Modal UX)
**Version:** 0.3  
**Date:** February 11, 2026

---

## 1. Overview
This spec defines opt-in “Due Now” notifications for TADOI while the app is open. Current implementation uses an actionable in-app overdue modal queue (Tier 1), with optional terminal bell notifications (Tier 2). A no-op OS adapter boundary remains in place for future platform notifications (Tier 3).

---

## 2. Goals and Non-goals

### 2.1 Goals
- Notify only when it matters: a task transitions from not overdue to overdue while the app is open.
- Keep behavior deterministic, low-noise, and recurrence-aware.
- Provide immediate triage actions from the notification surface (snooze/done/go-to).
- Keep notification delivery extensible through notifier adapters.

### 2.2 Non-goals (Tier 1–2)
- No “due soon” reminders.
- No background daemon/service or notifications while the app is closed.
- No notification history center.
- No guaranteed delivery outside active runtime.

---

## 3. Tier Definitions

### 3.1 Tier 1: In-app overdue modal queue (default)
- When a task becomes overdue while the app is open, enqueue an overdue modal event.
- Modal content includes title, due date/time, overdue duration, and task tags when available.
- Modal is actionable:
  - `S` snooze by 10 minutes
  - `D` mark done
  - `G` go to task
  - `Esc` dismiss
- Mouse click actions are equivalent to keyboard actions.
- If multiple overdue transitions occur together, events are queued FIFO and shown one at a time.

### 3.2 Tier 2: Optional terminal bell (opt-in)
- If enabled, ring terminal bell (`\x07`) when overdue modal events are surfaced.
- Bell is rate-limited with cooldown (default **2000 ms**).

### 3.3 Tier 3: OS notifications (scaffold only)
- Keep notifier adapter boundary for macOS/Windows/Linux notifications.
- Current adapter remains a no-op.

---

## 4. Definitions and Triggers

### 4.1 Overdue definition
A task is overdue when:
- `dueAt` is set **AND**
- task status is open **AND**
- current time (`now`) is greater than `dueAt`

### 4.2 Notification trigger
- Trigger only on transition: `wasOverdue = false` **AND** `isOverdue = true`.
- Do not notify on app launch for tasks already overdue (no startup spam).
- For recurring tasks, each overdue occurrence (`dueAt`) is eligible once.

---

## 5. Notification Event Model
All notifiers consume the same event shape.

- **Event type:** `TASK_OVERDUE`
- **Payload:** `taskId`, `title`, `dueAt` (ISO), `firedAt` (ISO)

---

## 6. UX Requirements

### 6.1 Overdue modal content and actions
- Title: `Task Overdue`
- Fields:
  - task title
  - due date/time
  - `Overdue by <duration>`
  - tags (when present)
- Actions:
  - `S` / click: snooze +10 minutes
  - `D` / click: mark done
  - `G` / click: jump to task
  - `Esc` / click: dismiss

### 6.2 Queue behavior
- FIFO queue for overdue events.
- Show one modal at a time.
- Dismissing/resolving current modal advances to next queued event.

### 6.3 Bell behavior
- Bell only rings when `notifications.terminalBellOnOverdue` is `true`.
- Bell respects `notifications.bellCooldownMs`.

---

## 7. Settings and Defaults

| Setting | Type / Default | Notes |
|---|---|---|
| `notifications.enabled` | boolean / `true` | Master switch for notification system. |
| `notifications.inAppOverdueBanner` | boolean / `true` | Legacy field name retained; currently controls overdue popup modal behavior. |
| `notifications.terminalBellOnOverdue` | boolean / `false` | Tier 2 bell (opt-in). |
| `notifications.bannerDurationMs` | number / `5000` | Compatibility field retained in schema; currently unused by modal UX. |
| `notifications.bellCooldownMs` | number / `2000` | Minimum time between bell rings. |

---

## 8. Architecture

### 8.1 Components
- **NotificationManager:** evaluates tasks, detects overdue transitions, emits notification events.
- **InAppModalNotifier:** enqueues overdue events into UI notification-modal queue.
- **TerminalBellNotifier:** rings bell with cooldown when enabled.
- **OSNotifier:** no-op adapter for future OS notification integration.
- **Overdue task action helpers:** shared action logic for snooze/done/go-to operations.

### 8.2 Runtime state (in-memory)
- `overdueByTaskId: Map<taskId, { isOverdue, lastNotifiedDueAt }>`
- `notificationModalQueue` and active modal state in UI reducer
- `lastBellAt` timestamp for bell cooldown

**Note:** Notification state is intentionally not persisted. Startup initializes overdue state without firing events.

---

## 9. Scheduling and Evaluation
- Evaluate overdue transitions on periodic tick while app is open (target: every **10 seconds**).
- Also evaluate immediately on due-affecting task mutations.
- First evaluation after startup initializes state only (no event emission).

---

## 10. Edge Cases
- Task already overdue at startup: initialize state, no notification.
- `dueAt` removed: clear overdue state for task.
- `dueAt` edited past/future: eligibility resets based on new `dueAt`.
- Burst overdue transitions: modal queue is FIFO; bell still respects cooldown.
- Recurring overdue transitions resolve to occurrence-specific actions and go-to fallbacks.

---

## 11. Acceptance Criteria
- With app open, crossing `dueAt` emits overdue event within one evaluation interval.
- Existing-overdue tasks at startup do not notify.
- Each `dueAt` occurrence notifies at most once.
- Overdue modal supports `S`, `D`, `G`, and `Esc` paths.
- Bell only rings when enabled and outside cooldown.

---

## 12. Testing Plan

### 12.1 Unit tests
- Overdue transition fires exactly once per eligible occurrence.
- No startup spam behavior.
- Bell cooldown enforcement.
- In-app modal notifier enqueue/suppression behavior.
- Overdue action helpers for regular and recurring tasks:
  - snooze
  - mark done
  - go-to target resolution

### 12.2 Manual test script
- Create 2–3 tasks due within 1 minute.
- Confirm modal appears with expected fields and actions.
- Validate `S`, `D`, `G`, and `Esc` flows.
- Enable bell setting and confirm cooldown behavior.

---

## 13. Suggested File Layout
- `src/notifications/types.ts`
- `src/notifications/notifier.ts`
- `src/notifications/notificationManager.ts`
- `src/notifications/notifiers/inAppModalNotifier.ts`
- `src/notifications/notifiers/terminalBellNotifier.ts`
- `src/notifications/notifiers/osNotifier.ts`
- `src/notifications/overdueTaskActions.ts`
- `src/components/OverdueNotificationModal.tsx`
