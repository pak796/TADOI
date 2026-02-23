# Notion Sync Instructions

Verified as of 2026-02-21.

This repo treats local docs as canonical source. Stage Notion updates from current Markdown via payload, then apply only when explicitly requested.

## Inputs
- `docs/notion/NOTION_SYNC_CONFIG.template.json`
- `docs/notion/NOTION_SYNC_PAYLOAD.json`

## Option A: Notion MCP (recommended in Codex)
1. Open target page by `page_id` from payload.
2. Replace page content with payload `markdown`.
3. Update page title to payload `title`.
4. Update Date property to current day, if present.

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
