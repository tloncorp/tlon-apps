import * as Sentry from '@sentry/react-native';

/**
 * Identifies a user in Sentry telemetry. PostHog identification should be
 * done separately via the posthog client to avoid circular dependencies.
 *
 * @param userId - The user identifier (typically ship ID like ~sampel-palnet)
 * @param properties - Additional user properties to attach
 */
export function identifyUser(
  userId: string,
  properties?: { isHosted?: boolean; [key: string]: any }
) {
  // Update Sentry user context
  Sentry.setUser({
    id: userId,
    ...properties,
  });
}
