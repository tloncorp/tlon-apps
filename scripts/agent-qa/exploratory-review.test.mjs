import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewOutcome } from './review-outcome.mjs';
import { explainReport, renderPresentation } from './presentation.mjs';
import { qaGuidance } from './guidance.mjs';
import {
  qaResult,
  qaWaitState,
} from '../../.agents/skills/tlon-workflow/qa-result.mjs';
import { renderComment, planComment } from './comment.mjs';
import { backendInstructions, deviceTools } from './codex.mjs';

const head = 'a'.repeat(40);
const runId = '01a0ab1b-248b-7310-b88c-29c10a21d812';
const runUrl = `https://expo.dev/accounts/tlon/projects/groups/workflows/${runId}`;
const captured = () => ({
  context: {
    evidenceReview: 'completed',
    video: { status: 'ready' },
    pr: { head: { sha: head } },
  },
  report: {
    status: 'blocked',
    summary: 'Explored editing',
    checks: [
      {
        status: 'passed',
        expected: 'Save',
        observed: 'Saved',
        evidence: ['video-frames-1'],
      },
      {
        status: 'blocked',
        expected: 'Repeat offline',
        observed: 'Not reached in this session',
        evidence: [],
      },
    ],
    discoveries: [],
  },
});

test('completed exploration can leave a path unexplored or report a bug', () => {
  const original = captured();
  assert.deepEqual(reviewOutcome(original), {
    execution: 'completed',
    findings: 0,
    coverageGaps: 1,
  });
  original.report.checks[0].status = 'failed';
  assert.equal(reviewOutcome(original).execution, 'completed');
  assert.equal(reviewOutcome(original).findings, 1);
  original.report.checks[0].status = 'blocked';
  original.report.discoveries.push({
    status: 'failed',
    evidenceActions: [2, 3],
  });
  assert.equal(reviewOutcome(original).execution, 'completed');
});

test('no exploration, missing recording, pending reviewer and infrastructure failure remain incomplete', () => {
  for (const alter of [
    (x) => {
      x.report.checks = [x.report.checks[1]];
    },
    (x) => {
      x.context.video.status = 'unavailable';
    },
    (x) => {
      x.context.evidenceReview = 'pending';
    },
    (x) => {
      x.report.checks.push({ infrastructure: true, status: 'blocked' });
    },
  ]) {
    const original = captured();
    alter(original);
    assert.equal(reviewOutcome(original).execution, 'incomplete');
  }
});

test('report and watcher preserve completion separately from findings and coverage', () => {
  const original = captured();
  const body = renderPresentation(
    original,
    explainReport(original.report),
    [],
    runUrl,
    'Detailed observations'
  );
  assert.match(body, /Review completed/);
  assert.match(body, /Not fully explored/);
  assert.doesNotMatch(body, /Checks passed|Testing incomplete/);
  const attempt = { url: runUrl, head, key: 'run', kind: 'report' };
  const envelope = renderComment(
    planComment({ comments: [], viewerId: 1, pr: 1, head, attempt }),
    body
  );
  const item = qaResult({
    id: 1,
    body: envelope,
    user: { login: 'publisher' },
  });
  assert.equal(item.execution, 'completed');
  assert.equal(item.findings, 0);
  assert.equal(item.coverageGaps, 1);
  assert.equal(qaWaitState(runId, [item], head, head), 'received');
  assert.equal(
    qaWaitState(runId, [{ ...item, headSha: 'b'.repeat(40) }], head, head),
    'pending'
  );
  assert.equal(
    qaWaitState(
      runId,
      [{ ...item, runUrl: runUrl.replace('01a0ab1b', '01a0ab1c') }],
      head,
      head
    ),
    'pending'
  );
  assert.equal(qaWaitState(runId, [], 'b'.repeat(40), head), 'superseded');
  assert.equal(qaWaitState(undefined, [], head, head), 'none');
});

test('ordinary data needs no custom fixture and lifecycle exploration is available', async () => {
  const instructions = backendInstructions(
    { backend: { group: {} } },
    { QA_RUN_TAG: 'run-1' }
  );
  assert.match(instructions, /Create ordinary test data/);
  assert.match(instructions, /notes and messages/);
  assert.doesNotMatch(instructions, /Other writes need a verified fixture/);
  assert.ok(deviceTools.includes('home') && deviceTools.includes('open'));
  const guidance = await qaGuidance({ navigation: true });
  assert.match(guidance, /plan is a\s+starting point/);
  assert.match(guidance, /Base-build reproductions are not required/);
  assert.match(guidance, /Making a throwaway group/);
  assert.doesNotMatch(
    guidance,
    /git checkout|Both iOS and Android|### 5\. Fix/
  );
});
