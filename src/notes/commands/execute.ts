import { getHelpLine } from "../../commands/help";
import type { NoteCommand } from "../../commands/types";
import type { NotesSettings } from "../../settings/settings";
import {
  buildCaptureAppendBlock,
  mergeCaptureBody,
  resolveLinkTargetTaskId,
  resolveNotesRootPath,
  resolveTemplateContent,
  upsertFrontmatter,
  withTitleSeed,
} from "./capture";
import {
  formatGraphText,
  formatOpenFallbackAmbiguousText,
  formatOpenResultText,
  formatSearchResultText,
} from "./format";
import {
  error,
  indexNotesByPath,
  ok,
  type ExecuteNoteCommandContext,
  type ExecuteNoteCommandResult,
  type NoteTaskSideEffects,
} from "./shared";
import {
  findNoteSearchMatches,
  parseNoteSearchQuery,
  resolveOpenQuery,
} from "./search";

export async function executeNoteCommand(
  command: NoteCommand,
  context: ExecuteNoteCommandContext,
): Promise<ExecuteNoteCommandResult> {
  if (command.operation === "help") {
    return ok(getHelpLine("note"), {
      data: {
        operation: "help",
      },
    });
  }

  if (!context.notesSettings.enabled && command.operation !== "root_set") {
    return error("Error: TOME is disabled in settings");
  }

  if (command.operation === "new" || command.operation === "template") {
    const templateId =
      command.operation === "template" ? command.template : command.template;
    const title =
      command.operation === "template"
        ? command.title?.trim() ||
          `${command.template}-${new Date().toISOString().slice(0, 10)}`
        : command.title.trim();
    if (!title) {
      return error(
        'Error: note new requires a title (example: note new "Title")',
      );
    }

    const templateContent = templateId
      ? await resolveTemplateContent(context.service, templateId)
      : null;
    const seededContent = templateContent
      ? withTitleSeed(templateContent.content, title)
      : `# ${title}\n\n`;
    const content = upsertFrontmatter(seededContent, { title });
    const created = await context.service.createNote(title, content);
    const note = context.service.getParsedNote(created.path)?.note;
    const templateSuffix =
      templateId && !templateContent
        ? ` (template "${templateId}" not found; used default seed)`
        : templateContent
          ? ` (template: ${templateContent.path})`
          : "";
    return ok(`Note created: ${created.path}${templateSuffix}`, {
      notePath: created.path,
      noteId: note?.id,
      path: created.path,
      title,
      data: {
        operation: command.operation,
        noteId: note?.id,
        path: created.path,
        title,
      },
    });
  }

  if (command.operation === "quick") {
    const title = command.title.trim();
    if (!title) {
      return error(
        'Error: note quick requires a title (example: note q "Title" "Body")',
      );
    }

    const capturedAt = new Date().toISOString();
    const linkedTaskId = resolveLinkTargetTaskId(command, context);
    const taskContext =
      linkedTaskId && context.resolveTaskContext
        ? ((await context.resolveTaskContext(linkedTaskId)) ?? null)
        : null;
    const includeTaskLink = Boolean(linkedTaskId) && !command.noLink;
    const mergedBody = mergeCaptureBody({
      body: command.body ?? command.stdinBody,
      inlineTaskNotes: command.fromTaskNotes
        ? taskContext?.inlineNotes
        : undefined,
    });
    const requestedCaptureMode = command.captureMode;
    const effectiveCaptureMode =
      requestedCaptureMode === "append" || requestedCaptureMode === "new"
        ? requestedCaptureMode
        : "new";
    const primaryNotePath = taskContext?.primaryNotePath;

    if (effectiveCaptureMode === "append" && primaryNotePath) {
      const existing = await context.service.getNoteContent(primaryNotePath);
      if (existing) {
        const appendBlock = buildCaptureAppendBlock({
          capturedAt,
          title,
          ...(mergedBody ? { body: mergedBody } : {}),
          linkedTaskId,
          includeTaskLink,
        });
        const saved = await context.service.saveNote(
          primaryNotePath,
          `${existing.content.trimEnd()}\n\n${appendBlock}`,
        );
        const note = context.service.getParsedNote(saved.path)?.note;
        const taskSideEffects: NoteTaskSideEffects | undefined = linkedTaskId
          ? {
              taskId: linkedTaskId,
              primaryNoteAction: includeTaskLink
                ? command.setPrimary
                  ? "set"
                  : "keep"
                : "none",
              ...(includeTaskLink ? { primaryNotePath: saved.path } : {}),
              ...(command.clearTaskNotes ? { clearInlineNotes: true } : {}),
            }
          : undefined;
        return ok(`Quick note captured: ${saved.path} (appended)`, {
          notePath: saved.path,
          noteId: note?.id,
          path: saved.path,
          title: note?.title ?? title,
          capturedAt,
          ...(taskSideEffects ? { taskSideEffects } : {}),
          data: {
            operation: "quick",
            captureMode: "append",
            noteId: note?.id,
            path: saved.path,
            title: note?.title ?? title,
            capturedAt,
            linkedTaskId,
            ...(taskSideEffects ? { taskSideEffects } : {}),
          },
        });
      }
    }

    const templateContent = command.template
      ? await resolveTemplateContent(context.service, command.template)
      : null;
    let seededContent = templateContent
      ? withTitleSeed(templateContent.content, title)
      : `# ${title}\n\n`;
    if (mergedBody) {
      seededContent = `${seededContent.trimEnd()}\n\n${mergedBody}\n`;
    }

    if (includeTaskLink && linkedTaskId) {
      seededContent = `${seededContent.trimEnd()}\n\nLinked task: @task:${linkedTaskId}\n`;
    }

    const metadata = { ...command.metadata };
    const captureSource =
      metadata["capture.source"] ??
      metadata.source ??
      context.captureSource ??
      "quick";
    const captureTimestamp = metadata["capture.timestamp"] ?? capturedAt;
    delete metadata["capture.source"];
    delete metadata["capture.timestamp"];
    delete metadata.source;

    const content = upsertFrontmatter(seededContent, {
      title,
      tags: command.tags,
      aliases: command.aliases,
      status: command.status,
      captureSource,
      captureTimestamp,
      metadata,
    });
    const created = await context.service.createNote(title, content);
    const note = context.service.getParsedNote(created.path)?.note;
    const taskSideEffects: NoteTaskSideEffects | undefined = linkedTaskId
      ? {
          taskId: linkedTaskId,
          primaryNoteAction: includeTaskLink
            ? primaryNotePath && !command.setPrimary
              ? "keep"
              : "set"
            : "none",
          ...(includeTaskLink
            ? {
                primaryNotePath:
                  primaryNotePath && !command.setPrimary
                    ? primaryNotePath
                    : created.path,
              }
            : {}),
          ...(command.clearTaskNotes ? { clearInlineNotes: true } : {}),
        }
      : undefined;
    const createdPayload = {
      noteId: note?.id,
      path: created.path,
      title,
      capturedAt,
      linkedTaskId,
      captureMode: effectiveCaptureMode,
      template: templateContent?.path ?? null,
    };
    return ok(`Quick note captured: ${created.path}`, {
      notePath: created.path,
      noteId: note?.id,
      path: created.path,
      title,
      capturedAt,
      ...(taskSideEffects ? { taskSideEffects } : {}),
      data: {
        operation: "quick",
        ...createdPayload,
        ...(taskSideEffects ? { taskSideEffects } : {}),
      },
    });
  }

  if (command.operation === "open") {
    const notes = context.service.listNotes();
    const snapshot = context.service.getIndexSnapshot();
    const noteLookup = indexNotesByPath(notes);
    const resolved = resolveOpenQuery(notes, snapshot, command.query);
    if (!resolved.ok) {
      const parsedQuery = parseNoteSearchQuery(command.query);
      const searchMatches = findNoteSearchMatches(notes, parsedQuery, {
        snapshot,
        service: context.service,
      });
      if (
        resolved.text.startsWith("Error: note not found") &&
        searchMatches.length === 1
      ) {
        const [matchedPath] = searchMatches;
        const note = snapshot.notesByPath.get(matchedPath);
        return ok(
          formatOpenResultText({
            resolvedPath: matchedPath,
            matchKind: "fuzzy",
            noteLookup,
            snapshot,
            service: context.service,
          }),
          {
            notePath: matchedPath,
            noteId: note?.id,
            path: matchedPath,
            title: note?.title,
            data: {
              operation: "open",
              path: matchedPath,
              noteId: note?.id,
            },
          },
        );
      }
      if (
        resolved.text.startsWith("Error: note not found") &&
        searchMatches.length > 1
      ) {
        return error(
          formatOpenFallbackAmbiguousText({
            query: command.query,
            matches: searchMatches,
            noteLookup,
            snapshot,
          }),
        );
      }
      return error(resolved.text);
    }

    const note = snapshot.notesByPath.get(resolved.path);
    return ok(
      formatOpenResultText({
        resolvedPath: resolved.path,
        matchKind: resolved.matchKind,
        noteLookup,
        snapshot,
        service: context.service,
      }),
      {
        notePath: resolved.path,
        noteId: note?.id,
        path: resolved.path,
        title: note?.title,
        data: {
          operation: "open",
          path: resolved.path,
          noteId: note?.id,
        },
      },
    );
  }

  if (command.operation === "search" || command.operation === "query") {
    const rawQuery = command.query.trim();
    if (!rawQuery) {
      return error(`Error: note ${command.operation} requires a query`);
    }
    const notes = context.service.listNotes();
    const snapshot = context.service.getIndexSnapshot();
    const noteLookup = indexNotesByPath(notes);
    const parsedQuery = command.filters ?? parseNoteSearchQuery(rawQuery);
    const matches = findNoteSearchMatches(notes, parsedQuery, {
      snapshot,
      service: context.service,
    });
    if (matches.length === 0) {
      return ok(`No TOME notes match "${rawQuery}"`, {
        matches: [],
        data: {
          operation: command.operation,
          query: rawQuery,
          matches: [],
        },
      });
    }
    return ok(
      formatSearchResultText({
        rawQuery,
        matches,
        noteLookup,
        snapshot,
        limit: parsedQuery.limit,
      }),
      {
        matches,
        data: {
          operation: command.operation,
          query: rawQuery,
          matches: matches.map((pathValue) => {
            const note = snapshot.notesByPath.get(pathValue);
            return {
              path: pathValue,
              noteId: note?.id,
              title: note?.title ?? noteLookup.get(pathValue)?.title,
            };
          }),
        },
      },
    );
  }

  if (command.operation === "graph" || command.operation === "links") {
    const notes = context.service.listNotes();
    const snapshot = context.service.getIndexSnapshot();
    const noteLookup = indexNotesByPath(notes);
    const resolved = resolveOpenQuery(notes, snapshot, command.query);
    if (!resolved.ok) {
      return error(resolved.text);
    }

    const outgoingResolved = Array.from(
      new Set(
        context.service
          .getResolvedOutgoingRefs(resolved.path)
          .map((ref) => ref.toResolved)
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort((left, right) => left.localeCompare(right));
    const incomingResolved = context.service.getBacklinks(resolved.path);
    const limit = command.limit;
    const outgoing =
      limit !== undefined ? outgoingResolved.slice(0, limit) : outgoingResolved;
    const incoming =
      limit !== undefined ? incomingResolved.slice(0, limit) : incomingResolved;

    const text = formatGraphText({
      query: command.query,
      notePath: resolved.path,
      direction: command.direction,
      outgoing,
      incoming,
      noteLookup,
      snapshot,
    });
    const note = snapshot.notesByPath.get(resolved.path);
    return ok(text, {
      notePath: resolved.path,
      noteId: note?.id,
      path: resolved.path,
      title: note?.title,
      data: {
        operation: command.operation,
        query: command.query,
        direction: command.direction,
        path: resolved.path,
        noteId: note?.id,
        outgoing: outgoing.map((pathValue) => ({
          path: pathValue,
          noteId: snapshot.notesByPath.get(pathValue)?.id,
        })),
        incoming: incoming.map((pathValue) => ({
          path: pathValue,
          noteId: snapshot.notesByPath.get(pathValue)?.id,
        })),
      },
    });
  }

  if (command.operation === "delete") {
    const notes = context.service.listNotes();
    const snapshot = context.service.getIndexSnapshot();
    const resolved = resolveOpenQuery(notes, snapshot, command.query);
    if (!resolved.ok) {
      return error(resolved.text);
    }

    const deleted = await context.service.deleteNote(resolved.path);
    if (!deleted) {
      return error(`Error: note not found for query "${command.query}"`);
    }
    return ok(`Note deleted: ${resolved.path}`, {
      notePath: resolved.path,
      path: resolved.path,
      data: {
        operation: "delete",
        path: resolved.path,
      },
    });
  }

  if (command.operation === "restore_defaults") {
    const restored =
      await context.service.restoreDefaultGuideDocs("restore_missing");
    if (restored.createdPaths.length === 0) {
      return ok("Default TOME guide docs already present", {
        data: {
          operation: "restore_defaults",
          createdPaths: [],
        },
      });
    }
    return ok(`Restored default docs: ${restored.createdPaths.join(", ")}`, {
      data: {
        operation: "restore_defaults",
        createdPaths: restored.createdPaths,
      },
    });
  }

  if (command.operation === "reindex") {
    await context.service.reindexAll();
    const total = context.service.listNotes().length;
    return ok(`TOME reindex complete (${String(total)} notes)`, {
      data: {
        operation: "reindex",
        total,
      },
    });
  }

  if (!context.createBackup || !context.persistNotesSettings) {
    return error("Error: note root set is not available in this context");
  }

  const inputPath = command.path.trim();
  if (!inputPath) {
    return error(
      'Error: note root set requires a path (example: note root set "/path/to/notes")',
    );
  }

  const nextRoot = resolveNotesRootPath(context.dataFilePath, inputPath);
  await context.createBackup(context.dataFilePath);
  await context.service.migrateNotesRootCopyFirst(nextRoot);
  const nextSettings: NotesSettings = {
    enabled: context.notesSettings.enabled,
    rootPath: nextRoot,
  };
  await context.persistNotesSettings(nextSettings);
  return ok(`TOME root migrated to ${nextRoot}`, {
    notesRoot: nextRoot,
    data: {
      operation: "root_set",
      notesRoot: nextRoot,
    },
  });
}
