import { normalizeTags } from "../domain/tagIndex";
import { inferTaskLinkKind } from "../domain/taskLinks";
import type {
  Task,
  TaskExternalCalendarMetadata,
  TaskLink,
  TaskRecurrence
} from "../domain/models";
import { normalizeRRuleFragment } from "./rrule";
import type { ParsedIcsEvent, ParsedIcsTemporalValue } from "./icsParser";

export type CalendarImportMode = "merge" | "update" | "create";

export type CalendarEventIdentity = {
  kind: "task" | "series" | "instance";
  taskId: string;
};

export type CalendarMappedTaskDraft = {
  uid?: string;
  summary: string;
  dueAt?: number;
  hasExplicitTime: boolean;
  notes?: string;
  tags: string[];
  links: TaskLink[];
  recurrenceId?: string;
  seriesUid?: string;
  timeZone?: string;
};

export type CalendarMergeOptions = {
  nowMs: number;
  importedAtIso: string;
  mode: Exclude<CalendarImportMode, "create">;
  allowOverwrite: boolean;
};

export type CalendarMergeResult = {
  task: Task;
  action: "merged" | "updated" | "skipped";
  conflicts: string[];
};

const IMPORT_NOTES_PREFIX = "--- Imported from Calendar";

function normalizeUidValue(uid: string | undefined): string | undefined {
  if (!uid) return undefined;
  const trimmed = uid.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function sanitizeSummary(summary: string | undefined): string {
  const trimmed = summary?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Imported Event";
}

function toTimestamp(iso: string | undefined): number | undefined {
  if (!iso) return undefined;
  const value = Date.parse(iso);
  return Number.isFinite(value) ? value : undefined;
}

function normalizeOccurrenceIso(value: ParsedIcsTemporalValue | undefined): string | undefined {
  if (!value) return undefined;
  if (value.kind === "date") {
    return `${value.localIso.slice(0, 10)}T00:00:00`;
  }
  return value.localIso;
}

function parseDescriptionLines(
  description: string | undefined
): {
  notes?: string;
  tags: string[];
  links: Array<{ target: string; label?: string }>;
} {
  if (!description) {
    return { tags: [], links: [] };
  }

  const notesLines: string[] = [];
  const tags: string[] = [];
  const links: Array<{ target: string; label?: string }> = [];

  for (const line of description.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^tags:/i.test(trimmed)) {
      const rawTags = trimmed.slice(trimmed.indexOf(":") + 1);
      const parsedTags = rawTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      tags.push(...parsedTags);
      continue;
    }

    const match = /^([^:]{1,80}):\s*(.+)$/.exec(trimmed);
    if (match) {
      const label = match[1].trim();
      const target = match[2].trim();
      if (
        /^https?:\/\//i.test(target) ||
        /^mailto:/i.test(target) ||
        /^file:/i.test(target) ||
        /^[./~]/.test(target) ||
        /^[a-zA-Z]:[\\/]/.test(target)
      ) {
        links.push({ target, ...(label ? { label } : {}) });
        continue;
      }
    }

    notesLines.push(trimmed);
  }

  return {
    ...(notesLines.length > 0 ? { notes: notesLines.join("\n") } : {}),
    tags,
    links
  };
}

function buildImportedLinks(
  event: ParsedIcsEvent,
  parsedDescription: ReturnType<typeof parseDescriptionLines>
): TaskLink[] {
  const links: TaskLink[] = [];
  const pushUnique = (target: string, label?: string) => {
    const normalizedTarget = target.trim();
    if (!normalizedTarget) return;
    if (links.some((entry) => entry.target === normalizedTarget)) {
      return;
    }
    links.push({
      id: crypto.randomUUID(),
      target: normalizedTarget,
      ...(label ? { label } : {}),
      kind: inferTaskLinkKind(normalizedTarget)
    });
  };

  if (event.url) {
    pushUnique(event.url, "url");
  }
  for (const link of parsedDescription.links) {
    pushUnique(link.target, link.label);
  }

  return links;
}

function buildNotesAppendBlock(uid: string | undefined, importedAtIso: string, notes: string): string {
  const suffix = uid ? ` (UID ${uid} at ${importedAtIso})` : ` (${importedAtIso})`;
  return `${IMPORT_NOTES_PREFIX}${suffix} ---\n${notes}`;
}

function unionLinks(existing: TaskLink[] | undefined, incoming: TaskLink[]): TaskLink[] {
  const next = [...(existing ?? [])];
  const seenTargets = new Set(next.map((link) => link.target));
  for (const link of incoming) {
    if (seenTargets.has(link.target)) continue;
    next.push({
      id: crypto.randomUUID(),
      target: link.target,
      ...(link.label ? { label: link.label } : {}),
      ...(link.kind ? { kind: link.kind } : {})
    });
    seenTargets.add(link.target);
  }
  return next;
}

function mergeNotes(
  existingNotes: string | undefined,
  incomingNotes: string | undefined,
  uid: string | undefined,
  importedAtIso: string
): string | undefined {
  const existing = existingNotes?.trim();
  const incoming = incomingNotes?.trim();
  if (!incoming) {
    return existing || undefined;
  }
  if (!existing) {
    return incoming;
  }
  if (existing === incoming || existing.includes(incoming)) {
    return existing;
  }
  const appended = buildNotesAppendBlock(uid, importedAtIso, incoming);
  if (existing.includes(appended)) {
    return existing;
  }
  return `${existing}\n\n${appended}`;
}

function computeImportHash(draft: CalendarMappedTaskDraft): string {
  const payload = {
    uid: draft.uid ?? "",
    summary: draft.summary,
    dueAt: draft.dueAt ?? null,
    hasExplicitTime: draft.hasExplicitTime,
    notes: draft.notes ?? "",
    tags: draft.tags,
    links: draft.links.map((link) => ({
      target: link.target,
      label: link.label ?? "",
      kind: link.kind ?? inferTaskLinkKind(link.target)
    })),
    recurrenceId: draft.recurrenceId ?? "",
    seriesUid: draft.seriesUid ?? ""
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

function mergeCalendarMetadata(
  existing: TaskExternalCalendarMetadata | undefined,
  draft: CalendarMappedTaskDraft,
  importedAtIso: string,
  forceUpdateTimestamp: boolean
): TaskExternalCalendarMetadata | undefined {
  const uid = normalizeUidValue(draft.uid ?? existing?.uid);
  if (!uid) {
    return existing;
  }

  const hash = computeImportHash(draft);
  const next: TaskExternalCalendarMetadata = {
    uid,
    source: "ics-import",
    ...(draft.timeZone ? { tzid: draft.timeZone } : existing?.tzid ? { tzid: existing.tzid } : {}),
    lastImportedAt: forceUpdateTimestamp ? importedAtIso : existing?.lastImportedAt ?? importedAtIso,
    lastImportedHash: hash,
    ...(draft.recurrenceId
      ? { recurrenceId: draft.recurrenceId }
      : existing?.recurrenceId
        ? { recurrenceId: existing.recurrenceId }
        : {}),
    ...(draft.seriesUid
      ? { seriesUid: draft.seriesUid }
      : existing?.seriesUid
        ? { seriesUid: existing.seriesUid }
        : {})
  };

  return next;
}

function areTaskFieldsEqual(left: Task, right: Task): boolean {
  const leftLinks = left.links ?? [];
  const rightLinks = right.links ?? [];
  if (leftLinks.length !== rightLinks.length) return false;
  for (let i = 0; i < leftLinks.length; i += 1) {
    const l = leftLinks[i];
    const r = rightLinks[i];
    if (
      l.target !== r.target ||
      (l.label ?? "") !== (r.label ?? "") ||
      (l.kind ?? inferTaskLinkKind(l.target)) !== (r.kind ?? inferTaskLinkKind(r.target))
    ) {
      return false;
    }
  }

  return (
    left.title === right.title &&
    left.dueAt === right.dueAt &&
    (left.hasExplicitTime ?? false) === (right.hasExplicitTime ?? false) &&
    (left.notes ?? "") === (right.notes ?? "") &&
    JSON.stringify(left.tags) === JSON.stringify(right.tags) &&
    JSON.stringify(left.external?.calendar ?? null) ===
      JSON.stringify(right.external?.calendar ?? null)
  );
}

export function parseTadoiIdentityFromUid(uid: string | undefined): CalendarEventIdentity | null {
  const normalized = normalizeUidValue(uid);
  if (!normalized) return null;

  const seriesMatch = /^tadoi-series-(.+)@local$/i.exec(normalized);
  if (seriesMatch) {
    return { kind: "series", taskId: seriesMatch[1] };
  }

  const instanceMatch = /^tadoi-inst-(.+)@local$/i.exec(normalized);
  if (instanceMatch) {
    return { kind: "instance", taskId: instanceMatch[1] };
  }

  const regularMatch = /^tadoi-(.+)@local$/i.exec(normalized);
  if (regularMatch) {
    return { kind: "task", taskId: regularMatch[1] };
  }

  return null;
}

export function mapEventToTaskDraft(
  event: ParsedIcsEvent,
  opts: { importTag?: string } = {}
): CalendarMappedTaskDraft {
  const parsedDescription = parseDescriptionLines(event.description);
  const dueSource = event.dtstart ?? event.recurrenceId;
  const dueAt = dueSource?.epochMs;
  const hasExplicitTime = dueSource?.kind === "date-time";
  const tags = normalizeTags([
    ...event.categories,
    ...parsedDescription.tags,
    ...(opts.importTag ? [opts.importTag] : [])
  ]);
  const links = buildImportedLinks(event, parsedDescription);

  return {
    uid: normalizeUidValue(event.uid),
    summary: sanitizeSummary(event.summary),
    ...(dueAt !== undefined ? { dueAt } : {}),
    hasExplicitTime,
    ...(parsedDescription.notes ? { notes: parsedDescription.notes } : {}),
    tags,
    links,
    ...(event.recurrenceId ? { recurrenceId: normalizeOccurrenceIso(event.recurrenceId) } : {}),
    ...(event.relatedTo ? { seriesUid: event.relatedTo } : event.uid ? { seriesUid: event.uid } : {}),
    ...(event.dtstart?.tzid ? { timeZone: event.dtstart.tzid } : {})
  };
}

export function createTaskFromDraft(
  draft: CalendarMappedTaskDraft,
  nowMs: number,
  importedAtIso: string
): Task {
  const metadata = mergeCalendarMetadata(undefined, draft, importedAtIso, true);

  return {
    id: crypto.randomUUID(),
    title: draft.summary,
    status: "open",
    createdAt: nowMs,
    updatedAt: nowMs,
    ...(draft.dueAt !== undefined ? { dueAt: draft.dueAt } : {}),
    hasExplicitTime: draft.hasExplicitTime,
    ...(draft.notes ? { notes: draft.notes } : {}),
    tags: draft.tags,
    ...(draft.links.length > 0 ? { links: draft.links } : {}),
    ...(metadata ? { external: { calendar: metadata } } : {})
  };
}

export function mergeTaskFromDraft(
  existingTask: Task,
  draft: CalendarMappedTaskDraft,
  options: CalendarMergeOptions
): CalendarMergeResult {
  const conflicts: string[] = [];
  let nextTask: Task = {
    ...existingTask
  };

  if (options.mode === "update") {
    nextTask = {
      ...nextTask,
      title: draft.summary,
      ...(draft.dueAt !== undefined ? { dueAt: draft.dueAt } : { dueAt: undefined }),
      hasExplicitTime: draft.hasExplicitTime,
      ...(draft.notes ? { notes: draft.notes } : { notes: undefined }),
      tags: draft.tags,
      ...(draft.links.length > 0 ? { links: draft.links } : { links: undefined })
    };
  } else {
    if (draft.summary !== nextTask.title) {
      if (options.allowOverwrite) {
        nextTask = { ...nextTask, title: draft.summary };
      } else {
        conflicts.push("title");
      }
    }

    if (draft.dueAt !== undefined && draft.dueAt !== nextTask.dueAt) {
      if (options.allowOverwrite) {
        nextTask = {
          ...nextTask,
          dueAt: draft.dueAt,
          hasExplicitTime: draft.hasExplicitTime
        };
      } else {
        conflicts.push("dueAt");
      }
    }

    const mergedTags = normalizeTags([...nextTask.tags, ...draft.tags]);
    if (JSON.stringify(mergedTags) !== JSON.stringify(nextTask.tags)) {
      nextTask = {
        ...nextTask,
        tags: mergedTags
      };
    }

    const mergedLinks = unionLinks(nextTask.links, draft.links);
    if (JSON.stringify(mergedLinks) !== JSON.stringify(nextTask.links ?? [])) {
      nextTask = {
        ...nextTask,
        links: mergedLinks
      };
    }

    const mergedNotes = mergeNotes(nextTask.notes, draft.notes, draft.uid, options.importedAtIso);
    if ((mergedNotes ?? "") !== (nextTask.notes ?? "")) {
      nextTask = {
        ...nextTask,
        ...(mergedNotes ? { notes: mergedNotes } : { notes: undefined })
      };
    }
  }

  const existingHash = existingTask.external?.calendar?.lastImportedHash;
  const nextHash = computeImportHash(draft);
  const fieldChanged = !areTaskFieldsEqual(existingTask, nextTask);
  const metadataChanged = existingHash !== nextHash || existingTask.external?.calendar?.uid !== draft.uid;
  const shouldTouchTimestamp = fieldChanged || metadataChanged;
  const mergedMetadata = mergeCalendarMetadata(
    existingTask.external?.calendar,
    draft,
    options.importedAtIso,
    shouldTouchTimestamp
  );

  if (mergedMetadata) {
    nextTask = {
      ...nextTask,
      external: {
        ...nextTask.external,
        calendar: mergedMetadata
      }
    };
  }

  if (fieldChanged || metadataChanged) {
    nextTask = {
      ...nextTask,
      updatedAt: options.nowMs
    };
  }

  if (!fieldChanged && !metadataChanged) {
    return { task: existingTask, action: "skipped", conflicts };
  }

  return {
    task: nextTask,
    action: options.mode === "update" ? "updated" : "merged",
    conflicts
  };
}

export function buildRecurrenceFromSeriesEvent(
  event: ParsedIcsEvent,
  seriesId: string
): TaskRecurrence | null {
  if (!event.rrule || !event.dtstart) {
    return null;
  }
  const exdates = Array.from(
    new Set(
      event.exdates
        .map((value) => normalizeOccurrenceIso(value))
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  ).sort((left, right) => left.localeCompare(right));

  return {
    dtstart: normalizeOccurrenceIso(event.dtstart) ?? event.dtstart.localIso,
    rrule: normalizeRRuleFragment(event.rrule),
    ...(exdates.length > 0 ? { exdates } : {}),
    series_id: seriesId
  };
}

export function normalizeExdateIsoValues(values: ParsedIcsTemporalValue[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeOccurrenceIso(value))
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  ).sort((left, right) => left.localeCompare(right));
}

export function getImportedAtReference(task: Task): number | undefined {
  return toTimestamp(task.external?.calendar?.lastImportedAt);
}
