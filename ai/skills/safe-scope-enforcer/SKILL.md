---
name: safe-scope-enforcer
description: Enforce explicit file-edit boundaries for tasks like docs-only, tests-only, code-only, or custom scopes. Use before and after edits to prevent out-of-scope changes and accidental file mutation.
---

# Safe Scope Enforcer

Prevent scope creep by verifying changed files against allow/deny rules.

## Workflow

1. Select profile:

- `docs-only`
- `tests-only`
- `code-only`
- `custom`

2. Run scope audit on working-tree or staged files.
3. Fail the run if any file violates policy.
4. Review violation list and either:

- revert out-of-scope changes, or
- adjust policy intentionally and rerun.

## Command

```bash
python3 "$CODEX_HOME/skills/safe-scope-enforcer/scripts/scope_enforcer.py" \
  --repo-root . \
  --scope-profile docs-only
```

Custom profile example:

```bash
python3 "$CODEX_HOME/skills/safe-scope-enforcer/scripts/scope_enforcer.py" \
  --repo-root . \
  --scope-profile custom \
  --allow-glob "docs/**/*.md" \
  --allow-glob "README.md" \
  --deny-glob "src/**"
```

## Exit Semantics

- Exit `0`: pass
- Exit `2`: one or more violations
- Exit `1`: invalid arguments/runtime error

## Rules

- Deny rules always win.
- For non-custom profiles, built-in allow rules apply.
- For custom profile, at least one `--allow-glob` is required.

## Fallback Behavior

- If no changed files are detected, pass with explicit message.
- If repository is not a git repo, fail with actionable error.

## References

- Built-in profile globs: `references/profiles.md`
- CI integration examples: `references/ci-usage.md`
