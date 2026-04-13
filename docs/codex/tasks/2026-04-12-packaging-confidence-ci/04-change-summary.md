# Packaging Confidence CI Expansion Change Summary

- Task slug: `packaging-confidence-ci`
- Date: `2026-04-12`

## What changed

- `package-macos.yml` now runs `preflight:host:release`, verifies macOS packaging tools, and validates produced artifacts with `installer:gate --target macos` plus `installer:smoke --target macos --scope all`.
- `daily-build.yml` now installs platform packaging prerequisites before `preflight:host:release`, then runs `installer:gate` plus `installer:smoke --scope all` for `linux`, `macos`, and `windows`.
- The task tracker now records the local packaging evidence and the successful GitHub Actions matrix run for the corrected daily-build flow.

## Why it changed

- `ci.yml` and `release.yml` already used the stronger installer manifest and smoke checks, but `daily-build.yml` and `package-macos.yml` did not.
- The first daily-build attempt failed on Linux because `preflight:host:release` ran before `appimagetool` was installed; moving preflight after platform setup removed that false negative while keeping the stricter gate.
- This brings every artifact-producing CI path onto the same packaging validation contract instead of mixing manifest checks with weaker ad-hoc existence assertions.

## Validation run

- `bun run preflight:host:release`: PASS (`[SUMMARY] profile=release PASS=9 FAIL=0 BLOCKED=0 overall=PASS`)
- `bun run build:installer:mac:all`: PASS (wrote macOS `.pkg`, `.dmg`, and manifest outputs)
- `bun run installer:gate --target macos`: PASS (`[installer:gate] OK (macos)`)
- `bun run build:daily && bun run installer:gate --target macos && bun run installer:smoke --target macos --scope all && bun run preflight:host:docs && bun run docs:lint`: PASS (`[build-daily] report written .../dist/artifacts/2026-04-12/BUILD_REPORT.md`, `[installer:smoke] OK (macos): binary runtime and installer artifact checks passed.`, `[docs-lint] PASS: local markdown links and anchors resolved.`)
- `gh run watch 24324573404 --exit-status`: PASS for `Daily Build` on `ubuntu-latest`, `macos-latest`, and `windows-latest`

## Risks or deferred items

- Manual `package-macos` workflow run `24324449180` still fails in its existing `Test` step because Bun `1.3.9` crashed before the packaging steps executed.
- GitHub Actions warns that the pinned `actions/checkout` and `oven-sh/setup-bun` revisions still run on Node 20 and should be refreshed before the Node 24 default switch.

## Next 1-3 actions

- Investigate the Bun test crash in `package-macos` as a separate CI-stability task.
- Refresh GitHub Actions pins for Node 24 compatibility.
