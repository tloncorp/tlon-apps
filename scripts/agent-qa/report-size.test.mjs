import test from 'node:test';
import assert from 'node:assert/strict';
import { renderReport } from './core.mjs';
import { renderComment, planComment } from './comment.mjs';

test('verbose valid reports fit outputs and comments without losing video or artifact links', () => {
  const long = '界'.repeat(3000);
  const raw = renderReport(
    {
      mode: 'PR',
      assessment: {
        sourceReview: {
          hypotheses: Array.from({ length: 10 }, (_, id) => ({
            id,
            impact: long,
            trigger: long,
            invariant: long,
            citations: [],
          })),
        },
      },
    },
    {
      status: 'failed',
      summary: 'A meaningful summary',
      checks: Array.from({ length: 16 }, () => ({
        status: 'failed',
        expected: long,
        observed: long,
        evidence: [],
      })),
      discoveries: Array.from({ length: 6 }, () => ({
        status: 'failed',
        title: long,
        trigger: long,
        observed: long,
        invariant: long,
        file: 'file',
        evidenceActions: [],
      })),
    },
    { calls: 1, tokens: 1 }
  );
  assert.ok(Buffer.byteLength(raw) <= 40_000);
  assert.ok(raw.includes('A meaningful summary'));
  const url =
    'https://expo.dev/accounts/tlon/projects/groups/workflows/01a092ed-0373-7c5d-be46-32dac446b2c5';
  const videos = Array.from(
    { length: 7 },
    (_, i) =>
      `https://github.com/user-attachments/assets/12345678-1234-1234-1234-123456789ab${i}`
  );
  const plan = planComment({
    comments: [],
    viewerId: 1,
    pr: 1,
    head: 'a'.repeat(40),
    attempt: { url, head: 'a'.repeat(40), key: 'test', kind: 'report' },
  });
  const body = renderComment(
    plan,
    `Summary of findings\n${long.repeat(15)}\n<details>${raw}</details>\n${videos.join('\n\n')}`
  );
  assert.ok(Buffer.byteLength(body) <= 60_000);
  assert.ok(body.includes('Summary of findings'));
  assert.ok(body.includes('Report shortened'));
  assert.ok(body.includes(url));
  assert.ok(body.includes('<!-- ios-agent-qa:pr-1 -->'));
  for (const video of videos) assert.equal(body.split(video).length, 2);
});
