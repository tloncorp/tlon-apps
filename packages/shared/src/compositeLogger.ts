import { AnalyticsSeverity } from './domain';

/**
 * Composite logger that fans analytics events out to PostHog and Sentry.
 *
 * PostHog receives every event. Sentry receives the events listed in
 * `SENTRY_FORWARDED_EVENTS` -- `app_error` (from `trackError`) and `App Error`
 * (from the debug-log upload failure path) -- plus any event tagged
 * `severity: Critical`. Everything else is PostHog-only; names are never
 * matched against a pattern, so an analytics event that merely contains
 * "error" (e.g. `Attestation Error`, `Error Sending Post`) does not qualify.
 */

export const SENTRY_FORWARDED_EVENTS: readonly string[] = [
  'app_error',
  'App Error',
];

/**
 * `trackEvent` analytics stay in PostHog unless they are tagged
 * `severity: Critical`, which marks a failure the app cannot recover from --
 * native DB setup and migration, group creation, contact matching. Those are
 * worth a typed, symbolicated Sentry issue, so they ride the same path as
 * `trackError` reports.
 */
export function isSentryForwarded(
  event: string,
  data: Record<string, unknown>
): boolean {
  return (
    SENTRY_FORWARDED_EVENTS.includes(event) ||
    data.severity === AnalyticsSeverity.Critical
  );
}

export type CompositeSink = (
  event: string,
  data: Record<string, unknown>
) => void;

export interface CompositeLoggerOptions {
  posthog?: CompositeSink; // omitted when PostHog is disabled
  sentry: CompositeSink;
  flush?: () => Promise<void>;
}

export interface CompositeLogger {
  capture: (event: string, data: Record<string, unknown>) => void;
  flush: () => Promise<void>;
}

export function createCompositeLogger(
  options: CompositeLoggerOptions
): CompositeLogger {
  return {
    capture: (event, data) => {
      if (options.posthog) {
        const forPostHog: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(data)) {
          if (key === 'errorObject') {
            continue;
          }
          forPostHog[key] = value;
        }
        try {
          options.posthog(event, forPostHog);
        } catch (e) {
          console.warn('[compositeLogger] posthog sink failed', e);
        }
      }
      if (isSentryForwarded(event, data)) {
        try {
          options.sentry(event, data);
        } catch (e) {
          console.warn('[compositeLogger] sentry sink failed', e);
        }
      }
    },
    flush: () => (options.flush ? options.flush() : Promise.resolve()),
  };
}
