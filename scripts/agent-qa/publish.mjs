// Validate saved EAS evidence before publishing or replaying it.
const project = '617bb643-5bf6-4c40-8af6-c6e9dd7e3bd0';
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

export function selectReviewedEvidence(run, id) {
  if (
    !uuid.test(id || '') ||
    run.id !== id ||
    run.workflow?.app?.id !== project ||
    run.workflow?.fileName !== 'pr-agent-qa-ios.yml' ||
    !['SUCCESS', 'FAILURE', 'CANCELED'].includes(run.status) ||
    !/^[a-f0-9]{40}$/.test(run.gitCommitHash || '')
  )
    throw new Error('Reviewer run does not belong to completed QA evidence');
  const artifact = run.jobs
    .find((j) => ['review_recording', 'report_video'].includes(j.key))
    ?.artifacts?.find((a) => a.name === 'evidence-review-replay');
  if (!artifact) throw new Error('Missing reviewed evidence artifact');
  return artifact;
}

export function verifyReplayReceipt(receipt, originalRun) {
  if (!uuid.test(originalRun || '') || receipt?.originalRun !== originalRun)
    throw new Error('Reviewed evidence belongs to another original run');
}

export function selectEvidence(run, id) {
  if (
    !uuid.test(id) ||
    run.id !== id ||
    run.workflow?.app?.id !== project ||
    run.workflow?.fileName !== 'pr-agent-qa-ios.yml'
  ) {
    throw new Error('EAS run does not belong to this QA workflow');
  }
  if (!['SUCCESS', 'FAILURE', 'CANCELED'].includes(run.status)) {
    throw new Error('EAS run has not finished');
  }
  if (!/^[a-f0-9]{40}$/.test(run.gitCommitHash))
    throw new Error('Missing EAS source commit');
  const job = run.jobs.find((j) => j.key === 'qa_ios');
  const report = job?.outputs?.report;
  if (typeof report !== 'string' || report.length > 50_000)
    throw new Error('Missing or oversized QA report');
  const video = job.artifacts?.find(
    (a) =>
      a.id === job.outputs.video_artifact && a.name === 'ios-agent-qa-video'
  );
  if (
    video &&
    (video.filename !== 'test-session.mp4' ||
      !(video.fileSizeBytes > 0 && video.fileSizeBytes <= 100 * 1024 * 1024) ||
      new URL(video.downloadUrl).protocol !== 'https:')
  )
    throw new Error('Invalid video artifact');
  return { report, video, sha: run.gitCommitHash };
}
