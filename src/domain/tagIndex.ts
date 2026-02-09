import { TagIndexEntry } from "./models";

export const MAX_TAG_LENGTH = 24;

export function normalizeTag(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withoutHash = trimmed.replace(/^#+/, "");
  const lowered = withoutHash.toLowerCase();
  const normalized = lowered.replace(/[^a-z0-9_-]/g, "");
  const truncated = normalized.slice(0, MAX_TAG_LENGTH);
  return truncated.length ? truncated : null;
}

export function normalizeTagQuery(raw: string): string {
  const trimmed = raw.trim().replace(/^#+/, "");
  const lowered = trimmed.toLowerCase();
  const normalized = lowered.replace(/[^a-z0-9_-]/g, "");
  return normalized.slice(0, MAX_TAG_LENGTH);
}

export function normalizeTags(tags: string[]): string[] {
  const normalized = tags
    .map((tag) => normalizeTag(tag))
    .filter((tag): tag is string => Boolean(tag));
  const deduped = Array.from(new Set(normalized));
  return deduped.sort((a, b) => a.localeCompare(b));
}

export function normalizeTagsFromInput(input: string): string[] {
  const tokens = input.split(/\s+/).filter(Boolean);
  return normalizeTags(tokens);
}

export function normalizeTagIndex(
  tagIndex: Record<string, TagIndexEntry>
): Record<string, TagIndexEntry> {
  const next: Record<string, TagIndexEntry> = {};
  for (const entry of Object.values(tagIndex)) {
    const normalized = normalizeTag(entry.tagName);
    if (!normalized) continue;
    const existing = next[normalized];
    if (existing) {
      next[normalized] = {
        tagName: normalized,
        usageCount: existing.usageCount + entry.usageCount,
        lastUsedAt: Math.max(existing.lastUsedAt, entry.lastUsedAt)
      };
    } else {
      next[normalized] = {
        tagName: normalized,
        usageCount: entry.usageCount,
        lastUsedAt: entry.lastUsedAt
      };
    }
  }
  return next;
}

export function updateTagIndex(
  tagIndex: Record<string, TagIndexEntry>,
  tags: string[],
  now: number
): Record<string, TagIndexEntry> {
  const next: Record<string, TagIndexEntry> = { ...tagIndex };
  const normalized = normalizeTags(tags);
  for (const tag of normalized) {
    const existing = next[tag];
    if (existing) {
      next[tag] = {
        tagName: existing.tagName,
        usageCount: existing.usageCount + 1,
        lastUsedAt: now
      };
    } else {
      next[tag] = {
        tagName: tag,
        usageCount: 1,
        lastUsedAt: now
      };
    }
  }
  return next;
}

export function rankTags(
  tagIndex: Record<string, TagIndexEntry>,
  query: string
): string[] {
  const normalizedQuery = normalizeTagQuery(query);
  const entries = Object.values(tagIndex);
  const filtered = normalizedQuery
    ? entries.filter((entry) => entry.tagName.startsWith(normalizedQuery))
    : entries;

  return filtered
    .sort((a, b) => {
      if (a.usageCount !== b.usageCount) {
        return b.usageCount - a.usageCount;
      }
      if (a.lastUsedAt !== b.lastUsedAt) {
        return b.lastUsedAt - a.lastUsedAt;
      }
      return a.tagName.localeCompare(b.tagName);
    })
    .map((entry) => entry.tagName);
}
