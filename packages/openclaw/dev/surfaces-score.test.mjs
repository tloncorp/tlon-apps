import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildScoreboard,
  compareToBaseline,
  loadCorpus,
  readTranscript,
  scoreRequest,
} from './surfaces-score.mjs';

/**
 * The eval harness's own tests, and — in the last block — its negative
 * control.
 *
 * Rule 3: a guard gets a demonstration that it can fail. A scoreboard is a
 * guard over a whole measurement, so the demonstration has to be a whole
 * broken RUN, not a broken assertion. `surfaces-eval-fixtures/broken-run` is
 * five independent breakages, every one of them shaped to look like a
 * success, and `clean-run` is the same machinery over evidence that is
 * consistent. Both are scored here, with the real probe, and the pair is
 * asserted to come out opposite ways. A "the broken run scored broken" test
 * on its own is satisfied by a scorer that scores everything broken, which
 * is why the clean half is not optional.
 */

const DEV_DIR = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = path.join(DEV_DIR, 'surfaces-corpus');
const FIXTURES = path.join(DEV_DIR, 'surfaces-eval-fixtures');
const REPO_ROOT = path.resolve(DEV_DIR, '..', '..', '..');

/* ------------------------------------------------------------------ */
/* The corpus                                                          */
/* ------------------------------------------------------------------ */

/**
 * The eight sentences session 6a's generation phase issued, verbatim from
 * `surface-channels-session6a-prompt.md:39`.
 *
 * Duplicated here rather than derived from the corpus, which is the whole
 * point: a corpus that "includes the eight from 6a" cannot be checked against
 * itself. If a later edit tidies one of these sentences, the run stops being
 * comparable to 6a's numbers and this test says so.
 */
const SESSION_6A_REQUESTS = [
  "can we track who's bringing what to the potluck?",
  'poll for Friday movie night — three options',
  'chore rotation tracker for the house',
  'RSVP for the book club meetup',
  'track our climbing sessions this month',
  'who owes what for the beach trip',
  'simple kanban for the zine project',
  'leaderboard for our chess games',
];

const TEMPLATES = [
  'poll',
  'workout-tracker',
  'rsvp',
  'potluck',
  'habit-tracker',
  'leaderboard',
  'countdown',
  'expense-split',
  'kanban',
];

test('the corpus loads, and every id matches its filename', () => {
  const corpus = loadCorpus(CORPUS_DIR);
  assert.ok(corpus.records.length >= 30, 'the corpus is ~30 requests');
  assert.match(corpus.sha256, /^[0-9a-f]{64}$/);
});

test("every one of session 6a's eight sentences is in the corpus verbatim", () => {
  const { records } = loadCorpus(CORPUS_DIR);
  const sentences = new Set(records.map((record) => record.request));
  for (const sentence of SESSION_6A_REQUESTS) {
    assert.ok(
      sentences.has(sentence),
      `6a's request is missing or was reworded: ${JSON.stringify(sentence)}`
    );
  }
  const tagged = records.filter((record) => record.origin === 'session-6a');
  assert.equal(
    tagged.length,
    SESSION_6A_REQUESTS.length,
    'the origin tag and the sentence list disagree about how many came from 6a'
  );
});

test('all nine templates are spanned, and none of them alone', () => {
  const { records } = loadCorpus(CORPUS_DIR);
  const counts = new Map(TEMPLATES.map((name) => [name, 0]));
  for (const record of records) {
    if (!record.expect.routes) continue;
    const template = record.expect.template;
    assert.ok(
      counts.has(template),
      `${record.id} expects template "${template}", which is not one of the nine`
    );
    counts.set(template, counts.get(template) + 1);
  }
  for (const [name, count] of counts) {
    assert.ok(count >= 2, `template ${name} has only ${count} request(s)`);
  }
});

test('the corpus carries out-of-scope requests, with an argument each', () => {
  const { records } = loadCorpus(CORPUS_DIR);
  const away = records.filter((record) => !record.expect.routes);
  // A corpus of only in-scope requests can measure under-triggering and
  // nothing else. Over-triggering is invisible to it, so the out-of-scope
  // slice is load-bearing rather than decorative.
  assert.ok(
    away.length >= 5,
    'too few out-of-scope requests to see over-triggering'
  );
  for (const record of away) {
    assert.ok(
      record.expect.awayTo,
      `${record.id} does not say where it should go instead`
    );
    assert.ok(
      record.expect.why,
      `${record.id} has no argument for its expectation`
    );
    assert.equal(record.expect.template, null);
  }
});

test('every in-scope record argues for its expectation', () => {
  const { records } = loadCorpus(CORPUS_DIR);
  for (const record of records) {
    assert.ok(
      typeof record.expect.why === 'string' && record.expect.why.length > 40,
      `${record.id}: expect.why is missing or too thin to settle a disagreement`
    );
  }
});

test('the corpus hash moves when a sentence is edited', () => {
  const before = loadCorpus(CORPUS_DIR).sha256;
  const scratch = fs.mkdtempSync(
    path.join(process.env.TMPDIR ?? '/tmp', 'corpus-')
  );
  for (const name of fs.readdirSync(CORPUS_DIR)) {
    if (!name.endsWith('.json')) continue;
    fs.copyFileSync(path.join(CORPUS_DIR, name), path.join(scratch, name));
  }
  const victim = path.join(scratch, 'poll-movie-night.json');
  const record = JSON.parse(fs.readFileSync(victim, 'utf-8'));
  record.request = `${record.request} (edited)`;
  fs.writeFileSync(victim, JSON.stringify(record, null, 2));
  assert.notEqual(loadCorpus(scratch).sha256, before);
  fs.rmSync(scratch, { recursive: true, force: true });
});

/* ------------------------------------------------------------------ */
/* Routing detection                                                   */
/* ------------------------------------------------------------------ */

function turn(parts) {
  return `${JSON.stringify({
    type: 'message',
    message: { role: 'assistant', content: parts },
  })}\n`;
}

test('a tlon surface command counts as routed', () => {
  const observed = readTranscript(
    turn([
      {
        type: 'toolCall',
        name: 'tlon',
        arguments: { command: 'surface lint a b' },
      },
    ])
  );
  assert.equal(observed.routed, true);
  assert.deepEqual(observed.surfaceCommands, ['surface lint']);
  assert.equal(observed.published, false);
});

test('reading the surfaces SKILL.md counts as routed even with no command', () => {
  const observed = readTranscript(
    turn([
      {
        type: 'toolCall',
        name: 'read',
        arguments: {
          path: '/root/.openclaw/plugin-skills/tlon-skill/skills/surfaces/SKILL.md',
        },
      },
    ])
  );
  assert.equal(observed.routed, true);
  assert.equal(observed.skillRead, true);
});

test('a turn that only reads messages does not count as routed', () => {
  const observed = readTranscript(
    turn([
      {
        type: 'toolCall',
        name: 'tlon',
        arguments: { command: 'messages channel chat/~zod/general' },
      },
    ])
  );
  assert.equal(observed.routed, false);
  assert.deepEqual(observed.surfaceCommands, []);
});

test('publishing, announcing and image delivery are all observed', () => {
  const observed = readTranscript(
    turn([
      {
        type: 'toolCall',
        name: 'tlon',
        arguments: {
          command: 'surface publish chat/~zod/dash-x --bundle app.js',
        },
      },
      {
        type: 'toolCall',
        name: 'tlon',
        arguments: { command: 'posts send chat/~zod/g "hi"' },
      },
      { type: 'image', mimeType: 'image/png' },
      { type: 'image', mimeType: 'image/png' },
    ])
  );
  assert.equal(observed.published, true);
  assert.equal(observed.announced, true);
  assert.equal(observed.imagesDelivered, 2);
});

/* ------------------------------------------------------------------ */
/* Scoring one request                                                 */
/* ------------------------------------------------------------------ */

const IN_SCOPE = {
  id: 'stub-in-scope',
  request: 'a request',
  origin: 'authored-6b',
  expect: { routes: true, template: 'poll', why: 'because' },
};
const OUT_OF_SCOPE = {
  id: 'stub-out-of-scope',
  request: 'a request',
  origin: 'authored-6b',
  expect: { routes: false, template: null, awayTo: 'chat', why: 'because' },
};

function stage(files) {
  const dir = fs.mkdtempSync(
    path.join(process.env.TMPDIR ?? '/tmp', 'runrow-')
  );
  for (const [name, contents] of Object.entries(files)) {
    const file = path.join(dir, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      typeof contents === 'string' ? contents : JSON.stringify(contents)
    );
  }
  return dir;
}

/**
 * A probe that reports whatever the caller wants, without running the gate.
 *
 * Deliberately does NOT carry a bundle hash. The scorer hashes the artifact
 * bytes itself and compares publish's claim against that, so a stub that
 * could supply the hash would let a test pass while the real comparison was
 * against something else entirely — the cross-check would be exercised in a
 * shape it never takes in production. Tests that need a matching hash compute
 * it from the file they staged, exactly as the scorer does.
 */
const stubProbe =
  (overrides = {}) =>
  () => ({
    ok: true,
    surfaceId: 'srf-stub',
    gate: overrides.gate ?? { verdict: 'pass', violations: [] },
    lint: overrides.lint ?? { verdict: 'pass', violations: [] },
    fold: overrides.fold ?? { verdict: 'pass', violations: [] },
    warnings: [],
    skipped: [],
    rubric: overrides.rubric ?? { present: false },
  });

test('a request with no run directory is missing, never a pass', () => {
  const row = scoreRequest(IN_SCOPE, null, stubProbe());
  assert.equal(row.outcome, 'missing');
  for (const axis of Object.values(row.axes)) {
    assert.equal(axis.verdict, 'unscored');
  }
});

test('a run with only a transcript is partial, not pass', () => {
  const dir = stage({
    'transcript.jsonl': turn([
      {
        type: 'toolCall',
        name: 'tlon',
        arguments: { command: 'surface create ~zod/g' },
      },
    ]),
  });
  const row = scoreRequest(IN_SCOPE, dir, stubProbe());
  assert.equal(row.axes.routing.verdict, 'pass');
  assert.equal(
    row.outcome,
    'partial',
    'unscored axes must not read as a clean pass'
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

test('an in-scope request that never routed fails the routing axis', () => {
  const dir = stage({
    'transcript.jsonl': turn([
      {
        type: 'toolCall',
        name: 'tlon',
        arguments: { command: 'messages dm ~ten' },
      },
    ]),
  });
  const row = scoreRequest(IN_SCOPE, dir, stubProbe());
  assert.equal(row.axes.routing.verdict, 'fail');
  assert.equal(row.outcome, 'fail');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('an out-of-scope request that routed away passes on routing and budget', () => {
  const dir = stage({
    'transcript.jsonl': turn([
      {
        type: 'toolCall',
        name: 'tlon',
        arguments: { command: 'messages channel chat/~zod/g' },
      },
    ]),
    'meta.json': { turnSeconds: 6.1, capSeconds: 300, killedAtCap: false },
  });
  const row = scoreRequest(OUT_OF_SCOPE, dir, stubProbe());
  assert.equal(row.outcome, 'pass');
  assert.equal(row.axes.gate.verdict, 'n/a');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('an out-of-scope request that published is a contradiction, and its app is not scored', () => {
  const dir = stage({
    'transcript.jsonl': turn([
      {
        type: 'toolCall',
        name: 'tlon',
        arguments: { command: 'surface publish chat/~zod/d' },
      },
    ]),
    'artifacts/app.js': 'surface.register({});',
    'artifacts/spec.json': { surfaceId: 'srf-x' },
    'publish.json': {
      outcome: 'published',
      channel: 'chat/~zod/d',
      sha256: 'b'.repeat(64),
      observed: 'read back',
    },
  });
  const row = scoreRequest(OUT_OF_SCOPE, dir, stubProbe());
  assert.equal(row.outcome, 'contradiction');
  assert.equal(row.axes.routing.verdict, 'fail');
  // The quality axes are n/a and NOT pass: an app that should not exist has
  // no business contributing to "how good are the apps this pipeline builds".
  assert.equal(row.axes.gate.verdict, 'n/a');
  assert.equal(row.axes.publish.verdict, 'n/a');
  const kinds = row.contradictions.map((c) => c.kind);
  assert.ok(kinds.includes('published-out-of-scope-request'));
  assert.ok(kinds.includes('artifacts-for-out-of-scope-request'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('publishing over a failing gate is a contradiction, not just a fail', () => {
  const bundle = 'surface.register({});';
  const dir = stage({
    'transcript.jsonl': turn([
      {
        type: 'toolCall',
        name: 'tlon',
        arguments: { command: 'surface publish chat/~zod/d' },
      },
    ]),
    'artifacts/app.js': bundle,
    'artifacts/spec.json': { surfaceId: 'srf-x' },
    'publish.json': {
      outcome: 'published',
      // The bytes publish names ARE the bytes on disk, so the only thing
      // wrong here is the gate — the contradiction list has to come back with
      // exactly one entry, not two overlapping ones.
      sha256: createHash('sha256').update(bundle).digest('hex'),
      observed: 'read back',
    },
  });
  const row = scoreRequest(
    IN_SCOPE,
    dir,
    stubProbe({
      gate: {
        verdict: 'fail',
        violations: [
          { rule: 'module-syntax', severity: 'error', message: 'x' },
        ],
      },
    })
  );
  assert.equal(row.outcome, 'contradiction');
  assert.deepEqual(
    row.contradictions.map((c) => c.kind),
    ['published-over-failing-gate']
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

test('publish naming other bytes than the artifacts is a contradiction', () => {
  const dir = stage({
    'artifacts/app.js': 'surface.register({});',
    'artifacts/spec.json': { surfaceId: 'srf-x' },
    'publish.json': {
      outcome: 'published',
      sha256: 'd'.repeat(64),
      observed: 'read back',
    },
  });
  const row = scoreRequest(IN_SCOPE, dir, stubProbe());
  assert.equal(row.outcome, 'contradiction');
  assert.deepEqual(
    row.contradictions.map((c) => c.kind),
    ['published-other-bytes']
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

test('an outcome with no read-back observation fails the publish axis', () => {
  const dir = stage({
    'artifacts/app.js': 'surface.register({});',
    'artifacts/spec.json': { surfaceId: 'srf-x' },
    'publish.json': { outcome: 'published', sha256: 'a'.repeat(64) },
  });
  const row = scoreRequest(IN_SCOPE, dir, stubProbe());
  assert.equal(row.axes.publish.verdict, 'fail');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('unprobed preview cells are unscored, not a clean preview', () => {
  const dir = stage({
    'preview/manifest.json': {
      bundleSha256: 'a'.repeat(64),
      defects: [],
      shellErrors: [],
      unprobedCells: [
        { cell: 'phone-initial-dark', problem: 'the shell never painted' },
      ],
      notChecked: [],
    },
  });
  const row = scoreRequest(IN_SCOPE, dir, stubProbe());
  assert.equal(row.axes.preview.verdict, 'unscored');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a rubric sheet carrying a fail verdict fails the screenshot axis', () => {
  const dir = stage({
    'artifacts/app.js': 'surface.register({});',
    'artifacts/spec.json': { surfaceId: 'srf-x' },
    'preview/rubric.json': { version: 1 },
  });
  const row = scoreRequest(
    IN_SCOPE,
    dir,
    stubProbe({
      rubric: {
        present: true,
        verdict: 'pass',
        problems: [],
        verdicts: {
          counts: { pass: 6, fail: 1 },
          nonPass: [
            {
              check: 'answers-the-request',
              verdict: 'fail',
              cell: 'phone-populated-light',
              note: 'nobody can add an expense',
            },
          ],
        },
      },
    })
  );
  assert.equal(row.axes.rubric.verdict, 'pass');
  assert.equal(row.axes.screenshotRubric.verdict, 'fail');
  assert.equal(row.outcome, 'fail');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a residual verdict is publishable and does not fail the screenshot axis', () => {
  const dir = stage({
    'artifacts/app.js': 'surface.register({});',
    'artifacts/spec.json': { surfaceId: 'srf-x' },
    'preview/rubric.json': { version: 1 },
  });
  const row = scoreRequest(
    IN_SCOPE,
    dir,
    stubProbe({
      rubric: {
        present: true,
        verdict: 'pass',
        problems: [],
        verdicts: {
          counts: { pass: 6, residual: 1 },
          nonPass: [
            {
              check: 'overflow',
              verdict: 'residual',
              cell: 'phone-populated-light',
              note: 'the chart is tight on a phone',
            },
          ],
        },
      },
    })
  );
  assert.equal(row.axes.screenshotRubric.verdict, 'pass');
  fs.rmSync(dir, { recursive: true, force: true });
});

/* ------------------------------------------------------------------ */
/* The budget                                                          */
/* ------------------------------------------------------------------ */

test('a turn killed on the cap is its own outcome, not a plain fail', () => {
  const dir = stage({
    'transcript.jsonl': turn([
      {
        type: 'toolCall',
        name: 'tlon',
        arguments: { command: 'surface lint app.js spec.json' },
      },
    ]),
    'meta.json': { turnSeconds: 300, capSeconds: 300, killedAtCap: true },
  });
  const row = scoreRequest(IN_SCOPE, dir, stubProbe());
  assert.equal(row.axes.budget.verdict, 'fail');
  // Filed above `fail`: the turn was cut off mid-pipeline, so what came after
  // the cut describes something interrupted rather than something that
  // finished badly. A corpus run that lost this distinction would repeat
  // 6a.5's wrong reading of the generation budget.
  assert.equal(row.outcome, 'cap-killed');
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the cap kill is derived from the clock, not only from the runner's flag", () => {
  const dir = stage({
    // No `killedAtCap`. The runner sits outside the turn and often cannot see
    // the container kill it, so the clock has to be sufficient on its own.
    'meta.json': { turnSeconds: 301.2, capSeconds: 300 },
  });
  const row = scoreRequest(IN_SCOPE, dir, stubProbe());
  assert.equal(row.axes.budget.verdict, 'fail');
  assert.equal(row.outcome, 'cap-killed');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a turn inside the cap passes the budget axis and reports its headroom', () => {
  const dir = stage({
    'meta.json': { turnSeconds: 104.2, capSeconds: 300, killedAtCap: false },
  });
  const row = scoreRequest(IN_SCOPE, dir, stubProbe());
  assert.equal(row.axes.budget.verdict, 'pass');
  assert.match(row.axes.budget.detail, /195\.8s of headroom/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a turn with no declared cap is unscored, never a budget pass', () => {
  const dir = stage({ 'meta.json': { turnSeconds: 104.2 } });
  const row = scoreRequest(IN_SCOPE, dir, stubProbe());
  assert.equal(row.axes.budget.verdict, 'unscored');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('an out-of-scope request keeps its budget axis', () => {
  // Everything else about an out-of-scope request goes `n/a`, because scoring
  // the quality of an app that should not exist is a category error. The
  // budget is different: a request that should have been answered in one chat
  // message and instead burned the whole cap is exactly the kind of cost this
  // section exists to surface.
  const dir = stage({
    'transcript.jsonl': turn([
      {
        type: 'toolCall',
        name: 'tlon',
        arguments: { command: 'messages channel chat/~zod/g' },
      },
    ]),
    'meta.json': { turnSeconds: 300, capSeconds: 300, killedAtCap: true },
  });
  const row = scoreRequest(OUT_OF_SCOPE, dir, stubProbe());
  assert.equal(row.axes.gate.verdict, 'n/a');
  assert.equal(row.axes.budget.verdict, 'fail');
  assert.equal(row.outcome, 'cap-killed');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('phase seconds are derived from the transcript, split before and after the pipeline', () => {
  const at = (seconds) =>
    new Date(
      Date.parse('2026-09-01T12:00:00.000Z') + seconds * 1000
    ).toISOString();
  const line = (seconds, content) =>
    `${JSON.stringify({
      type: 'message',
      timestamp: at(seconds),
      message: { role: 'assistant', content: [content] },
    })}\n`;
  const text =
    line(0, { type: 'text', text: 'poll for Friday movie night' }) +
    line(50, {
      type: 'toolCall',
      name: 'tlon',
      arguments: { command: 'surface lint app.js spec.json' },
    }) +
    line(58, {
      type: 'toolCall',
      name: 'tlon',
      arguments: { command: 'surface preview app.js spec.json' },
    }) +
    line(100, { type: 'text', text: 'done' });

  const { phases } = readTranscript(text);
  assert.equal(phases.source, 'transcript');
  assert.equal(phases.totalSeconds, 100);
  // Routing plus generation: the phase the verdict run found expensive, and
  // the one no command times on its own.
  assert.equal(phases.beforeFirstSurfaceCommand, 50);
  assert.equal(phases.byCommand['surface lint'], 8);
  assert.equal(phases.byCommand['surface preview'], 42);
  assert.equal(phases.afterLastSurfaceCommand, 0);
});

test('a transcript with no timestamps yields no phases rather than zeros', () => {
  const text = `${JSON.stringify({
    type: 'message',
    message: {
      role: 'assistant',
      content: [
        {
          type: 'toolCall',
          name: 'tlon',
          arguments: { command: 'surface lint a b' },
        },
      ],
    },
  })}\n`;
  const observed = readTranscript(text);
  assert.equal(observed.routed, true);
  // Zeros would read as a free pipeline. Absent reads as unmeasured, which is
  // what it is.
  assert.equal(observed.phases, null);
});

/* ------------------------------------------------------------------ */
/* Totals and baseline                                                 */
/* ------------------------------------------------------------------ */

test('the totals count unscored separately and never fold it into pass', () => {
  const corpus = loadCorpus(CORPUS_DIR);
  const rows = corpus.records.map((record) =>
    scoreRequest(record, null, stubProbe())
  );
  const board = buildScoreboard({
    corpus: { ...corpus, dir: CORPUS_DIR },
    rows,
    runDir: '/nowhere',
    label: 'empty',
  });
  assert.equal(board.totals.outcomes.missing, corpus.records.length);
  assert.equal(board.totals.outcomes.pass, 0);
  for (const axis of Object.values(board.totals.axes)) {
    assert.equal(axis.pass, 0);
    assert.equal(axis.unscored, corpus.records.length);
  }
});

test('the baseline comparison names regressions, improvements and a changed corpus', () => {
  const base = {
    label: 'baseline',
    generatedAt: '2026-01-01T00:00:00.000Z',
    corpus: { sha256: 'x'.repeat(64) },
    requests: [
      { id: 'a', outcome: 'pass' },
      { id: 'b', outcome: 'fail' },
      { id: 'gone', outcome: 'pass' },
    ],
  };
  const now = {
    corpus: { sha256: 'y'.repeat(64) },
    requests: [
      { id: 'a', outcome: 'fail' },
      { id: 'b', outcome: 'pass' },
      { id: 'new', outcome: 'pass' },
    ],
  };
  const comparison = compareToBaseline(now, base);
  assert.deepEqual(comparison.regressions, [
    { id: 'a', was: 'pass', now: 'fail' },
  ]);
  assert.deepEqual(comparison.improvements, [
    { id: 'b', was: 'fail', now: 'pass' },
  ]);
  assert.deepEqual(comparison.added, ['new']);
  assert.deepEqual(comparison.dropped, ['gone']);
  assert.equal(comparison.corpusChanged, true);
});

test('a request that stopped being measured is not counted as an improvement', () => {
  // The trap a single total order walks into. `fail → missing` means the
  // request is no longer being asked, which is neither better nor worse than
  // failing — it is a coverage change, and putting it in the win column is
  // exactly how a shrinking measurement reads as a improving one.
  const comparison = compareToBaseline(
    {
      corpus: { sha256: 'x'.repeat(64) },
      requests: [
        { id: 'dropped-from-run', outcome: 'missing' },
        { id: 'newly-run', outcome: 'fail' },
        { id: 'worse', outcome: 'contradiction' },
      ],
    },
    {
      label: 'b',
      generatedAt: '2026-01-01T00:00:00.000Z',
      corpus: { sha256: 'x'.repeat(64) },
      requests: [
        { id: 'dropped-from-run', outcome: 'fail' },
        { id: 'newly-run', outcome: 'missing' },
        { id: 'worse', outcome: 'fail' },
      ],
    }
  );
  assert.deepEqual(comparison.improvements, []);
  assert.deepEqual(comparison.coverageLost, [
    { id: 'dropped-from-run', was: 'fail', now: 'missing' },
  ]);
  assert.deepEqual(comparison.coverageGained, [
    { id: 'newly-run', was: 'missing', now: 'fail' },
  ]);
  // A contradiction is strictly worse news than a failure: it says a number
  // somewhere is about something other than what it says.
  assert.deepEqual(comparison.regressions, [
    { id: 'worse', was: 'fail', now: 'contradiction' },
  ]);
});

/* ------------------------------------------------------------------ */
/* The negative control                                                */
/* ------------------------------------------------------------------ */

function scoreFixtureRun(name) {
  const corpus = loadCorpus(CORPUS_DIR);
  const runDir = path.join(FIXTURES, name);
  const rows = corpus.records.map((record) => {
    const dir = path.join(runDir, record.id);
    return scoreRequest(record, fs.existsSync(dir) ? dir : null);
  });
  return buildScoreboard({
    corpus: { ...corpus, dir: CORPUS_DIR },
    rows,
    runDir,
    label: name,
  });
}

test('the harness can run its own probe here', () => {
  // Not a skip. A negative control that quietly does not run is the defect
  // this whole file exists to prevent, one level up: the two tests below
  // would pass vacuously the moment `bun` went missing, and the scoreboard
  // would go on reporting every gate as `unscored` in production.
  const version = execFileSync('bun', ['--version'], { encoding: 'utf-8' });
  assert.match(version.trim(), /^\d+\./);
});

test('the probe classifies every gate rule as static or behavioural', () => {
  // The gate gained `time-display` mid-session. A probe that defaulted unknown
  // rules into the static half would have filed a behavioural rule under
  // `lint` — on a scoreboard whose whole purpose is keeping "the source has a
  // style problem" apart from "the app misbehaves when the clock moves". The
  // probe refuses instead, and this is the demonstration that the refusal is
  // wired to the real rule list rather than to a copy of it.
  const probe = fs.readFileSync(
    path.join(DEV_DIR, 'surfaces-eval-probe.ts'),
    'utf-8'
  );
  const lint = fs.readFileSync(
    path.join(REPO_ROOT, 'packages/tlon-skill/scripts/surface-lint.ts'),
    'utf-8'
  );
  const gateRules = [
    ...lint
      .slice(
        lint.indexOf('export const SURFACE_LINT_RULES'),
        lint.indexOf('export type SurfaceLintRule')
      )
      // Quote-agnostic: the repo's formatter has flipped this file's string
      // style before, and a rule-coverage check that goes vacuous on a
      // formatting change is a check that stops working silently.
      .matchAll(/^\s{2}['"]([a-z-]+)['"],$/gm),
  ].map((match) => match[1]);
  assert.ok(gateRules.length >= 15, "could not read the gate's rule list");
  for (const rule of gateRules) {
    assert.ok(
      probe.includes(`'${rule}'`) || probe.includes(`"${rule}"`),
      `the gate has a rule the probe never names: ${rule}`
    );
  }
});

test('the probe never reports a fabricated smoke-render failure', () => {
  // The gate's smoke render uses the REAL shell, whose primitives are .tsx
  // compiled against preact. Bun picks the tsconfig from the current working
  // directory, and only packages/tlon-skill's sets jsxImportSource: "preact".
  // From anywhere else the shell's elements come out as React elements and
  // preact's renderer throws — which the gate reports as a `smoke-render`
  // violation on a template that lints clean.
  //
  // Both outcomes are asserted rather than one, because the assertion that
  // matters is not "the trap reproduces" (someone may fix the root tsconfig)
  // but "the probe never turns an environment fault into an app fault". So:
  // from the pinned cwd it must score clean, and from the repo root it must
  // either score clean too or refuse with exit 2 — never report a violation.
  const template = path.join(
    REPO_ROOT,
    'packages/tlon-skill/skills/surfaces/templates/poll'
  );
  const args = [
    path.join(DEV_DIR, 'surfaces-eval-probe.ts'),
    '--bundle',
    path.join(template, 'app.js'),
    '--spec',
    path.join(template, 'spec.json'),
  ];

  const pinned = spawnSync('bun', args, {
    cwd: path.join(REPO_ROOT, 'packages/tlon-skill'),
    encoding: 'utf-8',
    maxBuffer: 32 * 1024 * 1024,
  });
  assert.equal(pinned.status, 0, pinned.stderr);
  assert.equal(JSON.parse(pinned.stdout).gate.verdict, 'pass');

  const unpinned = spawnSync('bun', args, {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (unpinned.status === 0) {
    assert.equal(JSON.parse(unpinned.stdout).gate.verdict, 'pass');
  } else {
    assert.equal(
      unpinned.status,
      2,
      'the probe reported a gate result from an unpinned cwd instead of refusing'
    );
    assert.match(unpinned.stderr, /REFUSING TO SCORE/);
    assert.match(unpinned.stderr, /jsx-runtime trap/);
  }
});

test('NEGATIVE CONTROL — the broken run scores as broken', () => {
  const board = scoreFixtureRun('broken-run');
  assert.equal(
    board.totals.outcomes.pass,
    0,
    'a run with five independent breakages produced a passing request'
  );
  assert.ok(
    board.contradictions.length >= 3,
    `expected the cross-checks to fire; got ${board.contradictions.length}`
  );
  const kinds = new Set(board.contradictions.map((c) => c.kind));
  for (const expected of [
    'published-over-failing-gate',
    'published-other-bytes',
    'published-out-of-scope-request',
  ]) {
    assert.ok(kinds.has(expected), `no ${expected} contradiction was raised`);
  }
  // Each breakage caught by its own mechanism, not one of them four times.
  const byId = new Map(board.requests.map((row) => [row.id, row]));
  assert.equal(byId.get('poll-movie-night').axes.gate.verdict, 'fail');
  assert.equal(byId.get('potluck-bringing-what').axes.rubric.verdict, 'fail');
  assert.equal(byId.get('rsvp-book-club').axes.routing.verdict, 'fail');
  assert.equal(byId.get('oos-poll-lookup').axes.routing.verdict, 'fail');
  assert.equal(byId.get('habit-physio-daily').outcome, 'contradiction');
  // The sixth: a turn the container killed on the cap. It carries its own
  // outcome rather than being folded into `fail`, and the budget section
  // names it — the fact the verdict run's generation numbers turn on.
  assert.equal(byId.get('kanban-zine-project').outcome, 'cap-killed');
  assert.equal(byId.get('kanban-zine-project').axes.budget.verdict, 'fail');
  assert.equal(board.totals.outcomes['cap-killed'], 1);
  // And the phase split is derived, not zero: a transcript-timed run has to
  // be able to say where the seconds went.
  const timed = byId.get('poll-movie-night').observations.phases;
  assert.equal(timed.source, 'transcript');
  assert.ok(
    timed.beforeFirstSurfaceCommand > 0,
    'routing + generation was measured as zero seconds'
  );
});

test('NEGATIVE CONTROL — the clean run scores as clean', () => {
  const board = scoreFixtureRun('clean-run');
  assert.equal(
    board.contradictions.length,
    0,
    `the consistent run raised ${board.contradictions.length} contradiction(s)`
  );
  assert.equal(board.totals.outcomes.fail, 0);
  assert.ok(
    board.totals.outcomes.pass >= 2,
    'the consistent run produced no passing request, so "broken scores broken" proves nothing'
  );
  const row = board.requests.find((r) => r.id === 'poll-movie-night');
  // The whole chain, on real template bytes through the real gate.
  for (const axis of [
    'routing',
    'lint',
    'fold',
    'gate',
    'preview',
    'rubric',
    'screenshotRubric',
    'publish',
  ]) {
    assert.equal(
      row.axes[axis].verdict,
      'pass',
      `${axis} did not pass on the clean run`
    );
  }
});
