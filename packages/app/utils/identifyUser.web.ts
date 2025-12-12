import * as Sentry from '@sentry/react';

import { analyticsClient } from './posthog.web';

/**
 * Identifies a user across both PostHog and Sentry telemetry systems.
 * This ensures user context stays synchronized between both platforms.
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

  // Update Sentry user context to match
  Sentry.setUser({ id: userId, ...properties });
}
