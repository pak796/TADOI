import { describe, expect, it } from "bun:test";
import {
  buildRemoteSnapshotPaths,
  computeSettingsHashForBackup,
  ensurePersonalOwner,
  formatSnapshotId,
  listSnapshots,
  parseGhAuthStatus,
  type GhCommandRunner
} from "./githubCli";
import { getDefaultSettings } from "../settings/settings";

describe("githubCli", () => {
  it("parses gh auth status output with active username", () => {
    const parsed = parseGhAuthStatus(
      "github.com\n  ✓ Logged in to github.com account patrick (keychain)\n",
      0
    );
    expect(parsed.loggedIn).toBe(true);
    expect(parsed.username).toBe("patrick");
  });

  it("reports logged out when gh auth status exits non-zero", () => {
    const parsed = parseGhAuthStatus("You are not logged into any GitHub hosts.", 1);
    expect(parsed.loggedIn).toBe(false);
    expect(parsed.username).toBeUndefined();
  });

  it("enforces personal owner/repo routing", () => {
    expect(ensurePersonalOwner("patrick/tadoi-backups", "patrick")).toEqual({
      ok: true,
      ownerRepo: "patrick/tadoi-backups"
    });
    const mismatch = ensurePersonalOwner("org/tadoi-backups", "patrick");
    expect(mismatch.ok).toBe(false);
    const invalid = ensurePersonalOwner("not-a-repo", "patrick");
    expect(invalid.ok).toBe(false);
  });

  it("builds deterministic remote snapshot paths", () => {
    const paths = buildRemoteSnapshotPaths(
      "tadoi/devices/dev_abc",
      "20260227-123000Z"
    );
    expect(paths.statePath).toBe(
      "tadoi/devices/dev_abc/snapshots/2026/02/20260227-123000Z.state.json"
    );
    expect(paths.latestManifestPath).toBe(
      "tadoi/devices/dev_abc/latest/manifest.json"
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
          remoteCommitSha: "deadbeef"
        }
      }
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
          remoteCommitSha: "beadfeed"
        }
      }
    });
    expect(hashA).toBe(hashB);
  });

  it("lists snapshot refs newest-first with manifest metadata", async () => {
    const manifestContent = Buffer.from(
      JSON.stringify({
        appVersion: "v0.3.9",
        schemaVersion: 8,
        counts: {
          tasksTotal: 7,
          tasksOpen: 3
        }
      }),
      "utf8"
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
                type: "blob"
              },
              {
                path: "tadoi/devices/dev_abc/snapshots/2026/02/20260226-093000Z.manifest.json",
                type: "blob"
              }
            ]
          }),
          stderr: ""
        };
      }
      if (joined.includes("20260227-123000Z.manifest.json")) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({ encoding: "base64", content: manifestContent }),
          stderr: ""
        };
      }
      if (joined.includes("20260226-093000Z.manifest.json")) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({ encoding: "base64", content: manifestContent }),
          stderr: ""
        };
      }
      throw new Error(`Unexpected gh args in test: ${joined}`);
    };

    const snapshots = await listSnapshots(
      {
        ownerRepo: "patrick/tadoi-backups",
        branch: "main",
        pathPrefix: "tadoi/devices/dev_abc"
      },
      runner
    );

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0]?.timestamp).toBe("20260227-123000Z");
    expect(snapshots[0]?.tasksTotal).toBe(7);
    expect(snapshots[0]?.tasksOpen).toBe(3);
    expect(snapshots[0]?.appVersion).toBe("v0.3.9");
  });

  it("formats snapshot ids in UTC", () => {
    const id = formatSnapshotId(new Date("2026-02-27T05:06:07.000Z"));
    expect(id).toBe("20260227-050607Z");
  });
});
