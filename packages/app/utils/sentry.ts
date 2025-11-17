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
      const { breadcrumbs, ...extraData } = data;

      Sentry.captureMessage(event, {
        level: 'error',
        extra: extraData,
        contexts: breadcrumbs
          ? {
              breadcrumbs: {
                values: Array.isArray(breadcrumbs)
                  ? breadcrumbs.map((crumb: string, index: number) => ({
                      message: crumb,
                      timestamp:
                        Date.now() / 1000 - (breadcrumbs.length - index),
                    }))
                  : [],
              },
            }
          : undefined,
      });
    },
  };
}
