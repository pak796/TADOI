# TADOI™ Release Notes

Current release baseline: `v0.3.8` (`package.json`: `0.3.8`).

Primary changelog lives at `CHANGELOG.md` in the repo root.

## Latest Notes (v0.3.8)
- Version: `v0.3.8`
- Date: `2026-02-27`
- Highlights:
  - Engagement-toast runtime behavior is documented and aligned to active `v0.3.8` baselines.
  - Contract and release-governance docs were refreshed to current evidence.
- Fixes:
  - Added named DTF coverage labels for `DTF-008` and `DTF-009` in existing tests.
  - `bun run contract:dtf:check` now passes with `9` covered IDs from `DASHBOARD_SPEC_MVP.md` and `TADOI_SPEC_v0.3.8.md`.
- Quality gates:
  - `bun run docs:lint`: PASS
  - `bun run keybind:canonical:check`: PASS (`canonical=64 missing_in_docs=0 missing_in_code=0`)
  - `bun run contract:dtf:check`: PASS
  - `bun run notion:sync:validate`: PASS (`items=14`)
- Known issues:
  - No blocking issues identified in this documentation remediation pass.
- Docs updated:
  - `CHANGELOG.md`
  - `docs/RELEASE_RUN_REPORT.md`
  - `docs/RELEASE_NOTES.md`
