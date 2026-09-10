import test from 'node:test';
import assert from 'node:assert/strict';
import {
  redact,
  verifyContext,
  verifyReport,
  verifyVideo,
  localRecordingPath,
} from './core.mjs';

test('recording accepts the CLI materialized path and the MCP artifact handle', () => {
  assert.equal(
    localRecordingPath({ video: '/tmp/session.mp4' }),
    '/tmp/session.mp4'
  );
  assert.equal(
    localRecordingPath({ video: { hostPath: '/tmp/session.mp4' } }),
    '/tmp/session.mp4'
  );
  assert.throws(
    () => localRecordingPath({ video: 'https://example.com/session.mp4' }),
    /local video/
  );
  assert.throws(() => localRecordingPath({}), /local video/);
});

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
