import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const thisFile = fileURLToPath(import.meta.url);
const packageRoot = path.resolve(path.dirname(thisFile), '..');
const sourceRoot = path.join(packageRoot, 'src');
const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const importSpecifierRegex = /\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const violations = [];

function fileInSource(fullPath) {
  return path.relative(sourceRoot, fullPath).replaceAll(path.sep, '/');
}

function lineForIndex(content, index) {
  return content.slice(0, index).split('\n').length;
}

function checkSpecifier({ file, specifier, line, text }) {
  if (specifier.startsWith('@tloncorp/api/lib/')) {
    violations.push({
      file,
      line,
      text,
      reason: 'consumer boundary: @tloncorp/shared must not import @tloncorp/api/lib/*',
    });
  }

  if (
    specifier === '@tloncorp/api/client' ||
    specifier.startsWith('@tloncorp/api/client/')
  ) {
    violations.push({
      file,
      line,
      text,
      reason: 'consumer boundary: use @tloncorp/api root exports (not @tloncorp/api/client)',
    });
  }
}

function scanDirectory(directoryPath) {
  const entries = readdirSync(directoryPath);
  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') {
        continue;
      }
      scanDirectory(fullPath);
      continue;
    }

    const extension = path.extname(entry);
    if (!allowedExtensions.has(extension)) {
      continue;
    }

    const content = readFileSync(fullPath, 'utf8');
    const file = fileInSource(fullPath);
    const lines = content.split('\n');

    importSpecifierRegex.lastIndex = 0;
    let match;
    while ((match = importSpecifierRegex.exec(content)) !== null) {
      const specifier = match[1] ?? match[2];
      if (!specifier) {
        continue;
      }
      const line = lineForIndex(content, match.index);
      checkSpecifier({
        file: path.join('src', file),
        specifier,
        line,
        text: lines[line - 1]?.trim() ?? specifier,
      });
    }
  }
}

scanDirectory(sourceRoot);

if (violations.length > 0) {
  console.error('Boundary check failed for @tloncorp/shared.');
  for (const violation of violations) {
    console.error(`  ${violation.file}:${violation.line} -> ${violation.reason}`);
    console.error(`    ${violation.text}`);
  }
  process.exit(1);
}

console.log('Boundary check passed for @tloncorp/shared.');
