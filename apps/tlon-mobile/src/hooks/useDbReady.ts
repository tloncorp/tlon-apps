import { abandonDbInit, ensureDbReady } from '@tloncorp/app/lib/nativeDb';
import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import { useEffect, useState } from 'react';

const MAX_DB_READY_ATTEMPTS = 3;
// Not a hang proof: every step of db init is uncapped, so no finite value
// bounds the loop. This is the longest we're willing to leave the user on a
// blank screen before showing them something they can act on.
const DB_READY_DEADLINE_MS = 30_000;
const MAX_LAST_ERROR_LENGTH = 200;

const logger = createDevLogger('db-ready', false);

let mountCount = 0;
// Survives unmounts so a mount that recovers from a failed one can be told
// apart from any other remount -- the root error boundary also remounts after
// render crashes that have nothing to do with the database.
let lastMountFailed = false;
// Narrower than `lastMountFailed`, which also covers the throw path, and
// narrower than the deadline firing: it means the deadline found work still in
// flight, which is the hang signature. A mount that threw, or that hit the
// deadline during a backoff with nothing running, is worth retrying; one that
// hung twice running is wedged somewhere JS can't reach, and the button would
// only burn another deadline. See TLON-6527.
let lastMountHung = false;

interface DbInitTimeoutDetails {
  attempt: number;
  elapsedMs: number;
  lastError: string | null;
  // Whether there was still an in-flight initialization to detach. False means
  // the deadline raced a settled attempt rather than a hang.
  abandonedInFlightInit: boolean;
  // Read by RootErrorBoundary to decide whether to keep offering "Try again".
  canRetry: boolean;
}

export class DbInitTimeoutError extends Error {
  details: DbInitTimeoutDetails;

  constructor(details: DbInitTimeoutDetails) {
    super(
      `Database initialization timed out after ${DB_READY_DEADLINE_MS}ms (attempt ${details.attempt}, ${details.elapsedMs} ms elapsed); last error: ${details.lastError ?? 'none'}`
    );
    // `extends Error` leaves `name` as 'Error', and Sentry reads the exception
    // type from it.
    this.name = 'DbInitTimeoutError';
    // Deliberately not `cause`: Sentry's linked-errors integration appends
    // causes after the original exception and `ignoreErrors` is matched against
    // the last one, so a cause like 'Request timed out' would drop the whole
    // event. The cause travels in the message and in `details` instead.
    this.details = details;
  }
}

// Capped here rather than at each use: the breadcrumb, the timeout message and
// `details.lastError` all end up in the same reported payload, and
// RootErrorBoundary spreads `details` into it.
function describeError(error: unknown) {
  const described =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);

  return described.slice(0, MAX_LAST_ERROR_LENGTH);
}

export function useDbReady() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [dbInitError, setDbInitError] = useState<unknown | null>(null);

  useEffect(() => {
    const mount = ++mountCount;
    const recoveringFromFailure = lastMountFailed;
    const recoveringFromHang = lastMountHung;
    const startedAt = Date.now();
    const elapsed = () => Date.now() - startedAt;

    let cancelled = false;
    let timedOut = false;
    let attempt = 0;
    let lastError: unknown = null;
    let lastErrorText: string | null = null;
    let backoffTimer: ReturnType<typeof setTimeout> | null = null;
    let wakeBackoff: (() => void) | null = null;

    const done = () => cancelled || timedOut;

    function clearBackoff() {
      if (backoffTimer !== null) {
        clearTimeout(backoffTimer);
        backoffTimer = null;
      }
      const wake = wakeBackoff;
      wakeBackoff = null;
      wake?.();
    }

    function wait(ms: number) {
      return new Promise<void>((resolve) => {
        wakeBackoff = resolve;
        backoffTimer = setTimeout(() => {
          backoffTimer = null;
          wakeBackoff = null;
          resolve();
        }, ms);
      });
    }

    const deadlineTimer = setTimeout(() => {
      timedOut = true;
      lastMountFailed = true;
      clearBackoff();
      // Without this the next mount awaits the same promise and spends a whole
      // second deadline on work that already failed to finish.
      const abandonedInFlightInit = abandonDbInit();
      // A deadline that found nothing running -- it landed in a backoff after a
      // slow rejection -- is the throw path taking too long, not a hang, and
      // retrying recovers that.
      lastMountHung = abandonedInFlightInit;
      logger.crumb(
        `deadline fired on attempt ${attempt} (abandoned in-flight init: ${abandonedInFlightInit})`
      );
      setDbInitError(
        new DbInitTimeoutError({
          attempt,
          elapsedMs: elapsed(),
          lastError: lastErrorText,
          abandonedInFlightInit,
          canRetry: !(recoveringFromHang && abandonedInFlightInit),
        })
      );
    }, DB_READY_DEADLINE_MS);

    async function initDb() {
      for (attempt = 1; attempt <= MAX_DB_READY_ATTEMPTS; attempt++) {
        if (done()) {
          return;
        }

        logger.crumb(`attempt ${attempt} started`);

        try {
          await ensureDbReady();
          if (done()) {
            return;
          }
          clearTimeout(deadlineTimer);
          lastMountFailed = false;
          lastMountHung = false;
          if (recoveringFromFailure) {
            logger.trackEvent(AnalyticsEvent.DbReadyRetrySucceeded, {
              mount,
              attempt,
              elapsedMs: elapsed(),
            });
          }
          setIsDbReady(true);
          return;
        } catch (error) {
          lastError = error;
          lastErrorText = describeError(error);
          logger.crumb(`attempt ${attempt} failed: ${lastErrorText}`);
          if (done()) {
            return;
          }
          if (attempt < MAX_DB_READY_ATTEMPTS) {
            const backoff = 500 * attempt;
            logger.crumb(`waiting ${backoff}ms before retry`);
            await wait(backoff);
            if (done()) {
              return;
            }
          }
        }
      }

      clearTimeout(deadlineTimer);
      lastMountFailed = true;
      // Exhausting the attempts is the throw path, not a hang: the next mount
      // gets a clean slate and the button stays useful.
      lastMountHung = false;
      setDbInitError(lastError);
    }

    void initDb();

    return () => {
      cancelled = true;
      clearTimeout(deadlineTimer);
      clearBackoff();
    };
  }, []);

  return { dbInitError, isDbReady };
}
