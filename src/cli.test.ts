import { describe, expect, it } from "bun:test";
import { printHelp, resolveCliRoute, runCli, type CliRunDeps } from "./cli";
import { TadoiLockBusyError } from "./state/lockfile";

describe("resolveCliRoute", () => {
  it("routes list before global flags", () => {
    const route = resolveCliRoute(["list", "+work", "--sort", "updated"]);
    expect(route.kind).toBe("list");
    if (route.kind !== "list") return;
    expect(route.args).toEqual(["+work", "--sort", "updated"]);
  });

  it("routes uninstall before global flags", () => {
    const route = resolveCliRoute(["uninstall"]);
    expect(route.kind).toBe("uninstall");
    if (route.kind !== "uninstall") return;
    expect(route.args).toEqual([]);
  });

  it("routes --uninstall alias before global flags", () => {
    const route = resolveCliRoute(["--uninstall"]);
    expect(route.kind).toBe("uninstall");
    if (route.kind !== "uninstall") return;
    expect(route.args).toEqual([]);
  });

  it("routes ls alias to list", () => {
    const route = resolveCliRoute(["ls", "+work"]);
    expect(route.kind).toBe("list");
    if (route.kind !== "list") return;
    expect(route.args).toEqual(["+work"]);
  });

  it("routes l alias to list", () => {
    const route = resolveCliRoute(["l"]);
    expect(route.kind).toBe("list");
    if (route.kind !== "list") return;
    expect(route.args).toEqual([]);
  });

  it("routes reminders before global flags", () => {
    const route = resolveCliRoute(["reminders", "status"]);
    expect(route.kind).toBe("reminders");
    if (route.kind !== "reminders") return;
    expect(route.args).toEqual(["status"]);
  });

  it("routes remind before global flags", () => {
    const route = resolveCliRoute(["remind", "--event", "abc"]);
    expect(route.kind).toBe("remind");
    if (route.kind !== "remind") return;
    expect(route.args).toEqual(["--event", "abc"]);
  });

  it("routes portability commands before global flags", () => {
    const route = resolveCliRoute(["export", "--help"]);
    expect(route.kind).toBe("portability");
    if (route.kind !== "portability") return;
    expect(route.command).toBe("export");
    expect(route.args).toEqual(["--help"]);
  });

  it("routes calendar export before global flags", () => {
    const route = resolveCliRoute(["calendar:export", "--help"]);
    expect(route.kind).toBe("calendar");
    if (route.kind !== "calendar") return;
    expect(route.command).toBe("export");
    expect(route.args).toEqual(["--help"]);
  });

  it("routes calendar import before global flags", () => {
    const route = resolveCliRoute(["calendar:import", "--help"]);
    expect(route.kind).toBe("calendar");
    if (route.kind !== "calendar") return;
    expect(route.command).toBe("import");
    expect(route.args).toEqual(["--help"]);
  });

  it("routes --version without starting tui", () => {
    const route = resolveCliRoute(["--version"]);
    expect(route).toEqual({ kind: "version" });
  });

  it("routes --smoke-tui to smoke mode", () => {
    const route = resolveCliRoute(["--smoke-tui"]);
    expect(route).toEqual({ kind: "smoke_tui" });
  });

  it("routes unknown top-level tokens to unknown", () => {
    const route = resolveCliRoute(["--wat"]);
    expect(route).toEqual({ kind: "unknown", token: "--wat" });
  });
});

describe("runCli", () => {
  function createDeps() {
    const calls = {
      list: 0,
      uninstall: 0,
      portability: 0,
      calendar: 0,
      tui: 0,
      smoke: 0,
      help: 0,
      version: 0,
      seenDataPath: "",
      seenNoColor: ""
    };

    const deps: CliRunDeps = {
      async runList() {
        calls.list += 1;
        return { exitCode: 0 };
      },
      async runUninstall() {
        calls.uninstall += 1;
        return 0;
      },
      async runReminders() {
        return 0;
      },
      async runRemind() {
        return 0;
      },
      async runPortability() {
        calls.portability += 1;
        calls.seenDataPath = process.env.TADOI_DATA_PATH ?? "";
        calls.seenNoColor = process.env.NO_COLOR ?? "";
        return 0;
      },
      async runCalendar() {
        calls.calendar += 1;
        return 0;
      },
      async runInteractiveTui() {
        calls.tui += 1;
      },
      async runSmokeTui() {
        calls.smoke += 1;
        return 0;
      },
      printHelp() {
        calls.help += 1;
      },
      printVersion() {
        calls.version += 1;
      }
    };

    return { calls, deps };
  }

  it("keeps --version headless", async () => {
    const { calls, deps } = createDeps();
    const code = await runCli(["--version"], deps);
    expect(code).toBe(0);
    expect(calls.version).toBe(1);
    expect(calls.list).toBe(0);
    expect(calls.tui).toBe(0);
    expect(calls.portability).toBe(0);
    expect(calls.smoke).toBe(0);
  });

  it("keeps export --help headless", async () => {
    const { calls, deps } = createDeps();
    const code = await runCli(["export", "--help"], deps);
    expect(code).toBe(0);
    expect(calls.portability).toBe(1);
    expect(calls.list).toBe(0);
    expect(calls.calendar).toBe(0);
    expect(calls.tui).toBe(0);
    expect(calls.smoke).toBe(0);
  });

  it("keeps calendar:export --help headless", async () => {
    const { calls, deps } = createDeps();
    const code = await runCli(["calendar:export", "--help"], deps);
    expect(code).toBe(0);
    expect(calls.portability).toBe(0);
    expect(calls.list).toBe(0);
    expect(calls.calendar).toBe(1);
    expect(calls.tui).toBe(0);
    expect(calls.smoke).toBe(0);
  });

  it("keeps calendar:import --help headless", async () => {
    const { calls, deps } = createDeps();
    const code = await runCli(["calendar:import", "--help"], deps);
    expect(code).toBe(0);
    expect(calls.portability).toBe(0);
    expect(calls.list).toBe(0);
    expect(calls.calendar).toBe(1);
    expect(calls.tui).toBe(0);
    expect(calls.smoke).toBe(0);
  });

  it("runs smoke mode separately from interactive tui", async () => {
    const { calls, deps } = createDeps();
    const code = await runCli(["--smoke-tui"], deps);
    expect(code).toBe(0);
    expect(calls.smoke).toBe(1);
    expect(calls.list).toBe(0);
    expect(calls.tui).toBe(0);
    expect(calls.portability).toBe(0);
  });

  it("maps tui lock conflicts to locked exit code", async () => {
    const { calls, deps } = createDeps();
    deps.runInteractiveTui = async () => {
      throw new TadoiLockBusyError("/tmp/tadoi.lock");
    };

    const code = await runCli([], deps);
    expect(code).toBe(4);
    expect(calls.tui).toBe(0);
    expect(calls.list).toBe(0);
    expect(calls.portability).toBe(0);
    expect(calls.calendar).toBe(0);
  });

  it("fails fast for unknown top-level args instead of launching tui", async () => {
    const { calls, deps } = createDeps();
    const code = await runCli(["--wat"], deps);
    expect(code).toBe(2);
    expect(calls.tui).toBe(0);
    expect(calls.list).toBe(0);
    expect(calls.portability).toBe(0);
    expect(calls.calendar).toBe(0);
  });

  it("supports explicit interactive flag", async () => {
    const { calls, deps } = createDeps();
    const code = await runCli(["--interactive"], deps);
    expect(code).toBeUndefined();
    expect(calls.tui).toBe(1);
  });

  it("runs list in headless mode", async () => {
    const { calls, deps } = createDeps();
    const code = await runCli(["list"], deps);
    expect(code).toBe(0);
    expect(calls.list).toBe(1);
    expect(calls.uninstall).toBe(0);
    expect(calls.tui).toBe(0);
    expect(calls.portability).toBe(0);
    expect(calls.calendar).toBe(0);
  });

  it("runs uninstall in headless mode", async () => {
    const { calls, deps } = createDeps();
    const code = await runCli(["uninstall"], deps);
    expect(code).toBe(0);
    expect(calls.uninstall).toBe(1);
    expect(calls.list).toBe(0);
    expect(calls.tui).toBe(0);
  });

  it("runs --uninstall alias in headless mode", async () => {
    const { calls, deps } = createDeps();
    const code = await runCli(["--uninstall"], deps);
    expect(code).toBe(0);
    expect(calls.uninstall).toBe(1);
    expect(calls.list).toBe(0);
    expect(calls.tui).toBe(0);
  });

  it("rejects json mode for interactive route", async () => {
    const { calls, deps } = createDeps();
    const code = await runCli(["--json"], deps);
    expect(code).toBe(2);
    expect(calls.tui).toBe(0);
  });

  it("propagates --no-color into NO_COLOR env for command duration", async () => {
    const { calls, deps } = createDeps();
    const previous = process.env.NO_COLOR;
    delete process.env.NO_COLOR;
    try {
      const code = await runCli(["--no-color", "export", "--help"], deps);
      expect(code).toBe(0);
      expect(calls.seenNoColor).toBe("1");
      expect(process.env.NO_COLOR).toBeUndefined();
    } finally {
      if (previous === undefined) {
        delete process.env.NO_COLOR;
      } else {
        process.env.NO_COLOR = previous;
      }
    }
  });

  it("auto-detects NO_COLOR env without an explicit flag", async () => {
    const { calls, deps } = createDeps();
    const previous = process.env.NO_COLOR;
    process.env.NO_COLOR = "true";
    try {
      const code = await runCli(["export", "--help"], deps);
      expect(code).toBe(0);
      expect(calls.seenNoColor).toBe("true");
    } finally {
      if (previous === undefined) {
        delete process.env.NO_COLOR;
      } else {
        process.env.NO_COLOR = previous;
      }
    }
  });

  it("does not enable NO_COLOR when env is unset and flag absent", async () => {
    const { calls, deps } = createDeps();
    const previous = process.env.NO_COLOR;
    delete process.env.NO_COLOR;
    try {
      const code = await runCli(["export", "--help"], deps);
      expect(code).toBe(0);
      expect(calls.seenNoColor).toBe("");
    } finally {
      if (previous === undefined) {
        delete process.env.NO_COLOR;
      } else {
        process.env.NO_COLOR = previous;
      }
    }
  });

  it("preserves an empty NO_COLOR env value (treated as unset)", async () => {
    const { calls, deps } = createDeps();
    const previous = process.env.NO_COLOR;
    process.env.NO_COLOR = "";
    try {
      const code = await runCli(["export", "--help"], deps);
      expect(code).toBe(0);
      expect(calls.seenNoColor).toBe("");
    } finally {
      if (previous === undefined) {
        delete process.env.NO_COLOR;
      } else {
        process.env.NO_COLOR = previous;
      }
    }
  });

  it("applies --data-file override for the command invocation", async () => {
    const { calls, deps } = createDeps();
    const previous = process.env.TADOI_DATA_PATH;
    process.env.TADOI_DATA_PATH = "/tmp/original-data.json";
    try {
      const code = await runCli(["--data-file", "/tmp/override-data.json", "export", "--help"], deps);
      expect(code).toBe(0);
      expect(calls.seenDataPath).toBe("/tmp/override-data.json");
      expect(process.env.TADOI_DATA_PATH).toBe("/tmp/original-data.json");
    } finally {
      if (previous === undefined) {
        delete process.env.TADOI_DATA_PATH;
      } else {
        process.env.TADOI_DATA_PATH = previous;
      }
    }
  });
});

describe("printHelp", () => {
  it("includes existing packaging smoke tokens", () => {
    const lines: string[] = [];
    const original = console.log;
    console.log = (msg?: unknown) => {
      lines.push(String(msg ?? ""));
    };
    try {
      printHelp(true);
    } finally {
      console.log = original;
    }

    const output = lines.join("\n");
    expect(output).toContain("TADOI");
    expect(output).toContain("Terminal Accessible Digital Organization Interface");
    expect(output).toContain("Usage: tadoi [options]");
    expect(output).toContain("--interactive");
    expect(output).toContain("--uninstall");
    expect(output).toContain("--json");
    expect(output).toContain("--quiet");
    expect(output).toContain("--data-file <path>");
    expect(output).toContain("list");
    expect(output).toContain("uninstall");
    expect(output).toContain("calendar:export");
    expect(output).toContain("calendar:import");
  });
});
