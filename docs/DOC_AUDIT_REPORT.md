# TADOI™ Documentation Audit Report

Date: 2026-02-12
Scope: repository docs + Notion docs synchronization
Baseline: runtime `v0.3.4`, package `0.3.4`

## 1) Summary

This audit reconciled active documentation against current code behavior and test surfaces.

Primary outcomes:
- Active docs baseline remains `v0.3.4` / `0.3.4`.
- New release-accurate spec/task artifacts were added for `v0.3.4`.
- Stale runtime baseline mentions in active auxiliary specs were corrected.
- Notion Documents database pages were updated in place, including new spec/task pages.
- Validation snapshot: `bun run test` passed (`355/355`), `bun run typecheck` passed.

## 2) Verification Sources (Code Truth)

Key files verified during this audit:
- `src/app/version.ts`
- `package.json`
- `src/app/layoutGuard.ts`
- `src/app/keyRouter.ts`
- `src/domain/models.ts`
- `src/domain/query.ts`
- `src/domain/tagFilter.ts`
- `src/components/TagFilterPanel.tsx`
- `src/ui/state.ts`
- `src/domain/taskLinks.ts`

## 3) Drift Findings and Resolutions

### Resolved
- Missing active release spec/task artifacts for `v0.3.4`.
  - Added `TADOI_SPEC_v0.3.4.md` and `TADOI_TASKS_v0.3.4.md`.
- Active auxiliary spec references used stale `v0.3.0` runtime baseline.
  - Updated `TADOI_BackupCenter_InApp_Spec.md` and `TADOI_Notifications_Spec_Tier1-2_v0.2.md` to `v0.3.4` context.
- Active QA/feature docs did not explicitly cover all task-link workflows.
  - Added feature bullets and QA cases `QA-049..QA-051`.
- Notion QA page still referenced `342/342` and `QA-001..QA-048`.
  - Updated to `355/355` and `QA-001..QA-051`.

### Known non-blocking audit noise
- Automated keybind extraction includes parser aliases and terminal-level key handling signals (for example `Ctrl+C`) that are not all directly represented in key-router code.
- Generic drift scanners include dependency/vendor docs (`node_modules`, `dist/install-check/node_modules`) and over-report missing evidence unrelated to project-owned docs.
- Historical versioned docs intentionally contain prior-version references.

## 4) Files Updated in This Audit

- `README.md`
- `CHANGELOG.md`
- `TADOI_SPEC_v0.3.4.md`
- `TADOI_TASKS_v0.3.4.md`
- `TADOI_BackupCenter_InApp_Spec.md`
- `TADOI_Notifications_Spec_Tier1-2_v0.2.md`
- `docs/README.md`
- `docs/TADOI_QA_Guide_v0.3.4.md`
- `docs/TADOI_Feature_List_v0.3.4.md`
- `docs/DOC_INDEX.md`
- `docs/DOC_AUDIT_REPORT.md`
- `docs/NOTION_SYNC.md`
- `docs/ops/branding.md`
- `docs/ops/notion_v0.3.4_sync_pack.md`

## 5) Commands and Snapshots Used

- keybinding audit:
  - `~/.codex/skills/keybind-source-of-truth/scripts/keybind_sync_audit.py`
- docs drift scan:
  - `~/.codex/skills/spec-task-drift-guard/scripts/doc_drift_scan.py`
- post-edit keybind scan summary:
  - canonical `61`, missing-in-docs `15`, missing-in-code `13`, semantic mismatches `1`
- post-edit docs drift scan summary:
  - `1596` findings total, with high noise from non-project docs under dependency/vendor trees
- targeted code/doc verification with `rg`, `sed`, test, and typecheck commands

## 6) Notion Sync Results

Updated existing pages in `collection://3035aa1e-f93f-80a3-ba35-000b3b596866`:
- Installation guide: `3045aa1e-f93f-8191-848a-cbc69ec6e869`
- QA guide: `3045aa1e-f93f-8103-bda5-f77d2bf55e8e`
- User guide: `3045aa1e-f93f-810c-82a5-c03e17858168`
- App overview: `3045aa1e-f93f-81fd-84cd-c93a6b68b49c`

Created pages:
- Product spec: `3055aa1e-f93f-812d-ad44-f3d94b8a7219`
- Task list: `3055aa1e-f93f-8159-b07c-ee692df137eb`

## 7) Next Recommended Doc Work

1. Add generated keybinding reference doc sourced from key-router tests.
2. Add docs-only CI link checker.
3. Consolidate historical version docs into a dedicated archive index page.

## Trademark Notice
TADOI™ is a trademark of <OWNER>. Other names may be trademarks of their respective owners.
