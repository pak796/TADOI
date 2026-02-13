import { normalizeTag } from "./tagIndex";

const PRIORITY_TOKEN_REGEX = /^#?p(\d+)$/i;

export function isPriorityToken(raw: string): { digits: string } | null {
  const match = raw.trim().match(PRIORITY_TOKEN_REGEX);
  if (!match) return null;
  return { digits: match[1] };
}

export function canonicalPriorityTag(digits: string): string {
  return `#p${digits}`;
}

export function normalizePriorityFromTokens(tokens: string[]): string[] {
  let priority: string | undefined;
  const others: string[] = [];
  const seenOthers = new Set<string>();

  for (const token of tokens) {
    const priorityMatch = isPriorityToken(token);
    if (priorityMatch) {
      priority = canonicalPriorityTag(priorityMatch.digits);
      continue;
    }

    const normalized = normalizeTag(token);
    if (!normalized || seenOthers.has(normalized)) {
      continue;
    }

    seenOthers.add(normalized);
    others.push(normalized);
  }

  return priority ? [priority, ...others] : others;
}

export function normalizePriorityTags(tags: string[]): string[] {
  return normalizePriorityFromTokens(tags);
}

export function resolveTaskPriorityTag(tags: string[]): string | undefined {
  let priority: string | undefined;
  for (const tag of tags) {
    const match = isPriorityToken(tag);
    if (!match) continue;
    priority = canonicalPriorityTag(match.digits);
  }
  return priority;
}

export function normalizePriorityFilterValue(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const match = isPriorityToken(raw);
  if (!match) return undefined;
  return canonicalPriorityTag(match.digits);
}

export function formatPriorityForDisplay(raw: string | undefined): string | undefined {
  const normalized = normalizePriorityFilterValue(raw);
  if (!normalized) return undefined;
  const digits = isPriorityToken(normalized)?.digits;
  if (!digits) return undefined;
  return `P${digits}`;
}
