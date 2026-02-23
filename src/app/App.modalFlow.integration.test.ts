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

const FRAME_WAIT_TIMEOUT_MS = 8000;
const FRAME_POLL_INTERVAL_MS = 20;
const INPUT_SETTLE_MS = 10;
const TYPE_SETTLE_MS = 20;

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

async function createSession(initialData = makeInitialData()): Promise<AppSession> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-app-modal-flow-"));
  const settingsPath = path.join(tempDir, "settings.json");
  const harness = await testRender(
    React.createElement(App, {
      initialData,
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
  timeoutMs = FRAME_WAIT_TIMEOUT_MS
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let lastFrame = "";
  while (Date.now() <= deadline) {
    await harness.renderOnce();
    lastFrame = harness.captureCharFrame();
    if (predicate(lastFrame)) {
      return lastFrame;
    }
    await Bun.sleep(FRAME_POLL_INTERVAL_MS);
  }
  throw new Error(`Timed out waiting for frame condition.\nLast frame:\n${lastFrame}`);
}

async function waitForText(
  harness: RenderHarness,
  text: string,
  timeoutMs = FRAME_WAIT_TIMEOUT_MS
): Promise<string> {
  return waitForFrame(harness, (frame) => frame.includes(text), timeoutMs);
}

async function waitForAnyText(
  harness: RenderHarness,
  texts: string[],
  timeoutMs = FRAME_WAIT_TIMEOUT_MS
): Promise<string> {
  return waitForFrame(
    harness,
    (frame) => texts.some((text) => frame.includes(text)),
    timeoutMs
  );
}

async function settleAfterInput(harness: RenderHarness, settleMs = INPUT_SETTLE_MS) {
  await Bun.sleep(settleMs);
  await harness.renderOnce();
  await Bun.sleep(settleMs);
  await harness.renderOnce();
}

async function pressKeyAndRender(mockInput: MockInput, harness: RenderHarness, key: string) {
  await mockInput.pressKeys([key]);
  await settleAfterInput(harness);
}

async function pressEnterAndRender(mockInput: MockInput, harness: RenderHarness) {
  mockInput.pressEnter();
  await settleAfterInput(harness);
}

async function pressEscapeAndRender(mockInput: MockInput, harness: RenderHarness) {
  mockInput.pressEscape();
  await settleAfterInput(harness);
}

async function pressTabAndRender(mockInput: MockInput, harness: RenderHarness) {
  mockInput.pressTab();
  await settleAfterInput(harness);
}

async function pressArrowAndRender(
  mockInput: MockInput,
  harness: RenderHarness,
  direction: "up" | "down" | "left" | "right",
  times = 1
) {
  for (let index = 0; index < times; index += 1) {
    mockInput.pressArrow(direction);
    await settleAfterInput(harness);
  }
}

async function typeTextAndRender(
  mockInput: MockInput,
  harness: RenderHarness,
  text: string
) {
  await mockInput.typeText(text);
  await settleAfterInput(harness, TYPE_SETTLE_MS);
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

async function openDataImportDryRun(
  harness: RenderHarness,
  expectedBackupFilename: string
) {
  const { mockInput } = harness;
  await pressKeyAndRender(mockInput, harness, "u");
  await waitForText(harness, "1) Export backup (recommended)");
  await pressKeyAndRender(mockInput, harness, "2");
  await waitForText(harness, expectedBackupFilename);
  await pressEnterAndRender(mockInput, harness);
  await waitForText(harness, "Select import mode");
  await pressEnterAndRender(mockInput, harness);
  await waitForText(harness, "Dry-run summary");
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
    const { harness, tempDir } = session;
    const originalDataPath = process.env.TADOI_DATA_PATH;
    const dataPath = path.join(tempDir, "tadoi_data.json");
    const backupDir = path.join(tempDir, "backups");
    const backupFilename = "tadoi-backup-20260221-000001.json";
    const importPath = path.join(backupDir, backupFilename);

    await fs.mkdir(backupDir, { recursive: true });
    await fs.writeFile(
      dataPath,
      JSON.stringify(makeInitialData([makeTask("local-task", "Local task")]), null, 2),
      "utf8"
    );
    await fs.writeFile(
      importPath,
      JSON.stringify(
        {
          schemaVersion: 4,
          tasks: [makeTask("incoming-task", "Incoming task")],
          tagIndex: {},
          savedViews: []
        },
        null,
        2
      ),
      "utf8"
    );

    process.env.TADOI_DATA_PATH = dataPath;
    try {
      await openDataImportDryRun(harness, backupFilename);
      await pressEnterAndRender(harness.mockInput, harness);

      let frame = await waitForText(harness, "FINAL IMPORT CHECKPOINT");
      expect(frame).toContain("Commit backup data import now?");

      await pressKeyAndRender(harness.mockInput, harness, "n");
      frame = await waitForText(harness, "Dry-run summary");
      expect(frame).not.toContain("FINAL IMPORT CHECKPOINT");
    } finally {
      if (originalDataPath === undefined) {
        delete process.env.TADOI_DATA_PATH;
      } else {
        process.env.TADOI_DATA_PATH = originalDataPath;
      }
      await cleanupSession(session);
    }
  });

  it("backup final checkpoint confirm starts commit flow", async () => {
    const session = await createSession();
    const { harness, tempDir } = session;
    const originalDataPath = process.env.TADOI_DATA_PATH;
    const dataPath = path.join(tempDir, "tadoi_data.json");
    const backupDir = path.join(tempDir, "backups");
    const backupFilename = "tadoi-backup-20260221-000001.json";
    const importPath = path.join(backupDir, backupFilename);

    await fs.mkdir(backupDir, { recursive: true });
    await fs.writeFile(
      dataPath,
      JSON.stringify(makeInitialData([makeTask("local-task", "Local task")]), null, 2),
      "utf8"
    );
    await fs.writeFile(
      importPath,
      JSON.stringify(
        {
          schemaVersion: 4,
          tasks: [makeTask("incoming-task", "Incoming task")],
          tagIndex: {},
          savedViews: []
        },
        null,
        2
      ),
      "utf8"
    );

    process.env.TADOI_DATA_PATH = dataPath;
    try {
      await openDataImportDryRun(harness, backupFilename);
      await pressEnterAndRender(harness.mockInput, harness);
      await waitForText(harness, "FINAL IMPORT CHECKPOINT");

      await pressKeyAndRender(harness.mockInput, harness, "y");
      const frame = await waitForAnyText(harness, ["Applying import...", "Import complete"]);
      expect(frame).not.toContain("FINAL IMPORT CHECKPOINT");
    } finally {
      if (originalDataPath === undefined) {
        delete process.env.TADOI_DATA_PATH;
      } else {
        process.env.TADOI_DATA_PATH = originalDataPath;
      }
      await cleanupSession(session);
    }
  });
});
