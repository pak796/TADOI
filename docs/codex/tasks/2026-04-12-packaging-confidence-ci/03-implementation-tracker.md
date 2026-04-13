# Packaging Confidence CI Expansion Implementation Tracker

- Task slug: `packaging-confidence-ci`
- Date: `2026-04-12`
- Status: `implementation_complete_pending_ci`

## Current state

- `ci.yml` already builds host-target binaries and installers on macOS, Windows, and Linux, then runs `installer:gate` plus `installer:smoke`.
- `release.yml` already uses the same installer manifest and smoke validation path before publishing release assets.
- `package-macos.yml` still uses a manual binary-only smoke step after building installer artifacts.
- `daily-build.yml` builds host artifacts through `build:daily` but only asserts Windows installer existence instead of routing through the stronger manifest and smoke checks.

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

## Risks and blockers

- Local validation on this macOS host can fully cover the macOS path only.
- Windows and Linux workflow execution still depends on GitHub Actions runners for end-to-end confirmation.
- The stricter daily-build and macOS package workflows may expose latent runner provisioning gaps that the weaker checks previously missed.

## Next actions

- Stage the workflow and tracker changes.
- Push the branch and let GitHub Actions confirm Windows and Linux runner behavior.
- If CI stays green, write the task change summary and update any release-facing source-of-truth docs that should record `PN-003` as completed.
