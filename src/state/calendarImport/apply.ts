import type { SavedView, Task } from "../../domain/models";
import {
  buildRecurrenceFromSeriesEvent,
  createTaskFromDraft,
  getImportedAtReference,
  mapEventToTaskDraft,
  mergeTaskFromDraft,
  normalizeExdateIsoValues,
  type CalendarImportMode,
} from "../../calendar/importMapper";
import { isValidRRuleFragment, normalizeRRuleFragment } from "../../calendar/rrule";
import type { ParsedIcsEvent } from "../../calendar/icsParser";
import type { CalendarExportRange } from "../../calendar/range";
import {
  appendTask,
  buildTaskLookup,
  extractVisibleSourceTaskIds,
  isTaskVisibleInView,
  replaceTaskById,
  resolveInstanceMatch,
  resolveSeriesTaskForOverride,
  resolveTaskMatch,
} from "./matching";
import {
  createCalendarImportSummary,
  normalizeSeriesExdates,
  pushReportEntry,
  seriesHasOccurrenceInRange,
  shouldSkipByRange,
  type CalendarImportMutableState,
  type CalendarImportReportEntry,
  type CalendarImportSummary,
} from "./shared";

export type CalendarImportApplyParams = {
  parsedEvents: ParsedIcsEvent[];
  tasks: Task[];
  nowMs: number;
  importedAtIso: string;
  range: CalendarExportRange;
  rangeWindow: ReturnType<typeof import("../../calendar/range").resolveCalendarRangeWindow>;
  mode: CalendarImportMode;
  horizonDays: number;
  importTag?: string;
  view?: SavedView;
  viewApplied?: string;
  visibleSourceIds?: Set<string>;
};

export type CalendarImportApplyResult = {
  tasks: Task[];
  summary: CalendarImportSummary;
  reportEntries: CalendarImportReportEntry[];
};

function refreshVisibleSourceIds(params: {
  tasks: Task[];
  view?: SavedView;
  nowMs: number;
}): Set<string> | undefined {
  if (!params.view) return undefined;
  return extractVisibleSourceTaskIds(params.tasks, params.view, params.nowMs);
}

export function applyCalendarImportEvents(
  params: CalendarImportApplyParams,
): CalendarImportApplyResult {
  const state: CalendarImportMutableState = {
    tasks: params.tasks,
    taskLookup: buildTaskLookup(params.tasks),
    summary: createCalendarImportSummary(params.parsedEvents.length),
    reportEntries: [],
    visibleSourceIds: params.visibleSourceIds,
  };

  const baseEvents = params.parsedEvents.filter((event) => !event.recurrenceId);
  const overrideEvents = params.parsedEvents.filter((event) =>
    Boolean(event.recurrenceId),
  );

  for (const event of baseEvents) {
    if (!event.uid && !event.summary) {
      state.summary.skipped += 1;
      pushReportEntry(state.reportEntries, {
        action: "skipped",
        message: "Skipping VEVENT without UID and SUMMARY",
      });
      continue;
    }

    if (event.status === "CANCELLED" && !event.rrule) {
      state.summary.skipped += 1;
      pushReportEntry(state.reportEntries, {
        uid: event.uid,
        action: "skipped",
        message: "Standalone cancelled event skipped",
      });
      continue;
    }

    if (!event.rrule && shouldSkipByRange(event, params.rangeWindow)) {
      state.summary.skipped += 1;
      pushReportEntry(state.reportEntries, {
        uid: event.uid,
        action: "skipped",
        message: "Event outside selected range",
      });
      continue;
    }

    const match =
      params.mode === "create"
        ? undefined
        : resolveTaskMatch(event, state.taskLookup);
    if (match) {
      if (match.matchedBy === "x-task-id") {
        state.summary.matchedByTaskId += 1;
      } else {
        state.summary.matchedByUid += 1;
      }
      if (
        state.visibleSourceIds &&
        !state.visibleSourceIds.has(match.task.id)
      ) {
        state.summary.skipped += 1;
        pushReportEntry(state.reportEntries, {
          uid: event.uid,
          action: "skipped",
          match: match.matchedBy,
          taskId: match.task.id,
          message: `Matched task not visible in saved view "${params.viewApplied}"`,
        });
        continue;
      }
    }

    if (event.rrule) {
      if (!isValidRRuleFragment(event.rrule)) {
        state.summary.errors += 1;
        pushReportEntry(state.reportEntries, {
          uid: event.uid,
          action: "error",
          match: match?.matchedBy ?? "none",
          taskId: match?.task.id,
          message: `Invalid RRULE: ${normalizeRRuleFragment(event.rrule)}`,
        });
        continue;
      }

      const draft = mapEventToTaskDraft(event, {
        importTag: params.importTag,
      });
      const existing = match?.task;
      const seriesId =
        existing?.recurrence?.series_id ??
        event.xSeriesId?.trim() ??
        `series:${existing?.id ?? crypto.randomUUID()}`;

      const recurrence = buildRecurrenceFromSeriesEvent(event, seriesId);
      if (!recurrence) {
        state.summary.errors += 1;
        pushReportEntry(state.reportEntries, {
          uid: event.uid,
          action: "error",
          message: "Recurring series requires DTSTART and RRULE",
        });
        continue;
      }

      const normalizedRecurrenceExdates = Array.from(
        new Set([
          ...(existing?.recurrence?.exdates ?? []),
          ...normalizeExdateIsoValues(event.exdates),
          ...(recurrence.exdates ?? []),
        ]),
      ).sort((left, right) => left.localeCompare(right));

      if (!existing || params.mode === "create") {
        let created = createTaskFromDraft(draft, params.nowMs, params.importedAtIso);
        created = {
          ...created,
          recurrence: {
            ...recurrence,
            ...(normalizedRecurrenceExdates.length > 0
              ? { exdates: normalizedRecurrenceExdates }
              : {}),
          },
        };

        if (
          !seriesHasOccurrenceInRange({
            task: created,
            range: params.range,
            rangeWindow: params.rangeWindow,
            nowMs: params.nowMs,
            horizonDays: params.horizonDays,
          })
        ) {
          state.summary.skipped += 1;
          pushReportEntry(state.reportEntries, {
            uid: event.uid,
            action: "skipped",
            message: "Series has no occurrence in selected range",
          });
          continue;
        }

        if (
          params.view &&
          !isTaskVisibleInView(
            created,
            state.tasks,
            params.view,
            params.nowMs,
            state.taskLookup.indexById,
          )
        ) {
          state.summary.skipped += 1;
          pushReportEntry(state.reportEntries, {
            uid: event.uid,
            action: "skipped",
            message: `Series not visible in saved view "${params.viewApplied}"`,
          });
          continue;
        }

        const normalizedCreated = normalizeSeriesExdates(created);
        state.taskLookup = appendTask(state.tasks, normalizedCreated);
        state.summary.created += 1;
        state.summary.recurringSeriesImported += 1;
        state.visibleSourceIds = refreshVisibleSourceIds({
          tasks: state.tasks,
          view: params.view,
          nowMs: params.nowMs,
        });
        pushReportEntry(state.reportEntries, {
          uid: event.uid,
          action: "created",
          match: match?.matchedBy ?? "none",
          taskId: normalizedCreated.id,
        });
        continue;
      }

      const importedAtReference = getImportedAtReference(existing);
      const allowOverwrite =
        importedAtReference === undefined ||
        existing.updatedAt <= importedAtReference ||
        match?.matchedBy === "x-task-id" ||
        match?.matchedBy === "uid";
      const merged = mergeTaskFromDraft(existing, draft, {
        nowMs: params.nowMs,
        importedAtIso: params.importedAtIso,
        mode: params.mode === "update" ? "update" : "merge",
        allowOverwrite,
      });

      let nextTask: Task = {
        ...merged.task,
        recurrence: {
          ...recurrence,
          ...(normalizedRecurrenceExdates.length > 0
            ? { exdates: normalizedRecurrenceExdates }
            : {}),
        },
      };

      if (
        !seriesHasOccurrenceInRange({
          task: nextTask,
          range: params.range,
          rangeWindow: params.rangeWindow,
          nowMs: params.nowMs,
          horizonDays: params.horizonDays,
        })
      ) {
        state.summary.skipped += 1;
        pushReportEntry(state.reportEntries, {
          uid: event.uid,
          action: "skipped",
          match: match.matchedBy,
          taskId: existing.id,
          message: "Series has no occurrence in selected range",
        });
        continue;
      }

      if (
        params.view &&
        !isTaskVisibleInView(
          nextTask,
          state.tasks,
          params.view,
          params.nowMs,
          state.taskLookup.indexById,
        )
      ) {
        state.summary.skipped += 1;
        pushReportEntry(state.reportEntries, {
          uid: event.uid,
          action: "skipped",
          match: match.matchedBy,
          taskId: existing.id,
          message: `Series not visible in saved view "${params.viewApplied}"`,
        });
        continue;
      }

      nextTask = normalizeSeriesExdates(nextTask);
      state.taskLookup = replaceTaskById(state.tasks, state.taskLookup, nextTask);

      if (merged.action === "updated") {
        state.summary.updated += 1;
      } else if (merged.action === "merged") {
        state.summary.merged += 1;
      } else {
        state.summary.skipped += 1;
      }
      if (merged.action !== "skipped") {
        state.summary.recurringSeriesImported += 1;
      }
      pushReportEntry(state.reportEntries, {
        uid: event.uid,
        action: merged.action,
        match: match.matchedBy,
        taskId: existing.id,
        ...(merged.conflicts.length > 0
          ? { conflicts: merged.conflicts }
          : {}),
      });
      continue;
    }

    const draft = mapEventToTaskDraft(event, {
      importTag: params.importTag,
    });

    if (!match || params.mode === "create") {
      const created = createTaskFromDraft(draft, params.nowMs, params.importedAtIso);
      if (
        params.view &&
        !isTaskVisibleInView(
          created,
          state.tasks,
          params.view,
          params.nowMs,
          state.taskLookup.indexById,
        )
      ) {
        state.summary.skipped += 1;
        pushReportEntry(state.reportEntries, {
          uid: event.uid,
          action: "skipped",
          message: `Task not visible in saved view "${params.viewApplied}"`,
        });
        continue;
      }
      state.taskLookup = appendTask(state.tasks, created);
      state.summary.created += 1;
      state.visibleSourceIds = refreshVisibleSourceIds({
        tasks: state.tasks,
        view: params.view,
        nowMs: params.nowMs,
      });
      pushReportEntry(state.reportEntries, {
        uid: event.uid,
        action: "created",
        match: "none",
        taskId: created.id,
      });
      continue;
    }

    const importedAtReference = getImportedAtReference(match.task);
    const allowOverwrite =
      importedAtReference === undefined ||
      match.task.updatedAt <= importedAtReference ||
      match.matchedBy === "x-task-id" ||
      match.matchedBy === "uid";
    const merged = mergeTaskFromDraft(match.task, draft, {
      nowMs: params.nowMs,
      importedAtIso: params.importedAtIso,
      mode: params.mode === "update" ? "update" : "merge",
      allowOverwrite,
    });
    if (
      params.view &&
      !isTaskVisibleInView(
        merged.task,
        state.tasks,
        params.view,
        params.nowMs,
        state.taskLookup.indexById,
      )
    ) {
      state.summary.skipped += 1;
      pushReportEntry(state.reportEntries, {
        uid: event.uid,
        action: "skipped",
        match: match.matchedBy,
        taskId: match.task.id,
        message: `Task not visible in saved view "${params.viewApplied}"`,
      });
      continue;
    }

    state.taskLookup = replaceTaskById(state.tasks, state.taskLookup, merged.task);

    if (merged.action === "updated") {
      state.summary.updated += 1;
    } else if (merged.action === "merged") {
      state.summary.merged += 1;
    } else {
      state.summary.skipped += 1;
    }
    pushReportEntry(state.reportEntries, {
      uid: event.uid,
      action: merged.action,
      match: match.matchedBy,
      taskId: match.task.id,
      ...(merged.conflicts.length > 0 ? { conflicts: merged.conflicts } : {}),
    });
  }

  for (const event of overrideEvents) {
    const occurrenceIso = event.recurrenceId?.localIso;
    if (!occurrenceIso) {
      state.summary.errors += 1;
      pushReportEntry(state.reportEntries, {
        uid: event.uid,
        action: "error",
        message: "Override missing RECURRENCE-ID",
      });
      continue;
    }

    if (shouldSkipByRange(event, params.rangeWindow)) {
      state.summary.skipped += 1;
      pushReportEntry(state.reportEntries, {
        uid: event.uid,
        recurrenceId: occurrenceIso,
        action: "skipped",
        message: "Override outside selected range",
      });
      continue;
    }

    const seriesMatch = resolveSeriesTaskForOverride(event, state.taskLookup);
    if (!seriesMatch || !seriesMatch.task.recurrence) {
      state.summary.errors += 1;
      pushReportEntry(state.reportEntries, {
        uid: event.uid,
        recurrenceId: occurrenceIso,
        action: "error",
        message: "Unable to resolve base recurring series for override",
      });
      continue;
    }

    if (seriesMatch.matchedBy === "x-task-id") {
      state.summary.matchedByTaskId += 1;
    } else {
      state.summary.matchedByUid += 1;
    }

    const seriesTaskIndex = state.taskLookup.indexById.get(seriesMatch.task.id) ?? -1;
    if (seriesTaskIndex < 0) {
      state.summary.errors += 1;
      pushReportEntry(state.reportEntries, {
        uid: event.uid,
        recurrenceId: occurrenceIso,
        action: "error",
        message: "Resolved series task disappeared during import",
      });
      continue;
    }

    const seriesTask = state.tasks[seriesTaskIndex];
    if (
      params.view &&
      !isTaskVisibleInView(
        seriesTask,
        state.tasks,
        params.view,
        params.nowMs,
        state.taskLookup.indexById,
      )
    ) {
      state.summary.skipped += 1;
      pushReportEntry(state.reportEntries, {
        uid: event.uid,
        recurrenceId: occurrenceIso,
        action: "skipped",
        match: seriesMatch.matchedBy,
        taskId: seriesTask.id,
        message: `Series/override not visible in saved view "${params.viewApplied}"`,
      });
      continue;
    }

    const exdates = Array.from(
      new Set([...(seriesTask.recurrence?.exdates ?? []), occurrenceIso]),
    ).sort((left, right) => left.localeCompare(right));
    state.tasks[seriesTaskIndex] = {
      ...seriesTask,
      recurrence: {
        ...(seriesTask.recurrence as NonNullable<Task["recurrence"]>),
        exdates,
      },
      updatedAt: params.nowMs,
    };
    state.taskLookup = buildTaskLookup(state.tasks);

    const instanceMatch =
      params.mode === "create"
        ? undefined
        : resolveInstanceMatch(
            event,
            state.tasks[seriesTaskIndex],
            occurrenceIso,
            state.taskLookup,
          );

    if (event.status === "CANCELLED") {
      let cancelledAny = false;
      for (let i = 0; i < state.tasks.length; i += 1) {
        const task = state.tasks[i];
        if (
          task.instance_of?.series_id ===
            state.tasks[seriesTaskIndex].recurrence?.series_id &&
          task.instance_of?.occurrence === occurrenceIso &&
          task.status === "open"
        ) {
          state.tasks[i] = {
            ...task,
            status: "done",
            closedAt: params.nowMs,
            updatedAt: params.nowMs,
          };
          cancelledAny = true;
        }
      }
      if (cancelledAny) {
        state.taskLookup = buildTaskLookup(state.tasks);
      }
      state.summary.cancellationsApplied += 1;
      pushReportEntry(state.reportEntries, {
        uid: event.uid,
        recurrenceId: occurrenceIso,
        action: "cancelled",
        match: seriesMatch.matchedBy,
        taskId: state.tasks[seriesTaskIndex].id,
      });
      continue;
    }

    const draft = mapEventToTaskDraft(event, {
      importTag: params.importTag,
    });
    const seriesId = state.tasks[seriesTaskIndex].recurrence?.series_id;
    if (!seriesId) {
      state.summary.errors += 1;
      pushReportEntry(state.reportEntries, {
        uid: event.uid,
        recurrenceId: occurrenceIso,
        action: "error",
        message: "Resolved series missing recurrence metadata",
      });
      continue;
    }

    const baseUid = event.relatedTo?.trim() || event.uid?.trim();
    const draftForInstance = {
      ...draft,
      recurrenceId: occurrenceIso,
      ...(baseUid ? { seriesUid: baseUid } : {}),
    };

    if (!instanceMatch || params.mode === "create") {
      let created = createTaskFromDraft(
        draftForInstance,
        params.nowMs,
        params.importedAtIso,
      );
      created = {
        ...created,
        instance_of: {
          series_id: seriesId,
          occurrence: occurrenceIso,
        },
        external: {
          ...created.external,
          calendar: {
            ...(created.external?.calendar ?? {}),
            uid:
              event.uid?.trim() ||
              created.external?.calendar?.uid ||
              crypto.randomUUID(),
            source: "ics-import",
            ...(draftForInstance.timeZone
              ? { tzid: draftForInstance.timeZone }
              : {}),
            lastImportedAt: params.importedAtIso,
            recurrenceId: occurrenceIso,
            ...(baseUid ? { seriesUid: baseUid } : {}),
            lastImportedHash: created.external?.calendar?.lastImportedHash,
          },
        },
      };

      if (
        params.view &&
        !isTaskVisibleInView(
          created,
          state.tasks,
          params.view,
          params.nowMs,
          state.taskLookup.indexById,
        )
      ) {
        state.summary.skipped += 1;
        pushReportEntry(state.reportEntries, {
          uid: event.uid,
          recurrenceId: occurrenceIso,
          action: "skipped",
          message: `Override not visible in saved view "${params.viewApplied}"`,
        });
        continue;
      }

      state.taskLookup = appendTask(state.tasks, created);
      state.summary.created += 1;
      state.summary.overridesCreated += 1;
      pushReportEntry(state.reportEntries, {
        uid: event.uid,
        recurrenceId: occurrenceIso,
        action: "created",
        match: instanceMatch?.matchedBy ?? "none",
        taskId: created.id,
      });
      continue;
    }

    const importedAtReference = getImportedAtReference(instanceMatch.task);
    const allowOverwrite =
      importedAtReference === undefined ||
      instanceMatch.task.updatedAt <= importedAtReference ||
      instanceMatch.matchedBy === "x-task-id" ||
      instanceMatch.matchedBy === "uid";
    const merged = mergeTaskFromDraft(instanceMatch.task, draftForInstance, {
      nowMs: params.nowMs,
      importedAtIso: params.importedAtIso,
      mode: params.mode === "update" ? "update" : "merge",
      allowOverwrite,
    });
    const mergedTaskWithInstance: Task = {
      ...merged.task,
      instance_of: {
        series_id: seriesId,
        occurrence: occurrenceIso,
      },
    };

    if (
      params.view &&
      !isTaskVisibleInView(
        mergedTaskWithInstance,
        state.tasks,
        params.view,
        params.nowMs,
        state.taskLookup.indexById,
      )
    ) {
      state.summary.skipped += 1;
      pushReportEntry(state.reportEntries, {
        uid: event.uid,
        recurrenceId: occurrenceIso,
        action: "skipped",
        match: instanceMatch.matchedBy,
        taskId: instanceMatch.task.id,
        message: `Override not visible in saved view "${params.viewApplied}"`,
      });
      continue;
    }

    state.taskLookup = replaceTaskById(
      state.tasks,
      state.taskLookup,
      mergedTaskWithInstance,
    );

    if (merged.action === "updated") {
      state.summary.updated += 1;
      state.summary.overridesUpdated += 1;
    } else if (merged.action === "merged") {
      state.summary.merged += 1;
      state.summary.overridesUpdated += 1;
    } else {
      state.summary.skipped += 1;
    }

    pushReportEntry(state.reportEntries, {
      uid: event.uid,
      recurrenceId: occurrenceIso,
      action: merged.action,
      match: instanceMatch.matchedBy,
      taskId: instanceMatch.task.id,
      ...(merged.conflicts.length > 0 ? { conflicts: merged.conflicts } : {}),
    });
  }

  return {
    tasks: state.tasks,
    summary: state.summary,
    reportEntries: state.reportEntries,
  };
}
