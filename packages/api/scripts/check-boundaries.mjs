import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const thisFile = fileURLToPath(import.meta.url);
const packageRoot = path.resolve(path.dirname(thisFile), '..');
const sourceRoot = path.join(packageRoot, 'src');
const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

const violations = [];
const importSpecifierRegex = /\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function fileInSource(fullPath) {
  return path.relative(sourceRoot, fullPath).replaceAll(path.sep, '/');
}

function lineForIndex(content, index) {
  return content.slice(0, index).split('\n').length;
}

function checkInternalBoundaries({ file, specifier, line, text }) {
  const isLibFile = file.startsWith('lib/');
  const isTypesFile = file.startsWith('types/');
  const isUrbitFile = file.startsWith('urbit/');

  if ((isLibFile || isUrbitFile) && specifier.startsWith('../client')) {
    violations.push({
      file: path.join('src', file),
      line,
      text,
      reason: `internal boundary: ${file.split('/')[0]} must not import from client`,
    });
  }

  if (isTypesFile && specifier.startsWith('../client')) {
    violations.push({
      file: path.join('src', file),
      line,
      text,
      reason: 'internal boundary: types must not import from client',
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
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      if (line.includes("'@tloncorp/shared") || line.includes('"@tloncorp/shared')) {
        violations.push({
          file: path.join('src', file),
          line: lineIndex + 1,
          text: line.trim(),
          reason: 'external boundary: @tloncorp/api must not import from @tloncorp/shared',
        });
      }
    }

    importSpecifierRegex.lastIndex = 0;
    let match;
    while ((match = importSpecifierRegex.exec(content)) !== null) {
      const specifier = match[1] ?? match[2];
      if (!specifier) {
        continue;
      }
      const line = lineForIndex(content, match.index);
      checkInternalBoundaries({
        file,
        line,
        specifier,
        text: lines[line - 1]?.trim() ?? specifier,
      });
    }
  }
}

scanDirectory(sourceRoot);

if (violations.length > 0) {
  console.error('Boundary check failed.');
  for (const violation of violations) {
    console.error(`  ${violation.file}:${violation.line} -> ${violation.reason}`);
    console.error(`    ${violation.text}`);
  }
  process.exit(1);
}

console.log('Boundary check passed for @tloncorp/api.');
