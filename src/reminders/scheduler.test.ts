import { describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  installReminderScheduler,
  uninstallReminderScheduler,
  getReminderSchedulerStatus,
  parseWindowsTaskEnabled,
  renderLinuxService,
  renderLinuxTimer,
  renderMacPlist,
  renderWindowsInstallScript,
  windowsTaskCommandLine,
} from "./scheduler";
import type { SchedulerCommandDeps } from "./scheduler";

type ScriptResult = {
  code: number;
  stdout?: string;
  stderr?: string;
};

class MockChildProcess extends EventEmitter {
  public unrefCalled = false;

  unref(): void {
    this.unrefCalled = true;
  }
}

function makeSpawnWithPlan(
  plan: Array<(command: string, args: string[]) => ScriptResult | Error>,
): SchedulerCommandDeps["spawnImpl"] {
  let used = 0;
  return (command, args) => {
    const child = new MockChildProcess();
    const entry = plan[used];
    used += 1;

    const emitExit = (code: number) => {
      child.emit("spawn");
      queueMicrotask(() => {
        child.emit("close", code);
      });
    };

    if (!entry) {
      emitExit(0);
      return child;
    }
    const result = entry(command, args);
    if (result instanceof Error) {
      queueMicrotask(() => child.emit("error", result));
      return child;
    }

    queueMicrotask(() => {
      emitExit(result.code);
    });
    return child;
  };
}

async function makeTempHome(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "tadoi-reminders-scheduler-"));
}

function linuxSchedulerPaths(homeDir: string): {
  servicePath: string;
  timerPath: string;
} {
  const userDir = path.join(homeDir, ".config", "systemd", "user");
  return {
    servicePath: path.join(userDir, "tadoi-reminders.service"),
    timerPath: path.join(userDir, "tadoi-reminders.timer"),
  };
}

describe("scheduler artifacts", () => {
  const invocation = {
    command: "/usr/local/bin/tadoi",
    baseArgs: [],
  };

  it("renders mac launch agent plist with 60s interval and tick command", () => {
    const plist = renderMacPlist(invocation);
    expect(plist).toContain("<key>StartInterval</key><integer>60</integer>");
    expect(plist).toContain("<string>/usr/local/bin/tadoi</string>");
    expect(plist).toContain("<string>reminders</string>");
    expect(plist).toContain("<string>tick</string>");
  });

  it("renders linux service and timer contracts", () => {
    const service = renderLinuxService(invocation);
    const timer = renderLinuxTimer();

    expect(service).toContain("ExecStart=/bin/sh -lc");
    expect(service).toContain("reminders");
    expect(service).toContain("tick");
    expect(timer).toContain("OnUnitActiveSec=60");
    expect(timer).toContain("Persistent=true");
  });

  it("renders windows task command line for reminders tick", () => {
    const commandLine = windowsTaskCommandLine({
      command: "C:\\Tools\\tadoi.exe",
      baseArgs: [],
    });
    expect(commandLine.toLowerCase()).toContain("tadoi.exe");
    expect(commandLine.toLowerCase()).toContain("reminders");
    expect(commandLine.toLowerCase()).toContain("tick");
  });

  it("renders windows install script with logon trigger and 1-minute repetition", () => {
    const script = renderWindowsInstallScript({
      command: "C:\\Tools\\tadoi.exe",
      baseArgs: [],
    });
    expect(script).toContain("New-ScheduledTaskTrigger -AtLogOn");
    expect(script).toContain("RepetitionInterval (New-TimeSpan -Minutes 1)");
    expect(script).toContain("Register-ScheduledTask");
  });

  it("parses windows task enabled state from verbose schtasks output", () => {
    expect(
      parseWindowsTaskEnabled("TaskName: TADOI Reminders\nStatus: Ready"),
    ).toBe(true);
    expect(
      parseWindowsTaskEnabled(
        "TaskName: TADOI Reminders\nScheduled Task State: Disabled",
      ),
    ).toBe(false);
  });

  it("does not write linux timer/service when systemd is unavailable", async () => {
    const homeDir = await makeTempHome();
    const { servicePath, timerPath } = linuxSchedulerPaths(homeDir);

    const status = await installReminderScheduler({
      platform: "linux",
      homeDir,
      invocation: {
        command: "/usr/local/bin/tadoi",
        baseArgs: [],
      },
      spawnImpl: makeSpawnWithPlan([
        (command, args) =>
          command === "systemctl" &&
          args.join(" ") === "--user is-system-running"
            ? { code: 1, stderr: "systemctl unavailable" }
            : { code: 0 },
      ]),
    });

    expect(status.installed).toBe(false);
    expect(
      status.details.some((line) => line.includes("systemctl unavailable")),
    ).toBe(true);

    await expect(fs.access(servicePath)).rejects.toThrow();
    await expect(fs.access(timerPath)).rejects.toThrow();
  });

  it("includes exit code when linux pre-flight command fails without output", async () => {
    const status = await installReminderScheduler({
      platform: "linux",
      homeDir: await makeTempHome(),
      invocation: {
        command: "/usr/local/bin/tadoi",
        baseArgs: [],
      },
      spawnImpl: makeSpawnWithPlan([
        (command, args) =>
          command === "systemctl" &&
          args.join(" ") === "--user is-system-running"
            ? { code: 1 }
            : { code: 0 },
      ]),
    });

    expect(status.installed).toBe(false);
    expect(status.details).toContain(
      "systemctl unavailable: command failed with exit code 1",
    );
  });

  it("rolls back linux install files when daemon-reload fails", async () => {
    const homeDir = await makeTempHome();
    const { servicePath, timerPath } = linuxSchedulerPaths(homeDir);
    const status = await installReminderScheduler({
      platform: "linux",
      homeDir,
      invocation: {
        command: "/usr/local/bin/tadoi",
        baseArgs: [],
      },
      spawnImpl: makeSpawnWithPlan([
        (command, args) =>
          command === "systemctl" &&
          args.join(" ") === "--user is-system-running"
            ? { code: 0 }
            : { code: 0 },
        (command, args) =>
          command === "systemctl" && args.join(" ") === "--user daemon-reload"
            ? { code: 1, stderr: "daemon-reload failed" }
            : { code: 0 },
      ]),
    });

    expect(status.installed).toBe(false);
    expect(status.details).toContain("rollback attempted");

    await expect(fs.access(servicePath)).rejects.toThrow();
    await expect(fs.access(timerPath)).rejects.toThrow();
  });

  it("rolls back linux install files when timer enable fails", async () => {
    const homeDir = await makeTempHome();
    const { servicePath, timerPath } = linuxSchedulerPaths(homeDir);
    const status = await installReminderScheduler({
      platform: "linux",
      homeDir,
      invocation: {
        command: "/usr/local/bin/tadoi",
        baseArgs: [],
      },
      spawnImpl: makeSpawnWithPlan([
        (command, args) =>
          command === "systemctl" &&
          args.join(" ") === "--user is-system-running"
            ? { code: 0 }
            : { code: 0 },
        (command, args) =>
          command === "systemctl" && args.join(" ") === "--user daemon-reload"
            ? { code: 0 }
            : { code: 0 },
        () => ({ code: 1, stderr: "timer enable failed" }),
      ]),
    });

    expect(status.installed).toBe(false);
    expect(status.enabled).toBe(false);
    expect(status.details).toContain("rollback attempted");
    await expect(fs.access(servicePath)).rejects.toThrow();
    await expect(fs.access(timerPath)).rejects.toThrow();
  });

  it("returns linux installed=true only when timer file exists and is-enabled succeeds", async () => {
    const homeDir = await makeTempHome();
    const userDir = path.join(homeDir, ".config", "systemd", "user");
    await fs.mkdir(userDir, { recursive: true });
    await fs.writeFile(path.join(userDir, "tadoi-reminders.timer"), "timer");

    const status = await getReminderSchedulerStatus({
      platform: "linux",
      homeDir,
      invocation: {
        command: "/usr/local/bin/tadoi",
        baseArgs: [],
      },
      spawnImpl: makeSpawnWithPlan([
        (command, args) =>
          command === "systemctl" &&
          args.join(" ") === "--user is-system-running"
            ? { code: 0 }
            : { code: 0 },
        (command, args) =>
          command === "systemctl" &&
          args.join(" ") === "--user is-enabled tadoi-reminders.timer"
            ? { code: 0 }
            : { code: 0 },
      ]),
    });

    expect(status.installed).toBe(true);
    expect(status.enabled).toBe(true);
  });

  it("returns linux installed=false when timer file is missing even if systemctl appears enabled", async () => {
    const homeDir = await makeTempHome();

    const status = await getReminderSchedulerStatus({
      platform: "linux",
      homeDir,
      invocation: {
        command: "/usr/local/bin/tadoi",
        baseArgs: [],
      },
      spawnImpl: makeSpawnWithPlan([
        (command, args) =>
          command === "systemctl" &&
          args.join(" ") === "--user is-system-running"
            ? { code: 0 }
            : { code: 0 },
        (command, args) =>
          command === "systemctl" &&
          args.join(" ") === "--user is-enabled tadoi-reminders.timer"
            ? { code: 0 }
            : { code: 0 },
      ]),
    });

    expect(status.installed).toBe(false);
    expect(status.enabled).toBe(false);
  });

  it("surfaces mac uninstall bootout failure details", async () => {
    const homeDir = await makeTempHome();
    const status = await uninstallReminderScheduler({
      platform: "darwin",
      homeDir,
      spawnImpl: makeSpawnWithPlan([
        () => ({ code: 1, stderr: "bootout permission denied" }),
      ]),
    });

    expect(status.installed).toBe(false);
    expect(status.enabled).toBe(false);
    expect(
      status.details.some((line) =>
        line.startsWith("launchctl bootout failed:"),
      ),
    ).toBe(true);
  });

  it("surfaces windows uninstall command failure details", async () => {
    const status = await uninstallReminderScheduler({
      platform: "win32",
      spawnImpl: makeSpawnWithPlan([
        () => ({ code: 1, stderr: "task not found" }),
      ]),
    });

    expect(status.installed).toBe(false);
    expect(status.enabled).toBe(false);
    expect(
      status.details.some((line) => line.startsWith("schtasks delete failed:")),
    ).toBe(true);
  });
});
