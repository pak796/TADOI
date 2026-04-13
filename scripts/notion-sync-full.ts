#!/usr/bin/env bun
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

type PayloadItem = {
  title: string;
  page_id?: string;
  source_file?: string;
  markdown: string;
};

type Payload = {
  generated_at: string;
  items: PayloadItem[];
};

type SyncConfig = {
  auth_token_env?: string;
};

type NotionListResponse<T> = {
  results: T[];
  has_more: boolean;
  next_cursor: string | null;
};

const DEFAULT_PAYLOAD_PATH = "docs/notion/NOTION_SYNC_PAYLOAD.json";
const DEFAULT_CONFIG_PATH = "docs/notion/NOTION_SYNC_CONFIG.template.json";
const DEFAULT_NOTION_VERSION = "2022-06-28";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const validateOnly = args.has("--validate-only");

function toRichText(text: string) {
  if (!text) {
    return [{ type: "text", text: { content: " " } }];
  }

  const chunks: Array<{ type: "text"; text: { content: string } }> = [];
  for (let i = 0; i < text.length; i += 1800) {
    chunks.push({
      type: "text",
      text: { content: text.slice(i, i + 1800) },
    });
  }
  return chunks;
}

function pushLineBlocks(
  blocks: any[],
  type:
    | "paragraph"
    | "heading_1"
    | "heading_2"
    | "heading_3"
    | "quote"
    | "bulleted_list_item"
    | "numbered_list_item",
  text: string,
) {
  const richText = toRichText(text);
  if (type === "heading_1" || type === "heading_2" || type === "heading_3") {
    blocks.push({
      object: "block",
      type,
      [type]: { rich_text: richText },
    });
    return;
  }

  blocks.push({
    object: "block",
    type,
    [type]: { rich_text: richText },
  });
}

function markdownToBlocks(markdown: string): any[] {
  const blocks: any[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");

  let inFence = false;
  let fenceLang = "plain text";
  let fenceBuffer: string[] = [];

  const flushFence = () => {
    if (!fenceBuffer.length) {
      return;
    }
    const code = fenceBuffer.join("\n");
    for (let i = 0; i < code.length; i += 1800) {
      blocks.push({
        object: "block",
        type: "code",
        code: {
          language: fenceLang,
          rich_text: toRichText(code.slice(i, i + 1800)),
        },
      });
    }
    fenceBuffer = [];
  };

  for (const line of lines) {
    const fence = line.match(/^```([a-zA-Z0-9_+-]*)\s*$/);
    if (fence) {
      if (inFence) {
        flushFence();
        inFence = false;
        fenceLang = "plain text";
      } else {
        inFence = true;
        fenceLang = fence[1] || "plain text";
      }
      continue;
    }

    if (inFence) {
      fenceBuffer.push(line);
      continue;
    }

    if (!line.trim()) {
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const type = (
        level === 1 ? "heading_1" : level === 2 ? "heading_2" : "heading_3"
      ) as "heading_1" | "heading_2" | "heading_3";
      pushLineBlocks(blocks, type, heading[2].trim());
      continue;
    }

    const todo = line.match(/^- \[([ xX])\]\s+(.+)$/);
    if (todo) {
      blocks.push({
        object: "block",
        type: "to_do",
        to_do: {
          rich_text: toRichText(todo[2].trim()),
          checked: todo[1].toLowerCase() === "x",
        },
      });
      continue;
    }

    const bullet = line.match(/^- (.+)$/);
    if (bullet) {
      pushLineBlocks(blocks, "bulleted_list_item", bullet[1].trim());
      continue;
    }

    const numbered = line.match(/^\d+\.\s+(.+)$/);
    if (numbered) {
      pushLineBlocks(blocks, "numbered_list_item", numbered[1].trim());
      continue;
    }

    const quote = line.match(/^>\s+(.+)$/);
    if (quote) {
      pushLineBlocks(blocks, "quote", quote[1].trim());
      continue;
    }

    pushLineBlocks(blocks, "paragraph", line.trim());
  }

  if (inFence) {
    flushFence();
  }

  return blocks;
}

async function notionRequest<T>(
  token: string,
  notionVersion: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`https://api.notion.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": notionVersion,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${method} ${path} failed: ${res.status} ${txt}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

async function clearPageContent(
  token: string,
  notionVersion: string,
  pageId: string,
) {
  let cursor: string | null = null;
  do {
    const query = cursor
      ? `?page_size=100&start_cursor=${encodeURIComponent(cursor)}`
      : "?page_size=100";
    const list = await notionRequest<NotionListResponse<{ id: string }>>(
      token,
      notionVersion,
      "GET",
      `/v1/blocks/${pageId}/children${query}`,
    );

    if (!dryRun) {
      for (const block of list.results) {
        await notionRequest(
          token,
          notionVersion,
          "PATCH",
          `/v1/blocks/${block.id}`,
          { archived: true },
        );
      }
    }

    cursor = list.has_more ? list.next_cursor : null;
  } while (cursor);
}

async function appendBlocks(
  token: string,
  notionVersion: string,
  pageId: string,
  blocks: any[],
) {
  if (!blocks.length) {
    return;
  }
  for (let i = 0; i < blocks.length; i += 100) {
    const children = blocks.slice(i, i + 100);
    if (!dryRun) {
      await notionRequest(
        token,
        notionVersion,
        "PATCH",
        `/v1/blocks/${pageId}/children`,
        { children },
      );
    }
  }
}

async function loadJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function main() {
  const payloadPath = resolve(
    process.cwd(),
    process.env.NOTION_SYNC_PAYLOAD_PATH || DEFAULT_PAYLOAD_PATH,
  );
  const configPath = resolve(
    process.cwd(),
    process.env.NOTION_SYNC_CONFIG_PATH || DEFAULT_CONFIG_PATH,
  );

  const payload = await loadJson<Payload>(payloadPath);
  const config = await loadJson<SyncConfig>(configPath);

  const missingPageIds = payload.items
    .filter((item) => !item.page_id)
    .map((item) => item.title);
  if (missingPageIds.length > 0) {
    throw new Error(
      `Missing page_id for payload titles: ${missingPageIds.join(", ")}`,
    );
  }

  if (validateOnly) {
    console.log(`[sync] validation OK: items=${payload.items.length}`);
    return;
  }

  const tokenEnv = config.auth_token_env || "NOTION_TOKEN";
  const token = process.env[tokenEnv];
  if (!token) {
    throw new Error(`Missing Notion token. Set ${tokenEnv} and retry.`);
  }

  const notionVersion = process.env.NOTION_VERSION || DEFAULT_NOTION_VERSION;
  let updated = 0;

  for (const item of payload.items) {
    if (!item.page_id) {
      throw new Error(`Missing page_id for payload title: ${item.title}`);
    }

    const blocks = markdownToBlocks(item.markdown);
    console.log(
      `[sync] ${dryRun ? "plan" : "apply"} ${item.title} -> ${item.page_id} blocks=${blocks.length}`,
    );
    await clearPageContent(token, notionVersion, item.page_id);
    await appendBlocks(token, notionVersion, item.page_id, blocks);
    updated += 1;
  }

  console.log(`[sync] completed: updated=${updated} dry_run=${dryRun}`);
}

main().catch((err) => {
  console.error(
    `[sync] FAILED: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exitCode = 1;
});
