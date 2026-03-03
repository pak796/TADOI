import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import React from "react";
import os from "os";
import path from "path";
import { createHash } from "node:crypto";
import { promises as fs } from "fs";
import { testRender } from "@opentui/react/test-utils";
import type { MockInput } from "@opentui/core/testing";
import { App } from "./App";
import type { Task } from "../domain/models";
import { createDefaultEngagementState } from "../domain/engagement";
import type { LoadedData } from "../state/persistence";
import type {
  GitHubBackupSettings,
  NotificationSettings,
  RetroFxMode
} from "../settings/settings";
import { addLocalDaysMs, startOfLocalDayMs } from "../domain/dates";
import { ENV_VARS } from "../brand/brand";
import { encryptSnapshotPayload } from "../backup/snapshotCrypto";

type RenderHarness = Awaited<ReturnType<typeof testRender>>;

type AppSession = {
  harness: RenderHarness;
  tempDir: string;
  settingsPath: string;
};

type SessionOptions = {
  initialData?: LoadedData;
  showCorruptionRecoveryImportCta?: boolean;
  initialRetroFxMode?: RetroFxMode;
  initialNotificationSettings?: NotificationSettings;
  initialGithubBackup?: GitHubBackupSettings;
  skipInitialSave?: boolean;
  width?: number;
  height?: number;
};

type BackupRuntimeFixture = {
  dataPath: string;
  backupDir: string;
  backupFilename: string;
  backupImportPath: string;
  calendarImportPath: string;
  calendarExportPath: string;
};

const SIMPLE_CALENDAR_ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//TADOI//EN",
  "BEGIN:VEVENT",
  "UID:integration-event-1",
  "SUMMARY:Integration import event",
  "DTSTART:20260225T090000",
  "DTEND:20260225T093000",
  "END:VEVENT",
  "END:VCALENDAR"
].join("\n");
const REPO_CWD = process.cwd();

function withSchemaV7WorkflowStage(task: Task): Task {
  if (task.workflowStage) {
    return task;
  }
  return {
    ...task,
    workflowStage: task.status === "open" ? "todo" : "done"
  };
}

function makeTask(id: string, title: string, nowMs = Date.now()): Task {
  return {
    id,
    title,
    status: "open",
    createdAt: nowMs,
    updatedAt: nowMs,
    tags: [],
    workflowStage: "todo"
  };
}

function makeInitialData(tasks: Task[] = [makeTask("task-1", "Existing task")]): LoadedData {
  return {
    schemaVersion: 8,
    stateRevision: 0,
    tasks: tasks.map(withSchemaV7WorkflowStage),
    tagIndex: {},
    savedViews: [],
    engagement: createDefaultEngagementState()
  };
}

function makeReminderDueTask(
  id: string,
  title: string,
  nowMs = Date.now()
): Task {
  return {
    ...makeTask(id, title, nowMs),
    dueAt: nowMs + 60 * 60_000,
    hasExplicitTime: true,
    reminder: {
      kind: "absolute",
      at: nowMs - 2 * 60_000
    }
  };
}

async function createSession(options: SessionOptions = {}): Promise<AppSession> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-app-modal-flow-"));
  const settingsPath = path.join(tempDir, "settings.json");
  const harness = await testRender(
    React.createElement(App, {
      initialData: options.initialData ?? makeInitialData(),
      showCorruptionRecoveryImportCta: options.showCorruptionRecoveryImportCta,
      skipInitialSave: options.skipInitialSave ?? true,
      settingsPath,
      initialRetroFxMode: options.initialRetroFxMode,
      initialNotificationSettings: options.initialNotificationSettings,
      initialGithubBackup: options.initialGithubBackup,
      showLogo: false
    }),
    {
      width: options.width ?? 150,
      height: options.height ?? 44
    }
  );
  await harness.renderOnce();
  return { harness, tempDir, settingsPath };
}

async function cleanupSession(session: AppSession): Promise<void> {
  await session.harness.renderer.destroy();
  await fs.rm(session.tempDir, { recursive: true, force: true });
}

async function waitForFrame(
  harness: RenderHarness,
  predicate: (frame: string) => boolean,
  timeoutMs = 4000
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let lastFrame = "";
  while (Date.now() <= deadline) {
    await harness.renderOnce();
    lastFrame = harness.captureCharFrame();
    if (predicate(lastFrame)) {
      return lastFrame;
    }
    await Bun.sleep(20);
  }
  throw new Error(`Timed out waiting for frame condition.\nLast frame:\n${lastFrame}`);
}

async function waitForText(
  harness: RenderHarness,
  text: string,
  timeoutMs = 4000
): Promise<string> {
  return waitForFrame(harness, (frame) => frame.includes(text), timeoutMs);
}

async function waitForAnyText(
  harness: RenderHarness,
  texts: string[],
  timeoutMs = 4000
): Promise<string> {
  return waitForFrame(
    harness,
    (frame) => texts.some((text) => frame.includes(text)),
    timeoutMs
  );
}

async function waitForFile(pathname: string, timeoutMs = 4000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    try {
      await fs.stat(pathname);
      return;
    } catch {
      await Bun.sleep(20);
    }
  }
  throw new Error(`Timed out waiting for file: ${pathname}`);
}

async function expectTextAbsentForDuration(
  harness: RenderHarness,
  text: string,
  durationMs = 900
): Promise<void> {
  const deadline = Date.now() + durationMs;
  while (Date.now() <= deadline) {
    await harness.renderOnce();
    const frame = harness.captureCharFrame();
    expect(frame).not.toContain(text);
    await Bun.sleep(30);
  }
}

async function pressKeyAndRender(mockInput: MockInput, harness: RenderHarness, key: string) {
  await mockInput.pressKeys([key]);
  await Bun.sleep(10);
  await harness.renderOnce();
}

async function pressCtrlKeyAndRender(
  mockInput: MockInput,
  harness: RenderHarness,
  key: string
) {
  mockInput.pressKey(key, { ctrl: true });
  await Bun.sleep(10);
  await harness.renderOnce();
}

async function pressEnterAndRender(mockInput: MockInput, harness: RenderHarness) {
  await Promise.resolve(mockInput.pressEnter());
  await Bun.sleep(10);
  await harness.renderOnce();
}

async function pressEscapeAndRender(mockInput: MockInput, harness: RenderHarness) {
  await Promise.resolve(mockInput.pressEscape());
  await Bun.sleep(10);
  await harness.renderOnce();
}

async function pressBackspaceAndRender(
  mockInput: MockInput,
  harness: RenderHarness,
  times = 1
) {
  for (let index = 0; index < times; index += 1) {
    mockInput.pressKey("backspace");
    await Bun.sleep(10);
    await harness.renderOnce();
  }
}

async function pressTabAndRender(
  mockInput: MockInput,
  harness: RenderHarness,
  times = 1
) {
  for (let index = 0; index < times; index += 1) {
    await Promise.resolve(mockInput.pressTab());
    await Bun.sleep(10);
    await harness.renderOnce();
  }
}

async function pressArrowAndRender(
  mockInput: MockInput,
  harness: RenderHarness,
  direction: "up" | "down" | "left" | "right",
  times = 1
) {
  for (let index = 0; index < times; index += 1) {
    await Promise.resolve(mockInput.pressArrow(direction));
    await Bun.sleep(10);
    await harness.renderOnce();
  }
}

async function focusEditorSaveAndSubmit(
  mockInput: MockInput,
  harness: RenderHarness,
  mode: "ADD" | "EDIT"
): Promise<void> {
  for (let index = 0; index < 32; index += 1) {
    await harness.renderOnce();
    const frame = harness.captureCharFrame();
    if (frame.includes(`MODE:  ${mode}`) && frame.includes("FOCUS: SAVE")) {
      await pressEnterAndRender(mockInput, harness);
      return;
    }
    await pressTabAndRender(mockInput, harness);
  }
  throw new Error(`Unable to focus editor SAVE action in ${mode} mode.`);
}

async function typeTextAndRender(
  mockInput: MockInput,
  harness: RenderHarness,
  text: string
) {
  await mockInput.typeText(text);
  await Bun.sleep(20);
  await harness.renderOnce();
}

async function pasteTextAndRender(
  mockInput: MockInput,
  harness: RenderHarness,
  text: string
) {
  await mockInput.pasteBracketedText(text);
  await Bun.sleep(20);
  await harness.renderOnce();
}

async function scrollMouseAndRender(
  harness: RenderHarness,
  options: { x: number; y: number; direction: "up" | "down"; times?: number }
) {
  const { x, y, direction, times = 1 } = options;
  for (let index = 0; index < times; index += 1) {
    await harness.mockMouse.scroll(x, y, direction);
    await Bun.sleep(10);
    await harness.renderOnce();
  }
}

function findTextPositions(frame: string, text: string): Array<{ x: number; y: number }> {
  const lines = frame.split("\n");
  const positions: Array<{ x: number; y: number }> = [];

  for (let y = 0; y < lines.length; y += 1) {
    const line = lines[y];
    let start = 0;
    while (start <= line.length - text.length) {
      const x = line.indexOf(text, start);
      if (x < 0) break;
      positions.push({
        x: x + Math.max(0, Math.floor(text.length / 2)),
        y
      });
      start = x + 1;
    }
  }

  return positions;
}

function findTextPosition(
  frame: string,
  text: string,
  occurrence: "first" | "last" = "first"
): { x: number; y: number } {
  const positions = findTextPositions(frame, text);
  const found =
    occurrence === "first" ? positions[0] : positions[positions.length - 1];
  if (!found) {
    throw new Error(`Unable to locate text in frame: "${text}"\n${frame}`);
  }
  return found;
}

function expectFrameTextOrder(frame: string, tokens: string[]): void {
  let previousIndex = -1;
  for (const token of tokens) {
    const index = frame.indexOf(token);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeGreaterThan(previousIndex);
    previousIndex = index;
  }
}

function extractHelpSettingsRowValue(frame: string, label: string): string {
  const token = `${label}:`;
  for (const line of frame.split("\n")) {
    const tokenIndex = line.indexOf(token);
    if (tokenIndex < 0) continue;
    let value = line.slice(tokenIndex + token.length);
    const borderIndex = value.indexOf("│");
    if (borderIndex >= 0) {
      value = value.slice(0, borderIndex);
    }
    return value.trim();
  }
  throw new Error(`Unable to extract settings row value for label: ${label}`);
}

async function clickTextAndRender(
  harness: RenderHarness,
  text: string,
  occurrence: "first" | "last" = "first"
) {
  await harness.renderOnce();
  const frame = harness.captureCharFrame();
  const { x, y } = findTextPosition(frame, text, occurrence);
  await harness.mockMouse.pressDown(x + 1, y + 1);
  await harness.mockMouse.release(x + 1, y + 1);
  await Bun.sleep(20);
  await harness.renderOnce();
}

async function clickTextUntil(
  harness: RenderHarness,
  text: string,
  predicate: (frame: string) => boolean,
  occurrence: "first" | "last" = "first"
): Promise<string> {
  await harness.renderOnce();
  const frame = harness.captureCharFrame();
  const positions = findTextPositions(frame, text);
  if (positions.length === 0) {
    throw new Error(`Unable to locate text in frame: "${text}"\n${frame}`);
  }
  const orderedPositions =
    occurrence === "first" ? positions : [...positions].reverse();
  const offsets = [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1]
  ] as const;

  for (const position of orderedPositions) {
    for (const [dx, dy] of offsets) {
      const clickX = Math.max(0, position.x + 1 + dx);
      const clickY = Math.max(0, position.y + 1 + dy);
      await harness.mockMouse.pressDown(clickX, clickY);
      await harness.mockMouse.release(clickX, clickY);
      await Bun.sleep(20);
      await harness.renderOnce();
      const nextFrame = harness.captureCharFrame();
      if (predicate(nextFrame)) {
        return nextFrame;
      }
    }
  }

  throw new Error(`Unable to trigger mouse interaction for text: "${text}"`);
}

async function withDataPath<T>(dataPath: string, run: () => Promise<T>): Promise<T> {
  const originalDataPath = process.env.TADOI_DATA_PATH;
  process.env.TADOI_DATA_PATH = dataPath;
  try {
    return await run();
  } finally {
    if (originalDataPath === undefined) {
      delete process.env.TADOI_DATA_PATH;
    } else {
      process.env.TADOI_DATA_PATH = originalDataPath;
    }
  }
}

async function withDataPathAndCwd<T>(
  dataPath: string,
  cwd: string,
  run: () => Promise<T>
): Promise<T> {
  const originalCwd = process.cwd();
  return withDataPath(dataPath, async () => {
    process.chdir(cwd);
    try {
      return await run();
    } finally {
      try {
        process.chdir(originalCwd);
      } catch {
        process.chdir(REPO_CWD);
      }
    }
  });
}

async function prepareBackupRuntimeFixture(
  session: AppSession,
  options: {
    localTasks?: Task[];
    backupImportPayload?: unknown;
    calendarIcs?: string;
  } = {}
): Promise<BackupRuntimeFixture> {
  const dataPath = path.join(session.tempDir, "tadoi_data.json");
  const backupDir = path.join(session.tempDir, "backups");
  const backupFilename = "tadoi-backup-20260221-000001.json";
  const backupImportPath = path.join(backupDir, backupFilename);
  const calendarImportPath = path.join(backupDir, "incoming.ics");
  const calendarExportPath = path.join(backupDir, "calendar-export-output.ics");

  const backupImportPayload =
    options.backupImportPayload ??
    {
      schemaVersion: 4,
      tasks: [makeTask("incoming-task", "Incoming task")],
      tagIndex: {},
      savedViews: []
    };

  await fs.mkdir(backupDir, { recursive: true });
  await fs.writeFile(
    dataPath,
    JSON.stringify(makeInitialData(options.localTasks ?? [makeTask("local-task", "Local task")]), null, 2),
    "utf8"
  );
  await fs.writeFile(backupImportPath, JSON.stringify(backupImportPayload, null, 2), "utf8");
  await fs.writeFile(calendarImportPath, options.calendarIcs ?? SIMPLE_CALENDAR_ICS, "utf8");

  return {
    dataPath,
    backupDir,
    backupFilename,
    backupImportPath,
    calendarImportPath,
    calendarExportPath
  };
}

async function createFakeGitHubCliFixture(options: {
  rootDir: string;
  ownerRepo: string;
  branch: string;
  pathPrefix: string;
  passphrase: string;
}): Promise<{
  binDir: string;
  logPath: string;
}> {
  const timestamp = "20260227-123000Z";
  const year = timestamp.slice(0, 4);
  const month = timestamp.slice(4, 6);
  const basePath = `${options.pathPrefix}/snapshots/${year}/${month}/${timestamp}`;
  const manifestPath = `${basePath}.manifest.json`;
  const statePath = `${basePath}.state.json`;
  const settingsPath = `${basePath}.settings.json`;

  const restoreState = JSON.stringify(
    {
      schemaVersion: 8,
      stateRevision: 7,
      tasks: [makeTask("restored-encrypted-1", "Restored encrypted task")],
      tagIndex: {},
      savedViews: []
    },
    null,
    2
  );
  const restoreSettings = JSON.stringify(
    {
      themeId: "default",
      logoMode: "default",
      flashMode: "slow",
      notifications: {
        enabled: true,
        inAppOverdueBanner: true,
        terminalBellOnOverdue: false,
        bannerDurationMs: 5000,
        bellCooldownMs: 2000
      },
      security: {
        nonHttpLinkPolicy: "prompt"
      },
      githubBackup: {
        enabled: true,
        ownerRepo: options.ownerRepo,
        branch: options.branch,
        deviceId: "dev_test",
        pathPrefix: options.pathPrefix,
        autoPushPolicy: "off"
      },
      notes: {
        enabled: true,
        rootPath: null
      }
    },
    null,
    2
  );
  const restoreManifest = JSON.stringify(
    {
      tadoiBackupVersion: 1,
      timestamp: "2026-02-27T12:30:00.000Z",
      deviceId: "dev_test",
      ownerRepo: options.ownerRepo,
      branch: options.branch,
      pathPrefix: options.pathPrefix,
      appVersion: "v0.3.9",
      schemaVersion: 8,
      stateRevision: 7,
      hashes: {
        stateSha256: createHash("sha256").update(restoreState).digest("hex"),
        settingsSha256: createHash("sha256").update(restoreSettings).digest("hex")
      },
      counts: {
        tasksTotal: 1,
        tasksOpen: 1,
        tagsTotal: 0
      },
      encryption: {
        enabled: true,
        scheme: "aes-256-gcm+scrypt-v1",
        payloadKind: "tadoi.snapshot.encrypted.v1"
      }
    },
    null,
    2
  );

  const encryptedState = encryptSnapshotPayload(restoreState, options.passphrase);
  const encryptedSettings = encryptSnapshotPayload(restoreSettings, options.passphrase);

  const binDir = path.join(options.rootDir, "fake-gh-bin");
  const ghPath = path.join(binDir, "gh");
  const logPath = path.join(options.rootDir, "fake-gh.log");
  await fs.mkdir(binDir, { recursive: true });

  const script = `#!/usr/bin/env bun
import { appendFileSync, readFileSync } from "fs";

const ownerRepo = ${JSON.stringify(options.ownerRepo)};
const branch = ${JSON.stringify(options.branch)};
const manifestPath = ${JSON.stringify(manifestPath)};
const statePath = ${JSON.stringify(statePath)};
const settingsPath = ${JSON.stringify(settingsPath)};
const logPath = process.env.TADOI_TEST_GH_LOG_PATH || ${JSON.stringify(logPath)};
const manifestB64 = ${JSON.stringify(Buffer.from(restoreManifest, "utf8").toString("base64"))};
const stateB64 = ${JSON.stringify(Buffer.from(encryptedState, "utf8").toString("base64"))};
const settingsB64 = ${JSON.stringify(Buffer.from(encryptedSettings, "utf8").toString("base64"))};

const args = process.argv.slice(2);
const log = (line) => {
  if (!logPath) return;
  appendFileSync(logPath, String(line) + "\\n");
};
const respondJson = (value) => {
  process.stdout.write(JSON.stringify(value));
};

if (args[0] === "--version") {
  process.stdout.write("gh version 2.55.0\\n");
  process.exit(0);
}

if (args[0] === "auth" && args[1] === "status") {
  process.stdout.write("Logged in to github.com as patrick\\n");
  process.exit(0);
}

if (args[0] === "api") {
  let method = "GET";
  let endpoint = "";
  for (let i = 1; i < args.length; i += 1) {
    const token = args[i];
    if (token === "--method") {
      method = args[i + 1] || "GET";
      i += 1;
      continue;
    }
    if (!token.startsWith("--") && endpoint.length === 0) {
      endpoint = token;
    }
  }

  let stdin = "";
  if (args.includes("--input")) {
    try {
      stdin = readFileSync(0, "utf8");
    } catch {
      stdin = "";
    }
  }

  log("API " + method + " " + endpoint);

  if (method === "GET" && endpoint === \`repos/\${ownerRepo}\`) {
    respondJson({ private: true });
    process.exit(0);
  }
  if (method === "GET" && endpoint === \`repos/\${ownerRepo}/git/ref/heads/\${encodeURIComponent(branch)}\`) {
    respondJson({ object: { sha: "basecommitsha" } });
    process.exit(0);
  }
  if (method === "GET" && endpoint === \`repos/\${ownerRepo}/git/commits/basecommitsha\`) {
    respondJson({ tree: { sha: "basetreesha" } });
    process.exit(0);
  }
  if (method === "POST" && endpoint === \`repos/\${ownerRepo}/git/blobs\`) {
    try {
      const parsed = JSON.parse(stdin || "{}");
      const content = typeof parsed.content === "string" ? parsed.content : "";
      log("BLOB_HAS_ENCRYPTION " + (content.includes("tadoi.snapshot.encrypted.v1") ? "yes" : "no"));
    } catch {
      log("BLOB_HAS_ENCRYPTION no");
    }
    respondJson({ sha: "blobsha" });
    process.exit(0);
  }
  if (method === "POST" && endpoint === \`repos/\${ownerRepo}/git/trees\`) {
    respondJson({ sha: "nexttreesha" });
    process.exit(0);
  }
  if (method === "POST" && endpoint === \`repos/\${ownerRepo}/git/commits\`) {
    respondJson({ sha: "nextcommitsha" });
    process.exit(0);
  }
  if (method === "PATCH" && endpoint === \`repos/\${ownerRepo}/git/refs/heads/\${encodeURIComponent(branch)}\`) {
    respondJson({});
    process.exit(0);
  }
  if (method === "GET" && endpoint === \`repos/\${ownerRepo}/git/trees/\${encodeURIComponent(branch)}?recursive=1\`) {
    respondJson({
      tree: [{ path: manifestPath, type: "blob" }]
    });
    process.exit(0);
  }

  const contentsPrefix = \`repos/\${ownerRepo}/contents/\`;
  if (method === "GET" && endpoint.startsWith(contentsPrefix)) {
    const encodedPath = endpoint.slice(contentsPrefix.length).split("?")[0] || "";
    const decodedPath = decodeURIComponent(encodedPath);
    if (decodedPath === manifestPath) {
      respondJson({ encoding: "base64", content: manifestB64 });
      process.exit(0);
    }
    if (decodedPath === statePath) {
      respondJson({ encoding: "base64", content: stateB64 });
      process.exit(0);
    }
    if (decodedPath === settingsPath) {
      respondJson({ encoding: "base64", content: settingsB64 });
      process.exit(0);
    }
  }

  process.stderr.write("Unhandled gh api endpoint: " + method + " " + endpoint + "\\n");
  process.exit(1);
}

process.stderr.write("Unhandled gh args: " + args.join(" ") + "\\n");
process.exit(1);
`;

  await fs.writeFile(ghPath, script, { encoding: "utf8", mode: 0o755 });
  return { binDir, logPath };
}

async function openHelpSettingsPage(harness: RenderHarness) {
  const { mockInput } = harness;
  await pressKeyAndRender(mockInput, harness, "?");
  await waitForText(harness, "Getting Started");
  let lastFrame = "";
  for (let step = 0; step < 16; step += 1) {
    await harness.renderOnce();
    let frame = harness.captureCharFrame();
    lastFrame = frame;
    if (isHelpSettingsRootFrame(frame)) {
      return;
    }
    await pressArrowAndRender(mockInput, harness, "right");
    await harness.renderOnce();
    frame = harness.captureCharFrame();
    lastFrame = frame;
    if (isHelpSettingsRootFrame(frame)) {
      return;
    }
    await pressArrowAndRender(mockInput, harness, "down");
  }
  throw new Error(`Unable to open Help settings page.\nLast frame:\n${lastFrame}`);
}

function isHelpSettingsRootFrame(frame: string): boolean {
  return frame.includes("Help / Settings") && !frame.includes("Help / Settings /");
}

async function waitForHelpSettingsRoot(harness: RenderHarness): Promise<string> {
  return waitForFrame(harness, (frame) => isHelpSettingsRootFrame(frame));
}

async function ensureHelpSettingsPage(harness: RenderHarness): Promise<void> {
  await harness.renderOnce();
  const frame = harness.captureCharFrame();
  if (isHelpSettingsRootFrame(frame)) {
    return;
  }
  if (frame.includes("Help / Settings /")) {
    await pressEscapeAndRender(harness.mockInput, harness);
    await waitForHelpSettingsRoot(harness);
    return;
  }
  await openHelpSettingsPage(harness);
  await waitForHelpSettingsRoot(harness);
}

async function focusHelpSettingsItem(
  harness: RenderHarness,
  selectedItemPrefix: string,
  maxSteps = 16
): Promise<string> {
  const { mockInput } = harness;
  for (let step = 0; step < maxSteps; step += 1) {
    await harness.renderOnce();
    const frame = harness.captureCharFrame();
    if (frame.includes(selectedItemPrefix)) {
      return frame;
    }
    await pressArrowAndRender(mockInput, harness, "down");
  }
  throw new Error(`Unable to focus settings item: ${selectedItemPrefix}`);
}

async function openHelpSettingsSection(
  harness: RenderHarness,
  sectionItemPrefix: string,
  expectedHeaderText: string
): Promise<string> {
  await ensureHelpSettingsPage(harness);
  await focusHelpSettingsItem(harness, sectionItemPrefix);
  await pressEnterAndRender(harness.mockInput, harness);
  try {
    return await waitForText(harness, expectedHeaderText, 1200);
  } catch {
    await ensureHelpSettingsPage(harness);
    const clickToken = sectionItemPrefix.replace(/^▶\s*/, "");
    return clickTextUntil(
      harness,
      clickToken,
      (frame) => frame.includes(expectedHeaderText),
      "first"
    );
  }
}

async function cycleRetroFxModeSettingFromHelp(harness: RenderHarness) {
  const { mockInput } = harness;
  await openHelpSettingsSection(harness, "▶ Appearance", "Help / Settings / Appearance");
  await focusHelpSettingsItem(harness, "▶ Retro FX Mode:");
  await pressEnterAndRender(mockInput, harness);
}

async function selectNavigationHintsMode(
  harness: RenderHarness,
  label: "Bottom only" | "Left rail only" | "Both" | "None"
): Promise<void> {
  const { mockInput } = harness;
  await openHelpSettingsSection(
    harness,
    "▶ Navigation & Keymaps",
    "Help / Settings / Navigation & Keymaps"
  );
  await focusHelpSettingsItem(harness, "▶ Navigation Hints:");
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await harness.renderOnce();
    const frame = harness.captureCharFrame();
    if (frame.includes(`▶ Navigation Hints: ${label}`)) {
      return;
    }
    await pressEnterAndRender(mockInput, harness);
  }
  throw new Error(`Unable to set Navigation Hints mode to ${label}`);
}

async function setPrefixPopupEnabled(
  harness: RenderHarness,
  enabled: boolean
): Promise<void> {
  const { mockInput } = harness;
  await openHelpSettingsSection(
    harness,
    "▶ Navigation & Keymaps",
    "Help / Settings / Navigation & Keymaps"
  );
  await focusHelpSettingsItem(harness, "▶ Prefix Popup:");
  const targetLabel = enabled ? "on" : "off";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await harness.renderOnce();
    const frame = harness.captureCharFrame();
    if (frame.includes(`▶ Prefix Popup: ${targetLabel}`)) {
      return;
    }
    await pressEnterAndRender(mockInput, harness);
  }
  throw new Error(`Unable to set Prefix Popup to ${targetLabel}`);
}

async function setSecurityNonHttpPolicy(
  harness: RenderHarness,
  targetLabel: "Prompt" | "Block"
): Promise<string> {
  const { mockInput } = harness;
  const targetToken = `Non-HTTP Link Policy: ${targetLabel}`;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await openHelpSettingsSection(harness, "▶ Security", "Help / Settings / Security");
    await focusHelpSettingsItem(harness, "▶ Non-HTTP Link Policy:");
    await harness.renderOnce();
    let frame = harness.captureCharFrame();
    if (frame.includes(targetToken)) {
      return frame;
    }
    await pressArrowAndRender(mockInput, harness, "right");
    frame = await waitForText(harness, "Non-HTTP Link Policy:");
    if (frame.includes(targetToken)) {
      return frame;
    }
  }
  throw new Error(`Unable to set Non-HTTP Link Policy to ${targetLabel}`);
}

type HelpSettingsInputEdit = {
  rowPrefix: string;
  inputTitle: string;
  value: string;
  expectedRowContains: string;
  clearChars?: number;
};

async function setHelpSettingsInputValue(
  harness: RenderHarness,
  edit: HelpSettingsInputEdit
): Promise<string> {
  const { mockInput } = harness;
  await focusHelpSettingsItem(harness, edit.rowPrefix);
  let opened = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await pressArrowAndRender(mockInput, harness, "right");
    try {
      await waitForText(harness, edit.inputTitle, 900);
      opened = true;
      break;
    } catch {
      await focusHelpSettingsItem(harness, edit.rowPrefix);
      await pressEnterAndRender(mockInput, harness);
      try {
        await waitForText(harness, edit.inputTitle, 900);
        opened = true;
        break;
      } catch {
        await focusHelpSettingsItem(harness, edit.rowPrefix);
      }
    }
  }
  if (!opened) throw new Error(`Unable to open settings input: ${edit.inputTitle}`);
  try {
    await waitForText(harness, edit.inputTitle);
  } catch (error) {
    throw new Error(
      `Opened input not stable for ${edit.inputTitle}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
  const clearChars = edit.clearChars ?? Math.max(32, edit.value.length + 16);
  await pressBackspaceAndRender(mockInput, harness, clearChars);
  await typeTextAndRender(mockInput, harness, edit.value);
  try {
    await waitForFrame(
      harness,
      (frame) => frame.includes(edit.inputTitle) && frame.includes(edit.value),
      1200
    );
  } catch (error) {
    throw new Error(
      `Typed value did not settle for ${edit.inputTitle}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
  await pressEnterAndRender(mockInput, harness);
  try {
    return await waitForText(harness, edit.expectedRowContains, 6000);
  } catch (error) {
    throw new Error(
      `Submit did not persist ${edit.inputTitle}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

async function openCustom1Editor(harness: RenderHarness) {
  const { mockInput } = harness;
  await openHelpSettingsSection(harness, "▶ Appearance", "Help / Settings / Appearance");
  await pressEnterAndRender(mockInput, harness);
  await waitForText(harness, "Theme mode: Default");
  await pressArrowAndRender(mockInput, harness, "down", 1);
  await pressEnterAndRender(mockInput, harness);
  await waitForText(harness, "Edit Colors");
  await pressEnterAndRender(mockInput, harness);
  await waitForText(harness, "Custom1 Theme Editor");
}

async function openTextTuningEditor(harness: RenderHarness) {
  const { mockInput } = harness;
  await openHelpSettingsSection(harness, "▶ Appearance", "Help / Settings / Appearance");
  await pressEnterAndRender(mockInput, harness);
  await waitForText(harness, "Theme mode: Default");
  await pressArrowAndRender(mockInput, harness, "down", 2);
  await pressEnterAndRender(mockInput, harness);
  await waitForText(harness, "Per-theme + per-object text color overrides.");
  await pressEnterAndRender(mockInput, harness);
  await waitForText(harness, "Edit Text Colors");
  await pressEnterAndRender(mockInput, harness);
  await waitForText(harness, "Built-in Text Editor");
}

async function dirtyThemeEditor(harness: RenderHarness) {
  const { mockInput } = harness;
  await pressTabAndRender(mockInput, harness);
  await pressTabAndRender(mockInput, harness);
  await pressArrowAndRender(mockInput, harness, "right");
}

async function openBackupCenterMenu(harness: RenderHarness) {
  const { mockInput } = harness;
  await pressKeyAndRender(mockInput, harness, "u");
  await waitForText(harness, "1) Export backup (recommended)");
}

async function openCalendarMenu(harness: RenderHarness) {
  const { mockInput } = harness;
  await openBackupCenterMenu(harness);
  await pressKeyAndRender(mockInput, harness, "4");
  await waitForText(harness, "CALENDAR (ICS): Export / Import");
}

async function openDataImportDryRun(
  harness: RenderHarness,
  expectedBackupFilename: string
) {
  const { mockInput } = harness;
  await openBackupCenterMenu(harness);
  await pressKeyAndRender(mockInput, harness, "2");
  await waitForText(harness, expectedBackupFilename);
  await pressEnterAndRender(mockInput, harness);
  await waitForText(harness, "Select import mode");
  await pressEnterAndRender(mockInput, harness);
  await waitForText(harness, "Dry-run summary");
}

async function runCalendarExportGuidedFlow(
  harness: RenderHarness,
  outputPath: string
): Promise<string> {
  const { mockInput } = harness;
  await openCalendarMenu(harness);
  await pressKeyAndRender(mockInput, harness, "1");
  await waitForText(harness, "Export Calendar (.ics)");

  await pressEnterAndRender(mockInput, harness);
  await waitForText(harness, "Choose range");
  await pressEnterAndRender(mockInput, harness);
  await waitForText(harness, "Choose saved view (optional)");
  await pressEnterAndRender(mockInput, harness);
  await waitForText(harness, "Choose privacy level");
  await pressEnterAndRender(mockInput, harness);
  await waitForText(harness, "Output path (.ics):");

  await typeTextAndRender(mockInput, harness, outputPath);
  await pressEnterAndRender(mockInput, harness);
  await waitForText(harness, "Confirm calendar export");

  await pressEnterAndRender(mockInput, harness);
  await waitForAnyText(harness, ["Exporting calendar ICS...", "Calendar export complete"], 8000);
  return waitForText(harness, "Calendar export complete", 8000);
}

async function runCalendarImportGuidedFlowToDryRun(
  harness: RenderHarness,
  inputPath: string,
  options: {
    rangeDigit?: "1" | "2" | "3";
    modeDigit?: "1" | "2" | "3";
    importTag?: string;
  } = {}
): Promise<string> {
  const { mockInput } = harness;
  const rangeDigit = options.rangeDigit ?? "1";
  const modeDigit = options.modeDigit ?? "1";
  const rangeLabelByDigit: Record<"1" | "2" | "3", string> = {
    "1": "next7",
    "2": "month",
    "3": "all"
  };
  const modeLabelByDigit: Record<"1" | "2" | "3", string> = {
    "1": "merge",
    "2": "update",
    "3": "create"
  };
  const waitStep = async (step: string, text: string) => {
    try {
      return await waitForText(harness, text);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`[calendar-import-step:${step}] ${message}`);
    }
  };

  await openCalendarMenu(harness);
  await pressKeyAndRender(mockInput, harness, "2");
  await waitStep("intro", "Import Calendar (.ics)");

  await pressEnterAndRender(mockInput, harness);
  await waitStep("path-input", "Input ICS file path:");
  await pasteTextAndRender(mockInput, harness, inputPath);
  await waitStep("path-value", path.basename(inputPath));
  await Bun.sleep(40);
  await harness.renderOnce();
  await pressEnterAndRender(mockInput, harness);

  await waitStep("range", "Choose range");
  if (rangeDigit !== "1") {
    await pressKeyAndRender(mockInput, harness, rangeDigit);
    await waitStep("range-selected", `${rangeDigit}) ${rangeLabelByDigit[rangeDigit]} (selected)`);
  }
  await pressEnterAndRender(mockInput, harness);

  await waitStep("view", "Choose saved view (optional)");
  await pressEnterAndRender(mockInput, harness);

  await waitStep("mode", "Choose import mode");
  if (modeDigit !== "1") {
    await pressKeyAndRender(mockInput, harness, modeDigit);
    await waitStep("mode-selected", `${modeDigit}) ${modeLabelByDigit[modeDigit]} (selected)`);
  }
  await pressEnterAndRender(mockInput, harness);

  await waitStep("horizon", "Horizon days (default 365, max 3650):");
  await pressEnterAndRender(mockInput, harness);

  await waitStep("tag", "Optional tag for newly created tasks");
  if (options.importTag) {
    await typeTextAndRender(mockInput, harness, options.importTag);
  }
  await pressEnterAndRender(mockInput, harness);

  await waitForAnyText(harness, ["Running dry-run import...", "Dry-run summary (required)"], 8000);
  return waitForText(harness, "Dry-run summary (required)", 8000);
}

describe("App modal flow integration", () => {
  let originalConsoleError: typeof console.error;

  beforeAll(() => {
    originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      const first = typeof args[0] === "string" ? args[0] : "";
      if (
        first.includes("not wrapped in act(") ||
        first.includes("not configured to support act(")
      ) {
        return;
      }
      originalConsoleError(...args);
    };
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  it("task editor dirty Esc opens unsaved modal and cancel/discard routes correctly", async () => {
    const session = await createSession();
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await pressKeyAndRender(mockInput, harness, "a");
      await typeTextAndRender(mockInput, harness, "Draft modal guard task");
      await pressTabAndRender(mockInput, harness);
      await pressEscapeAndRender(mockInput, harness);

      let frame = await waitForText(harness, "UNSAVED CHANGES");
      expect(frame).toContain("Task editor changes are unsaved.");
      expect(frame).toContain("Continue action:");

      await pressKeyAndRender(mockInput, harness, "c");
      frame = await waitForFrame(
        harness,
        (next) => !next.includes("Task editor changes are unsaved.")
      );
      expect(frame).not.toContain("UNSAVED CHANGES");

      await pressEscapeAndRender(mockInput, harness);
      frame = await waitForText(harness, "Task editor changes are unsaved.");
      expect(frame).toContain("UNSAVED CHANGES");

      await pressKeyAndRender(mockInput, harness, "d");
      frame = await waitForFrame(
        harness,
        (next) => !next.includes("Task editor changes are unsaved.")
      );
      expect(frame).toContain("Existing task");
      expect(frame).not.toContain("UNSAVED CHANGES");
    } finally {
      await cleanupSession(session);
    }
  });

  it("help custom1 editor dirty Esc opens unsaved modal and discard returns to custom1 page", async () => {
    const session = await createSession();
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await openCustom1Editor(harness);
      await dirtyThemeEditor(harness);
      await pressEscapeAndRender(mockInput, harness);

      let frame = await waitForText(harness, "Custom1 theme changes are unsaved.");
      expect(frame).toContain("UNSAVED CHANGES");
      expect(frame).toContain("Continue action: leave theme editor.");

      await pressKeyAndRender(mockInput, harness, "d");
      frame = await waitForText(harness, "Edit Colors");
      expect(frame).not.toContain("UNSAVED CHANGES");
      expect(frame).not.toContain("Custom1 theme changes are unsaved.");
    } finally {
      await cleanupSession(session);
    }
  });

  it("help text tuning editor dirty close-help path opens unsaved modal and discard closes help", async () => {
    const session = await createSession();
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await openTextTuningEditor(harness);
      await dirtyThemeEditor(harness);
      await pressKeyAndRender(mockInput, harness, "?");

      let frame = await waitForText(harness, "Built-in text tuning changes are unsaved.");
      expect(frame).toContain("UNSAVED CHANGES");
      expect(frame).toContain("Continue action: close help.");

      await pressKeyAndRender(mockInput, harness, "d");
      frame = await waitForFrame(
        harness,
        (next) =>
          !next.includes("Built-in text tuning changes are unsaved.") &&
          next.includes("Existing task")
      );
      expect(frame).not.toContain("UNSAVED CHANGES");
    } finally {
      await cleanupSession(session);
    }
  });

  it("moves help settings selection with ArrowDown", async () => {
    const session = await createSession();
    const { harness } = session;

    try {
      await openHelpSettingsPage(harness);
      const frame = await focusHelpSettingsItem(harness, "▶ Cloud Backup");
      expect(frame).toContain("TOME Notes");
    } finally {
      await cleanupSession(session);
    }
  });

  it("renders Settings IA in the expected logical section order", async () => {
    const session = await createSession();
    const { harness } = session;

    try {
      await openHelpSettingsPage(harness);
      const frame = await waitForHelpSettingsRoot(harness);
      expectFrameTextOrder(frame, [
        "Appearance",
        "Navigation & Keymaps",
        "Notifications",
        "Security",
        "TOME Notes",
        "Cloud Backup"
      ]);
    } finally {
      await cleanupSession(session);
    }
  });

  it("keeps keyboard section-open/back behavior consistent in Settings", async () => {
    const session = await createSession();
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await openHelpSettingsSection(
        harness,
        "▶ Notifications",
        "Help / Settings / Notifications"
      );
      await pressEscapeAndRender(mockInput, harness);
      await waitForHelpSettingsRoot(harness);
    } finally {
      await cleanupSession(session);
    }
  });

  it("keymap aliases settings page toggles list preset and reset applies immediately", async () => {
    const session = await createSession();
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await openHelpSettingsPage(harness);
      await focusHelpSettingsItem(harness, "▶ Navigation & Keymaps");
      await pressEnterAndRender(mockInput, harness);
      await waitForText(harness, "Help / Settings / Navigation & Keymaps");
      await focusHelpSettingsItem(harness, "▶ Keymap Aliases");
      await pressEnterAndRender(mockInput, harness);
      let frame = await waitForText(harness, "Help / Settings / Keymap Aliases");
      expect(frame).toContain("List aliases: off");

      await pressEnterAndRender(mockInput, harness);
      frame = await waitForText(harness, "List aliases: on");

      await pressKeyAndRender(mockInput, harness, "?");
      await waitForText(harness, "Existing task");

      await pressCtrlKeyAndRender(mockInput, harness, "f");
      frame = await waitForText(harness, "UNIFIED SEARCH");
      expect(frame).toContain("FOCUS: SEARCH");
      await pressEscapeAndRender(mockInput, harness);
      await waitForText(harness, "FOCUS: LIST");

      await openHelpSettingsPage(harness);
      await focusHelpSettingsItem(harness, "▶ Navigation & Keymaps");
      await pressEnterAndRender(mockInput, harness);
      await waitForText(harness, "Help / Settings / Navigation & Keymaps");
      await focusHelpSettingsItem(harness, "▶ Keymap Aliases");
      await pressEnterAndRender(mockInput, harness);
      await waitForText(harness, "Help / Settings / Keymap Aliases");
      await pressArrowAndRender(mockInput, harness, "down", 4);
      await waitForText(harness, "▶ Reset all aliases");
      await pressEnterAndRender(mockInput, harness);
      frame = await waitForText(harness, "List aliases: off");
      expect(frame).toContain("Reset all aliases");

      await pressKeyAndRender(mockInput, harness, "?");
      await waitForText(harness, "Existing task");

      await pressCtrlKeyAndRender(mockInput, harness, "f");
      frame = harness.captureCharFrame();
      expect(frame).toContain("FOCUS: LIST");
      expect(frame).not.toContain("UNIFIED SEARCH");
    } finally {
      await cleanupSession(session);
    }
  });

  it("exposes strict-parity settings controls for notifications, security, notes, and cloud config", async () => {
    const session = await createSession();
    const { harness, settingsPath } = session;
    const { mockInput } = harness;

    try {
      await openHelpSettingsSection(
        harness,
        "▶ Notifications",
        "Help / Settings / Notifications"
      );
      await focusHelpSettingsItem(harness, "▶ Banner Duration:");
      await pressArrowAndRender(mockInput, harness, "right");
      await waitForText(harness, "Notification Banner Duration (ms)");
      await pressEscapeAndRender(mockInput, harness);
      let frame = await waitForText(harness, "Banner Duration:");
      expect(frame).toContain("Bell Cooldown");

      await pressEscapeAndRender(mockInput, harness);
      await waitForHelpSettingsRoot(harness);

      frame = await setSecurityNonHttpPolicy(harness, "Block");
      expect(frame).toContain("Choose prompt vs block behavior");

      await pressEscapeAndRender(mockInput, harness);
      await waitForHelpSettingsRoot(harness);

      await openHelpSettingsSection(harness, "▶ TOME Notes", "Help / Settings / TOME Notes");
      await focusHelpSettingsItem(harness, "▶ TOME Enabled:");
      await pressArrowAndRender(mockInput, harness, "right");
      await waitForText(harness, "TOME Enabled: off");
      await pressArrowAndRender(mockInput, harness, "right");
      await waitForText(harness, "TOME Enabled: on");

      await pressEscapeAndRender(mockInput, harness);
      await waitForHelpSettingsRoot(harness);

      await openHelpSettingsSection(harness, "▶ Cloud Backup", "Help / Settings / Cloud Backup");
      await focusHelpSettingsItem(harness, "▶ Owner/Repo:");
      await pressArrowAndRender(mockInput, harness, "right");
      await waitForText(harness, "Cloud Owner/Repo");
      await pressEscapeAndRender(mockInput, harness);
      await waitForText(harness, "Owner/Repo:");

      await focusHelpSettingsItem(harness, "▶ Branch:");
      await pressArrowAndRender(mockInput, harness, "right");
      await waitForText(harness, "Cloud Branch");
      await pressEscapeAndRender(mockInput, harness);
      await waitForText(harness, "Branch:");

      await focusHelpSettingsItem(harness, "▶ Auto Push Policy:");
      await pressArrowAndRender(mockInput, harness, "right");
      await waitForText(harness, "Auto Push Policy: On exit");

      await pressKeyAndRender(mockInput, harness, "?");
      await waitForText(harness, "Existing task");

      await waitForFile(settingsPath);
      await Bun.sleep(220);
      const settingsRaw = await fs.readFile(settingsPath, "utf8");
      const settings = JSON.parse(settingsRaw) as {
        notifications?: { bannerDurationMs?: number };
        security?: { nonHttpLinkPolicy?: string };
        notes?: { enabled?: boolean };
        githubBackup?: {
          ownerRepo?: string | null;
          branch?: string;
          autoPushPolicy?: string;
        };
      };

      expect(settings.notifications?.bannerDurationMs).toBe(5000);
      expect(settings.security?.nonHttpLinkPolicy).toBe("block");
      expect(settings.notes?.enabled).toBe(true);
      expect(settings.githubBackup?.ownerRepo ?? null).toBeNull();
      expect(settings.githubBackup?.branch).toBe("main");
      expect(settings.githubBackup?.autoPushPolicy).toBe("onExit");
    } finally {
      await cleanupSession(session);
    }
  });

  it("opens Backup Center cloud status from Settings cloud deep-link row", async () => {
    const session = await createSession();
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await openHelpSettingsSection(harness, "▶ Cloud Backup", "Help / Settings / Cloud Backup");
      await focusHelpSettingsItem(harness, "▶ Open Cloud Operations");
      await pressEnterAndRender(mockInput, harness);
      const frame = await waitForText(harness, "GitHub (CLI) Cloud Backups");
      expect(frame).toContain("CLOUD / GITHUB");
      expect(frame).toContain("snapshot encryption: off");
    } finally {
      await cleanupSession(session);
    }
  });

  it(
    "runs encrypted GitHub push + restore flows end-to-end in Backup Center",
    async () => {
      const ownerRepo = "patrick/tadoi-backups";
      const branch = "main";
      const deviceId = "dev_test";
      const pathPrefix = `tadoi/devices/${deviceId}`;
      const passphrase = "modal-flow-encryption-passphrase";
      const session = await createSession({
        initialGithubBackup: {
          enabled: true,
          ownerRepo,
          branch,
          deviceId,
          pathPrefix,
          autoPushPolicy: "off"
        }
      });
      const { harness, tempDir } = session;
      const { mockInput } = harness;
      const fixture = await prepareBackupRuntimeFixture(session);
      const fakeGh = await createFakeGitHubCliFixture({
        rootDir: tempDir,
        ownerRepo,
        branch,
        pathPrefix,
        passphrase
      });

      const originalPath = process.env.PATH;
      const originalPassphrase = process.env[ENV_VARS.GITHUB_SNAPSHOT_PASSPHRASE];
      const originalGhLogPath = process.env.TADOI_TEST_GH_LOG_PATH;
      process.env.PATH = `${fakeGh.binDir}:${originalPath ?? ""}`;
      process.env[ENV_VARS.GITHUB_SNAPSHOT_PASSPHRASE] = passphrase;
      process.env.TADOI_TEST_GH_LOG_PATH = fakeGh.logPath;

      try {
        await withDataPathAndCwd(fixture.dataPath, fixture.backupDir, async () => {
          await openCalendarMenu(harness);
          await pressKeyAndRender(mockInput, harness, "3");
          let frame = await waitForText(
            harness,
            "snapshot encryption: on (passphrase set)",
            10_000
          );
          expect(frame).toContain("GitHub (CLI) Cloud Backups");

          await pressKeyAndRender(mockInput, harness, "2");
          await waitForAnyText(
            harness,
            ["Pushing snapshot to GitHub...", "GitHub snapshot pushed"],
            10000
          );
          frame = await waitForText(harness, "GitHub snapshot pushed", 10000);
          expect(frame).toContain("Last push:");

          await pressEnterAndRender(mockInput, harness);
          await waitForText(harness, "GitHub (CLI) Cloud Backups");
          await pressKeyAndRender(mockInput, harness, "3");
          await waitForAnyText(
            harness,
            ["Loading remote snapshots...", "Select snapshot to restore"],
            10000
          );
          frame = await waitForAnyText(
            harness,
            ["Select snapshot to restore", "Restore from GitHub"],
            10_000
          );
          expect(frame).toContain("20260227-123000Z");

          await pressEnterAndRender(mockInput, harness);
          await waitForAnyText(
            harness,
            ["Downloading selected snapshot...", "Dry-run summary"],
            10000
          );
          frame = await waitForText(harness, "Dry-run summary", 10000);
          expect(frame).toContain("Mode: MERGE");
        });

        const ghLog = await fs.readFile(fakeGh.logPath, "utf8");
        expect(ghLog).toContain("BLOB_HAS_ENCRYPTION yes");
        expect(ghLog).toContain(`API GET repos/${ownerRepo}/git/trees/${branch}?recursive=1`);
        expect(ghLog).toContain(`API GET repos/${ownerRepo}/contents/${pathPrefix}/snapshots/`);
      } finally {
        if (originalPath === undefined) {
          delete process.env.PATH;
        } else {
          process.env.PATH = originalPath;
        }
        if (originalPassphrase === undefined) {
          delete process.env[ENV_VARS.GITHUB_SNAPSHOT_PASSPHRASE];
        } else {
          process.env[ENV_VARS.GITHUB_SNAPSHOT_PASSPHRASE] = originalPassphrase;
        }
        if (originalGhLogPath === undefined) {
          delete process.env.TADOI_TEST_GH_LOG_PATH;
        } else {
          process.env.TADOI_TEST_GH_LOG_PATH = originalGhLogPath;
        }
        await cleanupSession(session);
      }
    },
    25_000
  );

  it(
    "persists settingsInput values for notification and cloud text fields",
    async () => {
    const session = await createSession();
    const { harness, settingsPath } = session;
    const { mockInput } = harness;

    try {
      await openHelpSettingsSection(
        harness,
        "▶ Notifications",
        "Help / Settings / Notifications"
      );
      await setHelpSettingsInputValue(harness, {
        rowPrefix: "▶ Banner Duration:",
        inputTitle: "Notification Banner Duration (ms)",
        value: "8675309",
        expectedRowContains: "Banner Duration: 50008675309 ms",
        clearChars: 0
      });
      await setHelpSettingsInputValue(harness, {
        rowPrefix: "▶ Bell Cooldown:",
        inputTitle: "Terminal Bell Cooldown (ms)",
        value: "24681357",
        expectedRowContains: "Bell Cooldown: 200024681357 ms",
        clearChars: 0
      });

      await pressEscapeAndRender(mockInput, harness);
      await waitForHelpSettingsRoot(harness);

      await openHelpSettingsSection(harness, "▶ Cloud Backup", "Help / Settings / Cloud Backup");
      await setHelpSettingsInputValue(harness, {
        rowPrefix: "▶ Owner/Repo:",
        inputTitle: "Cloud Owner/Repo",
        value: "org/repo",
        expectedRowContains: "Owner/Repo: org/repo",
        clearChars: 0
      });
      await setHelpSettingsInputValue(harness, {
        rowPrefix: "▶ Branch:",
        inputTitle: "Cloud Branch",
        value: "-sync",
        expectedRowContains: "Branch: main-sync",
        clearChars: 0
      });
      await harness.renderOnce();
      const cloudFrame = harness.captureCharFrame();
      const currentDeviceId = extractHelpSettingsRowValue(cloudFrame, "Device ID");
      const currentPathPrefix = extractHelpSettingsRowValue(cloudFrame, "Path Prefix");
      const nextDeviceId = `${currentDeviceId}-qa1`;
      const nextPathPrefix = `${currentPathPrefix}/qa1`;
      await setHelpSettingsInputValue(harness, {
        rowPrefix: "▶ Device ID:",
        inputTitle: "Cloud Device ID",
        value: "-qa1",
        expectedRowContains: `Device ID: ${nextDeviceId}`,
        clearChars: 0
      });
      await setHelpSettingsInputValue(harness, {
        rowPrefix: "▶ Path Prefix:",
        inputTitle: "Cloud Path Prefix",
        value: "/qa1",
        expectedRowContains: `Path Prefix: ${nextPathPrefix}`,
        clearChars: 0
      });

      await pressKeyAndRender(mockInput, harness, "?");
      await waitForText(harness, "Existing task");

      await waitForFile(settingsPath);
      await Bun.sleep(260);
      const settingsRaw = await fs.readFile(settingsPath, "utf8");
      const settings = JSON.parse(settingsRaw) as {
        notifications?: {
          bannerDurationMs?: number;
          bellCooldownMs?: number;
        };
        githubBackup?: {
          ownerRepo?: string | null;
          branch?: string;
          deviceId?: string;
          pathPrefix?: string;
        };
      };

      expect(settings.notifications?.bannerDurationMs).toBe(50008675309);
      expect(settings.notifications?.bellCooldownMs).toBe(200024681357);
      expect(settings.githubBackup?.ownerRepo).toBe("org/repo");
      expect(settings.githubBackup?.branch).toBe("main-sync");
      expect(settings.githubBackup?.deviceId).toBe(nextDeviceId);
      expect(settings.githubBackup?.pathPrefix).toBe(nextPathPrefix);
    } finally {
      await cleanupSession(session);
    }
    },
    20_000
  );

  it("backup final checkpoint modal cancel returns to import dry-run screen", async () => {
    const session = await createSession();
    const { harness } = session;
    const fixture = await prepareBackupRuntimeFixture(session);

    try {
      await withDataPath(fixture.dataPath, async () => {
        await openDataImportDryRun(harness, fixture.backupFilename);
        await pressEnterAndRender(harness.mockInput, harness);

        let frame = await waitForText(harness, "FINAL IMPORT CHECKPOINT");
        expect(frame).toContain("Commit backup data import now?");

        await pressKeyAndRender(harness.mockInput, harness, "n");
        frame = await waitForText(harness, "Dry-run summary");
        expect(frame).not.toContain("FINAL IMPORT CHECKPOINT");
      });
    } finally {
      await cleanupSession(session);
    }
  });

  it("backup final checkpoint confirm starts commit flow", async () => {
    const session = await createSession();
    const { harness } = session;
    const fixture = await prepareBackupRuntimeFixture(session);

    try {
      await withDataPath(fixture.dataPath, async () => {
        await openDataImportDryRun(harness, fixture.backupFilename);
        await pressEnterAndRender(harness.mockInput, harness);
        await waitForText(harness, "FINAL IMPORT CHECKPOINT");

        await pressKeyAndRender(harness.mockInput, harness, "y");
        const frame = await waitForAnyText(harness, ["Applying import...", "Import complete"]);
        expect(frame).not.toContain("FINAL IMPORT CHECKPOINT");
      });
    } finally {
      await cleanupSession(session);
    }
  });

  it("calendar export guided flow completes and lands on done screen", async () => {
    const session = await createSession();
    const { harness } = session;
    const fixture = await prepareBackupRuntimeFixture(session);

    try {
      await withDataPath(fixture.dataPath, async () => {
        const frame = await runCalendarExportGuidedFlow(harness, fixture.calendarExportPath);
        expect(frame).toContain("Calendar export complete");
        expect(frame).toContain(path.basename(fixture.calendarExportPath));
      });
    } finally {
      await cleanupSession(session);
    }
  });

  it("calendar import guided flow dry-run reaches calendar import dry-run summary", async () => {
    const session = await createSession();
    const { harness } = session;
    const fixture = await prepareBackupRuntimeFixture(session);

    try {
      await withDataPathAndCwd(fixture.dataPath, fixture.backupDir, async () => {
        const frame = await runCalendarImportGuidedFlowToDryRun(harness, "incoming.ics");
        expect(frame).toContain("Dry-run summary (required)");
        expect(frame).toContain("Events parsed");
      });
    } finally {
      await cleanupSession(session);
    }
  });

  it("renders context-aware which-key hints in list, search, and modal states", async () => {
    const session = await createSession();
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await openHelpSettingsPage(harness);
      await selectNavigationHintsMode(harness, "Bottom only");
      await pressKeyAndRender(mockInput, harness, "?");
      let frame = await waitForText(harness, "Existing task");
      expect(frame).toContain("KEYS");
      expect(frame).toContain("a: add");

      await pressKeyAndRender(mockInput, harness, "/");
      frame = await waitForText(harness, "SEARCH");
      expect(frame).toContain("KEYS");
      expect(frame).toContain("type: query");

      await pressEscapeAndRender(mockInput, harness);
      await waitForText(harness, "Existing task");

      await pressKeyAndRender(mockInput, harness, "d");
      frame = await waitForText(harness, "DELETE SELECTED TASK? [Y/N/ESC]");
      expect(frame).toContain("KEYS");
      expect(frame).toContain("y: confirm");
      expect(frame).toContain("n: cancel");
    } finally {
      await cleanupSession(session);
    }
  });

  it("checklist input modal mirrors typed text and saves on Enter", async () => {
    const session = await createSession();
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await pressKeyAndRender(mockInput, harness, "e");
      await waitForText(harness, "MODE:  EDIT");

      let checklistFocused = false;
      for (let index = 0; index < 16; index += 1) {
        await harness.renderOnce();
        const focusFrame = harness.captureCharFrame();
        if (focusFrame.includes("MODE:  EDIT") && focusFrame.includes("FOCUS: CHECKLIST")) {
          checklistFocused = true;
          break;
        }
        await pressTabAndRender(mockInput, harness);
      }
      expect(checklistFocused).toBe(true);

      await pressKeyAndRender(mockInput, harness, "a");
      await waitForText(harness, "ADD CHECKLIST ITEM");

      await typeTextAndRender(mockInput, harness, "Readable checklist item");
      let frame = harness.captureCharFrame();
      expect(frame).toContain("Readable checklist item");

      await pressEnterAndRender(mockInput, harness);
      await expectTextAbsentForDuration(harness, "ADD CHECKLIST ITEM");
      await harness.renderOnce();
      frame = harness.captureCharFrame();
      expect(frame).toContain("MODE:  EDIT");
    } finally {
      await cleanupSession(session);
    }
  });

  it("quick-routes list Right Arrow into checklist edit and Left saves back to list", async () => {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const checklistTask: Task = {
      ...makeTask("task-checklist-nav", "Checklist nav task", nowMs),
      checklist: [
        {
          id: "item-1",
          text: "First item",
          isDone: true,
          createdAt: nowIso,
          updatedAt: nowIso,
          completedAt: nowIso,
          sort: 0
        },
        {
          id: "item-2",
          text: "Second item",
          isDone: false,
          createdAt: nowIso,
          updatedAt: nowIso,
          sort: 1
        }
      ]
    };
    const session = await createSession({ initialData: makeInitialData([checklistTask]) });
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await waitForText(harness, "CL 1/2");
      await pressArrowAndRender(mockInput, harness, "right");

      let frame = await waitForText(harness, "MODE:  EDIT");
      expect(frame).toContain("FOCUS: CHECKLIST");
      expect(frame).toContain("CL 1/2");

      await pressArrowAndRender(mockInput, harness, "left");
      frame = await waitForText(harness, "MODE:  LIST");
      expect(frame).toContain("FOCUS: LIST");
      expect(frame).toContain("CL 1/2");
    } finally {
      await cleanupSession(session);
    }
  });

  it(
    "reminder modal key path applies snooze actions for 1/2/3 and exits for Enter/Esc",
    async () => {
      const cases: Array<{
        label: string;
        key: "1" | "2" | "3" | "enter" | "escape";
        expectedSnoozeMs?: number;
      }> = [
        { label: "snooze +10m", key: "1", expectedSnoozeMs: 10 * 60_000 },
        { label: "snooze +1h", key: "2", expectedSnoozeMs: 60 * 60_000 },
        { label: "snooze +1d", key: "3", expectedSnoozeMs: 24 * 60 * 60_000 },
        { label: "dismiss enter", key: "enter" },
        { label: "dismiss esc", key: "escape" }
      ];

      for (const testCase of cases) {
        const nowMs = Date.now();
        const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-app-reminder-modal-"));
        const dataPath = path.join(dataDir, "tadoi_data.json");
        const taskId = `task-reminder-${testCase.key}`;
        const task = makeReminderDueTask(taskId, `Reminder ${testCase.label}`, nowMs);
        let session: AppSession | undefined;

        try {
          await withDataPath(dataPath, async () => {
            session = await createSession({
              initialData: makeInitialData([task]),
              skipInitialSave: false
            });
            const { harness } = session;
            const { mockInput } = harness;

            let frame = await waitForText(harness, "REMINDER [ENTER/ESC/1/2/3/G]", 8000);
            expect(frame).toContain("SNOOZE +10M [1]");
            expect(frame).toContain("SNOOZE +1H [2]");
            expect(frame).toContain("SNOOZE +1D [3]");

            if (testCase.key === "enter") {
              await pressEnterAndRender(mockInput, harness);
            } else if (testCase.key === "escape") {
              await pressEscapeAndRender(mockInput, harness);
            } else {
              await pressKeyAndRender(mockInput, harness, testCase.key);
            }

            frame = await waitForFrame(
              harness,
              (next) => next.includes("MODE:  LIST") && !next.includes("REMINDER [ENTER/ESC/1/2/3/G]"),
              8000
            );
            expect(frame).toContain("MODE:  LIST");

            await waitForFile(dataPath, 4000);
            await Bun.sleep(320);
            const savedRaw = await fs.readFile(dataPath, "utf8");
            const saved = JSON.parse(savedRaw) as { tasks?: Array<{ id: string; reminder?: any }> };
            const savedTask = saved.tasks?.find((candidate) => candidate.id === taskId);
            expect(savedTask).toBeDefined();
            expect(savedTask?.reminder?.kind).toBe("absolute");

            if (typeof testCase.expectedSnoozeMs === "number") {
              const snoozedUntilAt = Number(savedTask?.reminder?.snoozedUntilAt);
              expect(Number.isFinite(snoozedUntilAt)).toBe(true);
              expect(snoozedUntilAt).toBeGreaterThanOrEqual(nowMs + testCase.expectedSnoozeMs - 2 * 60_000);
            } else {
              expect(savedTask?.reminder?.snoozedUntilAt).toBeUndefined();
            }
          });
        } finally {
          if (session) {
            await cleanupSession(session);
          }
          await fs.rm(dataDir, { recursive: true, force: true });
        }
      }
    },
    40_000
  );

  it("shows Ctrl+g prefix popup and clears it after non-prefix continuation without side effects", async () => {
    const session = await createSession();
    const { harness } = session;
    const { mockInput } = harness;

    try {
      let frame = await waitForText(harness, "Existing task");
      expect(frame).toContain("DUE (G):");

      await pressCtrlKeyAndRender(mockInput, harness, "g");
      frame = await waitForText(harness, "PREFIX: Ctrl+g / Ctrl+p / Ctrl+y");
      expect(frame).toContain("jump top");
      expect(frame).toContain("jump bottom");

      await pressKeyAndRender(mockInput, harness, "j");
      frame = await waitForText(harness, "Existing task");
      expect(frame).not.toContain("PREFIX: Ctrl+g / Ctrl+p / Ctrl+y");
      expect(frame).toMatch(/DUE \(G\):\s+ANY/);
    } finally {
      await cleanupSession(session);
    }
  });

  it("cycles due on g without opening the prefix popup", async () => {
    const session = await createSession();
    const { harness } = session;
    const { mockInput } = harness;

    try {
      let frame = await waitForText(harness, "Existing task");
      expect(frame).toMatch(/DUE \(G\):\s+ANY/);

      await pressKeyAndRender(mockInput, harness, "g");
      frame = await waitForFrame(harness, (next) => /DUE \(G\):\s+(?!ANY)/.test(next));
      expect(frame).not.toContain("PREFIX: Ctrl+g / Ctrl+p / Ctrl+y");
    } finally {
      await cleanupSession(session);
    }
  });

  it("keeps Ctrl+g prefix popup open while waiting and resolves after release delay", async () => {
    const session = await createSession();
    const { harness } = session;
    const { mockInput } = harness;

    try {
      let frame = await waitForText(harness, "Existing task");
      expect(frame).toMatch(/DUE \(G\):\s+ANY/);

      await pressCtrlKeyAndRender(mockInput, harness, "g");
      frame = await waitForText(harness, "PREFIX: Ctrl+g / Ctrl+p / Ctrl+y");
      expect(frame).toContain("jump top");

      await Bun.sleep(700);
      await harness.renderOnce();
      frame = harness.captureCharFrame();
      expect(frame).toContain("PREFIX: Ctrl+g / Ctrl+p / Ctrl+y");

      frame = await waitForFrame(
        harness,
        (next) => !next.includes("PREFIX: Ctrl+g / Ctrl+p / Ctrl+y"),
        2500
      );
      expect(frame).toMatch(/DUE \(G\):\s+ANY/);
    } finally {
      await cleanupSession(session);
    }
  });

  it("applies navigation hint surface modes (bottom, left rail, both, none)", async () => {
    const session = await createSession();
    const { harness } = session;
    const { mockInput } = harness;

    try {
      let frame = await waitForText(harness, "Existing task");
      expect(frame).toContain("KEYS");
      expect(frame).not.toContain("HINTS");

      await openHelpSettingsPage(harness);
      await selectNavigationHintsMode(harness, "Bottom only");
      await pressKeyAndRender(mockInput, harness, "?");
      frame = await waitForFrame(
        harness,
        (next) => next.includes("KEYS") && !next.includes("HINTS")
      );
      expect(frame).toContain("KEYS");
      expect(frame).not.toContain("HINTS");

      await openHelpSettingsPage(harness);
      await selectNavigationHintsMode(harness, "Both");
      await pressKeyAndRender(mockInput, harness, "?");
      frame = await waitForFrame(
        harness,
        (next) => next.includes("HINTS") && next.includes("KEYS")
      );
      expect(frame).toContain("HINTS");
      expect(frame).toContain("KEYS");

      await openHelpSettingsPage(harness);
      await selectNavigationHintsMode(harness, "None");
      await pressKeyAndRender(mockInput, harness, "?");
      frame = await waitForFrame(
        harness,
        (next) => !next.includes("HINTS") && !next.includes("KEYS")
      );
      expect(frame).not.toContain("HINTS");
      expect(frame).not.toContain("KEYS");
    } finally {
      await cleanupSession(session);
    }
  });

  it("keeps Help footer hint line on one row at 104x24, 120x30, and 150x44", async () => {
    const viewports = [
      { width: 104, height: 24 },
      { width: 120, height: 30 },
      { width: 150, height: 44 }
    ] as const;

    for (const viewport of viewports) {
      const session = await createSession({
        width: viewport.width,
        height: viewport.height
      });
      try {
        await pressKeyAndRender(session.harness.mockInput, session.harness, "?");
        const frame = await waitForText(session.harness, "Getting Started");
        const lines = frame.split("\n");
        const footerHintLineIndex = lines.findIndex((line) =>
          line.includes("Enter/Right on Settings opens Settings pages")
        );
        expect(footerHintLineIndex).toBeGreaterThanOrEqual(0);
        expect(frame).toContain("Data path:");
      } finally {
        await cleanupSession(session);
      }
    }
  });

  it("keeps prefix popup independent from hint display mode", async () => {
    const session = await createSession();
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await openHelpSettingsPage(harness);
      await selectNavigationHintsMode(harness, "None");
      await setPrefixPopupEnabled(harness, true);
      await pressKeyAndRender(mockInput, harness, "?");

      let frame = await waitForFrame(
        harness,
        (next) => !next.includes("HINTS") && !next.includes("KEYS")
      );
      expect(frame).not.toContain("HINTS");
      expect(frame).not.toContain("KEYS");

      await pressCtrlKeyAndRender(mockInput, harness, "g");
      frame = await waitForText(harness, "PREFIX: Ctrl+g / Ctrl+p / Ctrl+y");
      expect(frame).toContain("jump top");
      await pressKeyAndRender(mockInput, harness, "j");
      await waitForFrame(
        harness,
        (next) => !next.includes("PREFIX: Ctrl+g / Ctrl+p / Ctrl+y")
      );

      await openHelpSettingsPage(harness);
      await setPrefixPopupEnabled(harness, false);
      await pressKeyAndRender(mockInput, harness, "?");
      await waitForText(harness, "Existing task");

      await pressCtrlKeyAndRender(mockInput, harness, "g");
      await expectTextAbsentForDuration(
        harness,
        "PREFIX: Ctrl+g / Ctrl+p / Ctrl+y",
        220
      );
      await pressKeyAndRender(mockInput, harness, "j");
      frame = harness.captureCharFrame();
      expect(frame).not.toContain("PREFIX: Ctrl+g / Ctrl+p / Ctrl+y");
    } finally {
      await cleanupSession(session);
    }
  });

  it("supports Ctrl+p and Ctrl+y as fallback prefix triggers", async () => {
    const session = await createSession();
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await waitForText(harness, "Existing task");

      for (const fallbackKey of ["p", "y"]) {
        await pressCtrlKeyAndRender(mockInput, harness, fallbackKey);
        let frame = await waitForText(harness, "PREFIX: Ctrl+g / Ctrl+p / Ctrl+y");
        expect(frame).toContain("jump top");
        await pressKeyAndRender(mockInput, harness, "g");
        frame = await waitForText(harness, "Existing task");
        expect(frame).not.toContain("PREFIX: Ctrl+g / Ctrl+p / Ctrl+y");
      }
    } finally {
      await cleanupSession(session);
    }
  });

  it("backup center body scrolls with keyboard while footer stays pinned at 104x24", async () => {
    const session = await createSession({ width: 104, height: 24 });
    const { harness } = session;
    const fixture = await prepareBackupRuntimeFixture(session);

    try {
      await withDataPathAndCwd(fixture.dataPath, fixture.backupDir, async () => {
        await runCalendarImportGuidedFlowToDryRun(harness, "incoming.ics");

        let frame = await waitForText(harness, "Dry-run summary (required)");
        expect(frame).toContain("Events parsed");
        expect(frame).toContain("COMMIT IMPORT");
        expect(frame).toContain("BACK");

        await pressCtrlKeyAndRender(harness.mockInput, harness, "d");
        await pressCtrlKeyAndRender(harness.mockInput, harness, "d");
        await pressCtrlKeyAndRender(harness.mockInput, harness, "d");
        frame = harness.captureCharFrame();
        expect(frame).not.toContain("Events parsed");
        expect(frame).toContain("COMMIT IMPORT");

        await pressCtrlKeyAndRender(harness.mockInput, harness, "u");
        await pressCtrlKeyAndRender(harness.mockInput, harness, "u");
        await pressCtrlKeyAndRender(harness.mockInput, harness, "u");
        frame = harness.captureCharFrame();
        expect(frame).toContain("Events parsed");
        expect(frame).toContain("COMMIT IMPORT");
        expect(frame).toContain("BACK");
      });
    } finally {
      await cleanupSession(session);
    }
  });

  it("backup center body scrolls with mouse wheel at 110x26 while footer remains visible", async () => {
    const session = await createSession({ width: 110, height: 26 });
    const { harness } = session;
    const fixture = await prepareBackupRuntimeFixture(session);

    try {
      await withDataPathAndCwd(fixture.dataPath, fixture.backupDir, async () => {
        await runCalendarImportGuidedFlowToDryRun(harness, "incoming.ics");

        let frame = await waitForText(harness, "Dry-run summary (required)");
        expect(frame).toContain("Events parsed");
        expect(frame).toContain("COMMIT IMPORT");
        expect(frame).toContain("BACK");

        await scrollMouseAndRender(harness, {
          x: 26,
          y: 12,
          direction: "down",
          times: 4
        });
        frame = harness.captureCharFrame();
        expect(frame).not.toContain("Events parsed");
        expect(frame).toContain("COMMIT IMPORT");

        await scrollMouseAndRender(harness, {
          x: 26,
          y: 12,
          direction: "up",
          times: 4
        });
        frame = harness.captureCharFrame();
        expect(frame).toContain("Events parsed");
        expect(frame).toContain("COMMIT IMPORT");
        expect(frame).toContain("BACK");
      });
    } finally {
      await cleanupSession(session);
    }
  });

  it("task list wheel scroll moves selection in-frame and clamps at bounds", async () => {
    const wheelTasks = [
      makeTask("wheelA01-task", "Wheel Task Alpha"),
      makeTask("wheelB02-task", "Wheel Task Beta"),
      makeTask("wheelC03-task", "Wheel Task Gamma")
    ];
    const session = await createSession({
      initialData: makeInitialData(wheelTasks),
      initialNotificationSettings: {
        enabled: false,
        inAppOverdueBanner: false,
        terminalBellOnOverdue: false,
        bannerDurationMs: 4000,
        bellCooldownMs: 300000
      }
    });
    const { harness } = session;
    const taskPrefixes = wheelTasks.map((task) => task.id.slice(0, 8));
    const taskListWheelTarget = { x: 48, y: 14 } as const;

    const readSelectedTaskPrefix = async (): Promise<string> => {
      await pressKeyAndRender(harness.mockInput, harness, "d");
      const frame = await waitForText(harness, "DELETE SELECTED TASK? [Y/N/ESC]");
      const selectedPrefix = taskPrefixes.find((prefix) => frame.includes(`ID: ${prefix}`));
      expect(selectedPrefix).toBeTruthy();
      await pressKeyAndRender(harness.mockInput, harness, "n");
      await waitForFrame(
        harness,
        (next) => !next.includes("DELETE SELECTED TASK? [Y/N/ESC]")
      );
      return selectedPrefix as string;
    };

    try {
      await waitForText(harness, "Wheel Task Alpha");

      await scrollMouseAndRender(harness, {
        x: taskListWheelTarget.x,
        y: taskListWheelTarget.y,
        direction: "up",
        times: 20
      });
      const topSelection = await readSelectedTaskPrefix();

      await scrollMouseAndRender(harness, {
        x: taskListWheelTarget.x,
        y: taskListWheelTarget.y,
        direction: "up",
        times: 1
      });
      const topNoOpSelection = await readSelectedTaskPrefix();
      expect(topNoOpSelection).toBe(topSelection);

      await scrollMouseAndRender(harness, {
        x: taskListWheelTarget.x,
        y: taskListWheelTarget.y,
        direction: "down",
        times: 1
      });
      const movedDownSelection = await readSelectedTaskPrefix();
      expect(movedDownSelection).not.toBe(topSelection);

      await scrollMouseAndRender(harness, {
        x: taskListWheelTarget.x,
        y: taskListWheelTarget.y,
        direction: "down",
        times: 20
      });
      const bottomSelection = await readSelectedTaskPrefix();

      await scrollMouseAndRender(harness, {
        x: taskListWheelTarget.x,
        y: taskListWheelTarget.y,
        direction: "down",
        times: 1
      });
      const bottomNoOpSelection = await readSelectedTaskPrefix();
      expect(bottomNoOpSelection).toBe(bottomSelection);

      await scrollMouseAndRender(harness, {
        x: taskListWheelTarget.x,
        y: taskListWheelTarget.y,
        direction: "up",
        times: 1
      });
      const movedUpSelection = await readSelectedTaskPrefix();
      expect(movedUpSelection).not.toBe(bottomSelection);
    } finally {
      await cleanupSession(session);
    }
  });

  it("dashboard top-tag apply flow uses ArrowDown + Enter to mutate filters", async () => {
    const now = Date.now();
    const today = startOfLocalDayMs(now);
    const tasks: Task[] = [
      {
        id: "tag-work-1",
        title: "work one",
        status: "open",
        createdAt: now,
        updatedAt: now,
        dueAt: today,
        tags: ["work"]
      },
      {
        id: "tag-home-1",
        title: "home one",
        status: "open",
        createdAt: now,
        updatedAt: now,
        dueAt: addLocalDaysMs(today, 1),
        tags: ["home"]
      },
      {
        id: "tag-work-2",
        title: "work two",
        status: "open",
        createdAt: now,
        updatedAt: now,
        dueAt: addLocalDaysMs(today, 2),
        tags: ["work"]
      }
    ];

    const session = await createSession({ initialData: makeInitialData(tasks) });
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await pressKeyAndRender(mockInput, harness, "b");
      let frame = await waitForText(harness, "TOP TAGS (OPEN)");
      expect(frame).toContain("TAG=(none)");

      await pressArrowAndRender(mockInput, harness, "down");
      await pressEnterAndRender(mockInput, harness);

      frame = await waitForText(harness, "Dashboard tag filter: #home");
      expect(frame).toContain("TAG=#home");
    } finally {
      await cleanupSession(session);
    }
  });

  it("dashboard bottom quick-filter mouse toggles can be applied and cleared repeatedly", async () => {
    const now = Date.now();
    const today = startOfLocalDayMs(now);
    const doneAt = addLocalDaysMs(today, -1);
    const tasks: Task[] = [
      {
        id: "overdue-task",
        title: "overdue task",
        status: "open",
        createdAt: now,
        updatedAt: now,
        dueAt: addLocalDaysMs(today, -1),
        tags: []
      },
      {
        id: "today-task",
        title: "today task",
        status: "open",
        createdAt: now,
        updatedAt: now,
        dueAt: today,
        tags: []
      },
      {
        id: "next7-task",
        title: "next7 task",
        status: "open",
        createdAt: now,
        updatedAt: now,
        dueAt: addLocalDaysMs(today, 3),
        tags: []
      },
      {
        id: "done-task",
        title: "done task",
        status: "done",
        createdAt: now,
        updatedAt: doneAt,
        closedAt: doneAt,
        tags: []
      }
    ];

    const session = await createSession({ initialData: makeInitialData(tasks) });
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await pressKeyAndRender(mockInput, harness, "b");
      await waitForFrame(harness, (frame) => frame.includes("STATUS=ALL") && frame.includes("DUE=ANY"));

      await clickTextUntil(
        harness,
        "DUE THIS WEEK",
        (frame) => frame.includes("STATUS=OPEN") && frame.includes("DUE=NEXT7"),
        "last"
      );
      await clickTextUntil(
        harness,
        "DUE THIS WEEK",
        (frame) => frame.includes("STATUS=ALL") && frame.includes("DUE=ANY"),
        "last"
      );

      await clickTextUntil(
        harness,
        "DUE TODAY",
        (frame) => frame.includes("STATUS=OPEN") && frame.includes("DUE=TODAY"),
        "last"
      );
      await clickTextUntil(
        harness,
        "DUE TODAY",
        (frame) => frame.includes("STATUS=ALL") && frame.includes("DUE=ANY"),
        "last"
      );

      await clickTextUntil(
        harness,
        "OVERDUE",
        (frame) => frame.includes("STATUS=OPEN") && frame.includes("DUE=OVERDUE"),
        "last"
      );
      await clickTextUntil(
        harness,
        "OVERDUE",
        (frame) => frame.includes("STATUS=ALL") && frame.includes("DUE=ANY"),
        "last"
      );

      await clickTextUntil(
        harness,
        "COMPLETED THIS WEEK",
        (frame) => frame.includes("STATUS=DONE") && frame.includes("DUE=ANY"),
        "last"
      );
      await clickTextUntil(
        harness,
        "COMPLETED THIS WEEK",
        (frame) => frame.includes("STATUS=ALL") && frame.includes("DUE=ANY"),
        "last"
      );
    } finally {
      await cleanupSession(session);
    }
  });

  it("DTF-009: dashboard due-bucket +N drill-through applies exact dueDayOffset filter", async () => {
    const now = Date.now();
    const today = startOfLocalDayMs(now);
    const tasks: Task[] = [
      {
        id: "plus3-a",
        title: "plus3-a",
        status: "open",
        createdAt: now,
        updatedAt: now,
        dueAt: addLocalDaysMs(today, 3),
        tags: []
      },
      {
        id: "plus1-a",
        title: "plus1-a",
        status: "open",
        createdAt: now,
        updatedAt: now,
        dueAt: addLocalDaysMs(today, 1),
        tags: []
      }
    ];

    const session = await createSession({ initialData: makeInitialData(tasks) });
    const { harness } = session;

    try {
      await pressKeyAndRender(harness.mockInput, harness, "b");
      await waitForText(harness, "DUE+N=(none)");

      await pressArrowAndRender(harness.mockInput, harness, "down", 4);
      await pressEnterAndRender(harness.mockInput, harness);
      await waitForFrame(
        harness,
        (frame) =>
          frame.includes("STATUS=OPEN") &&
          frame.includes("DUE=ANY") &&
          frame.includes("DUE+N=+3")
      );
    } finally {
      await cleanupSession(session);
    }
  });

  it("calendar high-impact import requires token and invalid token path returns to confirm", async () => {
    const session = await createSession();
    const { harness } = session;
    const fixture = await prepareBackupRuntimeFixture(session);

    try {
      await withDataPathAndCwd(fixture.dataPath, fixture.backupDir, async () => {
        await runCalendarImportGuidedFlowToDryRun(harness, "incoming.ics", {
          rangeDigit: "3",
          modeDigit: "2"
        });

        await pressEnterAndRender(harness.mockInput, harness);
        let frame = await waitForText(harness, "High-impact import confirmation required.");
        expect(frame).toContain("Type IMPORT to continue");

        await pressEnterAndRender(harness.mockInput, harness);
        frame = await waitForText(harness, "Type IMPORT to confirm this high-impact import.");
        expect(frame).toContain("Operation failed");

        await pressEscapeAndRender(harness.mockInput, harness);
        frame = await waitForText(harness, "High-impact import confirmation required.");
        expect(frame).toContain("mode=update, range=all");

        await pasteTextAndRender(harness.mockInput, harness, "IMPORT");
        await pressEnterAndRender(harness.mockInput, harness);
        frame = await waitForText(harness, "FINAL IMPORT CHECKPOINT");
        expect(frame).toContain("Commit calendar import now?");

        await pressKeyAndRender(harness.mockInput, harness, "n");
        frame = await waitForText(harness, "High-impact import confirmation required.");
        expect(frame).toContain("Type IMPORT to continue");
      });
    } finally {
      await cleanupSession(session);
    }
  });

  it(
    "calendar final checkpoint confirm path starts import and reaches running or done state",
    async () => {
      const session = await createSession({
        initialNotificationSettings: {
          enabled: false,
          inAppOverdueBanner: false,
          terminalBellOnOverdue: false,
          bannerDurationMs: 4000,
          bellCooldownMs: 300000
        }
      });
      const { harness } = session;
      const fixture = await prepareBackupRuntimeFixture(session);

      try {
        await withDataPathAndCwd(fixture.dataPath, fixture.backupDir, async () => {
          await runCalendarImportGuidedFlowToDryRun(harness, "incoming.ics", {
            rangeDigit: "3",
            modeDigit: "2"
          });

          await pressEnterAndRender(harness.mockInput, harness);
          await waitForText(harness, "High-impact import confirmation required.");
          await pasteTextAndRender(harness.mockInput, harness, "IMPORT");
          await pressEnterAndRender(harness.mockInput, harness);
          await waitForText(harness, "FINAL IMPORT CHECKPOINT");

          await pressKeyAndRender(harness.mockInput, harness, "y");
          const frame = await waitForAnyText(
            harness,
            ["Applying calendar import...", "Calendar import complete"],
            10000
          );
          expect(frame).not.toContain("FINAL IMPORT CHECKPOINT");
        });
      } finally {
        await cleanupSession(session);
      }
    },
    15_000
  );

  it("keeps boot overlay disabled while Retro FX settings still update", async () => {
    const session = await createSession({ initialRetroFxMode: "classic" });
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await expectTextAbsentForDuration(harness, "TADOI BOOT ROM // CASSETTE LINK", 1200);

      await openHelpSettingsPage(harness);
      await focusHelpSettingsItem(harness, "▶ Appearance");
      await pressEnterAndRender(mockInput, harness);
      await waitForText(harness, "Help / Settings / Appearance");
      let frame = await focusHelpSettingsItem(harness, "▶ Retro FX Mode:");
      expect(frame).toContain("Classic");
      expect(frame).toContain("CRT FX Profile");

      await pressEnterAndRender(mockInput, harness);
      frame = await waitForFrame(harness, (next) => next.includes("Broadcast"));
      expect(frame).toContain("Help / Settings / Appearance");
      await expectTextAbsentForDuration(harness, "TADOI BOOT ROM // CASSETTE LINK", 1200);
    } finally {
      await cleanupSession(session);
    }
  });

  it("does not replay boot overlay on retro FX mode changes", async () => {
    const session = await createSession({ initialRetroFxMode: "classic" });
    const { harness } = session;

    try {
      await expectTextAbsentForDuration(harness, "TADOI BOOT ROM // CASSETTE LINK", 1200);
      await cycleRetroFxModeSettingFromHelp(harness);
      await waitForFrame(harness, (frame) => frame.includes("Broadcast"));
      await expectTextAbsentForDuration(harness, "TADOI BOOT ROM // CASSETTE LINK", 1100);
    } finally {
      await cleanupSession(session);
    }
  });

  it(
    "recurring editor flow triggers recurring-created milestone once",
    async () => {
      const now = new Date(2026, 1, 26, 12, 0).getTime();
      const dueAt = new Date(2026, 2, 10, 9, 0).getTime();
      const task: Task = {
        id: "task-editor-recur-1",
        title: "Recurring editor task",
        status: "open",
        createdAt: now - 1000,
        updatedAt: now - 1000,
        dueAt,
        hasExplicitTime: true,
        tags: [],
        workflowStage: "todo"
      };

      const session = await createSession({
        initialData: makeInitialData([task])
      });
      try {
        const { harness } = session;
        const { mockInput } = harness;

        await waitForText(harness, "RECURRING EDITOR TASK");

        await pressKeyAndRender(mockInput, harness, "e");
        await waitForText(harness, "REPEAT");
        await clickTextUntil(
          harness,
          "WLY",
          (frame) => frame.includes("WLY") && frame.includes("REPEAT")
        );
        await pressCtrlKeyAndRender(mockInput, harness, "s");
        let frame = await waitForText(harness, "Created your first recurring task.");
        expect(frame).toContain("↻");

        await waitForFrame(
          harness,
          (next) => !next.includes("Created your first recurring task."),
          12_000
        );

        await pressKeyAndRender(mockInput, harness, "e");
        await waitForText(harness, "REPEAT");
        await clickTextUntil(
          harness,
          "MLY",
          (next) => next.includes("MLY") && next.includes("REPEAT")
        );
        await pressCtrlKeyAndRender(mockInput, harness, "s");
        frame = await waitForText(harness, "RECURRING EDITOR TASK");
        expect(frame).toContain("↻");
        await expectTextAbsentForDuration(harness, "Created your first recurring task.", 1200);
      } finally {
        await cleanupSession(session);
      }
    },
    20_000
  );

  it("empty NUX shortcuts/back path and backup import CTA route into Backup Center import", async () => {
    const session = await createSession({
      initialData: makeInitialData([]),
      showCorruptionRecoveryImportCta: true
    });
    const { harness } = session;
    const fixture = await prepareBackupRuntimeFixture(session, { localTasks: [] });

    try {
      await withDataPath(fixture.dataPath, async () => {
        let frame = await waitForText(harness, "WELCOME TO TADOI", 8000);
        expect(frame).toContain("IMPORT BACKUP [I]");

        await pressKeyAndRender(harness.mockInput, harness, "h");
        frame = await waitForText(harness, "TADOI SHORTCUTS");
        expect(frame).toContain("Esc: return to welcome.");

        await pressEscapeAndRender(harness.mockInput, harness);
        frame = await waitForText(harness, "WELCOME TO TADOI");
        expect(frame).toContain("SHORTCUTS [H]");

        await pressKeyAndRender(harness.mockInput, harness, "i");
        await waitForAnyText(harness, ["Loading backups...", "Select backup file"], 8000);
        frame = await waitForText(harness, "Select backup file", 8000);
        expect(frame).toContain("STEP: DATA / IMPORT");
      });
    } finally {
      await cleanupSession(session);
    }
  });

  it("empty NUX celebrate enter opens what-next with onboarding chips and enter returns to list", async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-app-nux-what-next-"));
    const dataPath = path.join(dataDir, "tadoi_data.json");
    const originalDataPath = process.env.TADOI_DATA_PATH;
    process.env.TADOI_DATA_PATH = dataPath;
    const session = await createSession({
      initialData: makeInitialData([]),
      skipInitialSave: false
    });
    const { harness } = session;
    const { mockInput } = harness;

    try {
      let frame = await waitForText(harness, "WELCOME TO TADOI", 8000);
      expect(frame).toContain("CREATE TASK [A/ENTER]");

      await pressEnterAndRender(mockInput, harness);
      await waitForText(harness, "MODE:  ADD");
      await typeTextAndRender(mockInput, harness, "Onboarding task");
      await focusEditorSaveAndSubmit(mockInput, harness, "ADD");
      await waitForFile(dataPath, 4000);

      frame = await waitForText(harness, "FIRST TASK CREATED", 8000);
      expect(frame).toContain("ONBOARDING 1/3");
      expect(frame).toContain("[x] TASK");
      expect(frame).toContain("WHAT NEXT [ENTER]");

      await pressEnterAndRender(mockInput, harness);
      frame = await waitForText(harness, "WHAT NEXT");
      expect(frame).toContain("ONBOARDING 1/3");
      expect(frame).toContain("[ ] TOME");
      expect(frame).toContain("[ ] CHECKLIST");

      await pressEnterAndRender(mockInput, harness);
      frame = await waitForText(harness, "MODE:  LIST");
      expect(frame).toContain("ONBOARDING TASK");
      expect(frame).not.toContain("WHAT NEXT");
    } finally {
      await cleanupSession(session);
      await fs.rm(dataDir, { recursive: true, force: true });
      if (originalDataPath === undefined) {
        delete process.env.TADOI_DATA_PATH;
      } else {
        process.env.TADOI_DATA_PATH = originalDataPath;
      }
    }
  });

  it("what-next checklist action opens checklist add modal on the created task", async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-app-nux-checklist-route-"));
    const dataPath = path.join(dataDir, "tadoi_data.json");
    const originalDataPath = process.env.TADOI_DATA_PATH;
    process.env.TADOI_DATA_PATH = dataPath;
    const session = await createSession({
      initialData: makeInitialData([]),
      skipInitialSave: false
    });
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await waitForText(harness, "WELCOME TO TADOI", 8000);
      await pressEnterAndRender(mockInput, harness);
      await waitForText(harness, "MODE:  ADD");
      await typeTextAndRender(mockInput, harness, "Onboarding route task");
      await focusEditorSaveAndSubmit(mockInput, harness, "ADD");
      await waitForFile(dataPath, 4000);
      await waitForText(harness, "FIRST TASK CREATED", 8000);
      await pressEnterAndRender(mockInput, harness);
      await waitForText(harness, "WHAT NEXT");

      await pressKeyAndRender(mockInput, harness, "c");
      let frame = await waitForText(harness, "ADD CHECKLIST ITEM", 8000);
      expect(frame).toContain("Onboarding route task");
      await pressEscapeAndRender(mockInput, harness);
      frame = await waitForText(harness, "MODE:  EDIT");
      expect(frame).toContain("FOCUS: CHECKLIST");
    } finally {
      await cleanupSession(session);
      await fs.rm(dataDir, { recursive: true, force: true });
      if (originalDataPath === undefined) {
        delete process.env.TADOI_DATA_PATH;
      } else {
        process.env.TADOI_DATA_PATH = originalDataPath;
      }
    }
  });

  it("what-next tome action opens the TOME create prompt", async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-app-nux-tome-route-"));
    const dataPath = path.join(dataDir, "tadoi_data.json");
    const originalDataPath = process.env.TADOI_DATA_PATH;
    process.env.TADOI_DATA_PATH = dataPath;
    const session = await createSession({
      initialData: makeInitialData([]),
      skipInitialSave: false
    });
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await waitForText(harness, "WELCOME TO TADOI", 8000);
      await pressEnterAndRender(mockInput, harness);
      await waitForText(harness, "MODE:  ADD");
      await typeTextAndRender(mockInput, harness, "Onboarding tome route");
      await focusEditorSaveAndSubmit(mockInput, harness, "ADD");
      await waitForFile(dataPath, 4000);
      await waitForText(harness, "FIRST TASK CREATED", 8000);
      await pressEnterAndRender(mockInput, harness);
      await waitForText(harness, "WHAT NEXT");

      await pressKeyAndRender(mockInput, harness, "t");
      const frame = await waitForText(harness, "NEW TOME NOTE", 8000);
      expect(frame).toContain("TOME: Terminal Oriented Markdown Environment");
    } finally {
      await cleanupSession(session);
      await fs.rm(dataDir, { recursive: true, force: true });
      if (originalDataPath === undefined) {
        delete process.env.TADOI_DATA_PATH;
      } else {
        process.env.TADOI_DATA_PATH = originalDataPath;
      }
    }
  });
});

describe("App modal flow engagement toast protections", () => {
  async function assertToastSuppressedAcrossBlockingOverlay(
    harness: RenderHarness,
    mockInput: MockInput,
    openOverlay: () => Promise<void>,
    closeOverlay: () => Promise<void>
  ): Promise<void> {
    const toastMessage = "First task completed.";
    await pressKeyAndRender(mockInput, harness, " ");
    await waitForText(harness, toastMessage);

    await openOverlay();
    await expectTextAbsentForDuration(harness, toastMessage);
    await closeOverlay();
    await waitForText(harness, toastMessage);
  }

  it("suppresses engagement toasts while HELP overlay is open", async () => {
    const session = await createSession();
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await assertToastSuppressedAcrossBlockingOverlay(
        harness,
        mockInput,
        async () => {
          await pressKeyAndRender(mockInput, harness, "?");
          await waitForText(harness, "MODE:  HELP");
        },
        async () => {
          await pressEscapeAndRender(mockInput, harness);
          await waitForText(harness, "MODE:  LIST");
        }
      );
    } finally {
      await cleanupSession(session);
    }
  }, 15_000);

  it("suppresses engagement toasts while Backup Center overlay is open", async () => {
    const session = await createSession();
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await assertToastSuppressedAcrossBlockingOverlay(
        harness,
        mockInput,
        async () => {
          await openBackupCenterMenu(harness);
          await waitForText(harness, "1) Export backup (recommended)");
        },
        async () => {
          await pressEscapeAndRender(mockInput, harness);
          await waitForText(harness, "MODE:  LIST");
        }
      );
    } finally {
      await cleanupSession(session);
    }
  });

  it("suppresses engagement toasts while Tag Filter panel is open", async () => {
    const session = await createSession();
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await assertToastSuppressedAcrossBlockingOverlay(
        harness,
        mockInput,
        async () => {
          await pressKeyAndRender(mockInput, harness, "p");
          await waitForText(harness, "TAG FILTER PANEL");
        },
        async () => {
          await pressEscapeAndRender(mockInput, harness);
          await waitForText(harness, "MODE:  LIST");
        }
      );
    } finally {
      await cleanupSession(session);
    }
  });

  it("suppresses engagement toasts while delete confirmation modal is open", async () => {
    const session = await createSession();
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await assertToastSuppressedAcrossBlockingOverlay(
        harness,
        mockInput,
        async () => {
          await pressKeyAndRender(mockInput, harness, "d");
          await waitForText(harness, "DELETE SELECTED TASK? [Y/N/ESC]");
        },
        async () => {
          await pressKeyAndRender(mockInput, harness, "n");
          await waitForText(harness, "MODE:  LIST");
        }
      );
    } finally {
      await cleanupSession(session);
    }
  });
});
