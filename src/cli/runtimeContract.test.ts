import { describe, expect, it } from "bun:test";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

type CliRunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

async function runCliProcess(args: string[]): Promise<CliRunResult> {
  const repoRoot = path.resolve(import.meta.dir, "../..");
  const proc = Bun.spawn({
    cmd: [process.execPath, "src/index.tsx", ...args],
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
    env: process.env
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ]);
  return { exitCode, stdout, stderr };
}

describe("runtime CLI contract", () => {
  it("fails fast for unknown top-level args", async () => {
    const result = await runCliProcess(["--wat"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("unknown command or option '--wat'");
  });

  it("handles add --help as non-mutating help", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-cli-help-"));
    const dataPath = path.join(tempDir, "tadoi_data.json");
    const result = await runCliProcess(["--data-file", dataPath, "add", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("add <title>");

    await expect(fs.access(dataPath)).rejects.toThrow();
  });

  it("supports -- delimiter for literal add title tokens", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-cli-delim-"));
    const dataPath = path.join(tempDir, "tadoi_data.json");
    const result = await runCliProcess(["--data-file", dataPath, "add", "--", "--help"]);

    expect(result.exitCode).toBe(0);
    const raw = await fs.readFile(dataPath, "utf8");
    const parsed = JSON.parse(raw) as {
      tasks?: Array<{ title?: string }>;
    };
    expect(parsed.tasks?.[0]?.title).toBe("--help");
  });

  it("returns parse/validation exit code for export missing --out", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-cli-export-"));
    const dataPath = path.join(tempDir, "tadoi_data.json");
    const result = await runCliProcess(["--data-file", dataPath, "export"]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--out is required for export");
  });

  it("returns lock exit code for write commands while lock is present", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-cli-lock-"));
    const dataPath = path.join(tempDir, "tadoi_data.json");
    const lockPath = path.join(tempDir, "tadoi.lock");
    await fs.writeFile(lockPath, "{}", "utf8");

    const result = await runCliProcess(["--data-file", dataPath, "add", "x"]);
    expect(result.exitCode).toBe(4);
    expect(result.stderr).toContain("TADOI is running (lock present)");
  });
});
