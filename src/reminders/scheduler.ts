import os from "os";
import path from "path";
import { promises as fs } from "fs";
import { spawn, type SpawnOptionsWithoutStdio } from "node:child_process";
import { type TadoiInvocation, buildShellCommandLine } from "./invocation";
import type { ReminderCommandStatus } from "./types";

const MAC_LABEL = "com.tadoi.reminders";
const WINDOWS_TASK_NAME = "TADOI Reminders";
const LINUX_SERVICE_NAME = "tadoi-reminders.service";
const LINUX_TIMER_NAME = "tadoi-reminders.timer";

export type SchedulerCommandDeps = {
  spawnImpl?: (
    command: string,
    args: string[],
    options: SpawnOptionsWithoutStdio
  ) => ReturnType<typeof spawn>;
};

export type SchedulerCommandResult = {
  ok: boolean;
  code: number;
  stdout: string;
  stderr: string;
};

function runCommand(
  command: string,
  args: string[],
  options: { spawnImpl?: SchedulerCommandDeps["spawnImpl"] } = {}
): Promise<SchedulerCommandResult> {
  const spawnImpl = options.spawnImpl ?? spawn;
  return new Promise((resolve, reject) => {
    const child = spawnImpl(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += String(chunk);
    });

    child.once("error", (error) => {
      reject(error);
    });

    child.once("close", (code) => {
      resolve({
        ok: code === 0,
        code: code ?? 1,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
  });
}

function macPlistPath(homeDir = os.homedir()): string {
  return path.join(homeDir, "Library", "LaunchAgents", `${MAC_LABEL}.plist`);
}

function linuxUserSystemdDir(homeDir = os.homedir()): string {
  return path.join(homeDir, ".config", "systemd", "user");
}

export function renderMacPlist(invocation: TadoiInvocation): string {
  const programArgs = [invocation.command, ...invocation.baseArgs, "reminders", "tick"];
  const argXml = programArgs.map((arg) => `    <string>${escapeXml(arg)}</string>`).join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    "<dict>",
    `  <key>Label</key><string>${MAC_LABEL}</string>`,
    "  <key>ProgramArguments</key>",
    "  <array>",
    argXml,
    "  </array>",
    "  <key>RunAtLoad</key><true/>",
    "  <key>StartInterval</key><integer>60</integer>",
    "  <key>StandardOutPath</key><string>/tmp/tadoi-reminders.log</string>",
    "  <key>StandardErrorPath</key><string>/tmp/tadoi-reminders.err.log</string>",
    "</dict>",
    "</plist>",
    ""
  ].join("\n");
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function renderLinuxService(invocation: TadoiInvocation): string {
  const commandLine = buildShellCommandLine(
    [invocation.command, ...invocation.baseArgs, "reminders", "tick"],
    "linux"
  );
  return [
    "[Unit]",
    "Description=TADOI reminders tick",
    "",
    "[Service]",
    "Type=oneshot",
    `ExecStart=/bin/sh -lc ${commandLine}`,
    ""
  ].join("\n");
}

export function renderLinuxTimer(): string {
  return [
    "[Unit]",
    "Description=Run TADOI reminders tick every minute",
    "",
    "[Timer]",
    "OnUnitActiveSec=60",
    "Persistent=true",
    "Unit=tadoi-reminders.service",
    "",
    "[Install]",
    "WantedBy=timers.target",
    ""
  ].join("\n");
}

export function windowsTaskCommandLine(invocation: TadoiInvocation): string {
  return buildShellCommandLine(
    [invocation.command, ...invocation.baseArgs, "reminders", "tick"],
    "win32"
  );
}

function escapePowerShellLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function windowsTaskArguments(invocation: TadoiInvocation): string {
  return buildShellCommandLine([...invocation.baseArgs, "reminders", "tick"], "win32");
}

function parseStatusLine(
  queryOutput: string,
  prefix: "Status:" | "Scheduled Task State:"
): string | undefined {
  const normalizedPrefix = prefix.toLowerCase();
  const lines = queryOutput.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.toLowerCase().startsWith(normalizedPrefix)) {
      continue;
    }
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex < 0) continue;
    const value = trimmed.slice(colonIndex + 1).trim();
    if (value.length > 0) {
      return value;
    }
  }
  return undefined;
}

export function parseWindowsTaskEnabled(queryOutput: string): boolean | undefined {
  const state =
    parseStatusLine(queryOutput, "Status:") ??
    parseStatusLine(queryOutput, "Scheduled Task State:");
  if (!state) {
    return undefined;
  }
  const lowered = state.toLowerCase();
  if (lowered.includes("disabled")) {
    return false;
  }
  if (
    lowered.includes("ready") ||
    lowered.includes("running") ||
    lowered.includes("queued")
  ) {
    return true;
  }
  return undefined;
}

export function renderWindowsInstallScript(invocation: TadoiInvocation): string {
  const execute = escapePowerShellLiteral(invocation.command);
  const argumentsValue = escapePowerShellLiteral(windowsTaskArguments(invocation));
  const taskName = escapePowerShellLiteral(WINDOWS_TASK_NAME);

  return [
    `$action = New-ScheduledTaskAction -Execute '${execute}' -Argument '${argumentsValue}'`,
    "$once = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration ([TimeSpan]::MaxValue)",
    "$logon = New-ScheduledTaskTrigger -AtLogOn",
    "$logon.Repetition = $once.Repetition",
    `Register-ScheduledTask -TaskName '${taskName}' -Action $action -Trigger $logon -Force | Out-Null`
  ].join("; ");
}

export function getReminderInstallCommandsForPlatform(options: {
  platform?: NodeJS.Platform;
} = {}): string[] {
  const platform = options.platform ?? process.platform;
  if (platform === "darwin") {
    return [
      "tadoi reminders install",
      "launchctl print gui/$UID | grep -i tadoi"
    ];
  }
  if (platform === "win32") {
    return [
      "tadoi reminders install",
      "schtasks /Query | findstr /I tadoi"
    ];
  }
  return [
    "tadoi reminders install",
    "systemctl --user status tadoi-reminders.timer"
  ];
}

export async function installReminderScheduler(options: {
  invocation: TadoiInvocation;
  platform?: NodeJS.Platform;
  homeDir?: string;
  spawnImpl?: SchedulerCommandDeps["spawnImpl"];
}): Promise<ReminderCommandStatus> {
  const platform = options.platform ?? process.platform;
  const homeDir = options.homeDir ?? os.homedir();

  if (platform === "darwin") {
    const plistPath = macPlistPath(homeDir);
    await fs.mkdir(path.dirname(plistPath), { recursive: true, mode: 0o700 });
    await fs.writeFile(plistPath, renderMacPlist(options.invocation), {
      encoding: "utf8",
      mode: 0o600
    });

    const uid = process.getuid?.() ?? Number(process.env.UID ?? "0");
    await runCommand("launchctl", ["bootout", `gui/${String(uid)}`, plistPath], {
      spawnImpl: options.spawnImpl
    }).catch(() => ({ ok: false, code: 1, stdout: "", stderr: "" }));
    const bootstrap = await runCommand("launchctl", ["bootstrap", `gui/${String(uid)}`, plistPath], {
      spawnImpl: options.spawnImpl
    });

    return {
      installed: bootstrap.ok,
      enabled: bootstrap.ok,
      details: [
        `plist: ${plistPath}`,
        bootstrap.ok ? "launchctl bootstrap: ok" : `launchctl bootstrap failed: ${bootstrap.stderr || bootstrap.stdout}`
      ]
    };
  }

  if (platform === "win32") {
    const create = await runCommand(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        renderWindowsInstallScript(options.invocation)
      ],
      { spawnImpl: options.spawnImpl }
    );

    return {
      installed: create.ok,
      enabled: create.ok,
      details: [
        `task: ${WINDOWS_TASK_NAME}`,
        `command: ${windowsTaskCommandLine(options.invocation)}`,
        create.ok
          ? "scheduled task create: ok"
          : `scheduled task create failed: ${create.stderr || create.stdout}`
      ]
    };
  }

  const userDir = linuxUserSystemdDir(homeDir);
  const servicePath = path.join(userDir, LINUX_SERVICE_NAME);
  const timerPath = path.join(userDir, LINUX_TIMER_NAME);

  await fs.mkdir(userDir, { recursive: true, mode: 0o700 });
  await fs.writeFile(servicePath, renderLinuxService(options.invocation), {
    encoding: "utf8",
    mode: 0o600
  });
  await fs.writeFile(timerPath, renderLinuxTimer(), {
    encoding: "utf8",
    mode: 0o600
  });

  const daemonReload = await runCommand("systemctl", ["--user", "daemon-reload"], {
    spawnImpl: options.spawnImpl
  });
  if (!daemonReload.ok) {
    return {
      installed: false,
      enabled: false,
      details: [
        `service: ${servicePath}`,
        `timer: ${timerPath}`,
        `systemd unavailable: ${daemonReload.stderr || daemonReload.stdout}`
      ]
    };
  }

  const enableNow = await runCommand(
    "systemctl",
    ["--user", "enable", "--now", LINUX_TIMER_NAME],
    { spawnImpl: options.spawnImpl }
  );

  return {
    installed: enableNow.ok,
    enabled: enableNow.ok,
    details: [
      `service: ${servicePath}`,
      `timer: ${timerPath}`,
      enableNow.ok
        ? "systemctl --user enable --now: ok"
        : `systemctl enable failed: ${enableNow.stderr || enableNow.stdout}`
    ]
  };
}

export async function uninstallReminderScheduler(options: {
  platform?: NodeJS.Platform;
  homeDir?: string;
  spawnImpl?: SchedulerCommandDeps["spawnImpl"];
}): Promise<ReminderCommandStatus> {
  const platform = options.platform ?? process.platform;
  const homeDir = options.homeDir ?? os.homedir();

  if (platform === "darwin") {
    const plistPath = macPlistPath(homeDir);
    const uid = process.getuid?.() ?? Number(process.env.UID ?? "0");
    await runCommand("launchctl", ["bootout", `gui/${String(uid)}`, plistPath], {
      spawnImpl: options.spawnImpl
    }).catch(() => ({ ok: false, code: 1, stdout: "", stderr: "" }));
    await fs.unlink(plistPath).catch(() => undefined);
    return {
      installed: false,
      enabled: false,
      details: [`plist removed: ${plistPath}`]
    };
  }

  if (platform === "win32") {
    await runCommand("schtasks", ["/Delete", "/F", "/TN", WINDOWS_TASK_NAME], {
      spawnImpl: options.spawnImpl
    }).catch(() => ({ ok: false, code: 1, stdout: "", stderr: "" }));
    return {
      installed: false,
      enabled: false,
      details: [`task removed: ${WINDOWS_TASK_NAME}`]
    };
  }

  await runCommand("systemctl", ["--user", "disable", "--now", LINUX_TIMER_NAME], {
    spawnImpl: options.spawnImpl
  }).catch(() => ({ ok: false, code: 1, stdout: "", stderr: "" }));
  const userDir = linuxUserSystemdDir(homeDir);
  const servicePath = path.join(userDir, LINUX_SERVICE_NAME);
  const timerPath = path.join(userDir, LINUX_TIMER_NAME);
  await fs.unlink(servicePath).catch(() => undefined);
  await fs.unlink(timerPath).catch(() => undefined);
  await runCommand("systemctl", ["--user", "daemon-reload"], {
    spawnImpl: options.spawnImpl
  }).catch(() => ({ ok: false, code: 1, stdout: "", stderr: "" }));

  return {
    installed: false,
    enabled: false,
    details: [
      `service removed: ${servicePath}`,
      `timer removed: ${timerPath}`
    ]
  };
}

export async function getReminderSchedulerStatus(options: {
  invocation: TadoiInvocation;
  platform?: NodeJS.Platform;
  homeDir?: string;
  spawnImpl?: SchedulerCommandDeps["spawnImpl"];
}): Promise<ReminderCommandStatus> {
  const platform = options.platform ?? process.platform;
  const homeDir = options.homeDir ?? os.homedir();

  if (platform === "darwin") {
    const plistPath = macPlistPath(homeDir);
    const plistExists = await fs
      .access(plistPath)
      .then(() => true)
      .catch(() => false);
    const uid = process.getuid?.() ?? Number(process.env.UID ?? "0");
    const printResult = plistExists
      ? await runCommand("launchctl", ["print", `gui/${String(uid)}/${MAC_LABEL}`], {
          spawnImpl: options.spawnImpl
        }).catch(() => ({ ok: false, code: 1, stdout: "", stderr: "" }))
      : { ok: false, code: 1, stdout: "", stderr: "" };

    return {
      installed: plistExists,
      enabled: plistExists && printResult.ok,
      details: [
        `plist: ${plistPath}`,
        `command: ${[options.invocation.command, ...options.invocation.baseArgs, "reminders", "tick"].join(" ")}`
      ]
    };
  }

  if (platform === "win32") {
    const query = await runCommand(
      "schtasks",
      ["/Query", "/TN", WINDOWS_TASK_NAME, "/V", "/FO", "LIST"],
      {
        spawnImpl: options.spawnImpl
      }
    ).catch(() => ({ ok: false, code: 1, stdout: "", stderr: "" }));
    const queryOutput = `${query.stdout}\n${query.stderr}`.trim();
    const enabled = query.ok
      ? parseWindowsTaskEnabled(queryOutput) ?? false
      : false;
    const state = parseStatusLine(queryOutput, "Status:") ??
      parseStatusLine(queryOutput, "Scheduled Task State:");

    return {
      installed: query.ok,
      enabled,
      details: [
        `task: ${WINDOWS_TASK_NAME}`,
        `state: ${state ?? "unknown"}`,
        `command: ${windowsTaskCommandLine(options.invocation)}`
      ]
    };
  }

  const userDir = linuxUserSystemdDir(homeDir);
  const servicePath = path.join(userDir, LINUX_SERVICE_NAME);
  const timerPath = path.join(userDir, LINUX_TIMER_NAME);
  const timerExists = await fs
    .access(timerPath)
    .then(() => true)
    .catch(() => false);
  const enabled = timerExists
    ? await runCommand("systemctl", ["--user", "is-enabled", LINUX_TIMER_NAME], {
        spawnImpl: options.spawnImpl
      }).catch(() => ({ ok: false, code: 1, stdout: "", stderr: "" }))
    : { ok: false, code: 1, stdout: "", stderr: "" };

  return {
    installed: timerExists,
    enabled: enabled.ok,
    details: [
      `service: ${servicePath}`,
      `timer: ${timerPath}`,
      enabled.ok ? "systemd user timer enabled" : "systemd user timer not enabled"
    ]
  };
}
