# TADOI Security & Privacy Remediation Plan (2026-02-12)

> Archival note (2026-02-13): This remediation plan references historical audit artifacts. Absolute paths may reference the legacy folder name `TUI_TODO`; current folder name is `TADOI`.

Date: 2026-02-12  
Source audit: `/Users/patrickkazar/Library/CloudStorage/GoogleDrive-pakazar@gmail.com/Other computers/My Computer/Google Drive/CODE PROJECTS/TUI_TODO/docs/audits/tadoi-security-privacy-audit-2026-02-12.md`

## Summary
This backlog maps 1:1 to all non-informational findings in the audit.  
Priorities:
- Now: high-risk and externally visible trust/privacy issues.
- Next: release hardening and deterministic dependency controls.
- Later: low-probability local hardening and observability polish.

## Remediation Backlog (1:1 Mapping)

### SEC-001
- Finding: Unbounded import file size enables memory/CPU denial of service.
- Priority: Now
- Effort: M
- Objective: Bound resource consumption for untrusted import files.
- Proposed changes:
- Add max-size checks before `readFile` for JSON and ICS import paths.
- Introduce configurable defaults (for example, `MAX_IMPORT_BYTES_JSON`, `MAX_IMPORT_BYTES_ICS`).
- Return explicit usage errors when file size exceeds limits.
- Affected files:
- `src/state/backupService.ts`
- `src/state/calendarImportService.ts`
- Regression risk: Medium (may block some valid large files).
- Validation tests:
- Add unit tests that reject oversized import files with deterministic error messages.
- Add boundary tests at `limit-1`, `limit`, `limit+1`.

### PRIV-001
- Finding: ICS export leaks notes/tags/links by default.
- Priority: Now
- Effort: M
- Objective: Make privacy-preserving export behavior the default.
- Proposed changes:
- Add export privacy mode flags:
- `--privacy=minimal` (summary/date only; no notes/tags/links by default).
- `--privacy=full` (current behavior).
- Default CLI behavior to minimal mode.
- Reflect mode in help output and report summary.
- Affected files:
- `src/cli/calendarCommands.ts`
- `src/commands/calendarExport.ts`
- `src/state/calendarExportService.ts`
- `src/calendar/calendarMapper.ts`
- Regression risk: Medium (existing users may rely on current detail-rich export).
- Validation tests:
- Golden fixture tests for minimal vs full mode.
- Ensure URL/description fields are absent in minimal mode.

### SEC-002
- Finding: Imported links can trigger local file/path execution flows with limited friction.
- Priority: Now
- Effort: M
- Objective: Reduce unsafe local execution from untrusted imported content.
- Proposed changes:
- Require confirmation modal for `file:` links and filesystem path links (not only unknown schemes).
- Add source-aware policy: links imported from ICS require confirm-on-open by default.
- Optional setting to disable opening non-http(s) links entirely.
- Affected files:
- `src/domain/taskLinks.ts`
- `src/app/App.tsx`
- `src/calendar/importMapper.ts`
- Regression risk: Medium (extra UX prompts for power users).
- Validation tests:
- Extend key router/App integration tests for path/file confirmation flows.
- Add tests for imported-link source policy behavior.

### SEC-003
- Finding: Windows open path uses `cmd /c start` with untrusted target input.
- Priority: Now
- Effort: M
- Objective: Minimize shell parsing exposure on Windows.
- Proposed changes:
- Introduce stricter target validation/escaping rules for Windows.
- Prefer platform-safe open mechanism where feasible (for example, PowerShell `Start-Process` with explicit argument handling).
- Normalize and reject suspicious control characters before invocation.
- Affected files:
- `src/app/openTarget.ts`
- Regression risk: Medium (Windows behavior differences).
- Validation tests:
- Add Windows-specific command generation tests for special-character targets.
- Verify known-safe URLs/paths still open.

### PRIV-002
- Finding: Backup redaction is partial and may leak metadata.
- Priority: Next
- Effort: M
- Objective: Align redaction behavior with user privacy expectations.
- Proposed changes:
- Add redaction tiers:
- `basic` (current title/notes),
- `strict` (also strips tags/links/external metadata/due fields and sensitive settings).
- Rename current `--redact` semantics in help text for clarity.
- Affected files:
- `src/state/portability.ts`
- `src/commands/export.ts`
- `src/cli/portabilityCommands.ts`
- Regression risk: Low to medium (schema of redacted payload changes).
- Validation tests:
- Snapshot tests per redaction tier.
- Verify strict mode excludes all declared sensitive fields.

### SCM-001
- Finding: Floating `latest` dependencies reduce determinism.
- Priority: Next
- Effort: S
- Objective: Make dependency resolution reproducible and reviewable.
- Proposed changes:
- Replace `"latest"` with explicit semver versions for `@opentui/core` and `@opentui/react`.
- Document update cadence and dependency review checklist.
- Affected files:
- `package.json`
- `README.md` (or `CONTRIBUTING.md`) for dependency policy.
- Regression risk: Low.
- Validation tests:
- Lockfile refresh and verify `bun install --frozen-lockfile` reproducibility in CI.

### REL-001
- Finding: Actions are tag-pinned, not commit-SHA pinned.
- Priority: Next
- Effort: S
- Objective: Harden CI/CD against upstream action tag drift.
- Proposed changes:
- Pin all third-party GitHub Actions by full commit SHA.
- Maintain a periodic action-update process.
- Affected files:
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `.github/workflows/package-macos.yml`
- Regression risk: Low.
- Validation tests:
- Workflow lint/check after pin updates.
- One dry run of each workflow path.

### REL-002
- Finding: Signing scripts can skip with exit success when secrets are missing.
- Priority: Next
- Effort: S
- Objective: Prevent accidental unsigned production artifacts.
- Proposed changes:
- Add strict mode env (for example `TADOI_REQUIRE_SIGNING=1`) for release workflows.
- In release workflows, fail build if signing variables/certs are missing.
- Keep optional skip behavior only for local/dev packaging commands.
- Affected files:
- `packaging/macos/sign-notarize.sh`
- `packaging/windows/sign.ps1`
- `.github/workflows/release.yml`
- Regression risk: Low.
- Validation tests:
- CI tests for both strict and non-strict execution paths.

### REL-003
- Finding: Typecheck currently fails while release assumes pass.
- Priority: Next
- Effort: M
- Objective: Restore gate integrity and release confidence.
- Proposed changes:
- Fix TypeScript issues in:
- `src/state/calendarExportService.test.ts`
- `src/state/calendarImportService.ts`
- Add pre-merge check enforcing clean typecheck locally/CI.
- Affected files:
- `src/state/calendarExportService.test.ts`
- `src/state/calendarImportService.ts`
- `.github/workflows/ci.yml` (if adding explicit fail-fast annotation/reporting).
- Regression risk: Low to medium (typing refactors may impact tests).
- Validation tests:
- `bun run typecheck` must pass.
- Targeted calendar tests must pass.

### PRIV-003
- Finding: Startup logs expose absolute filesystem paths.
- Priority: Later
- Effort: S
- Objective: Reduce environment disclosure in shared output.
- Proposed changes:
- Add privacy log mode or default to path redaction (`~/...` style).
- Keep full-path logging behind debug env flag only.
- Affected files:
- `src/tui/runTui.tsx`
- `src/brand/brand.ts` (if adding new env var constant).
- Regression risk: Low.
- Validation tests:
- Snapshot/log tests for default and debug path modes.

### SEC-004
- Finding: Deterministic `.tmp` write path without additional hardening controls.
- Priority: Later
- Effort: M
- Objective: Improve local write robustness.
- Proposed changes:
- Use unique temp file names in same directory (random suffix).
- Add optional fsync for durability-sensitive flows.
- Keep atomic rename semantics.
- Affected files:
- `src/state/persistence.ts`
- Regression risk: Low to medium (platform filesystem nuances).
- Validation tests:
- Concurrency simulation tests with parallel writes.
- Ensure no partial writes after interrupted operations.

### PRIV-004
- Finding: Settings read failures are silent.
- Priority: Later
- Effort: S
- Objective: Improve operator visibility for config integrity issues.
- Proposed changes:
- Distinguish parse errors from missing files.
- Return warning metadata to UI startup banner when settings parse fails.
- Affected files:
- `src/settings/settings.ts`
- `src/tui/runTui.tsx`
- Regression risk: Low.
- Validation tests:
- Invalid settings fixture should emit warning and fallback predictably.

### SCM-002
- Finding: Known low-severity transitive vulnerability (`diff`) present.
- Priority: Later (or Next if easy upgrade path appears)
- Effort: S
- Objective: Track and remediate advisory when upstream supports safe version.
- Proposed changes:
- Monitor upstream `@opentui/core` dependency chain for patched `diff` range.
- Upgrade lockfile and verify regression tests.
- Affected files:
- `bun.lock`
- `package.json` (if version adjustments required).
- Regression risk: Low.
- Validation tests:
- `bun audit` should report zero known vulnerabilities for this advisory after patch.

## Cross-Cutting Implementation Notes
- Keep changes staged by finding ID to simplify review and rollback.
- Add concise changelog notes for any user-visible privacy behavior change.
- Update CLI help text and docs whenever default behavior changes.
- Maintain backward-compatibility toggles when defaults become stricter.

## Validation Matrix After Remediation
Required green checks:
- `bun audit` (or documented accepted residual risks).
- `bun run test`.
- `bun run typecheck`.
- Manual smoke:
- open safe HTTP link,
- confirm prompt for file/path/unknown scheme,
- export ICS in minimal and full privacy modes,
- import oversized files rejected with clear errors,
- release workflow strict-signing path fails when signing secrets are absent.

## Rollout Order
1. Now: `SEC-001`, `PRIV-001`, `SEC-002`, `SEC-003`
2. Next: `PRIV-002`, `SCM-001`, `REL-001`, `REL-002`, `REL-003`
3. Later: `PRIV-003`, `SEC-004`, `PRIV-004`, `SCM-002`
