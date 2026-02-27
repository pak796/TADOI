import os from "os";
import path from "path";
import { createHash } from "node:crypto";
import { promises as fs } from "fs";
import type { LoadedData } from "../state/persistence";
import type { TadoiSettings } from "../settings/settings";
import { APP_VERSION } from "../app/version";

export type GhCommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type GhCommandRunner = (
  args: string[],
  options?: { cwd?: string; stdin?: string }
) => Promise<GhCommandResult>;

export type GitHubBackupRepoConfig = {
  ownerRepo: string;
  branch: string;
  pathPrefix: string;
};

export type SnapshotRef = {
  id: string;
  timestamp: string;
  statePath: string;
  settingsPath: string;
  manifestPath: string;
  tasksTotal?: number;
  tasksOpen?: number;
  appVersion?: string;
  schemaVersion?: number;
};

export type GitHubPushArtifacts = {
  timestampId: string;
  stateJson: string;
  settingsJson: string;
  manifestJson: string;
  stateRevision: number;
};

export type GitHubSnapshotManifest = {
  tadoiBackupVersion: 1;
  timestamp: string;
  deviceId: string;
  ownerRepo: string;
  branch: string;
  pathPrefix: string;
  appVersion: string;
  schemaVersion: number;
  stateRevision: number;
  hashes: {
    stateSha256: string;
    settingsSha256: string;
  };
  counts: {
    tasksTotal: number;
    tasksOpen: number;
    tagsTotal: number;
  };
};

type GitHubContentResponse = {
  content?: string;
  encoding?: string;
};

type GitHubTreeResponse = {
  tree?: Array<{
    path?: string;
    type?: string;
  }>;
};

type GitHubCommitResponse = {
  sha?: string;
  tree?: {
    sha?: string;
  };
};

export function normalizePathPrefix(pathPrefix: string): string {
  return pathPrefix.replace(/^\/+/, "").replace(/\/+$/, "");
}

export function formatSnapshotId(now = new Date()): string {
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mi = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}Z`;
}

export function buildRemoteSnapshotPaths(
  pathPrefix: string,
  timestampId: string
): {
  statePath: string;
  settingsPath: string;
  manifestPath: string;
  latestStatePath: string;
  latestSettingsPath: string;
  latestManifestPath: string;
} {
  const prefix = normalizePathPrefix(pathPrefix);
  const year = timestampId.slice(0, 4);
  const month = timestampId.slice(4, 6);
  const base = `${prefix}/snapshots/${year}/${month}/${timestampId}`;
  return {
    statePath: `${base}.state.json`,
    settingsPath: `${base}.settings.json`,
    manifestPath: `${base}.manifest.json`,
    latestStatePath: `${prefix}/latest/state.json`,
    latestSettingsPath: `${prefix}/latest/settings.json`,
    latestManifestPath: `${prefix}/latest/manifest.json`
  };
}

function parseOwnerRepo(ownerRepo: string): { owner: string; repo: string } | null {
  const trimmed = ownerRepo.trim();
  const match = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2]
  };
}

function normalizeGhError(stderr: string, stdout: string, code: number): string {
  const detail = [stderr.trim(), stdout.trim()].filter(Boolean).join(" | ");
  return detail.length > 0 ? detail : `gh exited with code ${String(code)}`;
}

export const runGhCommand: GhCommandRunner = async (args, options = {}) => {
  const processHandle = Bun.spawn(["gh", ...args], {
    cwd: options.cwd,
    stdin: options.stdin !== undefined ? "pipe" : "ignore",
    stdout: "pipe",
    stderr: "pipe"
  });

  if (options.stdin !== undefined && processHandle.stdin) {
    const writer = processHandle.stdin.getWriter();
    await writer.write(new TextEncoder().encode(options.stdin));
    await writer.close();
  }

  const [exitCode, stdout, stderr] = await Promise.all([
    processHandle.exited,
    new Response(processHandle.stdout).text(),
    new Response(processHandle.stderr).text()
  ]);

  return {
    exitCode,
    stdout,
    stderr
  };
};

type GhApiRequest = {
  endpoint: string;
  method?: "GET" | "POST" | "PATCH";
  payload?: Record<string, unknown>;
  runner?: GhCommandRunner;
};

async function ghApiJson<T>(request: GhApiRequest): Promise<T> {
  const method = request.method ?? "GET";
  const runner = request.runner ?? runGhCommand;
  const args = ["api", "--method", method, request.endpoint];
  let stdin: string | undefined;
  if (request.payload !== undefined) {
    args.push("--input", "-");
    stdin = JSON.stringify(request.payload);
  }

  const result = await runner(args, { stdin });
  if (result.exitCode !== 0) {
    throw new Error(normalizeGhError(result.stderr, result.stdout, result.exitCode));
  }
  const raw = result.stdout.trim();
  if (!raw) {
    return {} as T;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (error: unknown) {
    throw new Error(
      `Failed to parse gh api JSON response: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function encodeRepoPath(filePath: string): string {
  return filePath
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function computeSettingsHashForBackup(settings: TadoiSettings): string {
  const cloned = JSON.parse(JSON.stringify(settings)) as TadoiSettings;
  if (cloned.githubBackup) {
    delete cloned.githubBackup.lastPushed;
  }
  return sha256(JSON.stringify(cloned));
}

export function parseGhAuthStatus(raw: string, exitCode: number): {
  loggedIn: boolean;
  username?: string;
  raw: string;
} {
  const compact = raw.trim();
  const patterns = [
    /Logged in to github\.com as ([A-Za-z0-9-]+)/i,
    /Logged in to github\.com account ([A-Za-z0-9-]+)/i,
    /account\s+([A-Za-z0-9-]+)\s+\(.*\)\s+active/i
  ];
  let username: string | undefined;
  for (const pattern of patterns) {
    const match = compact.match(pattern);
    if (match?.[1]) {
      username = match[1];
      break;
    }
  }

  const loggedIn =
    exitCode === 0 &&
    (Boolean(username) || /Logged in to github\.com/i.test(compact));
  return {
    loggedIn,
    ...(username ? { username } : {}),
    raw: compact
  };
}

export async function detectGh(runner: GhCommandRunner = runGhCommand): Promise<boolean> {
  const result = await runner(["--version"]);
  return result.exitCode === 0;
}

export async function getAuthStatus(
  runner: GhCommandRunner = runGhCommand
): Promise<{ loggedIn: boolean; username?: string; raw: string }> {
  const result = await runner(["auth", "status"]);
  return parseGhAuthStatus([result.stdout, result.stderr].filter(Boolean).join("\n"), result.exitCode);
}

export function ensurePersonalOwner(
  ownerRepo: string,
  username: string
): { ok: true; ownerRepo: string } | { ok: false; error: string } {
  const parsed = parseOwnerRepo(ownerRepo);
  if (!parsed) {
    return { ok: false, error: "Repository must be in owner/repo format." };
  }
  if (parsed.owner.toLowerCase() !== username.trim().toLowerCase()) {
    return {
      ok: false,
      error: `Personal repo only in v1: owner '${parsed.owner}' must match active account '${username}'.`
    };
  }
  return { ok: true, ownerRepo: `${parsed.owner}/${parsed.repo}` };
}

export async function ensureRepoPrivate(
  ownerRepo: string,
  runner: GhCommandRunner = runGhCommand
): Promise<{ ok: true } | { ok: false; isPublic?: boolean; error: string }> {
  try {
    const response = await ghApiJson<{ private?: boolean }>({
      endpoint: `repos/${ownerRepo}`,
      runner
    });
    if (response.private === true) {
      return { ok: true };
    }
    return {
      ok: false,
      isPublic: true,
      error: "Repository is public."
    };
  } catch (error: unknown) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function createPrivateRepo(
  name: string,
  options: {
    owner?: string;
    runner?: GhCommandRunner;
  } = {}
): Promise<string> {
  const repoName = name.trim();
  if (!/^[A-Za-z0-9_.-]+$/.test(repoName)) {
    throw new Error("Repository name must use letters, numbers, dot, underscore, or dash.");
  }

  const runner = options.runner ?? runGhCommand;
  const target = options.owner ? `${options.owner}/${repoName}` : repoName;
  const result = await runner(["repo", "create", target, "--private", "--add-readme", "--confirm"]);
  if (result.exitCode !== 0) {
    throw new Error(normalizeGhError(result.stderr, result.stdout, result.exitCode));
  }

  const parsed = parseOwnerRepo(target);
  if (parsed) {
    return `${parsed.owner}/${parsed.repo}`;
  }
  throw new Error("Failed to resolve created repository name.");
}

async function readRemoteFile(
  config: GitHubBackupRepoConfig,
  filePath: string,
  runner: GhCommandRunner
): Promise<string> {
  const endpoint = `repos/${config.ownerRepo}/contents/${encodeRepoPath(filePath)}?ref=${encodeURIComponent(config.branch)}`;
  const response = await ghApiJson<GitHubContentResponse>({
    endpoint,
    runner
  });
  if (response.encoding !== "base64" || typeof response.content !== "string") {
    throw new Error(`Unexpected GitHub content response for ${filePath}`);
  }
  const compact = response.content.replace(/\s+/g, "");
  return Buffer.from(compact, "base64").toString("utf8");
}

export async function listSnapshots(
  config: GitHubBackupRepoConfig,
  runner: GhCommandRunner = runGhCommand
): Promise<SnapshotRef[]> {
  const prefix = `${normalizePathPrefix(config.pathPrefix)}/snapshots/`;
  const tree = await ghApiJson<GitHubTreeResponse>({
    endpoint: `repos/${config.ownerRepo}/git/trees/${encodeURIComponent(config.branch)}?recursive=1`,
    runner
  });
  const manifestPaths =
    tree.tree
      ?.map((entry) => entry.path)
      .filter((candidate): candidate is string => typeof candidate === "string")
      .filter((candidate) => candidate.startsWith(prefix) && candidate.endsWith(".manifest.json")) ??
    [];

  const refs = await Promise.all(
    manifestPaths.map(async (manifestPath): Promise<SnapshotRef> => {
      const base = manifestPath.slice(0, -".manifest.json".length);
      const statePath = `${base}.state.json`;
      const settingsPath = `${base}.settings.json`;
      const timestamp = base.split("/").at(-1) ?? base;

      const ref: SnapshotRef = {
        id: manifestPath,
        timestamp,
        statePath,
        settingsPath,
        manifestPath
      };

      try {
        const manifestRaw = await readRemoteFile(config, manifestPath, runner);
        const manifest = JSON.parse(manifestRaw) as Partial<GitHubSnapshotManifest>;
        if (manifest.counts) {
          ref.tasksTotal = manifest.counts.tasksTotal;
          ref.tasksOpen = manifest.counts.tasksOpen;
        }
        if (typeof manifest.appVersion === "string") {
          ref.appVersion = manifest.appVersion;
        }
        if (typeof manifest.schemaVersion === "number") {
          ref.schemaVersion = manifest.schemaVersion;
        }
      } catch {
        // Keep listing robust even if one manifest is malformed.
      }

      return ref;
    })
  );

  return refs.sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}

export async function downloadSnapshot(
  config: GitHubBackupRepoConfig,
  snapshotRef: SnapshotRef,
  runner: GhCommandRunner = runGhCommand
): Promise<{ statePath: string; settingsPath: string; manifestPath: string }> {
  const stagingDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-gh-restore-"));
  const stateRaw = await readRemoteFile(config, snapshotRef.statePath, runner);
  const settingsRaw = await readRemoteFile(config, snapshotRef.settingsPath, runner);
  const manifestRaw = await readRemoteFile(config, snapshotRef.manifestPath, runner);

  const statePath = path.join(stagingDir, `${snapshotRef.timestamp}.state.json`);
  const settingsPath = path.join(stagingDir, `${snapshotRef.timestamp}.settings.json`);
  const manifestPath = path.join(stagingDir, `${snapshotRef.timestamp}.manifest.json`);

  await fs.writeFile(statePath, stateRaw, "utf8");
  await fs.writeFile(settingsPath, settingsRaw, "utf8");
  await fs.writeFile(manifestPath, manifestRaw, "utf8");

  return { statePath, settingsPath, manifestPath };
}

export async function buildRestoreImportPayload(options: {
  statePath: string;
  settingsPath: string;
  timestampId: string;
}): Promise<string> {
  const [stateRaw, settingsRaw] = await Promise.all([
    fs.readFile(options.statePath, "utf8"),
    fs.readFile(options.settingsPath, "utf8")
  ]);
  const state = JSON.parse(stateRaw) as Record<string, unknown>;
  const settings = JSON.parse(settingsRaw) as Record<string, unknown>;
  const payload = {
    ...state,
    settings
  };
  const outputPath = path.join(path.dirname(options.statePath), `${options.timestampId}.import.json`);
  await fs.writeFile(outputPath, JSON.stringify(payload, null, 2), "utf8");
  return outputPath;
}

async function createBlob(
  ownerRepo: string,
  content: string,
  runner: GhCommandRunner
): Promise<string> {
  const response = await ghApiJson<{ sha?: string }>({
    endpoint: `repos/${ownerRepo}/git/blobs`,
    method: "POST",
    payload: {
      content,
      encoding: "utf-8"
    },
    runner
  });
  if (!response.sha) {
    throw new Error("GitHub blob API response missing sha.");
  }
  return response.sha;
}

export async function pushSnapshot(
  config: GitHubBackupRepoConfig,
  artifacts: GitHubPushArtifacts,
  runner: GhCommandRunner = runGhCommand
): Promise<{ commitSha?: string }> {
  const remotePaths = buildRemoteSnapshotPaths(config.pathPrefix, artifacts.timestampId);
  const files: Array<{ path: string; content: string }> = [
    { path: remotePaths.statePath, content: artifacts.stateJson },
    { path: remotePaths.settingsPath, content: artifacts.settingsJson },
    { path: remotePaths.manifestPath, content: artifacts.manifestJson },
    { path: remotePaths.latestStatePath, content: artifacts.stateJson },
    { path: remotePaths.latestSettingsPath, content: artifacts.settingsJson },
    { path: remotePaths.latestManifestPath, content: artifacts.manifestJson }
  ];

  const headRef = await ghApiJson<{ object?: { sha?: string } }>({
    endpoint: `repos/${config.ownerRepo}/git/ref/heads/${encodeURIComponent(config.branch)}`,
    runner
  });
  const baseCommitSha = headRef.object?.sha;
  if (!baseCommitSha) {
    throw new Error(
      `Branch '${config.branch}' was not found. Create the repo with an initial commit first.`
    );
  }

  const baseCommit = await ghApiJson<GitHubCommitResponse>({
    endpoint: `repos/${config.ownerRepo}/git/commits/${baseCommitSha}`,
    runner
  });
  const baseTreeSha = baseCommit.tree?.sha;
  if (!baseTreeSha) {
    throw new Error("Unable to resolve base tree sha for branch head.");
  }

  const treeEntries = await Promise.all(
    files.map(async (file) => ({
      path: file.path,
      mode: "100644",
      type: "blob",
      sha: await createBlob(config.ownerRepo, file.content, runner)
    }))
  );

  const nextTree = await ghApiJson<{ sha?: string }>({
    endpoint: `repos/${config.ownerRepo}/git/trees`,
    method: "POST",
    payload: {
      base_tree: baseTreeSha,
      tree: treeEntries
    },
    runner
  });
  if (!nextTree.sha) {
    throw new Error("GitHub tree API response missing sha.");
  }

  const commitMessage = `tadoi: backup ${artifacts.timestampId} rev=${String(artifacts.stateRevision)}`;
  const nextCommit = await ghApiJson<{ sha?: string }>({
    endpoint: `repos/${config.ownerRepo}/git/commits`,
    method: "POST",
    payload: {
      message: commitMessage,
      tree: nextTree.sha,
      parents: [baseCommitSha]
    },
    runner
  });
  if (!nextCommit.sha) {
    throw new Error("GitHub commit API response missing sha.");
  }

  await ghApiJson({
    endpoint: `repos/${config.ownerRepo}/git/refs/heads/${encodeURIComponent(config.branch)}`,
    method: "PATCH",
    payload: {
      sha: nextCommit.sha,
      force: false
    },
    runner
  });

  return { commitSha: nextCommit.sha };
}

export function buildSnapshotArtifacts(options: {
  state: LoadedData;
  settings: TadoiSettings;
  repoConfig: GitHubBackupRepoConfig;
  deviceId: string;
  now?: Date;
}): GitHubPushArtifacts {
  const now = options.now ?? new Date();
  const timestampId = formatSnapshotId(now);
  const stateJson = JSON.stringify(options.state, null, 2);
  const settingsJson = JSON.stringify(options.settings, null, 2);
  const manifest: GitHubSnapshotManifest = {
    tadoiBackupVersion: 1,
    timestamp: now.toISOString(),
    deviceId: options.deviceId,
    ownerRepo: options.repoConfig.ownerRepo,
    branch: options.repoConfig.branch,
    pathPrefix: normalizePathPrefix(options.repoConfig.pathPrefix),
    appVersion: APP_VERSION,
    schemaVersion: options.state.schemaVersion,
    stateRevision:
      typeof options.state.stateRevision === "number" &&
      Number.isFinite(options.state.stateRevision) &&
      Number.isInteger(options.state.stateRevision) &&
      options.state.stateRevision >= 0
        ? options.state.stateRevision
        : 0,
    hashes: {
      stateSha256: sha256(stateJson),
      settingsSha256: sha256(settingsJson)
    },
    counts: {
      tasksTotal: options.state.tasks.length,
      tasksOpen: options.state.tasks.filter((task) => task.status === "open").length,
      tagsTotal: Object.keys(options.state.tagIndex ?? {}).length
    }
  };

  return {
    timestampId,
    stateJson,
    settingsJson,
    manifestJson: JSON.stringify(manifest, null, 2),
    stateRevision: manifest.stateRevision
  };
}

export function shouldSkipSnapshotPush(options: {
  stateRevision: number;
  settingsHash: string;
  lastPushed?: {
    stateRevision?: number;
    settingsHash?: string;
  };
}): boolean {
  const lastPushed = options.lastPushed;
  if (!lastPushed) return false;
  return (
    lastPushed.stateRevision === options.stateRevision &&
    lastPushed.settingsHash === options.settingsHash
  );
}
