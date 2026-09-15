import test from 'node:test';
import assert from 'node:assert/strict';
import { selectReviewedEvidence, verifyReplayReceipt } from './publish.mjs';
const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const artifact = { name: 'evidence-review-replay' };
const run = {
  id,
  status: 'SUCCESS',
  gitCommitHash: 'a'.repeat(40),
  workflow: {
    app: { id: '617bb643-5bf6-4c40-8af6-c6e9dd7e3bd0' },
    fileName: 'pr-agent-qa-ios.yml',
  },
  jobs: [{ key: 'review_recording', artifacts: [artifact] }],
};
test('reviewed artifacts require the correct completed EAS workflow', () => {
  assert.equal(selectReviewedEvidence(run, id), artifact);
  for (const changed of [
    { ...run, id: other },
    { ...run, status: 'IN_PROGRESS' },
    { ...run, gitCommitHash: 'bad' },
    { ...run, workflow: { ...run.workflow, app: { id: 'other' } } },
    { ...run, workflow: { ...run.workflow, fileName: 'other.yml' } },
    { ...run, jobs: [] },
  ])
    assert.throws(() => selectReviewedEvidence(changed, id));
  assert.equal(
    selectReviewedEvidence({ ...run, gitCommitHash: 'b'.repeat(40) }, id),
    artifact
  );
});
test('matching capture SHA and video shape cannot bind another runs report', () => {
  const sameCapture = {
    harnessSha: 'a'.repeat(40),
    width: 588,
    height: 1280,
    duration: 120,
  };
  verifyReplayReceipt({ originalRun: id, ...sameCapture }, id);
  assert.throws(
    () => verifyReplayReceipt({ originalRun: other, ...sameCapture }, id),
    /another original run/
  );
  assert.throws(() => verifyReplayReceipt(null, id), /another original run/);
});
