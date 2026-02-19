import type { KeyEvent } from "@opentui/core";
import type { TagFilter } from "../domain/models";
import {
  normalizeTagFilter,
  normalizeTagToken,
  type TagFilterBucket
} from "../domain/tagFilter";

export type TagFilterInlineSuggestion = { full: string; remainder: string } | null | undefined;

type TagFilterPanelKey = Pick<KeyEvent, "name" | "sequence" | "ctrl" | "shift">;

export type TagFilterPanelHotkeyAction =
  | { type: "cycleBucket"; step: 1 | -1 }
  | { type: "setBucket"; bucket: TagFilterBucket }
  | { type: "clearDraft" }
  | { type: "closePanel" }
  | { type: "applyWithInputCandidate" }
  | { type: "acceptInlineSuggestion" }
  | { type: "removeLastDraftTag" }
  | { type: "addInputCandidate" };

export function isEnterLikeKey(key: Pick<KeyEvent, "name" | "sequence">): boolean {
  return (
    key.name === "return" ||
    key.name === "enter" ||
    key.sequence === "\r" ||
    key.sequence === "\n"
  );
}

export function isTagFilterPanelApplyKey(
  key: Pick<KeyEvent, "name" | "sequence" | "ctrl">
): boolean {
  const ctrlEnterFromModifyOtherKeys = key.sequence === "\u001b[13;5u";
  const ctrlEnter = key.ctrl && isEnterLikeKey(key);
  const ctrlS =
    key.ctrl &&
    (key.name === "s" || key.name === "S" || key.sequence === "s" || key.sequence === "S");
  return ctrlEnterFromModifyOtherKeys || ctrlEnter || ctrlS;
}

export function resolveTagFilterPanelHotkeyAction(params: {
  key: TagFilterPanelKey;
  hasInlineSuggestion: boolean;
  inputValue: string;
}): TagFilterPanelHotkeyAction | null {
  const { key, hasInlineSuggestion, inputValue } = params;
  const inputIsEmpty = inputValue.length === 0;

  if (key.name === "tab") {
    return { type: "cycleBucket", step: key.shift ? -1 : 1 };
  }
  if (key.name === "right" && hasInlineSuggestion) {
    return { type: "acceptInlineSuggestion" };
  }
  if (inputIsEmpty && (key.name === "left" || key.name === "up")) {
    return { type: "cycleBucket", step: -1 };
  }
  if (inputIsEmpty && (key.name === "down" || key.name === "right")) {
    return { type: "cycleBucket", step: 1 };
  }
  if (key.ctrl && key.name === "l") {
    return { type: "clearDraft" };
  }
  if (key.name === "escape") {
    return { type: "closePanel" };
  }
  if (isTagFilterPanelApplyKey(key)) {
    return { type: "applyWithInputCandidate" };
  }
  if (key.name === "backspace" && inputIsEmpty) {
    return { type: "removeLastDraftTag" };
  }
  if (isEnterLikeKey(key)) {
    return { type: "addInputCandidate" };
  }

  return null;
}

export function resolveTagFilterInputCandidateValue(
  inputValue: string,
  inlineSuggestion: TagFilterInlineSuggestion
): string {
  return inlineSuggestion?.full ?? inputValue;
}

export function addTagToTagFilterDraftBucket(
  current: TagFilter | undefined,
  rawTag: string,
  bucket: TagFilterBucket
): TagFilter | undefined {
  const normalizedTag = normalizeTagToken(rawTag);
  if (!normalizedTag) return normalizeTagFilter(current);

  const next: TagFilter = {
    all: [...(current?.all ?? [])],
    any: [...(current?.any ?? [])],
    none: [...(current?.none ?? [])]
  };
  const bucketTags = new Set(next[bucket] ?? []);
  bucketTags.add(normalizedTag);
  next[bucket] = Array.from(bucketTags);
  return normalizeTagFilter(next);
}

export function resolveTagFilterDraftForApplyFromInput(params: {
  draft: TagFilter | undefined;
  includeInputCandidate: boolean;
  inputValue: string;
  inlineSuggestion: TagFilterInlineSuggestion;
  bucket: TagFilterBucket;
}): TagFilter | undefined {
  if (!params.includeInputCandidate) return params.draft;
  return addTagToTagFilterDraftBucket(
    params.draft,
    resolveTagFilterInputCandidateValue(params.inputValue, params.inlineSuggestion),
    params.bucket
  );
}
