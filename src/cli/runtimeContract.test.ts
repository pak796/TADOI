import { describe, expect, it } from "bun:test";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { loadStateStrict } from "../state/persistence";

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
  it("returns structured payload for list --json", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-cli-list-json-"));
    const dataPath = path.join(tempDir, "tadoi_data.json");
    await runCliProcess(["--data-file", dataPath, "add", "Task A", "#work"]);

    const result = await runCliProcess(["--json", "--data-file", dataPath, "list"]);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      ok: boolean;
      exitCode: number;
      data?: {
        type?: string;
        count?: number;
        tasks?: Array<{ id?: string; title?: string }>;
      };
    };
    expect(parsed.ok).toBe(true);
    expect(parsed.exitCode).toBe(0);
    expect(parsed.data?.type).toBe("tadoi.list.v1");
    expect(parsed.data?.count).toBe(1);
    expect(parsed.data?.tasks?.[0]?.title).toBe("Task A");
  });

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

  it("preserves tasks across repeated cli add commands with strict reload pass", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-cli-repeat-add-"));
    const dataPath = path.join(tempDir, "tadoi_data.json");

    const first = await runCliProcess(["--data-file", dataPath, "add", "Task A"]);
    expect(first.exitCode).toBe(0);

    const second = await runCliProcess(["--data-file", dataPath, "add", "Task B"]);
    expect(second.exitCode).toBe(0);

    const raw = await fs.readFile(dataPath, "utf8");
    const parsed = JSON.parse(raw) as {
      tasks?: Array<{ title?: string; workflowStage?: string }>;
    };
    expect(parsed.tasks).toHaveLength(2);
    expect(parsed.tasks?.map((task) => task.title)).toEqual(["Task A", "Task B"]);
    expect(parsed.tasks?.every((task) => task.workflowStage === "todo")).toBe(true);

    const strict = await loadStateStrict({ filePath: dataPath });
    expect(strict.data.tasks).toHaveLength(2);
    expect(strict.data.tasks.map((task) => task.title)).toEqual(["Task A", "Task B"]);
    expect(strict.data.tasks.every((task) => task.workflowStage === "todo")).toBe(true);

    const files = await fs.readdir(tempDir);
    const hasCorruptBackup = files.some((name) => name.startsWith("tadoi_data.json.corrupt."));
    expect(hasCorruptBackup).toBe(false);
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
    expect(result.stderr).toContain("another tadoi process is editing this data file");
  });

  it("supports selector mode for done", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-cli-done-selector-"));
    const dataPath = path.join(tempDir, "tadoi_data.json");
    await runCliProcess(["--data-file", dataPath, "add", "Task A", "#work"]);
    await runCliProcess(["--data-file", dataPath, "add", "Task B", "#home"]);

    const result = await runCliProcess(["--data-file", dataPath, "done", "+work"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Bulk done applied (1 tasks)");

    const strict = await loadStateStrict({ filePath: dataPath });
    const workTask = strict.data.tasks.find((task) => task.title === "Task A");
    const homeTask = strict.data.tasks.find((task) => task.title === "Task B");
    expect(workTask?.status).toBe("done");
    expect(homeTask?.status).toBe("open");
  });

  it("supports selector mode for due updates", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-cli-due-selector-"));
    const dataPath = path.join(tempDir, "tadoi_data.json");
    await runCliProcess(["--data-file", dataPath, "add", "Task A", "#work"]);

    const setResult = await runCliProcess([
      "--data-file",
      dataPath,
      "due",
      "+work",
      "2026-03-05",
      "at:09:00"
    ]);
    expect(setResult.exitCode).toBe(0);
    expect(setResult.stdout).toContain("Bulk due set (1 tasks)");

    const clearResult = await runCliProcess([
      "--data-file",
      dataPath,
      "due",
      "+work",
      "due:any",
      "clear"
    ]);
    expect(clearResult.exitCode).toBe(0);
    expect(clearResult.stdout).toContain("Bulk due cleared (1 tasks)");
  });

  it("returns target resolution exit code when selector mode matches no tasks", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-cli-selector-none-"));
    const dataPath = path.join(tempDir, "tadoi_data.json");
    await runCliProcess(["--data-file", dataPath, "add", "Task B", "#home"]);

    const result = await runCliProcess(["--data-file", dataPath, "done", "+work"]);
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("no tasks match selector");
  });

  it("returns parse exit code for mixed id and selector mode tokens", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tadoi-cli-selector-mixed-"));
    const dataPath = path.join(tempDir, "tadoi_data.json");
    await runCliProcess(["--data-file", dataPath, "add", "Task A", "#work"]);

    const result = await runCliProcess([
      "--data-file",
      dataPath,
      "done",
      "id:task-a",
      "+work"
    ]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('selector mode does not accept "id:<task-id>" tokens');
  });
});
