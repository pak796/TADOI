# Notion Sync Runbook

Generated: 2026-03-04
Mode: Local staging (deferred Notion apply)

## Inputs

- `docs/notion/NOTION_SYNC_PAYLOAD.json`
- `docs/notion/NOTION_SYNC_CONFIG.template.json`
- env var from config: `NOTION_TOKEN` (or custom `auth_token_env`)

## Steps

1. Validate payload integrity:
   - `bun run notion:sync:validate`
2. Dry-run deterministic sync (optional, token path):
   - `bun run notion:sync:full:dry`
3. Apply sync via MCP (run only when explicitly requested):
   - For each mapped `page_id`, run `replace_content` from payload markdown.
   - Update properties: `Name`, `date:Date:start`, `date:Date:is_datetime`, `Notes`.
   - Append audit token if missing.
4. Verify TITS coverage on Notion pages:
   - Usage + install pages include TITS command layer quick checks
   - QA pages include `QA-065`..`QA-072`
   - Spec/tasks pages include TITS M1-M3 narrative

5. Verify notes/audit token and metadata:
   - Confirm `Notes` includes `[AUDIT 2026-03-04] v0.4.0 beta docs/version roll-forward staged (local-only)` on all mapped pages.
   - Review `docs/notion/NOTION_SYNC_VERIFY_2026-03-04.json` for title/date/heading/version/notes summary.
   - Validate `bun run notion:sync:validate` returns PASS for payload.

## Fallback (No Notion Write Access)

- Store payload artifact with daily build artifacts.
- Attach this runbook in handoff.
- Apply pages manually when write access is restored.
