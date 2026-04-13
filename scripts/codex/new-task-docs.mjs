#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const templateDir = path.join(repoRoot, 'docs', 'codex', 'templates');
const templateMap = [
  ['feature-spec-template.md', '01-spec.md'],
  ['task-breakdown-template.md', '02-task-breakdown.md'],
  ['implementation-tracker-template.md', '03-implementation-tracker.md'],
  ['change-summary-template.md', '04-change-summary.md'],
  ['session-handoff-template.md', '05-session-handoff.md'],
];

function printUsage() {
  console.error(
    'Usage: node scripts/codex/new-task-docs.mjs --slug <slug> --title "<Title>" [--date YYYY-MM-DD] [--out-root <path>] [--dry-run]',
  );
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function formatLocalDate(date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function fillTemplate(content, replacements) {
  let next = content;

  for (const [token, value] of Object.entries(replacements)) {
    next = next.split(`{{${token}}}`).join(value);
  }

  return next;
}

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const options = {
    slug: '',
    title: '',
    date: formatLocalDate(new Date()),
    outRoot: path.join(repoRoot, 'docs', 'codex', 'tasks'),
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case '--slug':
        options.slug = requireValue(argv, index, arg);
        index += 1;
        break;
      case '--title':
        options.title = requireValue(argv, index, arg);
        index += 1;
        break;
      case '--date':
        options.date = requireValue(argv, index, arg);
        index += 1;
        break;
      case '--out-root':
        options.outRoot = path.resolve(repoRoot, requireValue(argv, index, arg));
        index += 1;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.slug || !options.title) {
    printUsage();
    throw new Error('Both --slug and --title are required.');
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.slug)) {
    throw new Error('Slug must use lowercase letters, numbers, and hyphens only.');
  }

  if (!isValidDateString(options.date)) {
    throw new Error('Date must use YYYY-MM-DD and describe a real calendar date.');
  }

  const targetDir = path.join(options.outRoot, `${options.date}-${options.slug}`);

  if (await pathExists(targetDir)) {
    throw new Error(`Target directory already exists: ${targetDir}`);
  }

  const replacements = {
    TITLE: options.title,
    SLUG: options.slug,
    DATE: options.date,
  };

  const pendingWrites = [];

  for (const [templateName, outputName] of templateMap) {
    const templatePath = path.join(templateDir, templateName);
    const outputPath = path.join(targetDir, outputName);
    const rawTemplate = await readFile(templatePath, 'utf8');
    const filledTemplate = fillTemplate(rawTemplate, replacements);
    pendingWrites.push([outputPath, filledTemplate]);
  }

  if (options.dryRun) {
    console.log(`Dry run. Would create ${targetDir}`);
    for (const [outputPath] of pendingWrites) {
      console.log(`- ${outputPath}`);
    }
    return;
  }

  await mkdir(targetDir, { recursive: true });

  for (const [outputPath, filledTemplate] of pendingWrites) {
    await writeFile(outputPath, filledTemplate, 'utf8');
  }

  console.log(`Created ${targetDir}`);
  for (const [outputPath] of pendingWrites) {
    console.log(`- ${outputPath}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
