import { normalizeTags } from "../domain/tagIndex";
import type { TaskStatus } from "../domain/models";
import type { LoadedData } from "./persistence";

export type ValidationMode = "minimal" | "strict";

export type ValidationResult =
  | { ok: true; data: LoadedData }
  | { ok: false; errors: string[] };

const VALID_STATUS = new Set<TaskStatus>(["open", "done", "archived"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
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

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const normalized: LoadedData = {
    schemaVersion: schemaVersion as number,
    tasks: tasks as LoadedData["tasks"],
    tagIndex: (tagIndex as LoadedData["tagIndex"]) ?? {}
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

    if (
      task.hasExplicitTime !== undefined &&
      typeof task.hasExplicitTime !== "boolean"
    ) {
      errors.push(`task.hasExplicitTime must be boolean when present (${String(task.id)})`);
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

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, data: normalized };
}
