import test from 'node:test';
import assert from 'node:assert/strict';
import {
  commandFor,
  redact,
  verifyContext,
  verifyReport,
  verifyVideo,
} from './core.mjs';

const sha = 'a'.repeat(40);
const pr = {
  head: { sha, repo: { full_name: 'tloncorp/tlon-apps' } },
  base: { repo: { full_name: 'tloncorp/tlon-apps' } },
  labels: [{ name: 'qa' }],
  draft: false,
};
const env = {
  QA_BUILD_ID: '6c542db5-d614-4ec0-a013-538e2e2b2144',
  QA_BUILD_SHA: sha,
  QA_APP_ID: 'io.tlon.groups',
  QA_TEST_SHIP: '~batbet-litnec',
  QA_MODE: 'pull_request',
  QA_PR_JSON: JSON.stringify(pr),
};

test('PR verification binds source, artifact, and PR to the same commit', () => {
  assert.equal(verifyContext(env, sha).mode, 'PR verification');
  assert.throws(
    () => verifyContext({ ...env, QA_BUILD_SHA: 'b'.repeat(40) }, sha),
    /do not match/
  );
  assert.throws(() => verifyContext(env, 'b'.repeat(40)), /do not match/);
});
test('credentialed QA refuses forks, draft PRs, and missing labels', () => {
  for (const changed of [
    { ...pr, head: { ...pr.head, repo: { full_name: 'someone/fork' } } },
    { ...pr, labels: [{ name: 'not-qa' }] },
    { ...pr, draft: true },
  ])
    assert.throws(() =>
      verifyContext({ ...env, QA_PR_JSON: JSON.stringify(changed) }, sha)
    );
});
test('manual validation cannot claim to certify a PR', () => {
  const context = verifyContext(
    { ...env, QA_MODE: 'workflow_dispatch', QA_PR_JSON: 'null' },
    'b'.repeat(40)
  );
  assert.equal(context.mode, 'Harness validation only');
});
test('device input cannot select another host, execute a shell, or read a file', () => {
  for (const action of [
    { kind: 'exec', text: 'env' },
    { kind: 'press', target: '--udid' },
    { kind: 'press', target: '/etc/passwd' },
    { kind: 'scroll', direction: '--help' },
    { kind: 'fill', target: '@e12', text: '--remote-config=/tmp/config' },
  ])
    assert.throws(() => commandFor(action));
  assert.deepEqual(
    commandFor({ kind: 'fill', target: '@e12', text: '$(printenv)' }),
    ['fill', '@e12', '$(printenv)']
  );
});
test('reports require real evidence and cannot turn incomplete checks into a pass', () => {
  const evidence = new Map([['e1', { screenshot: true }]]);
  const report = {
    status: 'passed',
    summary: 'Verified',
    checks: [
      {
        status: 'passed',
        expected: 'Home loads',
        observed: 'Home visible',
        evidence: ['e1'],
      },
    ],
  };
  assert.equal(verifyReport(report, evidence).status, 'passed');
  assert.throws(() => verifyReport(report, new Map()), /valid evidence/);
  assert.throws(
    () =>
      verifyReport(
        { ...report, checks: [{ ...report.checks[0], status: 'blocked' }] },
        evidence
      ),
    /cannot produce a pass/
  );
  assert.throws(
    () =>
      verifyReport(
        { ...report, checks: [{ ...report.checks[0], evidence: [] }] },
        evidence
      ),
    /require captured evidence/
  );
  assert.throws(
    () => verifyReport(report, new Map([['e1', { screenshot: false }]])),
    /screenshot/
  );
});
test('redaction removes credentials from error and report text', () => {
  assert.equal(
    redact('mail@test.dev and password', ['mail@test.dev', 'password', '']),
    '[redacted] and [redacted]'
  );
});

test('video evidence rejects missing tracks, empty files, and truncated sessions', () => {
  const probe = {
    streams: [
      { codec_type: 'video', codec_name: 'h264', width: 588, height: 1280 },
    ],
    format: { duration: '30.0' },
  };
  assert.equal(verifyVideo(probe, 31).durationSeconds, 30);
  assert.throws(() => verifyVideo({ ...probe, streams: [] }, 30), /unplayable/);
  assert.throws(
    () => verifyVideo({ ...probe, format: { duration: '0' } }, 30),
    /unplayable/
  );
  assert.throws(() => verifyVideo(probe, 120), /cover the test session/);
});

test('visual presses use fresh image evidence and measured screen bounds', async () => {
  const { visualPress } = await import('./core.mjs');
  const latest = { id: 'e9', screenshot: true, at: new Date().toISOString() };
  const action = {
    screenshot: 'e9',
    description: 'send arrow',
    x: 0.9,
    y: 0.5,
  };
  const screen = { width: 402, height: 874 };
  assert.deepEqual(visualPress(action, screen, latest), [
    'press',
    '362',
    '437',
  ]);
  for (const invalid of [
    { ...action, x: -1 },
    { ...action, y: NaN },
    { ...action, screenshot: 'e8' },
    { ...action, description: '' },
  ]) {
    assert.throws(() => visualPress(invalid, screen, latest));
  }
  assert.throws(() =>
    visualPress(action, screen, { ...latest, screenshot: false })
  );
  assert.throws(() =>
    visualPress(action, screen, { ...latest, at: '2020-01-01T00:00:00Z' })
  );
});
