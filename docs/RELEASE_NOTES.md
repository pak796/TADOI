# TADOI™ Release Notes

Current release baseline: `v0.4.0` (`package.json`: `0.4.0`).

Primary changelog lives at `CHANGELOG.md` in the repo root.

## Latest Notes (v0.4.0)
- Version: `v0.4.0`
- Date: `2026-03-04`
- Release scope:
  - Beta roll-forward release for runtime and active documentation (`v0.4.0` / `0.4.0`).
  - New active versioned artifacts for spec, task list, QA guide, feature list, and Notion staging pack.
  - GitHub cloud backup integration surfaces, encryption path coverage, and status panel flows are included in this beta validation baseline.
  - Empty-state NUX onboarding route coverage is included in this beta validation baseline.
- Beta validation focus:
  - TOME note lifecycle and guide-restore/reindex flows.
  - Git Backup connect/push/restore and encrypted snapshot behavior.
  - NUX walkthrough routes (`welcome`, `celebrate`, `what_next`) and onboarding progress chips.
- Validation snapshot:
  - `bun run docs:lint`: PASS
  - `bun run typecheck`: PASS
  - `bun test scripts/check-dtf-contract-drift.test.ts`: PASS
  - `bun test scripts/keybind-sync-audit.test.ts`: PASS
  - `bun test src/backup/githubCli.test.ts`: PASS
  - `bun test keybindingContract.test.ts` (from `src/app`): PASS
- Known issues:
  - No blocking release issues identified.
