import { describe, expect, it } from "bun:test";
import { printHelp, resolveCliRoute, runCli, type CliRunDeps } from "./cli";

describe("resolveCliRoute", () => {
  it("routes portability commands before global flags", () => {
    const route = resolveCliRoute(["export", "--help"]);
    expect(route.kind).toBe("portability");
    if (route.kind !== "portability") return;
    expect(route.command).toBe("export");
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
});

describe("runCli", () => {
  function createDeps() {
    const calls = {
      portability: 0,
      tui: 0,
      smoke: 0,
      help: 0,
      version: 0
    };

    const deps: CliRunDeps = {
      async runPortability() {
        calls.portability += 1;
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
    expect(calls.tui).toBe(0);
    expect(calls.portability).toBe(0);
    expect(calls.smoke).toBe(0);
  });

  it("keeps export --help headless", async () => {
    const { calls, deps } = createDeps();
    const code = await runCli(["export", "--help"], deps);
    expect(code).toBe(0);
    expect(calls.portability).toBe(1);
    expect(calls.tui).toBe(0);
    expect(calls.smoke).toBe(0);
  });

  it("runs smoke mode separately from interactive tui", async () => {
    const { calls, deps } = createDeps();
    const code = await runCli(["--smoke-tui"], deps);
    expect(code).toBe(0);
    expect(calls.smoke).toBe(1);
    expect(calls.tui).toBe(0);
    expect(calls.portability).toBe(0);
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
  });
});
