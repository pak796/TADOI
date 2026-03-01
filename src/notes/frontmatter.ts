export type ParsedFrontmatter = {
  id?: string;
  title?: string;
  tags?: string[];
  aliases?: string[];
  created?: string;
  updated?: string;
};

export type FrontmatterParseResult = {
  frontmatter: ParsedFrontmatter;
  body: string;
  warnings: string[];
};

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseArrayInline(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return [];
  }
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return [];
  return inner
    .split(",")
    .map((item) => unquote(item))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseArrayBlock(lines: string[], start: number): { values: string[]; nextIndex: number } {
  const values: string[] = [];
  let index = start;
  while (index < lines.length) {
    const line = lines[index];
    const match = line.match(/^\s*-\s*(.+)\s*$/);
    if (!match) {
      break;
    }
    const value = unquote(match[1]);
    if (value.trim().length > 0) {
      values.push(value.trim());
    }
    index += 1;
  }
  return { values, nextIndex: index };
}

function parseFrontmatterBlock(raw: string): { frontmatter: ParsedFrontmatter; warnings: string[] } {
  const lines = raw.split(/\r?\n/);
  const record: Record<string, string | string[]> = {};
  const warnings: string[] = [];

  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trimEnd();
    index += 1;

    if (!line.trim() || line.trim().startsWith("#")) {
      continue;
    }

    const match = line.match(/^([A-Za-z0-9_]+)\s*:\s*(.*)$/);
    if (!match) {
      warnings.push(`Unrecognized frontmatter line: ${line}`);
      continue;
    }

    const key = match[1].toLowerCase();
    const rawValue = match[2] ?? "";

    if (rawValue.trim().length === 0) {
      const block = parseArrayBlock(lines, index);
      if (block.values.length > 0) {
        record[key] = block.values;
        index = block.nextIndex;
      } else {
        record[key] = "";
      }
      continue;
    }

    const inlineArray = parseArrayInline(rawValue);
    if (inlineArray.length > 0 || rawValue.trim() === "[]") {
      record[key] = inlineArray;
      continue;
    }

    record[key] = unquote(rawValue);
  }

  const parsed: ParsedFrontmatter = {};

  const id = typeof record.id === "string" ? record.id.trim() : "";
  if (id) parsed.id = id;

  const title = typeof record.title === "string" ? record.title.trim() : "";
  if (title) parsed.title = title;

  const created = typeof record.created === "string" ? record.created.trim() : "";
  if (created) parsed.created = created;

  const updated = typeof record.updated === "string" ? record.updated.trim() : "";
  if (updated) parsed.updated = updated;

  const tags = Array.isArray(record.tags)
    ? record.tags
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    : [];
  if (tags.length > 0) parsed.tags = tags;

  const aliases = Array.isArray(record.aliases)
    ? record.aliases
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    : [];
  if (aliases.length > 0) parsed.aliases = aliases;

  return {
    frontmatter: parsed,
    warnings
  };
}

export function parseFrontmatter(content: string): FrontmatterParseResult {
  if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) {
    return {
      frontmatter: {},
      body: content,
      warnings: []
    };
  }

  const lines = content.split(/\r?\n/);
  let closingLine = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === "---") {
      closingLine = index;
      break;
    }
  }

  if (closingLine === -1) {
    return {
      frontmatter: {},
      body: content,
      warnings: ["Frontmatter start marker found but no closing marker."]
    };
  }

  const frontmatterRaw = lines.slice(1, closingLine).join("\n");
  const body = lines.slice(closingLine + 1).join("\n");
  const parsed = parseFrontmatterBlock(frontmatterRaw);
  return {
    frontmatter: parsed.frontmatter,
    body,
    warnings: parsed.warnings
  };
}

function findFrontmatterClosingLine(lines: string[]): number {
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === "---") {
      return index;
    }
  }
  return -1;
}

function removeTagsField(lines: string[]): string[] {
  const next: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const tagLineMatch = line.match(/^\s*tags\s*:\s*(.*)$/i);
    if (!tagLineMatch) {
      next.push(line);
      continue;
    }

    const rest = (tagLineMatch[1] ?? "").trim();
    if (rest.length === 0) {
      let scan = index + 1;
      while (scan < lines.length && /^\s*-\s+/.test(lines[scan])) {
        scan += 1;
      }
      index = scan - 1;
    }
  }
  return next;
}

function insertTagsField(lines: string[], tags: string[]): string[] {
  if (tags.length === 0) return lines;
  const tagLine = `tags: [${tags.join(", ")}]`;

  const titleIndex = lines.findIndex((line) => /^\s*title\s*:/.test(line));
  if (titleIndex >= 0) {
    return [...lines.slice(0, titleIndex + 1), tagLine, ...lines.slice(titleIndex + 1)];
  }

  const idIndex = lines.findIndex((line) => /^\s*id\s*:/.test(line));
  if (idIndex >= 0) {
    return [...lines.slice(0, idIndex + 1), tagLine, ...lines.slice(idIndex + 1)];
  }

  return [tagLine, ...lines];
}

export function upsertFrontmatterTags(content: string, tags: string[]): string {
  const deduped = Array.from(new Set(tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0)));
  const lines = content.split(/\r?\n/);

  const hasFrontmatterStart =
    content.startsWith("---\n") ||
    content.startsWith("---\r\n") ||
    (lines.length > 0 && lines[0].trim() === "---");

  if (!hasFrontmatterStart) {
    if (deduped.length === 0) return content;
    return `---\ntags: [${deduped.join(", ")}]\n---\n\n${content}`;
  }

  const closingLine = findFrontmatterClosingLine(lines);
  if (closingLine === -1) {
    return content;
  }

  const frontmatterLines = lines.slice(1, closingLine);
  const bodyLines = lines.slice(closingLine + 1);
  const strippedFrontmatter = removeTagsField(frontmatterLines);
  const nextFrontmatter = insertTagsField(strippedFrontmatter, deduped);

  if (nextFrontmatter.length === 0) {
    return bodyLines.join("\n");
  }

  return ["---", ...nextFrontmatter, "---", ...bodyLines].join("\n");
}
