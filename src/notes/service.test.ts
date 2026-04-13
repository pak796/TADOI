import { afterEach, describe, expect, it } from "bun:test";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { createNotesService } from "./service";
import { DEFAULT_TOME_GUIDE_PATHS } from "./defaultDocs";

const cleanupDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  cleanupDirs.push(dir);
  return dir;
}

async function writeNote(
  root: string,
  notePath: string,
  content: string,
): Promise<void> {
  const fullPath = path.join(root, notePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, "utf8");
}

afterEach(async () => {
  await Promise.all(
    cleanupDirs
      .splice(0)
      .map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

describe("NotesService incremental behavior", () => {
  it("updates only the edited note graph and affected backlinks without full reindex", async () => {
    const dir = await makeTempDir("tadoi-notes-service-");
    const notesRoot = path.join(dir, "notes");

    await writeNote(notesRoot, "A.md", "# A\n\n[[B]]");
    await writeNote(notesRoot, "B.md", "# B");
    await writeNote(notesRoot, "C.md", "# C");
    await writeNote(notesRoot, "D.md", "# D\n\n[[A]]");

    const service = createNotesService({
      dataFilePath: path.join(dir, "data.json"),
      rootPath: notesRoot,
      enabled: true,
    });

    await service.initialize();
    expect(service.getBacklinks("B.md")).toContain("A.md");
    expect(service.getBacklinks("C.md")).toEqual([]);

    const before = service.getInstrumentation();
    expect(before.fullReindexCount).toBe(1);

    await service.saveNote("A.md", "# A\n\n[[C]]");

    const after = service.getInstrumentation();
    expect(after.fullReindexCount).toBe(1);
    expect(after.lastUpsertPath).toBe("A.md");
    expect(new Set(after.lastResolvedPaths)).toEqual(new Set(["A.md", "D.md"]));
    expect(service.getBacklinks("B.md")).toEqual([]);
    expect(service.getBacklinks("C.md")).toContain("A.md");
  });

  it("uses mtime/hash gating to avoid unnecessary reparses", async () => {
    const dir = await makeTempDir("tadoi-notes-service-");
    const notesRoot = path.join(dir, "notes");
    await writeNote(notesRoot, "A.md", "# A\n\nHello");

    const service = createNotesService({
      dataFilePath: path.join(dir, "data.json"),
      rootPath: notesRoot,
      enabled: true,
    });
    await service.initialize();

    const baseline = service.getInstrumentation();
    const notePath = path.join(service.getNotesRoot(), "A.md");
    const stat = await fs.stat(notePath);
    await fs.utimes(notePath, stat.atime, new Date(stat.mtimeMs + 2000));

    await service.refreshChanged();
    const afterHashSkip = service.getInstrumentation();
    expect(afterHashSkip.skippedByHashCount).toBeGreaterThan(
      baseline.skippedByHashCount,
    );
    expect(afterHashSkip.upsertCount).toBe(baseline.upsertCount);

    await service.refreshChanged();
    const afterMtimeSkip = service.getInstrumentation();
    expect(afterMtimeSkip.skippedByMtimeCount).toBeGreaterThan(
      afterHashSkip.skippedByMtimeCount,
    );
  });

  it("keeps full reindex count stable during repeated edits in a 100-note vault", async () => {
    const dir = await makeTempDir("tadoi-notes-service-");
    const notesRoot = path.join(dir, "notes");

    for (let index = 0; index < 100; index += 1) {
      await writeNote(
        notesRoot,
        `N${String(index)}.md`,
        `# N${String(index)}\n\nBody ${String(index)}`,
      );
    }

    const service = createNotesService({
      dataFilePath: path.join(dir, "data.json"),
      rootPath: notesRoot,
      enabled: true,
    });
    await service.initialize();

    const baseline = service.getInstrumentation();
    expect(baseline.fullReindexCount).toBe(1);

    for (let edit = 0; edit < 10; edit += 1) {
      await service.saveNote("N0.md", `# N0\n\nEdit ${String(edit)}`);
    }

    const after = service.getInstrumentation();
    expect(after.fullReindexCount).toBe(1);
    expect(after.upsertCount).toBe(baseline.upsertCount + 10);
    expect(after.lastUpsertPath).toBe("N0.md");
  });

  it("renames and deletes a note while keeping the in-memory index in sync", async () => {
    const dir = await makeTempDir("tadoi-notes-service-");
    const notesRoot = path.join(dir, "notes");
    await writeNote(notesRoot, "Alpha.md", "# Alpha\n\nBody");

    const service = createNotesService({
      dataFilePath: path.join(dir, "data.json"),
      rootPath: notesRoot,
      enabled: true,
    });
    await service.initialize();

    const renamed = await service.renameNote("Alpha.md", "Gamma");
    expect(renamed?.path).toBe("Gamma.md");
    expect(service.listNotes().map((note) => note.path)).toEqual(["Gamma.md"]);
    await expect(service.getNoteContent("Alpha.md")).resolves.toBeNull();
    await expect(
      fs.stat(path.join(notesRoot, "Gamma.md")),
    ).resolves.toBeDefined();
    await expect(fs.stat(path.join(notesRoot, "Alpha.md"))).rejects.toThrow();

    const deleted = await service.deleteNote("Gamma.md");
    expect(deleted).toBe(true);
    expect(service.listNotes()).toHaveLength(0);
    await expect(service.getNoteContent("Gamma.md")).resolves.toBeNull();
  });

  it("seeds default guide docs exactly once when vault starts empty", async () => {
    const dir = await makeTempDir("tadoi-notes-service-seed-");
    const notesRoot = path.join(dir, "notes");
    const service = createNotesService({
      dataFilePath: path.join(dir, "data.json"),
      rootPath: notesRoot,
      enabled: true,
    });

    await service.initialize();
    expect(service.listNotes()).toHaveLength(0);

    const firstSeed = await service.seedDefaultGuideDocsIfEmpty();
    expect(firstSeed.mode).toBe("seed_if_empty");
    expect(firstSeed.createdPaths).toEqual(DEFAULT_TOME_GUIDE_PATHS);
    expect(firstSeed.skippedPaths).toEqual([]);
    expect(firstSeed.skippedReason).toBeUndefined();

    const secondSeed = await service.seedDefaultGuideDocsIfEmpty();
    expect(secondSeed.mode).toBe("seed_if_empty");
    expect(secondSeed.createdPaths).toEqual([]);
    expect(secondSeed.skippedReason).toBe("already_seeded");

    for (const notePath of DEFAULT_TOME_GUIDE_PATHS) {
      await expect(
        fs.stat(path.join(notesRoot, notePath)),
      ).resolves.toBeDefined();
    }
  });

  it("does not seed defaults when vault already contains user notes", async () => {
    const dir = await makeTempDir("tadoi-notes-service-seed-");
    const notesRoot = path.join(dir, "notes");
    await writeNote(notesRoot, "User.md", "# User");

    const service = createNotesService({
      dataFilePath: path.join(dir, "data.json"),
      rootPath: notesRoot,
      enabled: true,
    });
    await service.initialize();

    const seed = await service.seedDefaultGuideDocsIfEmpty();
    expect(seed.createdPaths).toEqual([]);
    expect(seed.skippedReason).toBe("non_empty");
    expect(service.listNotes().map((note) => note.path)).toEqual(["User.md"]);
  });

  it("restores only missing default guide docs without overwriting existing notes", async () => {
    const dir = await makeTempDir("tadoi-notes-service-restore-");
    const notesRoot = path.join(dir, "notes");
    const service = createNotesService({
      dataFilePath: path.join(dir, "data.json"),
      rootPath: notesRoot,
      enabled: true,
    });
    await service.initialize();

    const initialRestore = await service.restoreDefaultGuideDocs();
    expect(initialRestore.mode).toBe("restore_missing");
    expect(initialRestore.createdPaths).toEqual(DEFAULT_TOME_GUIDE_PATHS);

    const deletedPath = DEFAULT_TOME_GUIDE_PATHS[1];
    await service.deleteNote(deletedPath);
    await expect(fs.stat(path.join(notesRoot, deletedPath))).rejects.toThrow();

    const restoreAfterDelete = await service.restoreDefaultGuideDocs();
    expect(restoreAfterDelete.createdPaths).toEqual([deletedPath]);
    expect(restoreAfterDelete.skippedPaths).toEqual(
      DEFAULT_TOME_GUIDE_PATHS.filter((item) => item !== deletedPath),
    );
  });
});
