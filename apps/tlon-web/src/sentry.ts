import * as Sentry from '@sentry/react';
import { GIT_HASH, SENTRY_DSN } from '@tloncorp/app/constants';

const isDev = import.meta.env.DEV;

/**
 * Initialize Sentry for web error tracking.
 * Should be called early in the app bootstrap, before React renders.
 */
export function initSentry() {
  Sentry.init({
    // Only enable Sentry in production builds
    dsn: isDev ? undefined : SENTRY_DSN,

    // Don't send PII (IP address, cookies, etc.) for privacy compliance
    sendDefaultPii: false,

    // Set environment and release for better error tracking
    environment: isDev ? 'development' : 'production',
    release: GIT_HASH,

    // Tag errors with platform for filtering in Sentry UI
    initialScope: {
      tags: {
        platform: 'web',
      },
    },
  });
}

/**
 * Creates a Sentry error logger that implements the ErrorLoggerStub interface
 * used by packages/shared for platform-agnostic error tracking.
 *
 * This wrapper allows all logger.trackError() calls throughout the app to
 * automatically send errors to Sentry without coupling the shared package
 * to platform-specific dependencies.
 */
export function createSentryErrorLogger() {
  return {
    capture: (event: string, data: Record<string, unknown>) => {
      const { breadcrumbs, errorStack, errorMessage, ...extraData } = data;

      const breadcrumbContext = breadcrumbs
        ? {
            breadcrumbs: {
              values: Array.isArray(breadcrumbs)
                ? breadcrumbs.map((crumb: string, index: number) => ({
                    message: crumb,
                    timestamp: Date.now() / 1000 - (breadcrumbs.length - index),
                  }))
                : [],
            },
          }
        : undefined;

      // If we have a stack trace, create a proper Error object for Sentry
      // This enables full stack parsing and source map resolution
      if (errorStack && typeof errorStack === 'string') {
        const error = new Error(
          typeof errorMessage === 'string' ? errorMessage : event
        );
        error.stack = errorStack;

        Sentry.captureException(error, {
          level: 'error',
          extra: extraData,
          contexts: breadcrumbContext,
        });
      } else {
        // Fallback to captureMessage for errors without stack traces
        Sentry.captureMessage(event, {
          level: 'error',
          extra: extraData,
          contexts: breadcrumbContext,
        });
      }
    },
  };
}
