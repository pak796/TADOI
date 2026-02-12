# TADOI™ Task List (v0.3.4)

Updated: 2026-02-12
Runtime baseline: `v0.3.4`
Package baseline: `0.3.4`

## Conventions
- Status labels: `Complete`, `In Progress`, `Pending`, `Blocked`.
- Task IDs are stable and release-facing.
- This file tracks active release work and near-term follow-ups.

## A) Release-Accurate Completed Scope

### A1) Layout, Routing, and Mode Safety
- `TA-001` Terminal minimum-size guard aligned to `104x24`. (`Complete`)
- `TA-002` Search lifecycle standardized: `/` open, `Enter/Esc` close. (`Complete`)
- `TA-003` Dashboard toggle guard in text-entry contexts. (`Complete`)
- `TA-004` Left-rail focus labels map recurrence fields explicitly. (`Complete`)

### A2) Filtering and Views
- `TA-010` Legacy single-tag cycle (`t`) over open-task tag pool. (`Complete`)
- `TA-011` Boolean tag filter panel (`p`) with `ALL/ANY/NONE`. (`Complete`)
- `TA-012` Boolean tag filter precedence over legacy `tag`. (`Complete`)
- `TA-013` Saved views create/apply/delete with slot shortcuts (`1..9`). (`Complete`)

### A3) Recurrence
- `TA-020` Schema v4 recurrence model (`dtstart`, `rrule`, `exdates`, `series_id`). (`Complete`)
- `TA-021` Recurrence-aware visible rows shared by list/dashboard. (`Complete`)
- `TA-022` Occurrence actions (`Space`, `x`, `z`) and edit split (`e` vs `E`). (`Complete`)
- `TA-023` Recurring delete modal supports `y` (single) and `f` (future). (`Complete`)

### A4) Links / Attachments
- `TA-030` Task links model added to tasks (`links[]`). (`Complete`)
- `TA-031` Details links focus mode with open/copy/add/edit/delete actions. (`Complete`)
- `TA-032` Add-mode `Ctrl+L` link attach flow before save. (`Complete`)
- `TA-033` External unknown-scheme open confirmation modal. (`Complete`)

### A5) Dashboard and Left Rail
- `TA-040` Dashboard KPI strip (`OVERDUE`, `TODAY`, `NEXT7`, `OPEN`, `DONE7D`). (`Complete`)
- `TA-041` Top-tags drilldown and filter parity with list. (`Complete`)
- `TA-042` Left rail `TAG PANEL (P)` menu entry and hint strip alignment. (`Complete`)
- `TA-043` Logo mode expansion includes `alternate_blocks32` and rotate inclusion. (`Complete`)

### A6) Portability, Backup, and Notifications
- `TA-050` In-app Backup Center export/import/data-path workflows. (`Complete`)
- `TA-051` Import dry-run gating and replace confirmation (`REPLACE`). (`Complete`)
- `TA-052` Overdue modal queue + terminal bell cooldown preferences. (`Complete`)
- `TA-053` Corrupt-file recovery path with timestamped backup output. (`Complete`)
- `TA-054` One-way Calendar export (ICS) CLI with RRULE/EXDATE + instance override support. (`Complete`)

## B) Documentation and Release Governance

### B1) Completed in this docs sync
- `TD-001` Update active docs to `v0.3.4` baseline alignment. (`Complete`)
- `TD-002` Create versioned spec artifact: `TADOI_SPEC_v0.3.4.md`. (`Complete`)
- `TD-003` Create versioned task artifact: `TADOI_TASKS_v0.3.4.md`. (`Complete`)
- `TD-004` Refresh installation/QA/feature docs for code-truth parity. (`Complete`)
- `TD-005` Update changelog/docs index references for active artifacts. (`Complete`)
- `TD-006` Produce docs audit inventory and Notion sync manifest. (`Complete`)

### B2) Pending documentation follow-ups
- `TD-020` Archive/mark deprecated historical docs in a single index to reduce confusion. (`Pending`)
- `TD-021` Add docs lint/link-check CI gate for docs-only PRs. (`Pending`)
- `TD-022` Publish a canonical keybinding table doc generated from key router tests. (`Pending`)

## C) QA Execution Matrix (Manual)

Smoke baseline (required all platforms):
- `QA-001`, `QA-002`, `QA-005`, `QA-008`, `QA-013`, `QA-019`, `QA-023`, `QA-029`, `QA-032`, `QA-036`, `QA-039`, `QA-042`

Extended functional smoke:
- `QA-047` logo rotation parity
- `QA-048` tag panel open parity (list/dashboard/left rail)
- `QA-049` task link add/edit/delete
- `QA-050` task link open/copy behavior
- `QA-051` external link scheme confirmation modal

Reference: `docs/TADOI_QA_Guide_v0.3.4.md`

## D) Next Candidate Phase (v0.3.5 Planning)

- `PN-001` Docs automation:
  - Generate keybinding docs from `keyRouter` and tests.
  - Emit release-ready docs drift report in CI.
- `PN-002` Link UX polish:
  - optional bulk link import from pasted markdown list.
  - richer link kind detection and validation hints.
- `PN-003` Packaging confidence:
  - expand installer smoke tests to all artifact outputs in CI.

## E) Acceptance Criteria for This Task Sheet

This file is considered current when:
1. Runtime baseline remains `v0.3.4` / `0.3.4`.
2. Completed items match current code behavior and keybindings.
3. QA references map to active QA guide case IDs.
4. Pending items are actionable and non-duplicative.

## Trademark Notice
TADOI™ is a trademark of <OWNER>. Other names may be trademarks of their respective owners.
