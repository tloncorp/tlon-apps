// Completion is an execution result, not approval of the PR or exhaustive coverage.
export function reviewOutcome({ context, report }) {
  const checks = report.checks || [];
  const discoveries = report.discoveries || [];
  const observed =
    checks.some(
      (c) => ['passed', 'failed'].includes(c.status) && c.evidence?.length
    ) || discoveries.some((d) => d.evidenceActions?.length >= 2);
  return {
    execution:
      context.evidenceReview === 'completed' &&
      context.video?.status === 'ready' &&
      observed &&
      !checks.some((c) => c.infrastructure)
        ? 'completed'
        : 'incomplete',
    findings: [...checks, ...discoveries].filter((c) => c.status === 'failed')
      .length,
    coverageGaps: checks.filter(
      (c) => c.status === 'blocked' && !c.infrastructure
    ).length,
  };
}
