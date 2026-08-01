/**
 * Repairs for `cron` tool calls before they reach the scheduler.
 *
 * Models compose these calls by filling in the whole parameter shape, empty
 * values included — and one of those empties is not harmless. `toolsAllow`
 * is an allow-list, so `[]` allows *nothing*: the job is accepted, runs on
 * schedule, and wakes up with zero tools, unable to search, write, or post.
 * All it can do is announce that it is blocked, which reads to the owner
 * like the agent is broken rather than misconfigured.
 *
 * Prompting against it isn't enough — the field kept coming back — so the
 * empty list is dropped here, where it can't be argued with. An allow-list
 * with entries is left exactly as written: that one is a real choice.
 */

/** Parameter shape we care about; everything else passes through untouched. */
type CronToolParams = {
  job?: { payload?: { toolsAllow?: unknown } };
};

/**
 * An empty `toolsAllow` stripped from a cron call, or null when there is
 * nothing to repair (the common case, so callers can skip the rewrite).
 */
export function stripEmptyCronToolsAllow(
  params: unknown
): Record<string, unknown> | null {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return null;
  }
  const payload = (params as CronToolParams).job?.payload;
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  if (!Array.isArray(payload.toolsAllow) || payload.toolsAllow.length > 0) {
    return null;
  }
  const source = params as Record<string, unknown>;
  const job = source.job as Record<string, unknown>;
  const nextPayload: Record<string, unknown> = {
    ...(job.payload as Record<string, unknown>),
  };
  delete nextPayload.toolsAllow;
  return { ...source, job: { ...job, payload: nextPayload } };
}
