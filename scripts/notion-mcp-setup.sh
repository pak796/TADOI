#!/usr/bin/env bash
set -euo pipefail

NOTION_URL="https://mcp.notion.com/mcp"
DO_LOGIN=0
DO_RESET=0
QUIET=0

usage() {
  cat <<USAGE
Usage: scripts/notion-mcp-setup.sh [--login] [--reset] [--quiet]

Options:
  --login   Run 'codex mcp login notion' after ensuring config.
  --reset   Remove and re-add Notion MCP before optional login.
  --quiet   Minimize non-error output.

Behavior:
  1) Ensures Notion MCP server is configured at:
       ${NOTION_URL}
  2) Leaves existing auth untouched by default.
  3) Only re-auths when --login is provided.
USAGE
}

log() {
  if [[ "$QUIET" -eq 0 ]]; then
    printf '%s\n' "$*"
  fi
}

for arg in "$@"; do
  case "$arg" in
    --login) DO_LOGIN=1 ;;
    --reset) DO_RESET=1 ;;
    --quiet) QUIET=1 ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown option: %s\n\n' "$arg" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if ! command -v codex >/dev/null 2>&1; then
  printf 'Error: codex CLI not found in PATH.\n' >&2
  exit 1
fi

if [[ "$DO_RESET" -eq 1 ]]; then
  log "[notion-mcp] Reset requested: removing existing notion MCP server (if any)."
  codex mcp remove notion >/dev/null 2>&1 || true
fi

if codex mcp get notion >/tmp/notion_mcp_get.out 2>/tmp/notion_mcp_get.err; then
  if ! rg -q "url: ${NOTION_URL}" /tmp/notion_mcp_get.out; then
    log "[notion-mcp] Existing notion MCP URL differs. Recreating with expected URL."
    codex mcp remove notion >/dev/null 2>&1 || true
    codex mcp add notion --url "${NOTION_URL}"
  else
    log "[notion-mcp] notion MCP server already configured with expected URL."
  fi
else
  log "[notion-mcp] notion MCP server not configured. Adding it now."
  codex mcp add notion --url "${NOTION_URL}"
fi

log "[notion-mcp] Current server configuration:"
codex mcp get notion

if [[ "$DO_LOGIN" -eq 1 ]]; then
  log "[notion-mcp] Starting OAuth login flow for notion MCP..."
  codex mcp login notion
  log "[notion-mcp] Login command completed."
else
  log "[notion-mcp] Skipping login. Use --login only when auth is revoked/expired."
fi

log "[notion-mcp] Done."
