export type FrontmatterValue = string | string[];

export type ParsedFrontmatter = {
  id?: string;
  title?: string;
  tags?: string[];
  aliases?: string[];
  status?: string;
  capture?: {
    source?: string;
    timestamp?: string;
  };
  created?: string;
  updated?: string;
  extra: Record<string, FrontmatterValue>;
};

export type FrontmatterParseResult = {
  frontmatter: ParsedFrontmatter;
  raw: Record<string, FrontmatterValue>;
  body: string;
  warnings: string[];
};

export type FrontmatterUpsertPatch = {
  id?: string;
  title?: string;
  tags?: string[];
  aliases?: string[];
  status?: string;
  captureSource?: string;
  captureTimestamp?: string;
  created?: string;
  updated?: string;
  metadata?: Record<string, FrontmatterValue | undefined>;
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

function parseArrayBlock(
  lines: string[],
  start: number,
): { values: string[]; nextIndex: number } {
  const values: string[] = [];
  let index = start;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    const match = line.match(/^\s*-\s*(.+)\s*$/);
    if (!match) break;
    const value = unquote(match[1] ?? "");
    if (value.trim().length > 0) {
      values.push(value.trim());
    }
    index += 1;
  }
  return { values, nextIndex: index };
}

function normalizeString(
  value: FrontmatterValue | undefined,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeStringArray(
  value: FrontmatterValue | undefined,
): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = Array.from(
    new Set(value.map((item) => item.trim()).filter((item) => item.length > 0)),
  );
  return normalized.length > 0 ? normalized : undefined;
}

function parseFrontmatterBlock(raw: string): {
  record: Record<string, FrontmatterValue>;
  warnings: string[];
} {
  const lines = raw.split(/\r?\n/);
  const record: Record<string, FrontmatterValue> = {};
  const warnings: string[] = [];

  let index = 0;
  while (index < lines.length) {
    const line = (lines[index] ?? "").trimEnd();
    index += 1;
    if (!line.trim() || line.trim().startsWith("#")) {
      continue;
    }

    const match = line.match(/^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);
    if (!match) {
      warnings.push(`Unrecognized frontmatter line: ${line}`);
      continue;
    }

    const key = (match[1] ?? "").toLowerCase();
    const rawValue = match[2] ?? "";
    if (!key) {
      warnings.push(`Unrecognized frontmatter line: ${line}`);
      continue;
    }

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

  return { record, warnings };
}

function formatFrontmatterValue(value: FrontmatterValue): string {
  if (Array.isArray(value)) {
    return `[${value.join(", ")}]`;
  }
  return value;
}

function setOrDeleteString(
  record: Record<string, FrontmatterValue>,
  key: string,
  value: string | undefined,
): void {
  if (value === undefined) return;
  const normalized = value.trim();
  if (!normalized) {
    delete record[key];
    return;
  }
  record[key] = normalized;
}

function setOrDeleteArray(
  record: Record<string, FrontmatterValue>,
  key: string,
  values: string[] | undefined,
): void {
  if (values === undefined) return;
  const normalized = Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
  if (normalized.length === 0) {
    delete record[key];
    return;
  }
  record[key] = normalized;
}

function frontmatterToParsed(
  record: Record<string, FrontmatterValue>,
): ParsedFrontmatter {
  const parsed: ParsedFrontmatter = {
    extra: {},
  };

  const id = normalizeString(record.id);
  if (id) parsed.id = id;
  const title = normalizeString(record.title);
  if (title) parsed.title = title;
  const created = normalizeString(record.created);
  if (created) parsed.created = created;
  const updated = normalizeString(record.updated);
  if (updated) parsed.updated = updated;
  const status = normalizeString(record.status);
  if (status) parsed.status = status;

  const tags = normalizeStringArray(record.tags);
  if (tags) parsed.tags = tags;
  const aliases = normalizeStringArray(record.aliases);
  if (aliases) parsed.aliases = aliases;

  const captureSource = normalizeString(record["capture.source"]);
  const captureTimestamp = normalizeString(record["capture.timestamp"]);
  if (captureSource || captureTimestamp) {
    parsed.capture = {
      ...(captureSource ? { source: captureSource } : {}),
      ...(captureTimestamp ? { timestamp: captureTimestamp } : {}),
    };
  }

  const reservedKeys = new Set([
    "id",
    "title",
    "created",
    "updated",
    "tags",
    "aliases",
    "status",
    "capture.source",
    "capture.timestamp",
  ]);
  for (const [key, value] of Object.entries(record)) {
    if (reservedKeys.has(key)) continue;
    parsed.extra[key] = Array.isArray(value) ? [...value] : value;
  }

  return parsed;
}

function renderFrontmatterRecord(
  record: Record<string, FrontmatterValue>,
): string[] {
  const reservedOrder = [
    "id",
    "title",
    "status",
    "created",
    "updated",
    "capture.source",
    "capture.timestamp",
    "tags",
    "aliases",
  ];
  const lines: string[] = [];

  for (const key of reservedOrder) {
    if (!(key in record)) continue;
    lines.push(
      `${key}: ${formatFrontmatterValue(record[key] as FrontmatterValue)}`,
    );
  }

  const extras = Object.keys(record)
    .filter((key) => !reservedOrder.includes(key))
    .sort((left, right) => left.localeCompare(right));
  for (const key of extras) {
    lines.push(
      `${key}: ${formatFrontmatterValue(record[key] as FrontmatterValue)}`,
    );
  }
  return lines;
}

function buildContentWithFrontmatter(
  body: string,
  record: Record<string, FrontmatterValue>,
): string {
  const lines = renderFrontmatterRecord(record);
  if (lines.length === 0) {
    return body;
  }
  const normalizedBody = body.replace(/^\n+/, "");
  if (!normalizedBody) {
    return ["---", ...lines, "---", ""].join("\n");
  }
  return ["---", ...lines, "---", "", normalizedBody].join("\n");
}

export function parseFrontmatter(content: string): FrontmatterParseResult {
  if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) {
    return {
      frontmatter: { extra: {} },
      raw: {},
      body: content,
      warnings: [],
    };
  }

  const lines = content.split(/\r?\n/);
  let closingLine = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if ((lines[index] ?? "").trim() === "---") {
      closingLine = index;
      break;
    }
  }

  if (closingLine === -1) {
    return {
      frontmatter: { extra: {} },
      raw: {},
      body: content,
      warnings: ["Frontmatter start marker found but no closing marker."],
    };
  }

  const frontmatterRaw = lines.slice(1, closingLine).join("\n");
  const body = lines.slice(closingLine + 1).join("\n");
  const parsed = parseFrontmatterBlock(frontmatterRaw);
  return {
    frontmatter: frontmatterToParsed(parsed.record),
    raw: parsed.record,
    body,
    warnings: parsed.warnings,
  };
}

export function upsertFrontmatter(
  content: string,
  patch: FrontmatterUpsertPatch,
): string {
  const parsed = parseFrontmatter(content);
  const nextRecord: Record<string, FrontmatterValue> = Object.fromEntries(
    Object.entries(parsed.raw).map(([key, value]) => [
      key,
      Array.isArray(value) ? [...value] : value,
    ]),
  );

  setOrDeleteString(nextRecord, "id", patch.id);
  setOrDeleteString(nextRecord, "title", patch.title);
  setOrDeleteString(nextRecord, "status", patch.status);
  setOrDeleteString(nextRecord, "created", patch.created);
  setOrDeleteString(nextRecord, "updated", patch.updated);
  setOrDeleteString(nextRecord, "capture.source", patch.captureSource);
  setOrDeleteString(nextRecord, "capture.timestamp", patch.captureTimestamp);
  setOrDeleteArray(nextRecord, "tags", patch.tags);
  setOrDeleteArray(nextRecord, "aliases", patch.aliases);

  for (const [key, value] of Object.entries(patch.metadata ?? {})) {
    const normalizedKey = key.trim().toLowerCase();
    if (!normalizedKey) continue;
    if (value === undefined) {
      delete nextRecord[normalizedKey];
      continue;
    }
    if (Array.isArray(value)) {
      const normalizedArray = Array.from(
        new Set(value.map((item) => item.trim()).filter(Boolean)),
      );
      if (normalizedArray.length === 0) {
        delete nextRecord[normalizedKey];
      } else {
        nextRecord[normalizedKey] = normalizedArray;
      }
      continue;
    }
    const normalized = value.trim();
    if (!normalized) {
      delete nextRecord[normalizedKey];
    } else {
      nextRecord[normalizedKey] = normalized;
    }
  }

  return buildContentWithFrontmatter(parsed.body, nextRecord);
}

export function upsertFrontmatterTags(content: string, tags: string[]): string {
  return upsertFrontmatter(content, {
    tags,
  });
}
