# TADOI™ Documentation Index

Updated: 2026-03-11
Active runtime baseline: `v0.4.0-beta.2`
Active package baseline: `0.4.0-beta.2`

## 1) Start Here
- `README.md`: product overview, TITS command layer, quickstart, keybindings, packaging, data paths.
- `docs/README.md`: active docs landing page.

## 2) Active User Guides
- Install guide (concise): quick install and TITS quick validation.
- `docs/USAGE.md`: core flows, keybindings, TITS in-app + CLI command contract.
- `docs/CLI_COMPLETIONS.md`: optional bash/zsh/fish completion install guide.
- Install guide (all platforms): binary/source install and troubleshooting.
- `docs/TADOI_QA_Guide_v0.4.0.md`: full manual QA matrix (`QA-001`..`QA-085`).
- `docs/QA/SMOKE_TEST_CHECKLIST.md`: daily smoke list with TITS cases.
- `docs/QA/BLACK_BOX_TEST_MATRIX.md`: black-box scenarios with TITS coverage.
- `docs/QA/REGRESSION_AREAS.md`: high-risk invariants, including TITS routing + CLI lock safety.
- `docs/QA/LOCAL_MARKDOWN_NOTES_CHECKLIST.md`: slice-by-slice manual QA for TOME (local markdown notes) (`Slices 1-4`).
- `docs/QA/NOTES_SLICES_1-4_VERIFICATION_REPORT.md`: verification status and evidence log for TOME notes slices 1-4.
- `docs/TADOI_Feature_List_v0.4.0.md`: release-accurate feature catalog.

## 3) Active Spec and Planning
- `TADOI_SPEC_v0.4.0.md`: current runtime behavior/spec contract.
- `TADOI_TASKS_v0.4.0.md`: active implementation and documentation task ledger.
- `docs/specs/tits-m1-commandbar.md`: TITS M1 command bar baseline.
- `docs/specs/tits-m2-cli.md`: TITS M2 CLI implemented contract.
- `docs/specs/tits-m3-recurrence.md`: TITS M3 recurrence contract.
- `docs/specs/local-markdown-notes-implementation-notes.md`: integration notes for TOME boot/load, indexing, migration, and QA mapping.
- `TADOI_Spec_Calendar_Export_ICS_v0.2.md`: ICS export contract.
- `TADOI_Spec_Calendar_Import_ICS_RoundTrip_v0.1.md`: ICS import contract.
- `TADOI_Task_Links_Attachments_Spec_v0.2.md`: links/attachments behavior and security rules.

## 4) Release + Packaging
- Release checklist: release readiness gate.
- Release notes template: root changelog is canonical.
- `CHANGELOG.md`: release history.
- `packaging/*`: platform packaging scripts.

## 5) Operations and Governance
- `docs/DOC_AUDIT_REPORT.md`: latest docs/code drift audit report.
- `AGENTS.md`: repo-local Codex workflow defaults.
- `docs/CODEX_WORKFLOW.md`: repo-local Codex runbook and memory rules.
- `docs/ai/01-meta.yaml` .. `docs/ai/05-update-tracker.md`: durable AI context and memory layer.
- `docs/codex/README.md`: task-memory and vendored-skill usage guide.
- `docs/KEYBINDS_CANONICAL.md`: canonical key table generated from key router + key router tests.
- `docs/NOTION_SYNC.md`: Notion mapping and sync checklist.
- `docs/notion/NOTION_SYNC_PAYLOAD.json`: deterministic Notion payload artifact.
- `docs/notion/NOTION_SYNC_RUNBOOK.md`: deterministic sync runbook.
- `docs/ops/TADOI_DOC_AUDIT_POST_REMEDIATION_2026-02-27.md`: latest post-remediation docs audit record.
- `docs/ops/NOTION_DEPLOY_PACKAGE_2026-03-04.md`: deployment-ready Notion package manifest for deferred apply.
- `docs/ARCHIVAL_PATH_POLICY.md`: archival path normalization policy and scope.
- `docs/HISTORICAL_DOCS_INDEX.md`: single index for deprecated/historical docs.
- `docs/ops/branding.md`: branding + external GitHub/Notion guidance.

## 6) Historical Versioned Docs
- Historical release artifacts (`v0.2.x`, `v0.3.0`, `v0.3.1`, `v0.3.4`, `v0.3.5`, `v0.3.7`, `v0.3.8`, `v0.3.9`) are retained for traceability.
- Use `docs/HISTORICAL_DOCS_INDEX.md` as the single lookup entry.
- Active release documentation should prefer the `v0.4.0` files listed above.

## Trademark Notice
TADOI™ is a trademark of <OWNER>. Other names may be trademarks of their respective owners.
