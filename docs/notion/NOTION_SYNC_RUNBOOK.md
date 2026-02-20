# Notion Sync Runbook

Generated: 2026-02-20
Mode: offline payload + deterministic apply

## Inputs
- `docs/notion/NOTION_SYNC_PAYLOAD.json`
- `docs/notion/NOTION_SYNC_CONFIG.template.json`
- env var from config: `NOTION_TOKEN` (or custom `auth_token_env`)

## Steps
1. Validate payload integrity:
   - `bun run notion:sync:validate`
2. Dry-run deterministic sync:
   - `bun run notion:sync:full:dry`
3. Apply sync:
   - `bun run notion:sync:full`
4. Verify TITS coverage on Notion pages:
   - Usage + install pages include TITS command layer quick checks
   - QA pages include `QA-065`..`QA-072`
   - Spec/tasks pages include TITS M1-M3 narrative

## Fallback (No Notion Write Access)
- Store payload artifact with daily build artifacts.
- Attach this runbook in handoff.
- Apply pages manually when write access is restored.
