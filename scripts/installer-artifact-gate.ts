import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

type Target = "macos" | "windows" | "linux";
type ManifestOutputKind = "binary" | "pkg" | "dmg" | "exe" | "deb" | "appimage";

type InstallerBuildManifestOutput = {
  kind: ManifestOutputKind;
  path: string;
  sizeBytes: number;
  sha256: string;
};

type InstallerBuildManifest = {
  schemaVersion: number;
  target: Target;
  packageVersion: string;
  generatedAt: string;
  outputs: InstallerBuildManifestOutput[];
};

const REQUIRED_KINDS: Record<Target, ManifestOutputKind[]> = {
  macos: ["binary", "pkg", "dmg"],
  windows: ["binary", "exe"],
  linux: ["binary", "deb", "appimage"]
};

const ALLOWED_KINDS = new Set<ManifestOutputKind>([
  "binary",
  "pkg",
  "dmg",
  "exe",
  "deb",
  "appimage"
]);

function parseArg(argv: string[], name: string): string | null {
  const prefix = `${name}=`;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === name) return argv[i + 1] ?? null;
    if (arg.startsWith(prefix)) return arg.slice(prefix.length);
  }
  return null;
}

export function parseTargetArg(argv: string[] = process.argv.slice(2)): Target {
  const target = parseArg(argv, "--target");
  if (target === "macos" || target === "windows" || target === "linux") {
    return target;
  }
  throw new Error(
    `[installer:gate] invalid --target. expected macos|windows|linux, got: ${
      target ?? "<missing>"
    }`
  );
}

function readPackageVersion(rootDir: string): string {
  const packageJsonPath = path.join(rootDir, "package.json");
  if (!existsSync(packageJsonPath)) {
    throw new Error(`[installer:gate] package.json not found: ${packageJsonPath}`);
  }
  const raw = readFileSync(packageJsonPath, "utf8");
  const parsed = JSON.parse(raw) as { version?: string };
  const version = parsed.version?.trim();
  if (!version) {
    throw new Error("[installer:gate] package.json version is missing");
  }
  return version;
}

export function resolveManifestPath(rootDir: string, target: Target, version: string): string {
  return path.join(
    rootDir,
    "dist",
    "installers",
    `TADOI-${target}-${version}-manifest.json`
  );
}

function sha256File(filePath: string): string {
  const hash = createHash("sha256");
  hash.update(readFileSync(filePath));
  return hash.digest("hex");
}

function assertManifestShape(manifest: InstallerBuildManifest, target: Target, version: string): void {
  if (manifest.schemaVersion !== 1) {
    throw new Error(
      `[installer:gate] unsupported manifest schemaVersion=${manifest.schemaVersion}; expected 1`
    );
  }
  if (manifest.target !== target) {
    throw new Error(
      `[installer:gate] manifest target mismatch. expected=${target}, actual=${manifest.target}`
    );
  }
  if (manifest.packageVersion !== version) {
    throw new Error(
      `[installer:gate] manifest packageVersion mismatch. expected=${version}, actual=${manifest.packageVersion}`
    );
  }
  if (Number.isNaN(Date.parse(manifest.generatedAt))) {
    throw new Error(
      `[installer:gate] manifest generatedAt is not a valid ISO timestamp: ${manifest.generatedAt}`
    );
  }
  if (!Array.isArray(manifest.outputs) || manifest.outputs.length === 0) {
    throw new Error("[installer:gate] manifest outputs[] must contain at least one entry");
  }
}

function validateOutputEntry(rootDir: string, output: InstallerBuildManifestOutput): void {
  if (!ALLOWED_KINDS.has(output.kind)) {
    throw new Error(`[installer:gate] unsupported output kind: ${String(output.kind)}`);
  }
  if (typeof output.path !== "string" || output.path.trim() === "") {
    throw new Error("[installer:gate] output.path must be a non-empty string");
  }
  if (!Number.isInteger(output.sizeBytes) || output.sizeBytes < 0) {
    throw new Error(
      `[installer:gate] output.sizeBytes must be a non-negative integer for ${output.path}`
    );
  }
  if (!/^[a-f0-9]{64}$/.test(output.sha256)) {
    throw new Error(
      `[installer:gate] output.sha256 must be a lowercase hex SHA-256 for ${output.path}`
    );
  }

  const absolutePath = path.resolve(rootDir, output.path);
  if (!existsSync(absolutePath)) {
    throw new Error(`[installer:gate] artifact missing: ${output.path}`);
  }

  const stats = statSync(absolutePath);
  if (stats.size !== output.sizeBytes) {
    throw new Error(
      `[installer:gate] size mismatch for ${output.path}. manifest=${output.sizeBytes}, actual=${stats.size}`
    );
  }

  const actualHash = sha256File(absolutePath);
  if (actualHash !== output.sha256) {
    throw new Error(
      `[installer:gate] sha256 mismatch for ${output.path}. manifest=${output.sha256}, actual=${actualHash}`
    );
  }
}

export function validateInstallerManifest(rootDir: string, target: Target): void {
  const rootPath = path.resolve(rootDir);
  const version = readPackageVersion(rootPath);
  const manifestPath = resolveManifestPath(rootPath, target, version);
  if (!existsSync(manifestPath)) {
    throw new Error(`[installer:gate] manifest not found: ${manifestPath}`);
  }

  const rawManifest = readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(rawManifest) as InstallerBuildManifest;
  assertManifestShape(manifest, target, version);

  const seenKinds = new Set<ManifestOutputKind>();
  for (const output of manifest.outputs) {
    validateOutputEntry(rootPath, output);
    seenKinds.add(output.kind);
  }

  const requiredKinds = REQUIRED_KINDS[target];
  const missingKinds = requiredKinds.filter((kind) => !seenKinds.has(kind));
  if (missingKinds.length > 0) {
    throw new Error(
      `[installer:gate] manifest missing required kinds for ${target}: ${missingKinds.join(", ")}`
    );
  }
}

function main(): void {
  try {
    const target = parseTargetArg(process.argv.slice(2));
    validateInstallerManifest(process.cwd(), target);
    console.log(`[installer:gate] OK (${target})`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
