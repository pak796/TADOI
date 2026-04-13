# Packaging Confidence CI Expansion Spec

- Task slug: `packaging-confidence-ci`
- Date: `2026-04-12`

## Goal

Expand CI packaging confidence so workflows that build installer artifacts also validate those artifacts through the existing manifest gate and installer smoke paths instead of relying on binary-only or existence-only checks.

## Scope

### In scope

- Audit existing packaging-related GitHub Actions workflows against `PN-003`.
- Standardize `package-macos.yml` on the same packaged-artifact validation primitives already used in `ci.yml` and `release.yml`.
- Expand `daily-build.yml` so each host-platform matrix job validates its host-built installer outputs, not just artifact existence.
- Reuse existing scripts and commands where possible:
  - `bun run installer:gate --target <target>`
  - `bun run installer:smoke --target <target> --scope binary|installer|all`
  - `bun run preflight:host:release`
- Update task-memory docs and any operator-facing release checklist text only if the implemented validation contract changes materially.

### Out of scope

- Adding new packaging formats, signing flows, or notarization behavior.
- Rewriting `ci.yml` or `release.yml` if their current installer-gate and smoke coverage is already sufficient.
- Changing artifact names, manifest schema, or release-upload behavior.
- Broad release-process refactors unrelated to packaging-confidence validation.

## Constraints

- Assumption: the remaining `PN-003` gap is not `ci.yml` or `release.yml`, because both already run installer manifest and smoke checks per target; the actionable gap is `package-macos.yml` and `daily-build.yml`.
- Validation is host-sensitive. Local execution on this machine can fully validate the macOS path and repo scripts, but cannot fully execute Windows or Linux packaging smoke locally.
- Reuse existing packaging scripts and workflow conventions instead of introducing a second packaging-validation implementation.
- Keep this pass workflow-first. Do not widen into runtime or packaging-script rewrites unless the workflow changes expose a real script defect.
- Dataset impact is `none`.

## Acceptance criteria

- `package-macos.yml` no longer relies on ad hoc binary-only smoke where installer artifacts are already built; it routes through the existing installer gate and installer smoke commands.
- `daily-build.yml` validates host-built installer outputs with the existing installer gate and smoke commands for each matrix target.
- Host-sensitive prerequisite steps remain present for each target so the new validation steps can actually run.
- Local macOS validation proves the updated packaging-confidence path can build, gate, and smoke the macOS artifacts successfully.
- Any docs touched by the change remain link-valid and aligned to current behavior.

## Validation

- `bun run preflight:host:release`
- `bun run build:installer:mac:all`
- `bun run installer:gate --target macos`
- `bun run installer:smoke --target macos --scope all`
- `bun run build:daily`
- `bun run preflight:host:docs`
- `bun run docs:lint`
