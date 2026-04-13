# Matching Rules

## Claim Priorities

1. CLI flags (for example `--mode`, `--target`)
2. Keyboard shortcuts (for example `Ctrl+S`, `Esc`, `Enter`)
3. File path claims (for example `packaging/macos/build-dmg.sh`)
4. Build/test commands

## Verification Strategy

- Attempt exact token match first.
- Fall back to normalized match:
  - lowercase
  - backticks removed
  - `escape` normalized to `esc`
  - `return` normalized to `enter`
- Accept evidence from code, tests, config, and scripts.

## Severity Guidance

- `high`: CLI/installation/security/release claims
- `medium`: workflow/keybind claims
- `low`: naming/wording drift without behavioral impact
