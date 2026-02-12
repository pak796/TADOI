# TADOI™ Spec Sheet — Calendar Import (ICS) (One-Way, Round-Trip)

**Repo context:** calendar export groundwork already landed (CLI + service + domain modules + tests).  
**Generated:** 2026-02-12  
**Feature status:** Proposed (next phase)

---

## 1) Objective

Add **ICS calendar import** to complement existing ICS export, enabling a **true round‑trip** workflow:

- Export tasks to `.ics`
- Modify events in an external calendar (time move, notes/tags, exceptions)
- Import `.ics` back to update TADOI tasks **idempotently** and **conservatively**

This is still **one-way per action** (explicit import command). No OAuth, no sync loop, no background watchers.

---

## 2) Key Decisions (Locked)

1. **Identity:** update existing tasks using `X-TADOI-TASK-ID` (true round-trip).
2. **Conflicts:** default import mode is **conservative merge** (append/union) rather than overwrite.
3. **Recurrence safeguards:** require **RRULE validity** for series import; any **materialization** must be bounded by a **horizon cap**.
4. **Exceptions:** support **RECURRENCE-ID overrides** (edited/cancelled single occurrences in recurring series).

---

## 3) Goals / Non-Goals

### Goals
- CLI: `tadoi calendar:import --in <file.ics> [...]`
- Parse `.ics` robustly enough to support:
  - VEVENT all-day + timed
  - TZID/UTC timestamps
  - RRULE + EXDATE
  - RECURRENCE-ID overrides (modifications & cancellations)
  - RDATE (optional) via bounded materialization
- True round-trip for **TADOI-generated ICS** and “reasonable” generic ICS.
- Idempotent: re-importing the same file should not create duplicates.
- Deterministic + auditable: produce an import summary + optional JSON report.

### Non-Goals
- No live sync.
- No external calendar API integration.
- No attendee/organizer scheduling semantics; these may be preserved in notes only.
- No full-fidelity import of every RFC5545 edge case in v1.

---

## 4) Existing Groundwork (Must Reuse)

Calendar command plumbing and export path already exist; import should mirror patterns and reuse domain utilities.

### CLI wiring & commands
- `src/cli.ts`
- `src/cli/calendarCommands.ts`
- `src/commands/calendarExport.ts` *(pattern for exit codes + validation)*
- Exit code pattern: `0` success, `1` usage/validation, `2` filesystem

### Service layer (mirror for import)
- `src/state/calendarExportService.ts` *(pattern: orchestration + reuse saved views path)*

### Domain modules (reuse contracts/parity)
- `src/calendar/range.ts`
- `src/calendar/rrule.ts`
- `src/calendar/calendarMapper.ts`
- `src/calendar/icsWriter.ts`

### Test baseline
- `src/state/__fixtures__/calendar-export.golden.ics`
- `src/state/calendarExportService.test.ts`
- `src/calendar/calendarMapper.test.ts` *(includes DST wall-clock check for America/Chicago)*
- `src/calendar/icsWriter.test.ts`
- `src/calendar/range.test.ts`
- `src/calendar/rrule.test.ts`

---

## 5) CLI Interface

### Command
```bash
tadoi calendar:import --in tadoi.ics [--view <name>] [--range next7|month|all]
                    [--mode merge|update|create] [--horizon-days <n>]
                    [--dry-run] [--tag imported] [--report <path.json>]
```

### Flags
- `--in <path>` *(required)*  
  Input `.ics` file.

- `--view <name>` *(optional)*  
  Restrict import to events that would correspond to tasks visible under a Saved View.  
  **Rule:** view filtering uses the same semantics as export/list: `applySavedView` + visible rows pipeline.

- `--range next7|month|all` *(optional; default `next7`)*  
  Local start-of-day semantics, consistent with export:
  - `next7`: [startOfDay(today), startOfDay(today+7))
  - `month`: [startOfDay(today), startOfDay(today+30))
  - `all`: no time window filter (still applies recurrence safeguards)

- `--mode merge|update|create` *(optional; default `merge`)*  
  - `merge`: conservative append/union; only overwrite when safe (see §9)
  - `update`: calendar wins for mapped fields
  - `create`: never update existing tasks; always create new tasks

- `--horizon-days <n>` *(optional; default `365`)*  
  Upper bound for any **materialization** work (RDATE expansion, unsupported recurrence fallback).  
  **Required usage:** if import must expand a schedule to occurrences, it must not exceed horizon.

- `--dry-run` *(optional)*  
  Parse and compute actions; do not persist changes.

- `--tag <name>` *(optional)*  
  Apply a tag to newly created tasks (default: none). Suggested: `imported`.

- `--report <path.json>` *(optional)*  
  Write machine-readable report including per-event decisions and any conflicts.

### Output / Exit Codes
- Exit `0` on success.
- Exit `1` on validation/parse errors.
- Exit `2` on filesystem errors.
- Stdout summary:
  - events parsed
  - tasks matched by X-TADOI-TASK-ID
  - tasks matched by UID
  - created / updated / merged / skipped / errors
  - recurring series imported count
  - override instances created/updated count
  - cancellations applied count (EXDATE / cancelled overrides)

---

## 6) Parser Requirements (ICS → Normalized Model)

### Required parsing features
- Line **unfolding** (RFC5545 folded lines).
- Property parsing with **parameters**:
  - `DTSTART;VALUE=DATE:...`
  - `DTSTART;TZID=America/Chicago:...`
- Text unescaping for DESCRIPTION/SUMMARY/CATEGORIES.
- VCALENDAR timezone:
  - Prefer TZID from `X-WR-TIMEZONE` or DTSTART params.
  - Support UTC `Z` timestamps.
  - VTIMEZONE parsing is optional for v1 if DTSTART contains TZID and app uses a canonical tz database; however, v1 should behave correctly for the exporter’s generated files (which include VTIMEZONE).

### Minimum supported components
- `VCALENDAR`
- `VEVENT`

---

## 7) Identity & Idempotency

### Identity precedence (match order)
1. `X-TADOI-TASK-ID` → match that exact task id (primary round-trip).
2. If absent, parse TADOI UID conventions (back-compat):
   - `UID:tadoi-{taskId}@local`
   - `UID:tadoi-series-{taskId}@local`
   - `UID:tadoi-inst-{taskId}@local`
3. If still unmatched: match by `UID` against a stored external mapping:
   - `task.external.calendar.uid`
4. Else: treat as new and create a task (unless filtered out by range/view).

### Required persisted metadata
Add (or extend) task metadata to support repeatable imports:
```ts
task.external?.calendar = {
  uid: string,                 // VEVENT UID
  source?: string,             // e.g. "ics-import"
  tzid?: string,               // last seen tzid
  lastImportedAt: ISOString,
  lastImportedHash?: string,   // fingerprint of mapped fields to detect local edits (optional)
  recurrenceId?: string,       // for override instance tasks (RECURRENCE-ID)
  seriesUid?: string,          // for override instance tasks (RELATED-TO or base UID)
}
```

---

## 8) Field Mapping (VEVENT → Task)

### Core mapping
- `SUMMARY` → `task.title`
- `DESCRIPTION` → `task.notes` (merge strategy in §9)
- `CATEGORIES` → `task.tags` (normalize; de-dupe)
- `URL` + link-like lines in DESCRIPTION → `task.links[]` (if supported)
- All-day (VALUE=DATE) → **date-only due**
- Timed DTSTART → **due date+time**

### Time interpretation
- If DTSTART has `TZID`: interpret as that timezone.
- If DTSTART ends with `Z`: interpret as UTC and convert to app timezone for storage.
- Store due as the canonical TADOI due representation (date-only vs date+time).

### Status mapping
- If VEVENT has `STATUS:CANCELLED`:
  - For non-recurring events: default to **skip** (or optionally create closed task — out of scope v1).
  - For recurring exceptions with `RECURRENCE-ID`: treat as a **cancellation** of that occurrence (see §10).

---

## 9) Conflict Policy (Default: Conservative Merge)

Applies when an incoming VEVENT maps to an existing task (by X-TADOI-TASK-ID, UID, or external mapping).

### `--mode merge` (default)
- **title**:
  - If incoming differs and task was previously imported from this UID (optional `lastImportedHash` indicates), update title.
  - Otherwise keep local title and record conflict in report.

- **due**:
  - If incoming due differs: update due **unless** task was edited after `lastImportedAt` and due was changed locally (requires edit tracking; if unavailable, update due and record “possible conflict”).

- **tags**:
  - Union sets (normalize/trim; keep stable order).

- **links**:
  - Union by `target` (preserve existing labels; add new ones).

- **notes** (`DESCRIPTION`):
  - Append imported notes block if it changed (don’t overwrite).
  - Add a delimiter:
    - `--- Imported from Calendar (UID … at <timestamp>) ---`

### `--mode update`
Calendar wins for all mapped fields (title, due, tags, links, notes overwritten by imported content).

### `--mode create`
Never update; always create new tasks.

---

## 10) Recurrence Import (RRULE, EXDATE, RECURRENCE-ID)

### 10.1 Base recurring series (RRULE)
If a VEVENT has `RRULE`:
- **RRULE must be valid** (parseable by `src/calendar/rrule.ts`).
  - If invalid → error (exit 1) with a clear message and per-event details in report.
- Create/update a **series root task**:
  - `task.recurrence.dtstart` from VEVENT DTSTART
  - `task.recurrence.rrule` from the RRULE content (store fragment consistent with export expectations)
  - `task.recurrence.exdates[]` union with imported EXDATE (normalized)

**Range interaction**
- `next7`/`month`: import the series only if it yields at least one occurrence in the window.
- `all`: import series regardless (no materialization required).

### 10.2 EXDATE (excluded occurrences)
- Normalize each EXDATE value to the series timezone semantics and add to `task.recurrence.exdates[]`.
- If an override instance task already exists for that recurrenceId, mark it **closed** (v1 default) and record in report.

### 10.3 RECURRENCE-ID overrides (edited single occurrences)
Support VEVENTs that include `RECURRENCE-ID`.

**Import behavior**
- Resolve the base series task (prefer X-TADOI-TASK-ID; else group by UID).
- For each override VEVENT:
  - Compute `overrideKey = (baseSeriesTaskId, recurrenceIdValue)`
  - Create or update an **instance override task**:
    - `instance_of = baseSeriesTaskId`
    - `external.calendar.recurrenceId = <RECURRENCE-ID value>` (canonical string)
    - due = override DTSTART (or recurrenceId if DTSTART missing)
    - apply mapped fields per merge policy
  - Ensure base series excludes the original occurrence:
    - add recurrenceId as EXDATE (if not already present)

**Cancellation overrides**
- If override VEVENT has `STATUS:CANCELLED`:
  - Add the recurrenceId to base EXDATE
  - Close any matching instance task if it exists

### 10.4 RDATE (optional v1)
If VEVENT includes `RDATE`:
- Only supported if bounded (must not exceed `--horizon-days` and a hard count cap).
- Import as discrete tasks for each RDATE within range.

---

## 11) Range Filtering (Import Side)

- Standalone VEVENTs: process if DTSTART in window.
- Series VEVENTs: process if any occurrence intersects window (bounded check).
- Overrides: process if override DTSTART or RECURRENCE-ID intersects window.

---

## 12) Implementation Plan (Repo-Concrete)

### New files (expected)
- `src/commands/calendarImport.ts`
- `src/state/calendarImportService.ts`
- `src/calendar/icsParser.ts`
- `src/calendar/importMapper.ts`

### Integrate command
- Add subcommand in `src/cli/calendarCommands.ts` (mirroring export wiring).
- Reuse:
  - range semantics from `src/calendar/range.ts`
  - RRULE validation from `src/calendar/rrule.ts`
  - saved-view filtering path used by export service

---

## 13) Testing Plan

### Unit tests
- `icsParser.test.ts`: unfolding, params, DTSTART parsing (DATE/TZID/Z), RRULE/EXDATE/RECURRENCE-ID parsing.
- `calendarImportService.test.ts`:
  - idempotency (import same file twice)
  - merge semantics (append notes; union tags/links)
  - RRULE validity gate
  - horizon cap for RDATE / materialization paths

### Fixtures
- Reuse export fixture: `src/state/__fixtures__/calendar-export.golden.ics`
- Add:
  - `calendar-import.override-recurrence-id.ics`
  - `calendar-import.cancelled-occurrence.ics`

### DST regression
- Import timed event spanning DST boundary and assert stored local wall-clock time.

---

## 14) Acceptance Criteria (v1)

- `tadoi calendar:import --in <file>` works end-to-end with correct exit codes.
- True round-trip: `X-TADOI-TASK-ID` updates the same tasks.
- Default merge is conservative (union/append) and reported.
- Recurrence: valid RRULE imports + EXDATE union; invalid RRULE fails with clear error.
- RECURRENCE-ID overrides create/update instance tasks and add EXDATE to base series.
- Any materialization is bounded by horizon and count caps.

---

*End of spec.*
