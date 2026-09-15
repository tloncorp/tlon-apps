import test from 'node:test';
import assert from 'node:assert/strict';
import { workflowState, recoveryArtifact } from './workflow-state.mjs';
test('terminal jobs release a coordinator despite stale workflow status', () => {
  const run = {
    status: 'IN_PROGRESS',
    jobs: [{ status: 'SUCCESS' }, { status: 'SKIPPED' }],
  };
  assert.equal(workflowState(run), 'SUCCESS');
  assert.equal(
    workflowState({ ...run, jobs: [...run.jobs, { status: 'FAILURE' }] }),
    'FAILURE'
  );
  assert.equal(
    workflowState({ ...run, jobs: [...run.jobs, { status: 'CANCELED' }] }),
    'CANCELED'
  );
  for (const status of ['NEW', 'IN_PROGRESS', 'PENDING'])
    assert.equal(
      workflowState({ ...run, jobs: [...run.jobs, { status }] }),
      'IN_PROGRESS'
    );
  assert.equal(
    workflowState({ status: 'IN_PROGRESS', jobs: [] }),
    'IN_PROGRESS'
  );
});

test('recovery uses the intact capture when review output is partial', () => {
  const capture = { name: 'ios-agent-qa' },
    review = { name: 'evidence-review-replay' };
  const run = {
    jobs: [
      { key: 'qa_ios', artifacts: [capture] },
      { key: 'report_video', artifacts: [review], outputs: {} },
    ],
  };
  assert.equal(recoveryArtifact(run), capture);
  run.jobs[1].outputs.review_ready = 'true';
  assert.equal(recoveryArtifact(run), review);
  run.jobs[1].artifacts = [];
  assert.equal(recoveryArtifact(run), capture);
});
