import { describe, expect, it } from "bun:test";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";

describe("calendar help copy contract", () => {
  it("keeps Backup Center calendar help copy aligned to in-app export/import flows", async () => {
    const appPath = fileURLToPath(new URL("./App.tsx", import.meta.url).href);
    const source = await fs.readFile(appPath, "utf8");

    expect(source).toContain("Calendar (ICS) in Backup Center");
    expect(source).toContain(
      "Export Calendar (.ics) or Import Calendar (.ics).",
    );
    expect(source).toContain("mandatory dry-run before commit.");
    expect(source).toContain(
      "one-way actions per run (not live calendar sync).",
    );
  });
});
