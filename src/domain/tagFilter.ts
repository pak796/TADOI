import { Filters, TagFilter } from "./models";
import { isPriorityToken } from "./priorityTags";
import { formatTagForDisplay, normalizeTag, normalizeTags } from "./tagIndex";

export type TagFilterBucket = "all" | "any" | "none";

export function normalizeTagToken(tag: string): string | undefined {
  const normalized = normalizeTag(tag);
  if (!normalized || isPriorityToken(normalized)) {
    return undefined;
  }
  return normalized;
}

function normalizeBucket(tags: string[] | undefined): string[] | undefined {
  if (!Array.isArray(tags)) return undefined;
  const normalized = normalizeTags(tags);
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeTagFilter(tagFilter?: TagFilter): TagFilter | undefined {
  if (!tagFilter) return undefined;
  const normalized: TagFilter = {
    all: normalizeBucket(tagFilter.all),
    any: normalizeBucket(tagFilter.any),
    none: normalizeBucket(tagFilter.none)
  };
  return normalized.all || normalized.any || normalized.none ? normalized : undefined;
}

export function isEmptyTagFilter(tagFilter?: TagFilter): boolean {
  return !normalizeTagFilter(tagFilter);
}

export function stripPriorityTokensFromTagFilter(tagFilter?: TagFilter): TagFilter | undefined {
  const normalized = normalizeTagFilter(tagFilter);
  if (!normalized) return undefined;

  const stripBucket = (bucket: string[] | undefined): string[] | undefined => {
    if (!bucket) return undefined;
    const filtered = bucket.filter((tag) => !isPriorityToken(tag));
    return filtered.length > 0 ? filtered : undefined;
  };

  const stripped: TagFilter = {
    all: stripBucket(normalized.all),
    any: stripBucket(normalized.any),
    none: stripBucket(normalized.none)
  };

  return stripped.all || stripped.any || stripped.none ? stripped : undefined;
}

/*
 * Tag precedence:
 * 1) If filters.tagFilter exists and is non-empty, it defines matching.
 * 2) Else if filters.tag exists, treat it as boolean ALL for compatibility.
 * 3) Else there is no tag constraint.
 */
export function resolveEffectiveTagFilter(filters: Filters): TagFilter | undefined {
  const normalizedBoolean = stripPriorityTokensFromTagFilter(filters.tagFilter);
  if (normalizedBoolean) {
    return normalizedBoolean;
  }
  const legacyTag = filters.tag ? normalizeTagToken(filters.tag) : undefined;
  return legacyTag ? { all: [legacyTag] } : undefined;
}

export function matchesTagFilter(taskTags: string[], filters: Filters): boolean {
  const activeFilter = resolveEffectiveTagFilter(filters);
  if (!activeFilter) return true;

  const tags = new Set(normalizeTags(taskTags));

  const none = activeFilter.none ?? [];
  if (none.some((tag) => tags.has(tag))) {
    return false;
  }

  const all = activeFilter.all ?? [];
  if (all.some((tag) => !tags.has(tag))) {
    return false;
  }

  const any = activeFilter.any ?? [];
  if (any.length > 0 && !any.some((tag) => tags.has(tag))) {
    return false;
  }

  return true;
}

export function formatTagFilterBooleanSummary(tagFilter?: TagFilter): string | undefined {
  const normalized = stripPriorityTokensFromTagFilter(tagFilter);
  if (!normalized) return undefined;

  const parts: string[] = [];
  for (const tag of normalized.all ?? []) {
    parts.push(`+${formatTagForDisplay(tag)}`);
  }
  for (const tag of normalized.any ?? []) {
    parts.push(`~${formatTagForDisplay(tag)}`);
  }
  for (const tag of normalized.none ?? []) {
    parts.push(`-${formatTagForDisplay(tag)}`);
  }
  return parts.length > 0 ? parts.join(" ") : undefined;
}
