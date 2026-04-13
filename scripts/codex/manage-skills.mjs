#!/usr/bin/env node

import { access, cp, mkdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const vendoredRoot = path.join(repoRoot, 'ai', 'skills');
const manifestPath = path.join(vendoredRoot, 'manifest.json');

function defaultSkillRoot() {
  if (process.env.CODEX_HOME) {
    return path.join(process.env.CODEX_HOME, 'skills');
  }

  return path.join(os.homedir(), '.codex', 'skills');
}

function printUsage() {
  console.error(
    'Usage: node scripts/codex/manage-skills.mjs <list|install|sync-from-source> [--skills a,b] [--target <path>] [--source-root <path>] [--write] [--force]',
  );
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function parseSkillList(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readManifest() {
  const manifestRaw = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestRaw);

  if (!Array.isArray(manifest.skills)) {
    throw new Error(`Invalid manifest: ${manifestPath}`);
  }

  return manifest;
}

function selectSkills(manifest, requestedNames) {
  const available = new Map(
    manifest.skills.map((skill) => [skill.name, skill]),
  );

  if (!requestedNames || requestedNames.length === 0) {
    return manifest.skills;
  }

  return requestedNames.map((name) => {
    const skill = available.get(name);
    if (!skill) {
      throw new Error(`Unknown skill in manifest: ${name}`);
    }
    return skill;
  });
}

async function copyDirectory(sourceDir, targetDir, options) {
  const targetExists = await pathExists(targetDir);

  if (targetExists && !options.force) {
    throw new Error(`Target already exists: ${targetDir}. Re-run with --force.`);
  }

  console.log(`${options.write ? 'WRITE' : 'DRY-RUN'} ${sourceDir} -> ${targetDir}`);

  if (!options.write) {
    return;
  }

  await mkdir(path.dirname(targetDir), { recursive: true });

  if (targetExists) {
    await rm(targetDir, { recursive: true, force: true });
  }

  await cp(sourceDir, targetDir, { recursive: true });
}

async function listSkills(options) {
  const manifest = await readManifest();
  const selected = selectSkills(manifest, options.skills);

  console.log(`Manifest: ${manifestPath}`);
  console.log(`Vendored root: ${vendoredRoot}`);
  console.log(`Skill count: ${selected.length}`);

  for (const skill of selected) {
    console.log(`- ${skill.name}`);
  }
}

async function installSkills(options) {
  const manifest = await readManifest();
  const selected = selectSkills(manifest, options.skills);
  const targetRoot = path.resolve(repoRoot, options.target);

  console.log(`Install target root: ${targetRoot}`);

  if (options.write) {
    await mkdir(targetRoot, { recursive: true });
  }

  for (const skill of selected) {
    const sourceDir = path.join(vendoredRoot, skill.name);
    const targetDir = path.join(targetRoot, skill.name);

    if (!(await pathExists(sourceDir))) {
      throw new Error(`Vendored skill is missing: ${sourceDir}`);
    }

    await copyDirectory(sourceDir, targetDir, options);
  }
}

async function syncFromSource(options) {
  const manifest = await readManifest();
  const selected = selectSkills(manifest, options.skills);
  const sourceRoot = path.resolve(repoRoot, options.sourceRoot);

  console.log(`Source skill root: ${sourceRoot}`);

  for (const skill of selected) {
    const sourceDir = path.join(sourceRoot, skill.name);
    const targetDir = path.join(vendoredRoot, skill.name);

    if (!(await pathExists(sourceDir))) {
      throw new Error(`Source skill is missing: ${sourceDir}`);
    }

    await copyDirectory(sourceDir, targetDir, options);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0];

  if (!command) {
    printUsage();
    throw new Error('A command is required.');
  }

  const options = {
    force: false,
    skills: [],
    sourceRoot: defaultSkillRoot(),
    target: defaultSkillRoot(),
    write: false,
  };

  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case '--skills':
        options.skills = parseSkillList(requireValue(argv, index, arg));
        index += 1;
        break;
      case '--source-root':
        options.sourceRoot = requireValue(argv, index, arg);
        index += 1;
        break;
      case '--target':
        options.target = requireValue(argv, index, arg);
        index += 1;
        break;
      case '--write':
        options.write = true;
        break;
      case '--force':
        options.force = true;
        break;
      case '--dry-run':
        options.write = false;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (command === 'list') {
    await listSkills(options);
    return;
  }

  if (command === 'install') {
    await installSkills(options);
    return;
  }

  if (command === 'sync-from-source') {
    await syncFromSource(options);
    return;
  }

  printUsage();
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
