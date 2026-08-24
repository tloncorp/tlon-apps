#!/usr/bin/env node
// Fails when a runtime dependency uses the workspace: protocol but has no
// published version on the npm registry.
//
// Why this exists: this package.json is consumed outside the pnpm workspace —
// the .publish/ tarball and the upstream openclaw repo's extensions/tlon —
// where workspace: specs get rewritten to registry ranges. A workspace dep
// that was never published (TASK-28's @tloncorp/tlon-kits, which is
// deliberately monorepo-only) resolves to nothing there, and the failure
// shows up as an E404 at install time in someone else's environment. This
// check moves that failure to CI on the PR that adds the dep.
//
// Only `dependencies` is checked: devDependencies never reach installers,
// and monorepo-only packages are fine there (tlon-skill bundles its
// tlon-kits devDep into its binaries at build).
//
// Usage:
//   node scripts/check-publishable-deps.mjs [path/to/package.json ...]
// Defaults to this package's own package.json.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultTarget = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'package.json'
);
const targets = process.argv.slice(2);
if (targets.length === 0) targets.push(defaultTarget);

let failed = false;

for (const target of targets) {
  const pkg = JSON.parse(readFileSync(target, 'utf8'));
  const deps = pkg.dependencies ?? {};
  for (const [name, spec] of Object.entries(deps)) {
    if (!String(spec).startsWith('workspace:')) continue;
    try {
      const version = execFileSync('npm', ['view', name, 'version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
      console.log(`ok: ${name} -> ${version} (${target})`);
    } catch {
      failed = true;
      console.error(
        `FAIL: ${pkg.name} lists "${name}": "${spec}" as a runtime dependency, ` +
          `but it is not on the npm registry. Installers outside this ` +
          `workspace cannot resolve it. Either publish it, or move the ` +
          `shared code into a published package (@tloncorp/api), or make ` +
          `it a devDependency if it is only needed at build time.`
      );
    }
  }
}

process.exit(failed ? 1 : 0);
