const terminal = new Set(['SUCCESS', 'FAILURE', 'CANCELED']);
export const buildFinalStages = [
  'build_ios',
  { key: 'repack_ios', statuses: ['SUCCESS'] },
  { key: 'reuse_build', statuses: ['SUCCESS'] },
];
export function workflowState(run, finalKeys = []) {
  if (terminal.has(run.status)) return run.status;
  // EAS adds dependent jobs lazily. Intermediate terminal jobs do not mean the DAG finished.
  if (
    !run.jobs?.some((job) =>
      finalKeys.some((stage) => {
        const { key, statuses = [...terminal] } =
          typeof stage === 'string' ? { key: stage } : stage;
        return key === job.key && statuses.includes(job.status);
      })
    )
  )
    return run.status;
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

export function selectPreparedBuild(run, expectedId, expectedSha) {
  const build = ['repack_ios', 'reuse_build', 'build_ios']
    .map((key) => run.jobs.find((j) => j.key === key))
    .find((j) => j?.status === 'SUCCESS' && j.outputs?.build_id);
  if (!build) throw new Error('No verified simulator build prepared');
  // Refuse any substituted artifact.
  if (
    expectedId &&
    (build.outputs.build_id !== expectedId ||
      build.outputs.git_commit_hash !== expectedSha)
  )
    throw new Error(
      'Prepared build differs from the requested build ID or commit'
    );
  return build;
}

export function requestedBuild(build, id, sha) {
  if (
    build.id !== id ||
    build.gitCommitHash !== sha ||
    build.status !== 'FINISHED' ||
    build.platform !== 'IOS' ||
    build.buildProfile !== 'e2e' ||
    !build.isForIosSimulator ||
    build.appIdentifier !== 'io.tlon.groups' ||
    build.app?.id !== '617bb643-5bf6-4c40-8af6-c6e9dd7e3bd0'
  )
    throw new Error(
      'Requested build is not a matching finished e2e simulator build'
    );
  return {
    build_id: build.id,
    git_commit_hash: build.gitCommitHash,
    app_identifier: build.appIdentifier,
  };
}
