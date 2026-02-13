# Notion Sync Instructions

Verified as of 2026-02-13.

This repo treats local docs as the canonical source. Sync Notion pages from the latest Markdown files.

## Inputs
- `docs/notion/NOTION_SYNC_CONFIG.template.json`
- `docs/notion/NOTION_SYNC_PAYLOAD.json`

## Option A: Notion MCP (recommended in Codex)
1. Open the target page by ID.
2. Replace the page content with the mapped doc contents from payload.
3. Update page title to match payload `title`.
4. Update `Date` property to today (if present).

## Option B: n8n
1. Create a workflow that accepts `NOTION_SYNC_PAYLOAD.json`.
2. For each page item:
   - If `page_id` is empty, stop and log for manual assignment.
   - Replace existing blocks with Markdown content.
   - Update page title and date properties.
3. Log run output and store with build artifacts.

## Required Mapping
Each payload item must include:
- `source_file`
- `title`
- `page_id` (Notion page UUID)
- `markdown`

## Safety
- Do not sync stale versioned docs (v0.3.5 and earlier) unless explicitly requested.
- Prefer updating existing pages over creating duplicates.
