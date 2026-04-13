import type { NotePath, ParsedNote } from "./types";

export type NoteMention = {
  from: NotePath;
  line: number;
  excerpt: string;
};

function stripCodeFences(markdown: string): string {
  return markdown.replace(/```[\s\S]*?```/g, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildMentionPatterns(terms: string[]): RegExp[] {
  const unique = Array.from(
    new Set(terms.map((term) => term.trim()).filter((term) => term.length > 0)),
  );
  return unique.map((term) => new RegExp(`\\b${escapeRegExp(term)}\\b`, "i"));
}

export function findUnlinkedMentions(options: {
  targetPath: NotePath;
  targetTitle: string;
  targetAliases?: string[];
  notes: Map<NotePath, ParsedNote>;
  excludeCodeFences?: boolean;
  hideWhenLinked?: boolean;
}): NoteMention[] {
  const mentions: NoteMention[] = [];
  const patterns = buildMentionPatterns([
    options.targetTitle,
    ...(options.targetAliases ?? []),
  ]);
  if (patterns.length === 0) return mentions;

  for (const [path, parsed] of options.notes.entries()) {
    if (path === options.targetPath) continue;

    if (
      options.hideWhenLinked &&
      parsed.outgoingNoteRefs.some(
        (ref) => ref.toResolved === options.targetPath,
      )
    ) {
      continue;
    }

    const source =
      options.excludeCodeFences === false
        ? parsed.content
        : stripCodeFences(parsed.content);
    const lines = source.split(/\r?\n/);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex] ?? "";
      if (!line.trim()) continue;
      const hasHit = patterns.some((pattern) => pattern.test(line));
      if (!hasHit) continue;

      mentions.push({
        from: path,
        line: lineIndex + 1,
        excerpt: line.trim(),
      });
      break;
    }
  }

  return mentions;
}
