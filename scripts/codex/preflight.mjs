#!/usr/bin/env node

import { execFile } from 'node:child_process';
import process from 'node:process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function runGit(args) {
  const { stdout } = await execFileAsync('git', args, { cwd: process.cwd() });
  return stdout.trimEnd();
}

async function main() {
  const repoRoot = await runGit(['rev-parse', '--show-toplevel']);
  const branch = await runGit(['symbolic-ref', '--quiet', '--short', 'HEAD']);
  const status = await runGit(['status', '--short', '--branch']);
  const onProtectedBranch = branch === 'main' || branch === 'master';

  console.log('Codex preflight');
  console.log(`Repo root: ${repoRoot}`);
  console.log(`Branch: ${branch}`);
  console.log(`Protected branch: ${onProtectedBranch ? 'yes' : 'no'}`);
  console.log('');
  console.log('Workspace status:');
  console.log(status || 'clean');
  console.log('');
  console.log('Prompt contract:');
  console.log('- Scope');
  console.log('- Allowed files');
  console.log('- Do not touch');
  console.log('- Validation');
  console.log('- Dataset impact');
  console.log('');
  console.log('Task artifact path: docs/codex/tasks/<date>-<slug>/');
  console.log('Task scaffold: npm run codex:new-task -- --slug <slug> --title "<Title>"');
  console.log('Project memory: docs/ai/01-meta.yaml, 02-system.yaml, 03-structure.yaml, 04-memory.yaml');
  console.log('Vendored skill snapshots: ai/skills/');
  console.log('Vendored skill manager: npm run codex:skills -- <command>');
  console.log('Bootstrap dry run: npm run codex:new-task -- --slug <slug> --title "<Title>" --dry-run');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
