import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import React from "react";
import os from "os";
import path from "path";
import { promises as fs } from "fs";
import { testRender } from "@opentui/react/test-utils";
import type { MockInput } from "@opentui/core/testing";
import { App } from "./App";
import type { Task } from "../domain/models";
import { createDefaultEngagementState } from "../domain/engagement";
import type { LoadedData } from "../state/persistence";
import type { NotificationSettings, RetroFxMode } from "../settings/settings";
import { addLocalDaysMs, startOfLocalDayMs } from "../domain/dates";

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
    schemaVersion: 7,
    stateRevision: 0,
    tasks: tasks.map(withSchemaV7WorkflowStage),
    tagIndex: {},
    savedViews: [],
    engagement: createDefaultEngagementState()
  };
}

async function createSession(options: SessionOptions = {}): Promise<AppSession> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-app-modal-flow-"));
  const settingsPath = path.join(tempDir, "settings.json");
  const harness = await testRender(
    React.createElement(App, {
      initialData: options.initialData ?? makeInitialData(),
      showCorruptionRecoveryImportCta: options.showCorruptionRecoveryImportCta,
      skipInitialSave: true,
      settingsPath,
      initialRetroFxMode: options.initialRetroFxMode,
      initialNotificationSettings: options.initialNotificationSettings,
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
  mockInput.pressEnter();
  await Bun.sleep(10);
  await harness.renderOnce();
}

async function pressEscapeAndRender(mockInput: MockInput, harness: RenderHarness) {
  mockInput.pressEscape();
  await Bun.sleep(10);
  await harness.renderOnce();
}

async function pressTabAndRender(mockInput: MockInput, harness: RenderHarness) {
  mockInput.pressTab();
  await Bun.sleep(10);
  await harness.renderOnce();
}

async function pressArrowAndRender(
  mockInput: MockInput,
  harness: RenderHarness,
  direction: "up" | "down" | "left" | "right",
  times = 1
) {
  for (let index = 0; index < times; index += 1) {
    mockInput.pressArrow(direction);
    await Bun.sleep(10);
    await harness.renderOnce();
  }
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

async function openHelpSettingsPage(harness: RenderHarness) {
  const { mockInput } = harness;
  await pressKeyAndRender(mockInput, harness, "?");
  await waitForText(harness, "Getting Started");
  await pressArrowAndRender(mockInput, harness, "down", 5);
  await pressArrowAndRender(mockInput, harness, "right");
  await waitForText(harness, "Theme mode and custom palette settings.");
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

async function cycleRetroFxModeSettingFromHelp(harness: RenderHarness) {
  const { mockInput } = harness;
  await openHelpSettingsPage(harness);
  await focusHelpSettingsItem(harness, "▶ Retro FX Mode:");
  await pressEnterAndRender(mockInput, harness);
}

async function selectNavigationHintsMode(
  harness: RenderHarness,
  label: "Bottom only" | "Left rail only" | "Both" | "None"
): Promise<void> {
  const { mockInput } = harness;
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

async function openCustom1Editor(harness: RenderHarness) {
  const { mockInput } = harness;
  await openHelpSettingsPage(harness);
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
  await openHelpSettingsPage(harness);
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
      await waitForText(harness, "Theme mode: Default");
      const frame = await focusHelpSettingsItem(harness, "▶ Retro FX Mode:");
      expect(frame).toContain("CRT FX Profile");
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
      await focusHelpSettingsItem(harness, "▶ Keymap Aliases");
      await pressEnterAndRender(mockInput, harness);
      let frame = await waitForText(harness, "Help / Settings / Keymap Aliases");
      expect(frame).toContain("List aliases: off");

      await pressEnterAndRender(mockInput, harness);
      frame = await waitForText(harness, "List aliases: on");

      await pressKeyAndRender(mockInput, harness, "?");
      await waitForText(harness, "Existing task");

      await pressCtrlKeyAndRender(mockInput, harness, "f");
      frame = await waitForText(harness, "Type to filter tasks and tags; Enter/Esc closes");
      expect(frame).toContain("FOCUS: SEARCH");
      await pressEscapeAndRender(mockInput, harness);
      await waitForText(harness, "FOCUS: LIST");

      await openHelpSettingsPage(harness);
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
      expect(frame).not.toContain("Type to filter tasks and tags; Enter/Esc closes");
    } finally {
      await cleanupSession(session);
    }
  });

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
      let frame = await waitForText(harness, "Existing task");
      expect(frame).toContain("KEYS");
      expect(frame).toContain("a: add");

      await pressKeyAndRender(mockInput, harness, "/");
      frame = await waitForText(harness, "SEARCH");
      expect(frame).toContain("KEYS");
      expect(frame).toContain("type: filter");

      await pressEscapeAndRender(mockInput, harness);
      await waitForText(harness, "Existing task");

      await pressKeyAndRender(mockInput, harness, "d");
      frame = await waitForText(harness, "DELETE SELECTED TASK? [Y/N]");
      expect(frame).toContain("KEYS");
      expect(frame).toContain("y: confirm");
      expect(frame).toContain("n: cancel");
    } finally {
      await cleanupSession(session);
    }
  });

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
      await selectNavigationHintsMode(harness, "Left rail only");
      await pressKeyAndRender(mockInput, harness, "?");
      frame = await waitForFrame(
        harness,
        (next) => next.includes("HINTS") && !next.includes("KEYS")
      );
      expect(frame).toContain("HINTS");
      expect(frame).not.toContain("KEYS");

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
      const frame = await waitForText(harness, "DELETE SELECTED TASK? [Y/N]");
      const selectedPrefix = taskPrefixes.find((prefix) => frame.includes(`ID: ${prefix}`));
      expect(selectedPrefix).toBeTruthy();
      await pressKeyAndRender(harness.mockInput, harness, "n");
      await waitForFrame(
        harness,
        (next) => !next.includes("DELETE SELECTED TASK? [Y/N]")
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

      await clickTextUntil(
        harness,
        "+3",
        (frame) =>
          frame.includes("STATUS=OPEN") &&
          frame.includes("DUE=ANY") &&
          frame.includes("DUE+N=+3"),
        "first"
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
      let frame = await focusHelpSettingsItem(harness, "▶ Retro FX Mode:");
      expect(frame).toContain("Classic");
      expect(frame).toContain("CRT FX Profile");

      await pressEnterAndRender(mockInput, harness);
      frame = await waitForFrame(harness, (next) => next.includes("Broadcast"));
      expect(frame).toContain("Notifications");
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

  it("empty NUX shortcuts/back path and backup import CTA route into Backup Center import", async () => {
    const session = await createSession({
      initialData: makeInitialData([]),
      showCorruptionRecoveryImportCta: true
    });
    const { harness } = session;
    const fixture = await prepareBackupRuntimeFixture(session, { localTasks: [] });

    try {
      await withDataPath(fixture.dataPath, async () => {
        let frame = await waitForText(harness, "Welcome to TADOI", 8000);
        expect(frame).toContain("Import backup (I)");

        await pressKeyAndRender(harness.mockInput, harness, "h");
        frame = await waitForText(harness, "TADOI Shortcuts");
        expect(frame).toContain("Esc: Back to welcome");

        await pressEscapeAndRender(harness.mockInput, harness);
        frame = await waitForText(harness, "Welcome to TADOI");
        expect(frame).toContain("Shortcuts (H)");

        await pressKeyAndRender(harness.mockInput, harness, "i");
        await waitForAnyText(harness, ["Loading backups...", "Select backup file"], 8000);
        frame = await waitForText(harness, "Select backup file", 8000);
        expect(frame).toContain("STEP: DATA / IMPORT");
      });
    } finally {
      await cleanupSession(session);
    }
  });
});
