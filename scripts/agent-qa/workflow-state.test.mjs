import test from 'node:test';
import assert from 'node:assert/strict';
import { workflowState, buildFinalStages } from './workflow-state.mjs';
test('terminal jobs release a coordinator despite stale workflow status', () => {
  const run = {
    status: 'IN_PROGRESS',
    jobs: [{ key: 'publish', status: 'SUCCESS' }, { status: 'SKIPPED' }],
  };
  assert.equal(workflowState(run, ['publish']), 'SUCCESS');
  assert.equal(
    workflowState({ ...run, jobs: [...run.jobs, { status: 'FAILURE' }] }, [
      'publish',
    ]),
    'FAILURE'
  );
  assert.equal(
    workflowState({ ...run, jobs: [...run.jobs, { status: 'CANCELED' }] }, [
      'publish',
    ]),
    'CANCELED'
  );
  for (const status of ['NEW', 'IN_PROGRESS', 'PENDING'])
    assert.equal(
      workflowState({ ...run, jobs: [...run.jobs, { status }] }, ['publish']),
      'IN_PROGRESS'
    );
  assert.equal(
    workflowState({ status: 'IN_PROGRESS', jobs: [] }),
    'IN_PROGRESS'
  );
});

test('intermediate terminal jobs cannot finish a lazily scheduled build', () => {
  const run = {
    status: 'IN_PROGRESS',
    jobs: [
      { key: 'assess_pr', status: 'SUCCESS' },
      { key: 'fingerprint', status: 'SUCCESS' },
    ],
  };
  const finalKeys = ['repack_ios', 'reuse_build', 'build_ios'];
  assert.equal(workflowState(run, finalKeys), 'IN_PROGRESS');
  assert.equal(workflowState(run), 'IN_PROGRESS');
  run.jobs.push({ key: 'compatible_build', status: 'SUCCESS' });
  assert.equal(workflowState(run, finalKeys), 'IN_PROGRESS');
  run.jobs.push({ key: 'repack_ios', status: 'SUCCESS' });
  assert.equal(workflowState(run, finalKeys), 'SUCCESS');
  assert.equal(
    workflowState({ status: 'FAILURE', jobs: [] }, finalKeys),
    'FAILURE'
  );
});

test('failed repack waits for a lazily created native fallback', () => {
  const finalStages = buildFinalStages;
  const run = {
    status: 'IN_PROGRESS',
    jobs: [{ key: 'repack_ios', status: 'FAILURE' }],
  };
  assert.equal(workflowState(run, finalStages), 'IN_PROGRESS');
  run.jobs.push({ key: 'build_ios', status: 'IN_PROGRESS' });
  assert.equal(workflowState(run, finalStages), 'IN_PROGRESS');
  run.jobs[1].status = 'SUCCESS';
  assert.notEqual(workflowState(run, finalStages), 'IN_PROGRESS');
  assert.equal(
    workflowState(
      {
        status: 'IN_PROGRESS',
        jobs: [{ key: 'reuse_build', status: 'SUCCESS' }],
      },
      finalStages
    ),
    'SUCCESS'
  );
});

import { selectPreparedBuild, requestedBuild } from './workflow-state.mjs';

test('a same-commit build cannot silently replace the requested artifact', () => {
  const build = {
    key: 'reuse_build',
    status: 'SUCCESS',
    outputs: { build_id: 'selected', git_commit_hash: 'commit' },
  };
  const run = { jobs: [build] };
  assert.throws(
    () => selectPreparedBuild(run, 'requested', 'commit'),
    /differs/
  );
  assert.throws(
    () => selectPreparedBuild(run, 'selected', 'wrong-commit'),
    /differs/
  );
  assert.equal(selectPreparedBuild(run, 'selected', 'commit'), build);
  assert.equal(selectPreparedBuild(run), build);
});

test('reuse verifies the exact requested build rather than selecting by commit', () => {
  const build = {
    id: 'requested',
    gitCommitHash: 'commit',
    status: 'FINISHED',
    platform: 'IOS',
    buildProfile: 'e2e',
    isForIosSimulator: true,
    appIdentifier: 'io.tlon.groups',
    app: { id: '617bb643-5bf6-4c40-8af6-c6e9dd7e3bd0' },
  };
  assert.equal(
    requestedBuild(build, 'requested', 'commit').build_id,
    'requested'
  );
  for (const changed of [
    { id: 'other' },
    { gitCommitHash: 'other' },
    { status: 'ERRORED' },
    { isForIosSimulator: false },
  ])
    assert.throws(
      () => requestedBuild({ ...build, ...changed }, 'requested', 'commit'),
      /matching finished/
    );
});
