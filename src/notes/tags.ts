import { normalizeTag, rankTags } from "../domain/tagIndex";
import type { NoteWarning } from "./types";

export type ParsedNoteTags = {
  tags: string[];
  warnings: Array<Pick<NoteWarning, "code" | "message" | "raw" | "normalized">>;
};

const INLINE_TAG_PATTERN = /(^|[^A-Za-z0-9_])#([A-Za-z0-9][A-Za-z0-9_/-]*)/g;

function stripCodeFences(markdown: string): string {
  return markdown.replace(/```[\s\S]*?```/g, " ");
}

function normalizeNestedTag(rawToken: string): string | null {
  const raw = rawToken.trim().replace(/^#+/, "");
  if (!raw) return null;
  const parts = raw.split("/").map((part) => part.trim()).filter((part) => part.length > 0);
  if (parts.length === 0) return null;

  if (parts.length === 1) {
    return normalizeTag(parts[0]);
  }

  const normalizedParts: string[] = [];
  for (const part of parts) {
    const normalized = normalizeTag(part);
    if (!normalized) {
      return null;
    }
    normalizedParts.push(normalized);
  }

  return normalizedParts.join("/");
}

function normalizeTagWithWarning(rawToken: string): {
  normalized: string | null;
  warning?: Pick<NoteWarning, "code" | "message" | "raw" | "normalized">;
} {
  const raw = rawToken.trim().replace(/^#+/, "");
  const normalized = normalizeNestedTag(raw);

  if (!normalized) {
    return {
      normalized: null,
      warning: {
        code: "tag_normalization",
        message: `Ignored invalid tag: ${rawToken}`,
        raw: rawToken
      }
    };
  }

  if (raw !== normalized) {
    return {
      normalized,
      warning: {
        code: "tag_normalization",
        message: `Normalized tag ${raw} -> ${normalized}`,
        raw,
        normalized
      }
    };
  }

  return { normalized };
}

function parseInlineTags(markdown: string): string[] {
  const matches: string[] = [];
  const source = stripCodeFences(markdown);
  INLINE_TAG_PATTERN.lastIndex = 0;
  let match = INLINE_TAG_PATTERN.exec(source);
  while (match) {
    const token = match[2];
    if (token) {
      matches.push(token);
    }
    match = INLINE_TAG_PATTERN.exec(source);
  }
  return matches;
}

export function parseNoteTags(options: {
  markdown: string;
  frontmatterTags?: string[];
}): ParsedNoteTags {
  const warnings: Array<Pick<NoteWarning, "code" | "message" | "raw" | "normalized">> = [];
  const tags = new Set<string>();

  const candidates = [
    ...(options.frontmatterTags ?? []),
    ...parseInlineTags(options.markdown)
  ];

  for (const rawCandidate of candidates) {
    const result = normalizeTagWithWarning(rawCandidate);
    if (result.warning) {
      warnings.push(result.warning);
    }
    if (result.normalized) {
      tags.add(result.normalized);
    }
  }

  return {
    tags: Array.from(tags).sort((left, right) => left.localeCompare(right)),
    warnings
  };
}

export function noteTagMatchesFilter(noteTag: string, filterTag: string): boolean {
  const normalizedFilter = normalizeNestedTag(filterTag);
  if (!normalizedFilter) return false;
  return noteTag === normalizedFilter || noteTag.startsWith(`${normalizedFilter}/`);
}

export function rankNoteTags(options: {
  tags: string[];
  query: string;
}): string[] {
  const now = Date.now();
  const tagIndex = Object.fromEntries(
    options.tags.map((tag, index) => [
      tag,
      {
        tagName: tag,
        usageCount: 1,
        lastUsedAt: now - index
      }
    ])
  );
  return rankTags(tagIndex, options.query);
}

export function expandHierarchicalTagKeys(tag: string): string[] {
  const parts = tag.split("/").map((part) => part.trim()).filter((part) => part.length > 0);
  if (parts.length === 0) return [];

  const keys: string[] = [];
  for (let index = 0; index < parts.length; index += 1) {
    keys.push(parts.slice(0, index + 1).join("/"));
  }
  return keys;
}
