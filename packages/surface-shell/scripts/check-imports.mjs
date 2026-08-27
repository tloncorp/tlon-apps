#!/usr/bin/env node
/**
 * The sandbox boundary, enforced mechanically (plan §9): code in src/ may
 * import only the vendored runtime libraries and itself. The shell runs
 * next to semi-trusted app bundles — anything that leaks app internals
 * into this package is a sandbox-boundary violation, so the forbidden list
 * fails loudly rather than relying on convention.
 *
 * One scoped exception: `zod` (a devDependency) is permitted ONLY in
 * src/protocol/schemas.ts. The protocol schemas are the canonical
 * host-side validators; they are exported for the host and tooling and are
 * never part of the sandbox artifact. Everything the in-sandbox shell
 * itself uses lives in dependency-free modules.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = join(fileURLToPath(import.meta.url), '..', '..');
const srcRoot = join(packageRoot, 'src');

const ALLOWED_EXTERNALS = ['preact', 'htm', 'chart.js'];
const ZOD_ALLOWED_IN = ['protocol/schemas.ts'];
// Modules that must never let the protocol's zod schemas leak into the
// sandbox artifact: everything reachable from the artifact entry.
const SCHEMA_FREE_DIRS = ['artifact', 'harness', 'primitives', 'tokens'];

const FORBIDDEN_HINTS = [
  '@tloncorp/shared',
  '@tloncorp/app',
  '@tloncorp/api',
  '@tloncorp/ui',
  'react-native',
  'expo',
  'tamagui',
  '@tamagui/',
  'react',
  'react-dom',
  '@tanstack/',
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      yield* walk(path);
    } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name)) {
      yield path;
    }
  }
}

const IMPORT_PATTERN =
  /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s*['"]([^'"]+)['"]/gm;

function specifiersOf(source) {
  const specifiers = [];
  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const specifier = match[1] ?? match[2] ?? match[3] ?? match[4];
    if (specifier) {
      specifiers.push(specifier);
    }
  }
  return specifiers;
}

function isAllowedExternal(specifier) {
  return ALLOWED_EXTERNALS.some(
    (allowed) => specifier === allowed || specifier.startsWith(`${allowed}/`)
  );
}

const violations = [];

for (const file of walk(srcRoot)) {
  const relativePath = relative(srcRoot, file).replaceAll('\\', '/');
  const source = readFileSync(file, 'utf8');
  for (const specifier of specifiersOf(source)) {
    if (specifier.startsWith('.') || specifier.startsWith('node:')) {
      // node: builtins only appear in the node/ tooling entry; the sandbox
      // artifact bundle would fail to build if they leaked into it.
      if (specifier.startsWith('node:') && !relativePath.startsWith('node/')) {
        violations.push(
          `${relativePath}: node builtin '${specifier}' outside src/node/`
        );
      }
      // Sandbox code may reach protocol/types and protocol/guards only:
      // the barrel index and schemas.ts pull zod, which must never reach
      // the artifact.
      const reachesZodBearingProtocol =
        specifier.includes('protocol/schemas') ||
        /\/protocol(\/index)?$/.test(specifier) ||
        specifier === './protocol';
      if (
        reachesZodBearingProtocol &&
        SCHEMA_FREE_DIRS.some((dir) => relativePath.startsWith(`${dir}/`))
      ) {
        violations.push(
          `${relativePath}: sandbox code must import protocol/types or protocol/guards, never '${specifier}' (zod stays out of the artifact)`
        );
      }
      continue;
    }
    if (specifier === 'zod') {
      if (!ZOD_ALLOWED_IN.includes(relativePath)) {
        violations.push(
          `${relativePath}: 'zod' is only permitted in ${ZOD_ALLOWED_IN.join(', ')}`
        );
      }
      continue;
    }
    // test files may import the test runner; every other rule still
    // applies to them (a test importing @tloncorp/api would let the
    // mirrored types drift unnoticed)
    if (specifier === 'vitest' && /\.test\.(ts|tsx)$/.test(relativePath)) {
      continue;
    }
    if (isAllowedExternal(specifier)) {
      continue;
    }
    const forbidden = FORBIDDEN_HINTS.find(
      (hint) => specifier === hint || specifier.startsWith(hint)
    );
    violations.push(
      forbidden
        ? `${relativePath}: FORBIDDEN import '${specifier}' crosses the sandbox boundary`
        : `${relativePath}: import '${specifier}' is not in the allowlist (${ALLOWED_EXTERNALS.join(', ')})`
    );
  }
}

if (violations.length > 0) {
  console.error('surface-shell dependency check failed:');
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}
console.log('surface-shell dependency check passed');
