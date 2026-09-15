// Infrastructure retries may reuse a successful plan for unchanged product commits.
// EAS still revalidates every scenario and source citation against pinned Git blobs.
export function assessmentForRetry(run, id, pr) {
  const job = run?.jobs?.find((j) => j.key === 'assess_pr');
  if (
    run?.id !== id ||
    run.status !== 'SUCCESS' ||
    run.workflow?.app?.id !== '617bb643-5bf6-4c40-8af6-c6e9dd7e3bd0' ||
    run.workflow?.fileName !== 'pr-agent-qa-ios.yml' ||
    job?.status !== 'SUCCESS'
  )
    throw new Error(
      'Retry needs a successful assessment from this project and workflow'
    );
  const plan = JSON.parse(job.outputs?.assessment || 'null');
  if (
    !plan?.sourceReview ||
    plan.decision !== 'test' ||
    plan.headSha !== pr.head.sha ||
    plan.baseSha !== pr.base.sha
  )
    throw new Error(
      'Retry assessment does not match the requested product commits'
    );
  return plan;
}
