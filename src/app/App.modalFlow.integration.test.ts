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

type RenderHarness = Awaited<ReturnType<typeof testRender>>;

type AppSession = {
  harness: RenderHarness;
  tempDir: string;
  settingsPath: string;
};

type SessionOptions = {
  initialData?: LoadedData;
  showCorruptionRecoveryImportCta?: boolean;
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

function makeTask(id: string, title: string, nowMs = Date.now()): Task {
  return {
    id,
    title,
    status: "open",
    createdAt: nowMs,
    updatedAt: nowMs,
    tags: []
  };
}

function makeInitialData(tasks: Task[] = [makeTask("task-1", "Existing task")]): LoadedData {
  return {
    schemaVersion: 6,
    stateRevision: 0,
    tasks,
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
      showLogo: false
    }),
    {
      width: 150,
      height: 44
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

async function pressKeyAndRender(mockInput: MockInput, harness: RenderHarness, key: string) {
  await mockInput.pressKeys([key]);
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
      process.chdir(originalCwd);
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

  it("calendar final checkpoint confirm path starts import and reaches running or done state", async () => {
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
