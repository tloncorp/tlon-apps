import { analyticsClient } from './posthog.web';

/**
 * Identifies a user in PostHog telemetry (web version).
 * Note: Sentry is not yet integrated for web, so this only updates PostHog.
 *
 * @param userId - The user identifier (typically ship ID like ~sampel-palnet)
 * @param properties - Additional user properties to attach
 */
export function identifyUser(
  userId: string,
  properties?: { isHosted?: boolean; [key: string]: any }
) {
  // Update PostHog user identification
  analyticsClient?.identify(userId, properties);
}
