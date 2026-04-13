import { describe, expect, it } from "bun:test";
import os from "os";
import path from "path";
import { promises as fs } from "fs";
import {
  buildSnapshotArtifacts,
  buildRemoteSnapshotPaths,
  computeSettingsHashForBackup,
  detectGh,
  downloadSnapshot,
  ensurePersonalOwner,
  formatSnapshotId,
  getAuthStatus,
  listSnapshots,
  parseGhAuthStatus,
  runGhCommand,
  type GhCommandRunner,
} from "./githubCli";
import { getDefaultSettings } from "../settings/settings";
import {
  encryptSnapshotPayload,
  isSnapshotEncryptedPayload,
} from "./snapshotCrypto";
import { APP_VERSION } from "../app/version";

describe("githubCli", () => {
  it("parses gh auth status output with active username", () => {
    const parsed = parseGhAuthStatus(
      "github.com\n  ✓ Logged in to github.com account patrick (keychain)\n",
      0,
    );
    expect(parsed.loggedIn).toBe(true);
    expect(parsed.username).toBe("patrick");
  });

  it("reports logged out when gh auth status exits non-zero", () => {
    const parsed = parseGhAuthStatus(
      "You are not logged into any GitHub hosts.",
      1,
    );
    expect(parsed.loggedIn).toBe(false);
    expect(parsed.username).toBeUndefined();
  });

  it("uses current PATH when spawning gh commands", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-gh-path-"));
    const binDir = path.join(tempRoot, "bin");
    const ghPath = path.join(binDir, "gh");
    await fs.mkdir(binDir, { recursive: true });
    await fs.writeFile(
      ghPath,
      `#!/usr/bin/env bun
const args = process.argv.slice(2);
if (args[0] === "--version") {
  process.stdout.write("gh version 2.55.0\\n");
  process.exit(0);
}
if (args[0] === "auth" && args[1] === "status") {
  process.stdout.write("Logged in to github.com as path-user\\n");
  process.exit(0);
}
process.exit(1);
`,
      { encoding: "utf8", mode: 0o755 },
    );

    const originalPath = process.env.PATH;
    process.env.PATH = `${binDir}:${originalPath ?? ""}`;
    try {
      expect(await detectGh()).toBe(true);
      const auth = await getAuthStatus();
      expect(auth.loggedIn).toBe(true);
      expect(auth.username).toBe("path-user");
    } finally {
      if (originalPath === undefined) {
        delete process.env.PATH;
      } else {
        process.env.PATH = originalPath;
      }
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("pipes stdin payloads to gh commands", async () => {
    const tempRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "tadoi-gh-stdin-"),
    );
    const binDir = path.join(tempRoot, "bin");
    const ghPath = path.join(binDir, "gh");
    await fs.mkdir(binDir, { recursive: true });
    await fs.writeFile(
      ghPath,
      `#!/usr/bin/env bun
import { readFileSync } from "fs";
const args = process.argv.slice(2);
if (args[0] === "api") {
  const stdin = readFileSync(0, "utf8");
  process.stdout.write(stdin);
  process.exit(0);
}
process.exit(1);
`,
      { encoding: "utf8", mode: 0o755 },
    );

    const originalPath = process.env.PATH;
    process.env.PATH = `${binDir}:${originalPath ?? ""}`;
    try {
      const payload = JSON.stringify({ hello: "world" });
      const result = await runGhCommand(
        ["api", "--method", "POST", "repos/test"],
        {
          stdin: payload,
        },
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(payload);
    } finally {
      if (originalPath === undefined) {
        delete process.env.PATH;
      } else {
        process.env.PATH = originalPath;
      }
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("enforces personal owner/repo routing", () => {
    expect(ensurePersonalOwner("patrick/tadoi-backups", "patrick")).toEqual({
      ok: true,
      ownerRepo: "patrick/tadoi-backups",
    });
    const mismatch = ensurePersonalOwner("org/tadoi-backups", "patrick");
    expect(mismatch.ok).toBe(false);
    const invalid = ensurePersonalOwner("not-a-repo", "patrick");
    expect(invalid.ok).toBe(false);
  });

  it("builds deterministic remote snapshot paths", () => {
    const paths = buildRemoteSnapshotPaths(
      "tadoi/devices/dev_abc",
      "20260227-123000Z",
    );
    expect(paths.statePath).toBe(
      "tadoi/devices/dev_abc/snapshots/2026/02/20260227-123000Z.state.json",
    );
    expect(paths.latestManifestPath).toBe(
      "tadoi/devices/dev_abc/latest/manifest.json",
    );
  });

  it("computes settings hash excluding github lastPushed metadata", () => {
    const base = getDefaultSettings();
    const withLastPushed = {
      ...base,
      githubBackup: {
        ...base.githubBackup!,
        lastPushed: {
          stateRevision: 10,
          settingsHash: "abc",
          timestamp: "2026-02-27T00:00:00.000Z",
          remoteCommitSha: "deadbeef",
        },
      },
    };
    const hashA = computeSettingsHashForBackup(withLastPushed);
    const hashB = computeSettingsHashForBackup({
      ...withLastPushed,
      githubBackup: {
        ...withLastPushed.githubBackup!,
        lastPushed: {
          stateRevision: 999,
          settingsHash: "zzz",
          timestamp: "2026-02-27T01:00:00.000Z",
          remoteCommitSha: "beadfeed",
        },
      },
    });
    expect(hashA).toBe(hashB);
  });

  it("lists snapshot refs newest-first with manifest metadata", async () => {
    const manifestContent = Buffer.from(
      JSON.stringify({
        appVersion: APP_VERSION,
        schemaVersion: 8,
        counts: {
          tasksTotal: 7,
          tasksOpen: 3,
        },
        encryption: {
          enabled: true,
          scheme: "aes-256-gcm+scrypt-v1",
          payloadKind: "tadoi.snapshot.encrypted.v1",
        },
      }),
      "utf8",
    ).toString("base64");
    const runner: GhCommandRunner = async (args) => {
      const joined = args.join(" ");
      if (joined.includes("/git/trees/main?recursive=1")) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            tree: [
              {
                path: "tadoi/devices/dev_abc/snapshots/2026/02/20260227-123000Z.manifest.json",
                type: "blob",
              },
              {
                path: "tadoi/devices/dev_abc/snapshots/2026/02/20260226-093000Z.manifest.json",
                type: "blob",
              },
            ],
          }),
          stderr: "",
        };
      }
      if (joined.includes("20260227-123000Z.manifest.json")) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            encoding: "base64",
            content: manifestContent,
          }),
          stderr: "",
        };
      }
      if (joined.includes("20260226-093000Z.manifest.json")) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            encoding: "base64",
            content: manifestContent,
          }),
          stderr: "",
        };
      }
      throw new Error(`Unexpected gh args in test: ${joined}`);
    };

    const snapshots = await listSnapshots(
      {
        ownerRepo: "patrick/tadoi-backups",
        branch: "main",
        pathPrefix: "tadoi/devices/dev_abc",
      },
      runner,
    );

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0]?.timestamp).toBe("20260227-123000Z");
    expect(snapshots[0]?.tasksTotal).toBe(7);
    expect(snapshots[0]?.tasksOpen).toBe(3);
    expect(snapshots[0]?.appVersion).toBe(APP_VERSION);
    expect(snapshots[0]?.encrypted).toBe(true);
  });

  it("formats snapshot ids in UTC", () => {
    const id = formatSnapshotId(new Date("2026-02-27T05:06:07.000Z"));
    expect(id).toBe("20260227-050607Z");
  });

  it("builds encrypted snapshot artifacts when passphrase is supplied", () => {
    const settings = getDefaultSettings();
    const artifacts = buildSnapshotArtifacts({
      state: {
        schemaVersion: 8,
        stateRevision: 12,
        tasks: [
          {
            id: "task-1",
            title: "Task",
            status: "open",
            createdAt: 1,
            updatedAt: 1,
            tags: [],
          },
        ],
        tagIndex: {},
        savedViews: [],
      },
      settings,
      repoConfig: {
        ownerRepo: "patrick/tadoi-backups",
        branch: "main",
        pathPrefix: "tadoi/devices/dev_abc",
      },
      deviceId: "dev_abc",
      now: new Date("2026-02-27T12:30:00.000Z"),
      encryptionPassphrase: "local passphrase",
    });

    expect(isSnapshotEncryptedPayload(artifacts.stateJson)).toBe(true);
    expect(isSnapshotEncryptedPayload(artifacts.settingsJson)).toBe(true);
    const manifest = JSON.parse(artifacts.manifestJson) as {
      encryption?: { enabled?: boolean; scheme?: string; payloadKind?: string };
    };
    expect(manifest.encryption?.enabled).toBe(true);
    expect(manifest.encryption?.scheme).toBe("aes-256-gcm+scrypt-v1");
    expect(manifest.encryption?.payloadKind).toBe(
      "tadoi.snapshot.encrypted.v1",
    );
  });

  it("downloads and decrypts encrypted snapshots when passphrase is present", async () => {
    const statePlain = JSON.stringify({ schemaVersion: 8, tasks: [] }, null, 2);
    const settingsPlain = JSON.stringify(getDefaultSettings(), null, 2);
    const stateEncrypted = encryptSnapshotPayload(
      statePlain,
      "restore passphrase",
    );
    const settingsEncrypted = encryptSnapshotPayload(
      settingsPlain,
      "restore passphrase",
    );
    const manifestRaw = JSON.stringify({
      encryption: {
        enabled: true,
        scheme: "aes-256-gcm+scrypt-v1",
        payloadKind: "tadoi.snapshot.encrypted.v1",
      },
    });

    const runner: GhCommandRunner = async (args) => {
      const joined = args.join(" ");
      if (joined.includes(".state.json")) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            encoding: "base64",
            content: Buffer.from(stateEncrypted, "utf8").toString("base64"),
          }),
          stderr: "",
        };
      }
      if (joined.includes(".settings.json")) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            encoding: "base64",
            content: Buffer.from(settingsEncrypted, "utf8").toString("base64"),
          }),
          stderr: "",
        };
      }
      if (joined.includes(".manifest.json")) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            encoding: "base64",
            content: Buffer.from(manifestRaw, "utf8").toString("base64"),
          }),
          stderr: "",
        };
      }
      throw new Error(`Unexpected gh args in test: ${joined}`);
    };

    const snapshotRef = {
      id: "manifest",
      timestamp: "20260227-123000Z",
      statePath: "snapshots/2026/02/20260227-123000Z.state.json",
      settingsPath: "snapshots/2026/02/20260227-123000Z.settings.json",
      manifestPath: "snapshots/2026/02/20260227-123000Z.manifest.json",
    };
    const downloaded = await downloadSnapshot(
      {
        ownerRepo: "patrick/tadoi-backups",
        branch: "main",
        pathPrefix: "tadoi/devices/dev_abc",
      },
      snapshotRef,
      {
        passphrase: "restore passphrase",
        runner,
      },
    );

    try {
      const [stateFileRaw, settingsFileRaw] = await Promise.all([
        fs.readFile(downloaded.statePath, "utf8"),
        fs.readFile(downloaded.settingsPath, "utf8"),
      ]);
      expect(stateFileRaw).toBe(statePlain);
      expect(settingsFileRaw).toBe(settingsPlain);
    } finally {
      await fs.rm(path.dirname(downloaded.statePath), {
        recursive: true,
        force: true,
      });
    }
  });

  it("fails encrypted snapshot restore when passphrase is missing", async () => {
    const statePlain = JSON.stringify({ schemaVersion: 8, tasks: [] }, null, 2);
    const settingsPlain = JSON.stringify(getDefaultSettings(), null, 2);
    const stateEncrypted = encryptSnapshotPayload(
      statePlain,
      "restore passphrase",
    );
    const settingsEncrypted = encryptSnapshotPayload(
      settingsPlain,
      "restore passphrase",
    );
    const manifestRaw = JSON.stringify({
      encryption: {
        enabled: true,
        scheme: "aes-256-gcm+scrypt-v1",
        payloadKind: "tadoi.snapshot.encrypted.v1",
      },
    });

    const runner: GhCommandRunner = async (args) => {
      const joined = args.join(" ");
      if (joined.includes(".state.json")) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            encoding: "base64",
            content: Buffer.from(stateEncrypted, "utf8").toString("base64"),
          }),
          stderr: "",
        };
      }
      if (joined.includes(".settings.json")) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            encoding: "base64",
            content: Buffer.from(settingsEncrypted, "utf8").toString("base64"),
          }),
          stderr: "",
        };
      }
      if (joined.includes(".manifest.json")) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            encoding: "base64",
            content: Buffer.from(manifestRaw, "utf8").toString("base64"),
          }),
          stderr: "",
        };
      }
      throw new Error(`Unexpected gh args in test: ${joined}`);
    };

    await expect(
      downloadSnapshot(
        {
          ownerRepo: "patrick/tadoi-backups",
          branch: "main",
          pathPrefix: "tadoi/devices/dev_abc",
        },
        {
          id: "manifest",
          timestamp: "20260227-123000Z",
          statePath: "snapshots/2026/02/20260227-123000Z.state.json",
          settingsPath: "snapshots/2026/02/20260227-123000Z.settings.json",
          manifestPath: "snapshots/2026/02/20260227-123000Z.manifest.json",
        },
        { runner },
      ),
    ).rejects.toThrow("Snapshot is encrypted.");
  });
});
