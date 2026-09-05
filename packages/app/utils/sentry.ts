import * as Sentry from '@sentry/react-native';
import { populateScope, toSentryCapture } from '@tloncorp/shared';

/**
 * Creates a Sentry error logger that implements the ErrorLoggerStub interface
 * used by packages/shared for platform-agnostic error tracking.
 *
 * This wrapper allows all logger.trackError() calls throughout the app to
 * automatically send errors to Sentry without coupling the shared package
 * to React Native-specific dependencies.
 */
export function createSentryErrorLogger() {
  return {
    capture: (event: string, data: Record<string, unknown>) => {
      const c = toSentryCapture(event, data);
      // The payload's breadcrumbs are the non-sensitive snapshot taken when
      // the error was logged; rereading the store later can attach unrelated
      // post-error activity.
      const crumbs = Array.isArray(data.breadcrumbs)
        ? data.breadcrumbs.filter((c): c is string => typeof c === 'string')
        : [];
      Sentry.withScope((scope) => {
        populateScope(scope, c, crumbs);
        if (c.kind === 'exception') {
          Sentry.captureException(c.error);
        } else {
          // captureEvent, not captureMessage: with attachStacktrace on, captureMessage titles every message with the bridge's own frames (the `capture` issues).
          Sentry.captureEvent({
            message: c.message,
            level: c.level,
            fingerprint: c.fingerprint,
          });
        }
      });
    },
  };
}
