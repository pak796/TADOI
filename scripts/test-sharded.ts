import path from "node:path";

type ParsedArgs = {
  shardCount: number;
  passthrough: string[];
};

const DEFAULT_SHARD_COUNT = 4;
const MAX_SHARDS = 64;
const TEST_GLOBS = ["src/**/*.test.ts", "scripts/**/*.test.ts"] as const;

function parseArgs(argv: string[]): ParsedArgs {
  const passthrough: string[] = [];
  let shardCountRaw: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--shards") {
      shardCountRaw = argv[index + 1];
      index += 1;
      continue;
    }
    if (token.startsWith("--shards=")) {
      shardCountRaw = token.slice("--shards=".length);
      continue;
    }
    passthrough.push(token);
  }

  const envShardRaw = process.env.TADOI_TEST_SHARDS?.trim();
  const resolvedShardRaw = shardCountRaw ?? envShardRaw;
  const shardCount = resolvedShardRaw
    ? Number.parseInt(resolvedShardRaw, 10)
    : DEFAULT_SHARD_COUNT;

  if (!Number.isFinite(shardCount) || shardCount < 1 || shardCount > MAX_SHARDS) {
    throw new Error(
      `Invalid shard count "${resolvedShardRaw ?? String(shardCount)}"; expected integer 1..${String(MAX_SHARDS)}`
    );
  }

  return {
    shardCount,
    passthrough
  };
}

async function collectTestFiles(): Promise<string[]> {
  const files = new Set<string>();
  for (const pattern of TEST_GLOBS) {
    const glob = new Bun.Glob(pattern);
    for await (const relativePath of glob.scan({ cwd: "." })) {
      files.add(relativePath.replaceAll("\\", "/"));
    }
  }
  return Array.from(files).sort((left, right) => left.localeCompare(right));
}

function shardFiles(files: string[], requestedShards: number): string[][] {
  if (files.length === 0) return [];
  const shardCount = Math.max(1, Math.min(requestedShards, files.length));
  const shards: string[][] = Array.from({ length: shardCount }, () => []);
  for (let index = 0; index < files.length; index += 1) {
    shards[index % shardCount]?.push(files[index] as string);
  }
  return shards.filter((shard) => shard.length > 0);
}

async function runShard(
  shardIndex: number,
  shardTotal: number,
  files: string[],
  passthrough: string[]
): Promise<number> {
  const cwd = path.resolve(".");
  const absoluteFiles = files.map((filePath) => path.resolve(cwd, filePath));
  const label = `[test-sharded] shard ${String(shardIndex + 1)}/${String(shardTotal)} (${String(files.length)} files)`;
  console.log(label);
  const child = Bun.spawn({
    cmd: [process.execPath, "test", ...passthrough, ...absoluteFiles],
    cwd,
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit"
  });
  return await child.exited;
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  const files = await collectTestFiles();

  if (files.length === 0) {
    console.error("[test-sharded] no test files found under src/ or scripts/");
    process.exit(1);
  }

  const shards = shardFiles(files, parsed.shardCount);
  console.log(
    `[test-sharded] running ${String(files.length)} files across ${String(shards.length)} shard(s)`
  );

  for (let index = 0; index < shards.length; index += 1) {
    const shardFilesList = shards[index];
    if (!shardFilesList) continue;
    const exitCode = await runShard(
      index,
      shards.length,
      shardFilesList,
      parsed.passthrough
    );
    if (exitCode !== 0) {
      process.exit(exitCode);
    }
  }
}

if (import.meta.main) {
  main().catch((error) => {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[test-sharded] ${detail}`);
    process.exit(1);
  });
}
