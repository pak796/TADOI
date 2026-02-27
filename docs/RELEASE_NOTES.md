# TADOI™ Release Notes

Current release baseline: `v0.3.9` (`package.json`: `0.3.9`).

Primary changelog lives at `CHANGELOG.md` in the repo root.

## Latest Notes (v0.3.9)
- Version: `v0.3.9`
- Date: `2026-02-27`
- Release scope:
  - Version alignment release for runtime and active documentation (`v0.3.9` / `0.3.9`).
  - New active versioned artifacts for spec, task list, QA guide, feature list, and Notion sync pack.
  - No runtime behavior changes were introduced in this release note pass.
- Validation snapshot:
  - `bun run docs:lint`: PASS
  - `bun run typecheck`: PASS
  - `bun test scripts/check-dtf-contract-drift.test.ts`: PASS
  - `bun test scripts/keybind-sync-audit.test.ts`: PASS
  - `bun test src/backup/githubCli.test.ts`: PASS
  - `bun test keybindingContract.test.ts` (from `src/app`): PASS
- Known issues:
  - No blocking release issues identified.
