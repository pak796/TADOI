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

type RenderHarness = Awaited<ReturnType<typeof testRender>>;

type AppSession = {
  harness: RenderHarness;
  tempDir: string;
};

const TITS_HEADER_TEXT = "Terminal in Terminal System";

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

function toLocalFloatingIso(date: Date): string {
  const yyyy = String(date.getFullYear()).padStart(4, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`;
}

async function createSession(
  initialData: LoadedData,
  options: { skipInitialSave?: boolean } = {}
): Promise<AppSession> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-app-tits-flow-"));
  const settingsPath = path.join(tempDir, "settings.json");
  await fs.writeFile(
    settingsPath,
    JSON.stringify(
      {
        notifications: {
          enabled: false,
          inAppOverdueBanner: false,
          terminalBellOnOverdue: false,
          bannerDurationMs: 6000,
          bellCooldownMs: 3000
        },
        notes: {
          enabled: false,
          rootPath: null
        }
      },
      null,
      2
    ),
    "utf8"
  );
  const harness = await testRender(
    React.createElement(App, {
      initialData,
      skipInitialSave: options.skipInitialSave ?? true,
      showLogo: false,
      settingsPath
    }),
    { width: 140, height: 40 }
  );
  await harness.renderOnce();
  return { harness, tempDir };
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

async function waitForTextAbsent(
  harness: RenderHarness,
  text: string,
  timeoutMs = 4000
): Promise<string> {
  return waitForFrame(harness, (frame) => !frame.includes(text), timeoutMs);
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

async function readSavedData(pathname: string): Promise<LoadedData> {
  const raw = await fs.readFile(pathname, "utf8");
  return JSON.parse(raw) as LoadedData;
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

async function pressEscapeAndRender(
  mockInput: MockInput,
  harness: RenderHarness
): Promise<string> {
  await Promise.resolve(mockInput.pressEscape());
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

async function typeTextAndRender(
  mockInput: MockInput,
  harness: RenderHarness,
  text: string
): Promise<string> {
  await mockInput.typeText(text);
  await Bun.sleep(20);
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

describe("App TITS integration", () => {
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

  it("opens/closes TITS and suppresses j/k list routing while active", async () => {
    const now = new Date(2026, 1, 26, 12, 0).getTime();
    const session = await createSession(
      makeInitialData([makeTask("task-1", "Task One", now), makeTask("task-2", "Task Two", now)])
    );
    const { harness } = session;
    const { mockInput } = harness;

    try {
      let frame = await waitForText(harness, "TASK ONE");
      expect(frame).toContain("Task One");

      await pressKeyAndRender(mockInput, harness, "`");
      frame = await waitForText(harness, TITS_HEADER_TEXT);
      expect(frame).toContain("TASK ONE");

      frame = await pressKeyAndRender(mockInput, harness, "j");
      expect(frame).toContain(TITS_HEADER_TEXT);
      expect(frame).toContain(": j");
      expect(frame).toContain("TASK ONE");

      await pressEscapeAndRender(mockInput, harness);
      await waitForTextAbsent(harness, TITS_HEADER_TEXT);

      await pressKeyAndRender(mockInput, harness, "j");
      frame = await waitForText(harness, "TASK TWO");
      expect(frame).toContain("Task Two");

      await pressKeyAndRender(mockInput, harness, "`");
      frame = await waitForText(harness, TITS_HEADER_TEXT);
      expect(frame).toContain("TASK TWO");

      frame = await pressKeyAndRender(mockInput, harness, "k");
      expect(frame).toContain(TITS_HEADER_TEXT);
      expect(frame).toContain(": k");
      expect(frame).toContain("TASK TWO");

      await pressEscapeAndRender(mockInput, harness);
      await waitForTextAbsent(harness, TITS_HEADER_TEXT);

      await pressKeyAndRender(mockInput, harness, "k");
      frame = await waitForText(harness, "TASK ONE");
      expect(frame).toContain("Task One");
    } finally {
      await cleanupSession(session);
    }
  });

  it("runs tag rename dry-run without mutating persisted tasks or aliases", async () => {
    const now = new Date(2026, 1, 26, 12, 0).getTime();
    const task: Task = {
      id: "task-tag-dry-run-1",
      title: "Tag rename dry run",
      status: "open",
      workflowStage: "todo",
      createdAt: now - 1000,
      updatedAt: now - 1000,
      tags: ["work"]
    };

    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-app-tits-tag-dry-run-"));
    const dataPath = path.join(dataDir, "tadoi_data.json");
    const originalDataPath = process.env.TADOI_DATA_PATH;
    process.env.TADOI_DATA_PATH = dataPath;

    const session = await createSession(makeInitialData([task]), { skipInitialSave: false });
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await waitForText(harness, "TAG RENAME DRY RUN");
      await waitForFile(dataPath, 4000);
      await Bun.sleep(900);

      await pressKeyAndRender(mockInput, harness, "`");
      await waitForText(harness, TITS_HEADER_TEXT);
      await typeTextAndRender(mockInput, harness, "tag rename work project --dry-run");
      await pressEnterAndRender(mockInput, harness);
      await waitForText(harness, "Dry run: Rename work -> project");

      await Bun.sleep(1100);
      const savedJson = await readSavedData(dataPath);
      const persistedTask = savedJson.tasks.find((candidate) => candidate.id === task.id);
      expect(persistedTask?.tags).toEqual(["work"]);
      expect(savedJson.tagAliases ?? {}).toEqual({});

      const entries = await fs.readdir(dataDir);
      const backupPrefix = `${path.basename(dataPath)}.backup.`;
      expect(entries.some((entry) => entry.startsWith(backupPrefix))).toBe(false);
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

  it("opens tag lifecycle confirm modal and cancels without mutation", async () => {
    const now = new Date(2026, 1, 26, 12, 0).getTime();
    const task: Task = {
      id: "task-tag-cancel-1",
      title: "Tag rename cancel",
      status: "open",
      workflowStage: "todo",
      createdAt: now - 1000,
      updatedAt: now - 1000,
      tags: ["work"]
    };

    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-app-tits-tag-cancel-"));
    const dataPath = path.join(dataDir, "tadoi_data.json");
    const originalDataPath = process.env.TADOI_DATA_PATH;
    process.env.TADOI_DATA_PATH = dataPath;

    const session = await createSession(makeInitialData([task]), { skipInitialSave: false });
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await waitForText(harness, "TAG RENAME CANCEL");
      await waitForFile(dataPath, 4000);
      await Bun.sleep(900);

      await pressKeyAndRender(mockInput, harness, "`");
      await waitForText(harness, TITS_HEADER_TEXT);
      await typeTextAndRender(mockInput, harness, "tag rename work project");
      await pressEnterAndRender(mockInput, harness);
      await waitForText(harness, "APPLY TAG RENAME? [Y/N/ESC]");

      await pressKeyAndRender(mockInput, harness, "n");
      await waitForTextAbsent(harness, "APPLY TAG RENAME? [Y/N/ESC]");

      await Bun.sleep(1100);
      const savedJson = await readSavedData(dataPath);
      const persistedTask = savedJson.tasks.find((candidate) => candidate.id === task.id);
      expect(persistedTask?.tags).toEqual(["work"]);
      expect(savedJson.tagAliases ?? {}).toEqual({});

      const entries = await fs.readdir(dataDir);
      const backupPrefix = `${path.basename(dataPath)}.backup.`;
      expect(entries.some((entry) => entry.startsWith(backupPrefix))).toBe(false);
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

  it("applies tag rename after confirm with backup, rewrite, and alias persistence", async () => {
    const now = new Date(2026, 1, 26, 12, 0).getTime();
    const tasks: Task[] = [
      {
        id: "task-tag-apply-1",
        title: "Tag rename apply one",
        status: "open",
        workflowStage: "todo",
        createdAt: now - 2000,
        updatedAt: now - 2000,
        tags: ["Work", "work"]
      }
    ];

    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-app-tits-tag-apply-"));
    const dataPath = path.join(dataDir, "tadoi_data.json");
    const originalDataPath = process.env.TADOI_DATA_PATH;
    process.env.TADOI_DATA_PATH = dataPath;

    const session = await createSession(makeInitialData(tasks), { skipInitialSave: false });
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await waitForText(harness, "TAG RENAME APPLY ONE");
      await waitForFile(dataPath, 4000);
      await Bun.sleep(900);

      await pressKeyAndRender(mockInput, harness, "`");
      await waitForText(harness, TITS_HEADER_TEXT);
      await typeTextAndRender(mockInput, harness, "tag rename work focus");
      await pressEnterAndRender(mockInput, harness);
      await waitForText(harness, "APPLY TAG RENAME? [Y/N/ESC]");

      await Bun.sleep(120);
      await pressKeyAndRender(mockInput, harness, "y");
      await Bun.sleep(80);
      await pressKeyAndRender(mockInput, harness, "y");
      await Bun.sleep(1300);
      const savedJson = await readSavedData(dataPath);
      const firstTask = savedJson.tasks.find((candidate) => candidate.id === "task-tag-apply-1");
      expect(firstTask?.tags).toEqual(["focus"]);
      expect(savedJson.tagAliases).toEqual({ work: "focus" });

      const entries = await fs.readdir(dataDir);
      const backupPrefix = `${path.basename(dataPath)}.backup.`;
      expect(entries.some((entry) => entry.startsWith(backupPrefix))).toBe(true);
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

  it("applies tag merge after confirm with backup, rewrite, dedupe, and alias persistence", async () => {
    const now = new Date(2026, 1, 26, 12, 0).getTime();
    const tasks: Task[] = [
      {
        id: "task-tag-merge-1",
        title: "Tag merge apply one",
        status: "open",
        workflowStage: "todo",
        createdAt: now - 2000,
        updatedAt: now - 2000,
        tags: ["work", "project", "misc"]
      }
    ];

    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-app-tits-tag-merge-"));
    const dataPath = path.join(dataDir, "tadoi_data.json");
    const originalDataPath = process.env.TADOI_DATA_PATH;
    process.env.TADOI_DATA_PATH = dataPath;

    const session = await createSession(makeInitialData(tasks), { skipInitialSave: false });
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await waitForText(harness, "TAG MERGE APPLY ONE");
      await waitForFile(dataPath, 4000);
      await Bun.sleep(900);

      await pressKeyAndRender(mockInput, harness, "`");
      await waitForText(harness, TITS_HEADER_TEXT);
      await typeTextAndRender(mockInput, harness, "tag merge work,project -> focus");
      await pressEnterAndRender(mockInput, harness);
      await waitForText(harness, "APPLY TAG MERGE? [Y/N/ESC]");

      await Bun.sleep(120);
      await pressKeyAndRender(mockInput, harness, "y");
      await Bun.sleep(80);
      await pressKeyAndRender(mockInput, harness, "y");

      await Bun.sleep(1300);
      const savedJson = await readSavedData(dataPath);
      const firstTask = savedJson.tasks.find((candidate) => candidate.id === "task-tag-merge-1");
      expect(firstTask?.tags).toEqual(["focus", "misc"]);
      expect(savedJson.tagAliases).toEqual({ project: "focus", work: "focus" });

      const entries = await fs.readdir(dataDir);
      const backupPrefix = `${path.basename(dataPath)}.backup.`;
      expect(entries.some((entry) => entry.startsWith(backupPrefix))).toBe(true);
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

  it("emits recurring-created milestone once via TITS recur command", async () => {
    const now = new Date(2026, 1, 26, 12, 0).getTime();
    const dueAt = new Date(2026, 2, 10, 9, 0).getTime();
    const task: Task = {
      id: "task-recur-tits-1",
      title: "Plan recurring from TITS",
      status: "open",
      workflowStage: "todo",
      createdAt: now - 1000,
      updatedAt: now - 1000,
      dueAt,
      hasExplicitTime: true,
      tags: []
    };

    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-app-tits-recur-"));
    const dataPath = path.join(dataDir, "tadoi_data.json");
    const originalDataPath = process.env.TADOI_DATA_PATH;
    process.env.TADOI_DATA_PATH = dataPath;

    const session = await createSession(makeInitialData([task]), { skipInitialSave: false });
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await waitForText(harness, "PLAN RECURRING FROM TITS");

      await pressKeyAndRender(mockInput, harness, "`");
      await waitForText(harness, TITS_HEADER_TEXT);
      await typeTextAndRender(
        mockInput,
        harness,
        "recur id:task-recur-tits-1 every:week interval:1 on:mon"
      );
      await pressEnterAndRender(mockInput, harness);
      await waitForText(harness, "Recurrence set: Plan recurring from TITS -> every week");

      await typeTextAndRender(
        mockInput,
        harness,
        "recur id:task-recur-tits-1 every:week interval:2 on:mon"
      );
      await pressEnterAndRender(mockInput, harness);
      await waitForText(harness, "Recurrence set: Plan recurring from TITS -> every week");

      await pressEscapeAndRender(mockInput, harness);
      await waitForTextAbsent(harness, TITS_HEADER_TEXT);

      await waitForFile(dataPath, 4000);
      await Bun.sleep(1400);
      const raw = await fs.readFile(dataPath, "utf8");
      const savedJson = JSON.parse(raw) as LoadedData;
      const updatedTask = savedJson.tasks.find((candidate) => candidate.id === task.id);
      expect(updatedTask?.recurrence?.interval).toBe(2);
      expect(savedJson.engagement.achievements.FIRST_RECURRING_TASK_CREATED).toBeDefined();
      expect(
        savedJson.engagement.achievements.FIRST_RECURRING_TASK_CREATED?.meta?.seriesId
      ).toBe("series:task-recur-tits-1");
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

  it(
    "emits checklist-created and checklist-fully-completed milestones once via TITS check commands",
    async () => {
      const now = new Date(2026, 1, 26, 12, 0).getTime();
      const task: Task = {
        id: "task-check-milestone-1",
        title: "Checklist milestone from TITS",
        status: "open",
        workflowStage: "todo",
        createdAt: now - 1000,
        updatedAt: now - 1000,
        tags: []
      };

      const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-app-tits-check-"));
      const dataPath = path.join(dataDir, "tadoi_data.json");
      const originalDataPath = process.env.TADOI_DATA_PATH;
      process.env.TADOI_DATA_PATH = dataPath;

      const session = await createSession(makeInitialData([task]), { skipInitialSave: false });
      const { harness } = session;
      const { mockInput } = harness;

      try {
        await waitForText(harness, "CHECKLIST MILESTONE FROM TITS");

        await pressKeyAndRender(mockInput, harness, "`");
        await waitForText(harness, TITS_HEADER_TEXT);
        await typeTextAndRender(mockInput, harness, 'check add @selected "Milestone item one"');
        await pressEnterAndRender(mockInput, harness);
        await waitForText(harness, "Checklist added: Checklist milestone from TITS");

        await typeTextAndRender(mockInput, harness, "check toggle @selected 1");
        await pressEnterAndRender(mockInput, harness);
        await waitForText(harness, "Checklist toggled: Checklist milestone from TITS (#1)");

        await waitForFile(dataPath, 4000);
        await Bun.sleep(1400);
        let raw = await fs.readFile(dataPath, "utf8");
        const afterFirstCompletion = JSON.parse(raw) as LoadedData;
        const firstCreatedAt =
          afterFirstCompletion.engagement.achievements.FIRST_CHECKLIST_CREATED?.unlockedAt;
        const firstCompletedAt =
          afterFirstCompletion.engagement.achievements.FIRST_CHECKLIST_FULLY_COMPLETED
            ?.unlockedAt;
        expect(firstCreatedAt).toBeDefined();
        expect(firstCompletedAt).toBeDefined();

        await typeTextAndRender(mockInput, harness, "check toggle @selected 1");
        await pressEnterAndRender(mockInput, harness);
        await waitForText(harness, "Checklist toggled: Checklist milestone from TITS (#1)");
        await typeTextAndRender(mockInput, harness, "check toggle @selected 1");
        await pressEnterAndRender(mockInput, harness);
        await waitForText(harness, "Checklist toggled: Checklist milestone from TITS (#1)");
        await pressEscapeAndRender(mockInput, harness);
        await waitForTextAbsent(harness, TITS_HEADER_TEXT);

        await Bun.sleep(1400);
        raw = await fs.readFile(dataPath, "utf8");
        const finalSaved = JSON.parse(raw) as LoadedData;
        expect(finalSaved.engagement.achievements.FIRST_CHECKLIST_CREATED?.unlockedAt).toBe(
          firstCreatedAt
        );
        expect(
          finalSaved.engagement.achievements.FIRST_CHECKLIST_FULLY_COMPLETED?.unlockedAt
        ).toBe(firstCompletedAt);
      } finally {
        await cleanupSession(session);
        await fs.rm(dataDir, { recursive: true, force: true });
        if (originalDataPath === undefined) {
          delete process.env.TADOI_DATA_PATH;
        } else {
          process.env.TADOI_DATA_PATH = originalDataPath;
        }
      }
    },
    20_000
  );

  it("toggles checklist on a virtual occurrence by materializing an override without EXDATE", async () => {
    const now = Date.now();
    const start = new Date(now);
    start.setDate(start.getDate() + 1);
    start.setHours(9, 0, 0, 0);
    const createdIso = new Date(now).toISOString();
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-app-checklist-virtual-"));
    const dataPath = path.join(dataDir, "tadoi_data.json");
    const originalDataPath = process.env.TADOI_DATA_PATH;
    process.env.TADOI_DATA_PATH = dataPath;

    const session = await createSession(
      makeInitialData([
        {
          id: "series-1",
          title: "Daily Series",
          status: "open",
          workflowStage: "todo",
          createdAt: now,
          updatedAt: now,
          tags: [],
          recurrence: {
            dtstart: toLocalFloatingIso(start),
            rrule: "FREQ=DAILY;INTERVAL=1",
            series_id: "series:1"
          },
          checklist: [
            {
              id: "item-1",
              text: "Check me",
              isDone: false,
              createdAt: createdIso,
              updatedAt: createdIso,
              sort: 0
            }
          ]
        }
      ]),
      { skipInitialSave: false }
    );
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await waitForText(harness, "DAILY SERIES");
      await pressTabAndRender(mockInput, harness);
      await pressArrowAndRender(mockInput, harness, "right");
      await pressArrowAndRender(mockInput, harness, "right");
      await waitForText(harness, "CHECKLIST");
      await pressKeyAndRender(mockInput, harness, " ");
      await waitForText(harness, "CL 1/1");

      await waitForFile(dataPath, 4000);
      await Bun.sleep(1400);
      const raw = await fs.readFile(dataPath, "utf8");
      const savedJson = JSON.parse(raw) as LoadedData;
      const instance = savedJson.tasks.find((task) => task.instance_of?.series_id === "series:1");
      const seriesTask = savedJson.tasks.find((task) => task.id === "series-1");
      expect(instance).toBeDefined();
      expect(instance?.checklist?.[0]?.isDone).toBe(true);
      expect((seriesTask?.recurrence?.exdates ?? []).includes(instance!.instance_of!.occurrence)).toBe(
        false
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
});
