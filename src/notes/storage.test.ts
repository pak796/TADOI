import { afterEach, describe, expect, it } from "bun:test";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import {
  createNoteFile,
  deleteNoteFile,
  hasDefaultGuideSeedMarker,
  readNoteDocument,
  renameNoteFile,
  resolveNotesRootPath,
  scanMarkdownFiles,
  writeDefaultGuideSeedMarker,
  writeNoteDocumentAtomic,
} from "./storage";

const cleanupDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  cleanupDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    cleanupDirs
      .splice(0)
      .map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

describe("notes storage", () => {
  it("resolves default and relative roots", () => {
    const dataFile = path.join("/tmp", "workspace", "data.json");
    expect(resolveNotesRootPath(dataFile, null)).toBe(
      path.join("/tmp", "workspace", "notes"),
    );
    expect(resolveNotesRootPath(dataFile, "./vault")).toBe(
      path.join("/tmp", "workspace", "vault"),
    );
  });

  it("creates, scans, reads, and writes markdown notes", async () => {
    const dir = await makeTempDir("tadoi-notes-storage-");
    const notesRoot = path.join(dir, "notes");

    const created = await createNoteFile({
      notesRoot,
      title: "My Note",
      initialContent: "# My Note",
    });
    expect(created.path.endsWith(".md")).toBe(true);

    await writeNoteDocumentAtomic({
      notesRoot,
      notePath: created.path,
      content: "# Updated",
    });

    const scanned = await scanMarkdownFiles(notesRoot);
    expect(scanned.map((item) => item.path)).toContain(created.path);

    const read = await readNoteDocument(notesRoot, created.path);
    expect(read.content).toBe("# Updated");
  });

  it("writes nested note paths and supports file deletion", async () => {
    const dir = await makeTempDir("tadoi-notes-storage-");
    const notesRoot = path.join(dir, "notes");
    const nestedPath = "TADOI Guides/Test.md";

    await writeNoteDocumentAtomic({
      notesRoot,
      notePath: nestedPath,
      content: "# Test",
    });
    await expect(
      readNoteDocument(notesRoot, nestedPath),
    ).resolves.toMatchObject({
      path: nestedPath,
      content: "# Test",
    });

    await deleteNoteFile({
      notesRoot,
      notePath: nestedPath,
    });
    await expect(readNoteDocument(notesRoot, nestedPath)).rejects.toThrow();
  });

  it("renames notes with conflict-safe suffixing", async () => {
    const dir = await makeTempDir("tadoi-notes-storage-");
    const notesRoot = path.join(dir, "notes");

    await writeNoteDocumentAtomic({
      notesRoot,
      notePath: "Renamed.md",
      content: "# Existing",
    });
    await writeNoteDocumentAtomic({
      notesRoot,
      notePath: "Draft.md",
      content: "# Draft",
    });

    const renamedPath = await renameNoteFile({
      notesRoot,
      notePath: "Draft.md",
      title: "Renamed",
    });

    expect(renamedPath).toBe("Renamed-2.md");
    await expect(readNoteDocument(notesRoot, "Draft.md")).rejects.toThrow();
    await expect(
      readNoteDocument(notesRoot, "Renamed-2.md"),
    ).resolves.toMatchObject({
      path: "Renamed-2.md",
      content: "# Draft",
    });
  });

  it("reads and writes the default guide seed marker", async () => {
    const dir = await makeTempDir("tadoi-notes-storage-");
    const notesRoot = path.join(dir, "notes");

    await expect(hasDefaultGuideSeedMarker(notesRoot)).resolves.toBe(false);
    await writeDefaultGuideSeedMarker(notesRoot);
    await expect(hasDefaultGuideSeedMarker(notesRoot)).resolves.toBe(true);
  });
});
