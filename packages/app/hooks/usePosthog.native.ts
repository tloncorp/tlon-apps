import { usePostHog as useNativePosthog } from 'posthog-react-native';
import { useMemo } from 'react';

import { identifyUser } from '../utils/identifyUser';
import { PosthogClient } from './usePosthog.base';

export function usePosthog() {
  const posthog = useNativePosthog();

  return useMemo((): PosthogClient => {
    return {
      getIsOptedOut: () => posthog?.optedOut ?? false,
      optIn: () => posthog?.optIn(),
      optOut: () => posthog?.optOut(),
      identify: (userId, properties) => identifyUser(userId, properties),
      capture: (eventName, properties) =>
        posthog?.capture(eventName, properties),
      flush: async () => posthog?.flush(),
      // A preserved anonymous id would let PostHog's identify merge the next ship on this install into the previous ship's person; Sentry counting a post-logout session as a new user is the cheaper error.
      reset: () => posthog?.reset(),
      distinctId: () => {
        return posthog?.getDistinctId();
      },
    };
  }, [posthog]);
}
