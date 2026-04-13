# TADOI Post-Remediation Audit Bundle (2026-02-27)

Repo: /Users/patrickkazar/Library/CloudStorage/GoogleDrive-pakazar@gmail.com/Other computers/My Computer/Google Drive/CODE PROJECTS/TADOI
Branch: master
Version baseline: v0.3.8 (package 0.3.8)

## Scope of remediation

- Add `DTF-008`/`DTF-009` named test coverage labels in existing relevant tests.
- Refresh release-governance docs to current v0.3.8 gate evidence:
  - `CHANGELOG.md`
  - `docs/RELEASE_RUN_REPORT.md`
  - `docs/RELEASE_NOTES.md`
- Re-run focused docs drift and quality gates.

## Changed files

- /Users/patrickkazar/Library/CloudStorage/GoogleDrive-pakazar@gmail.com/Other computers/My Computer/Google Drive/CODE PROJECTS/TADOI/src/domain/savedViews.test.ts
- /Users/patrickkazar/Library/CloudStorage/GoogleDrive-pakazar@gmail.com/Other computers/My Computer/Google Drive/CODE PROJECTS/TADOI/src/app/App.modalFlow.integration.test.ts
- /Users/patrickkazar/Library/CloudStorage/GoogleDrive-pakazar@gmail.com/Other computers/My Computer/Google Drive/CODE PROJECTS/TADOI/CHANGELOG.md
- /Users/patrickkazar/Library/CloudStorage/GoogleDrive-pakazar@gmail.com/Other computers/My Computer/Google Drive/CODE PROJECTS/TADOI/docs/RELEASE_RUN_REPORT.md
- /Users/patrickkazar/Library/CloudStorage/GoogleDrive-pakazar@gmail.com/Other computers/My Computer/Google Drive/CODE PROJECTS/TADOI/docs/RELEASE_NOTES.md

## Contract remediation evidence

- `src/domain/savedViews.test.ts`: test name updated to `DTF-008: ...`
- `src/app/App.modalFlow.integration.test.ts`: test name updated to `DTF-009: ...`
- Gate result:
  - `bun run contract:dtf:check` -> PASS
  - Output: `[dtf-contract] OK: 9 DTF IDs from DASHBOARD_SPEC_MVP.md, TADOI_SPEC_v0.3.8.md are covered by named test cases in 100 test files.`

## Quality gate results (post-remediation)

- `bun run docs:lint` -> PASS
  - `[docs-lint] PASS: local markdown links and anchors resolved.`
- `bun run keybind:canonical:check` -> PASS
  - `canonical=64 missing_in_docs=0 missing_in_code=0`
  - `[keybind-doc] PASS: docs/KEYBINDS_CANONICAL.md is up to date.`
- `bun run contract:dtf:check` -> PASS
  - `OK: 9 DTF IDs ... in 100 test files.`
- `bun run notion:sync:validate` -> PASS
  - `[sync] validation OK: items=14`

## Focused drift scan (spec-task-drift-guard)

Command class: focused active docs + expanded evidence globs (src/scripts/docs/.github/packaging/spec docs)

Artifacts:

- /tmp/doc_drift_active_2026-02-27_post2.json
- /tmp/doc_drift_active_2026-02-27_post2.md

Summary:

- Total findings: 341
- Verified: 341
- Missing evidence: 0
- Unverified: 0

Severity distribution:

- high: 70
- medium: 50
- low: 221

## Scope safety check

- `safe-scope-enforcer` custom allowlist -> PASS
- Output: `Scope check passed for 5 changed file(s).`

## Notes

- No build/packaging/installer execution was run in this remediation pass.
- No Notion remote apply was executed.
