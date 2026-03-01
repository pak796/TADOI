import { randomUUID, createHash } from "node:crypto";
import { promises as fs } from "fs";
import path from "path";
import type { NoteDocument, NoteListItem, NotePath } from "./types";

const PRIVATE_DIR_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;
const writeQueueByPath = new Map<string, Promise<void>>();

function queueKey(filePath: string): string {
  const resolved = path.resolve(filePath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

async function withWriteLock(filePath: string, task: () => Promise<void>): Promise<void> {
  const key = queueKey(filePath);
  const previous = writeQueueByPath.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(task);
  writeQueueByPath.set(key, current);
  try {
    await current;
  } finally {
    if (writeQueueByPath.get(key) === current) {
      writeQueueByPath.delete(key);
    }
  }
}

function toNotePath(notesRoot: string, fullPath: string): NotePath {
  const relative = path.relative(notesRoot, fullPath);
  return relative.split(path.sep).join(path.posix.sep);
}

function toAbsolutePath(notesRoot: string, notePath: NotePath): string {
  const normalized = notePath.split(path.posix.sep).join(path.sep);
  return path.join(notesRoot, normalized);
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function nextAtomicTempPath(filePath: string): Promise<string> {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const suffix = `${Date.now().toString(36)}-${process.pid}-${randomUUID().slice(0, 8)}-${attempt}`;
    const candidate = path.join(dir, `.${base}.tmp-${suffix}`);
    if (!(await pathExists(candidate))) {
      return candidate;
    }
  }

  throw new Error(`Unable to allocate temp path for ${filePath}`);
}

function sanitizeTitleToFilename(title: string): string {
  const trimmed = title.trim();
  const fallback = "untitled-note";
  const cleaned = (trimmed || fallback)
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/[\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

export function resolveNotesRootPath(dataFilePath: string, rootPath: string | null | undefined): string {
  const dataDir = path.dirname(dataFilePath);
  if (!rootPath || rootPath.trim().length === 0) {
    return path.join(dataDir, "notes");
  }

  const trimmed = rootPath.trim();
  if (path.isAbsolute(trimmed)) {
    return path.normalize(trimmed);
  }

  return path.resolve(dataDir, trimmed);
}

export async function ensureNotesRoot(notesRoot: string): Promise<void> {
  await fs.mkdir(notesRoot, { recursive: true, mode: PRIVATE_DIR_MODE });
}

export async function scanMarkdownFiles(notesRoot: string): Promise<NoteListItem[]> {
  const entries: NoteListItem[] = [];

  async function walk(current: string): Promise<void> {
    const dirEntries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of dirEntries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!entry.name.toLowerCase().endsWith(".md")) continue;

      const stat = await fs.stat(fullPath);
      const relative = toNotePath(notesRoot, fullPath);
      entries.push({
        path: relative,
        title: path.basename(entry.name, path.extname(entry.name)),
        mtimeMs: stat.mtimeMs,
        tags: []
      });
    }
  }

  await ensureNotesRoot(notesRoot);
  await walk(notesRoot);
  entries.sort((left, right) => right.mtimeMs - left.mtimeMs || left.path.localeCompare(right.path));
  return entries;
}

export async function readNoteDocument(notesRoot: string, notePath: NotePath): Promise<NoteDocument> {
  const fullPath = toAbsolutePath(notesRoot, notePath);
  const [content, stat] = await Promise.all([
    fs.readFile(fullPath, "utf8"),
    fs.stat(fullPath)
  ]);
  return {
    path: notePath,
    content,
    mtimeMs: stat.mtimeMs
  };
}

export async function writeNoteDocumentAtomic(options: {
  notesRoot: string;
  notePath: NotePath;
  content: string;
}): Promise<void> {
  const fullPath = toAbsolutePath(options.notesRoot, options.notePath);
  await withWriteLock(fullPath, async () => {
    await fs.mkdir(path.dirname(fullPath), { recursive: true, mode: PRIVATE_DIR_MODE });
    const tmpPath = await nextAtomicTempPath(fullPath);

    await fs.writeFile(tmpPath, options.content, {
      encoding: "utf8",
      mode: PRIVATE_FILE_MODE
    });

    await fs.rename(tmpPath, fullPath);
  });
}

export async function createNoteFile(options: {
  notesRoot: string;
  title: string;
  initialContent?: string;
}): Promise<NoteDocument> {
  await ensureNotesRoot(options.notesRoot);

  const base = sanitizeTitleToFilename(options.title);
  let candidate = `${base}.md`;
  let index = 2;
  while (await pathExists(path.join(options.notesRoot, candidate))) {
    candidate = `${base}-${index}.md`;
    index += 1;
  }

  const content = options.initialContent ?? "";
  await writeNoteDocumentAtomic({
    notesRoot: options.notesRoot,
    notePath: candidate,
    content
  });

  return readNoteDocument(options.notesRoot, candidate);
}

export async function deleteNoteFile(options: {
  notesRoot: string;
  notePath: NotePath;
}): Promise<void> {
  const fullPath = toAbsolutePath(options.notesRoot, options.notePath);
  await fs.unlink(fullPath);
}

export async function statNoteFile(options: {
  notesRoot: string;
  notePath: NotePath;
}): Promise<number | null> {
  try {
    const stat = await fs.stat(toAbsolutePath(options.notesRoot, options.notePath));
    return stat.mtimeMs;
  } catch (error: unknown) {
    const maybeErrno = error as NodeJS.ErrnoException;
    if (maybeErrno?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function copyDirectoryRecursive(source: string, destination: string): Promise<void> {
  await fs.mkdir(destination, { recursive: true, mode: PRIVATE_DIR_MODE });
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await copyDirectoryRecursive(sourcePath, destinationPath);
      continue;
    }
    if (!entry.isFile()) continue;
    await fs.copyFile(sourcePath, destinationPath);
  }
}

export async function copyNotesRoot(options: {
  sourceRoot: string;
  destinationRoot: string;
}): Promise<void> {
  await ensureNotesRoot(options.destinationRoot);
  if (!(await pathExists(options.sourceRoot))) {
    return;
  }
  await copyDirectoryRecursive(options.sourceRoot, options.destinationRoot);
}

export function computeContentHash(content: string): string {
  return createHash("sha1").update(content).digest("hex");
}
