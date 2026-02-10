import { promises as fs } from "fs";
import path from "path";

const ROOT_DIR = process.cwd();
const SKIP_DIRS = new Set([".git", "node_modules", "dist", "coverage"]);
const legacyName = String.fromCharCode(116, 111, 100, 117, 105);
const legacyPattern = new RegExp(legacyName, "i");

async function scanFile(filePath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return legacyPattern.test(content);
  } catch {
    return false;
  }
}

async function walk(dirPath: string, matches: string[]): Promise<void> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, matches);
      continue;
    }
    if (await scanFile(fullPath)) {
      matches.push(path.relative(ROOT_DIR, fullPath));
    }
  }
}

async function main(): Promise<void> {
  const matches: string[] = [];
  await walk(ROOT_DIR, matches);
  if (matches.length > 0) {
    console.error("Legacy brand token found in:");
    for (const match of matches) {
      console.error(`- ${match}`);
    }
    process.exit(1);
  }
  console.log("Branding check passed.");
}

void main();
