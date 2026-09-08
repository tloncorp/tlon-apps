import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  runProcess,
  runWebIteration,
  selectedTests,
  snapshotReaders,
} from './run-scroll-stability-web.mjs';

const selection = { suites: [{ specs: [{ tests: [{}] }] }] };
async function attempt(
  t,
  {
    initialStale = false,
    finalStale = false,
    readersChanged = false,
    cancelled = false,
    empty = false,
    processCode = 0,
    verdict = 'recorded-sampled-pass',
  } = {}
) {
  const dir = mkdtempSync(join(tmpdir(), 'scroller-web-run-control-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const receipt = join(dir, 'receipt.json');
  writeFileSync(receipt, '{}');
  const calls = [];
  let checks = 0,
    replays = 0,
    readerChecks = 0;
  const state = await runWebIteration(
    { grep: 'case (one|two)', receipt, output: join(dir, 'run') },
    {
      verify() {
        checks++;
        if (initialStale) throw new Error('stale application build');
        return {
          sourceDigest: finalStale && checks > 1 ? 'changed' : 'original',
        };
      },
      snapshotReaders() {
        return [
          {
            path: 'scripts/scroll-stability-web-evidence.mjs',
            sha256: readersChanged && readerChecks++ ? 'changed' : 'original',
          },
        ];
      },
      async run(argv, options) {
        calls.push({ argv, options });
        writeFileSync(
          options.env.PLAYWRIGHT_JSON_OUTPUT_NAME,
          JSON.stringify(
            argv.includes('--list')
              ? empty
                ? { suites: [] }
                : selection
              : { suites: [{}] }
          )
        );
        return {
          code: argv.includes('--list') ? 0 : processCode,
          signal: null,
          cancelled: !argv.includes('--list') && cancelled,
        };
      },
      replay: {
        readPlaywrightReport() {
          replays++;
          return [
            {
              title: 'case one',
              reportedStatus: processCode ? 'failed' : 'passed',
            },
          ];
        },
        assessWebEvidence() {
          return { status: verdict, issues: [] };
        },
      },
    }
  );
  return {
    state,
    calls,
    checks,
    replays,
    read: (name) => JSON.parse(readFileSync(join(dir, 'run', name), 'utf8')),
  };
}

test('a stale application build stops before selection or browser startup and retains the error', async (t) => {
  const result = await attempt(t, { initialStale: true });
  assert.equal(result.state.exitCode, 1);
  assert.equal(result.calls.length, 0);
  assert.match(result.read('run.json').error, /stale application build/);
});

test('an empty selector stops before capture', async (t) => {
  const result = await attempt(t, { empty: true });
  assert.equal(result.state.exitCode, 1);
  assert.equal(result.calls.length, 1);
  assert.equal(result.replays, 0);
  assert.match(result.state.error, /matched no tests/);
});

test('a focused run keeps the regex literal, forces headless production mode, replays once, and records every phase', async (t) => {
  const result = await attempt(t);
  assert.equal(result.state.exitCode, 0);
  assert.equal(result.calls.length, 2);
  assert.equal(result.replays, 1);
  const capture = result.calls[1];
  assert.equal(
    capture.argv[capture.argv.indexOf('--grep') + 1],
    'case (one|two)'
  );
  assert.equal(capture.options.env.SCROLLER_HEADED, '0');
  assert.equal(capture.options.env.USE_PRODUCTION_BUILD, 'true');
  assert.equal(result.calls[0].options.timeout, 30_000);
  assert.deepEqual(
    result.state.phases.map((phase) => phase.name),
    ['preflight', 'selection', 'capture', 'replay', 'final-source-check']
  );
  assert.ok(
    result.state.phases.every((phase) => Number.isFinite(phase.durationMs))
  );
});

test('a failed producer is still replayed and cannot be turned green by replay', async (t) => {
  const result = await attempt(t, { processCode: 1 });
  assert.equal(result.state.exitCode, 1);
  assert.equal(result.replays, 1);
  assert.equal(result.read('replay.json').length, 1);
  assert.match(result.state.error, /Playwright failed/);
});

test('a producer pass with incomplete evidence remains unsuccessful', async (t) => {
  const result = await attempt(t, { verdict: 'incomplete' });
  assert.equal(result.state.exitCode, 1);
  assert.equal(result.read('replay.json')[0].status, 'incomplete');
});

test('source changes during capture invalidate the run while retaining the raw verdict', async (t) => {
  const result = await attempt(t, { finalStale: true });
  assert.equal(result.state.exitCode, 1);
  assert.match(result.state.finalCheckError, /source changed/);
  assert.equal(result.read('replay.json')[0].status, 'recorded-sampled-pass');
});

test('selection errors cannot be hidden by a nonempty selected suite', () => {
  assert.throws(
    () =>
      selectedTests({ ...selection, errors: [{ message: 'broken config' }] }),
    /selection has errors/
  );
});

test('reader-only changes invalidate the capture without changing the application build check', async (t) => {
  const result = await attempt(t, { readersChanged: true });
  assert.equal(result.state.exitCode, 1);
  assert.match(result.state.finalCheckError, /evidence reader changed/);
  assert.notDeepEqual(
    result.read('readers-before.json'),
    result.read('readers-after.json')
  );
});

test('reader snapshots include code changes and new reader files', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'scroller-reader-control-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'scroll-stability-web-evidence.mjs'), 'old reader');
  const original = snapshotReaders(dir);
  writeFileSync(join(dir, 'scroll-stability-web-evidence.mjs'), 'new reader');
  assert.notDeepEqual(snapshotReaders(dir), original);
  writeFileSync(
    join(dir, 'scroll-stability-another-reader.cjs'),
    'new dependency'
  );
  assert.equal(snapshotReaders(dir).length, 2);
});

test('cancellation still replays and finalizes with an unsuccessful result', async (t) => {
  const result = await attempt(t, { cancelled: true });
  assert.equal(result.state.exitCode, 1);
  assert.equal(result.replays, 1);
  assert.equal(result.state.phases.at(-1).name, 'final-source-check');
  assert.ok(result.read('run.json').completedAt);
});

test('cancellation reaches the owned child and allows its report to finish', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'scroller-cancel-control-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const log = join(dir, 'child.log');
  const before = process.listenerCount('SIGINT');
  const child = runProcess(
    [
      '--input-type=module',
      '-e',
      "process.on('SIGINT', () => { console.log('report finalized'); process.exit(0); }); console.log('ready'); setInterval(() => {}, 100);",
    ],
    { log, env: process.env, timeout: 2_000 }
  );
  for (let i = 0; i < 100 && !readFileSync(log, 'utf8').includes('ready'); i++)
    await new Promise((done) => setTimeout(done, 10));
  assert.match(readFileSync(log, 'utf8'), /ready/);
  process.emit('SIGINT');
  const result = await child;
  assert.deepEqual(result, { code: 0, signal: null, cancelled: true });
  assert.match(readFileSync(log, 'utf8'), /report finalized/);
  assert.equal(process.listenerCount('SIGINT'), before);
});
