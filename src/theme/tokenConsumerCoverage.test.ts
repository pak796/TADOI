import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { USER_THEME_ROLE_CONTRACT } from "./semanticTokenContract";

function collectSourceFiles(rootDir: string): string[] {
  const entries = readdirSync(rootDir, { withFileTypes: true });
  const next: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      next.push(...collectSourceFiles(absolute));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!absolute.endsWith(".ts") && !absolute.endsWith(".tsx")) continue;
    next.push(absolute);
  }
  return next;
}

function readFiles(paths: string[]): string {
  return paths.map((filePath) => readFileSync(filePath, "utf8")).join("\n");
}

describe("theme token consumer coverage", () => {
  const repoRoot = path.resolve(import.meta.dir, "..", "..");
  const appDir = path.join(repoRoot, "src", "app");
  const componentsDir = path.join(repoRoot, "src", "components");
  const appFiles = collectSourceFiles(appDir);
  const componentFiles = collectSourceFiles(componentsDir);
  const allConsumerSource = readFiles([...appFiles, ...componentFiles]);
  const visibleUiSource = readFiles([
    ...componentFiles,
    path.join(repoRoot, "src", "app", "App.tsx"),
  ]);

  it("keeps each user-facing theme role anchored to runtime consumers", () => {
    for (const role of Object.values(USER_THEME_ROLE_CONTRACT)) {
      const hasRuntimeUsage = role.runtimeAliases.some((alias) =>
        new RegExp(`\\btheme\\.${alias}\\b`).test(allConsumerSource),
      );
      expect(hasRuntimeUsage).toBe(true);
    }
  });

  it("keeps selection tokens visibly consumed by UI rendering", () => {
    expect(/\btheme\.selectionBg\b/.test(visibleUiSource)).toBe(true);
    expect(/\btheme\.selectionText\b/.test(visibleUiSource)).toBe(true);
  });

  it("sanity-checks scanned source roots exist", () => {
    expect(statSync(appDir).isDirectory()).toBe(true);
    expect(statSync(componentsDir).isDirectory()).toBe(true);
  });
});
