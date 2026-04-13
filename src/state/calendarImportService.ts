import {
  createDefaultLockPayload,
  getTadoiLockPath,
  isTadoiLockOwnedByProcess,
  removeTadoiLock,
  TadoiLockBusyError,
  tryAcquireTadoiLock,
} from "./lockfile";
import {
  loadStateStrict,
  resolveDataPath,
  saveStateAtomic,
  StateRevisionConflictError,
} from "./persistence";
import { recomputeTagIndex } from "./portability";
import { validatePersistedState } from "./validation";
import { applyCalendarImportEvents } from "./calendarImport/apply";
import {
  buildStaleLockRecoveredWarning,
  coerceHorizonDays,
  loadSettingsWarnings,
  readParsedIcsInput,
  resolveImportRangeWindow,
  resolveViewContext,
} from "./calendarImport/input";
import { maybeWriteReport } from "./calendarImport/report";
import {
  CalendarImportFilesystemError,
  CalendarImportUsageError,
  type CalendarImportOptions,
  type CalendarImportReport,
  type CalendarImportResult,
  type CalendarImportSummary,
  DEFAULT_MAX_IMPORT_BYTES_ICS,
  toErrorMessage,
} from "./calendarImport/shared";

export {
  CalendarImportDomainError,
  CalendarImportFilesystemError,
  CalendarImportUsageError,
  DEFAULT_MAX_IMPORT_BYTES_ICS,
  type CalendarImportOptions,
  type CalendarImportReport,
  type CalendarImportReportEntry,
  type CalendarImportResult,
  type CalendarImportSummary,
} from "./calendarImport/shared";

export async function importCalendarIcs(
  options: CalendarImportOptions,
): Promise<CalendarImportResult> {
  const warnings: string[] = [];
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const importedAtIso = now.toISOString();
  const cwd = options.cwd ?? process.cwd();
  const range = options.range ?? "next7";
  const mode = options.mode ?? "merge";
  const dryRun = options.dryRun === true;
  const horizonDays = coerceHorizonDays(options.horizonDays);

  if (mode !== "merge" && mode !== "update" && mode !== "create") {
    throw new CalendarImportUsageError(
      "--mode must be merge, update, or create",
    );
  }

  const { inputPath, parsed } = await readParsedIcsInput({
    inputPath: options.inputPath,
    cwd,
    maxImportBytes: options.maxImportBytes ?? DEFAULT_MAX_IMPORT_BYTES_ICS,
  });

  const resolvedDataPath = resolveDataPath();
  const lockPath = getTadoiLockPath(resolvedDataPath);
  let lockAcquired = false;
  if (!dryRun) {
    const lockOwnedByCurrentProcess = await isTadoiLockOwnedByProcess(
      lockPath,
      process.pid,
      resolvedDataPath,
    );
    if (!lockOwnedByCurrentProcess) {
      lockAcquired = await tryAcquireTadoiLock(
        lockPath,
        createDefaultLockPayload(resolvedDataPath),
        {
          onStaleLockRecovered: (event) => {
            warnings.push(buildStaleLockRecoveredWarning(event));
          },
        },
      );
      if (!lockAcquired) {
        throw new TadoiLockBusyError(lockPath);
      }
    }
  }

  try {
    let stateResult: Awaited<ReturnType<typeof loadStateStrict>>;
    try {
      stateResult = await loadStateStrict({ filePath: resolvedDataPath });
    } catch (error: unknown) {
      throw new CalendarImportFilesystemError(toErrorMessage(error));
    }

    warnings.push(...(await loadSettingsWarnings()));

    const tasks = stateResult.data.tasks.map((task) => ({ ...task }));
    const viewContext = resolveViewContext({
      options,
      stateResult,
      tasks,
      nowMs,
    });
    const rangeWindow = resolveImportRangeWindow(range, nowMs);

    const applied = applyCalendarImportEvents({
      parsedEvents: parsed.events,
      tasks,
      nowMs,
      importedAtIso,
      range,
      rangeWindow,
      mode,
      horizonDays,
      importTag: options.importTag,
      view: viewContext.view,
      viewApplied: viewContext.viewApplied,
      visibleSourceIds: viewContext.visibleSourceIds,
    });

    const report: CalendarImportReport = {
      generatedAt: importedAtIso,
      inputPath,
      range,
      mode,
      dryRun,
      horizonDays,
      ...(viewContext.viewApplied ? { viewApplied: viewContext.viewApplied } : {}),
      summary: applied.summary,
      entries: applied.reportEntries,
      persisted: false,
    };

    if (!dryRun && applied.summary.errors === 0) {
      const nextState = {
        ...stateResult.data,
        tasks: applied.tasks,
        tagIndex: recomputeTagIndex(applied.tasks, nowMs),
      };
      if (process.env.NODE_ENV !== "production") {
        const validation = validatePersistedState(nextState, "strict");
        if (!validation.ok) {
          throw new CalendarImportFilesystemError(
            `Post-import state validation failed: ${validation.errors.join("; ")}`,
          );
        }
      }
      try {
        await saveStateAtomic(nextState, resolvedDataPath, undefined, {
          expectedStateRevision: stateResult.data.stateRevision,
        });
        report.persisted = true;
      } catch (error: unknown) {
        if (error instanceof StateRevisionConflictError) {
          throw new CalendarImportFilesystemError(
            `Concurrent state update detected (expected revision ${String(error.expectedRevision)}, found ${String(error.actualRevision)}). Re-run dry-run and commit again.`,
          );
        }
        throw new CalendarImportFilesystemError(
          `Failed to persist imported state: ${toErrorMessage(error)}`,
        );
      }
    }

    let outputReportPath: string | undefined;
    try {
      outputReportPath = await maybeWriteReport(options.reportPath, report, cwd);
    } catch (error: unknown) {
      warnings.push(`Failed to write import report: ${toErrorMessage(error)}`);
    }

    return {
      summary: applied.summary,
      report,
      ...(outputReportPath ? { outputReportPath } : {}),
      hasErrors: applied.summary.errors > 0,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  } finally {
    if (lockAcquired) {
      await removeTadoiLock(lockPath);
    }
  }
}
