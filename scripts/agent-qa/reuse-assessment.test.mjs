import test from 'node:test';
import assert from 'node:assert/strict';
import { assessmentForRetry } from './reuse-assessment.mjs';
test('infrastructure retry reuses only a successful plan for this project and exact base/head', () => {
  const pr = { head: { sha: 'a'.repeat(40) }, base: { sha: 'b'.repeat(40) } };
  const plan = {
    decision: 'test',
    headSha: pr.head.sha,
    baseSha: pr.base.sha,
    sourceReview: { summary: 'pinned code review' },
  };
  const run = {
    id: 'run',
    status: 'SUCCESS',
    workflow: {
      app: { id: '617bb643-5bf6-4c40-8af6-c6e9dd7e3bd0' },
      fileName: 'pr-agent-qa-ios.yml',
    },
    jobs: [
      {
        key: 'assess_pr',
        status: 'SUCCESS',
        outputs: { assessment: JSON.stringify(plan) },
      },
    ],
  };
  assert.deepEqual(assessmentForRetry(run, 'run', pr), plan);
  assert.throws(() =>
    assessmentForRetry({ ...run, status: 'FAILURE' }, 'run', pr)
  );
  assert.throws(() =>
    assessmentForRetry(
      { ...run, workflow: { ...run.workflow, app: { id: 'another-project' } } },
      'run',
      pr
    )
  );
  assert.throws(() => assessmentForRetry(run, 'other-run', pr));
  assert.throws(() =>
    assessmentForRetry(run, 'run', { ...pr, head: { sha: 'c'.repeat(40) } })
  );
});
