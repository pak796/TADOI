# TADOI™ Task List (v0.3.9)

Updated: 2026-03-03
Runtime baseline: `v0.3.9`
Package baseline: `0.3.9`

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
- `TA-044` Canonical overdue semantics unified across KPI, due buckets, and overdue aging (includes same-day explicit-time overdue). (`Complete`)
- `TA-045` Throughput panel upgraded from binary markers to magnitude-based bars with shared scaling. (`Complete`)
- `TA-046` Deterministic height-priority collapse strategy added for dashboard vertical compression. (`Complete`)
- `TA-047` Dashboard expansion: due-bucket exact drill-through (`+1..+6`), compact priority strip, dimension slices (`assignee`/`project`/`workflowStage`), backlog trend surfacing, and focus-group keyboard navigation. (`Complete`)
- `TA-048` Analytics window filters (`7d|14d|30d`) added and persisted in saved views; dashboard `w` cycle landed. (`Complete`)

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
- `TA-060` Persisted engagement/concurrency migrations landed with schema bumps `4 -> 5` (engagement) and `5 -> 6` (`stateRevision` hardening). (`Complete`)
- `TA-080` Schema bump `6 -> 7` landed with `workflowStage` migration backfill (`open -> todo`, `done|archived -> done`) and strict validation. (`Complete`)
- `TA-081` Task/editor/filter schema expanded with analytics dimensions (`assignee`, `project`, `workflowStage`) and dashboard analytics fields (`analyticsWindow`, `dueDayOffset`). (`Complete`)
- `TA-082` Schema bump `7 -> 8` landed with checklist-array normalization backfill and strict persisted-state parity. (`Complete`)
- `TA-083` Out-of-app reminder reliability + interaction hardening landed with reminder CLI dispatch/tick tests, cross-platform launcher matrix tests, dependency-injected `runRemindCommand` action harness coverage, and CI/release reminder regression gates. (`Complete`)

### A9) TITS Command Layer

- `TA-061` TITS M1 command bar overlay landed in LIST mode with history + routing suppression. (`Complete`)
- `TA-062` TITS M2 external CLI parity landed (`add|done|due|recur|help`) with lock and atomic save policy. (`Complete`)
- `TA-063` TITS M3 recurrence command landed (`recur`) with deterministic validation and due-anchor rules. (`Complete`)
- `TA-064` Completion pathway recurrence spawn parity preserved across TITS command execution and list-mode completion flows. (`Complete`)

### A10) Theme + CRT FX Surface

- `TA-065` Theme registry expanded with `crtGreen`, `crtAmber`, `kitty`, `corpo`, and `strikefitron`; rotating theme order includes CRT palettes. (`Complete`)
- `TA-066` Help settings navigation includes `CRT FX Lite` and `CRT FX Profile` controls alongside existing settings rows. (`Complete`)
- `TA-067` CRT FX Lite panel tint/flicker pipeline landed for left rail, task list, and details panel surfaces with profile-driven cadence. (`Complete`)

## B) Documentation and Release Governance

### B1) Completed in this docs sync

- `TD-001` Update active docs to `v0.3.9` baseline alignment. (`Complete`)
- `TD-002` Create versioned spec artifact: `TADOI_SPEC_v0.3.9.md`. (`Complete`)
- `TD-003` Create versioned task artifact: `TADOI_TASKS_v0.3.9.md`. (`Complete`)
- `TD-004` Refresh installation/QA/feature docs for code-truth parity. (`Complete`)
- `TD-005` Update changelog/docs index references for active artifacts. (`Complete`)
- `TD-006` Produce docs audit inventory and Notion sync manifest. (`Complete`)

### B2) Pending documentation follow-ups

- `TD-020` Archive/mark deprecated historical docs in a single index to reduce confusion. (`Complete`)
  - Delivered `docs/HISTORICAL_DOCS_INDEX.md` and linked it from `docs/DOC_INDEX.md` + `docs/README.md`.
- `TD-021` Add docs lint/link-check CI gate for docs-only PRs. (`Complete`)
  - Added `scripts/docs-lint.ts` and workflow `.github/workflows/docs-lint.yml`.
- `TD-022` Publish a canonical keybinding table doc generated from key router tests. (`Complete`)
  - Added generated doc `docs/KEYBINDS_CANONICAL.md` via `keybind:canonical:update` (`keybind:audit` + `scripts/generate-keybind-doc.ts`).

## C) QA Execution Matrix (Manual)

Smoke baseline (required all platforms):

- `QA-001`, `QA-002`, `QA-005`, `QA-008`, `QA-013`, `QA-019`, `QA-023`, `QA-029`, `QA-032`, `QA-036`, `QA-039`, `QA-042`, `QA-052`, `QA-053`, `QA-065`, `QA-066`, `QA-068`, `QA-073`

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
- `QA-074` dashboard analytics window cycle + saved-view persistence
- `QA-075` dashboard priority strip drill-through
- `QA-076` dashboard assignee/project/stage slice drill-through
- `QA-077` dashboard throughput magnitude scaling
- `QA-078` dashboard height-priority collapse behavior
- `QA-079` backlog trend runtime visibility

Reference: `docs/TADOI_QA_Guide_v0.3.9.md`

## D) Next Candidate Phase (v0.3.9 Planning)

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

1. Runtime baseline remains `v0.3.9` / `0.3.9`.
2. Completed items match current code behavior and keybindings.
3. QA references map to active QA guide case IDs.
4. Pending items are actionable and non-duplicative.

## Trademark Notice

TADOI™ is a trademark of <OWNER>. Other names may be trademarks of their respective owners.
