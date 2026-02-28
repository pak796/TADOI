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

function makeTask(id: string, title: string, nowMs: number): Task {
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

async function createSession(initialData: LoadedData): Promise<AppSession> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-app-bulk-flow-"));
  const settingsPath = path.join(tempDir, "settings.json");
  const harness = await testRender(
    React.createElement(App, {
      initialData,
      skipInitialSave: true,
      showLogo: false,
      settingsPath
    }),
    { width: 150, height: 44 }
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

async function pressKeyAndRender(
  mockInput: MockInput,
  harness: RenderHarness,
  key: string
): Promise<void> {
  await mockInput.pressKeys([key]);
  await Bun.sleep(10);
  await harness.renderOnce();
}

async function pressEnterAndRender(
  mockInput: MockInput,
  harness: RenderHarness
): Promise<void> {
  mockInput.pressEnter();
  await Bun.sleep(10);
  await harness.renderOnce();
}

async function pressEscapeAndRender(
  mockInput: MockInput,
  harness: RenderHarness
): Promise<void> {
  mockInput.pressEscape();
  await Bun.sleep(10);
  await harness.renderOnce();
}

async function typeTextAndRender(
  mockInput: MockInput,
  harness: RenderHarness,
  text: string
): Promise<void> {
  await mockInput.typeText(text);
  await Bun.sleep(20);
  await harness.renderOnce();
}

async function runTitsCommand(harness: RenderHarness, command: string): Promise<string> {
  const { mockInput } = harness;
  await pressKeyAndRender(mockInput, harness, "`");
  await waitForText(harness, "TITS");
  await typeTextAndRender(mockInput, harness, command);
  await pressEnterAndRender(mockInput, harness);
  return waitForFrame(harness, () => true, 2000);
}

describe("App bulk integration", () => {
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

  it("toggles LIST bulk mark state with indicator and HUD", async () => {
    const now = new Date(2026, 1, 26, 12, 0).getTime();
    const session = await createSession(
      makeInitialData([
        makeTask("task-alpha", "Alpha Task", now),
        makeTask("task-beta", "Beta Task", now)
      ])
    );
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await waitForText(harness, "ALPHA TASK");

      await pressKeyAndRender(mockInput, harness, "m");
      let frame = await waitForText(harness, "BULK MARKED: 1 · ` bulk ... · Esc clear");
      expect(frame).toContain("[*]");

      await pressKeyAndRender(mockInput, harness, "m");
      frame = await waitForFrame(harness, (next) => !next.includes("BULK MARKED:"));
      expect(frame).not.toContain("[*]");
    } finally {
      await cleanupSession(session);
    }
  });

  it("rejects marking virtual recurring occurrences with exact v0.1 message", async () => {
    const now = new Date(2026, 1, 26, 12, 0).getTime();
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    start.setHours(9, 0, 0, 0);

    const session = await createSession(
      makeInitialData([
        {
          ...makeTask("series-1", "Daily Series", now),
          recurrence: {
            dtstart: toLocalFloatingIso(start),
            rrule: "FREQ=DAILY;INTERVAL=1",
            series_id: "series:1"
          }
        }
      ])
    );
    const { harness } = session;

    try {
      await waitForText(harness, "DAILY SERIES");
      await pressKeyAndRender(harness.mockInput, harness, "m");
      const frame = await waitForText(
        harness,
        "Bulk selection does not support virtual occurrences (yet)."
      );
      expect(frame).not.toContain("BULK MARKED:");
    } finally {
      await cleanupSession(session);
    }
  });

  it("Esc clears active bulk marks and keeps LIST context", async () => {
    const now = new Date(2026, 1, 26, 12, 0).getTime();
    const session = await createSession(
      makeInitialData([
        makeTask("task-alpha", "Alpha Task", now),
        makeTask("task-beta", "Beta Task", now)
      ])
    );
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await waitForText(harness, "ALPHA TASK");
      await pressKeyAndRender(mockInput, harness, "m");
      await waitForText(harness, "BULK MARKED: 1 · ` bulk ... · Esc clear");

      await pressEscapeAndRender(mockInput, harness);
      const frame = await waitForFrame(
        harness,
        (next) => next.includes("ALPHA TASK") && !next.includes("BULK MARKED:")
      );
      expect(frame).toContain("FOCUS: LIST");
    } finally {
      await cleanupSession(session);
    }
  });

  it("prunes marked ids when search visibility changes and bulk command sees empty set", async () => {
    const now = new Date(2026, 1, 26, 12, 0).getTime();
    const session = await createSession(
      makeInitialData([
        makeTask("task-alpha", "Alpha Task", now),
        makeTask("task-beta", "Beta Task", now)
      ])
    );
    const { harness } = session;
    const { mockInput } = harness;

    try {
      await waitForText(harness, "ALPHA TASK");
      await pressKeyAndRender(mockInput, harness, "m");
      await waitForText(harness, "BULK MARKED: 1 · ` bulk ... · Esc clear");

      await pressKeyAndRender(mockInput, harness, "/");
      await waitForText(harness, "Type to filter tasks and tags; Enter/Esc closes");
      await typeTextAndRender(mockInput, harness, "beta");
      await pressEnterAndRender(mockInput, harness);

      let frame = await waitForText(harness, "BETA TASK");
      expect(frame).not.toContain("BULK MARKED:");

      await runTitsCommand(harness, "bulk done");
      frame = await waitForText(harness, "No tasks marked. Press 'm' to mark tasks first.");
      expect(frame).toContain("No tasks marked. Press 'm' to mark tasks first.");
    } finally {
      await cleanupSession(session);
    }
  });

  it("opens bulk delete confirm modal for in-app marked targets", async () => {
    const now = new Date(2026, 1, 26, 12, 0).getTime();
    const session = await createSession(
      makeInitialData([
        makeTask("task-a", "Delete Target A", now),
        makeTask("task-b", "Delete Target B", now)
      ])
    );
    const { harness } = session;

    try {
      await waitForText(harness, "DELETE TARGET A");
      await pressKeyAndRender(harness.mockInput, harness, "m");
      await waitForText(harness, "BULK MARKED: 1 · ` bulk ... · Esc clear");
      await runTitsCommand(harness, "bulk delete");

      let frame = await waitForText(harness, "DELETE 1 TASKS? [Y/N/ESC]");
      expect(frame).toContain("No recurring series in selection");

      await pressKeyAndRender(harness.mockInput, harness, "n");
      frame = await waitForFrame(harness, (next) => !next.includes("DELETE 1 TASKS? [Y/N/ESC]"));
      expect(frame).toContain("DELETE TARGET A");
    } finally {
      await cleanupSession(session);
    }
  });

  it("opens bulk delete confirm modal for in-app explicit id targets", async () => {
    const now = new Date(2026, 1, 26, 12, 0).getTime();
    const session = await createSession(
      makeInitialData([
        makeTask("task-a", "Delete Target A", now),
        makeTask("task-b", "Delete Target B", now)
      ])
    );
    const { harness } = session;

    try {
      await waitForText(harness, "DELETE TARGET A");
      await runTitsCommand(harness, "bulk:delete id:task-a id:task-b");

      let frame = await waitForText(harness, "DELETE 2 TASKS? [Y/N/ESC]");
      expect(frame).toContain("No recurring series in selection");

      await pressKeyAndRender(harness.mockInput, harness, "n");
      frame = await waitForFrame(harness, (next) => !next.includes("DELETE 2 TASKS? [Y/N/ESC]"));
      expect(frame).toContain("DELETE TARGET A");
    } finally {
      await cleanupSession(session);
    }
  });

  it("blocks bulk delete when marked targets include recurring instances", async () => {
    const now = new Date(2026, 1, 26, 12, 0).getTime();
    const session = await createSession(
      makeInitialData([
        {
          ...makeTask("instance-1", "Materialized Occurrence", now),
          instance_of: {
            series_id: "series:bulk",
            occurrence: "2026-02-26T09:00:00"
          }
        }
      ])
    );
    const { harness } = session;

    try {
      await waitForText(harness, "MATERIALIZED OCCURRENCE");
      await pressKeyAndRender(harness.mockInput, harness, "m");
      await waitForText(harness, "BULK MARKED: 1 · ` bulk ... · Esc clear");

      await runTitsCommand(harness, "bulk delete");
      const frame = await waitForText(
        harness,
        "Bulk delete cannot delete recurring occurrences. Unmark occurrences or delete individually (d)."
      );
      expect(frame).not.toContain("DELETE 1 TASKS? [Y/N/ESC]");
    } finally {
      await cleanupSession(session);
    }
  });
});
