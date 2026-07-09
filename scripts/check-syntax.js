#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const targetArgs = process.argv.slice(2);
const targets = targetArgs.length > 0 ? targetArgs : ['backend', 'frontend', 'scripts', 'tests'];
const ignoredDirectories = new Set([
  '.git',
  '.github',
  'node_modules',
  'coverage',
  'dist',
  'build',
  'uploads',
]);

function toRelative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function shouldCheck(filePath) {
  const relativePath = toRelative(filePath);
  if (relativePath.startsWith('frontend/public/build/')) {
    return false;
  }

  return filePath.endsWith('.js');
}

function walk(directory, files = []) {
  if (!fs.existsSync(directory)) {
    return files;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        walk(fullPath, files);
      }
      continue;
    }

    if (entry.isFile() && shouldCheck(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

const files = targets
  .flatMap((target) => walk(path.resolve(ROOT, target)))
  .sort((a, b) => toRelative(a).localeCompare(toRelative(b)));

if (files.length === 0) {
  console.log('No JavaScript files found for syntax checks.');
  process.exit(0);
}

const failures = [];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    failures.push({ file, stderr: result.stderr || result.stdout });
  }
}

if (failures.length > 0) {
  console.error('Syntax check failed:');
  for (const failure of failures) {
    console.error(`\n${toRelative(failure.file)}`);
    console.error(failure.stderr.trim());
  }
  process.exit(1);
}

console.log(`Syntax check passed: ${files.length} JavaScript files checked.`);
