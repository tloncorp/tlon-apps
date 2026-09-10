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

// Survives unmounts so a retry (via the root error boundary) can be told apart
// from a first attempt.
let mountCount = 0;

interface DbInitTimeoutDetails {
  attempt: number;
  elapsedMs: number;
  lastError: string | null;
}

export class DbInitTimeoutError extends Error {
  details: DbInitTimeoutDetails;

  constructor(details: DbInitTimeoutDetails) {
    const lastError = details.lastError
      ? details.lastError.slice(0, MAX_LAST_ERROR_LENGTH)
      : 'none';
    super(
      `Database initialization timed out after ${DB_READY_DEADLINE_MS}ms (attempt ${details.attempt}, ${details.elapsedMs} ms elapsed); last error: ${lastError}`
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
          if (mount > 1) {
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
