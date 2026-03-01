import { describe, expect, it } from "bun:test";
import path from "path";
import { fileURLToPath } from "url";
import { createNotesService } from "./service";

describe("notes fixture vault", () => {
  it("indexes fixture vault graph with deterministic link/tag/task behavior", async () => {
    const thisDir = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = path.resolve(thisDir, "..", "..");
    const fixtureRoot = path.join(
      repoRoot,
      "test",
      "fixtures",
      "notes_vault_basic",
      "notes"
    );
    const service = createNotesService({
      dataFilePath: path.join(repoRoot, "tadoi_data.json"),
      rootPath: fixtureRoot,
      enabled: true
    });

    await service.initialize();

    const list = service.listNotes();
    expect(list.length).toBeGreaterThanOrEqual(5);

    const snapshot = service.getIndexSnapshot();
    expect(Array.from(snapshot.tagToNotes.get("inbox") ?? [])).toContain("Tags.md");
    expect(Array.from(snapshot.tagToNotes.get("inbox/to-read") ?? [])).toContain("Tags.md");

    const backlinksForB = service.getBacklinks("B.md");
    expect(backlinksForB).toContain("A.md");

    expect(service.getLinkedNotesForTask("task-fixture-001")).toContain("A.md");

    const mentions = service.getUnlinkedMentions("A.md");
    expect(mentions.some((mention) => mention.from === "B.md")).toBe(true);
    expect(mentions.some((mention) => mention.from === "Conflicts/SameTitle2.md")).toBe(false);

    const outgoingFromA = service.getResolvedOutgoingRefs("A.md");
    expect(
      outgoingFromA.some(
        (ref) => ref.kind === "wikilink" && ref.toRaw === "B" && ref.toResolved === "B.md"
      )
    ).toBe(true);
    expect(
      outgoingFromA.some(
        (ref) =>
          ref.kind === "wikilink" &&
          ref.toRaw === "Duplicate" &&
          ref.ambiguous === true &&
          !ref.toResolved
      )
    ).toBe(true);
    expect(
      outgoingFromA.some(
        (ref) =>
          ref.kind === "wikilink" &&
          ref.toRaw === "id:note-dup-primary" &&
          ref.toResolved === "Conflicts/SameTitle1.md" &&
          ref.ambiguous === false
      )
    ).toBe(true);

    const outgoingFromB = service.getResolvedOutgoingRefs("B.md");
    expect(
      outgoingFromB.some(
        (ref) => ref.kind === "mdlink" && ref.toRaw === "Tags.md" && ref.toResolved === "Tags.md"
      )
    ).toBe(true);
  });
});
