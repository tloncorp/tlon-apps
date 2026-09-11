import { PosthogClient } from './usePosthog.base';

/**
 * Links the PostHog client to the current ship. Idempotent: the SDK's persisted
 * id is the ship id in steady state, so this only fires when the two have
 * diverged (fresh install, reset SDK storage, new login).
 */
export function ensureIdentified({
  posthog,
  userId,
  isHosted,
}: {
  posthog: Pick<PosthogClient, 'identify' | 'distinctId'>;
  userId: string;
  isHosted: boolean;
}): boolean {
  if (!userId || posthog.distinctId() === userId) {
    return false;
  }

  posthog.identify(userId, { isHostedUser: isHosted, userId });
  return true;
}
