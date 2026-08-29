#!/usr/bin/env node
// Determinism check (plan §9): building twice from the same tree must
// yield byte-identical artifacts. Also asserts the sandbox artifact
// carries the vendored libraries and no zod.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = join(fileURLToPath(import.meta.url), '..', '..');

function build(outDir) {
  execFileSync('pnpm', ['exec', 'vite', 'build', '--outDir', outDir], {
    cwd: packageRoot,
    stdio: 'pipe',
  });
  const hashes = {};
  for (const name of readdirSync(outDir).sort()) {
    hashes[name] = createHash('sha256')
      .update(readFileSync(join(outDir, name)))
      .digest('hex');
  }
  return hashes;
}

const dirA = mkdtempSync(join(tmpdir(), 'surface-shell-build-a-'));
const dirB = mkdtempSync(join(tmpdir(), 'surface-shell-build-b-'));
try {
  const first = build(dirA);
  const second = build(dirB);

  const names = Object.keys(first);
  if (names.length === 0) {
    console.error('determinism check: build produced no files');
    process.exit(1);
  }
  let failed = false;
  for (const name of new Set([...names, ...Object.keys(second)])) {
    if (first[name] !== second[name]) {
      console.error(
        `determinism check: ${name} differs across builds (${first[name]} vs ${second[name]})`
      );
      failed = true;
    }
  }

  const js = readFileSync(join(dirA, 'surface-shell.js'), 'utf8');
  for (const marker of ['ZodError', 'zod/']) {
    if (js.includes(marker)) {
      console.error(
        `determinism check: artifact contains '${marker}' — zod must not ship in the sandbox`
      );
      failed = true;
    }
  }
  // The sandbox has no `process`, so an unreplaced `process.env` read is a
  // ReferenceError sitting on whatever code path reaches it. Vite's lib
  // mode leaves the substitution to the consumer, and the consumer here is
  // an iframe — the build defines it instead (vite.config.ts), and this is
  // what keeps a newly vendored dependency from reintroducing one.
  if (js.includes('process.env')) {
    console.error(
      'determinism check: artifact reads process.env — there is no `process` in the sandbox'
    );
    failed = true;
  }
  // markers that must survive bundling: the version global (artifact
  // entry), a primitive class (the kit), and the broken-state class (the
  // harness's error boundary). Library names don't survive bundling, so
  // vendored-lib presence is implied by these consumers compiling in.
  for (const marker of [
    '__TLON_SURFACE_SHELL_VERSION',
    'tsh-button',
    'tsh-broken',
    // the sigil is drawn inside the sandbox, not fetched or passed over
    // the bridge, so its symbol data has to be in the artifact
    'tsh-avatar-sigil',
  ]) {
    if (!js.includes(marker)) {
      console.error(
        `determinism check: artifact is missing expected content '${marker}'`
      );
      failed = true;
    }
  }
  // The emitted version must match the source constant. It silently read 0
  // for a while: the emitter regexed the BUILT artifact, minification
  // removed the spaces its pattern required, and a `?? '0'` fallback turned
  // the miss into a plausible-looking number.
  {
    const srcVersion = readFileSync(
      join(packageRoot, 'src', 'version.ts'),
      'utf8'
    ).match(/SHELL_VERSION\s*=\s*(\d+)/)?.[1];
    // artifactStrings is a post-build emit into the real dist, not into
    // the temp dirs this check builds for comparison.
    const emitted = readFileSync(
      join(packageRoot, 'dist', 'artifactStrings.js'),
      'utf8'
    ).match(/shellArtifactVersion = (\d+)/)?.[1];
    if (!srcVersion || emitted !== srcVersion) {
      console.error(
        `determinism check: artifactStrings reports shell version ${emitted}, source says ${srcVersion}`
      );
      failed = true;
    }
  }
  if (js.includes('import(')) {
    console.error(
      'determinism check: artifact contains a dynamic import — the sandbox forbids them'
    );
    failed = true;
  }

  if (failed) {
    process.exit(1);
  }
  console.log(
    `surface-shell deterministic build check passed (${names.join(', ')})`
  );
} finally {
  rmSync(dirA, { recursive: true, force: true });
  rmSync(dirB, { recursive: true, force: true });
}
