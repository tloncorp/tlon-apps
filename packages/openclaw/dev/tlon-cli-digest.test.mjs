import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';

import {
  checkCliCurrent,
  collectSourceFiles,
  compareSources,
  sourceDigest,
  writeBuildSidecar,
} from './tlon-cli-digest.mjs';

const REAL_SKILL_DIR = join(
  dirname(new URL(import.meta.url).pathname),
  '..',
  '..',
  'tlon-skill'
);

const roots = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/**
 * A tlon-skill checkout in miniature: compiled sources, a test file next to
 * them, runtime skill data, and a "binary". The shape matters more than the
 * contents — the point of every case below is which of these files moving is
 * allowed to change the verdict.
 */
const BASE = {
  'package.json': '{"name":"@tloncorp/tlon-skill","version":"0.5.0"}\n',
  'scripts/main.ts': 'import "./surface-runtime.ts";\n',
  'scripts/surface-runtime.ts': 'export const publish = () => 1;\n',
  'scripts/commands/surface-show.ts': 'export const show = () => 2;\n',
  'scripts/surface-runtime.test.ts': 'test("publish", () => {});\n',
  'scripts/commands/surface-show.test.ts': 'test("show", () => {});\n',
  'skills/surfaces/SKILL.md': '# surfaces\n',
  'skills/surfaces/PRIMITIVES.md': '## primitives\n',
  'skills/surfaces/templates/poll/app.js': 'render(state);\n',
  'bin/tlon': 'ELF-ish bytes, version 0.5.0-src\n',
  'bin/tlon.js': '#!/usr/bin/env node\n',
};

function skillTree(overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'tlon-cli-digest-test-'));
  roots.push(root);
  write(root, { ...BASE, ...overrides });
  return root;
}

function write(root, files) {
  for (const [path, contents] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, contents);
  }
}

/** A tree that has just been built: sources stamped, binary hashed. */
function built(overrides = {}) {
  const root = skillTree(overrides);
  writeBuildSidecar({
    skillDir: root,
    version: '0.5.0-src',
    target: 'bun-linux-arm64',
    platformArch: 'linux-arm64',
  });
  return root;
}

// ---------------------------------------------------------------------------
// The file set. These are the claims the whole guard rests on, so they are
// asserted directly rather than inferred from a passing check.
// ---------------------------------------------------------------------------

test('the digested set is the compiled sources and package.json, nothing else', () => {
  const files = collectSourceFiles(skillTree());
  assert.deepEqual([...files.keys()].sort(), [
    'package.json',
    'scripts/commands/surface-show.ts',
    'scripts/main.ts',
    'scripts/surface-runtime.ts',
  ]);
});

test('the real tlon-skill checkout digests no test file and no skill data', () => {
  const files = collectSourceFiles(REAL_SKILL_DIR);
  assert.ok(files.size > 1, 'expected the real checkout to have sources');
  assert.ok(files.has('package.json'));
  assert.deepEqual(
    [...files.keys()].filter((path) => path.endsWith('.test.ts')),
    [],
    'no test file may be digested — none is reachable from scripts/main.ts'
  );
  assert.deepEqual(
    [...files.keys()].filter((path) => path.startsWith('skills/')),
    [],
    'skills/ is runtime data read through TLON_SKILL_DIR, not compiled in'
  );
});

// ---------------------------------------------------------------------------
// The positive control. A guard that refuses everything is not a guard, and
// every negative case below would then pass for the wrong reason.
// ---------------------------------------------------------------------------

test('a freshly built tree passes', () => {
  const report = checkCliCurrent({ skillDir: built() });
  assert.equal(report.status, 'current');
  assert.equal(report.ok, true);
  assert.deepEqual(report.failures, []);
});

test('a rebuild after an edit passes again', () => {
  const root = built();
  write(root, { 'scripts/surface-runtime.ts': 'export const publish = 3;\n' });
  assert.equal(checkCliCurrent({ skillDir: root }).ok, false);
  // What a rebuild is: a new binary, and a stamp for it.
  write(root, { 'bin/tlon': 'ELF-ish bytes, rebuilt\n' });
  writeBuildSidecar({
    skillDir: root,
    version: '0.5.0-src',
    target: 'bun-linux-arm64',
    platformArch: 'linux-arm64',
  });
  assert.equal(checkCliCurrent({ skillDir: root }).ok, true);
});

// ---------------------------------------------------------------------------
// The negative controls: a compiled source that moved must be refused BY NAME.
// "Something is stale" sends the reader looking in the wrong place, which is
// the cost the desk preflight was written to stop paying.
// ---------------------------------------------------------------------------

test('an edited compiled source is refused and named', () => {
  const root = built();
  write(root, {
    'scripts/surface-runtime.ts': 'export const publish = () => 99;\n',
  });
  const report = checkCliCurrent({ skillDir: root });
  assert.equal(report.ok, false);
  assert.equal(report.status, 'sources-moved');
  assert.deepEqual(report.comparison.changed, ['scripts/surface-runtime.ts']);
  assert.match(report.failures[0], /scripts\/surface-runtime\.ts/);
  assert.match(
    report.failures[0],
    /TLON_SKILL_FROM_SOURCE=1 dev\/build-local-skill-override\.sh/
  );
});

test('an edited command source is refused and named', () => {
  const root = built();
  write(root, {
    'scripts/commands/surface-show.ts': 'export const show = () => 7;\n',
  });
  const report = checkCliCurrent({ skillDir: root });
  assert.equal(report.status, 'sources-moved');
  assert.deepEqual(report.comparison.changed, [
    'scripts/commands/surface-show.ts',
  ]);
});

test('a source added since the build is refused', () => {
  const root = built();
  write(root, { 'scripts/surface-fork.ts': 'export const fork = () => 4;\n' });
  const report = checkCliCurrent({ skillDir: root });
  assert.equal(report.status, 'sources-moved');
  assert.deepEqual(report.comparison.added, ['scripts/surface-fork.ts']);
});

test('a source deleted since the build is refused', () => {
  const root = built();
  rmSync(join(root, 'scripts/commands/surface-show.ts'));
  const report = checkCliCurrent({ skillDir: root });
  assert.equal(report.status, 'sources-moved');
  assert.deepEqual(report.comparison.removed, [
    'scripts/commands/surface-show.ts',
  ]);
});

test('a version bump is refused — it is stamped into the binary', () => {
  const root = built();
  write(root, {
    'package.json': '{"name":"@tloncorp/tlon-skill","version":"0.5.1"}\n',
  });
  const report = checkCliCurrent({ skillDir: root });
  assert.equal(report.status, 'sources-moved');
  assert.deepEqual(report.comparison.changed, ['package.json']);
});

// ---------------------------------------------------------------------------
// The exclusion controls, which are the ones most likely to be got wrong. A
// guard that demands a rebuild for a template edit gets switched off, and then
// it protects nothing at all.
// ---------------------------------------------------------------------------

test('a template edit does NOT demand a rebuild — templates are read at runtime', () => {
  const root = built();
  write(root, { 'skills/surfaces/templates/poll/app.js': 'render(next);\n' });
  const report = checkCliCurrent({ skillDir: root });
  assert.equal(report.ok, true, report.failures.join('\n'));
  assert.equal(report.status, 'current');
});

test('a PRIMITIVES.md edit does NOT demand a rebuild', () => {
  const root = built();
  write(root, {
    'skills/surfaces/PRIMITIVES.md': '## primitives\n\nnew rule\n',
  });
  assert.equal(checkCliCurrent({ skillDir: root }).ok, true);
});

test('a SKILL.md edit does NOT demand a rebuild', () => {
  const root = built();
  write(root, { 'skills/surfaces/SKILL.md': '# surfaces, revised\n' });
  assert.equal(checkCliCurrent({ skillDir: root }).ok, true);
});

test('a test-file edit does NOT demand a rebuild — no test is compiled in', () => {
  const root = built();
  write(root, {
    'scripts/surface-runtime.test.ts': 'test("publish", () => { ok(); });\n',
    'scripts/commands/surface-show.test.ts': 'test("show", () => { ok(); });\n',
    'scripts/surface-fork.test.ts': 'test("fork", () => {});\n',
  });
  assert.equal(checkCliCurrent({ skillDir: root }).ok, true);
});

// ---------------------------------------------------------------------------
// mtime is not a discriminator. A checkout stamps today's time onto last
// week's bytes; a restore stamps last week's time onto a change.
// ---------------------------------------------------------------------------

test('touching a source without changing it does not demand a rebuild', () => {
  const root = built();
  const future = new Date(Date.now() + 86_400_000);
  utimesSync(join(root, 'scripts/main.ts'), future, future);
  utimesSync(join(root, 'package.json'), future, future);
  assert.equal(checkCliCurrent({ skillDir: root }).ok, true);
});

test('identical contents at different times digest identically', () => {
  const a = skillTree();
  const b = skillTree();
  const old = new Date('2020-01-01T00:00:00Z');
  utimesSync(join(b, 'scripts/main.ts'), old, old);
  assert.equal(
    sourceDigest(collectSourceFiles(a)),
    sourceDigest(collectSourceFiles(b))
  );
});

// ---------------------------------------------------------------------------
// The stamp is a certificate, and a certificate can outlive its artifact.
// ---------------------------------------------------------------------------

test('no stamp at all is refused, naming the rebuild', () => {
  const report = checkCliCurrent({ skillDir: skillTree() });
  assert.equal(report.ok, false);
  assert.equal(report.status, 'no-sidecar');
  assert.match(
    report.failures[0],
    /TLON_SKILL_FROM_SOURCE=1 dev\/build-local-skill-override\.sh/
  );
});

test('a binary replaced under a standing stamp is refused', () => {
  const root = built();
  // What the prebuilt-npm hydrate path does: overwrite bin/tlon, compile
  // nothing. Every source still matches the stamp; the binary does not.
  write(root, { 'bin/tlon': 'prebuilt 0.5.0 from npm\n' });
  const report = checkCliCurrent({ skillDir: root });
  assert.equal(report.ok, false);
  assert.equal(report.status, 'binary-moved');
  assert.match(report.failures[0], /prebuilt/);
});

test('the container-observed binary hash is what the stamp is held to', () => {
  const root = built();
  // The sources and the on-disk binary agree; the CLI the bot actually invokes
  // is a different file. That is the bind mount not being what it is assumed
  // to be, and it must not pass.
  const report = checkCliCurrent({
    skillDir: root,
    observedBinarySha256: 'f'.repeat(64),
  });
  assert.equal(report.ok, false);
  assert.equal(report.status, 'binary-moved');
});

test('an unreadable stamp is refused rather than ignored', () => {
  const root = built();
  write(root, { 'bin/tlon.build.json': 'not json at all' });
  const report = checkCliCurrent({ skillDir: root });
  assert.equal(report.ok, false);
  assert.equal(report.status, 'unreadable-sidecar');
});

test('a stamp from an unknown schema is refused', () => {
  const root = built();
  write(root, { 'bin/tlon.build.json': '{"schema":"something-else/9"}\n' });
  const report = checkCliCurrent({ skillDir: root });
  assert.equal(report.ok, false);
  assert.equal(report.status, 'unknown-schema');
});

test('a missing binary is refused before anything is compared', () => {
  const root = built();
  rmSync(join(root, 'bin/tlon'));
  const report = checkCliCurrent({ skillDir: root });
  assert.equal(report.ok, false);
  assert.equal(report.status, 'no-binary');
});

test('a directory with no sources cannot certify anything', () => {
  const root = mkdtempSync(join(tmpdir(), 'tlon-cli-digest-test-'));
  roots.push(root);
  write(root, { 'package.json': '{}\n' });
  const report = checkCliCurrent({ skillDir: root });
  assert.equal(report.ok, false);
  assert.equal(report.status, 'no-sources');
});

// ---------------------------------------------------------------------------
// compareSources on its own.
// ---------------------------------------------------------------------------

test('compareSources reports each direction separately', () => {
  const recorded = new Map([
    ['a.ts', '1'],
    ['b.ts', '2'],
  ]);
  const actual = new Map([
    ['a.ts', '9'],
    ['c.ts', '3'],
  ]);
  const comparison = compareSources(recorded, actual);
  assert.deepEqual(comparison, {
    added: ['c.ts'],
    removed: ['b.ts'],
    changed: ['a.ts'],
    ok: false,
  });
});
