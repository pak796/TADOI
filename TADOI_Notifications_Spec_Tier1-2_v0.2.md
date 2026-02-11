# TADOI Notifications Spec Sheet (Tier 1–2) + Tier 3 Scaffold
**Version:** 0.2  
**Date:** February 10, 2026

---

## 1. Overview
This spec defines minimal, opt-in “Due Now” notifications for TADOI now that tasks support explicit due times and recurrence. Implementation focuses on in-app behavior while the application is open (Tier 1), with an optional terminal bell (Tier 2). A clean adapter boundary is included to support best-effort OS notifications later (Tier 3).

---

## 2. Goals and Non-goals

### 2.1 Goals
- Notify only when it matters: a task transitions from not overdue to overdue while the app is open.
- Keep behavior deterministic, low-noise, and easy to extend.
- Handle recurrence correctly (each `dueAt` occurrence is eligible once).
- Avoid UI disruption: notifications must not steal focus or block input.

### 2.2 Non-goals (Tier 1–2)
- No “due soon” reminders.
- No background daemon/service or notifications while the app is closed.
- No notification history screen.
- No guarantee of delivery; behavior is best-effort while the app is running.

---

## 3. Tier Definitions

### 3.1 Tier 1: In-app banner (default)
- When a task becomes overdue while the app is open, show an in-app banner:  
  `Task overdue: <title>`
- Banner auto-dismisses after a configurable duration (default **5000 ms**).
- If multiple tasks become overdue together, banners queue FIFO.

### 3.2 Tier 2: Optional terminal bell (opt-in)
- If enabled, ring the terminal bell (`\x07`) on the same overdue transition event.
- Bell is rate-limited with a configurable cooldown (default **2000 ms**).
- Banner behavior remains unchanged (bell is additive).

### 3.3 Tier 3: OS notifications (later, scaffold only)
- Provide a notifier adapter stub for macOS/Windows/Linux notifications.
- For now it performs no external integration and does not emit OS notifications.

---

## 4. Definitions and Triggers

### 4.1 Overdue definition
A task is overdue when:
- `dueAt` is set **AND**
- task is not completed **AND**
- current time (`now`) is greater than `dueAt`

### 4.2 Notification trigger
- Trigger only on transition: `wasOverdue = false` **AND** `isOverdue = true`
- Do not notify on app launch for tasks already overdue (no startup spam).
- For recurring tasks, eligibility is tied to `dueAt`; a new `dueAt` occurrence may notify again.

---

## 5. Notification Event Model
All notifiers consume a single event shape. Additional event types can be added later without changing detection logic.

- **Event type:** `TASK_OVERDUE`
- **Payload fields:** `taskId`, `title`, `dueAt` (ISO), `firedAt` (ISO)

---

## 6. UX Requirements

### 6.1 Banner
- Text: `Task overdue: <title>` (optionally include formatted due time if already available in the app).
- Placement: a dedicated banner row that does not disturb input focus.
- Duration: auto-dismiss after 4–6 seconds (default **5000 ms**).
- Queueing: FIFO; show one banner at a time.

### 6.2 Bell
- Only when `notifications.terminalBellOnOverdue` is `true`.
- Rate-limit: at most one bell per `bellCooldownMs` (default **2000 ms**).

---

## 7. Settings and Defaults
Add settings under a `notifications` namespace. Names may be adapted to match existing config conventions.

| Setting | Type / Default | Notes |
|---|---|---|
| `notifications.enabled` | boolean / `true` | Master switch for notification system. |
| `notifications.inAppOverdueBanner` | boolean / `true` | Tier 1 banner on overdue transition. |
| `notifications.terminalBellOnOverdue` | boolean / `false` | Tier 2 audible bell (opt-in). |
| `notifications.bannerDurationMs` | number / `5000` | Banner display duration. |
| `notifications.bellCooldownMs` | number / `2000` | Minimum time between bell rings. |

---

## 8. Architecture

### 8.1 Components
- **NotificationManager:** evaluates tasks, detects overdue transitions, emits notification events.
- **Notifier interface:** common contract for delivering events (banner, bell, later OS).
- **InAppBannerNotifier:** enqueues banner messages into UI state.
- **TerminalBellNotifier:** rings bell with cooldown when enabled.
- **OSNotifier:** stub adapter (no-op) reserved for Tier 3.

### 8.2 Runtime state (in-memory)
- `overdueByTaskId: Map(taskId -> { isOverdue, lastNotifiedDueAt })`
- `bannerQueue` + `activeBanner` state in UI layer
- `lastBellAt` timestamp for cooldown enforcement

**Note:** State persistence is intentionally omitted for Tier 1–2. On restart, no notifications fire for already overdue tasks.

---

## 9. Scheduling and Evaluation
- Evaluate overdue transitions on a fixed tick while the app is open (recommended: every **10 seconds**).
- Also evaluate immediately on task mutations that affect due state (create/update/complete/recurrence roll).
- On the first evaluation after startup, initialize overdue state without firing events.

---

## 10. Edge Cases
- Task already overdue at startup: initialize state, no notification.
- `dueAt` removed: clear overdue state for that task.
- `dueAt` edited from future → past: will notify at next evaluation tick (acceptable).
- `dueAt` edited from past → future: clear overdue state and suppress notification.
- Burst overdue events: banners queue FIFO; bell respects cooldown.

---

## 11. Acceptance Criteria
- With the app open, when `now` passes a task `dueAt`, a banner appears within one evaluation interval.
- No banner or bell is emitted on startup for tasks already overdue.
- Each `dueAt` occurrence notifies at most once; a new `dueAt` occurrence may notify again.
- Bell only rings when enabled and is rate-limited by `bellCooldownMs`.
- Banner does not steal focus or interrupt text input.

---

## 12. Testing Plan

### 12.1 Unit tests (preferred)
- Overdue transition fires once for a task occurrence.
- No startup spam behavior.
- `dueAt` change resets eligibility correctly.
- Bell cooldown prevents rapid repeated bells.

### 12.2 Manual test script
- Create 2–3 tasks due within 1 minute; confirm banner timing and FIFO queueing.
- Enable bell setting; confirm bell rings once per event and obeys cooldown.

---

## 13. Suggested File Layout
- `src/notifications/types.ts`
- `src/notifications/notifier.ts`
- `src/notifications/notificationManager.ts`
- `src/notifications/notifiers/inAppBannerNotifier.ts`
- `src/notifications/notifiers/terminalBellNotifier.ts`
- `src/notifications/notifiers/osNotifier.ts` (no-op stub)
