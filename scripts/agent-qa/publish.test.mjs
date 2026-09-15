import test from 'node:test';
import assert from 'node:assert/strict';
import { selectEvidence } from './publish.mjs';

const id = '01a08d64-866a-728b-b1d3-8fe09276a6a9';
function fixture(status = 'SUCCESS') {
  return {
    id,
    status,
    gitCommitHash: 'a'.repeat(40),
    workflow: {
      app: { id: '617bb643-5bf6-4c40-8af6-c6e9dd7e3bd0' },
      fileName: 'pr-agent-qa-ios.yml',
    },
    jobs: [
      {
        key: 'qa_ios',
        outputs: { report: 'Failed check', video_artifact: 'video' },
        artifacts: [
          {
            id: 'video',
            name: 'ios-agent-qa-video',
            filename: 'test-session.mp4',
            fileSizeBytes: 100,
            downloadUrl: 'https://example.com/signed-video',
          },
        ],
      },
    ],
  };
}
test('failed tests retain their video and report for automatic publishing', () => {
  const evidence = selectEvidence(fixture('FAILURE'), id);
  assert.equal(evidence.report, 'Failed check');
  assert.equal(evidence.video.id, 'video');
});
test('publisher rejects another project, unfinished run, or wrong artifact', () => {
  const run = fixture();
  run.workflow.app.id = 'other-project';
  assert.throws(() => selectEvidence(run, id), /does not belong/);
  assert.throws(
    () => selectEvidence(fixture('IN_PROGRESS'), id),
    /has not finished/
  );
  const bad = fixture();
  bad.jobs[0].artifacts[0].filename = 'script.sh';
  assert.throws(() => selectEvidence(bad, id), /Invalid video/);
});
test('a setup failure still publishes an explicit report without inventing a video', () => {
  const run = fixture('FAILURE');
  delete run.jobs[0].outputs.video_artifact;
  assert.equal(selectEvidence(run, id).video, undefined);
});
