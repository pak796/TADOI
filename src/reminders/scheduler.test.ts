import { describe, expect, it } from "bun:test";
import {
  parseWindowsTaskEnabled,
  renderLinuxService,
  renderLinuxTimer,
  renderMacPlist,
  renderWindowsInstallScript,
  windowsTaskCommandLine
} from "./scheduler";

describe("scheduler artifacts", () => {
  const invocation = {
    command: "/usr/local/bin/tadoi",
    baseArgs: []
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
      baseArgs: []
    });
    expect(commandLine.toLowerCase()).toContain("tadoi.exe");
    expect(commandLine.toLowerCase()).toContain("reminders");
    expect(commandLine.toLowerCase()).toContain("tick");
  });

  it("renders windows install script with logon trigger and 1-minute repetition", () => {
    const script = renderWindowsInstallScript({
      command: "C:\\Tools\\tadoi.exe",
      baseArgs: []
    });
    expect(script).toContain("New-ScheduledTaskTrigger -AtLogOn");
    expect(script).toContain("RepetitionInterval (New-TimeSpan -Minutes 1)");
    expect(script).toContain("Register-ScheduledTask");
  });

  it("parses windows task enabled state from verbose schtasks output", () => {
    expect(
      parseWindowsTaskEnabled("TaskName: TADOI Reminders\nStatus: Ready")
    ).toBe(true);
    expect(
      parseWindowsTaskEnabled("TaskName: TADOI Reminders\nScheduled Task State: Disabled")
    ).toBe(false);
  });
});
