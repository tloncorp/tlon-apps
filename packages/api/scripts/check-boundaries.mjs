import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const thisFile = fileURLToPath(import.meta.url);
const packageRoot = path.resolve(path.dirname(thisFile), '..');
const sourceRoot = path.join(packageRoot, 'src');
const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

const violations = [];

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
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (
        line.includes("'@tloncorp/shared") ||
        line.includes('"@tloncorp/shared')
      ) {
        violations.push({
          file: path.relative(packageRoot, fullPath),
          line: i + 1,
          text: line.trim(),
        });
      }
    }
  }
}

scanDirectory(sourceRoot);

if (violations.length > 0) {
  console.error(
    'Boundary check failed: @tloncorp/api must not import from @tloncorp/shared.'
  );
  for (const violation of violations) {
    console.error(
      `  ${violation.file}:${violation.line} -> ${violation.text}`
    );
  }
  process.exit(1);
}

console.log('Boundary check passed for @tloncorp/api.');
