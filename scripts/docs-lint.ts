import { promises as fs } from "fs";
import path from "path";

const SKIP_DIRS = new Set([".git", "node_modules", "dist", "coverage"]);
const LINK_PATTERN = /!?\[[^\]]*]\(([^)]+)\)/g;

type LinkIssue = {
  file: string;
  line: number;
  message: string;
};

function slugifyHeading(raw: string): string {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return normalized;
}

function isExternalTarget(target: string): boolean {
  const lower = target.toLowerCase();
  return (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:")
  );
}

function normalizeLinkTarget(raw: string): string {
  const trimmed = raw.trim();
  const withoutAngles =
    trimmed.startsWith("<") && trimmed.endsWith(">")
      ? trimmed.slice(1, -1)
      : trimmed;
  const firstToken = withoutAngles.split(/\s+/)[0] ?? "";
  return firstToken.trim();
}

async function walkMarkdownFiles(
  root: string,
  dirRelative = "",
): Promise<string[]> {
  const absoluteDir = path.join(root, dirRelative);
  const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }
      const nested = await walkMarkdownFiles(
        root,
        path.join(dirRelative, entry.name),
      );
      results.push(...nested);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }
    const relativePath = path.join(dirRelative, entry.name);
    if (relativePath.includes(path.join("docs", "notion"))) {
      // Notion payload docs include markdown snapshots and long generated blobs.
      continue;
    }
    const normalized = relativePath.split(path.sep).join("/");
    const isRootDoc = !normalized.includes("/");
    const isDocsDoc = normalized.startsWith("docs/");
    if (isRootDoc || isDocsDoc) {
      results.push(relativePath);
    }
  }

  return results;
}

async function loadHeadingIndex(filePath: string): Promise<Set<string>> {
  const text = await fs.readFile(filePath, "utf8");
  const headings = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const match = /^(#{1,6})\s+(.+)$/.exec(line.trim());
    if (!match) continue;
    headings.add(slugifyHeading(match[2]));
  }
  return headings;
}

function splitAnchor(target: string): { filePart: string; anchor?: string } {
  const hashIndex = target.indexOf("#");
  if (hashIndex === -1) {
    return { filePart: target };
  }
  const filePart = target.slice(0, hashIndex);
  const anchor = target.slice(hashIndex + 1).trim();
  return { filePart, anchor: anchor.length > 0 ? anchor : undefined };
}

function resolveTargetPath(
  repoRoot: string,
  sourceFile: string,
  filePart: string,
): string {
  const decoded = decodeURIComponent(filePart);
  if (!decoded || decoded === ".") {
    return sourceFile;
  }
  if (decoded.startsWith("/")) {
    return path.resolve(repoRoot, decoded.slice(1));
  }
  return path.resolve(path.dirname(sourceFile), decoded);
}

export async function lintDocs(repoRoot: string): Promise<LinkIssue[]> {
  const files = (await walkMarkdownFiles(repoRoot)).sort((a, b) =>
    a.localeCompare(b),
  );
  const headingCache = new Map<string, Set<string>>();
  const issues: LinkIssue[] = [];

  for (const relativePath of files) {
    const absolutePath = path.resolve(repoRoot, relativePath);
    const text = await fs.readFile(absolutePath, "utf8");
    const lines = text.split(/\r?\n/);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      LINK_PATTERN.lastIndex = 0;
      let match: RegExpExecArray | null = LINK_PATTERN.exec(line);
      while (match) {
        const rawTarget = match[1] ?? "";
        const target = normalizeLinkTarget(rawTarget);
        if (!target || target.startsWith("#") || isExternalTarget(target)) {
          match = LINK_PATTERN.exec(line);
          continue;
        }

        const { filePart, anchor } = splitAnchor(target);
        const resolvedPath = resolveTargetPath(
          repoRoot,
          absolutePath,
          filePart,
        );

        try {
          const stat = await fs.stat(resolvedPath);
          if (!stat.isFile()) {
            throw new Error("not a file");
          }
        } catch {
          issues.push({
            file: relativePath,
            line: index + 1,
            message: `Broken local link target: ${target}`,
          });
          match = LINK_PATTERN.exec(line);
          continue;
        }

        if (anchor && resolvedPath.endsWith(".md")) {
          let headings = headingCache.get(resolvedPath);
          if (!headings) {
            headings = await loadHeadingIndex(resolvedPath);
            headingCache.set(resolvedPath, headings);
          }
          const normalizedAnchor = slugifyHeading(anchor);
          if (!headings.has(normalizedAnchor)) {
            issues.push({
              file: relativePath,
              line: index + 1,
              message: `Missing heading anchor '#${anchor}' in ${target}`,
            });
          }
        }

        match = LINK_PATTERN.exec(line);
      }
    }
  }

  return issues;
}

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const issues = await lintDocs(repoRoot);
  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(`[docs-lint] ${issue.file}:${issue.line} ${issue.message}`);
    }
    console.error(`[docs-lint] FAIL: ${issues.length} issue(s)`);
    process.exitCode = 1;
    return;
  }
  console.log("[docs-lint] PASS: local markdown links and anchors resolved.");
}

if (import.meta.main) {
  void main();
}
