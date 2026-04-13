---
name: release-readiness-gate
description: Prepare a repository for release by running a deterministic release checklist, optionally bumping a provided TARGET_VERSION, validating build and packaging outputs, and reporting PASS/FAIL/BLOCKED evidence. Use before tags, release candidates, installers, or public artifacts.
---

# Release Readiness + Packaging (Build/Package/Version, Minimal Surface Area)

## Intent
Bring the app to release-ready state by running a release checklist, optionally bumping version only when `TARGET_VERSION` is provided, and regenerating packaging artifacts from a clean output state.

## Inputs
- `TARGET_VERSION` (optional): SemVer string such as `0.2.9` or `0.2.9-beta.1`.
- If `TARGET_VERSION` is provided, update version references.
- If `TARGET_VERSION` is not provided, do not mutate version and validate packaging against the current version.

## Apply Relevant Skills
- Use available skills and workflows for build and test execution.
- Use available skills and workflows for packaging and installer generation.
- Use available skills and workflows for CI and release automation validation.
- Use available skills and workflows for semantic versioning and changelog hygiene.
- Use available skills and workflows for repository release hygiene where it affects readiness.
- Load the minimal set needed for deterministic execution.

## Scope

### Allowed
- Edit packaging scripts and configs under paths such as `scripts/` and `packaging/`.
- Edit CI workflows only when they block packaging or release verification.
- Edit version sources and dependent version strings.
- Edit changelog or release notes files required for release integrity.
- Create or update release checklist artifacts under `docs/`.

### Not Allowed
- Implement feature work.
- Perform UX redesign.
- Perform refactors unrelated to release or packaging correctness.
- Make behavioral changes not required for build and package correctness.
- Introduce drive-by style churn.

Rule: if a change does not improve release determinism, do not make it.

## Hard Constraints
1. Repackage means clean rebuild. Always clear prior output and regenerate artifacts.
2. Never claim packaging success when required toolchains are unavailable.
3. Use one canonical version source, typically `package.json`, and derive all dependent version strings from it.
4. Mark every checklist item as exactly one of:
- `PASS` with command and output evidence snippet.
- `FAIL` with root cause and fix.
- `BLOCKED` with reason and reproducible local or CI command plan.

## Runbook

### Step 1: Discover Release Surfaces
- Identify build entry points.
- Identify packaging entry points and installer tooling.
- Identify version locations across source, CLI, and UI strings.
- Identify CI workflows relevant to build and packaging.
- Create or refresh `docs/RELEASE_CHECKLIST.md` with exact commands.

### Step 2: Optional Version Bump
- Execute this step only if `TARGET_VERSION` is provided.
- Validate SemVer and ensure version progression unless prerelease policy explicitly allows otherwise.
- Update canonical version source first.
- Update dependent version strings such as about text, help output, and artifact naming.
- If changelog exists, add or prepare target version entry.
- If changelog does not exist, create one only when repository release process requires it.
- If `TARGET_VERSION` is not provided, skip mutation and verify `--version` matches canonical source.

### Step 3: Execute Release Checklist (Build Verification)
- Run dependency install using lockfile-respecting command.
- Run lint when present.
- Run typecheck when present.
- Run tests when present.
- Run build as required gate.
- Run smoke checks:
- `app --help`
- `app --version`
- minimal TUI launch path when supported.
- Record all outcomes in `docs/RELEASE_RUN_REPORT.md`.

### Step 4: Packaging and Repackaging
- Clean output directories before packaging. Example: remove and recreate `dist/`.
- Run packaging for each repository-supported target.
- Verify artifact naming includes version when versioned naming is the project convention.
- If packaging is scaffold-only and toolchain is implied by repo config, implement real artifact production.
- If toolchain is not available, keep scaffold behavior and mark packaging status as `BLOCKED` with required toolchain and commands.

### Step 5: Artifact Verification
- For each artifact, verify file exists.
- Verify non-trivial size.
- Verify naming and embedded version expectations.
- Perform feasible smoke validation:
- binary runs and prints help and version.
- installer or image contains expected app or binary.
- Verify debug and development flags are not enabled in release artifacts.

### Step 6: Release Hygiene (Prepare, Do Not Publish)
- Prepare release notes file such as `docs/RELEASE_NOTES_<version>.md`, or update changelog.
- Verify build output paths are correctly ignored by git.
- Verify install and packaging instructions align with produced artifacts.
- Do not push, tag, or publish unless explicitly requested.

## Required Deliverables
1. `docs/RELEASE_CHECKLIST.md` with commands, expected outputs, and platform notes.
2. `docs/RELEASE_RUN_REPORT.md` with PASS or FAIL or BLOCKED status and evidence snippets.
3. Updated version references only when `TARGET_VERSION` is provided.
4. Fresh packaging artifacts in standard output directory, or explicit `BLOCKED` section with toolchain requirements and reproducible command plan.

## Acceptance Criteria
- Clean rebuild completed, or marked `BLOCKED` with exact reproduction steps.
- Packaging artifacts regenerated and listed with version-accurate naming.
- `--version` output matches canonical version source.
- Release report contains concrete commands and outcomes.
- No unrelated feature changes or refactors.

## End-of-Run Safety Check
- Summarize diff by category:
- versioning changes
- packaging changes
- CI changes
- documentation changes
- Confirm all changes are release-related and minimal.

## Legacy Resources
- Optional gate helper script: `scripts/release_gate.py`.
- Optional references: `references/check-catalog.md`, `references/remediation-playbook.md`.
