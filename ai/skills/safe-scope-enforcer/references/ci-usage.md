# CI Usage

Example (docs-only pull requests):

```bash
python3 "$CODEX_HOME/skills/safe-scope-enforcer/scripts/scope_enforcer.py" \
  --repo-root "$PWD" \
  --scope-profile docs-only \
  --staged-only
```

If exit code is `2`, fail the CI job and print violations.
