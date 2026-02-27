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
    schemaVersion: 7,
    stateRevision: 0,
    tasks,
    tagIndex: {},
    savedViews: [],
    engagement: createDefaultEngagementState()
  };
}

async function createSession(initialData: LoadedData): Promise<AppSession> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-app-tits-flow-"));
  const settingsPath = path.join(tempDir, "settings.json");
  const harness = await testRender(
    React.createElement(App, {
      initialData,
      skipInitialSave: true,
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
});
