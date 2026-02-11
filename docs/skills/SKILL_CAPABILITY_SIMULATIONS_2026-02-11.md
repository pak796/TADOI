# Skill Capability Simulations (2026-02-11)

## Summary

- Total simulations: 24
- Scenario prompts (3 per skill): 18
- Failure-mode prompts (1 per skill): 6
- Global scenario pass rate: 100.00%

## By Skill

| Skill | Scenario Pass | Failure Pass | Overall Pass Rate |
|---|---:|---:|---:|
| `spec-task-drift-guard` | 3/3 | 1/1 | 100.00% |
| `release-readiness-gate` | 3/3 | 1/1 | 100.00% |
| `keybind-source-of-truth` | 3/3 | 1/1 | 100.00% |
| `safe-scope-enforcer` | 3/3 | 1/1 | 100.00% |
| `session-handoff-capture` | 3/3 | 1/1 | 100.00% |
| `atomic-change-planner` | 3/3 | 1/1 | 100.00% |

## Scenario Details

### `spec-task-drift-guard`

- `S1` (scenario) PASS: Scan real repo docs vs code and produce drift findings.
  Evidence: Wrote 152 findings to /var/folders/mq/sh4dvnjd5g5fqs2bs4s53vwc0000gn/T/skill-sim-a7g_gut3/spec_real.json and /var/folders/mq/sh4dvnjd5g5fqs2bs4s53vwc0000gn/T/skill-sim-a7g_gut3/spec_real.md
- `S2` (scenario) PASS: Detect verified claim when docs and code agree on a CLI flag.
  Evidence: findings=1
- `S3` (scenario) PASS: Flag missing evidence when docs claim unsupported flag.
  Evidence: findings=1
- `F1` (failure) PASS: Failure mode: no documentation files match input globs.
  Evidence: No documentation files matched --doc-glob patterns.

### `release-readiness-gate`

- `S1` (scenario) PASS: Run preflight gate on real repo and emit complete check set.
  Evidence: overall=fail
- `S2` (scenario) PASS: Pass preflight on complete release fixture.
  Evidence: overall=pass
- `S3` (scenario) PASS: Pass strict RC mode when all required artifacts exist.
  Evidence: overall=pass
- `F1` (failure) PASS: Failure mode: malformed release fixture with missing required files/version.
  Evidence: Overall: fail; blocking_failures=7

### `keybind-source-of-truth`

- `S1` (scenario) PASS: Extract canonical keybindings from real router/docs.
  Evidence: canonical=61
- `S2` (scenario) PASS: Detect both missing_in_docs and missing_in_code on mismatched fixture.
  Evidence: missing_docs=2, missing_code=2
- `S3` (scenario) PASS: Produce zero drift on aligned keybind fixture.
  Evidence: aligned fixture
- `F1` (failure) PASS: Failure mode: missing router path should fail fast.
  Evidence: Router path not found: /private/var/folders/mq/sh4dvnjd5g5fqs2bs4s53vwc0000gn/T/skill-sim-a7g_gut3/key_fixture_aligned/src/app/NOPE.ts

### `safe-scope-enforcer`

- `S1` (scenario) PASS: Pass docs-only when only docs files are changed.
  Evidence: Scope check passed for 1 changed file(s).
- `S2` (scenario) PASS: Return exit code 2 when src file violates docs-only policy.
  Evidence: Scope check failed with 1 violation(s): - src/a.ts: Matched deny pattern (deny)
- `S3` (scenario) PASS: Pass custom profile when changed files match explicit allow globs.
  Evidence: Scope check passed for 2 changed file(s).
- `F1` (failure) PASS: Failure mode: custom profile without allow globs should fail.
  Evidence: custom profile requires at least one --allow-glob

### `session-handoff-capture`

- `S1` (scenario) PASS: Generate handoff with git status and commit sections in real repo.
  Evidence: len=2179
- `S2` (scenario) PASS: Handle non-git repository with explicit fallback warning.
  Evidence: warning present
- `S3` (scenario) PASS: Respect include-git-log parameter in output.
  Evidence: short log heading present
- `F1` (failure) PASS: Failure mode: invalid output path should return non-zero safely.
  Evidence: Traceback (most recent call last):   File "/Users/patrickkazar/.codex/skills/session-handoff-capture/scripts/handoff_capture.py", line 127, in <module>     raise SystemExit(main())   File "/Users/patrickkazar/.codex/skil...

### `atomic-change-planner`

- `S1` (scenario) PASS: Create one patch per numbered objective.
  Evidence: patches=3
- `S2` (scenario) PASS: Fallback to paragraph splitting for unstructured requests.
  Evidence: patches=1
- `S3` (scenario) PASS: Enforce max-patches cap on large objective lists.
  Evidence: patches=3
- `F1` (failure) PASS: Failure mode: empty request file should fail with clear message.
  Evidence: Request file is empty.
