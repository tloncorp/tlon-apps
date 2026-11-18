export type HandoffRetry = { attempts: number; nextAttemptAt: number };

// Allow a brief gateway outage at the end of an approval or entry window.
// Anchor cleanup to the original request so restarting cannot renew it.
export function handoffTooOld(expiresAt: number) {
  return Date.now() >= expiresAt + 10 * 60_000;
}

export function nextHandoffRetry(previous?: HandoffRetry): HandoffRetry {
  const attempts = Math.min((previous?.attempts ?? 0) + 1, 7);
  return {
    attempts,
    nextAttemptAt: Date.now() + Math.min(5_000 * 2 ** (attempts - 1), 300_000),
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
