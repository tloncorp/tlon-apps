import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const thisFile = fileURLToPath(import.meta.url);
const packageRoot = path.resolve(path.dirname(thisFile), '..');
const sourceRoot = path.join(packageRoot, 'src');
const repoRoot = path.resolve(packageRoot, '..', '..');
const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const movedApiLibModules = new Set([
  'activity',
  'branch',
  'deeplinks',
  'featureFlags',
  'hosting',
  'pinning',
  'references',
  'types',
  'wayfinding',
  'wer',
  'EventEmitter',
  'ProgressManager',
  'blob',
  'formatMemorySize',
  'number',
  'object',
  'spyOn',
  'telemetryFormatters',
  'timeoutSignal',
]);

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

function checkApiExternalBoundaries({ file, specifier, line, text }) {
  if (specifier.startsWith('@tloncorp/shared')) {
    violations.push({
      file: path.join('src', file),
      line,
      text,
      reason: 'external boundary: @tloncorp/api must not import from @tloncorp/shared',
    });
  }
}

function checkDeprecatedConsumerImports({ file, specifier, line, text }) {
  if (specifier === '@tloncorp/api/client') {
    violations.push({
      file,
      line,
      text,
      reason: 'consumer boundary: use @tloncorp/api (not @tloncorp/api/client)',
    });
  }

  if (specifier.startsWith('@tloncorp/api/client/')) {
    violations.push({
      file,
      line,
      text,
      reason: 'consumer boundary: use @tloncorp/api (not deep client subpaths)',
    });
  }

  if (
    specifier === '@tloncorp/api/api' ||
    specifier.startsWith('@tloncorp/api/api/')
  ) {
    violations.push({
      file,
      line,
      text,
      reason: 'consumer boundary: @tloncorp/api/api is deprecated; use @tloncorp/api',
    });
  }

  if (specifier === '@tloncorp/api/types/native') {
    violations.push({
      file,
      line,
      text,
      reason:
        'consumer boundary: @tloncorp/api/types/native moved to @tloncorp/shared/domain/native',
    });
  }

  if (specifier.startsWith('@tloncorp/api/lib/')) {
    const subpath = specifier.replace('@tloncorp/api/lib/', '');
    if (movedApiLibModules.has(subpath)) {
      violations.push({
        file,
        line,
        text,
        reason: `consumer boundary: @tloncorp/api/lib/${subpath} moved to @tloncorp/shared`,
      });
    }
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
      checkInternalBoundaries({
        file,
        line,
        specifier,
        text: lines[line - 1]?.trim() ?? specifier,
      });
      checkApiExternalBoundaries({
        file,
        line,
        specifier,
        text: lines[line - 1]?.trim() ?? specifier,
      });
    }
  }
}

function scanConsumerDirectory(directoryPath) {
  const entries = readdirSync(directoryPath);
  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      if (
        entry === 'node_modules' ||
        entry === 'dist' ||
        entry === '.git' ||
        entry === 'coverage'
      ) {
        continue;
      }
      scanConsumerDirectory(fullPath);
      continue;
    }

    const extension = path.extname(entry);
    if (!allowedExtensions.has(extension)) {
      continue;
    }

    const content = readFileSync(fullPath, 'utf8');
    const file = path.relative(repoRoot, fullPath).replaceAll(path.sep, '/');
    const lines = content.split('\n');

    importSpecifierRegex.lastIndex = 0;
    let match;
    while ((match = importSpecifierRegex.exec(content)) !== null) {
      const specifier = match[1] ?? match[2];
      if (!specifier) {
        continue;
      }
      const line = lineForIndex(content, match.index);
      checkDeprecatedConsumerImports({
        file,
        line,
        specifier,
        text: lines[line - 1]?.trim() ?? specifier,
      });
    }
  }
}

scanDirectory(sourceRoot);
for (const topLevelDir of ['packages', 'apps']) {
  const root = path.join(repoRoot, topLevelDir);
  if (!statSync(root, { throwIfNoEntry: false })) {
    continue;
  }

  scanConsumerDirectory(root);
}

if (violations.length > 0) {
  console.error('Boundary check failed.');
  for (const violation of violations) {
    console.error(`  ${violation.file}:${violation.line} -> ${violation.reason}`);
    console.error(`    ${violation.text}`);
  }
  process.exit(1);
}

console.log('Boundary check passed for @tloncorp/api.');
