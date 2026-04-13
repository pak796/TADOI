# TADOI™ Spec Sheet — Calendar Export (ICS) (One‑Way)

**Repo version context:** `v0.3.9` (runtime baseline)  
**Updated:** 2026-03-03  
**Feature status:** Implemented (user-facing CLI: `calendar:export`)

---

## 1) Objective

Ship and maintain a **one-way iCalendar export** that writes an `.ics` file representing due-dated tasks as calendar events. This provides meaningful calendar integration value **without OAuth, sync loops, background daemons, or vendor APIs**.

This spec is aligned to TADOI’s existing baseline contracts for recurrence (RRULE-style fields + sparse instance materialization) and task links (`links[]`).

---

## 2) Goals / Non‑Goals

### Goals

- Add CLI command: `tadoi calendar:export --out <file.ics> [--view <name>] [--range next7|month|all] [--privacy minimal|full]`
- Export mappings:
  - **date-only due** → **all-day VEVENT**
  - **due date+time** → **timed VEVENT**
- Recurrence export strategy aligned to TADOI recurrence:
  - Export **series VEVENT + RRULE** when stored recurrence is valid RFC5545
  - Export **materialized override instances** as separate VEVENTs (snoozed/edited occurrences)
  - Export **EXDATE** for excluded occurrences
- Deterministic output (stable UIDs, stable ordering).
- Add in-app Help section entry: **“Calendar export (ICS)”**.

### Non‑Goals

- No changes to the existing `calendar:import` flow in this spec; this document remains export-only.
- No bidirectional sync, CalDAV, Google/Microsoft APIs, OAuth.
- No live refresh or background export.
- No alarms/VALARM in v1.
- No full RECURRENCE-ID exception overrides in v1 (use standalone instance events instead).

---

## 3) CLI Interface

### Command

```bash
tadoi calendar:export --out tadoi.ics [--view <name>] [--range next7|month|all] [--privacy minimal|full]
```

### Flags

- `--out <path>` _(required)_  
  Output file path. If missing `.ics`, append it. If a directory is provided, write `tadoi.ics` in that directory.

- `--view <name>` _(optional)_  
  Restrict export to tasks visible under the named Saved View (filter preset).

- `--range next7|month|all` _(optional; default `next7`)_
  - `next7`: rolling 7 local days (today..+6) — matches TADOI NEXT7 semantics.
  - `month`: rolling 30 local days (today..+29).
  - `all`: all eligible tasks (with safeguards; see §8).

- `--privacy minimal|full` _(optional; default `minimal`)_
  - `minimal`: summary + schedule fields only.
  - `full`: include notes/tags/links/url metadata.
  - Compatibility alias: `--include-details` => `--privacy full`.

### Exit Codes

- `0` success
- `1` usage/validation errors
- `2` filesystem write errors

---

## 4) Eligibility & Filtering

### Status policy (v1 default)

- Include: **open** tasks.
- Exclude: **done/closed** tasks and done-history instances.

### View filtering

If `--view` is provided, apply the same Saved View filter logic used by list/dashboard visibility.

---

## 5) Mapping: Task → VEVENT

### 5.1 Common fields

For every VEVENT:

- `UID`: deterministic (see §10)
- `DTSTAMP`: export generation time (UTC)
- `SUMMARY`: task title
- `DESCRIPTION`: optional task details + tag list + links
- `CATEGORIES`: derived from tags
- `TRANSP:TRANSPARENT` (do not block calendar time)

**Recommended custom properties**

- `X-TADOI-TASK-ID:<id>`
- `X-TADOI-SERIES-ID:<series_id>` (if present)
- `X-TADOI-INSTANCE-OF:<parent_id>` (for instance rows)

### 5.2 Tags → CATEGORIES

- Normalize: strip leading `#` if present.
- Escape per RFC5545.

### 5.3 Links → URL / DESCRIPTION

From `links[]`:

- If a link target starts with `http://` or `https://`, set `URL:<target>` using the first such link.
- Include additional links in DESCRIPTION as `label: target` lines.

---

## 6) Date/Time Semantics

### 6.1 Date-only due → all-day event

- `DTSTART;VALUE=DATE:YYYYMMDD`
- `DTEND;VALUE=DATE:YYYYMMDD+1`

### 6.2 Due date+time → timed event

- `DTSTART;TZID=<tzid>:YYYYMMDDTHHMMSS`
- `DTEND` uses a default duration.

**Default duration (v1):** 30 minutes

---

## 7) Timezone & DST

### v1 choice: TZID + VTIMEZONE (recommended)

- Emit `DTSTART;TZID=<tzid>` and include a matching `VTIMEZONE` block.

**Timezone source precedence**

1. App setting timezone (if stored)
2. System timezone at export time

**Fallback (only if VTIMEZONE is deferred):**

- Export timed events in UTC (`...Z`) and omit TZID/VTIMEZONE.

---

## 8) Recurrence Export Strategy

TADOI recurrence baseline stores:

- `recurrence.dtstart` (local floating ISO timestamp)
- `recurrence.rrule` (RRULE fragment)
- `recurrence.exdates[]`
- `recurrence.series_id`
  and uses sparse materialization for overrides/history (instance rows via `instance_of`).

### 8.1 Series export (RRULE)

For a series task (no `instance_of`) with `recurrence.rrule`:

- Export ONE VEVENT:
  - `DTSTART` from `recurrence.dtstart`
  - `RRULE:<recurrence.rrule>` (prefix added by exporter)
  - `EXDATE` entries from `recurrence.exdates[]` (timezone-consistent)

**RRULE validity rule**

- If the stored fragment parses as RFC5545 RRULE content, export it.
- If parsing fails:
  - For `next7`/`month`, materialize occurrences using the existing recurrence engine and export standalone VEVENTs.
  - For `all`, error with guidance to use a bounded range.

### 8.2 Instance overrides (standalone)

For instance rows (`instance_of` present) that are open/overdue:

- Export a standalone VEVENT at the instance due date/time.
- Optionally include `RELATED-TO:<series UID>`.

---

## 9) Range Semantics & Safeguards

### Window definitions (local timezone)

- `next7`:
  - start = local start-of-day(today)
  - end = start-of-day(today + 7)
- `month`:
  - start = local start-of-day(today)
  - end = start-of-day(today + 30)

### `--range all` safeguards (v1)

- Always export RRULE series VEVENTs (not materialized).
- Export instance overrides (finite).
- If a series RRULE is invalid/unparseable, error and suggest `--range next7|month`.

---

## 10) ICS Format Requirements

### VCALENDAR header

- `BEGIN:VCALENDAR`
- `VERSION:2.0`
- `PRODID:-//TADOI//Calendar Export//EN`
- `CALSCALE:GREGORIAN`
- `METHOD:PUBLISH`
- `X-WR-CALNAME:TADOI`
- `X-WR-TIMEZONE:<tzid>` (when using TZID)
- `VTIMEZONE` (when using TZID)
- `END:VCALENDAR`

### RFC5545 compliance

- Escape TEXT values; fold lines > 75 octets (CRLF + space).
- Stable ordering: sort by DTSTART, then UID.

---

## 11) Determinism & Identity

### UID rules

- Non-recurring task: `tadoi-{taskId}@local`
- Series task: `tadoi-series-{taskId}@local`
- Instance override: `tadoi-inst-{taskId}@local` (instance task id)

### LAST-MODIFIED (optional)

If Task has an “updated” timestamp (used by SortMode `updated`), emit `LAST-MODIFIED` in UTC to help client refresh without UID churn.

---

## 12) Help Copy (In‑App)

Add Help section: **CALENDAR: Export (ICS)** including:

- command synopsis + examples
- Next7 semantics (today..+6)
- inclusion policy (open/overdue only)
- recurrence strategy (RRULE + EXDATE + standalone overrides)
- timezone/DST note
- limitations (no sync/import)

Examples:

```bash
tadoi calendar:export --out ~/Downloads/tadoi.ics --range next7
tadoi calendar:export --out ./tadoi.ics --view Work --range month
tadoi calendar:export --out ./tadoi.ics --range all
```

---

## 13) Testing Plan

- Unit: escaping/folding, all-day DTEND, timed duration, range boundaries, RRULE + EXDATE formatting.
- DST: fixture spanning DST transition in `<tzid>` verifying wall-clock time correctness after import.
- Golden `.ics` snapshots for a deterministic fixture:
  - non-recurring tasks
  - recurring series with EXDATE
  - instance override event
- Manual import smoke: Apple Calendar + Google Calendar + Outlook.

---

## 14) Acceptance Criteria (v1)

- CLI writes a valid `.ics` that imports into Apple Calendar and Google Calendar.
- Date-only tasks import as all-day events on the correct day.
- Timed tasks import at the correct local wall-clock time across DST.
- Recurring series export as RRULE with EXDATE applied.
- Materialized instance overrides export as standalone events at modified due times.
- Help includes “Calendar export (ICS)” with examples + limitations.

---

## 15) Risks

- Timezone/DST correctness → mitigate with TZID+VTIMEZONE + DST tests.
- Recurrence/client differences → mitigate with “RRULE only when valid” + bounded materialization fallback.
- Export size → mitigate with default `next7` and strict `all` safeguards.
- Exception semantics complexity → v1 uses standalone instance events.

---

## 16) Future Enhancements (Out of Scope for v1)

- Optional done-task export mode (currently open tasks only).
- Configurable timed-event duration (currently fixed default duration).
- VALARM support.
- True exception overrides using `RECURRENCE-ID` + `SEQUENCE`.

---

_End of spec._
