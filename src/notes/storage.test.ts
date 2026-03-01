import { afterEach, describe, expect, it } from "bun:test";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import {
  createNoteFile,
  readNoteDocument,
  resolveNotesRootPath,
  scanMarkdownFiles,
  writeNoteDocumentAtomic
} from "./storage";

const cleanupDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  cleanupDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    cleanupDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))
  );
});

describe("notes storage", () => {
  it("resolves default and relative roots", () => {
    const dataFile = path.join("/tmp", "workspace", "data.json");
    expect(resolveNotesRootPath(dataFile, null)).toBe(path.join("/tmp", "workspace", "notes"));
    expect(resolveNotesRootPath(dataFile, "./vault")).toBe(path.join("/tmp", "workspace", "vault"));
  });

  it("creates, scans, reads, and writes markdown notes", async () => {
    const dir = await makeTempDir("tadoi-notes-storage-");
    const notesRoot = path.join(dir, "notes");

    const created = await createNoteFile({
      notesRoot,
      title: "My Note",
      initialContent: "# My Note"
    });
    expect(created.path.endsWith(".md")).toBe(true);

    await writeNoteDocumentAtomic({
      notesRoot,
      notePath: created.path,
      content: "# Updated"
    });

    const scanned = await scanMarkdownFiles(notesRoot);
    expect(scanned.map((item) => item.path)).toContain(created.path);

    const read = await readNoteDocument(notesRoot, created.path);
    expect(read.content).toBe("# Updated");
  });
});
