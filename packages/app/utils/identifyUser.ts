import { posthog } from './posthogSingleton';

/**
 * Identifies a user in PostHog only. Sentry keeps the anonymous id set at
 * startup so errors stay tied to a single install, never to a ship.
 *
 * @param userId - The user identifier (typically ship ID like ~sampel-palnet)
 * @param properties - Additional user properties to attach
 */
export function identifyUser(
  userId: string,
  properties?: { isHosted?: boolean; [key: string]: any }
) {
  // Update PostHog user identification
  posthog?.identify(userId, properties);
}
