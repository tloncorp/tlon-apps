import { analyticsClient } from './posthog.web';

/**
 * Identifies a user in PostHog only; Sentry keeps the anonymous device id
 * set at startup.
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
