/**
 * Composite logger that fans analytics events out to PostHog and Sentry.
 *
 * PostHog receives every event. Sentry receives only the events listed in
 * `SENTRY_FORWARDED_EVENTS`: `app_error` (from `trackError`) and `App Error`
 * (from the debug-log upload failure path). Analytics events whose names
 * merely contain "error" (e.g. `Attestation Error`, `Error Sending Post`)
 * are PostHog-only; there is no name-based matching.
 */

export const SENTRY_FORWARDED_EVENTS: readonly string[] = [
  'app_error',
  'App Error',
];

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
      if (SENTRY_FORWARDED_EVENTS.includes(event)) {
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
