const terminal = new Set(['SUCCESS', 'FAILURE', 'CANCELED']);
export function workflowState(run) {
  if (terminal.has(run.status)) return run.status;
  if (
    !run.jobs?.length ||
    run.jobs.some(
      (job) => !terminal.has(job.status) && job.status !== 'SKIPPED'
    )
  )
    return run.status;
  // EAS workflow details can lag after every declared job is already terminal.
  if (run.jobs.some((job) => job.status === 'FAILURE')) return 'FAILURE';
  if (run.jobs.some((job) => job.status === 'CANCELED')) return 'CANCELED';
  return 'SUCCESS';
}
