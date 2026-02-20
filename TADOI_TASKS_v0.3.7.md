# TADOI™ Task List (v0.3.7)

Updated: 2026-02-20
Runtime baseline: `v0.3.7`
Package baseline: `0.3.7`

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

### A7) Calendar + Security/Privacy Hardening
- `TA-055` Calendar export privacy controls (`minimal` default, `full`, `--include-details` alias). (`Complete`)
- `TA-056` Calendar import foundation implemented at service layer (parser/mapper/import service + bounded size/horizon protections). (`Complete`)
- `TA-057` Source-aware link safety (`calendar_import` provenance + confirm/block policy for risky opens). (`Complete`)
- `TA-058` Startup path-log redaction default with debug opt-in (`TADOI_VERBOSE_PATH_LOGS=1`). (`Complete`)

### A8) Engagement and Schema
- `TA-059` Engagement milestone toasts implemented for first win, recurring milestones, momentum, and streak notifications. (`Complete`)
- `TA-060` Persisted engagement state migration landed with schema bump `4 -> 5`. (`Complete`)

### A9) TITS Command Layer
- `TA-061` TITS M1 command bar overlay landed in LIST mode with history + routing suppression. (`Complete`)
- `TA-062` TITS M2 external CLI parity landed (`add|done|due|recur|help`) with lock and atomic save policy. (`Complete`)
- `TA-063` TITS M3 recurrence command landed (`recur`) with deterministic validation and due-anchor rules. (`Complete`)
- `TA-064` Completion pathway recurrence spawn parity preserved across TITS command execution and list-mode completion flows. (`Complete`)

## B) Documentation and Release Governance

### B1) Completed in this docs sync
- `TD-001` Update active docs to `v0.3.7` baseline alignment. (`Complete`)
- `TD-002` Create versioned spec artifact: `TADOI_SPEC_v0.3.7.md`. (`Complete`)
- `TD-003` Create versioned task artifact: `TADOI_TASKS_v0.3.7.md`. (`Complete`)
- `TD-004` Refresh installation/QA/feature docs for code-truth parity. (`Complete`)
- `TD-005` Update changelog/docs index references for active artifacts. (`Complete`)
- `TD-006` Produce docs audit inventory and Notion sync manifest. (`Complete`)

### B2) Pending documentation follow-ups
- `TD-020` Archive/mark deprecated historical docs in a single index to reduce confusion. (`Pending`)
- `TD-021` Add docs lint/link-check CI gate for docs-only PRs. (`Pending`)
- `TD-022` Publish a canonical keybinding table doc generated from key router tests. (`Pending`)

## C) QA Execution Matrix (Manual)

Smoke baseline (required all platforms):
- `QA-001`, `QA-002`, `QA-005`, `QA-008`, `QA-013`, `QA-019`, `QA-023`, `QA-029`, `QA-032`, `QA-036`, `QA-039`, `QA-042`, `QA-052`, `QA-053`, `QA-065`, `QA-066`, `QA-068`

Extended functional smoke:
- `QA-047` logo rotation parity
- `QA-048` tag panel open parity (list/dashboard/left rail)
- `QA-049` task link add/edit/delete
- `QA-050` task link open/copy behavior
- `QA-051` external link scheme confirmation modal
- `QA-054` calendar export privacy/full metadata coverage
- `QA-055` calendar import dry-run-before-commit gating
- `QA-056` calendar import mode pass-through and high-impact confirmation
- `QA-057` recurrence import error handling and blocking behavior
- `QA-058` recurrence override/cancellation summary coverage
- `QA-059` security policy block mode for risky link opens
- `QA-060` startup log redaction and verbose override behavior
- `QA-070` CLI command parity (`add|done|due|recur|help`) and `@selected` rejection
- `QA-071` CLI lock-gate behavior and exit-code semantics
- `QA-072` recurrence spawn parity from TITS/CLI completion paths

Reference: `docs/TADOI_QA_Guide_v0.3.7.md`

## D) Next Candidate Phase (v0.3.7 Planning)

- `PN-001` Docs automation:
  - Generate keybinding docs from `keyRouter` and tests.
  - Emit release-ready docs drift report in CI.
- `PN-002` Link UX polish:
  - optional bulk link import from pasted markdown list.
  - richer link kind detection and validation hints.
- `PN-003` Packaging confidence:
  - expand installer smoke tests to all artifact outputs in CI.
- `PN-004` Calendar import/post-import QA depth:
  - extend round-trip fixtures for recurring overrides/cancellations across mixed timezone datasets.
  - add docs examples for `--mode update` safety expectations in operator runbooks.

## E) Acceptance Criteria for This Task Sheet

This file is considered current when:
1. Runtime baseline remains `v0.3.7` / `0.3.7`.
2. Completed items match current code behavior and keybindings.
3. QA references map to active QA guide case IDs.
4. Pending items are actionable and non-duplicative.

## Trademark Notice
TADOI™ is a trademark of <OWNER>. Other names may be trademarks of their respective owners.
