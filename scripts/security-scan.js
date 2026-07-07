#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXCLUDED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'uploads', 'coverage']);
const EXCLUDED_FILES = new Set(['package-lock.json']);

const SECRET_PATTERNS = [
  { name: 'Google API key', regex: /AIza[0-9A-Za-z\-_]{25,}/g },
  { name: 'OpenAI API key', regex: /sk-[A-Za-z0-9]{20,}/g },
  { name: 'Generic private key', regex: /-----BEGIN (RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----/g },
  { name: 'JWT-like token', regex: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g },
  { name: 'Hardcoded password assignment', regex: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"\n]{10,}['"]/gi },
];

function walk(directory, files = []) {
  fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        walk(path.join(directory, entry.name), files);
      }
      return;
    }

    if (entry.isFile() && !EXCLUDED_FILES.has(entry.name)) {
      files.push(path.join(directory, entry.name));
    }
  });

  return files;
}

function shouldScan(filePath) {
  const relativePath = path.relative(ROOT, filePath).replace(/\\/g, '/');
  if (relativePath === '.env' || relativePath.startsWith('.env.')) {
    return false;
  }

  return /\.(js|json|md|html|css|yml|yaml|env|example|txt)$/i.test(filePath);
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const findings = [];

  SECRET_PATTERNS.forEach((pattern) => {
    const matches = [...content.matchAll(pattern.regex)];
    matches.forEach((match) => {
      const lineNumber = content.slice(0, match.index).split('\n').length;
      const value = match[0];
      if (/replace_with|your_|change_me|example|Password123!/i.test(value)) {
        return;
      }
      findings.push({ filePath, lineNumber, name: pattern.name });
    });
  });

  return findings;
}

const findings = walk(ROOT).filter(shouldScan).flatMap(scanFile);

if (findings.length > 0) {
  console.error('Potential secrets found:');
  findings.forEach((finding) => {
    console.error(`- ${finding.name}: ${path.relative(ROOT, finding.filePath)}:${finding.lineNumber}`);
  });
  process.exit(1);
}

console.log('Security scan passed: no obvious secrets found.');
