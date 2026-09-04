/**
 * The claims-index validator's own controls.
 *
 * A validator is a guard, so it gets the same treatment every other guard in
 * this project gets: each arm below was written, the pre-fix code was put back
 * by hand, and the arm was watched to FAIL before being kept. A check that
 * passes against the defect it names is worse than no check, because it is
 * cited as evidence.
 *
 * The subject is the real `scripts/check-claims-index.mjs`, copied byte for
 * byte into a throwaway git repository and RUN — not imported, not
 * re-implemented. It reads a fixed path, shells out to git and calls
 * `process.exit`, so a fixture repo is the only way to exercise it as CI
 * exercises it, and it is also the only way to reach the three defects fixed
 * here: a deleted index, a `:0` citation, and a cited test that is present but
 * skipped. Each arm asserts on the exit code and on the words the operator
 * would read.
 *
 * Run: node --test scripts/check-claims-index.test.mjs
 * (`node --test`, with no dependencies, because this runs in `ci-config-check`
 * — the ungated job that has a checkout and node and no install. Same
 * precedent as `packages/openclaw/dev/*.test.mjs`.)
 */

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(here, 'check-claims-index.mjs');
const INDEX = 'surface-channels-claims-index.md';

/** The test the fixture index cites as its control, and it runs. */
const LIVE_TEST_FILE = `import { describe, it } from 'bun:test';

describe('the guard', () => {
  it('refuses when it must', () => {});
});
`;

/** A cited non-test source file, long enough to carry a line citation. */
const SOURCE_FILE = `export function guard() {
  return true;
}
`;

/**
 * The fixture index: a header naming a commit, then rows citing controls.
 * `{{HEAD}}` is replaced with the sha of the commit made BEFORE the index is
 * written, which is what the real document records — the index is stamped at
 * the commit it describes.
 */
function fixtureIndex(rows) {
  return `# Fixture claims index

**Head:** \`{{HEAD}}\`

---

| Claim | Control |
| --- | --- |
${rows.join('\n')}
`;
}

const DEFAULT_ROW =
  '| The guard refuses | `src/guard.test.ts:3` — "refuses when it must" |';

function gitIn(dir, args) {
  return execFileSync(
    'git',
    [
      '-c',
      'user.name=claims-index-test',
      '-c',
      'user.email=claims-index-test@example.com',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
}

/**
 * A throwaway repository holding the real script, some cited files, and the
 * index — built in two commits so the index can record the commit before it,
 * exactly as the real document does.
 *
 * `after` runs once the index is committed and commits again: that is how a
 * cited file "moves after the recorded head", which is the head check's whole
 * subject.
 */
function makeRepo(t, { rows = [DEFAULT_ROW], files = {}, index, after } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'claims-index-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const write = (rel, content) => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), content);
  };

  write('scripts/check-claims-index.mjs', readFileSync(SCRIPT, 'utf8'));
  write('src/guard.test.ts', LIVE_TEST_FILE);
  write('src/guard.ts', SOURCE_FILE);
  for (const [rel, content] of Object.entries(files)) write(rel, content);

  gitIn(dir, ['init', '-q', '-b', 'main']);
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['commit', '-q', '-m', 'base']);
  const head = gitIn(dir, ['rev-parse', 'HEAD']).trim();

  const body = index === undefined ? fixtureIndex(rows) : index;
  if (body !== null) {
    write(INDEX, body.replaceAll('{{HEAD}}', head));
    gitIn(dir, ['add', '-A']);
    gitIn(dir, ['commit', '-q', '-m', 'index']);
  }

  if (after) {
    after(write);
    gitIn(dir, ['add', '-A']);
    gitIn(dir, ['commit', '-q', '-m', 'after']);
  }

  return {
    dir,
    write,
    run() {
      const result = spawnSync(
        process.execPath,
        ['scripts/check-claims-index.mjs'],
        { cwd: dir, encoding: 'utf8' }
      );
      return {
        status: result.status,
        output: `${result.stdout}${result.stderr}`,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// the happy path, which every failing arm below is differential against
// ---------------------------------------------------------------------------

test('a well-formed index passes', (t) => {
  const { run } = makeRepo(t);
  const { status, output } = run();
  assert.equal(status, 0, output);
  assert.match(output, /Claims index OK/);
  assert.match(output, /1 named test\(s\) still exist/);
});

// ---------------------------------------------------------------------------
// fix 1 — a deleted index is not a missing index
// ---------------------------------------------------------------------------

test('a tracked index that has been deleted from disk fails', (t) => {
  const repo = makeRepo(t);
  rmSync(join(repo.dir, INDEX));

  const { status, output } = repo.run();
  assert.equal(status, 1, output);
  assert.match(output, /tracked in this repository but is not on disk/);
  assert.match(output, /deleted/);
});

test('a branch that never had an index still passes, and says so', (t) => {
  const { run } = makeRepo(t, { index: null });
  const { status, output } = run();
  assert.equal(status, 0, output);
  assert.match(output, /git does not track it/);
  assert.match(output, /nothing to check/);
});

// ---------------------------------------------------------------------------
// fix 2 — line numbers
// ---------------------------------------------------------------------------

test('a citation to line 0 fails', (t) => {
  const { run } = makeRepo(t, {
    rows: ['| The guard refuses | `src/guard.ts:0` |'],
  });
  const { status, output } = run();
  assert.equal(status, 1, output);
  assert.match(output, /cites line 0/);
  assert.match(output, /Files start at line 1/);
});

test('a zero inside a range or list fails too', (t) => {
  const { run } = makeRepo(t, {
    rows: ['| The guard refuses | `src/guard.ts:1, 0` |'],
  });
  const { status, output } = run();
  assert.equal(status, 1, output);
  assert.match(output, /cites line 0/);
});

test('an in-range citation passes', (t) => {
  // The differential arm for both line checks: same shape, a line that is
  // really there. Without it the two above are satisfied by a build that
  // rejects every line citation.
  const { run } = makeRepo(t, {
    rows: ['| The guard refuses | `src/guard.ts:1-3` |'],
  });
  const { status, output } = run();
  assert.equal(status, 0, output);
});

// ---------------------------------------------------------------------------
// fix 3 — a cited test that is present but not running
// ---------------------------------------------------------------------------

for (const form of [
  'it.skip',
  'test.skip',
  'it.todo',
  'test.todo',
  'xit',
  'xdescribe',
]) {
  test(`a control cited while silenced with ${form} fails`, (t) => {
    const { run } = makeRepo(t, {
      files: {
        'src/guard.test.ts': `import { describe, it, test } from 'bun:test';

${form}('refuses when it must', () => {});
`,
      },
    });
    const { status, output } = run();
    assert.equal(status, 1, output);
    assert.match(output, /only where it does not run/);
    assert.match(output, /refuses when it must/);
  });
}

test('a control cited while commented out fails', (t) => {
  const { run } = makeRepo(t, {
    files: {
      'src/guard.test.ts': `import { it } from 'bun:test';

// it('refuses when it must', () => {});
it('something else entirely', () => {});
`,
    },
  });
  const { status, output } = run();
  assert.equal(status, 1, output);
  assert.match(output, /only where it does not run/);
});

test('a control cited only from a doc comment fails', (t) => {
  const { run } = makeRepo(t, {
    files: {
      'src/guard.test.ts': `import { it } from 'bun:test';

/**
 * Was "refuses when it must" before the rewrite.
 */
it('something else entirely', () => {});
`,
    },
  });
  const { status, output } = run();
  assert.equal(status, 1, output);
  assert.match(output, /only where it does not run/);
});

test('the same title in a live test passes — the differential arm', (t) => {
  // Both that the arms above are not a build that rejects every cited title,
  // and that a title skipped in one place still counts when it runs in
  // another: the file below has both, and one live occurrence is enough.
  const { run } = makeRepo(t, {
    files: {
      'src/guard.test.ts': `import { it } from 'bun:test';

it.skip('refuses when it must', () => {});
it('refuses when it must', () => {});
`,
    },
  });
  const { status, output } = run();
  assert.equal(status, 0, output);
  assert.match(output, /1 named test\(s\) still exist/);
});

// ---------------------------------------------------------------------------
// the four checks that were already here, still working
// ---------------------------------------------------------------------------

test('check 1: a citation to a file that is not in the tree fails', (t) => {
  const { run } = makeRepo(t, {
    rows: ['| The guard refuses | `src/gone.ts:1` |'],
  });
  const { status, output } = run();
  assert.equal(status, 1, output);
  assert.match(output, /does not exist/);
  assert.match(output, /dead anchor/);
});

test('check 1: a citation past the end of a file fails', (t) => {
  const { run } = makeRepo(t, {
    rows: ['| The guard refuses | `src/guard.ts:900` |'],
  });
  const { status, output } = run();
  assert.equal(status, 1, output);
  assert.match(output, /points past the end/);
});

test('check 2: a cited test that is gone fails', (t) => {
  const { run } = makeRepo(t, {
    files: {
      'src/guard.test.ts': `import { it } from 'bun:test';

it('was renamed at some point', () => {});
`,
    },
  });
  const { status, output } = run();
  assert.equal(status, 1, output);
  assert.match(output, /no longer contains the test/);
});

test('check 3: a header with no recorded head fails', (t) => {
  const { run } = makeRepo(t, {
    index: `# Fixture claims index

---

| Claim | Control |
| --- | --- |
${DEFAULT_ROW}
`,
  });
  const { status, output } = run();
  assert.equal(status, 1, output);
  assert.match(output, /does not record a head/);
});

test('check 3: a recorded head that is not a commit fails', (t) => {
  const { run } = makeRepo(t, {
    index: fixtureIndex([DEFAULT_ROW]).replace('{{HEAD}}', 'deadbeef'),
  });
  const { status, output } = run();
  assert.equal(status, 1, output);
  assert.match(output, /is not a commit in this repository/);
});

test('check 3: a cited SURFACE file moving after the recorded head fails', (t) => {
  const owned = 'packages/tlon-skill/scripts/thing.ts';
  const { run } = makeRepo(t, {
    rows: [DEFAULT_ROW, `| The skill does the thing | \`${owned}:1\` |`],
    files: { [owned]: 'export const thing = 1;\n' },
    after: (write) => write(owned, 'export const thing = 2;\n'),
  });
  const { status, output } = run();
  assert.equal(status, 1, output);
  assert.match(output, /surface file\(s\) the index cites have changed/);
  assert.match(output, /regenerate the index/);
});

test('check 3: a cited file nobody owns moving is reported, not fatal', (t) => {
  // The ownership split, which is the half of check 3 that must NOT fail.
  const { run } = makeRepo(t, {
    rows: [
      DEFAULT_ROW,
      '| Recorded in the decision record | `DECISIONS.md:1` |',
    ],
    files: { 'DECISIONS.md': '# Decisions\n' },
    after: (write) => write('DECISIONS.md', '# Decisions\n\nD1.\n'),
  });
  const { status, output } = run();
  assert.equal(status, 0, output);
  assert.match(output, /may be stale/);
  assert.match(output, /DECISIONS\.md/);
});

test('check 4: a dirty-tree disclaimer in the header fails', (t) => {
  const { run } = makeRepo(t, {
    index: `# Fixture claims index

**Head:** \`{{HEAD}}\`

> Measured against the working tree, not the commit above.

---

| Claim | Control |
| --- | --- |
${DEFAULT_ROW}
`,
  });
  const { status, output } = run();
  assert.equal(status, 1, output);
  assert.match(output, /working tree/);
});
