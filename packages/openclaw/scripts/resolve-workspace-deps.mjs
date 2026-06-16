#!/usr/bin/env node
// Rewrites workspace:* dependency specs in a package.json to concrete semver
// ranges, mirroring `pnpm publish` substitution. Needed wherever this
// package.json is consumed outside the pnpm workspace: the .publish/ staging
// dir (npm publish does not understand the workspace protocol) and Docker
// containers that mount only this package.
//
// Usage:
//   node resolve-workspace-deps.mjs <path/to/package.json>             # resolve from sibling workspace packages
//   node resolve-workspace-deps.mjs <path/to/package.json> --registry  # resolve from the npm registry (latest)

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , target, mode] = process.argv;
if (!target) {
  console.error(
    'usage: resolve-workspace-deps.mjs <package.json> [--registry]'
  );
  process.exit(1);
}
const useRegistry = mode === '--registry';

// scripts/ -> package root -> packages/
const packagesDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function workspaceVersion(name) {
  for (const entry of readdirSync(packagesDir)) {
    const pkgPath = join(packagesDir, entry, 'package.json');
    if (!existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (pkg.name === name) return pkg.version;
  }
  throw new Error(`workspace package not found: ${name}`);
}

function registryVersion(name) {
  return execFileSync('npm', ['view', name, 'version'], {
    encoding: 'utf8',
  }).trim();
}

const pkg = JSON.parse(readFileSync(target, 'utf8'));
let changed = false;
for (const field of [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
]) {
  const deps = pkg[field];
  if (!deps) continue;
  for (const [name, spec] of Object.entries(deps)) {
    if (typeof spec !== 'string' || !spec.startsWith('workspace:')) continue;
    const inner = spec.slice('workspace:'.length);
    let resolved;
    if (inner === '*' || inner === '^' || inner === '~') {
      const version = useRegistry
        ? registryVersion(name)
        : workspaceVersion(name);
      resolved = inner === '*' ? version : `${inner}${version}`;
    } else {
      // workspace:<explicit range> carries its own semver range
      resolved = inner;
    }
    deps[name] = resolved;
    changed = true;
    console.log(`resolved ${name}: ${spec} -> ${resolved} (${field})`);
  }
}

if (changed) {
  writeFileSync(target, `${JSON.stringify(pkg, null, 2)}\n`);
}
