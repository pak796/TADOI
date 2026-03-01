import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import React from "react";
import os from "os";
import path from "path";
import { promises as fs } from "fs";
import { testRender } from "@opentui/react/test-utils";
import type { MockInput } from "@opentui/core/testing";
import { App } from "./App";
import type { Task } from "../domain/models";
import type { LoadedData } from "../state/persistence";
import { createDefaultEngagementState } from "../domain/engagement";
import { DEFAULT_TOME_GUIDE_PATHS } from "../notes/defaultDocs";

type RenderHarness = Awaited<ReturnType<typeof testRender>>;

type AppSession = {
  harness: RenderHarness;
  tempDir: string;
  notesRoot: string;
};

type CreateSessionOptions = {
  seedNotes?: Record<string, string>;
  tasks?: Task[];
  skipInitialSave?: boolean;
  width?: number;
  height?: number;
  hintDisplayMode?: "bottom" | "left_rail" | "both" | "none";
};

function makeTask(id: string, title: string, nowMs = Date.now()): Task {
  return {
    id,
    title,
    status: "open",
    workflowStage: "todo",
    createdAt: nowMs,
    updatedAt: nowMs,
    tags: []
  };
}

function makeInitialData(tasks: Task[]): LoadedData {
  return {
    schemaVersion: 8,
    stateRevision: 0,
    tasks,
    tagIndex: {},
    savedViews: [],
    engagement: createDefaultEngagementState()
  };
}

async function writeNote(notesRoot: string, filename: string, content: string): Promise<void> {
  await fs.mkdir(notesRoot, { recursive: true });
  await fs.writeFile(path.join(notesRoot, filename), content, "utf8");
}

let originalConsoleError: typeof console.error;

async function createSession(options: CreateSessionOptions = {}): Promise<AppSession> {
  const {
    seedNotes = {},
    tasks,
    skipInitialSave = true,
    width = 150,
    height = 44,
    hintDisplayMode = "left_rail"
  } = options;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-app-tome-flow-"));
  const notesRoot = path.join(tempDir, "notes");
  const settingsPath = path.join(tempDir, "settings.json");
  await fs.mkdir(notesRoot, { recursive: true });
  for (const [filename, content] of Object.entries(seedNotes)) {
    await writeNote(notesRoot, filename, content);
  }
  await fs.writeFile(
    settingsPath,
    JSON.stringify(
      {
        notifications: {
          enabled: false,
          inAppOverdueBanner: false,
          terminalBellOnOverdue: false,
          bannerDurationMs: 5000,
          bellCooldownMs: 2000
        },
        notes: {
          enabled: true,
          rootPath: notesRoot
        },
        hintDisplayMode
      },
      null,
      2
    ),
    "utf8"
  );

  const now = new Date(2026, 1, 28, 12, 0).getTime();
  const initialTasks = tasks ?? [makeTask("task-1", "Task One", now)];
  const harness = await testRender(
    React.createElement(App, {
      initialData: makeInitialData(initialTasks),
      skipInitialSave,
      showLogo: false,
      initialNotesSettings: {
        enabled: true,
        rootPath: notesRoot
      },
      settingsPath
    }),
    { width, height }
  );
  await harness.renderOnce();
  return { harness, tempDir, notesRoot };
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
  await harness.renderOnce();
  lastFrame = harness.captureCharFrame();
  if (predicate(lastFrame)) {
    return lastFrame;
  }
  throw new Error(`Timed out waiting for frame condition.\nLast frame:\n${lastFrame}`);
}

async function waitForText(
  harness: RenderHarness,
  text: string,
  timeoutMs = 4000
): Promise<string> {
  try {
    return await waitForFrame(harness, (frame) => frame.includes(text), timeoutMs);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Timed out waiting for text "${text}".\n${message}`);
  }
}

async function pressKeyAndRender(
  mockInput: MockInput,
  harness: RenderHarness,
  key: string
): Promise<string> {
  await mockInput.pressKeys([key]);
  await Bun.sleep(10);
  await harness.renderOnce();
  return harness.captureCharFrame();
}

async function pressEnterAndRender(
  mockInput: MockInput,
  harness: RenderHarness
): Promise<string> {
  await Promise.resolve(mockInput.pressEnter());
  await Bun.sleep(10);
  await harness.renderOnce();
  return harness.captureCharFrame();
}

async function pressEscapeAndRender(
  mockInput: MockInput,
  harness: RenderHarness
): Promise<string> {
  await Promise.resolve(mockInput.pressEscape());
  await Bun.sleep(10);
  await harness.renderOnce();
  return harness.captureCharFrame();
}

async function pressCtrlKeyAndRender(
  mockInput: MockInput,
  harness: RenderHarness,
  key: string
): Promise<string> {
  mockInput.pressKey(key, { ctrl: true });
  await Bun.sleep(10);
  await harness.renderOnce();
  return harness.captureCharFrame();
}

async function pressTabAndRender(
  mockInput: MockInput,
  harness: RenderHarness
): Promise<string> {
  await Promise.resolve(mockInput.pressTab());
  await Bun.sleep(10);
  await harness.renderOnce();
  return harness.captureCharFrame();
}

async function pressArrowAndRender(
  mockInput: MockInput,
  harness: RenderHarness,
  direction: "up" | "down" | "left" | "right"
): Promise<string> {
  await Promise.resolve(mockInput.pressArrow(direction));
  await Bun.sleep(10);
  await harness.renderOnce();
  return harness.captureCharFrame();
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

async function clickTextUntil(
  harness: RenderHarness,
  text: string,
  predicate: (frame: string) => boolean
): Promise<string> {
  await harness.renderOnce();
  const frame = harness.captureCharFrame();
  const positions = findTextPositions(frame, text);
  if (positions.length === 0) {
    throw new Error(`Unable to locate text in frame: "${text}"\n${frame}`);
  }
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

  for (const position of positions) {
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

function extractNotePath(frame: string): string | null {
  const match = frame.match(/PATH:\s+([^\n\r]+)/);
  return match?.[1]?.trim() ?? null;
}

async function listMarkdownPaths(root: string): Promise<string[]> {
  const output: string[] = [];

  async function walk(current: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!entry.name.toLowerCase().endsWith(".md")) continue;
      output.push(path.relative(root, fullPath).split(path.sep).join("/"));
    }
  }

  await walk(root);
  return output.sort((left, right) => left.localeCompare(right));
}

async function waitForMarkdownCount(
  root: string,
  count: number,
  timeoutMs = 4000
): Promise<string[]> {
  const deadline = Date.now() + timeoutMs;
  let last: string[] = [];
  while (Date.now() <= deadline) {
    last = await listMarkdownPaths(root);
    if (last.length === count) {
      return last;
    }
    await Bun.sleep(20);
  }
  throw new Error(`Timed out waiting for markdown count ${String(count)}. Last: ${last.join(", ")}`);
}

async function waitForFileExists(filePath: string, timeoutMs = 4000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    try {
      const stat = await fs.stat(filePath);
      if (stat.isFile()) return;
    } catch {
      // Keep polling until timeout.
    }
    await Bun.sleep(20);
  }
  throw new Error(`Timed out waiting for file to exist: ${filePath}`);
}

async function waitForFileMissing(filePath: string, timeoutMs = 4000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    try {
      await fs.stat(filePath);
    } catch (error: unknown) {
      const maybeErrno = error as NodeJS.ErrnoException;
      if (maybeErrno?.code === "ENOENT") return;
    }
    await Bun.sleep(20);
  }
  throw new Error(`Timed out waiting for file to be removed: ${filePath}`);
}

async function openHelpSettingsFromList(
  mockInput: MockInput,
  harness: RenderHarness
): Promise<void> {
  await pressKeyAndRender(mockInput, harness, "?");
  await waitForText(harness, "Getting Started");
  let lastFrame = "";
  for (let step = 0; step < 16; step += 1) {
    await harness.renderOnce();
    let frame = harness.captureCharFrame();
    lastFrame = frame;
    if (frame.includes("Help / Settings") && frame.includes("Theme mode:")) {
      return;
    }
    await pressArrowAndRender(mockInput, harness, "right");
    await harness.renderOnce();
    frame = harness.captureCharFrame();
    lastFrame = frame;
    if (frame.includes("Help / Settings") && frame.includes("Theme mode:")) {
      return;
    }
    await pressArrowAndRender(mockInput, harness, "down");
  }
  throw new Error(`Unable to open Help settings page.\nLast frame:\n${lastFrame}`);
}

async function focusHelpSettingsItem(
  mockInput: MockInput,
  harness: RenderHarness,
  selectedItemPrefix: string,
  maxSteps = 20
): Promise<string> {
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

describe("App TOME integration", () => {
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

  it("keeps header order and allows list navigation after returning from view", async () => {
    const session = await createSession({
      seedNotes: {
        "Alpha.md": "# Alpha\n\nOne",
        "Beta.md": "# Beta\n\nTwo"
      }
    });
    const { harness, notesRoot } = session;
    const { mockInput } = harness;

    try {
      await waitForText(harness, "TASK ONE");
      await pressKeyAndRender(mockInput, harness, "n");
      const notesFrame = await waitForText(harness, "TOME: Terminal Oriented Markdown Environment");
      const lines = notesFrame.split("\n");
      const taglineIndex = lines.findIndex((line) =>
        line.includes("TOME: Terminal Oriented Markdown Environment")
      );
      expect(taglineIndex).toBeGreaterThanOrEqual(0);
      const titleLine = lines[taglineIndex + 1] ?? "";
      expect(titleLine.trim().length).toBeGreaterThan(0);
      await waitForFrame(
        harness,
        (frame) => frame.includes("Alpha.md") || frame.includes("Beta.md")
      );
      await pressEnterAndRender(mockInput, harness);
      const firstOpenFrame = await waitForFrame(
        harness,
        (frame) => frame.includes("PATH: Alpha.md") || frame.includes("PATH: Beta.md")
      );
      const firstPath = extractNotePath(firstOpenFrame);
      expect(firstPath).not.toBeNull();

      await pressEscapeAndRender(mockInput, harness);
      await waitForText(harness, "TOME: Terminal Oriented Markdown Environment");
      await pressKeyAndRender(mockInput, harness, "j");
      await pressEnterAndRender(mockInput, harness);

      const secondOpenFrame = await waitForFrame(
        harness,
        (frame) => frame.includes("PATH: Alpha.md") || frame.includes("PATH: Beta.md")
      );
      const secondPath = extractNotePath(secondOpenFrame);
      expect(secondPath).not.toBeNull();
      await fs.stat(path.join(notesRoot, "Alpha.md"));
      await fs.stat(path.join(notesRoot, "Beta.md"));
    } finally {
      await cleanupSession(session);
    }
  });

  it("exits TOME to task list on Esc even when opened from dashboard", async () => {
    const session = await createSession({
      seedNotes: {
        "Alpha.md": "# Alpha\n\nOne"
      }
    });
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await waitForText(harness, "TASK ONE");
      await pressKeyAndRender(mockInput, harness, "b");
      await waitForText(harness, "TOP TAGS (OPEN)");

      await pressKeyAndRender(mockInput, harness, "n");
      await waitForText(harness, "TOME: Terminal Oriented Markdown Environment");

      await pressEscapeAndRender(mockInput, harness);
      const listFrame = await waitForFrame(
        harness,
        (frame) =>
          frame.includes("TASK ONE") &&
          !frame.includes("TOME: Terminal Oriented Markdown Environment") &&
          !frame.includes("TOP TAGS (OPEN)")
      );
      expect(listFrame).toContain("MODE:  LIST");
    } finally {
      await cleanupSession(session);
    }
  });

  it("creates a note from typed title via inline TOME create prompt", async () => {
    const session = await createSession({
      hintDisplayMode: "both",
      seedNotes: {
        "Seed.md": "# Seed\n\n"
      }
    });
    const { harness, notesRoot } = session;
    const { mockInput } = harness;

    try {
      await waitForText(harness, "TASK ONE");
      await pressKeyAndRender(mockInput, harness, "n");
      await waitForText(harness, "TOME: Terminal Oriented Markdown Environment");

      await pressKeyAndRender(mockInput, harness, "a");
      await waitForText(harness, "NEW TOME NOTE");
      await mockInput.typeText("My Custom Tome Title");
      await Bun.sleep(20);
      await harness.renderOnce();
      await waitForText(harness, "My Custom Tome Title");

      await pressEnterAndRender(mockInput, harness);
      const editFrame = await waitForText(harness, "EDIT TOME NOTE");
      expect(editFrame).toContain("SAVE [Ctrl+S]");
      expect(editFrame).toContain("CANCEL [Esc]");
      expect(editFrame).toContain("STATUS: SAVED");
      await pressEscapeAndRender(mockInput, harness);

      const viewFrame = await waitForText(harness, "PATH: My Custom Tome Title.md");
      expect(viewFrame).toContain("PATH: My Custom Tome Title.md");
      await waitForFileExists(path.join(notesRoot, "My Custom Tome Title.md"));
    } finally {
      await cleanupSession(session);
    }
  });

  it("records FIRST_TOME_CREATED when the first in-app note is created", async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-app-tome-milestone-"));
    const dataPath = path.join(dataDir, "tadoi_data.json");
    const originalDataPath = process.env.TADOI_DATA_PATH;
    process.env.TADOI_DATA_PATH = dataPath;

    const session = await createSession({
      skipInitialSave: false,
      hintDisplayMode: "both"
    });
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await waitForText(harness, "TASK ONE");
      await pressKeyAndRender(mockInput, harness, "n");
      await waitForText(harness, "TOME: Terminal Oriented Markdown Environment");

      await pressKeyAndRender(mockInput, harness, "a");
      await waitForText(harness, "NEW TOME NOTE");
      await mockInput.typeText("First Tome Milestone");
      await Bun.sleep(20);
      await harness.renderOnce();
      await pressEnterAndRender(mockInput, harness);
      await waitForText(harness, "EDIT TOME NOTE");
      await waitForText(harness, "Created your first TOME note.");

      await waitForFileExists(dataPath, 4000);
      await Bun.sleep(1400);
      const raw = await fs.readFile(dataPath, "utf8");
      const savedJson = JSON.parse(raw) as LoadedData;
      expect(savedJson.engagement.achievements.FIRST_TOME_CREATED).toBeDefined();
      expect(savedJson.engagement.achievements.FIRST_TOME_CREATED?.meta?.notePath).toBe(
        "First Tome Milestone.md"
      );
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

  it("edits frontmatter tags in TOME edit context and persists to note metadata", async () => {
    const session = await createSession({
      seedNotes: {
        "Taggable.md": "# Taggable\n\nBody"
      }
    });
    const { harness, notesRoot } = session;
    const { mockInput } = harness;

    try {
      await waitForText(harness, "TASK ONE");
      await pressKeyAndRender(mockInput, harness, "n");
      await waitForText(harness, "TOME: Terminal Oriented Markdown Environment");
      await waitForText(harness, "Taggable.md");

      await pressEnterAndRender(mockInput, harness);
      await waitForText(harness, "PATH: Taggable.md");

      await pressKeyAndRender(mockInput, harness, "e");
      const editFrame = await waitForText(harness, "FRONTMATTER TAGS");
      expect(editFrame).toContain("Tab: switch tags/body");

      await pressTabAndRender(mockInput, harness);
      await mockInput.typeText("work inbox/to-read");
      await Bun.sleep(20);
      await harness.renderOnce();

      await pressCtrlKeyAndRender(mockInput, harness, "s");
      const viewFrame = await waitForText(harness, "PATH: Taggable.md");
      expect(viewFrame).toContain("#inbox/to-read");
      expect(viewFrame).toContain("#work");

      await pressEscapeAndRender(mockInput, harness);
      const listFrame = await waitForText(harness, "Taggable.md");
      expect(listFrame).toContain("#inbox/to-read");
      expect(listFrame).toContain("#work");

      const saved = await fs.readFile(path.join(notesRoot, "Taggable.md"), "utf8");
      expect(saved).toContain("tags: [inbox/to-read, work]");
    } finally {
      await cleanupSession(session);
    }
  });

  it("shows +N overflow chips for TOME tags on narrow widths", async () => {
    const session = await createSession({
      width: 104,
      height: 24,
      seedNotes: {
        "Overflow.md": `---
tags: [one, two, tre, for, fiv]
---

# Overflow

Body`
      }
    });
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await waitForText(harness, "TASK ONE");
      await pressKeyAndRender(mockInput, harness, "n");
      const listFrame = await waitForText(harness, "Overflow.md");
      expect(listFrame).toContain("+3");

      await pressEnterAndRender(mockInput, harness);
      const viewFrame = await waitForText(harness, "PATH: Overflow.md");
      expect(viewFrame).toContain("+3");
      expect(viewFrame).toContain("+2");
    } finally {
      await cleanupSession(session);
    }
  });

  it("renames and deletes a TOME note from list shortcuts and surfaces hints", async () => {
    const session = await createSession({
      hintDisplayMode: "both",
      seedNotes: {
        "Alpha.md": "# Alpha\n\nOne"
      }
    });
    const { harness, notesRoot } = session;
    const { mockInput } = harness;

    try {
      await waitForText(harness, "TASK ONE");
      await pressKeyAndRender(mockInput, harness, "n");
      await waitForText(harness, "TOME: Terminal Oriented Markdown Environment");
      const listFrame = await waitForText(harness, "d: DELETE TOME");
      expect(listFrame).toContain("r/R: RENAME TOME");
      expect(listFrame).toContain("i: REINDEX");
      expect(listFrame).toContain("o: ROOT SETTINGS");

      await pressKeyAndRender(mockInput, harness, "R");
      await waitForText(harness, "RENAME TOME NOTE");
      await mockInput.typeText("Gamma");
      await Bun.sleep(20);
      await harness.renderOnce();
      await pressEnterAndRender(mockInput, harness);
      await waitForText(harness, "Gamma.md");
      await waitForText(harness, "TOME: Terminal Oriented Markdown Environment");

      await waitForFileExists(path.join(notesRoot, "Gamma.md"));
      await waitForFileMissing(path.join(notesRoot, "Alpha.md"));

      await pressKeyAndRender(mockInput, harness, "d");
      await waitForText(harness, "DELETE TOME NOTE? [Y/N/ESC]");
      await pressKeyAndRender(mockInput, harness, "y");
      await waitForText(harness, "No TOME notes found. Press a to create one.");
      await waitForFileMissing(path.join(notesRoot, "Gamma.md"));
    } finally {
      await cleanupSession(session);
    }
  });

  it("seeds default TOME guide docs on empty vault startup", async () => {
    const session = await createSession();
    const { harness, notesRoot } = session;
    const { mockInput } = harness;

    try {
      await waitForText(harness, "TASK ONE");
      const seededPaths = await waitForMarkdownCount(notesRoot, DEFAULT_TOME_GUIDE_PATHS.length);
      expect(seededPaths).toEqual([...DEFAULT_TOME_GUIDE_PATHS].sort((left, right) => left.localeCompare(right)));

      await pressKeyAndRender(mockInput, harness, "n");
      await waitForText(harness, "TOME: Terminal Oriented Markdown Environment");
    } finally {
      await cleanupSession(session);
    }
  });

  it("deletes a TOME note from list via d then y", async () => {
    const session = await createSession();
    const { harness, notesRoot } = session;
    const { mockInput } = harness;

    try {
      await waitForText(harness, "TASK ONE");
      await waitForMarkdownCount(notesRoot, DEFAULT_TOME_GUIDE_PATHS.length);

      await pressKeyAndRender(mockInput, harness, "n");
      await waitForText(harness, "TOME: Terminal Oriented Markdown Environment");
      const beforePaths = await listMarkdownPaths(notesRoot);

      await pressKeyAndRender(mockInput, harness, "d");
      await waitForText(harness, "DELETE TOME NOTE? [Y/N/ESC]");
      await pressKeyAndRender(mockInput, harness, "y");
      await waitForText(harness, "TOME: Terminal Oriented Markdown Environment");

      const afterPaths = await waitForMarkdownCount(notesRoot, beforePaths.length - 1);
      expect(afterPaths.length).toBe(beforePaths.length - 1);
    } finally {
      await cleanupSession(session);
    }
  });

  it("deletes the currently open TOME note from view via d then y and returns to list", async () => {
    const session = await createSession();
    const { harness, notesRoot } = session;
    const { mockInput } = harness;

    try {
      await waitForText(harness, "TASK ONE");
      await waitForMarkdownCount(notesRoot, DEFAULT_TOME_GUIDE_PATHS.length);
      const beforePaths = await listMarkdownPaths(notesRoot);

      await pressKeyAndRender(mockInput, harness, "n");
      await waitForText(harness, "TOME: Terminal Oriented Markdown Environment");
      await pressEnterAndRender(mockInput, harness);
      await waitForFrame(harness, (frame) => frame.includes("MODE:  TOME VIEW"));

      await pressKeyAndRender(mockInput, harness, "d");
      await waitForText(harness, "DELETE TOME NOTE? [Y/N/ESC]");
      await pressKeyAndRender(mockInput, harness, "y");
      await waitForFrame(
        harness,
        (frame) => frame.includes("MODE:  TOME") && !frame.includes("MODE:  TOME VIEW")
      );
      await waitForMarkdownCount(notesRoot, beforePaths.length - 1);
      await pressKeyAndRender(mockInput, harness, "j");
      await pressEnterAndRender(mockInput, harness);
      await waitForFrame(harness, (frame) => frame.includes("MODE:  TOME VIEW"));
    } finally {
      await cleanupSession(session);
    }
  });

  it("hides TOME action chips on narrow widths when hints are left-rail only", async () => {
    const session = await createSession({
      width: 108,
      height: 38,
      seedNotes: {
        "Compact.md": "# Compact\n\n"
      }
    });
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await waitForText(harness, "TASK ONE");
      await pressKeyAndRender(mockInput, harness, "n");
      const frame = await waitForText(harness, "d: DELETE TOME");
      expect(frame).not.toContain("TOME ACTIONS");
    } finally {
      await cleanupSession(session);
    }
  });

  it("hides TOME action chips when hints are left-rail only", async () => {
    const session = await createSession({
      hintDisplayMode: "left_rail",
      seedNotes: {
        "OnlyHints.md": "# Only Hints\n\n"
      }
    });
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await waitForText(harness, "TASK ONE");
      await pressKeyAndRender(mockInput, harness, "n");
      const frame = await waitForText(harness, "d: DELETE TOME");
      expect(frame).not.toContain("TOME ACTIONS");
    } finally {
      await cleanupSession(session);
    }
  });

  it("opens source note from mouse-clicked linked and unlinked mentions", async () => {
    const session = await createSession({
      seedNotes: {
        "Target.md": "# Target\n\nCore note body.",
        "LinkedSource.md": "# Linked Source\n\n[[Target]]",
        "MentionSource.md": "# Mention Source\n\nMentioning Target without link."
      }
    });
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await waitForText(harness, "TASK ONE");
      await pressKeyAndRender(mockInput, harness, "n");
      await waitForText(harness, "TOME: Terminal Oriented Markdown Environment");

      await pressKeyAndRender(mockInput, harness, "/");
      await mockInput.typeText("Target");
      await Bun.sleep(20);
      await harness.renderOnce();
      await pressEnterAndRender(mockInput, harness);
      await pressEnterAndRender(mockInput, harness);
      await waitForText(harness, "PATH: Target.md");
      await waitForText(harness, "LINKED MENTIONS (1)");
      await waitForFrame(harness, (frame) => frame.includes("UNLINKED MENTIONS ("));

      await clickTextUntil(
        harness,
        "LinkedSource.md",
        (frame) => frame.includes("PATH: LinkedSource.md")
      );

      await pressEscapeAndRender(mockInput, harness);
      await waitForText(harness, "TOME: Terminal Oriented Markdown Environment");
      await pressEnterAndRender(mockInput, harness);
      await waitForText(harness, "PATH: Target.md");
      await waitForFrame(harness, (frame) => frame.includes("UNLINKED MENTIONS ("));

      await clickTextUntil(
        harness,
        "MentionSource.md",
        (frame) => frame.includes("PATH: MentionSource.md")
      );
    } finally {
      await cleanupSession(session);
    }
  });

  it("restores missing default guide notes from Help settings action", async () => {
    const session = await createSession();
    const { harness, notesRoot } = session;
    const { mockInput } = harness;

    try {
      await waitForText(harness, "TASK ONE");
      await waitForMarkdownCount(notesRoot, DEFAULT_TOME_GUIDE_PATHS.length);

      const removedPath = DEFAULT_TOME_GUIDE_PATHS[0];
      await fs.rm(path.join(notesRoot, removedPath), { force: true });
      await waitForMarkdownCount(notesRoot, DEFAULT_TOME_GUIDE_PATHS.length - 1);

      await openHelpSettingsFromList(mockInput, harness);
      await focusHelpSettingsItem(mockInput, harness, "▶ Restore TOME Guides");
      await pressEnterAndRender(mockInput, harness);

      await waitForFileExists(path.join(notesRoot, removedPath));
    } finally {
      await cleanupSession(session);
    }
  });

});
