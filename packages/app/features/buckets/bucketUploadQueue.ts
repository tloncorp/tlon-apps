/**
 * One queue for every Bucket upload this client runs.
 *
 * Selecting a thousand files used to start a thousand uploads at once: every
 * one asked the host for a grant in the same instant, the broker's rate limit
 * refused nearly all of them, and the refusals came back as a thousand failed
 * rows -- which Retry all then restarted in the same burst. Uploads now wait
 * here and only a few run at a time.
 *
 * Module-level rather than per pane, so navigating away, opening another
 * Bucket, or mounting the same one twice shares the one pool instead of
 * starting more workers.
 */

export const MAX_CONCURRENT_UPLOADS = 3;

/** How long the queue holds after its first refusal, doubling from there. */
const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 60_000;

/** Refusals one upload can take before it is left failed. */
export const MAX_BEGIN_REFUSALS = 8;

type Run = () => Promise<unknown>;

const runs = new Map<string, Run>();
const waiting: string[] = [];
const active = new Set<string>();
const refusals = new Map<string, number>();
let backoffLevel = 0;
let pausedUntil = 0;
let wakeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Queue an upload, or do nothing if it is already queued or running.
 *
 * `run` is kept for the upload so a requeue can start it again without the
 * pane that queued it.
 */
export function enqueueUpload(id: string, run: Run) {
  runs.set(id, run);
  if (active.has(id) || waiting.includes(id)) return;
  waiting.push(id);
  pump();
}

/** Drop a queued upload. One already running is the caller's to cancel. */
export function dequeueUpload(id: string) {
  const index = waiting.indexOf(id);
  if (index !== -1) waiting.splice(index, 1);
  if (!active.has(id)) forgetRun(id);
}

export function isUploadQueued(id: string) {
  return waiting.includes(id);
}

/**
 * The host refused to open this upload. Hold the whole queue -- a refusal
 * is almost always the broker's rate limit, and every other upload would hit
 * the same one -- and put this upload back at the front.
 *
 * Returns false once the upload has been refused too often, for the caller
 * to leave it failed.
 */
export function requeueRefusedUpload(id: string, retryAfterMs?: number) {
  const count = (refusals.get(id) ?? 0) + 1;
  refusals.set(id, count);
  if (count >= MAX_BEGIN_REFUSALS || !runs.has(id)) {
    refusals.delete(id);
    return false;
  }
  const now = Date.now();
  if (pausedUntil <= now) {
    // Only the first refusal of a hold escalates it. The uploads running
    // beside this one were refused by the same limit in the same moment, and
    // doubling for each of them held the queue far longer than the limit.
    const backoff = Math.min(
      MAX_BACKOFF_MS,
      BASE_BACKOFF_MS * 2 ** backoffLevel
    );
    backoffLevel += 1;
    const wait = Math.max(retryAfterMs ?? 0, backoff);
    // Jittered so several clients held by one limit do not return together.
    pausedUntil = now + wait + Math.random() * 0.2 * wait;
  } else if (retryAfterMs !== undefined) {
    pausedUntil = Math.max(pausedUntil, now + retryAfterMs);
  }
  if (!waiting.includes(id)) waiting.unshift(id);
  return true;
}

/**
 * The host opened an upload. Only one asked for after the hold has passed
 * says the limit has: a grant already in flight when another was refused
 * says nothing, and resetting on it kept the backoff from ever growing.
 */
export function noteUploadOpened(id: string) {
  refusals.delete(id);
  if (pausedUntil <= Date.now()) backoffLevel = 0;
}

/** When the queue next starts work, if it is holding; null otherwise. */
export function uploadQueuePausedUntil() {
  return pausedUntil > Date.now() ? pausedUntil : null;
}

/** Forget everything, for logout: the next account must not run these. */
export function resetUploadQueue() {
  waiting.length = 0;
  active.clear();
  runs.clear();
  refusals.clear();
  backoffLevel = 0;
  pausedUntil = 0;
  if (wakeTimer) clearTimeout(wakeTimer);
  wakeTimer = null;
}

function forgetRun(id: string) {
  runs.delete(id);
  refusals.delete(id);
}

function pump() {
  const now = Date.now();
  if (pausedUntil > now) {
    if (!wakeTimer) {
      wakeTimer = setTimeout(() => {
        wakeTimer = null;
        pump();
      }, pausedUntil - now);
    }
    return;
  }
  while (active.size < MAX_CONCURRENT_UPLOADS) {
    // Skip an upload still finishing the run that requeued it; it starts
    // again once that run has let go of its slot.
    const index = waiting.findIndex((id) => !active.has(id));
    if (index === -1) return;
    const [id] = waiting.splice(index, 1);
    const run = runs.get(id);
    if (!run) continue;
    active.add(id);
    // A run's own failures are its business: it records them on its row.
    // The slot is released however it ends, and only then is the next one
    // started -- so a requeue made from inside the run waits its turn.
    void Promise.resolve()
      .then(run)
      .catch(() => undefined)
      .finally(() => {
        if (!active.delete(id)) return;
        if (!waiting.includes(id)) forgetRun(id);
        pump();
      });
  }
}
