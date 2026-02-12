import { describe, expect, it } from "bun:test";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";

describe("calendar help copy contract", () => {
  it("keeps product-boundary help copy aligned to export CLI + import service layer", async () => {
    const appPath = fileURLToPath(new URL("./App.tsx", import.meta.url).href);
    const source = await fs.readFile(appPath, "utf8");

    expect(source).toContain("Command: tadoi calendar:export --out ./tadoi.ics");
    expect(source).toContain("Limitation: export-only (no calendar import/sync).");
    expect(source).not.toContain("calendar:import --in");
  });
});
