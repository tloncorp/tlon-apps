type RetryStage = 'status read' | 'card delivery' | 'agent resume';

export type HandoffRetry = {
  attempts: number;
  nextAttemptAt: number;
  stage?: RetryStage;
};

const workerReportWindow = 30 * 60_000;

export function workerReportDeadline() {
  return Date.now() + workerReportWindow;
}

// The request deadline bounds retries until OpenClaw accepts the worker.
// From then on only the worker's report is outstanding.
export function handoffTooOld(row: {
  expiresAt: number;
  workerRunId?: string;
  workerReportDeadline?: number;
}) {
  const deadline = row.workerRunId
    ? (row.workerReportDeadline ?? row.expiresAt + workerReportWindow)
    : row.expiresAt + 10 * 60_000;
  return Date.now() >= deadline;
}

export function nextHandoffRetry(
  stage: RetryStage,
  previous?: HandoffRetry
): HandoffRetry {
  const attempts =
    previous?.stage === stage ? Math.min(previous.attempts + 1, 7) : 1;
  return {
    stage,
    attempts,
    // Check again on the next poll so a read failure does not consume the
    // approval window or keep a completed secure form blocking the browser.
    nextAttemptAt:
      Date.now() +
      (stage === 'status read'
        ? 2_000
        : Math.min(5_000 * 2 ** (attempts - 1), 300_000)),
  };
}

// Transport errors may embed a signed URL. Keep diagnostics to the failure
// class and the known gateway route rejection.
export function handoffFailureReason(error: unknown) {
  if (!(error instanceof Error)) return 'unknown error';
  if (
    /delivery (target|channel) is required|missing tlon target/i.test(
      error.message
    )
  )
    return 'missing delivery route';
  return /^[A-Za-z]{0,32}Error$/.test(error.name) ? error.name : 'error';
}
