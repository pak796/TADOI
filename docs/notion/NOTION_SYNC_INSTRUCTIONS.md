# Notion Sync Instructions

Verified as of 2026-03-03.

This repo treats local docs as canonical source. Build payload from current Markdown, then apply with Notion MCP when explicitly requested.

## Inputs
- `docs/notion/NOTION_SYNC_CONFIG.template.json`
- `docs/notion/NOTION_SYNC_PAYLOAD.json`

## Option A: Notion MCP (recommended in Codex)
1. Complete one-time MCP auth in browser if prompted (`bun run notion:mcp:login`).
2. Open target page by `page_id` from payload.
3. Replace page content with payload `markdown`.
4. Update properties:
   - `Name` = payload `title`
   - `date:Date:start` = apply date
   - `date:Date:is_datetime` = `0`
   - `Notes` = existing + audit token
5. Read back page and verify heading + properties.

## Option B: n8n
1. Create a workflow that accepts `NOTION_SYNC_PAYLOAD.json`.
2. For each item:
   - Ensure `page_id` exists.
   - Replace existing blocks with `markdown` blocks.
   - Update page title/date properties.
3. Save run log with automation artifacts.

## Required Mapping Fields
- `source_file`
- `title`
- `page_id`
- `markdown`

## Safety
- Do not sync stale historical docs unless explicitly requested.
- Prefer updating existing pages; avoid duplicate page creation.
- Validate payload before apply: `bun run notion:sync:validate`.
