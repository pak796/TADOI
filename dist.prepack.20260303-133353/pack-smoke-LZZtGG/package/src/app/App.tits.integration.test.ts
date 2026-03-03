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
  mockInput.pressEscape();
  await Bun.sleep(10);
  await harness.renderOnce();
  return harness.captureCharFrame();
}

async function pressTabAndRender(
  mockInput: MockInput,
  harness: RenderHarness
): Promise<string> {
  mockInput.pressTab();
  await Bun.sleep(10);
  await harness.renderOnce();
  return harness.captureCharFrame();
}

async function pressArrowAndRender(
  mockInput: MockInput,
  harness: RenderHarness,
  direction: "up" | "down" | "left" | "right"
): Promise<string> {
  mockInput.pressArrow(direction);
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
      frame = await waitForText(harness, "TITS");
      expect(frame).toContain("TASK ONE");

      frame = await pressKeyAndRender(mockInput, harness, "j");
      expect(frame).toContain("TITS");
      expect(frame).toContain(": j");
      expect(frame).toContain("TASK ONE");

      await pressEscapeAndRender(mockInput, harness);
      await waitForTextAbsent(harness, "TITS");

      await pressKeyAndRender(mockInput, harness, "j");
      frame = await waitForText(harness, "TASK TWO");
      expect(frame).toContain("Task Two");

      await pressKeyAndRender(mockInput, harness, "`");
      frame = await waitForText(harness, "TITS");
      expect(frame).toContain("TASK TWO");

      frame = await pressKeyAndRender(mockInput, harness, "k");
      expect(frame).toContain("TITS");
      expect(frame).toContain(": k");
      expect(frame).toContain("TASK TWO");

      await pressEscapeAndRender(mockInput, harness);
      await waitForTextAbsent(harness, "TITS");

      await pressKeyAndRender(mockInput, harness, "k");
      frame = await waitForText(harness, "TASK ONE");
      expect(frame).toContain("Task One");
    } finally {
      await cleanupSession(session);
    }
  });

  it("toggles checklist on a virtual occurrence by materializing an override without EXDATE", async () => {
    const now = Date.now();
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
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
