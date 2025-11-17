import * as Sentry from '@sentry/react-native';

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
