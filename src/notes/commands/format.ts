import path from "path";
import type { NoteLinkDirection } from "../../commands/types";
import type { NotesService } from "../service";
import type { NoteGraphIndex, NoteListItem, NotePath } from "../types";

export function candidateLabels(
  paths: NotePath[],
  noteLookup: Map<NotePath, NoteListItem>,
  snapshot: NoteGraphIndex,
  options: { max?: number } = {},
): string {
  const max = options.max ?? 8;
  const preview = paths.slice(0, max);
  const lines = preview.map((pathValue, index) => {
    const listNote = noteLookup.get(pathValue);
    const graphNote = snapshot.notesByPath.get(pathValue);
    const title =
      listNote?.title ??
      graphNote?.title ??
      path.posix.basename(pathValue, ".md");
    const idToken = graphNote?.id ? ` [id:${graphNote.id}]` : "";
    return `${String(index + 1)}. ${title} (${pathValue})${idToken}`;
  });
  if (paths.length > max) {
    lines.push(`... +${String(paths.length - max)} more`);
  }
  return lines.join("\n");
}

export function formatNoteSummaryLine(
  pathValue: NotePath,
  noteLookup: Map<NotePath, NoteListItem>,
  snapshot: NoteGraphIndex,
): string {
  const listNote = noteLookup.get(pathValue);
  const graphNote = snapshot.notesByPath.get(pathValue);
  const title =
    listNote?.title ??
    graphNote?.title ??
    path.posix.basename(pathValue, ".md");
  const idToken = graphNote?.id ? ` [id:${graphNote.id}]` : "";
  const tags = listNote?.tags ?? graphNote?.tags ?? [];
  const tagsToken =
    tags.length > 0
      ? ` [tags:${tags.slice(0, 3).join(",")}${tags.length > 3 ? ",..." : ""}]`
      : "";
  return `${title} (${pathValue})${idToken}${tagsToken}`;
}

export function formatOpenResultText(options: {
  resolvedPath: NotePath;
  matchKind: "id" | "path" | "title" | "fuzzy";
  noteLookup: Map<NotePath, NoteListItem>;
  snapshot: NoteGraphIndex;
  service: NotesService;
}): string {
  const { resolvedPath, matchKind, noteLookup, snapshot, service } = options;
  const noteMeta = snapshot.notesByPath.get(resolvedPath);
  const title =
    noteLookup.get(resolvedPath)?.title ??
    noteMeta?.title ??
    path.posix.basename(resolvedPath, ".md");
  const outRefs = service.getResolvedOutgoingRefs(resolvedPath);
  const resolvedOutCount = outRefs.filter((ref) =>
    Boolean(ref.toResolved),
  ).length;
  const brokenOutCount = outRefs.filter((ref) => !ref.toResolved).length;
  const backlinks = service.getBacklinks(resolvedPath);
  const linkedTasks = service.getLinkedTasksForNote(resolvedPath);
  const aliases = noteMeta?.aliases ?? [];
  const tags = noteLookup.get(resolvedPath)?.tags ?? noteMeta?.tags ?? [];
  const resolvedOutTargets = outRefs
    .map((ref) => ref.toResolved)
    .filter((pathValue): pathValue is NotePath => Boolean(pathValue));

  const lines: string[] = [
    `Opened note (${matchKind}): ${title}`,
    `Path: ${resolvedPath}`,
  ];
  if (noteMeta?.id) {
    lines.push(`ID: ${noteMeta.id}`);
  }
  if (aliases.length > 0) {
    lines.push(
      `Aliases: ${aliases.slice(0, 4).join(", ")}${aliases.length > 4 ? ", ..." : ""}`,
    );
  }
  if (tags.length > 0) {
    lines.push(`Tags: ${tags.join(", ")}`);
  }
  lines.push(
    `Graph: out=${String(resolvedOutCount)} back=${String(backlinks.length)} tasks=${String(linkedTasks.length)} broken=${String(brokenOutCount)}`,
  );
  if (resolvedOutTargets.length > 0) {
    const preview = resolvedOutTargets
      .slice(0, 3)
      .map((pathValue) =>
        formatNoteSummaryLine(pathValue, noteLookup, snapshot),
      );
    lines.push(
      `Outgoing links: ${preview.join(" | ")}${resolvedOutTargets.length > 3 ? " | ..." : ""}`,
    );
  }
  if (backlinks.length > 0) {
    const preview = backlinks
      .slice(0, 3)
      .map((pathValue) =>
        formatNoteSummaryLine(pathValue, noteLookup, snapshot),
      );
    lines.push(
      `Backlinks: ${preview.join(" | ")}${backlinks.length > 3 ? " | ..." : ""}`,
    );
  }
  if (linkedTasks.length > 0) {
    lines.push(
      `Linked tasks: ${linkedTasks.slice(0, 5).join(", ")}${linkedTasks.length > 5 ? ", ..." : ""}`,
    );
  }
  if (brokenOutCount > 0) {
    lines.push("Broken links present. Use TOME view warnings for details.");
  }
  return lines.join("\n");
}

export function formatOpenFallbackAmbiguousText(options: {
  query: string;
  matches: NotePath[];
  noteLookup: Map<NotePath, NoteListItem>;
  snapshot: NoteGraphIndex;
}): string {
  return `Error: note open query "${options.query}" matched multiple notes.\n${candidateLabels(
    options.matches,
    options.noteLookup,
    options.snapshot,
  )}\nUse an exact title/path or id:<note-id>.`;
}

export function formatSearchResultText(options: {
  rawQuery: string;
  matches: NotePath[];
  noteLookup: Map<NotePath, NoteListItem>;
  snapshot: NoteGraphIndex;
  limit?: number;
}): string {
  const { rawQuery, matches, noteLookup, snapshot, limit } = options;
  const previewLimit = limit ?? 8;
  const lines = [
    `TOME search matches (${String(matches.length)}) for "${rawQuery}":`,
  ];
  const preview = matches.slice(0, previewLimit);
  for (let index = 0; index < preview.length; index += 1) {
    const pathValue = preview[index];
    lines.push(
      `${String(index + 1)}. ${formatNoteSummaryLine(pathValue, noteLookup, snapshot)}`,
    );
  }
  if (matches.length > previewLimit) {
    lines.push(`... +${String(matches.length - previewLimit)} more`);
  }
  return lines.join("\n");
}

export function formatGraphText(options: {
  query: string;
  notePath: NotePath;
  direction: NoteLinkDirection;
  outgoing: NotePath[];
  incoming: NotePath[];
  noteLookup: Map<NotePath, NoteListItem>;
  snapshot: NoteGraphIndex;
}): string {
  const lines: string[] = [
    `TOME graph for "${options.query}" (${options.direction})`,
    `Path: ${options.notePath}`,
  ];
  if (options.direction === "outgoing" || options.direction === "both") {
    lines.push(`Outgoing (${String(options.outgoing.length)}):`);
    if (options.outgoing.length === 0) {
      lines.push("- (none)");
    } else {
      for (const pathValue of options.outgoing) {
        lines.push(
          `- ${formatNoteSummaryLine(pathValue, options.noteLookup, options.snapshot)}`,
        );
      }
    }
  }
  if (options.direction === "incoming" || options.direction === "both") {
    lines.push(`Incoming (${String(options.incoming.length)}):`);
    if (options.incoming.length === 0) {
      lines.push("- (none)");
    } else {
      for (const pathValue of options.incoming) {
        lines.push(
          `- ${formatNoteSummaryLine(pathValue, options.noteLookup, options.snapshot)}`,
        );
      }
    }
  }
  return lines.join("\n");
}
