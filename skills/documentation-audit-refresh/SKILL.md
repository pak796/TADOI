---
name: documentation-audit-refresh
description: Perform a comprehensive repository documentation audit and refresh using read-only code verification and docs-only edits. Use when docs may have drifted from behavior, before releases or public sharing, when onboarding docs are inconsistent, or when specs/tasks/QA/install/GitHub templates must be reconciled with current code and configuration.
---

# Documentation Audit & Refresh (Docs-Only, No Code Changes)

## Core Directive

- Audit repository documentation end-to-end.
- Verify behavior claims by reading code, config, scripts, and tests.
- Edit only documentation artifacts.
- Avoid all source code edits, refactors, formatting, and logic changes.

## Apply Relevant Skills First

- Inspect the available skill registry for skills covering:
- Repo discovery and inventory
- Markdown writing and formatting normalization
- Product/spec writing and requirements traceability
- QA and release checklist authoring
- Installation, packaging, and release documentation
- GitHub repo hygiene (`README`, `CONTRIBUTING`, `SECURITY`, `CHANGELOG`, templates)
- Cross-document consistency and link validation
- Notion export ingestion and reconciliation
- Load and apply the minimal set that covers the task.
- State which skills are used and in what order.
- Continue with this workflow if some matching skills are unavailable.

## Hard Constraints (Non-Negotiable)

1. Do not edit code files or behavior.
2. Limit edits to docs artifacts such as:

- `.md`, `.txt`, `.rtf`, `.adoc`, `.rst`
- Documentation JSON configs
- `docs/`, `packaging/` plans, `.github/` templates
- Exported Notion content stored in repo

3. Verify all behavior claims with read-only inspection.
4. When a fix requires code changes:

- Document the discrepancy.
- Add `Known Issue / TODO (requires code)` entry.
- Update task tracking docs if present.

## Coverage Requirements

- Cover repository documentation:
- `README.md`
- `docs/` subtree
- Specs (`*_SPEC_*.md`, versioned specs)
- Task/roadmap docs (`*_TASKS_*.md`, `ROADMAP.md`)
- QA/test-plan/acceptance docs
- Installation and packaging docs (macOS, Windows, Linux, DMG/EXE/CI notes)
- CLI/help/keyboard/TUI usage docs
- `CHANGELOG.md`, release notes
- `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`
- `.github/ISSUE_TEMPLATE/*`, `.github/PULL_REQUEST_TEMPLATE.md`
- CI documentation vs `.github/workflows/*` (read-only verification)
- Cover Notion exports if present in repo:
- De-duplicate against repo docs.
- Define one canonical source per topic.
- Add explicit cross-links.
- Prefer repo docs as canonical unless project policy says otherwise.
- Create `docs/NOTION_SYNC.md` stub with import checklist when no Notion export exists locally.

## Runbook

### Step 1: Inventory and Classify (No Edits Yet)

- Capture top-level tree and docs-related subtrees.
- Enumerate docs by category:
- onboarding
- installation
- usage/help
- specs
- tasks/roadmap
- QA
- packaging/release
- contributing/security/license
- changelog
- notion-export
- Build a working map:
- `Doc -> Purpose -> Owner (if known) -> Last updated signal -> Conflicts/duplicates`
- Create or update `docs/DOC_INDEX.md` with every doc file and a 1-2 line description.

### Step 2: Establish Ground Truth (Read-Only Verification)

- Validate claims against code/config/scripts/tests:
- features and workflows
- CLI flags and outputs
- config keys and paths
- shortcuts and navigation
- build/packaging behavior
- naming and version references
- Mark unverifiable claims as `UNVERIFIED` and add TODOs.

### Step 3: Unify Consistency

- Normalize product naming and terminology.
- Normalize paths, commands, and binaries.
- Normalize version references and avoid stale pinned values unless intentional.
- Consolidate keyboard shortcuts into one canonical source.
- Remove duplication by linking to canonical docs.

### Step 4: Update Documentation (Docs-Only)

- Prioritize:

1. `README.md`
2. installation guides
3. QA/release checklist
4. specs and task lists
5. help/usage/keyboard workflow docs

- Write concise, scannable sections.
- Use tables for flags, keybinds, and platform support.
- Replace vague language with explicit steps and expected outcomes.

### Step 5: Add Missing Glue Docs When Needed

- Create if absent and useful:
- `docs/DOC_INDEX.md`
- `docs/KEYBOARD_SHORTCUTS.md`
- `docs/INSTALLATION.md` (or platform splits)
- `docs/QA_RELEASE_CHECKLIST.md`
- `docs/TROUBLESHOOTING.md`
- `docs/ARCHITECTURE_OVERVIEW.md` (do not speculate beyond observed implementation)

### Step 6: Validate Links and Formatting

- Check internal links and anchors.
- Normalize heading structure, lists, tables, and fences.
- Avoid code reformatting; include snippets only where needed.

### Step 7: Produce Final Audit Report (Required)

- Create or update `docs/DOC_AUDIT_REPORT.md` with:
- summary
- file-by-file change log
- drift findings (docs vs code)
- `Known Issue / TODO (requires code)` items
- prioritized next documentation work

## Required Deliverables

1. Updated docs with consistent structure and cross-links.
2. `docs/DOC_INDEX.md`.
3. `docs/DOC_AUDIT_REPORT.md`.
4. `docs/NOTION_SYNC.md` when applicable.

## Acceptance Criteria

- Verify `README.md` quickstart for internal consistency against repo behavior.
- Ensure install instructions match scripts/config and platform notes.
- Ensure QA checklist is actionable and feature-aligned.
- Ensure specs/tasks are current and non-contradictory.
- Ensure docs navigation is clear via `docs/DOC_INDEX.md`.
- Ensure diff contains only documentation files.

## Final Safety Check

- Inspect diff before finishing.
- If any non-doc file changed, revert that file and record a TODO entry in the audit report.
