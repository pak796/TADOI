# Notion Sync Runbook

Generated: 2026-02-13

## Inputs
- `docs/notion/NOTION_SYNC_PAYLOAD.json`
- `docs/notion/NOTION_SYNC_CONFIG.template.json`
- env var from config: `NOTION_TOKEN` (or custom `auth_token_env`)

## Steps
1. Validate payload integrity:
   - `bun run notion:sync:validate`
2. Dry-run the deterministic sync:
   - `bun run notion:sync:full:dry`
3. Apply the sync:
   - `bun run notion:sync:full`
4. Verify the following pages render correctly:
   - Installation Guide
   - QA Guide
   - User Guide (README)
   - Release Checklist
   - QA Smoke/Black Box/Regression docs

## Notes
- If Notion write access is unavailable, store the payload alongside daily build artifacts and send to the docs owner.
- Avoid syncing older versioned docs unless explicitly requested.
