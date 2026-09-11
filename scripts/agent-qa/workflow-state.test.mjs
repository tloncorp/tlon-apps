import test from 'node:test';
import assert from 'node:assert/strict';
import { workflowState } from './workflow-state.mjs';
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
