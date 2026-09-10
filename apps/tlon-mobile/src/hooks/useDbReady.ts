import { ensureDbReady } from '@tloncorp/app/lib/nativeDb';
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

interface DbInitTimeoutDetails {
  attempt: number;
  elapsedMs: number;
  lastError: string | null;
}

export class DbInitTimeoutError extends Error {
  details: DbInitTimeoutDetails;

  constructor(details: DbInitTimeoutDetails) {
    // Capped in `details` too: RootErrorBoundary spreads them into the Sentry
    // payload, so an unbounded string would travel either way.
    const lastError = details.lastError
      ? details.lastError.slice(0, MAX_LAST_ERROR_LENGTH)
      : null;
    super(
      `Database initialization timed out after ${DB_READY_DEADLINE_MS}ms (attempt ${details.attempt}, ${details.elapsedMs} ms elapsed); last error: ${lastError ?? 'none'}`
    );
    // `extends Error` leaves `name` as 'Error', and Sentry reads the exception
    // type from it.
    this.name = 'DbInitTimeoutError';
    // Deliberately not `cause`: Sentry's linked-errors integration appends
    // causes after the original exception and `ignoreErrors` is matched against
    // the last one, so a cause like 'Request timed out' would drop the whole
    // event. The cause travels in the message and in `details` instead.
    this.details = { ...details, lastError };
  }
}

function describeError(error: unknown) {
  return error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error);
}

export function useDbReady() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [dbInitError, setDbInitError] = useState<unknown | null>(null);

  useEffect(() => {
    const mount = ++mountCount;
    const recoveringFromFailure = lastMountFailed;
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
      logger.crumb(`deadline fired on attempt ${attempt}`);
      setDbInitError(
        new DbInitTimeoutError({
          attempt,
          elapsedMs: elapsed(),
          lastError: lastErrorText,
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
