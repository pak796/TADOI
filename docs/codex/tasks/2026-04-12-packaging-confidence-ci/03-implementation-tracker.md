# Packaging Confidence CI Expansion Implementation Tracker

- Task slug: `packaging-confidence-ci`
- Date: `2026-04-12`
- Status: `validated_complete`

## Current state

- `ci.yml` already builds host-target binaries and installers on macOS, Windows, and Linux, then runs `installer:gate` plus `installer:smoke`.
- `release.yml` already uses the same installer manifest and smoke validation path before publishing release assets.
- `package-macos.yml` now verifies host/tool prerequisites and routes installer validation through `installer:gate` plus `installer:smoke --scope all`.
- `daily-build.yml` now installs platform packaging prerequisites before `preflight:host:release`, then runs `installer:gate` plus `installer:smoke --scope all` across `linux`, `macos`, and `windows`.
- GitHub Actions run `24324573404` confirmed the updated daily-build workflow on all three hosted runners.

## Decisions taken

- Keep scope focused on the remaining workflow gaps: `package-macos.yml` and `daily-build.yml`.
- Reuse the existing shared validation commands instead of inventing workflow-specific packaging checks.
- Treat `ci.yml` and `release.yml` as the source-of-truth packaging-confidence pattern unless the new work exposes a defect there.
- Update operator-facing docs only if the workflow contract changes materially.

## Validation log

- `git commit -m "chore: import codex workflow scaffold"`: PASS (`9afe542`)
- `bun run preflight:host:release`: PASS (`[SUMMARY] profile=release PASS=9 FAIL=0 BLOCKED=0 overall=PASS`)
- `bun run build:installer:mac:all`: PASS (wrote `TADOI-0.4.0-beta.2.pkg`, `TADOI-macOS-0.4.0-beta.2.dmg`, and `TADOI-macos-0.4.0-beta.2-manifest.json`)
- `bun run installer:gate --target macos`: PASS (`[installer:gate] OK (macos)`)
- `bun run installer:smoke --target macos --scope all` while `bun run build:daily` was running in parallel: FAIL (`macOS DMG not found`) because both commands were mutating `dist/installers` at the same time; this does not match workflow execution order.
- `bun run build:daily && bun run installer:gate --target macos && bun run installer:smoke --target macos --scope all && bun run preflight:host:docs && bun run docs:lint`: PASS (`[build-daily] report written .../dist/artifacts/2026-04-12/BUILD_REPORT.md`, `[installer:gate] OK (macos)`, `[installer:smoke] OK (macos): binary runtime and installer artifact checks passed.`, `[docs-lint] PASS: local markdown links and anchors resolved.`)
- `python3 "$HOME/.codex/skills/safe-scope-enforcer/scripts/scope_enforcer.py" --repo-root . --scope-profile custom --allow-glob '.github/workflows/*.yml' --allow-glob 'docs/codex/tasks/**' --allow-glob 'TADOI_TASKS_v0.4.0.md' --deny-glob 'src/**'`: PASS (`Scope check passed for 1 changed file(s).`)
- `bun run preflight:host:release`: PASS (`[SUMMARY] profile=release PASS=9 FAIL=0 BLOCKED=0 overall=PASS`)
- `git commit -m "ci: fix daily build release preflight order"`: PASS (`244accc`)
- `git push origin codex/repo/tadoi-workflow-bootstrap`: PASS (`d30ef6e..244accc`)
- `gh workflow run daily-build.yml --ref codex/repo/tadoi-workflow-bootstrap -f upload_artifacts=false`: PASS (dispatched run `24324573404`)
- `gh run watch 24324573404 --exit-status`: PASS (`daily-build (ubuntu-latest, linux)` completed with `Install Linux packaging prerequisites`, `Host preflight (release)`, `Installer artifact manifest gate`, and `Installer smoke test` all succeeding; `daily-build (windows-latest, windows)` completed with `Install Inno Setup (Windows)`, `Verify Inno Setup compiler (Windows)`, `Host preflight (release)`, `Installer artifact manifest gate`, and `Installer smoke test` all succeeding.)

## Risks and blockers

- `package-macos` workflow run `24324449180` still fails in the pre-existing `Test` step because Bun `1.3.9` crashed with a segmentation fault before the packaging steps ran.
- GitHub Actions emitted a Node 20 deprecation warning for the pinned `actions/checkout` and `oven-sh/setup-bun` revisions.

## Next actions

- Investigate the Bun crash in `package-macos` as a separate CI-stability follow-up.
- Refresh pinned GitHub Actions revisions before the Node 24 runner switch becomes default.
- No further packaging-confidence work is required for `PN-003`.
