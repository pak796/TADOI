import { normalizeTagIndex, normalizeTags } from "../domain/tagIndex";
import { normalizeChecklist } from "../domain/checklist";
import { normalizeTagAliases } from "../domain/tagAliases";
import {
  createDefaultEngagementState,
  normalizeEngagementState
} from "../domain/engagement";
import {
  formatDateToLocalIso,
  parseLocalIsoToDate
} from "../domain/recurrence/rruleAdapter";
import type { WorkflowStage } from "../domain/models";
import type { LoadedData } from "./persistence";

type MigrationFn = (state: LoadedData) => LoadedData;

const migrations: Record<number, MigrationFn> = {
  0: migrateV0ToV1,
  1: migrateV1ToV2,
  2: migrateV2ToV3,
  3: migrateV3ToV4,
  4: migrateV4ToV5,
  5: migrateV5ToV6,
  6: migrateV6ToV7,
  7: migrateV7ToV8
};

function normalizeStateRevision(value: unknown): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  ) {
    return value;
  }
  return 0;
}

function migrateV0ToV1(state: LoadedData): LoadedData {
  return {
    schemaVersion: 1,
    tasks: Array.isArray(state.tasks) ? state.tasks : [],
    tagIndex: normalizeTagIndex(state.tagIndex ?? {}),
    tagAliases: normalizeTagAliases(state.tagAliases),
    savedViews: [],
    engagement: createDefaultEngagementState()
  };
}

function migrateV1ToV2(state: LoadedData): LoadedData {
  const tasks = state.tasks.map((task) => {
    if (typeof task !== "object" || task === null) {
      throw new Error("Invalid task entry during migration 1->2");
    }
    return {
      ...task,
      hasExplicitTime:
        typeof task.hasExplicitTime === "boolean" ? task.hasExplicitTime : false,
      tags: normalizeTags(Array.isArray(task.tags) ? task.tags : [])
    };
  });

  return {
    schemaVersion: 2,
    tasks,
    tagIndex: normalizeTagIndex(state.tagIndex ?? {}),
    tagAliases: normalizeTagAliases(state.tagAliases),
    savedViews: [],
    engagement: createDefaultEngagementState()
  };
}

function migrateV2ToV3(state: LoadedData): LoadedData {
  return {
    schemaVersion: 3,
    tasks: state.tasks,
    tagIndex: normalizeTagIndex(state.tagIndex ?? {}),
    tagAliases: normalizeTagAliases(state.tagAliases),
    savedViews: [],
    engagement: createDefaultEngagementState()
  };
}

function normalizeLocalIso(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = parseLocalIsoToDate(value);
  if (!parsed) return undefined;
  return formatDateToLocalIso(parsed);
}

function normalizeExdates(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = Array.from(
    new Set(value.map((entry) => normalizeLocalIso(entry)).filter(Boolean) as string[])
  ).sort((left, right) => left.localeCompare(right));
  return normalized.length > 0 ? normalized : undefined;
}

function migrateV3ToV4(state: LoadedData): LoadedData {
  const tasks = state.tasks.map((task) => {
    if (typeof task !== "object" || task === null) {
      throw new Error("Invalid task entry during migration 3->4");
    }

    let recurrence = undefined as
      | {
          dtstart: string;
          rrule: string;
          exdates?: string[];
          series_id: string;
        }
      | undefined;

    if (
      typeof task.recurrence === "object" &&
      task.recurrence !== null &&
      !Array.isArray(task.recurrence)
    ) {
      const recurrenceRecord = task.recurrence as Record<string, unknown>;
      const fallbackDtstart =
        typeof task.dueAt === "number" && Number.isFinite(task.dueAt)
          ? formatDateToLocalIso(new Date(task.dueAt))
          : undefined;
      const dtstart =
        normalizeLocalIso(recurrenceRecord.dtstart) ??
        normalizeLocalIso(fallbackDtstart) ??
        formatDateToLocalIso(new Date(task.createdAt));
      const rrule =
        typeof recurrenceRecord.rrule === "string" && recurrenceRecord.rrule.trim().length > 0
          ? recurrenceRecord.rrule.trim()
          : "FREQ=DAILY;INTERVAL=1";
      const seriesId =
        typeof recurrenceRecord.series_id === "string" &&
        recurrenceRecord.series_id.trim().length > 0
          ? recurrenceRecord.series_id.trim()
          : `series:${task.id}`;
      const exdates = normalizeExdates(recurrenceRecord.exdates);
      recurrence = {
        dtstart,
        rrule,
        series_id: seriesId,
        ...(exdates ? { exdates } : {})
      };
    }

    let instanceOf = undefined as { series_id: string; occurrence: string } | undefined;
    if (
      typeof task.instance_of === "object" &&
      task.instance_of !== null &&
      !Array.isArray(task.instance_of)
    ) {
      const instanceRecord = task.instance_of as Record<string, unknown>;
      const seriesId =
        typeof instanceRecord.series_id === "string" &&
        instanceRecord.series_id.trim().length > 0
          ? instanceRecord.series_id.trim()
          : undefined;
      const occurrence = normalizeLocalIso(instanceRecord.occurrence);
      if (seriesId && occurrence) {
        instanceOf = {
          series_id: seriesId,
          occurrence
        };
      }
    }

    const normalizedRecurrence = recurrence && instanceOf ? undefined : recurrence;

    const { recurrence: _legacyRecurrence, instance_of: _legacyInstanceOf, ...baseTask } = task;

    return {
      ...baseTask,
      ...(normalizedRecurrence ? { recurrence: normalizedRecurrence } : {}),
      ...(instanceOf ? { instance_of: instanceOf } : {})
    };
  });

  return {
    schemaVersion: 4,
    tasks,
    tagIndex: normalizeTagIndex(state.tagIndex ?? {}),
    tagAliases: normalizeTagAliases(state.tagAliases),
    savedViews: Array.isArray(state.savedViews) ? state.savedViews : [],
    engagement: createDefaultEngagementState()
  };
}

function migrateV4ToV5(state: LoadedData): LoadedData {
  return {
    schemaVersion: 5,
    stateRevision: normalizeStateRevision(state.stateRevision),
    tasks: state.tasks,
    tagIndex: normalizeTagIndex(state.tagIndex ?? {}),
    tagAliases: normalizeTagAliases(state.tagAliases),
    savedViews: Array.isArray(state.savedViews) ? state.savedViews : [],
    engagement: normalizeEngagementState(state.engagement)
  };
}

function migrateV5ToV6(state: LoadedData): LoadedData {
  return {
    schemaVersion: 6,
    stateRevision: normalizeStateRevision(state.stateRevision),
    tasks: state.tasks,
    tagIndex: normalizeTagIndex(state.tagIndex ?? {}),
    tagAliases: normalizeTagAliases(state.tagAliases),
    savedViews: Array.isArray(state.savedViews) ? state.savedViews : [],
    engagement: normalizeEngagementState(state.engagement)
  };
}

function migrateV6ToV7(state: LoadedData): LoadedData {
  const tasks = state.tasks.map((task) => {
    if (typeof task !== "object" || task === null) {
      throw new Error("Invalid task entry during migration 6->7");
    }

    if (typeof task.workflowStage === "string" && task.workflowStage.length > 0) {
      return task;
    }

    const workflowStage: WorkflowStage = task.status === "open" ? "todo" : "done";
    return {
      ...task,
      workflowStage
    };
  });

  return {
    schemaVersion: 7,
    stateRevision: normalizeStateRevision(state.stateRevision),
    tasks,
    tagIndex: normalizeTagIndex(state.tagIndex ?? {}),
    tagAliases: normalizeTagAliases(state.tagAliases),
    savedViews: Array.isArray(state.savedViews) ? state.savedViews : [],
    engagement: normalizeEngagementState(state.engagement)
  };
}

function migrateV7ToV8(state: LoadedData): LoadedData {
  const tasks = state.tasks.map((task) => {
    if (typeof task !== "object" || task === null) {
      throw new Error("Invalid task entry during migration 7->8");
    }

    return {
      ...task,
      checklist: normalizeChecklist(task.checklist)
    };
  });

  return {
    schemaVersion: 8,
    stateRevision: normalizeStateRevision(state.stateRevision),
    tasks,
    tagIndex: normalizeTagIndex(state.tagIndex ?? {}),
    tagAliases: normalizeTagAliases(state.tagAliases),
    savedViews: Array.isArray(state.savedViews) ? state.savedViews : [],
    engagement: normalizeEngagementState(state.engagement)
  };
}

export function migratePersistedStateToCurrent(
  input: LoadedData,
  currentVersion: number
): LoadedData {
  if (input.schemaVersion > currentVersion) {
    throw new Error(
      `Unsupported schemaVersion ${input.schemaVersion}; current is ${currentVersion}`
    );
  }

  let next: LoadedData = {
    ...input,
    stateRevision: normalizeStateRevision(input.stateRevision),
    tasks: Array.isArray(input.tasks) ? input.tasks : [],
    tagIndex: input.tagIndex ?? {},
    tagAliases: normalizeTagAliases(input.tagAliases),
    savedViews: Array.isArray(input.savedViews) ? input.savedViews : [],
    engagement: normalizeEngagementState(input.engagement)
  };

  while (next.schemaVersion < currentVersion) {
    const migration = migrations[next.schemaVersion];
    if (!migration) {
      throw new Error(`Missing migration step ${next.schemaVersion} -> ${next.schemaVersion + 1}`);
    }
    next = migration(next);
  }

  return next;
}
