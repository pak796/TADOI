import { normalizeTags } from "../domain/tagIndex";
import { normalizeTagFilter } from "../domain/tagFilter";
import {
  formatDateToLocalIso,
  parseLocalIsoToDate
} from "../domain/recurrence/rruleAdapter";
import type { TaskLinkKind, TaskLinkSource, TaskStatus } from "../domain/models";
import type { LoadedData } from "./persistence";

export type ValidationMode = "minimal" | "strict";

export type ValidationResult =
  | { ok: true; data: LoadedData }
  | { ok: false; errors: string[] };

const VALID_STATUS = new Set<TaskStatus>(["open", "done", "archived"]);
const VALID_TASK_LINK_KINDS = new Set<TaskLinkKind>(["url", "path"]);
const VALID_TASK_LINK_SOURCES = new Set<TaskLinkSource>(["manual", "calendar_import"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function normalizeLocalIso(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = parseLocalIsoToDate(value);
  if (!parsed) return undefined;
  return formatDateToLocalIso(parsed);
}

export function validatePersistedState(
  input: unknown,
  mode: ValidationMode = "strict"
): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { ok: false, errors: ["Persisted state must be an object"] };
  }

  const schemaVersion = input.schemaVersion;
  if (!isFiniteNumber(schemaVersion)) {
    errors.push("schemaVersion must be a number");
  }

  const tasks = input.tasks;
  if (!Array.isArray(tasks)) {
    errors.push("tasks must be an array");
  }

  const tagIndex = input.tagIndex;
  if (tagIndex !== undefined && !isRecord(tagIndex)) {
    errors.push("tagIndex must be an object when present");
  }

  const savedViews = input.savedViews;
  if (savedViews !== undefined && !Array.isArray(savedViews)) {
    errors.push("savedViews must be an array when present");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const normalized: LoadedData = {
    schemaVersion: schemaVersion as number,
    tasks: tasks as LoadedData["tasks"],
    tagIndex: (tagIndex as LoadedData["tagIndex"]) ?? {},
    savedViews: Array.isArray(savedViews) ? (savedViews as LoadedData["savedViews"]) : []
  };

  if (mode === "minimal") {
    return { ok: true, data: normalized };
  }

  const seenIds = new Set<string>();
  for (const task of normalized.tasks) {
    if (!isRecord(task)) {
      errors.push("task entry must be an object");
      continue;
    }

    if (typeof task.id !== "string" || task.id.trim().length === 0) {
      errors.push("task.id must be a non-empty string");
    } else if (seenIds.has(task.id)) {
      errors.push(`task.id must be unique (${task.id})`);
    } else {
      seenIds.add(task.id);
    }

    if (!VALID_STATUS.has(task.status as TaskStatus)) {
      errors.push(`task.status must be open|done|archived (${String(task.status)})`);
    }

    if (!isFiniteNumber(task.createdAt)) {
      errors.push(`task.createdAt must be a number (${String(task.id)})`);
    }

    if (!isFiniteNumber(task.updatedAt)) {
      errors.push(`task.updatedAt must be a number (${String(task.id)})`);
    }

    if (task.dueAt !== undefined && !isFiniteNumber(task.dueAt)) {
      errors.push(`task.dueAt must be a number when present (${String(task.id)})`);
    }

    if (task.closedAt !== undefined && !isFiniteNumber(task.closedAt)) {
      errors.push(`task.closedAt must be a number when present (${String(task.id)})`);
    }

    if (task.recurrence !== undefined) {
      if (!isRecord(task.recurrence)) {
        errors.push(`task.recurrence must be an object when present (${String(task.id)})`);
      } else {
        if (typeof task.recurrence.series_id !== "string" || task.recurrence.series_id.trim().length === 0) {
          errors.push(`task.recurrence.series_id must be a non-empty string (${String(task.id)})`);
        }
        if (typeof task.recurrence.rrule !== "string" || task.recurrence.rrule.trim().length === 0) {
          errors.push(`task.recurrence.rrule must be a non-empty string (${String(task.id)})`);
        }
        const normalizedDtstart = normalizeLocalIso(task.recurrence.dtstart);
        if (!normalizedDtstart) {
          errors.push(`task.recurrence.dtstart must be a valid local ISO timestamp (${String(task.id)})`);
        } else if (task.recurrence.dtstart !== normalizedDtstart) {
          errors.push(`task.recurrence.dtstart must be normalized local ISO (${String(task.id)})`);
        }
        if (task.recurrence.exdates !== undefined) {
          if (!Array.isArray(task.recurrence.exdates)) {
            errors.push(`task.recurrence.exdates must be a string array (${String(task.id)})`);
          } else {
            const normalizedExdates = Array.from(
              new Set(
                task.recurrence.exdates
                  .map((exdate: unknown) => normalizeLocalIso(exdate))
                  .filter(Boolean) as string[]
              )
            ).sort((left, right) => left.localeCompare(right));
            const rawExdates = task.recurrence.exdates as unknown[];
            if (
              normalizedExdates.length !== rawExdates.length ||
              normalizedExdates.some((value, index) => value !== rawExdates[index])
            ) {
              errors.push(`task.recurrence.exdates must be normalized/deduped/sorted (${String(task.id)})`);
            }
          }
        }
      }
    }

    if (task.instance_of !== undefined) {
      if (!isRecord(task.instance_of)) {
        errors.push(`task.instance_of must be an object when present (${String(task.id)})`);
      } else {
        if (
          typeof task.instance_of.series_id !== "string" ||
          task.instance_of.series_id.trim().length === 0
        ) {
          errors.push(`task.instance_of.series_id must be a non-empty string (${String(task.id)})`);
        }
        const normalizedOccurrence = normalizeLocalIso(task.instance_of.occurrence);
        if (!normalizedOccurrence) {
          errors.push(`task.instance_of.occurrence must be a valid local ISO timestamp (${String(task.id)})`);
        } else if (task.instance_of.occurrence !== normalizedOccurrence) {
          errors.push(`task.instance_of.occurrence must be normalized local ISO (${String(task.id)})`);
        }
      }
    }

    if (task.recurrence !== undefined && task.instance_of !== undefined) {
      errors.push(`task cannot include both recurrence and instance_of (${String(task.id)})`);
    }

    if (
      task.hasExplicitTime !== undefined &&
      typeof task.hasExplicitTime !== "boolean"
    ) {
      errors.push(`task.hasExplicitTime must be boolean when present (${String(task.id)})`);
    }

    if (task.links !== undefined) {
      if (!Array.isArray(task.links)) {
        errors.push(`task.links must be an array when present (${String(task.id)})`);
      } else {
        for (const link of task.links) {
          if (!isRecord(link)) {
            errors.push(`task.links entry must be an object (${String(task.id)})`);
            continue;
          }
          if (!isNonEmptyString(link.id)) {
            errors.push(`task.links[].id must be a non-empty string (${String(task.id)})`);
          }
          if (!isNonEmptyString(link.target)) {
            errors.push(`task.links[].target must be a non-empty string (${String(task.id)})`);
          }
          if (link.label !== undefined && typeof link.label !== "string") {
            errors.push(`task.links[].label must be a string when present (${String(task.id)})`);
          }
          if (
            link.kind !== undefined &&
            !VALID_TASK_LINK_KINDS.has(link.kind as TaskLinkKind)
          ) {
            errors.push(`task.links[].kind must be url|path when present (${String(task.id)})`);
          }
          if (
            link.source !== undefined &&
            !VALID_TASK_LINK_SOURCES.has(link.source as TaskLinkSource)
          ) {
            errors.push(
              `task.links[].source must be manual|calendar_import when present (${String(task.id)})`
            );
          }
        }
      }
    }

    if (!Array.isArray(task.tags) || !task.tags.every((tag) => typeof tag === "string")) {
      errors.push(`task.tags must be a string array (${String(task.id)})`);
      continue;
    }

    const normalizedTags = normalizeTags(task.tags);
    if (
      normalizedTags.length !== task.tags.length ||
      normalizedTags.some((tag, index) => tag !== task.tags[index])
    ) {
      errors.push(`task.tags must be normalized/deduped/sorted (${String(task.id)})`);
    }
  }

  for (const view of normalized.savedViews) {
    if (!isRecord(view)) {
      errors.push("savedView entry must be an object");
      continue;
    }

    if (typeof view.id !== "string" || view.id.trim().length === 0) {
      errors.push("savedView.id must be a non-empty string");
    }

    if (typeof view.name !== "string" || view.name.trim().length === 0) {
      errors.push("savedView.name must be a non-empty string");
    }

    if (!isFiniteNumber(view.createdAt) || !isFiniteNumber(view.updatedAt)) {
      errors.push(`savedView timestamps must be numeric (${String(view.id)})`);
    }

    if (!isRecord(view.filters)) {
      errors.push(`savedView.filters must be an object (${String(view.id)})`);
      continue;
    }
    if (!["all", "open", "done", "archived"].includes(String(view.filters.status))) {
      errors.push(`savedView.filters.status invalid (${String(view.id)})`);
    }
    if (!["any", "overdue", "today", "next7"].includes(String(view.filters.due))) {
      errors.push(`savedView.filters.due invalid (${String(view.id)})`);
    }
    if (
      view.filters.tag !== undefined &&
      typeof view.filters.tag !== "string"
    ) {
      errors.push(`savedView.filters.tag must be string (${String(view.id)})`);
    }
    if (
      view.filters.searchText !== undefined &&
      typeof view.filters.searchText !== "string"
    ) {
      errors.push(`savedView.filters.searchText must be string (${String(view.id)})`);
    }
    if (view.filters.tagFilter !== undefined) {
      if (!isRecord(view.filters.tagFilter)) {
        errors.push(`savedView.filters.tagFilter must be an object (${String(view.id)})`);
      } else {
        const rawAll = view.filters.tagFilter.all;
        const rawAny = view.filters.tagFilter.any;
        const rawNone = view.filters.tagFilter.none;

        if (
          rawAll !== undefined &&
          (!Array.isArray(rawAll) || !rawAll.every((tag) => typeof tag === "string"))
        ) {
          errors.push(`savedView.filters.tagFilter.all must be a string array (${String(view.id)})`);
        }
        if (
          rawAny !== undefined &&
          (!Array.isArray(rawAny) || !rawAny.every((tag) => typeof tag === "string"))
        ) {
          errors.push(`savedView.filters.tagFilter.any must be a string array (${String(view.id)})`);
        }
        if (
          rawNone !== undefined &&
          (!Array.isArray(rawNone) || !rawNone.every((tag) => typeof tag === "string"))
        ) {
          errors.push(`savedView.filters.tagFilter.none must be a string array (${String(view.id)})`);
        }

        if (
          (rawAll === undefined || Array.isArray(rawAll)) &&
          (rawAny === undefined || Array.isArray(rawAny)) &&
          (rawNone === undefined || Array.isArray(rawNone))
        ) {
          const normalizedTagFilter = normalizeTagFilter({
            all: Array.isArray(rawAll) ? rawAll : undefined,
            any: Array.isArray(rawAny) ? rawAny : undefined,
            none: Array.isArray(rawNone) ? rawNone : undefined
          });
          const hadAnyBucket = rawAll !== undefined || rawAny !== undefined || rawNone !== undefined;

          if (!normalizedTagFilter && hadAnyBucket) {
            errors.push(`savedView.filters.tagFilter must contain valid tags (${String(view.id)})`);
          } else if (normalizedTagFilter) {
            const all = Array.isArray(rawAll) ? rawAll : [];
            const any = Array.isArray(rawAny) ? rawAny : [];
            const none = Array.isArray(rawNone) ? rawNone : [];
            if (
              !areStringArraysEqual(all, normalizedTagFilter.all ?? []) ||
              !areStringArraysEqual(any, normalizedTagFilter.any ?? []) ||
              !areStringArraysEqual(none, normalizedTagFilter.none ?? [])
            ) {
              errors.push(
                `savedView.filters.tagFilter buckets must be normalized/deduped/sorted (${String(view.id)})`
              );
            }
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, data: normalized };
}
